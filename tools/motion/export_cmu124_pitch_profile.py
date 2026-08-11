#!/usr/bin/env python3
"""Export the compact CMU 124-01 visual pitch profile through canonical FK.

Raw ASF/AMC inputs are hash-gated temporary files.  Every source key below is
derived from ``cmu_asf_amc_fk.py`` reconstructed transforms or joint geometry;
this exporter intentionally has no renderer mapping based on raw AMC Euler
indexes.  The result remains a compact visual profile and never drives game
coordinates, pitch flight, or release timing.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from copy import deepcopy
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Sequence, Tuple

from cmu_asf_amc_fk import (
    DeliveryFrame,
    Mat3,
    Vec3,
    extract_ry_zx,
    frame_fk,
    geometric_joint_flexion,
    joint_direction_in_local_frame,
    m_mul,
    m_transpose,
    m_vec,
    make_delivery_frame,
    parse_amc,
    parse_asf,
    relative_rotation,
    root_forward_metres,
    root_lateral_metres,
    root_vertical_metres,
    rotation_from_vector_pairs,
    rotation_in_delivery,
    simple_rig_forearm_direction,
    simple_rig_inverse_elbow,
    simple_rig_inverse_upper,
    simple_rig_upper_direction,
    vdot,
    vunit,
)


EXPORTER_VERSION = "b0805-30-cmu124-export-r1-fk"
CANONICAL_FK_VERSION = "cmu-asf-amc-fk-r1"
EXPECTED_ASF_SHA256 = "b0e6a62b7e151200497b8bbcf42d0e95800decabec9254f8653e57dcde45dd45"
EXPECTED_AMC_SHA256 = "7fd098ab1b535c38a3a6ae7c82f7c87299e177ce665dd65fa19db110e22f0857"
CMU_UNITS_TO_METRES = 0.056444

# Labels are source-navigation proxies, not CMU-labelled biomechanics events.
SOURCE_KEY_SPECS = (
    ("set", 1, (1, 59), "pre"),
    ("hand_separation_proxy", 59, (59, 117), "pre"),
    ("knee_rise_proxy", 118, (118, 145), "pre"),
    ("peak_knee_load_proxy", 176, (145, 176), "pre"),
    ("stride_early_proxy", 205, (180, 220), "pre"),
    ("source_left_sfc_proxy", 247, (231, 247), "pre"),
    ("plant_proxy", 265, (245, 265), "pre"),
    ("arm_cocking_proxy", 275, (265, 275), "pre"),
    ("mer_proxy", 285, (275, 295), "pre"),
    ("release_approach_proxy", 293, (285, 293), "pre"),
    ("release_proxy", 297, (293, 302), "pre"),
    ("release_post_anchor_proxy", 297, (293, 302), "post"),
    ("early_follow_through_proxy", 310, (302, 320), "post"),
    ("late_follow_through_proxy", 340, (320, 340), "post"),
    ("mir_follow_proxy", 351, (340, 351), "post"),
)

PRE_RELEASE_FRAME = 297
SFC_FRAME = 247
LOAD_FRAME = 176
PLANT_FRAME = 265
FOLLOW_END_FRAME = 351
GAME_READY_ADAPTER_SECONDS = 1.2

# Renderer-only calibration.  55 ft/m is not a physical world conversion: it
# maps a small, FK-projected root progression into the deliberately simple rig.
# The plant envelope constrains that visual mapping; it is not a source claim.
VISUAL_STRIDE_FT_PER_METRE = 55.0
MAX_POST_PLANT_BACKSTEP_FT = 0.14
MAX_POST_PLANT_TOTAL_REVERSAL_FT = 0.24
ROOT_RISE_FT_PER_METRE = 1.0
FOLLOW_CARRY_FT_PER_METRE = 2.1
FIGURE_SCALE = 1.4
ROOT_YAW_VISUAL_GAIN = 0.75
ROOT_LEAN_VISUAL_GAIN = 0.35
TORSO_VISUAL_GAIN = 0.85

# This fixed release-pose calibration is solved in 3D vector space.  The source
# pair at frame 297 is mapped to a simple-rig pair that uses the unchanged game
# release point only as a visual alignment target.  It is not an AMC Euler map.
RIG_RELEASE_TARGET = {
    "throwArmElevation": -2.70,
    "throwArmPlane": -0.396,
}

# Derived from the existing generic fielder-ready return contract in drawFigure:
# neutral arms/legs, no raw-source recovery pose, and every channel strictly
# inside the declared ready envelope below.
GAME_READY_ADAPTER_CHANNELS = {
    "rootForward": 0.0,
    "throwFollowCarry": 0.0,
    "rootRise": 0.0,
    "pelvisYaw": 0.0,
    "pelvisLean": 0.0,
    "torsoYaw": 0.0,
    "torsoLean": 0.12,
    "torsoTilt": 0.0,
    "throwArmElevation": 0.28,
    "throwArmPlane": 0.0,
    "throwElbow": 0.65,
    "gloveArmElevation": 0.30,
    "gloveArmPlane": 0.0,
    "gloveElbow": 0.65,
    "leadLeg": 0.10,
    "leadKnee": 0.18,
    "trailLeg": -0.10,
    "trailKnee": 0.18,
}


def rounded(value: float) -> float:
    result = round(float(value), 6)
    return 0.0 if result == 0.0 else result


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def require_exact_source(asf_path: Path, amc_path: Path) -> None:
    if asf_path.name != "124.asf" or amc_path.name != "124_01.amc":
        raise ValueError("This exporter accepts only CMU Subject 124 Trial 124-01 filenames.")
    if sha256_file(asf_path) != EXPECTED_ASF_SHA256:
        raise ValueError("124.asf SHA-256 does not match the approved CMU source.")
    if sha256_file(amc_path) != EXPECTED_AMC_SHA256:
        raise ValueError("124_01.amc SHA-256 does not match the approved CMU source.")
    if ":root" not in asf_path.read_text(encoding="utf-8", errors="replace"):
        raise ValueError("124.asf is not an expected Acclaim skeleton file.")


def key_time(frame: int, segment: str) -> float:
    if segment == "pre":
        return rounded((frame - 1) / (PRE_RELEASE_FRAME - 1))
    return rounded((frame - PRE_RELEASE_FRAME) / 120.0)


def source_root_ranges(positions_by_frame: Mapping[int, Mapping[str, Vec3]]) -> Dict[str, List[float]]:
    roots = [positions_by_frame[frame]["root"] for frame in sorted(positions_by_frame)]
    return {
        axis: [rounded(min(root[index] for root in roots) * CMU_UNITS_TO_METRES), rounded(max(root[index] for root in roots) * CMU_UNITS_TO_METRES)]
        for axis, index in (("x", 0), ("y", 1), ("z", 2))
    }


def simple_rig_arm_pair(elevation: float, plane: float, elbow: float) -> Tuple[Vec3, Vec3]:
    return (
        simple_rig_upper_direction(elevation, plane),
        simple_rig_forearm_direction(elevation, plane, elbow),
    )


def make_throwing_arm_calibration(
    positions: Mapping[str, Vec3], rotations: Mapping[str, Mat3], delivery: DeliveryFrame
) -> Tuple[Mat3, Dict[str, float]]:
    source_upper = joint_direction_in_local_frame(
        positions["rhumerus"], positions["rradius"], rotations["thorax"], delivery
    )
    source_forearm = joint_direction_in_local_frame(
        positions["rradius"], positions["rwrist"], rotations["thorax"], delivery
    )
    geometric_elbow = geometric_joint_flexion(positions["rhumerus"], positions["rradius"], positions["rwrist"])
    target_upper, target_forearm = simple_rig_arm_pair(
        RIG_RELEASE_TARGET["throwArmElevation"], RIG_RELEASE_TARGET["throwArmPlane"], geometric_elbow
    )
    return rotation_from_vector_pairs(source_upper, source_forearm, target_upper, target_forearm), {
        "releaseSourceElbowFlexionRadians": rounded(geometric_elbow),
        "releaseRigElevationRadians": RIG_RELEASE_TARGET["throwArmElevation"],
        "releaseRigPlaneRadians": RIG_RELEASE_TARGET["throwArmPlane"],
    }


def make_glove_arm_calibration(
    positions: Mapping[str, Vec3], rotations: Mapping[str, Mat3], delivery: DeliveryFrame
) -> Tuple[Mat3, Dict[str, float]]:
    source_upper = joint_direction_in_local_frame(
        positions["lhumerus"], positions["lradius"], rotations["thorax"], delivery
    )
    source_forearm = joint_direction_in_local_frame(
        positions["lradius"], positions["lwrist"], rotations["thorax"], delivery
    )
    geometric_elbow = geometric_joint_flexion(positions["lhumerus"], positions["lradius"], positions["lwrist"])
    target_upper, target_forearm = simple_rig_arm_pair(0.30, 0.0, geometric_elbow)
    return rotation_from_vector_pairs(source_upper, source_forearm, target_upper, target_forearm), {
        "setSourceElbowFlexionRadians": rounded(geometric_elbow),
        "setRigElevationRadians": 0.30,
        "setRigPlaneRadians": 0.0,
    }


def derive_arm_channels(
    positions: Mapping[str, Vec3], rotations: Mapping[str, Mat3], delivery: DeliveryFrame,
    shoulder: str, elbow: str, wrist: str, calibration: Mat3, preferred_elevation: float | None = None,
) -> Tuple[Dict[str, float], float]:
    source_upper = joint_direction_in_local_frame(positions[shoulder], positions[elbow], rotations["thorax"], delivery)
    source_forearm = joint_direction_in_local_frame(positions[elbow], positions[wrist], rotations["thorax"], delivery)
    upper = vunit(m_vec(calibration, source_upper))
    forearm = vunit(m_vec(calibration, source_forearm))
    elevation, plane = simple_rig_inverse_upper(upper, preferred_elevation)
    elbow_bend = simple_rig_inverse_elbow(upper, forearm, elevation, plane)
    return {
        "Elevation": rounded(elevation),
        "Plane": rounded(plane),
        "Elbow": rounded(elbow_bend),
    }, rounded(geometric_joint_flexion(positions[shoulder], positions[elbow], positions[wrist]))


def derive_leg_channels(
    positions: Mapping[str, Vec3], rotations: Mapping[str, Mat3], delivery: DeliveryFrame,
    hip: str, knee: str, foot: str,
) -> Tuple[float, float]:
    thigh = joint_direction_in_local_frame(positions[hip], positions[knee], rotations["root"], delivery)
    # The simple rig has no lateral hip/ankle degree of freedom.  Only the
    # pelvis-local sagittal projection is retained; lateral geometry is not
    # silently repurposed as forward stride.
    leg = math.atan2(-thigh[2], -thigh[1])
    knee_flexion = geometric_joint_flexion(positions[hip], positions[knee], positions[foot])
    return rounded(leg), rounded(knee_flexion)


def visual_stride_track(forward_metres: Sequence[float], frames: Sequence[int]) -> List[float]:
    if len(forward_metres) != len(frames):
        raise ValueError("Stride samples and frame ids must have equal length")
    peak_candidates = [max(0.0, value) * VISUAL_STRIDE_FT_PER_METRE for value, frame in zip(forward_metres, frames) if frame <= SFC_FRAME]
    if not peak_candidates:
        raise ValueError("SFC stride calibration is missing")
    plant_peak = max(peak_candidates)
    output: List[float] = []
    for value, frame in zip(forward_metres, frames):
        raw_visual = max(0.0, value) * VISUAL_STRIDE_FT_PER_METRE
        if frame < SFC_FRAME:
            visual = raw_visual
        else:
            previous = output[-1] if output else plant_peak
            visual = max(
                raw_visual,
                plant_peak - MAX_POST_PLANT_TOTAL_REVERSAL_FT,
                previous - MAX_POST_PLANT_BACKSTEP_FT,
            )
        output.append(rounded(visual))
    return output


def derive_source_keys(
    positions_by_frame: Mapping[int, Mapping[str, Vec3]],
    rotations_by_frame: Mapping[int, Mapping[str, Mat3]],
    delivery: DeliveryFrame,
) -> Tuple[List[Dict[str, object]], Dict[str, object]]:
    reference_root = positions_by_frame[1]["root"]
    root0 = rotation_in_delivery(rotations_by_frame[1]["root"], delivery)
    release_positions = positions_by_frame[PRE_RELEASE_FRAME]
    release_rotations = rotations_by_frame[PRE_RELEASE_FRAME]
    release_wrist_forward_m = root_forward_metres(
        release_positions["rwrist"], release_positions["root"], delivery, CMU_UNITS_TO_METRES
    )
    arm_calibration, arm_calibration_note = make_throwing_arm_calibration(release_positions, release_rotations, delivery)
    glove_calibration, glove_calibration_note = make_glove_arm_calibration(
        positions_by_frame[1], rotations_by_frame[1], delivery
    )
    forward_metres = [
        root_forward_metres(positions_by_frame[frame]["root"], reference_root, delivery, CMU_UNITS_TO_METRES)
        for _, frame, _, _ in SOURCE_KEY_SPECS
    ]
    visual_strides = visual_stride_track(forward_metres, [frame for _, frame, _, _ in SOURCE_KEY_SPECS])
    keys: List[Dict[str, object]] = []
    qa_root_projection: Dict[str, Dict[str, float]] = {}
    for (label, frame, frame_range, segment), forward_m, visual_stride in zip(SOURCE_KEY_SPECS, forward_metres, visual_strides):
        positions = positions_by_frame[frame]
        rotations = rotations_by_frame[frame]
        root_relative = m_mul(m_transpose(root0), rotation_in_delivery(rotations["root"], delivery))
        pelvis_yaw, pelvis_lean, _ = extract_ry_zx(root_relative)
        torso_relative = relative_rotation(rotations["root"], rotations["thorax"], delivery)
        torso_yaw, torso_lean, torso_tilt = extract_ry_zx(torso_relative)
        throw, throw_flexion = derive_arm_channels(
            positions, rotations, delivery, "rhumerus", "rradius", "rwrist", arm_calibration,
            RIG_RELEASE_TARGET["throwArmElevation"],
        )
        glove, glove_flexion = derive_arm_channels(
            positions, rotations, delivery, "lhumerus", "lradius", "lwrist", glove_calibration
        )
        lead_leg, lead_knee = derive_leg_channels(positions, rotations, delivery, "lfemur", "ltibia", "lfoot")
        trail_leg, trail_knee = derive_leg_channels(positions, rotations, delivery, "rfemur", "rtibia", "rfoot")
        root_lateral_m = root_lateral_metres(positions["root"], reference_root, delivery, CMU_UNITS_TO_METRES)
        root_vertical_m = root_vertical_metres(positions["root"], reference_root, CMU_UNITS_TO_METRES)
        wrist_forward_m = root_forward_metres(
            positions["rwrist"], positions["root"], delivery, CMU_UNITS_TO_METRES
        )
        throw_follow_carry = 0.0 if frame <= PRE_RELEASE_FRAME else max(
            0.0, release_wrist_forward_m - wrist_forward_m
        ) * FOLLOW_CARRY_FT_PER_METRE
        channels = {
            "rootForward": visual_stride,
            "throwFollowCarry": rounded(throw_follow_carry),
            "rootRise": rounded(root_vertical_m * ROOT_RISE_FT_PER_METRE),
            "pelvisYaw": rounded(pelvis_yaw * ROOT_YAW_VISUAL_GAIN),
            "pelvisLean": rounded(pelvis_lean * ROOT_LEAN_VISUAL_GAIN),
            "torsoYaw": rounded(torso_yaw * TORSO_VISUAL_GAIN),
            "torsoLean": rounded(torso_lean * TORSO_VISUAL_GAIN),
            "torsoTilt": rounded(torso_tilt * TORSO_VISUAL_GAIN),
            "throwArmElevation": throw["Elevation"],
            "throwArmPlane": throw["Plane"],
            "throwElbow": throw["Elbow"],
            "gloveArmElevation": glove["Elevation"],
            "gloveArmPlane": glove["Plane"],
            "gloveElbow": glove["Elbow"],
            "leadLeg": lead_leg,
            "leadKnee": lead_knee,
            "trailLeg": trail_leg,
            "trailKnee": trail_knee,
        }
        qa = {
            "rootForwardMetres": rounded(forward_m),
            "throwFollowCarrySourceMetres": rounded(
                max(0.0, release_wrist_forward_m - wrist_forward_m
            ) if frame > PRE_RELEASE_FRAME else 0.0
            ),
            "rootLateralMetres": rounded(root_lateral_m),
            "rootVerticalMetres": rounded(root_vertical_m),
            "throwElbowFlexionRadians": throw_flexion,
            "gloveElbowFlexionRadians": glove_flexion,
        }
        qa_root_projection[label] = {
            "forwardMetres": qa["rootForwardMetres"],
            "lateralMetres": qa["rootLateralMetres"],
            "verticalMetres": qa["rootVerticalMetres"],
        }
        keys.append({
            "id": label,
            "segment": segment,
            "time": key_time(frame, segment),
            "sourceKey": True,
            "adapterKey": False,
            "sourceFrame": frame,
            "sourceFrameRange": list(frame_range),
            "channels": channels,
            "qa": qa,
        })
    return keys, {
        "deliveryFrame": {
            "upWorld": [rounded(value) for value in delivery.up],
            "forwardWorld": [rounded(value) for value in delivery.forward],
            "lateralRightWorld": [rounded(value) for value in delivery.lateral_right],
            "leadFoot": delivery.lead_foot,
            "loadFrame": delivery.load_frame,
            "plantFrame": delivery.plant_frame,
            "leadFootStrideSourceUnits": rounded(delivery.lead_foot_stride_source_units),
            "leadFootStrideMetres": rounded(delivery.lead_foot_stride_source_units * CMU_UNITS_TO_METRES),
        },
        "selectedRootProjectionMetres": qa_root_projection,
        "armRigCalibration": arm_calibration_note,
        "gloveRigCalibration": glove_calibration_note,
    }


def game_ready_adapter_key() -> Dict[str, object]:
    return {
        "id": "game_field_ready_adapter",
        "segment": "post",
        "time": GAME_READY_ADAPTER_SECONDS,
        "sourceKey": False,
        "adapterKey": True,
        "sourceFrame": None,
        "sourceFrameRange": None,
        "adapter": {
            "contract": "drawFigure/fielderReadyPose generic neutral fallback",
            "reason": "Game-side recovery adapter after CMU source follow-through ends at frame 351; not a CMU event key.",
        },
        "channels": deepcopy(GAME_READY_ADAPTER_CHANNELS),
    }


def build_profile(asf_path: Path, amc_path: Path) -> Dict[str, object]:
    require_exact_source(asf_path, amc_path)
    skeleton = parse_asf(asf_path)
    frames = parse_amc(amc_path)
    frame_numbers = [int(frame["number"]) for frame in frames]
    if len(frames) != 643 or frame_numbers != list(range(1, 644)):
        raise ValueError("124-01 frame inventory was not exactly 1..643 (643 frames).")
    positions_by_frame: Dict[int, Mapping[str, Vec3]] = {}
    rotations_by_frame: Dict[int, Mapping[str, Mat3]] = {}
    for frame in frames:
        number = int(frame["number"])
        positions, rotations = frame_fk(skeleton, frame)
        positions_by_frame[number] = positions
        rotations_by_frame[number] = rotations
    delivery = make_delivery_frame(
        positions_by_frame, load_frame=LOAD_FRAME, plant_frame=PLANT_FRAME, lead_foot="lfoot"
    )
    keys, geometry_qa = derive_source_keys(positions_by_frame, rotations_by_frame, delivery)
    keys.append(game_ready_adapter_key())
    return {
        "schemaVersion": "pitch-motion-profile/v1",
        "id": "cmu124_01_pitch_visual_v1",
        "source": {
            "database": "CMU Graphics Lab Motion Capture Database",
            "subject": "124",
            "trial": "124-01",
            "asfSha256": EXPECTED_ASF_SHA256,
            "amcSha256": EXPECTED_AMC_SHA256,
            "frameCount": 643,
            "fps": 120,
            "terms": "CMU mocap database terms: free use, including commercial work; do not directly resell the data or converted data.",
            "termsUrl": "https://mocap.cs.cmu.edu/",
            "attribution": "Source attribution retained in repository documentation; CMU attribution is requested/appreciated, not treated here as a condition of use.",
            "sourceLaterality": "provisional_right_mirrorable",
            "uncertainty": "No ball, bat, force, release-speed, or laboratory biomechanical labels are present. Root yaw is a rendering proxy, not measured pelvis orientation.",
        },
        "exporter": {
            "version": EXPORTER_VERSION,
            "sha256": sha256_file(Path(__file__).resolve()),
            "sourceIsolation": "Only selected compact keys are emitted; raw ASF/AMC frames are temporary input and must not be committed.",
            "derivation": "canonical_asf_amc_fk_geometry",
        },
        "canonicalFk": {
            "implementation": "tools/motion/cmu_asf_amc_fk.py",
            "version": CANONICAL_FK_VERSION,
            "axisConvention": "asf_axis_basis_sandwich",
            "rootAxis": "Y_up",
            "method": "ASF axes/DOF basis sandwich, parent-to-child FK, fixed delivery frame, transform-relative torso, and geometric limb vectors.",
        },
        "renderer": {
            "defaultRigThrowSide": "L",
            "figureScale": FIGURE_SCALE,
            "rootForwardUnit": "renderer_feet",
            "armMapping": "3D vector-pair calibration plus inverse of drawFigure upper-arm transform; no raw AMC Euler affine map.",
            "coordinateCalibration": "The provisional source-right throwing chain maps to rig-left because the unchanged game release is on +X in the existing pitcher-facing coordinate system. Mirror remains first-class and swaps rig sides deterministically.",
        },
        "timing": {
            "gameplayWindupSeconds": 0.85,
            "preReleaseSourceFrames": [1, PRE_RELEASE_FRAME],
            "releaseProxySourceFrames": [293, 302],
            "postReleaseSourceFrames": [PRE_RELEASE_FRAME, FOLLOW_END_FRAME],
            "postReleaseDisplaySeconds": GAME_READY_ADAPTER_SECONDS,
            "rationale": "The renderer normalizes source timing into the unchanged 0.85 s gameplay windup. After source frame 351, it blends to an explicit game-side ready adapter on a renderer-owned clock and never reads pitch.t.",
        },
        "retarget": {
            "visualStrideCalibration": {
                "feetPerSourceMetre": VISUAL_STRIDE_FT_PER_METRE,
                "origin": "frame-1 root projected onto the fixed delivery-forward axis",
                "postPlantMaxBackstepFeet": MAX_POST_PLANT_BACKSTEP_FT,
                "postPlantMaxTotalReversalFeet": MAX_POST_PLANT_TOTAL_REVERSAL_FT,
                "note": "The backstep limits are simple-rig engineering tolerances, not source biomechanics constants.",
            },
            "rootRiseFeetPerSourceMetre": ROOT_RISE_FT_PER_METRE,
            "postReleaseFollowCarry": {
                "feetPerSourceMetre": FOLLOW_CARRY_FT_PER_METRE,
                "sourceMeasure": "max(0, release wrist-root delivery-forward minus current wrist-root delivery-forward)",
                "use": "Renderer-only body carry after release; distinct from rootForward stride and derived from canonical FK wrist geometry.",
            },
            "rootYawVisualGain": ROOT_YAW_VISUAL_GAIN,
            "rootLeanVisualGain": ROOT_LEAN_VISUAL_GAIN,
            "torsoVisualGain": TORSO_VISUAL_GAIN,
        },
        "offlineQa": {
            "cmuLengthUnitToMetres": CMU_UNITS_TO_METRES,
            "rootTranslationMetreRanges": source_root_ranges(positions_by_frame),
            "rootTranslationUse": "Sparse selected-key source geometry QA only; not a game-world transform and not a launch-coordinate input.",
            **geometry_qa,
        },
        "eventProxyNotes": "All source event labels are navigation proxies. They are not asserted as measured biomechanical events. The final game adapter is explicitly not a source event.",
        "keys": keys,
    }


def profile_matches_canonical_fk(profile: Mapping[str, object], asf_path: Path, amc_path: Path) -> bool:
    """Strict exporter-level oracle used by the mutation test; no raw-index path can pass."""
    return profile == build_profile(asf_path, amc_path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asf", type=Path, required=True)
    parser.add_argument("--amc", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    profile = build_profile(args.asf.resolve(), args.amc.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(profile, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
