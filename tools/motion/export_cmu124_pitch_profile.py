#!/usr/bin/env python3
"""Export the compact, visual-only CMU Subject 124 Trial 124-01 pitch profile.

The exporter intentionally accepts only the two verified CMU source files and emits
fifteen selected event keys.  It never copies the raw ASF/AMC payload into the
repository and it never converts source root translation into game-world motion.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Dict, Iterable, List


EXPORTER_VERSION = "b0805-30-cmu124-export-v1"
EXPECTED_ASF_SHA256 = "b0e6a62b7e151200497b8bbcf42d0e95800decabec9254f8653e57dcde45dd45"
EXPECTED_AMC_SHA256 = "7fd098ab1b535c38a3a6ae7c82f7c87299e177ce665dd65fa19db110e22f0857"
CMU_UNITS_TO_METRES = 0.056444


# These labels are source-navigation proxies, not measured biomechanical claims.
KEY_SPECS = (
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
    ("field_ready_adapter_proxy", 585, (526, 585), "post"),
)

PRE_FRAMES = 297 - 1
POST_FRAMES = 585 - 297


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


def parse_amc(path: Path) -> Dict[int, Dict[str, List[float]]]:
    """Read only the sparse per-joint values needed for selected keys.

    The returned frame data exists only while the exporter runs.  The generated
    artifact contains compact derived channels at KEY_SPECS, never the full trial.
    """
    frames: Dict[int, Dict[str, List[float]]] = {}
    current: Dict[str, List[float]] | None = None
    frame_number: int | None = None
    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith(":"):
            continue
        if line.isdigit():
            frame_number = int(line)
            current = {}
            frames[frame_number] = current
            continue
        if current is None or frame_number is None:
            continue
        fields = line.split()
        current[fields[0]] = [float(value) for value in fields[1:]]
    if len(frames) != 643 or min(frames, default=0) != 1 or max(frames, default=0) != 643:
        raise ValueError("124-01 frame inventory was not exactly 1..643 (643 frames).")
    return frames


def get(values: Dict[str, List[float]], joint: str, index: int = 0) -> float:
    try:
        return values[joint][index]
    except (KeyError, IndexError) as error:
        raise ValueError(f"Missing expected AMC value: {joint}[{index}]") from error


def radians(value: float, scale: float = 1.0) -> float:
    return round(math.radians(value) * scale, 6)


def clamp(value: float, low: float, high: float) -> float:
    return round(max(low, min(high, value)), 6)


def key_time(frame: int, segment: str) -> float:
    if segment == "pre":
        return round((frame - 1) / PRE_FRAMES, 6)
    return round((frame - 297) / 120.0, 6)


def source_root_ranges(frames: Iterable[Dict[str, List[float]]]) -> Dict[str, List[float]]:
    root_rows = [row["root"] for row in frames]
    return {
        axis: [
            round(min(row[index] for row in root_rows) * CMU_UNITS_TO_METRES, 6),
            round(max(row[index] for row in root_rows) * CMU_UNITS_TO_METRES, 6),
        ]
        for axis, index in (("x", 0), ("y", 1), ("z", 2))
    }


def derive_keys(frames: Dict[int, Dict[str, List[float]]]) -> List[Dict[str, object]]:
    selected_root_x = [get(frames[frame], "root", 0) for _, frame, _, _ in KEY_SPECS]
    root_x_start = selected_root_x[0]
    root_x_span = max(0.000001, max(selected_root_x) - root_x_start)
    keys: List[Dict[str, object]] = []
    for label, frame, frame_range, segment in KEY_SPECS:
        row = frames[frame]
        root = row["root"]
        lowerback = row["lowerback"]
        upperback = row["upperback"]
        thorax = row["thorax"]
        rhumerus = row["rhumerus"]
        lhumerus = row["lhumerus"]
        # Compact rendering controls.  They are deliberately bounded display
        # controls, not a claim that these are laboratory joint-angle measures.
        channels = {
            "rootForward": clamp((root[0] - root_x_start) / root_x_span, 0.0, 1.0),
            "rootRise": clamp((root[1] - frames[1]["root"][1]) * 0.025, -0.28, 0.42),
            "pelvisYaw": radians(root[4], 0.55),
            "pelvisLean": radians(root[3], 0.32),
            "torsoYaw": radians(lowerback[1] + upperback[1] + thorax[1], 0.28),
            "torsoLean": radians(lowerback[0] + upperback[0] + thorax[0], 0.24),
            "torsoTilt": radians(lowerback[2] + upperback[2] + thorax[2], 0.24),
            "throwArmElevation": clamp(radians(-get(row, "rhumerus", 0), 0.78), -2.75, 1.25),
            "throwArmPlane": clamp(radians(get(row, "rhumerus", 2), 0.42), -1.65, 1.65),
            "throwElbow": clamp(radians(get(row, "rradius", 0) - 20.0, 0.86), 0.04, 2.65),
            "gloveArmElevation": clamp(radians(-get(row, "lhumerus", 0), 0.72), -2.65, 1.45),
            "gloveArmPlane": clamp(radians(get(row, "lhumerus", 2), 0.38), -1.65, 1.65),
            "gloveElbow": clamp(radians(get(row, "lradius", 0) - 20.0, 0.82), 0.04, 2.65),
            "leadLeg": clamp(radians(-get(row, "lfemur", 0), 0.72), -1.75, 1.55),
            "leadKnee": clamp(radians(get(row, "ltibia", 0) - 18.0, 0.72), 0.02, 2.05),
            "trailLeg": clamp(radians(-get(row, "rfemur", 0), 0.72), -1.75, 1.55),
            "trailKnee": clamp(radians(get(row, "rtibia", 0) - 18.0, 0.72), 0.02, 2.05),
        }
        keys.append(
            {
                "id": label,
                "segment": segment,
                "time": key_time(frame, segment),
                "sourceFrame": frame,
                "sourceFrameRange": list(frame_range),
                "channels": channels,
            }
        )
    return keys


def build_profile(asf_path: Path, amc_path: Path) -> Dict[str, object]:
    require_exact_source(asf_path, amc_path)
    frames = parse_amc(amc_path)
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
        },
        "timing": {
            "gameplayWindupSeconds": 0.85,
            "preReleaseSourceFrames": [1, 297],
            "releaseProxySourceFrames": [293, 302],
            "postReleaseSourceFrames": [297, 585],
            "postReleaseDisplaySeconds": 2.4,
            "rationale": "The renderer normalizes source timing into the existing 0.85 s gameplay windup. Post-release display time is renderer-owned and never reads pitch.t.",
        },
        "offlineQa": {
            "cmuLengthUnitToMetres": CMU_UNITS_TO_METRES,
            "rootTranslationMetreRanges": source_root_ranges(frames.values()),
            "rootTranslationUse": "offline source QA only; not a game-world transform and not a launch-coordinate input.",
        },
        "eventProxyNotes": "All event labels below are source-navigation proxies. They are not asserted as measured biomechanical events.",
        "keys": derive_keys(frames),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asf", type=Path, required=True)
    parser.add_argument("--amc", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    profile = build_profile(args.asf.resolve(), args.amc.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Force LF so the committed compact artifact is byte-reproducible on Windows too.
    with args.output.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(profile, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
