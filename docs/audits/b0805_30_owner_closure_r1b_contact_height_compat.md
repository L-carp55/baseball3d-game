# b0805-30 — Owner Closure Recovery R1b: contact / launch-height compatibility

Date: 2026-08-13
Repository: `L-carp55/baseball3d-game`
Branch: `agent/b0805-30-owner-closure-r1b-contact-height-compat`
Task: `agent/research-baseball-motion-ai:docs/implementation/TASK_B0805_30_OWNER_CLOSURE_R1B_CONTACT_HEIGHT_COMPAT_20260813.md`
Red-team finding this repairs: `agent/research-baseball-motion-ai:docs/audits/b0805_30_owner_closure_r1a_browser_redteam_v2_20260813.md`
Tracking Issue: #33
Worker: Grok Build (first implementation task after the primary-worker migration)

## 0. SHAs

- Exact repair base (R1a final HEAD): `de8dcd6175ed866a9f96f5768c228eec1b53fb6d`
- Implementation commit (this R1b): recorded in a follow-up commit after the primary commit, same precedent as R1/R1a/R2/M1 final validation.
- Final HEAD: recorded in the same follow-up.
- `baseball3d.html` SHA-256 after R1b: `5cdd30fc3e075051df75cf8e5a20e2f50729064492125ece70d6e79e8acc7d73` (legitimately changed from R1a's `22350d3ed2fdb9f59c5aba49c330932f6755f99a2101c210d3962b4b3029bf3e` — this repair edits production code).

Independently confirmed before editing:

```
git fetch origin
git rev-parse origin/claude/b0805-30-owner-closure-r1a-classifier-compat
de8dcd6175ed866a9f96f5768c228eec1b53fb6d
```

Working tree was clean. Branch created from that exact SHA. No `grok/` prefix.

## 1. Changed files

- `baseball3d.html` — pass actual launch height into the contact-time apex/classifier contract.
- `_test_batted_ball_identity_recovery_20260813.js` — R1b launch-height / same-trajectory / production-wiring assertions.
- `_r1_batted_ball_mutation_check_20260813.js` — `M-R1B-HEIGHT-1` plus updated R1/R1a anchors.
- `docs/audits/b0805_30_owner_closure_r1b_contact_height_compat.md` — this file.

`_test_harness_20260804.js` and `_ci_browser_regression_20260809.py` remain unmodified.

## 2. Independent reproduction of the fixed-height defect, before editing

Read the R1a functions on `de8dcd61` directly. Confirmed the red-team claim is a live input mismatch, not a hypothetical:

```
predictBattedBallApexFt(c) always initialized z=1.4
startFlight() launches z=from[1]
normal batting: startFlight(c, ..., [pitch.tx, Math.max(1.2,pitch.ty), 1.4])
classifyBattedBallPhysical(c) never received from[1]
```

The R1a 105mph/18° fixture does **not** detect this. Real `stepBall()` apex at that contact:

| startZ | measured apex | category |
|---|---|---|
| 1.2 | 31.527 ft | フライ |
| 1.4 | 31.727 ft | フライ |
| 2.5 | 32.827 ft | フライ |
| 3.5 | 33.827 ft | フライ |

Both the isolated predictor (z=1.4) and the browser fixture (`from[1]=2.5`) stay `フライ`, so the 22 ft liner/fly boundary is never exercised.

A systematic sweep of the **real** extracted `stepBall()` over exit 70–115 mph (0.5), launch angle 6–20° (0.25), and startZ in {1.2, 1.5, 2.5, 3.3, 3.5} found **783** physically plausible contacts where fixed z=1.4 and the actual launch height flip `categorizeAirborneByAngleApex` across the absolute 22 ft boundary.

## 3. Threshold-adjacent fixture selected

Integer, mid-contact, both sides of 22 ft with margin:

```
exit=95 mph, la=16°, startZ=2.5 ft
  apex at z=1.4 : 21.856 ft -> ライナー
  apex at z=2.5 : 22.956 ft -> フライ
```

This is a normal hard-hit 16° airborne contact, not an exotic angle. The 1.1 ft apex shift equals the 2.5−1.4 launch-height difference. Restoring fixed z=1.4 classifies the production `from[1]=2.5` launch as `ライナー` while the ball that `startFlight()` actually launches measures 22.956 ft and is `フライ`.

Complementary low-contact flip, also pinned:

```
exit=85 mph, la=18°, startZ=1.2 ft
  apex at z=1.4 : 22.193 ft -> フライ
  apex at z=1.2 : 21.993 ft -> ライナー
```

`Math.max(1.2,pitch.ty)` can legally produce 1.2 ft, so the low side is not theoretical.

## 4. Classifier / predictor API contract

```js
function classifyBattedBallPhysical(c, launchZ){
  const la = c.la||0;
  if(la<=5) return 'ゴロ';
  return categorizeAirborneByAngleApex(la, predictBattedBallApexFt(c, launchZ));
}
function predictBattedBallApexFt(c, launchZ){
  const z0 = (launchZ==null ? 1.4 : +launchZ);
  const v=(c.exit||0)*1.467, laRad=(c.la||0)*RAD;
  const b={x:0,y:0,z:z0,vx:0,vy:v*Math.cos(laRad),vz:v*Math.sin(laRad),
    bs:clamp(((c.la||0)+6)/30,-0.4,1.1), ss:0};
  ... real stepBall() ...
}
```

Inside `startFlight()`:

```js
battedType: classifyBattedBallPhysical(c, from[1])
```

Rules kept:

- launch/contact height is an explicit argument;
- the classifier/predictor do not read global `pitch`, defenders, `planPlay`, or `canCatchAir`;
- isolated/helper callers may omit `launchZ` and keep the old 1.4 default;
- production `startFlight()` never relies on that default — it passes the known `from[1]`;
- `categorizeAirborneByAngleApex` thresholds are unchanged;
- `ball.battedType` remains immutable after construction.

## 5. Evidence production passes the real launch height

Structural (focused test Part 2):

- `startFlight` assigns `battedType: classifyBattedBallPhysical(c, from[1])`;
- it does **not** call `classifyBattedBallPhysical(c)` without the height.

Behavioral (browser, real `startFlight`):

| fixture | from[1] | contact-time type | measured stepBall apex | measured category |
|---|---|---|---|---|
| same_95_16_z12 | 1.2 | ライナー | 21.656 ft | ライナー |
| same_95_16_z25 | 2.5 | フライ | 22.956 ft | フライ |
| same_95_16_z35 | 3.5 | フライ | 23.956 ft | フライ |

Different `from[1]` values change the stored `ball.battedType` on the same (exit, la). That cannot happen if production ignores height.

## 6. Same-trajectory comparisons at multiple launch heights

Invariant, for each case:

1. `startFlight(c, 1, [0, startZ, 1.4])` (browser) or the isolated classifier with the same `launchZ`;
2. record contact-time type;
3. independently step a clone of the same initial ball state with real `stepBall()` (not by calling `predictBattedBallApexFt`);
4. `categorizeAirborneByAngleApex(la, measuredApex)` equals the contact-time type.

Isolated cases run: (60,9) at 1.2/2.5/3.5; (50,11) at 1.5; (95,16) at 1.2/2.5/3.5; (105,18) at 1.2/2.5/3.3; (95,30) at 2.5; (85,18) at 1.2.

Browser `startFlight` cases: (60,9) at 1.2/2.5/3.5; (95,16) at 1.2/2.5/3.5; (105,18) at 2.5; (85,18) at 1.2.

All agreed. Existing owner pins remain:

| Case | Result |
|---|---|
| 60mph / −8° | ゴロ |
| 45mph / 1° | ゴロ |
| 60mph / 9° | ライナー |
| 50mph / 11° | ライナー |
| 105mph / 18° high-apex | フライ |
| 95mph / 30° | フライ |
| 95mph / 55° and 46° | ポップフライ |

Category thresholds were not moved.

## 7. Mutation outcomes (8/8 killed)

`node _r1_batted_ball_mutation_check_20260813.js`

Production `baseball3d.html` SHA-256 `5cdd30fc3e075051df75cf8e5a20e2f50729064492125ece70d6e79e8acc7d73` unchanged before/after. `BASELINE` (unmutated LF-normalized copy) passed first.

| Mutant | What it does | Killed | Detected by |
|---|---|---|---|
| M-R1-BT-1 | remove `battedType` assignment | yes | production wiring: `classifyBattedBallPhysical(c, from[1])` |
| M-R1-BT-2 | recouple type to `canCatchAir` | yes | no `ball.battedType=` reassignment |
| M-R1-BT-3 | rewrite type to ゴロ on landing | yes | no `ball.battedType=` reassignment |
| M-R1-BT-4 | hard-code ゴロ in `concludePlay` | yes | concludePlay reads `ball.battedType` |
| M-R1-BT-5 | stop recording `bt` | yes | liner_9deg recorder `bt` non-empty |
| M-R1-BT-6 | ground/liner boundary past 11° | yes | 9° owner pin is ライナー |
| M-R1A-COMPAT-1 | angle-only `la<=20 -> ライナー` | yes | 105mph/18° is フライ (apex 31.727 ft) |
| M-R1B-HEIGHT-1 | ignore supplied launchZ, force predictor `z0=1.4` | yes | **95mph/16° at launchZ=2.5 is フライ (apex 22.956 ft). Fixed-height z=1.4 would still call this ライナー** |

`M-R1B-HEIGHT-1` still has the `from[1]` argument in source and still passes every non-boundary pin (those either use default 1.4 or sit far from 22 ft). The suite kills it only because of the launch-height compatibility contract, not because of a syntax/structure check on `z:1.4`.

## 8. Full regression commands / results

| # | Command | Result |
|---|---|---|
| 1 | JS syntax check of extracted `baseball3d.html` main `<script>` plus both edited `.js` files (`node --check`) | PASS |
| 2 | `node _architecture_guard_20260808.js baseball3d.html` | PASS |
| 3 | `node _test_pitch_motion_bank_cmu124_20260811.js baseball3d.html` | PASS |
| 4 | `node _r2_mutation_check_20260811.js` | PASS, 6/6 killed |
| 5 | `node _test_thrower_footwork_20260810.js baseball3d.html` | PASS |
| 6 | `node _test_breakaway_transfer_context_20260810.js baseball3d.html` | PASS |
| 7 | `node _test_runner_intent_20260808.js baseball3d.html` | PASS |
| 8 | `node _test_fielding_assignment_20260808.js baseball3d.html` | PASS |
| 9 | `node _test_reach_model_20260808.js baseball3d.html` | PASS |
| 10 | `node _test_defense_action_policy_20260809.js baseball3d.html` | PASS |
| 11 | `node _test_force_chain_decision_20260809.js baseball3d.html` | PASS |
| 12 | `node _test_runner_controls_sliding_20260809.js baseball3d.html` | PASS |
| — | `node _test_batted_ball_identity_recovery_20260813.js baseball3d.html` | PASS |
| — | `node _r1_batted_ball_mutation_check_20260813.js` | PASS, 8/8 killed |
| 13 | `python _ci_browser_regression_20260809.py --manual` (Chrome via external PATH shim; script unmodified) | see §8.1 |

### 8.1 Browser baseline, before/after

**Before** (R1a HEAD `de8dcd6175ed866a9f96f5768c228eec1b53fb6d`, isolated worktree, not the working tree): `python _ci_browser_regression_20260809.py --manual` → `manual baseline failed`, exactly one test failing: `test27_投球モーション時系列` (`検査: 2`, `不合格: ['投球開始時にはリリース姿勢', '例外']`).

**After** (this R1b working tree): the identical failure payload — `manual baseline failed`, exactly one test failing, same two internal checks.

**No new browser-level failure was introduced by R1b.**

The CI script itself was not modified. Full (non-`--manual`) mutation suite still aborts at `assert_full()`'s baseline gate for the same pre-existing test27 reason documented in R1/R1a. Out of R1b scope.

## 9. Failed attempts

None in the implementation loop. The focused contract passed on the first run after the production wiring and tests were written. The only pre-edit work was the independent sweep that selected the 95mph/16°/2.5 ft fixture; that sweep is evidence, not a failed patch.

## 10. Unresolved limitations

- Isolated callers that omit `launchZ` still default to 1.4. That is intentional for helper/test compatibility. Production `startFlight()` does not use the default; the focused test forbids the no-argument production call.
- The R1a-noted ground-vs-liner overlap at very low caught angles (`la<=5` vs caught-air liner) is unchanged. Out of R1b scope.
- `predictBattedBallApexFt` still sets `ss=0` and spray=0. Vertical apex remains spray-independent under `stepBall()`'s drag/lift (horizontal speed magnitude is `v*cos(la)` for any spray; side-spin is horizontal). Same-trajectory browser checks used `spray:0` to match production initial spin exactly.
- The 1200-iteration / 1/240 s prediction cap is unchanged.

## 11. Stop condition

Per task: this branch is committed and pushed, then the session stops.

Do not create a PR. Do not merge. Do not start JS R2/R3. Do not integrate PR #32. Do not implement Issue #30. Do not resume M1 Final Validation. Do not start P1. Do not start Unity U0.

Browser GPT independently reviews the remote R1b diff. If approved, the next single task is Unity U0.
