# b0805-30 — Owner Closure Recovery R1a: physical/caught-ball classifier compatibility

Date: 2026-08-13
Repository: `L-carp55/baseball3d-game`
Branch: `claude/b0805-30-owner-closure-r1a-classifier-compat` (local checkout name `owner-closure-r1a-classifier-compat`)
Task: `agent/research-baseball-motion-ai:docs/implementation/CLAUDE_B0805_30_OWNER_CLOSURE_R1A_CLASSIFIER_COMPAT_TASK_20260813.md`
Red-team finding this repairs: `agent/research-baseball-motion-ai:docs/audits/b0805_30_owner_closure_r1_browser_redteam_20260813.md`
Tracking Issue: #33

## 0. SHAs

- Exact repair base (R1's final commit): `5088aeefd0ee632282c36120185dcc97ff2fc880`
- Implementation commit (this R1a): recorded in a follow-up commit after the primary commit, same precedent as R1/R2/M1 final validation's own self-referential SHA commits.
- `baseball3d.html` SHA-256 after R1a: `22350d3ed2fdb9f59c5aba49c330932f6755f99a2101c210d3962b4b3029bf3e` (legitimately changed from R1's `417eb93f...` — this repair edits production code).

## 1. Changed files

- `baseball3d.html` — 40 insertions / 7 deletions.
- `_test_batted_ball_identity_recovery_20260813.js` — extended with a shared-support pure-function bundle, cross-classifier compatibility assertions, and a new browser fixture.
- `_r1_batted_ball_mutation_check_20260813.js` — extended with `M-R1A-COMPAT-1`.
- `docs/audits/b0805_30_owner_closure_r1a_classifier_compat.md` — this file.

`_test_harness_20260804.js` and `_ci_browser_regression_20260809.py` remain unmodified.

## 2. Independent reproduction of the incompatibility, before editing

Read `classifyBattedBallPhysical` (angle-only, from R1) and `classifyCaughtBall` (angle **and** apex, `maxZ<22`) side by side and confirmed the red-team's claim is a real, live disagreement, not a hypothetical:

```
contact: exit=105mph, la=18°  (before any R1a change)
  ball.battedType             = ライナー   (R1's angle-only rule: 5 < 18 <= 20)
  real simulated flight apex  = 32.83 ft   (measured by stepping the same ball forward
                                             with the game's own stepBall(), no fielders)
  classifyCaughtBall({la:18, maxZ:32.83}) = フライ   (18<=20 but maxZ=32.83 is NOT <22)
  => incompatible: true
```

This was measured by calling the real, unmodified `startFlight()` for this contact, then continuing the *same* ball's flight forward with the real `stepBall()` (no fielders touched) to find its actual apex, then calling the real, unmodified `classifyCaughtBall()` with that measured apex. All three functions used are production functions, not a re-implementation. This exactly reproduces the case the red-team named (a 15-20° contact whose apex crosses 22ft): `vz = exit*1.467*sin(la)` at 105mph/18° gives enough initial vertical velocity that gravity (32.2 ft/s²) alone would already put the apex over 22ft, and the game's own backspin lift term (`bs = clamp((la+6)/30,-0.4,1.1)`, positive for any la>-6°) adds more height on top of that — so this is not an edge case that only appears for unrealistic inputs; ordinary hard-hit 15-20° contact routinely does this.

## 3. Shared physical classification contract

```js
function categorizeAirborneByAngleApex(la, apexZ){
  if((la||0)>45) return 'ポップフライ';
  if((la||0)<=20 && (apexZ||0)<22) return 'ライナー';
  return 'フライ';
}
function classifyCaughtBall(b){
  if(b.landed) return 'ゴロ';
  return categorizeAirborneByAngleApex(b.la, b.maxZ||b.z);
}
function predictBattedBallApexFt(c){
  const v=(c.exit||0)*1.467, laRad=(c.la||0)*RAD;
  const b={x:0,y:0,z:1.4,vx:0,vy:v*Math.cos(laRad),vz:v*Math.sin(laRad),
    bs:clamp(((c.la||0)+6)/30,-0.4,1.1), ss:0};
  let apex=b.z;
  for(let i=0;i<1200;i++){
    stepBall(b,1/240);
    if(b.z>apex) apex=b.z;
    if(b.z<=0.02 && i>10) break;
  }
  return apex;
}
function classifyBattedBallPhysical(c){
  const la = c.la||0;
  if(la<=5) return 'ゴロ';
  return categorizeAirborneByAngleApex(la, predictBattedBallApexFt(c));
}
```

**`classifyCaughtBall()`'s behavior is unchanged** — its own body was refactored to call the extracted `categorizeAirborneByAngleApex()` instead of inlining the same two `if` statements, but it is fed exactly the same inputs (`b.la`, `b.maxZ||b.z`) it always was, and the extracted table's branches are a verbatim copy of the two lines that used to be inline. This is checked two ways: (a) `classifyCaughtBall`'s SHA-256 is deliberately **not** pinned as "untouched" any more (its source legitimately changed), and (b) its **behavior** is re-verified against the exact same four `test19_捕球打球分類` input/output pairs R1 already pinned — all four still pass unchanged (§7).

**`classifyBattedBallPhysical()` now routes non-ground contacts through the same table**, fed by `predictBattedBallApexFt(c)` instead of a real measured `maxZ` (which does not exist yet at contact time).

## 4. Contact-time apex/trajectory information without defender state

`predictBattedBallApexFt(c)` reuses the real, unmodified `stepBall()` — the same function `planPlay()` uses for its own lookahead — but strips out everything defender-related. It constructs a standalone ball state from `c.exit`/`c.la` only (`x=y=0`, `vx=0`, `vy=v*cos(la)`, `vz=v*sin(la)`, the same `bs`/`ss` spin `startFlight()` itself computes) and steps it forward, tracking the maximum `z` reached, until it lands or a generous iteration cap. No `fielders`, `planPlay`, `reachTimeToPoint`, or `canCatchAir` reference exists in its body (checked by regex in the focused test, §7 Part 1).

**Why `spray`/`x`/`y` can be safely ignored for the apex prediction**: `startFlight()`'s real horizontal velocity components are `vx=v*cos(la)*sin(spray)`, `vy=v*cos(la)*cos(spray)` — for *any* spray angle, `Math.hypot(vx,vy) = v*cos(la)*sqrt(sin²(spray)+cos²(spray)) = v*cos(la)`, a spray-independent constant. `stepBall()`'s drag term depends only on the total 3D speed `Math.hypot(vx,vy,vz)`, which is therefore also spray-independent. Setting `vx=0, vy=v*cos(la)` (equivalent to a fixed spray=0) produces the exact same `z`/`vz` trajectory as any real spray angle would — not an approximation, an exact simplification for the one axis (height) this prediction needs.

This is a genuine field-independent **trajectory** prediction (task requirement 6): it never asks "can a defender reach this," only "how high does this specific hit ball go on its own."

## 5. Cross-classifier compatibility cases and results

All pinned and verified — synthetic pure-function level (`_test_batted_ball_identity_recovery_20260813.js` Part 1/1b) and, for the flagged overlap case, a real browser fixture (Part 5):

| Case | Input | `classifyBattedBallPhysical` | Matches `categorizeAirborneByAngleApex` at the same predicted apex |
|---|---|---|---|
| negative angle | 60mph / -8° | ゴロ | n/a (ground, apex irrelevant) |
| ~1° | 45mph / 1° | ゴロ | n/a |
| 9° owner liner | 60mph / 9° | ライナー | yes |
| 11° owner liner | 50mph / 11° | ライナー | yes |
| **15-20° high-apex overlap (the red-team's flagged case)** | 105mph / 18° | **フライ** (predicted apex 31.7ft, >=22ft) | **yes — was the incompatible case; now agrees** |
| normal mid/high fly | 95mph / 30° | フライ | yes |
| popup | 95mph / 55° | ポップフライ | n/a (>45° short-circuits before apex) |
| popup boundary | 95mph / 46° | ポップフライ | n/a |

The 18°/105mph case is additionally run through the **real** `startFlight()` in headless Chrome (not just the synthetic `classifyBattedBallPhysical({exit,la})` argument form) — `_test_batted_ball_identity_recovery_20260813.js`'s `highapex_18deg` browser fixture — and its real-execution result is asserted equal to the isolated vm-sandbox prediction, tying the two together end to end.

## 6. Mutation outcome

`node _r1_batted_ball_mutation_check_20260813.js` (production `baseball3d.html` verified byte-identical, SHA-256 `22350d3ed2fdb9f59c5aba49c330932f6755f99a2101c210d3962b4b3029bf3e`, before and after the run):

7/7 mutants killed, 0 survivors — the original six R1 mutations (M-R1-BT-1..6) remain killed, plus:

| Mutant | What it does | Killed | Detected by |
|---|---|---|---|
| M-R1A-COMPAT-1 | reintroduces the exact R1 defect: `if(la<=20) return 'ライナー';` short-circuits before the shared apex-aware table runs, for every airborne contact regardless of predicted apex | yes | "R1a requirement 5: 15-20° high-apex contact (predicted apex 31.73ft) is フライ under classifyBattedBallPhysical, matching existing caught-air semantics for the same apex" |

`BASELINE` (unmutated) passes first, proving the kill reflects real detection.

## 7. R1 regression outcomes, re-verified on R1a

All of R1's own required checks were re-run against the R1a-edited tree, not assumed to still hold:

- `test19_捕球打球分類`'s four pinned examples, re-run against the refactored `classifyCaughtBall()`: all four unchanged (低いノーバウンドはライナー / 通常フライ / 高角度はポップ / 接地球だけゴロ — see `_test_batted_ball_identity_recovery_20260813.js` Part 3).
- R1's six owner/adjacent-case pins (negative angle, ~1°, 9°, 11°, normal fly, popup): all six still hold (§5 table above; same values, now computed via the shared table instead of R1's flat angle-only `if` chain).
- `ball.battedType` immutability (0 `ball.battedType=` reassignments anywhere in the file): still holds.
- The two `concludePlay()` result-path fixes and the one `resolveHit()` fix from R1: source-checked unchanged (R1a did not touch `startFlight`'s constructor line, `concludePlay`, or `resolveHit` at all — only `classifyBattedBallPhysical` and `classifyCaughtBall`).
- Recorder `bt` population: still non-empty in every fixture.
- All six R1 browser fixtures (`liner_9deg`, `liner_9deg_mirror`, `liner_11deg`, `liner_11deg_mirror`, `grounder_1deg`, `grounder_negative`): identical results to R1 (same `preType`/`landedType`/`lastPlay`/`outs`), confirming R1a did not disturb any previously-working case while fixing the flagged one.
- All six R1 mutations (M-R1-BT-1..6): still killed (§6).

## 8. All required regressions

All 12 R1-required commands re-run against the R1a-edited working tree.

| # | Command | Result |
|---|---|---|
| 1 | JS syntax check for changed/new JS | PASS — `node --check` on the extracted main `<script>` body of `baseball3d.html` (CRLF-normalized, same as R1); both edited `.js` files load and run without syntax errors as part of running them below |
| 2 | `node _architecture_guard_20260808.js baseball3d.html` | PASS |
| 3 | `node _test_pitch_motion_bank_cmu124_20260811.js baseball3d.html` | PASS |
| 4 | `node _r2_mutation_check_20260811.js` | PASS |
| 5 | `node _test_thrower_footwork_20260810.js baseball3d.html` | PASS |
| 6 | `node _test_breakaway_transfer_context_20260810.js baseball3d.html` | PASS |
| 7 | `node _test_runner_intent_20260808.js baseball3d.html` | PASS |
| 8 | `node _test_fielding_assignment_20260808.js baseball3d.html` | PASS |
| 9 | `node _test_reach_model_20260808.js baseball3d.html` | PASS |
| 10 | `node _test_defense_action_policy_20260809.js baseball3d.html` | PASS |
| 11 | `node _test_force_chain_decision_20260809.js baseball3d.html` | PASS |
| 12 | `node _test_runner_controls_sliding_20260809.js baseball3d.html` | PASS |
| — | `node _test_batted_ball_identity_recovery_20260813.js baseball3d.html` | PASS (extended with Part 1b cross-classifier checks and the `highapex_18deg` fixture) |
| — | `node _r1_batted_ball_mutation_check_20260813.js` | PASS, 7/7 killed |
| 13 | `python _ci_browser_regression_20260809.py --manual` (with Chrome via PATH shim) | see §8.1 |

### 8.1 Browser baseline, before/after

**Before** (R1a repair base `5088aeefd0ee632282c36120185dcc97ff2fc880`, checked out into an isolated worktree, not the working tree): `python _ci_browser_regression_20260809.py --manual` → `manual baseline failed`, exactly one test failing: `test27_投球モーション時系列` (2 of its internal checks fail — the same pre-CMU-contract mismatch documented since M1, 50/51 overall).

**After** (this R1a working tree): `python _ci_browser_regression_20260809.py --manual` → the identical failure — `manual baseline failed`, exactly one test failing (`test27_投球モーション時系列`, the same 2 internal checks).

The two raw failure payloads were byte-diffed and are identical; only the file paths in the Python traceback differ (expected — different worktree locations). **No new browser-level failure was introduced by R1a.**

`python _ci_browser_regression_20260809.py` (no `--manual`, full mutation suite) still aborts at `assert_full()`'s baseline gate before reaching the mutation loop, for the same pre-existing reason documented in R1's audit §11.1 — this is unrelated to R1a's changes (which touch only the two classifier functions, nothing `assert_full`'s baseline gate or the mut28-mut50 suite exercises) and is out of R1a's scope per the task's explicit "do not modify test27" instruction.

## 9. Unresolved limitations

- `classifyBattedBallPhysical`'s ground threshold (`la<=5`) is still evaluated before any apex check, so a very low-angle contact (say 2-3°) that is somehow caught by an infielder before landing would be `battedType='ゴロ'` at contact but `classifyCaughtBall` would call it `ライナー` if actually caught (its own `landed` check would be false, and `la<=20` with a low apex falls into its liner branch). This is a *different, narrower* overlap than the one flagged (ground vs. liner at very low angles, not liner vs. fly at 15-20°) and was not named in the red-team's finding or the task's required compatibility cases. It is recorded here rather than silently left unexamined, per this recovery's own standard, but not fixed — task §"Scope — R1a only" restricts this pass to the specific flagged incompatibility, and reaching further risks exactly the kind of untested threshold tuning the R1 task warned against.
- `predictBattedBallApexFt`'s 1200-iteration/`1/240`s cap (5 seconds of simulated flight) is shared with `planPlay()`'s own lookahead style but not literally copied from it; for any physically realistic contact (even a towering popup) the ball lands or reaches its apex well within this window, so the cap does not affect any of the pinned cases, but it is a chosen constant rather than a value read from elsewhere in the file.

## 10. Stop condition

Per task instructions: this commit is pushed to `claude/b0805-30-owner-closure-r1a-classifier-compat` and the session stops here. No PR created, no merge, Recovery R2 not started, M1 Final Validation not resumed, P1 not started.
