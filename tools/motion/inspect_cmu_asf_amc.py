#!/usr/bin/env python3
"""Inspect a small CMU ASF/AMC set locally without copying motion samples into Git.

This tool implements Acclaim forward kinematics (axis-basis sandwich plus
parent-to-child transforms) before deriving any joint-space measure. In
particular, it never treats AMC Euler channel values as world-space angles.

It is intended for the narrow CMU Subject #124 qualification task. Point
``--out`` and ``--preview-dir`` at a non-repository temporary directory. The
JSON output contains aggregate measurements and suggested frame ranges only;
it deliberately does not export per-frame source motion.

Source provenance: CMU Graphics Lab Motion Capture Database,
https://mocap.cs.cmu.edu/. Raw files remain external to this repository and
must not be added to Git.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Mapping, Sequence, Tuple

Vec3 = Tuple[float, float, float]
Mat3 = Tuple[Tuple[float, float, float], Tuple[float, float, float], Tuple[float, float, float]]
IDENTITY: Mat3 = ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0))


@dataclass
class Bone:
    name: str
    direction: Vec3
    length: float
    axis: Vec3 = (0.0, 0.0, 0.0)
    axis_order: str = "XYZ"
    dof: List[str] = field(default_factory=list)
    parent: str | None = None


@dataclass
class Skeleton:
    units: Dict[str, float]
    root_order: List[str]
    root_axis_order: str
    root_position: Vec3
    root_orientation: Vec3
    bones: Dict[str, Bone]
    children: Dict[str, List[str]]


def vadd(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def vsub(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def vscale(a: Vec3, s: float) -> Vec3:
    return (a[0] * s, a[1] * s, a[2] * s)


def vdot(a: Vec3, b: Vec3) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def vnorm(a: Vec3) -> float:
    return math.sqrt(vdot(a, a))


def vunit(a: Vec3) -> Vec3:
    n = vnorm(a)
    return (0.0, 0.0, 0.0) if n == 0.0 else vscale(a, 1.0 / n)


def m_mul(a: Mat3, b: Mat3) -> Mat3:
    return tuple(tuple(sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)) for i in range(3))  # type: ignore[return-value]


def m_vec(m: Mat3, v: Vec3) -> Vec3:
    return (
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
    )


def m_transpose(m: Mat3) -> Mat3:
    return tuple(tuple(m[j][i] for j in range(3)) for i in range(3))  # type: ignore[return-value]


def rot(axis: str, degrees: float) -> Mat3:
    a = math.radians(degrees)
    c, s = math.cos(a), math.sin(a)
    axis = axis.lower().replace("r", "")
    if axis == "x":
        return ((1.0, 0.0, 0.0), (0.0, c, -s), (0.0, s, c))
    if axis == "y":
        return ((c, 0.0, s), (0.0, 1.0, 0.0), (-s, 0.0, c))
    if axis == "z":
        return ((c, -s, 0.0), (s, c, 0.0), (0.0, 0.0, 1.0))
    raise ValueError(f"Unsupported rotation axis: {axis}")


def euler(order: Sequence[str], values: Sequence[float]) -> Mat3:
    """Compose Acclaim channel rotations in the declared local channel order."""
    out = IDENTITY
    for token, value in zip(order, values):
        if token.lower().startswith("r") or token.lower() in {"x", "y", "z"}:
            out = m_mul(out, rot(token, value))
    return out


def parse_asf(path: Path) -> Skeleton:
    lines = [line.strip() for line in path.read_text(encoding="utf-8", errors="replace").splitlines()]
    units: Dict[str, float] = {}
    root_order: List[str] = []
    root_axis_order = "XYZ"
    root_position: Vec3 = (0.0, 0.0, 0.0)
    root_orientation: Vec3 = (0.0, 0.0, 0.0)
    bones: Dict[str, Bone] = {}
    children: Dict[str, List[str]] = {"root": []}
    section = ""
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line or line.startswith("#"):
            i += 1
            continue
        if line.startswith(":"):
            section = line[1:].lower()
            i += 1
            continue
        if section == "units":
            parts = line.split()
            if len(parts) == 2:
                try:
                    units[parts[0].lower()] = float(parts[1])
                except ValueError:
                    pass
            i += 1
            continue
        if section == "root":
            parts = line.split()
            key = parts[0].lower()
            if key == "order":
                root_order = parts[1:]
            elif key == "axis" and len(parts) > 1:
                root_axis_order = parts[1]
            elif key == "position" and len(parts) >= 4:
                root_position = tuple(float(x) for x in parts[1:4])  # type: ignore[assignment]
            elif key == "orientation" and len(parts) >= 4:
                root_orientation = tuple(float(x) for x in parts[1:4])  # type: ignore[assignment]
            i += 1
            continue
        if section == "bonedata":
            if line.lower() != "begin":
                i += 1
                continue
            fields: Dict[str, object] = {"dof": []}
            i += 1
            while i < len(lines) and lines[i].lower() != "end":
                parts = lines[i].split()
                if parts:
                    key = parts[0].lower()
                    if key == "name":
                        fields["name"] = parts[1]
                    elif key == "direction":
                        fields["direction"] = tuple(float(x) for x in parts[1:4])
                    elif key == "length":
                        fields["length"] = float(parts[1])
                    elif key == "axis":
                        fields["axis"] = tuple(float(x) for x in parts[1:4])
                        fields["axis_order"] = parts[4] if len(parts) > 4 else "XYZ"
                    elif key == "dof":
                        fields["dof"] = parts[1:]
                i += 1
            if "name" not in fields or "direction" not in fields or "length" not in fields:
                raise ValueError(f"Incomplete bone block in {path}")
            bone = Bone(
                name=str(fields["name"]), direction=fields["direction"], length=float(fields["length"]),  # type: ignore[arg-type]
                axis=fields.get("axis", (0.0, 0.0, 0.0)), axis_order=str(fields.get("axis_order", "XYZ")),  # type: ignore[arg-type]
                dof=list(fields.get("dof", [])),  # type: ignore[arg-type]
            )
            bones[bone.name] = bone
            children.setdefault(bone.name, [])
            i += 1
            continue
        if section == "hierarchy":
            if line.lower() in {"begin", "end"}:
                i += 1
                continue
            parts = line.split()
            if len(parts) >= 2:
                parent, kids = parts[0], parts[1:]
                children.setdefault(parent, [])
                for child in kids:
                    if child not in bones:
                        raise ValueError(f"Hierarchy names unknown bone {child}")
                    bones[child].parent = parent
                    children[parent].append(child)
            i += 1
            continue
        i += 1
    if not bones or not root_order or not children["root"]:
        raise ValueError(f"ASF parse incomplete for {path}")
    return Skeleton(units, root_order, root_axis_order, root_position, root_orientation, bones, children)


def parse_amc(path: Path) -> List[Dict[str, object]]:
    frames: List[Dict[str, object]] = []
    current: Dict[str, object] | None = None
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith(":"):
            continue
        if re.fullmatch(r"\d+", line):
            if current is not None:
                frames.append(current)
            current = {"number": int(line), "channels": {}}
            continue
        if current is None:
            raise ValueError(f"AMC joint row before frame number in {path}")
        parts = line.split()
        if len(parts) < 2:
            raise ValueError(f"Malformed AMC row: {line}")
        channels = current["channels"]
        assert isinstance(channels, dict)
        channels[parts[0]] = [float(x) for x in parts[1:]]
    if current is not None:
        frames.append(current)
    if not frames:
        raise ValueError(f"No frames parsed from {path}")
    return frames


def frame_fk(skel: Skeleton, frame: Mapping[str, object]) -> Tuple[Dict[str, Vec3], Dict[str, Mat3]]:
    channels = frame["channels"]
    assert isinstance(channels, dict)
    root_values = channels.get("root", [])
    if len(root_values) != len(skel.root_order):
        raise ValueError("Root channel count does not match ASF root order")
    translation = list(skel.root_position)
    rot_tokens: List[str] = []
    rot_values: List[float] = []
    for token, value in zip(skel.root_order, root_values):
        lower = token.lower()
        if lower == "tx":
            translation[0] += float(value)
        elif lower == "ty":
            translation[1] += float(value)
        elif lower == "tz":
            translation[2] += float(value)
        elif lower.startswith("r"):
            rot_tokens.append(lower)
            rot_values.append(float(value))
    root_basis = euler(list(skel.root_axis_order.lower()), skel.root_orientation)
    root_rot = m_mul(root_basis, euler(rot_tokens, rot_values))
    positions: Dict[str, Vec3] = {"root": tuple(translation)}  # type: ignore[assignment]
    rotations: Dict[str, Mat3] = {"root": root_rot}

    def visit(parent: str) -> None:
        for name in skel.children.get(parent, []):
            bone = skel.bones[name]
            parent_pos, parent_rot = positions[parent], rotations[parent]
            positions[name] = vadd(parent_pos, m_vec(parent_rot, vscale(bone.direction, bone.length)))
            values = [float(x) for x in channels.get(name, [])]
            if len(values) != len(bone.dof):
                raise ValueError(f"{name}: AMC has {len(values)} values but ASF declares {len(bone.dof)} DOFs")
            basis = euler(list(bone.axis_order.lower()), bone.axis)
            local = m_mul(m_mul(basis, euler(bone.dof, values)), m_transpose(basis))
            rotations[name] = m_mul(parent_rot, local)
            visit(name)

    visit("root")
    return positions, rotations


def unwrap(series: Sequence[float]) -> List[float]:
    if not series:
        return []
    out = [series[0]]
    for value in series[1:]:
        delta = (value - out[-1] + math.pi) % (2.0 * math.pi) - math.pi
        out.append(out[-1] + delta)
    return out


def yaw_from_rotation(rotation: Mat3) -> float:
    forward = m_vec(rotation, (0.0, 0.0, 1.0))
    return math.atan2(forward[0], forward[2])


def central_speed(points: Sequence[Vec3], fps: float) -> List[float]:
    n, out = len(points), [0.0] * len(points)
    for i in range(n):
        a, b = (0, 1) if i == 0 else ((n - 2, n - 1) if i == n - 1 else (i - 1, i + 1))
        out[i] = vnorm(vscale(vsub(points[b], points[a]), fps / (b - a)))
    return out


def central_rate(values: Sequence[float], fps: float) -> List[float]:
    n, out = len(values), [0.0] * len(values)
    for i in range(n):
        a, b = (0, 1) if i == 0 else ((n - 2, n - 1) if i == n - 1 else (i - 1, i + 1))
        out[i] = (values[b] - values[a]) * fps / (b - a)
    return out


def angle_deg(a: Vec3, b: Vec3, c: Vec3) -> float:
    u, v = vunit(vsub(a, b)), vunit(vsub(c, b))
    return math.degrees(math.acos(max(-1.0, min(1.0, vdot(u, v)))))


def peak(values: Sequence[float], start: int = 0, end: int | None = None, absolute: bool = False) -> Dict[str, float | int]:
    end = len(values) if end is None else end
    index = max(range(start, end), key=lambda i: abs(values[i]) if absolute else values[i])
    return {"frame_index_zero_based": index, "value": values[index]}


def suggested_window(energy: Sequence[float]) -> Tuple[int, int]:
    maximum = max(energy)
    if maximum <= 0.0:
        return (0, len(energy) - 1)
    center = max(range(len(energy)), key=lambda i: energy[i])
    threshold = max(maximum * 0.18, sorted(energy)[len(energy) // 2] * 2.0)
    left = center
    while left > 0 and energy[left] >= threshold:
        left -= 1
    right = center
    while right < len(energy) - 1 and energy[right] >= threshold:
        right += 1
    pad = max(8, int(len(energy) * 0.01))
    return (max(0, left - pad), min(len(energy) - 1, right + pad))


def foot_contact_candidates(positions: Sequence[Mapping[str, Vec3]], joint: str, fps: float) -> List[Dict[str, float | int]]:
    points = [frame[joint] for frame in positions]
    speed = central_speed(points, fps)
    ys = [point[1] for point in points]
    candidates = sorted(range(len(points)), key=lambda i: (ys[i] - min(ys)) + 0.25 * speed[i])[:8]
    unique: List[int] = []
    for index in candidates:
        if all(abs(index - other) > 8 for other in unique):
            unique.append(index)
        if len(unique) == 3:
            break
    return [{"frame_index_zero_based": i, "height_source_units": ys[i], "speed_source_units_per_sec": speed[i]} for i in unique]


def analyse_trial(skel: Skeleton, trial_id: str, frames: Sequence[Mapping[str, object]], fps: float) -> Tuple[Dict[str, object], List[Dict[str, Vec3]]]:
    all_positions: List[Dict[str, Vec3]] = []
    all_rotations: List[Dict[str, Mat3]] = []
    for frame in frames:
        positions, rotations = frame_fk(skel, frame)
        all_positions.append(positions)
        all_rotations.append(rotations)
    root = [p["root"] for p in all_positions]
    right_wrist, left_wrist = [p["rwrist"] for p in all_positions], [p["lwrist"] for p in all_positions]
    right_speed, left_speed, root_speed = central_speed(right_wrist, fps), central_speed(left_wrist, fps), central_speed(root, fps)
    pelvis_yaw = unwrap([yaw_from_rotation(r["root"]) for r in all_rotations])
    trunk_yaw = unwrap([yaw_from_rotation(r["thorax"]) for r in all_rotations])
    pelvis_rate, trunk_rate = central_rate(pelvis_yaw, fps), central_rate(trunk_yaw, fps)
    right_elbow = [angle_deg(p["rhumerus"], p["rradius"], p["rwrist"]) for p in all_positions]
    left_elbow = [angle_deg(p["lhumerus"], p["lradius"], p["lwrist"]) for p in all_positions]
    right_extension_rate, left_extension_rate = central_rate(right_elbow, fps), central_rate(left_elbow, fps)
    max_wrist = max(max(right_speed), max(left_speed), 1e-9)
    max_rot = max(max(abs(v) for v in pelvis_rate), max(abs(v) for v in trunk_rate), 1e-9)
    max_root = max(root_speed) or 1e-9
    energy = [0.55 * max(right_speed[i], left_speed[i]) / max_wrist + 0.30 * max(abs(pelvis_rate[i]), abs(trunk_rate[i])) / max_rot + 0.15 * root_speed[i] / max_root for i in range(len(frames))]
    active_start, active_end = suggested_window(energy)
    dominant = "right" if max(right_speed) >= max(left_speed) else "left"
    elbow, elbow_rate = (right_elbow, right_extension_rate) if dominant == "right" else (left_elbow, left_extension_rate)
    horizontal_displacement = math.hypot(root[active_end][0] - root[active_start][0], root[active_end][2] - root[active_start][2])
    thigh_shank = sum(skel.bones[n].length for n in ("lfemur", "ltibia")) / 2.0
    hand_distance = [vnorm(vsub(right_wrist[i], left_wrist[i])) for i in range(len(frames))]
    selected = {"lowerback", "upperback", "thorax", "rhumerus", "rradius", "rwrist", "rhand", "lhumerus", "lradius", "lwrist", "lhand", "rfemur", "rtibia", "rfoot", "lfemur", "ltibia", "lfoot"}
    return {
        "trial_id": trial_id,
        "frame_count": len(frames), "fps": fps, "duration_seconds": len(frames) / fps,
        "source_coordinate_note": "CMU ASF coordinate values; +Y is treated as vertical from skeleton geometry. Distances remain source units unless normalized.",
        "active_window_suggestion": {"start_frame_one_based": active_start + 1, "end_frame_one_based": active_end + 1, "start_seconds": active_start / fps, "end_seconds": active_end / fps, "method": "Combined wrist-speed, root-speed, and FK-derived pelvis/trunk angular-rate energy. Review cue only, not a labelled baseball event."},
        "dominant_wrist_speed_proxy": {"side": dominant, "right_peak_source_units_per_sec": max(right_speed), "left_peak_source_units_per_sec": max(left_speed), "right_peak": peak(right_speed), "left_peak": peak(left_speed)},
        "root_motion": {"active_horizontal_displacement_source_units": horizontal_displacement, "active_displacement_as_avg_thigh_plus_shank_ratio": horizontal_displacement / thigh_shank if thigh_shank else None, "x_range": [min(p[0] for p in root), max(p[0] for p in root)], "y_range": [min(p[1] for p in root), max(p[1] for p in root)], "z_range": [min(p[2] for p in root), max(p[2] for p in root)]},
        "global_rotation_proxies": {"pelvis_root_yaw_peak_abs_rate": peak(pelvis_rate, active_start, active_end + 1, absolute=True), "trunk_thorax_yaw_peak_abs_rate": peak(trunk_rate, active_start, active_end + 1, absolute=True), "note": "FK global forward vectors projected onto X/Z ground plane, not raw AMC Euler channels."},
        "dominant_elbow_extension_proxy": {"side": dominant, "max_angle_degrees": max(elbow[active_start:active_end + 1]), "max_extension_rate": peak(elbow_rate, active_start, active_end + 1, absolute=True), "note": "Three-joint geometric angle (humerus origin, radius origin, wrist origin); not a clinical elbow-angle measurement."},
        "foot_contact_proxy_candidates": {"left": foot_contact_candidates(all_positions, "lfoot", fps), "right": foot_contact_candidates(all_positions, "rfoot", fps), "note": "Low-height/low-speed FK candidates only; AMC has no force-plate labels here."},
        "two_wrist_distance": {"minimum_source_units": min(hand_distance), "maximum_source_units": max(hand_distance), "minimum_frame_one_based": hand_distance.index(min(hand_distance)) + 1},
        "dof_summary": {name: bone.dof for name, bone in skel.bones.items() if name in selected},
        "visual_preview_frames_one_based": [1 + round(i * (len(frames) - 1) / 11) for i in range(12)]
    }, all_positions


def draw_contact_sheet(
    positions: Sequence[Mapping[str, Vec3]],
    skel: Skeleton,
    fps: float,
    output: Path,
    axis: str,
    frame_ids: Sequence[int] | None = None,
) -> None:
    from PIL import Image, ImageDraw
    if frame_ids is None:
        frame_ids = [round(i * (len(positions) - 1) / 11) for i in range(12)]
    if not frame_ids:
        raise ValueError("At least one preview frame is required")
    for frame_id in frame_ids:
        if frame_id < 0 or frame_id >= len(positions):
            raise ValueError(f"Preview frame index is outside the trial: {frame_id + 1}")
    width, height, cols, rows = 300, 260, 4, 3
    image, draw = Image.new("RGB", (width * cols, height * rows), "#f6f8fb"), None
    draw = ImageDraw.Draw(image)
    all_points = [point for frame in positions for point in frame.values()]
    horizontal = 0 if axis == "xy" else 2
    lo_h, hi_h, lo_v, hi_v = min(p[horizontal] for p in all_points), max(p[horizontal] for p in all_points), min(p[1] for p in all_points), max(p[1] for p in all_points)
    span_h, span_v, padding = max(hi_h - lo_h, 1e-6), max(hi_v - lo_v, 1e-6), 18
    def project(point: Vec3, ox: int, oy: int) -> Tuple[float, float]:
        return (ox + padding + (point[horizontal] - lo_h) / span_h * (width - 2 * padding), oy + height - padding - (point[1] - lo_v) / span_v * (height - 2 * padding))
    for slot, frame_id in enumerate(frame_ids):
        ox, oy = (slot % cols) * width, (slot // cols) * height
        draw.rectangle((ox, oy, ox + width - 1, oy + height - 1), outline="#c8d0dc")
        draw.text((ox + 8, oy + 7), f"frame {frame_id + 1}  t={frame_id / fps:.3f}s", fill="#1f2937")
        frame = positions[frame_id]
        for parent, kids in skel.children.items():
            if parent not in frame:
                continue
            for child in kids:
                if child not in frame:
                    continue
                color = "#c33b3b" if child.startswith("r") else "#2464b5" if child.startswith("l") else "#303947"
                draw.line((*project(frame[parent], ox, oy), *project(frame[child], ox, oy)), fill=color, width=3)
        for point in frame.values():
            x, y = project(point, ox, oy)
            draw.ellipse((x - 2, y - 2, x + 2, y + 2), fill="#111827")
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output)


def parse_trial_arg(value: str) -> Tuple[str, Path]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("--trial must be TRIAL_ID=PATH")
    trial_id, path = value.split("=", 1)
    return trial_id, Path(path)


def parse_preview_frames(value: str) -> List[int]:
    """Parse user-facing one-based frame numbers for a focused local sheet."""
    try:
        frames = [int(item.strip()) - 1 for item in value.split(",") if item.strip()]
    except ValueError as exc:
        raise argparse.ArgumentTypeError("--preview-frames must be comma-separated positive integers") from exc
    if not frames or any(frame < 0 for frame in frames):
        raise argparse.ArgumentTypeError("--preview-frames must contain one-based positive frame numbers")
    return frames


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asf", required=True, type=Path)
    parser.add_argument("--trial", required=True, action="append", type=parse_trial_arg)
    parser.add_argument("--fps", type=float, default=120.0)
    parser.add_argument("--out", required=True, type=Path, help="Aggregate-only JSON outside the repository")
    parser.add_argument("--preview-dir", required=True, type=Path, help="Local, non-committed contact sheets")
    parser.add_argument(
        "--preview-frames",
        type=parse_preview_frames,
        help="Optional comma-separated, one-based frame numbers for a focused local contact sheet. Run one trial at a time when using this option.",
    )
    args = parser.parse_args()
    skeleton = parse_asf(args.asf)
    analyses: List[Dict[str, object]] = []
    for trial_id, path in args.trial:
        frames = parse_amc(path)
        result, positions = analyse_trial(skeleton, trial_id, frames, args.fps)
        analyses.append(result)
        draw_contact_sheet(positions, skeleton, args.fps, args.preview_dir / f"{trial_id}_xy.png", "xy", args.preview_frames)
        draw_contact_sheet(positions, skeleton, args.fps, args.preview_dir / f"{trial_id}_zy.png", "zy", args.preview_frames)
    payload = {"tool": "inspect_cmu_asf_amc.py", "tool_purpose": "Local aggregate qualification only; no raw frame samples are emitted.", "asf": args.asf.name, "fps": args.fps, "skeleton_units": skeleton.units, "trials": analyses}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"trials": [{"trial_id": x["trial_id"], "frame_count": x["frame_count"]} for x in analyses]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
