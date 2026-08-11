#!/usr/bin/env python3
"""Canonical Acclaim ASF/AMC parsing, forward kinematics, and delivery geometry.

This module is the reusable extraction of the axis-basis/FK path first used by
the M0 CMU #124 qualification tool.  It deliberately keeps raw AMC Euler
channels inside the Acclaim parser: renderer-facing callers must derive their
controls from the reconstructed transforms and joint vectors returned here.

The module emits no motion payload.  Raw ASF/AMC files remain temporary inputs
outside Git; callers may retain only sparse, reviewed derived keys.
"""

from __future__ import annotations

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


@dataclass(frozen=True)
class DeliveryFrame:
    """A fixed source-world frame: X=source-right, Y=world-up, Z=delivery-forward."""

    up: Vec3
    forward: Vec3
    lateral_right: Vec3
    source_to_delivery: Mat3
    load_frame: int
    plant_frame: int
    lead_foot: str
    lead_foot_stride_source_units: float


def vadd(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def vsub(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def vscale(a: Vec3, scalar: float) -> Vec3:
    return (a[0] * scalar, a[1] * scalar, a[2] * scalar)


def vdot(a: Vec3, b: Vec3) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def vnorm(a: Vec3) -> float:
    return math.sqrt(vdot(a, a))


def vunit(a: Vec3) -> Vec3:
    magnitude = vnorm(a)
    if magnitude <= 1e-12:
        raise ValueError("Cannot normalize a zero-length vector")
    return vscale(a, 1.0 / magnitude)


def vcross(a: Vec3, b: Vec3) -> Vec3:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def m_mul(a: Mat3, b: Mat3) -> Mat3:
    return tuple(tuple(sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)) for i in range(3))  # type: ignore[return-value]


def m_vec(matrix: Mat3, vector: Vec3) -> Vec3:
    return (
        matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
        matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
        matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
    )


def m_transpose(matrix: Mat3) -> Mat3:
    return tuple(tuple(matrix[j][i] for j in range(3)) for i in range(3))  # type: ignore[return-value]


def m_columns(x_axis: Vec3, y_axis: Vec3, z_axis: Vec3) -> Mat3:
    return (
        (x_axis[0], y_axis[0], z_axis[0]),
        (x_axis[1], y_axis[1], z_axis[1]),
        (x_axis[2], y_axis[2], z_axis[2]),
    )


def rot(axis: str, degrees: float) -> Mat3:
    angle = math.radians(degrees)
    cosine, sine = math.cos(angle), math.sin(angle)
    name = axis.lower().replace("r", "")
    if name == "x":
        return ((1.0, 0.0, 0.0), (0.0, cosine, -sine), (0.0, sine, cosine))
    if name == "y":
        return ((cosine, 0.0, sine), (0.0, 1.0, 0.0), (-sine, 0.0, cosine))
    if name == "z":
        return ((cosine, -sine, 0.0), (sine, cosine, 0.0), (0.0, 0.0, 1.0))
    raise ValueError(f"Unsupported rotation axis: {axis}")


def euler(order: Sequence[str], values: Sequence[float]) -> Mat3:
    """Compose Acclaim channel rotations in their declared local order."""
    output = IDENTITY
    for token, value in zip(order, values):
        if token.lower().startswith("r") or token.lower() in {"x", "y", "z"}:
            output = m_mul(output, rot(token, value))
    return output


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
    index = 0
    while index < len(lines):
        line = lines[index]
        if not line or line.startswith("#"):
            index += 1
            continue
        if line.startswith(":"):
            section = line[1:].lower()
            index += 1
            continue
        if section == "units":
            fields = line.split()
            if len(fields) == 2:
                try:
                    units[fields[0].lower()] = float(fields[1])
                except ValueError:
                    pass
            index += 1
            continue
        if section == "root":
            fields = line.split()
            key = fields[0].lower()
            if key == "order":
                root_order = fields[1:]
            elif key == "axis" and len(fields) > 1:
                root_axis_order = fields[1]
            elif key == "position" and len(fields) >= 4:
                root_position = tuple(float(value) for value in fields[1:4])  # type: ignore[assignment]
            elif key == "orientation" and len(fields) >= 4:
                root_orientation = tuple(float(value) for value in fields[1:4])  # type: ignore[assignment]
            index += 1
            continue
        if section == "bonedata":
            if line.lower() != "begin":
                index += 1
                continue
            values: Dict[str, object] = {"dof": []}
            index += 1
            while index < len(lines) and lines[index].lower() != "end":
                fields = lines[index].split()
                if fields:
                    key = fields[0].lower()
                    if key == "name":
                        values["name"] = fields[1]
                    elif key == "direction":
                        values["direction"] = tuple(float(value) for value in fields[1:4])
                    elif key == "length":
                        values["length"] = float(fields[1])
                    elif key == "axis":
                        values["axis"] = tuple(float(value) for value in fields[1:4])
                        values["axis_order"] = fields[4] if len(fields) > 4 else "XYZ"
                    elif key == "dof":
                        values["dof"] = fields[1:]
                index += 1
            if "name" not in values or "direction" not in values or "length" not in values:
                raise ValueError(f"Incomplete bone block in {path}")
            bone = Bone(
                name=str(values["name"]),
                direction=values["direction"],  # type: ignore[arg-type]
                length=float(values["length"]),
                axis=values.get("axis", (0.0, 0.0, 0.0)),  # type: ignore[arg-type]
                axis_order=str(values.get("axis_order", "XYZ")),
                dof=list(values.get("dof", [])),  # type: ignore[arg-type]
            )
            bones[bone.name] = bone
            children.setdefault(bone.name, [])
            index += 1
            continue
        if section == "hierarchy":
            if line.lower() in {"begin", "end"}:
                index += 1
                continue
            fields = line.split()
            if len(fields) >= 2:
                parent, descendants = fields[0], fields[1:]
                children.setdefault(parent, [])
                for child in descendants:
                    if child not in bones:
                        raise ValueError(f"Hierarchy names unknown bone {child}")
                    bones[child].parent = parent
                    children[parent].append(child)
            index += 1
            continue
        index += 1
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
        fields = line.split()
        if len(fields) < 2:
            raise ValueError(f"Malformed AMC row: {line}")
        channels = current["channels"]
        assert isinstance(channels, dict)
        channels[fields[0]] = [float(value) for value in fields[1:]]
    if current is not None:
        frames.append(current)
    if not frames:
        raise ValueError(f"No frames parsed from {path}")
    return frames


def frame_fk(skeleton: Skeleton, frame: Mapping[str, object]) -> Tuple[Dict[str, Vec3], Dict[str, Mat3]]:
    """Apply the M0 Acclaim axis-basis sandwich and parent-to-child FK."""
    channels = frame["channels"]
    assert isinstance(channels, dict)
    root_values = channels.get("root", [])
    if len(root_values) != len(skeleton.root_order):
        raise ValueError("Root channel count does not match ASF root order")
    translation = list(skeleton.root_position)
    rotation_tokens: List[str] = []
    rotation_values: List[float] = []
    for token, value in zip(skeleton.root_order, root_values):
        lower = token.lower()
        if lower == "tx":
            translation[0] += float(value)
        elif lower == "ty":
            translation[1] += float(value)
        elif lower == "tz":
            translation[2] += float(value)
        elif lower.startswith("r"):
            rotation_tokens.append(lower)
            rotation_values.append(float(value))
    root_basis = euler(list(skeleton.root_axis_order.lower()), skeleton.root_orientation)
    root_rotation = m_mul(root_basis, euler(rotation_tokens, rotation_values))
    positions: Dict[str, Vec3] = {"root": tuple(translation)}  # type: ignore[assignment]
    rotations: Dict[str, Mat3] = {"root": root_rotation}

    def visit(parent: str) -> None:
        for name in skeleton.children.get(parent, []):
            bone = skeleton.bones[name]
            parent_position, parent_rotation = positions[parent], rotations[parent]
            positions[name] = vadd(parent_position, m_vec(parent_rotation, vscale(bone.direction, bone.length)))
            values = [float(value) for value in channels.get(name, [])]
            if len(values) != len(bone.dof):
                raise ValueError(f"{name}: AMC has {len(values)} values but ASF declares {len(bone.dof)} DOFs")
            basis = euler(list(bone.axis_order.lower()), bone.axis)
            local_rotation = m_mul(m_mul(basis, euler(bone.dof, values)), m_transpose(basis))
            rotations[name] = m_mul(parent_rotation, local_rotation)
            visit(name)

    visit("root")
    return positions, rotations


def make_delivery_frame(
    positions_by_frame: Mapping[int, Mapping[str, Vec3]],
    *,
    load_frame: int,
    plant_frame: int,
    lead_foot: str = "lfoot",
) -> DeliveryFrame:
    """Infer a fixed horizontal delivery direction from lead-foot displacement."""
    try:
        start = positions_by_frame[load_frame][lead_foot]
        plant = positions_by_frame[plant_frame][lead_foot]
    except KeyError as error:
        raise ValueError("Delivery-frame foot geometry is missing") from error
    up: Vec3 = (0.0, 1.0, 0.0)
    horizontal_stride: Vec3 = (plant[0] - start[0], 0.0, plant[2] - start[2])
    forward = vunit(horizontal_stride)
    lateral_right = vunit(vcross(up, forward))
    source_to_delivery = m_columns(lateral_right, up, forward)
    return DeliveryFrame(
        up=up,
        forward=forward,
        lateral_right=lateral_right,
        source_to_delivery=source_to_delivery,
        load_frame=load_frame,
        plant_frame=plant_frame,
        lead_foot=lead_foot,
        lead_foot_stride_source_units=vnorm(horizontal_stride),
    )


def vector_in_delivery(vector_world: Vec3, delivery: DeliveryFrame) -> Vec3:
    return m_vec(m_transpose(delivery.source_to_delivery), vector_world)


def rotation_in_delivery(rotation_world: Mat3, delivery: DeliveryFrame) -> Mat3:
    basis_t = m_transpose(delivery.source_to_delivery)
    return m_mul(m_mul(basis_t, rotation_world), delivery.source_to_delivery)


def relative_rotation(parent_world: Mat3, child_world: Mat3, delivery: DeliveryFrame) -> Mat3:
    parent = rotation_in_delivery(parent_world, delivery)
    child = rotation_in_delivery(child_world, delivery)
    return m_mul(m_transpose(parent), child)


def root_forward_metres(root_world: Vec3, reference_root_world: Vec3, delivery: DeliveryFrame, units_to_metres: float) -> float:
    delta = vsub(root_world, reference_root_world)
    return vdot(delta, delivery.forward) * units_to_metres


def root_lateral_metres(root_world: Vec3, reference_root_world: Vec3, delivery: DeliveryFrame, units_to_metres: float) -> float:
    delta = vsub(root_world, reference_root_world)
    return vdot(delta, delivery.lateral_right) * units_to_metres


def root_vertical_metres(root_world: Vec3, reference_root_world: Vec3, units_to_metres: float) -> float:
    return (root_world[1] - reference_root_world[1]) * units_to_metres


def joint_direction_in_local_frame(
    parent_world: Vec3,
    child_world: Vec3,
    local_rotation_world: Mat3,
    delivery: DeliveryFrame,
) -> Vec3:
    vector_delivery = vector_in_delivery(vsub(child_world, parent_world), delivery)
    local_delivery = rotation_in_delivery(local_rotation_world, delivery)
    return vunit(m_vec(m_transpose(local_delivery), vector_delivery))


def geometric_joint_flexion(first_parent: Vec3, joint: Vec3, second_child: Vec3) -> float:
    """Return 0 for a straight outward chain and pi for a fully folded chain."""
    upper = vunit(vsub(joint, first_parent))
    lower = vunit(vsub(second_child, joint))
    return math.acos(max(-1.0, min(1.0, vdot(upper, lower))))


def extract_ry_zx(rotation: Mat3) -> Tuple[float, float, float]:
    """Decompose ``Ry(yaw) * Rz(tilt) * Rx(lean)`` for the simple renderer."""
    lean = math.asin(max(-1.0, min(1.0, -rotation[1][2])))
    yaw = math.atan2(rotation[0][2], rotation[2][2])
    tilt = math.atan2(rotation[1][0], rotation[1][1])
    return yaw, lean, tilt


def simple_rig_upper_direction(elevation: float, plane: float) -> Vec3:
    """Direction of a drawFigure upper arm whose unrotated segment points down."""
    cosine = math.cos(elevation)
    return (math.sin(plane) * cosine, -math.cos(plane) * cosine, -math.sin(elevation))


def simple_rig_forearm_direction(elevation: float, plane: float, elbow_bend: float) -> Vec3:
    return m_vec(m_mul(rot("z", math.degrees(plane)), rot("x", math.degrees(elevation))), m_vec(rot("x", math.degrees(elbow_bend)), (0.0, -1.0, 0.0)))


def simple_rig_inverse_upper(vector: Vec3, preferred_elevation: float | None = None) -> Tuple[float, float]:
    normalized = vunit(vector)
    elevation = math.atan2(-normalized[2], math.hypot(normalized[0], normalized[1]))
    plane = math.atan2(normalized[0], -normalized[1])
    if preferred_elevation is not None:
        alternate_elevation = -math.pi - elevation if elevation < 0.0 else math.pi - elevation
        alternate_plane = (plane + math.pi + math.pi) % (2.0 * math.pi) - math.pi
        def circular_distance(a: float, b: float) -> float:
            return abs((a - b + math.pi) % (2.0 * math.pi) - math.pi)
        if circular_distance(alternate_elevation, preferred_elevation) < circular_distance(elevation, preferred_elevation):
            elevation, plane = alternate_elevation, alternate_plane
    return elevation, plane


def simple_rig_inverse_elbow(upper_direction: Vec3, forearm_direction: Vec3, elevation: float, plane: float) -> float:
    upper_rotation = m_mul(rot("z", math.degrees(plane)), rot("x", math.degrees(elevation)))
    forearm_local = m_vec(m_transpose(upper_rotation), vunit(forearm_direction))
    # The simple rig lacks an independent forearm-plane control.  Drop only its
    # local-X component, then solve the remaining Y/Z bend geometrically.
    return math.atan2(-forearm_local[2], -forearm_local[1])


def rotation_from_vector_pairs(source_upper: Vec3, source_forearm: Vec3, target_upper: Vec3, target_forearm: Vec3) -> Mat3:
    """Return the proper rotation taking one non-collinear vector pair to another."""
    source_u = vunit(source_upper)
    source_v = vunit(vsub(source_forearm, vscale(source_u, vdot(source_forearm, source_u))))
    source_w = vunit(vcross(source_u, source_v))
    target_u = vunit(target_upper)
    target_v = vunit(vsub(target_forearm, vscale(target_u, vdot(target_forearm, target_u))))
    target_w = vunit(vcross(target_u, target_v))
    return m_mul(m_columns(target_u, target_v, target_w), m_transpose(m_columns(source_u, source_v, source_w)))
