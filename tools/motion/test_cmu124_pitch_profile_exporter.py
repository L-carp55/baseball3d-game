#!/usr/bin/env python3
"""Exporter-level FK and mutation contracts for the CMU 124-01 R1 profile."""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path

import export_cmu124_pitch_profile as exporter


REQUIRED_FK_MARKERS = (
    "from cmu_asf_amc_fk import",
    "frame_fk(",
    "relative_rotation(",
    "joint_direction_in_local_frame(",
    "geometric_joint_flexion(",
    "make_delivery_frame(",
)
FORBIDDEN_RAW_INDEX_MARKERS = (
    "root[4]",
    "lowerback[1]",
    "upperback[1]",
    "thorax[1]",
    "rhumerus[0]",
    "rhumerus[2]",
    "rradius[0]",
)


def fk_only_exporter_source(source: str) -> bool:
    return all(marker in source for marker in REQUIRED_FK_MARKERS) and not any(
        marker in source for marker in FORBIDDEN_RAW_INDEX_MARKERS
    )


def key(profile: dict[str, object], identifier: str) -> dict[str, object]:
    for candidate in profile["keys"]:  # type: ignore[index]
        if candidate["id"] == identifier:
            return candidate
    raise AssertionError(f"missing key {identifier}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asf", type=Path, required=True)
    parser.add_argument("--amc", type=Path, required=True)
    parser.add_argument("--profile", type=Path, required=True)
    args = parser.parse_args()

    source = Path(exporter.__file__).read_text(encoding="utf-8")
    assert fk_only_exporter_source(source), "exporter contains a raw AMC-index derivation"
    assert not fk_only_exporter_source(source + "\nlegacy = root[4]\n"), (
        "mutation: raw AMC index must make FK-only source validation fail"
    )

    generated = exporter.build_profile(args.asf.resolve(), args.amc.resolve())
    committed = json.loads(args.profile.read_text(encoding="utf-8"))
    assert generated == committed, "committed profile is not byte-model identical to canonical regeneration"
    assert exporter.profile_matches_canonical_fk(committed, args.asf.resolve(), args.amc.resolve()), (
        "canonical FK oracle rejected committed profile"
    )

    release = key(generated, "release_proxy")
    assert release["sourceKey"] is True and release["sourceFrame"] == 297
    adapter = key(generated, "game_field_ready_adapter")
    assert adapter["sourceKey"] is False and adapter["adapterKey"] is True
    assert adapter["sourceFrame"] is None and adapter["sourceFrameRange"] is None
    assert adapter["channels"]["throwFollowCarry"] == 0.0

    raw_index_mutation = copy.deepcopy(generated)
    key(raw_index_mutation, "release_proxy")["channels"]["throwArmElevation"] = 0.270685
    assert not exporter.profile_matches_canonical_fk(
        raw_index_mutation, args.asf.resolve(), args.amc.resolve()
    ), "mutation: raw-index arm value must fail canonical FK equality"

    stride_ids = ("source_left_sfc_proxy", "plant_proxy", "mer_proxy", "release_proxy")
    strides = [key(generated, identifier)["channels"]["rootForward"] for identifier in stride_ids]
    assert all(next_value - value >= -0.15 - 1e-9 for value, next_value in zip(strides, strides[1:]))
    assert strides[0] - strides[-1] <= 0.25 + 1e-9

    print(json.dumps({
        "status": "PASS",
        "exporter": exporter.EXPORTER_VERSION,
        "releaseFrame": release["sourceFrame"],
        "strideFt": dict(zip(stride_ids, strides)),
        "adapter": adapter["id"],
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
