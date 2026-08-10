# b0805-30 — CMU 124-01 Pitch Motion Bank Audit

## Scope receipt

| Item | Receipt |
| --- | --- |
| Branch | `codex/b0805-30-pitch-motion-bank-cmu124` |
| Gameplay base | `60b993b73fed854934a976e45e8feb9437deb584` (`b0805-29`) |
| Final implementation SHA | `7633fed30fe5b61019bce3b60dc0262f8f1a3494` — the commit containing the complete motion/code/test/profile tree. |
| Game build label | `b0805-30` (visual-motion build only) |
| Change boundary | visual pitcher motion, reproducible compact profile, tests, provenance, and audit only |
| Explicitly not started | merge, M1.1, P1, E1, F1, P2, delivery-cadence/physics/rules work |

The source remains the b29 gameplay tree. `launchPitch()` retains its release coordinates, target selection, `pitch.dur`, CPU swing path, batting outcome path, runner state, fielding policy, and all rule writers.

## Committed artifacts

- `baseball3d.html` — visual-only compact motion bank, sampler, mirror, figure split, release diagnostic.
- `tools/motion/export_cmu124_pitch_profile.py` — deterministic, hash-gated compact exporter.
- `docs/third_party/cmu124_pitch_profile_v1.json` — 16 selected keys; no raw sequence.
- `docs/third_party/cmu_mocap_subject124.md` — source, terms, provenance, and reproduction boundary.
- `_test_pitch_motion_bank_cmu124_20260811.js` — direct and mutation contracts.
- `_test_thrower_footwork_20260810.js` — repaired its mutation fixture to match executable statements rather than an editor-dependent comment encoding; no game logic changed.
- this audit.

## Source, provenance, and isolation

| Field | Value |
| --- | --- |
| Source | CMU Graphics Lab Motion Capture Database, Subject 124 / Trial 124-01 |
| ASF SHA-256 | `b0e6a62b7e151200497b8bbcf42d0e95800decabec9254f8653e57dcde45dd45` |
| AMC SHA-256 | `7fd098ab1b535c38a3a6ae7c82f7c87299e177ce665dd65fa19db110e22f0857` |
| Source inventory | 643 frames at 120 fps |
| Exporter version / SHA-256 | `b0805-30-cmu124-export-v1` / `ab623b094369636774e150128634126cf125c13d3404fa8dae4d75591dbc756d` |
| Laterality | provisional right; deterministic R/L mirror is implemented and tested |
| Committed source payload | none — no `.asf`, `.amc`, `.c3d`, or full-frame conversion is committed |
| Ball / biomechanics | no ball, bat, force, release-speed, pronation, or laboratory-event annotation is claimed |

The exporter verifies both source filenames and SHA-256 values before parsing. It refuses a frame inventory other than 1–643. The compact JSON includes only 16 reviewed keys and provenance; the raw inputs live only in a temporary source location during export.

### Offline unit-conversion QA

`1 CMU length unit × 0.056444 = metres` was used only to report temporary-source root ranges:

| Axis | Converted source range (m) |
| --- | --- |
| x | -0.176012 to 0.864237 |
| y | 0.768327 to 0.962065 |
| z | -0.307577 to 0.574075 |

No converted root value is read by `baseball3d.html`, and none is used for pitch launch or field position.

## Selected motion keys

The profile has 16 keys: eleven pre-release keys plus a post-release anchor and four follow/recovery keys. Labels are source-navigation proxies, not measured scientific event labels.

| Segment | Key | Source frame / reviewed range | Renderer time |
| --- | --- | --- | --- |
| pre | set | 1 / 1–59 | 0.000000 normalized |
| pre | hand separation proxy | 59 / 59–117 | 0.195946 normalized |
| pre | knee rise proxy | 118 / 118–145 | 0.395270 normalized |
| pre | peak knee/load proxy | 176 / 145–176 | 0.591216 normalized |
| pre | stride early proxy | 205 / 180–220 | 0.689189 normalized |
| pre | source-left SFC proxy | 247 / 231–247 | 0.831081 normalized |
| pre | plant proxy | 265 / 245–265 | 0.891892 normalized |
| pre | arm cocking proxy | 275 / 265–275 | 0.925676 normalized |
| pre | MER proxy | 285 / 275–295 | 0.959459 normalized |
| pre | release approach proxy | 293 / 285–293 | 0.986486 normalized |
| pre | release proxy | 297 / 293–302 | **1.000000 normalized** |
| post | release post anchor proxy | 297 / 293–302 | 0.000000 s |
| post | early follow-through proxy | 310 / 302–320 | 0.108333 s |
| post | late follow-through proxy | 340 / 320–340 | 0.358333 s |
| post | MIR/follow proxy | 351 / 340–351 | 0.450000 s |
| post | field-ready adapter proxy | 585 / 526–585 | 2.400000 s |

## Renderer mapping and removed heuristic

| Compact source control | Renderer mapping | Boundary |
| --- | --- | --- |
| `rootForward`, `rootRise` | visual stride and vertical display offset | visual only |
| root-yaw proxy, pelvis lean | split pelvis transform | root yaw is not claimed as measured pelvis orientation |
| lower/upper-back/thorax aggregates | split torso yaw/lean/tilt | visual only |
| throwing/glove arm controls | role-based arm plane/elbow; fixed coordinate calibration into the simple figure rig | no full skinning or IK |
| lead/trail leg controls | role-based thigh/knee controls | visual only |
| R/L mirror | swaps throwing/glove side and lateral signs without changing key times | deterministic test contract |

The following hand-authored pitch-motion authority was removed from production use:

- `pitcherPoseK()` and its hand-authored phase curves;
- `blendPitchPose()`;
- global `PITCH_RELEASE_K=0.80` release heuristic;
- post-release interpolation derived from the flight-progress field.

`drawFigure()` preserves its old one-piece transform exactly for callers without the new optional pitch-motion fields. A profile pose alone opts into pelvis/torso splitting; legs use the pelvis anchor, arms use the torso anchor, and legacy figures still default to a left glove.

## Timing, release, and hand/ball diagnostic

- The gameplay windup remains **0.85 s**.
- The pre track is normalized from source frames 1–297 into that existing 0.85 s.
- `launchPitch()` creates the existing `pitch` object, then calls `beginPitchMotion()` on the same update tick; the sampled pre track is exactly `release_proxy` at normalized time `1`.
- The post track begins at the duplicate frame-297 post anchor and advances through `anim.pitchMotionPostSec`, a renderer-owned seconds clock. `pitcherPose()` does not read the flight-progress field.
- When a ball becomes live (`flight`), `pitcherPose()` returns `null`, so existing `fielderPose()` owns the pitcher’s visual movement.

The debug helper `estimatePitchMotionThrowHandWorldPosition()` deliberately exposes a simple-rig **comparison proxy**, not a ball-marker measurement. At the sampled release proxy using the actual pitcher home position `(0, 60.5)`, it reports:

| Value | Renderer/debug value |
| --- | --- |
| sampled event | `release_proxy` |
| visual stride | 2.300918 ft |
| estimated hand | `(0.084168, 4.646383, 57.542852)` |
| unchanged game launch | `(0.950000, 5.750000, 54.000000)` |
| simple-rig proxy separation | 3.810438 ft |

This number is intentionally retained as a diagnostic, not hidden or “corrected” by changing `pitch.rx/ry/rz`. It reflects a simplified figure rig and a source without a ball marker. Owner visual review must decide whether the display alignment is acceptable; no claim of measured hand/ball alignment is made.

## Automated validation

| Command / gate | Result |
| --- | --- |
| exporter round trip | PASS — verified source hashes, JSON parse, Python compile, and byte-identical regenerated compact profile |
| `node _test_pitch_motion_bank_cmu124_20260811.js baseball3d.html` | PASS — direct profile/source-isolation/release/timing/pitch-trace/pitch-type/legacy/mirror/continuity/policy/handoff and four mutation contracts |
| `node _architecture_guard_20260808.js baseball3d.html` | PASS — guard verdict `PASS` |
| `node _test_runner_intent_20260808.js baseball3d.html` | PASS — `targeted b0805-25 RunnerIntent PASS` |
| `node _test_runner_controls_sliding_20260809.js baseball3d.html` | PASS — `targeted b0805-25 runner controls/sliding PASS` |
| `node _test_fielding_assignment_20260808.js baseball3d.html` | PASS — `targeted b0805-16 FieldingAssignment PASS` |
| `node _test_reach_model_20260808.js baseball3d.html` | PASS — `targeted b0805-17 ReachModel PASS` |
| `node _test_defense_action_policy_20260809.js baseball3d.html` | PASS — `targeted b0805-23 DefenseActionPolicy PASS` |
| `node _test_force_chain_decision_20260809.js baseball3d.html` | PASS — `b0805-28 force-chain decision PASS` |
| `node _test_breakaway_transfer_context_20260810.js baseball3d.html` | PASS — verdict `PASS`; ground `1.0846`, pickoff receive `0.2287`, relay receive `0.3184`, throw receive `0.3182` |
| `node _test_thrower_footwork_20260810.js baseball3d.html` | PASS — b29 possession-footwork recorded replay and mutation |

The deterministic pitch trace gate compares four pitch types under fixed input against b29's recorded launch/trajectory/resolution hashes, while separately asserting unchanged `pitchPos`, `updatePitch`, and `doSwing` function hashes. It therefore does not claim a historical recording or 50-game/1000-route rerun.

### Browser baseline status

`python _ci_browser_regression_20260809.py` was attempted and stopped with `RuntimeError: Chromium not found`. The allowed in-app-browser alternative also blocks local `file:` navigation by browser security policy. No alternate browser or workaround was used after that block. Therefore **browser visual baseline and behavioral-mutation confirmation are not claimed as passed**.

## Owner visual checklist (required before calling the motion visually accepted)

1. Watch several CPU pitches: the arm/ball should reach the release moment together with no visible one-frame lag.
2. Compare all four pitch types: visual windup/release/follow-through shape should be the same even though flight durations differ.
3. Watch a ball put in play: the pitcher must leave recovery and join existing fielding movement immediately; no frozen follow-through.
4. Check the hand/ball visual relationship around release from the normal batting camera, using the recorded proxy separation as a caution rather than a measurement.
5. Check plant, torso turn, throwing arm, glove side, and recovery for any obvious rig distortion or ground penetration.
6. Check a normal strike/ball sequence and a hit sequence: scoring, count, runners, and defensive decisions must look unchanged from b29.

## Known limits and deferred M1.1 work

- Source laterality remains provisional; mirror infrastructure exists, but no final athlete-side claim is made.
- The profile is compact visual retargeting, not a full skeleton, IK solve, or physically measured delivery.
- No source ball marker exists; hand/ball alignment remains an owner visual gate.
- No delivery-cadence, pitch-flight, launch-position, batting, runner, fielding-AI, or defense-policy change was made.
- M1.1 may consider cadence only after owner playtest; P1/E1/F1/P2 remain out of scope.
