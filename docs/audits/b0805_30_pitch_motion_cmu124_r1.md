# b0805-30 CMU 124-01 Pitch Motion R1 Audit

## Scope receipt

| Item | Receipt |
| --- | --- |
| Repair branch | codex/b0805-30-pitch-motion-bank-cmu124-r1 |
| Exact repair base | b93f33410a8604ab8598c34ca1bf4127a6186665 |
| Final implementation commit | 2901d2b338196b4bd11afb5561ff4e73e7710d24 |
| Audit receipt commit | This document is committed separately after the implementation commit so the exact implementation SHA can be recorded without self-reference. |
| Build label | b0805-30 |
| Scope | F1-F5 repair only: CMU visual retargeting, profile, exporter, tests, provenance, and audit. |
| Explicitly not started | merge, PR creation, M1.1, P1, E1, F1, P2, gameplay timing/physics/rules changes. |

The implementation commit is a descendant of the exact repair base. The audit commit adds only this receipt; it does not alter gameplay or the implementation tree.

## Changed files

Implementation commit 2901d2b338196b4bd11afb5561ff4e73e7710d24 changed:

- baseball3d.html
- _test_pitch_motion_bank_cmu124_20260811.js
- docs/third_party/cmu124_pitch_profile_v1.json
- docs/third_party/cmu_mocap_subject124.md
- tools/motion/cmu_asf_amc_fk.py
- tools/motion/export_cmu124_pitch_profile.py
- tools/motion/test_cmu124_pitch_profile_exporter.py

This audit is docs/audits/b0805_30_pitch_motion_cmu124_r1.md.

## Canonical source path and isolation

The sole source-to-profile path is tools/motion/cmu_asf_amc_fk.py, used by tools/motion/export_cmu124_pitch_profile.py version b0805-30-cmu124-export-r1-fk.

It parses ASF units, root/bone axes, DOFs, hierarchy, and AMC frames; applies the Acclaim axis-basis sandwich; runs parent-to-child FK; constructs a delivery coordinate frame; and derives root/torso transforms plus geometric limb vectors. Renderer-facing channels are never taken from raw AMC Euler indexes.

| Source receipt | Value |
| --- | --- |
| Subject / trial | 124 / 124-01 |
| ASF SHA-256 | b0e6a62b7e151200497b8bbcf42d0e95800decabec9254f8653e57dcde45dd45 |
| AMC SHA-256 | 7fd098ab1b535c38a3a6ae7c82f7c87299e177ce665dd65fa19db110e22f0857 |
| Frame inventory | 643 frames at 120 fps |
| Profile JSON SHA-256 | 30DB33A77FB3FC7E661C3A7C0BE2E3B16452959A835725568F1460A28C5DE612 |
| Committed raw payload | none: repository scan found no ASF, AMC, or C3D file |

The exporter-level contract regenerates the committed profile from verified temporary sources and requires strict object equality. A raw-index mutation of release throwing-arm data fails that oracle, and an injected legacy raw-index marker fails the FK-only source check.

## F1 delivery axis and repaired stride

The fixed delivery frame is derived from the qualified source-left lead-foot displacement from frame 176 load to frame 265 plant.

| Delivery-frame evidence | Value |
| --- | --- |
| World up | (0, 1, 0) |
| Forward world vector | (0.440408, 0, 0.897798) |
| Lateral-right world vector | (0.897798, 0, -0.440408) |
| Lead foot | lfoot |
| Load -> plant stride | 25.154435 source units / 1.419817 m |

Focused M0 source contact sheets for 124-01 were reviewed before choosing this axis. Root world displacement is projected onto that fixed axis. Source lateral displacement remains QA-only and is not aliased into rootForward.

The old R0 renderer used rootForward times 4.8 and visibly reversed from SFC to release. R1 uses a source-forward visual calibration of 55 ft per source metre, with post-plant limits of 0.14 ft adjacent reversal and 0.24 ft total reversal.

| Key | Source frame | Old rendered stride ft | R1 rootForward ft | R1 follow carry ft | R1 rendered stride ft |
| --- | ---: | ---: | ---: | ---: | ---: |
| source-left SFC proxy | 247 | 4.800000 | 6.275048 | 0.000000 | 6.275048 |
| plant proxy | 265 | 4.567848 | 6.135048 | 0.000000 | 6.135048 |
| MER proxy | 285 | 3.446246 | 6.035048 | 0.000000 | 6.035048 |
| release proxy | 297 | 2.300918 | 6.035048 | 0.000000 | 6.035048 |
| early follow-through proxy | 310 | 1.367179 | 6.035048 | 0.899765 | 6.934813 |

F1 direct contract passes: adjacent SFC -> plant -> MER -> release backsteps are -0.140000, -0.100000, and 0.000000 ft; total SFC -> release reversal is 0.240000 ft. The follow carry is a separate post-release renderer channel, derived from canonical FK wrist-root delivery-forward geometry; it is not root stride and is zero through release.

## F2 geometry-only channel derivation

R1 has one canonical FK module and no production use of raw AMC index expressions such as root[4], lowerback[1], rhumerus[0], rhumerus[2], or rradius[0].

| Channel group | Canonical derivation |
| --- | --- |
| Root / pelvis proxy | Root orientation transformed into the fixed delivery frame; root translation projected onto the same frame. |
| Torso | Thorax world orientation relative to root via rotation-matrix composition, then one documented yaw/lean/tilt extraction. |
| Throwing and glove arms | Shoulder-elbow-wrist vectors in thorax-local delivery coordinates, geometric elbow flexion, 3D vector-pair calibration, and inverse of the actual simple-rig upper-arm transform. |
| Legs | Root-local thigh vector sagittal projection and geometric knee flexion; unsupported lateral DOF is deliberately omitted. |
| Post-release carry | Canonical FK wrist-root delivery-forward displacement from release; renderer-only and separate from rootForward. |

No pronation, ball marker, force, or biomechanical event measurement is invented.

## F3 actual hand endpoint and unchanged release

drawFigure and release QA now share buildFigurePoseTransforms, composeFigureSegment, and figureMatrixWorldPoint. There is no second approximate hand-kinematic implementation.

| Measure | Value |
| --- | --- |
| Unchanged game release | (pitch.rx, pitch.ry, pitch.rz) = (0.950000, 5.750000, 54.000000) |
| Actual rendered release hand | (1.073503, 5.120102, 54.014515) |
| 3D separation | 0.642056 ft |
| Gate | PASS: <= 0.75 ft |
| MER rendered hand | (0.246710, 5.232773, 54.880157) |
| Early follow rendered hand | (1.008512, 5.061134, 53.553577) |
| MER->release dot release->early follow | 0.351916 |
| Forward/cross-body result | PASS: release moves toward the unchanged release, then early follow continues positive forward/cross-body progression. |

The physical ball coordinates were not moved. The follow carry repairs only the renderer's post-release body progression and is zero at the release key.

## F4 source follow-through and game-side ready adapter

Source-derived keys end at mir_follow_proxy, source frame 351. The next key is game_field_ready_adapter:

| Adapter field | Value |
| --- | --- |
| sourceKey | false |
| adapterKey | true |
| sourceFrame / range | null / null |
| Renderer post time | 1.2 s |
| Contract | drawFigure/fielderReadyPose generic neutral fallback |
| Bounds | Explicit neutral ready-pose ranges for every channel; throwFollowCarry is reset to 0.0. |

The adapter is on anim.pitchMotionPostSec, not pitch.t, and live flight/fielding still interrupts the visual recovery through the pre-existing pitcherPose -> fielderPose handoff. Mutation tests reject a revived source-frame-585 adapter and reject a clamp-edge adapter arm value.

## F5 direct and mutation contracts

| Contract | Result |
| --- | --- |
| Canonical FK exporter and raw-index mutation | PASS |
| Runtime profile equals regenerated compact JSON | PASS |
| Source data isolation / no raw files in Git | PASS |
| F1 SFC -> release stride constraints | PASS |
| Old 4.8 -> 2.300918 backward trajectory mutation | rejected |
| Actual rendered hand <= 0.75 ft | PASS at 0.642056 ft |
| Archived raw-index plus affine arm retarget mutation | rejected |
| Frame-585 adapter mutation | rejected |
| Clamp-edge ready adapter mutation | rejected |
| Existing 0.80 timing mutation | rejected |
| Existing pitch.t post-clock mutation | detected |
| Existing collapsed torso/root mutation | detected |
| Existing hard-coded glove mutation | detected |
| Four-pitch deterministic b29 trace parity | PASS |
| No raw capture payload | PASS |

## Regressions actually run

| Command | Result |
| --- | --- |
| node _test_pitch_motion_bank_cmu124_20260811.js baseball3d.html | PASS |
| python tools/motion/test_cmu124_pitch_profile_exporter.py with verified temporary ASF/AMC and committed JSON | PASS |
| Fresh exporter regeneration vs committed JSON | PASS; SHA-256 30DB33A77FB3FC7E661C3A7C0BE2E3B16452959A835725568F1460A28C5DE612 |
| python -m py_compile for FK module, exporter, and exporter test | PASS |
| node _architecture_guard_20260808.js baseball3d.html | PASS |
| node _test_runner_intent_20260808.js baseball3d.html | PASS |
| node _test_runner_controls_sliding_20260809.js baseball3d.html | PASS |
| node _test_fielding_assignment_20260808.js baseball3d.html | PASS |
| node _test_reach_model_20260808.js baseball3d.html | PASS |
| node _test_defense_action_policy_20260809.js baseball3d.html | PASS |
| node _test_force_chain_decision_20260809.js baseball3d.html | PASS |
| node _test_breakaway_transfer_context_20260810.js baseball3d.html | PASS |
| node _test_thrower_footwork_20260810.js baseball3d.html | PASS |
| python _ci_browser_regression_20260809.py | UNAVAILABLE: RuntimeError: Chromium not found |

The browser regression was attempted once. No alternate browser or workaround was used after Chromium was unavailable, so browser visual behavior is not claimed as passed.

## Timing, gameplay, and deferred player path

- CPU release remains exactly 0.85 s.
- pitch.rx, pitch.ry, and pitch.rz remain unchanged.
- pitch flight, batting, runners, fielding policy, and deterministic traces remain unchanged by the existing harness.
- The post-release renderer clock remains independent of pitch.t.
- Player-controlled aimPitch -> launchPitch still has no pre-release display track. This repair does not change player pacing; M1.1 remains deferred.

## Negative findings and remaining limits

- CMU 124-01 has no ball marker, bat, force plate, release-speed, pronation, or laboratory-event labels.
- Laterality remains provisional right/mirrorable; R1 preserves a deterministic mirror contract rather than claiming final athlete laterality.
- Root yaw is a renderer proxy, not measured pelvis kinematics.
- The 55 ft/m root scale and 2.1 ft/m wrist-follow carry are renderer engineering calibrations, not biomechanical constants.
- Browser visual confirmation is unavailable because Chromium is not installed in this environment.
- No merge, PR, M1.1, P1, E1, F1, or P2 work was started.
