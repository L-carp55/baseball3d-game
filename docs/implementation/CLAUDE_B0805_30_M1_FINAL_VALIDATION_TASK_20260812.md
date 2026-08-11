# Claude Code task — b0805-30 M1 final validation

Date: 2026-08-12 JST
Repository: `L-carp55/baseball3d-game`
Branch: `claude/b0805-30-m1-final-validation`
Exact base: `05a4d7968e3952050f891351e964e3b2b6b1ea66`
BUILD: remain `b0805-30`

## 0. Status entering this task

M1 R2 independent browser red-team verdict:

- R2-F3: APPROVED
- R2-F5: APPROVED
- R2 scope: APPROVED
- M1 overall: NOT YET MERGE-READY

Read first:

- `docs/audits/b0805_30_pitch_motion_cmu124_r2.md`
- research branch `agent/research-baseball-motion-ai:docs/audits/b0805_30_pitch_motion_cmu124_r2_browser_redteam_20260812.md`
- `_test_harness_20260804.js`
- `_ci_browser_regression_20260809.py`
- `_test_pitch_motion_bank_cmu124_20260811.js`
- `_r2_mutation_check_20260811.js`
- `baseball3d.html`

This task is **final validation**, not M1.1 and not motion retuning.

## 1. Primary objective A — migrate stale browser test27

Current browser harness `test27_投球モーション時系列` belongs to the pre-CMU hand-authored pose contract and is stale in three ways:

1. hard-codes `releaseBefore.elbowR < 0.8`, assuming the old right-arm pose;
2. fabricates `S.phase='pitch'; pitch={t:0}` without the real release transition that sets `anim.pitchMotionReleased`;
3. advances `pitch.t` to judge follow-through/recovery even though M1 intentionally uses renderer-owned `anim.pitchMotionPostSec` independent of pitch flight/type.

### Required replacement semantics

Replace test27 with a browser contract that exercises the **production M1 transition**, not a hand-built incompatible state.

At minimum verify:

1. At the end of the existing 0.85 s windup, `pitcherPose()` is the CMU release-side pre pose (`release_proxy`) and is finite.
2. Exercise the same release path production uses — preferably `launchPitch(...)`; if a smaller direct helper is used, it must include `beginPitchMotion()` exactly as production does and the test must separately assert production `launchPitch()` still calls it before entering `S.phase='pitch'`.
3. Immediately after release:
   - `anim.pitchMotionReleased === true`;
   - `anim.pitchMotionPostSec === 0` initially;
   - `pitcherPose()` is non-null;
   - pre-release and post-release anchor poses are continuous within the existing profile contract.
4. Do **not** use fixed `elbowR` as release authority. Use throw-side-aware profile/event checks and/or the existing actual rendered hand-to-release geometric gate.
5. Advance the post-release renderer clock (`anim.pitchMotionPostSec` or the real update loop that advances it), not `pitch.t`, and verify source-event/pose progression through early/late follow-through toward the game-ready adapter.
6. Verify changing pitch duration/type does not change animation sample at a fixed renderer post time.
7. Verify live batted-ball/fielding handoff still causes pitch animation to yield to `fielderPose()`.
8. Keep CPU gameplay release exactly 0.85 s and do not add player pre-release pacing.

### Mutation requirement

Add/adjust a mutation so the browser/focused suite fails if someone restores either:

- `pitch.t` as the post-release animation clock; or
- a fabricated pitch state that bypasses the release transition; or
- a fixed right-elbow release heuristic as the sole contract.

Do not simply delete checks until 51/51 passes. The replacement must be at least as meaningful for M1 as the old test was for the legacy pose.

## 2. Primary objective B — complete the eight-event visual gate

The first M1 candidate once passed automated tests while looking severely scrambled. Numeric tests are necessary but not sufficient.

Inspect all eight representative events:

1. set
2. knee rise
3. SFC
4. MER
5. release
6. early follow-through
7. late follow-through
8. game-ready adapter

### Required visible checks

For each event confirm:

- no scrambled/inverted limbs;
- plausible leg/torso/arm silhouette;
- SFC -> release does not visually translate several feet backward;
- throwing hand moves toward release;
- hand and ball are visually colocated closely at release;
- follow-through continues across the body rather than snapping/reversing;
- pelvis/torso split does not detach the body;
- glove arm is coherent;
- ready pose is a natural recovery target;
- handedness/mirror does not put glove and throwing arm on impossible sides.

### Capture method

Previous headless `--screenshot` attempts were invalid because the WebGL buffer was discarded and produced identical/blank captures.

Use a **temporary copy only** if needed:

- set WebGL `preserveDrawingBuffer:true` in the temporary copy, not production;
- drive the real `frame()`/render loop rather than calling `draw()` in an unsupported partial state;
- use distinct deterministic event states;
- hash images and reject byte-identical event captures unless visually expected;
- verify non-background/non-empty pixel coverage before treating a screenshot as evidence.

A visible interactive browser inspection is also acceptable if reliable. Do not commit bulk PNGs/raw capture data. A compact contact sheet may be kept only if small and genuinely useful, but default is audit text + hashes/temporary evidence outside Git.

If any event is visibly broken, **do not retune motion in this task**. Record the exact event/problem and stop with `BLOCKED_FOR_MOTION_TUNING` so a separate narrow repair can be designed.

## 3. Gameplay/source invariants — must remain unchanged

This validation task should not change `baseball3d.html` gameplay/motion behavior. Prefer keeping `baseball3d.html` byte-identical to base `05a4d796...`.

Must preserve:

- canonical ASF/AMC FK;
- no raw AMC Euler direct renderer map;
- no raw ASF/AMC/C3D in Git;
- SFC -> release stride limits;
- release hand <= 0.75 ft;
- MER -> release -> early follow progression;
- no frame-585 ready adapter;
- explicit game-side ready adapter;
- mirror contract;
- CPU windup/release 0.85 s;
- `pitch.rx/ry/rz`;
- `pitchPos`;
- `updatePitch` gameplay result semantics;
- `doSwing`;
- runners;
- fielding AI/policy;
- gameplay rules;
- b29 deterministic pitch traces;
- post-release animation independent of `pitch.t`;
- live batted-ball `fielderPose()` priority.

If `baseball3d.html` must change merely to make the validation harness possible, stop and explain why before making a production change. Temporary copies/harness patches are preferred.

## 4. Required regression runs

Run at minimum:

- `node _test_pitch_motion_bank_cmu124_20260811.js baseball3d.html`
- `node _r2_mutation_check_20260811.js`
- `node _architecture_guard_20260808.js baseball3d.html`
- `node _test_thrower_footwork_20260810.js baseball3d.html`
- `node _test_breakaway_transfer_context_20260810.js baseball3d.html`
- `node _test_runner_intent_20260808.js baseball3d.html`
- `node _test_fielding_assignment_20260808.js baseball3d.html`
- `node _test_reach_model_20260808.js baseball3d.html`
- `node _test_defense_action_policy_20260809.js baseball3d.html`
- `node _test_force_chain_decision_20260809.js baseball3d.html`
- `node _test_runner_controls_sliding_20260809.js baseball3d.html`
- `python _ci_browser_regression_20260809.py`

For browser regression, require:

- **51/51 meaningful PASS** after test27 migration;
- all architecture mutations detected;
- all behavioral mutations detected.

Do not patch the CI runner to hide the baseline failure. A portable Windows Chrome lookup may be improved only if necessary and separately justified, but avoid broad CI refactoring in this task.

## 5. Required audit

Create:

`docs/audits/b0805_30_pitch_motion_cmu124_m1_final_validation.md`

Include:

- exact base SHA;
- final SHA;
- changed files;
- exact old test27 assumptions and new contract;
- why this is contract migration rather than loosening;
- browser 51/51 result and mutation result;
- eight-event visual QA result, one row per event;
- capture method and evidence validation (including image hashes if produced);
- release-hand distance and stride values rechecked;
- all regressions run;
- failed attempts;
- any unresolved visual concern;
- explicit `READY_FOR_OWNER_PLAYTEST` or `BLOCKED_FOR_MOTION_TUNING` verdict.

## 6. Scope boundaries

Do not start:

- M1.1 / player pre-release pacing;
- P1 physics;
- E1 FieldingExecution;
- perception-based fielding AI;
- Issue #30 fixes;
- relay-loop fixes;
- b29a integration;
- PR creation;
- merge.

## 7. Stop condition

If browser 51/51 is meaningful and all eight visual events are coherent, commit/push and stop with:

`READY_FOR_OWNER_PLAYTEST`

If any visual event is clearly broken, commit the audit/test migration if safe, record the event, and stop with:

`BLOCKED_FOR_MOTION_TUNING`

Do not silently tune the motion in the validation task.