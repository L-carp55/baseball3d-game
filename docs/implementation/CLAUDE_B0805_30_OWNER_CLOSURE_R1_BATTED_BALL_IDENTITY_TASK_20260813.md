# Claude Code task — b0805-30 Owner Closure Recovery R1

Date: 2026-08-13
Repository: `L-carp55/baseball3d-game`
Branch: `claude/b0805-30-owner-closure-r1-batted-ball-identity`
Exact repair base: `05a4d7968e3952050f891351e964e3b2b6b1ea66`
Tracking Issue: #33

## 0. Purpose

This is **not** M1 Final Validation and not P1.

Owner replay on 2026-08-13 showed BUILD `b0805-30` and exposed that owner feedback previously described as fixed is not fully present in the actually played line.

Independent GitHub audit found a branch-history defect:

- historical b24 / PR #17 is **not an ancestor** of b25→b26→b28→b29→b30;
- b25 implementation was created directly from b23;
- current historical b24 branch is a failed payload/workflow reconstruction branch, not a clean game-body implementation;
- b30 recorder reads `ball.battedType`, but production never writes it;
- the 2026-08-13 owner recording therefore logs `bt:""` for every frame.

Your task is to restore the **lost batted-ball identity contract against the real current b0805-30 code**, with new focused tests and mutations.

Do not merge or copy the historical b24 branch wholesale.

Read first:

- `docs/handoff/CURRENT_STATE.md` from `agent/research-baseball-motion-ai`
- `docs/audits/owner_feedback_closure_matrix_20260813.md` from `agent/research-baseball-motion-ai`
- Issue #33
- PR #17 only as a requirements/history source, **not as trusted implementation**

## 1. Scope — R1 only

Recover the physical batted-ball identity boundary.

Required behavior:

1. A batted ball gets an explicit physical type at contact/startFlight.
2. Physical type is independent of whether a current defender can catch it before landing.
3. `canCatchAir` remains only catch-feasibility state.
4. Physical type does not change merely because the ball later lands.
5. Low hard trajectories represented by the original owner examples (at minimum 9° and 11°) must remain line drives even when `canCatchAir=false`.
6. Ordinary ground examples must remain ground balls; include at least a negative launch-angle grounder and the current owner sample type around 1°.
7. Normal fly and popup examples remain distinct.
8. Recording `ball.bt` must be populated for every batted ball.
9. Result/display paths that currently hard-code `ゴロ` solely because the play entered an infield/grounded route must use the preserved physical type when that text is intended to describe the batted ball.
10. Existing `flyKind` / caught-ball rule semantics must remain correct.

This task is intentionally narrower than all historical PR #17 claims. Do **not** also repair Issue #30, b29a, walls, HOLD_BALL, rundown admission, or relay routing here.

## 2. Baseline facts you must independently confirm

Before editing, inspect remote/source and record in the audit:

- `ball.battedType` read in recorder;
- no production writer for it;
- `startFlight()` current ball construction;
- `classifyCaughtBall()` current semantics;
- current test19 protects only caught-ball classification;
- current final/result paths that still synthesize `ゴロ` directly;
- historical b24 is not in current ancestry.

Do not accept this task document as proof; verify the code.

## 3. Design contract

Prefer one explicit pure helper for initial physical classification, e.g. a function conceptually like:

`classifyBattedBallPhysical(contact)`

The exact function name is your choice, but there must be one authoritative initial classification path.

The output should use the game's existing Japanese category vocabulary where compatible:

- `ゴロ`
- `ライナー`
- `フライ`
- `ポップフライ`

### Important semantic rule

Do not implement:

```js
battedType = canCatchAir ? 'フライ' : 'ゴロ'
```

or any equivalent coupling.

Do not mutate physical type on `landed=true`.

`landed`, `canCatchAir`, and physical type are separate facts.

### Thresholds

Do not invent thresholds silently.

Use the existing game semantics and the owner/b24 acceptance examples as constraints. At minimum your focused tests must pin:

- a normal negative-angle grounder -> `ゴロ`
- approximately 1° low ground-type contact -> expected ground category
- 9° owner example -> `ライナー`
- 11° owner example -> `ライナー`
- a normal mid/high fly example -> `フライ`
- a high popup example -> `ポップフライ`

If a threshold decision is ambiguous, document the exact chosen threshold and why in the audit. Do not tune it to make a single fixture pass while breaking adjacent cases.

## 4. Result/display integration

Audit every path in which the game currently prints or carries `ゴロ`, `ライナー`, `フライ`, `ポップフライ` for a batted-ball result.

Required principle:

- official play state (force out, tag, hit, etc.) is separate from physical batted-ball identity;
- text that describes the batted-ball type should read the preserved identity;
- do not turn a line drive into a grounder only because it bounced before the final throw/out;
- do not break fly-catch rule behavior; a caught airborne ball is still an air out and existing `flyKind` handling must remain valid.

Do not do a broad copy rewrite. Change only paths whose wording is actually batted-ball-type wording.

## 5. Tests — mandatory focused contract

Add a permanent focused test, suggested path:

`_test_batted_ball_identity_recovery_20260813.js`

It must execute the real production helper/path, not a duplicated approximation.

Minimum assertions:

1. physical type is assigned at `startFlight`;
2. type is not derived from `canCatchAir`;
3. 9° and 11° low liners remain `ライナー` with `canCatchAir=false`;
4. 1° owner-sample-style contact is not accidentally turned into a line drive if the selected classification contract says ground;
5. after stepping until `landed=true`, the original type remains unchanged;
6. recorder field `bt` is non-empty for batted balls;
7. at least one non-caught low-liner result path keeps `ライナー` identity instead of hard-coded `ゴロ`;
8. existing caught-ball `classifyCaughtBall` / `flyKind` behavior remains compatible;
9. no effect on pitch/throw physics.

If browser-level fixture is needed for result text, add a small deterministic harness fixture rather than only regex checks.

## 6. Mutation detection — mandatory

Add a mutation runner or extend a focused mutation mechanism so each of the following is actually killed:

- M-R1-BT-1: remove the production `battedType` assignment entirely;
- M-R1-BT-2: derive type from `canCatchAir` (`false => ゴロ`);
- M-R1-BT-3: overwrite physical type with `ゴロ` at first landing;
- M-R1-BT-4: restore a hard-coded `ゴロ` in a result path exercised by a low-line-drive fixture;
- M-R1-BT-5: stop recording `bt` or allow it to remain empty;
- M-R1-BT-6: make 9°/11° examples ground balls;

The unmutated baseline must pass before mutant kills are counted.

Do not merely construct a mutant in memory and assert that a string changed; execute the real focused contract against each temporary mutant.

Production files must be byte-identical before/after mutation-runner execution.

## 7. Existing regression expectations

This branch starts from M1 R2 b0805-30.

Known baseline state before this R1:

- M1 focused contract passes;
- R2 mutation suite passes;
- browser suite has the known stale `test27_投球モーション時系列` mismatch from M1 (50/51), pending separate M1 Final Validation;
- b29 deterministic pitch traces and gameplay invariants must remain unchanged.

For this task:

- do **not** modify test27;
- do **not** modify CMU motion to satisfy test27;
- browser regression must introduce **no new failures** beyond the already-known test27 failure;
- record the exact failure set before and after;
- run the focused new test/mutations independently so the known browser baseline failure cannot make fake mutant kills look successful.

Run at minimum:

- JS syntax check for changed/new JS;
- `_architecture_guard_20260808.js`;
- `_test_pitch_motion_bank_cmu124_20260811.js`;
- `_r2_mutation_check_20260811.js`;
- `_test_thrower_footwork_20260810.js`;
- `_test_breakaway_transfer_context_20260810.js`;
- `_test_runner_intent_20260808.js`;
- `_test_fielding_assignment_20260808.js`;
- `_test_reach_model_20260808.js`;
- `_test_defense_action_policy_20260809.js`;
- `_test_force_chain_decision_20260809.js`;
- `_test_runner_controls_sliding_20260809.js`;
- new batted-ball identity focused test;
- new batted-ball identity mutation runner;
- `python _ci_browser_regression_20260809.py` with Chrome/Chromium available through the same safe PATH technique if needed.

## 8. Invariants — must not change

Do not change:

- RunnerIntent ownership;
- FieldingAssignment ownership;
- ReachModel authority;
- DefenseActionPolicy/ThrowDecision boundaries;
- PlayLifecycle boundary;
- b26 double-play continuation;
- b28 breakaway / transfer-context behavior;
- b29 possession footwork;
- CMU canonical FK / release timing / release coordinates;
- `pitch.rx/ry/rz`, `pitchPos`, `updatePitch`, `doSwing`;
- CPU windup 0.85s;
- post-release CMU clock semantics;
- b29 deterministic pitch traces;
- raw ASF/AMC/C3D policy.

## 9. Explicitly out of scope

Do not touch in R1:

- PR #32 / b29a bounce-slide fixes;
- Issue #30 BallPossession/FieldingExecution;
- ThrowRoute/relay loop;
- HOLD_BALL;
- chase+cover joint assignment;
- rundown receive timing/admission;
- stationary-ball time-only possession;
- run-through pickup;
- foul-side walls;
- RunnerContact/TagEvent;
- M1 final screenshot work;
- P1/E1/F1/P2;
- PR creation;
- merge.

## 10. Audit artifact

Create:

`docs/audits/b0805_30_owner_closure_r1_batted_ball_identity.md`

Include:

- exact repair base SHA;
- implementation SHA;
- changed files;
- independent confirmation of the b24 ancestry gap;
- exact physical classification contract/thresholds;
- examples including -angle, 1°, 9°, 11°, fly, popup;
- evidence that `canCatchAir` does not control physical type;
- evidence type survives landing;
- evidence recorder `bt` is non-empty;
- result-path fixture evidence;
- all mutation outcomes;
- full test commands/results;
- browser baseline before/after and exact known failure set;
- failed attempts;
- unresolved limitations.

## 11. Stop condition

Commit and push to this branch, then stop.

Do not create a PR.
Do not merge.
Do not start Recovery R2.
Do not resume M1 Final Validation.
Do not start P1.

Browser GPT will independently inspect the remote diff and decide whether R1 is approved.