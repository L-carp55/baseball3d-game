# b0805-30 — Owner Closure Recovery R1: batted-ball physical identity

Date: 2026-08-13
Repository: `L-carp55/baseball3d-game`
Branch: `claude/b0805-30-owner-closure-r1-batted-ball-identity` (local checkout name `owner-closure-r1-batted-ball-identity`)
Task: `docs/implementation/CLAUDE_B0805_30_OWNER_CLOSURE_R1_BATTED_BALL_IDENTITY_TASK_20260813.md`
Tracking Issue: #33
Canonical authority for this recovery: `agent/research-baseball-motion-ai:docs/handoff/CURRENT_STATE.md` and `agent/research-baseball-motion-ai:docs/audits/owner_feedback_closure_matrix_20260813.md`

## 0. SHAs

- Exact repair base: `05a4d7968e3952050f891351e964e3b2b6b1ea66`
- Implementation commit (this R1, test/mutation runner + battedType recovery + this audit): `bee15b6594498ef91440b9629604cdac18430c6d`. (This follow-up commit, which only fills in this one SHA line, mirrors R2's and M1 final validation's own precedent of a small follow-up commit to record their own implementation SHA.)
- `baseball3d.html` SHA-256 after R1: `417eb93fad3fef38950cd55f8b17e1e942e5dbbbf442d18e6be90c6de7fd2e4d` (changed from base — this recovery legitimately edits production code, unlike M1 final validation which kept it byte-identical).

## 1. Changed files

- `baseball3d.html` — 28 insertions / 5 deletions. Adds `classifyBattedBallPhysical(c)`; wires `ball.battedType` into `startFlight()`'s object-literal constructor; changes 3 hard-coded `ゴロ` result-path literals (`concludePlay()` rundown-fallback text, `concludePlay()` single-out text, `resolveHit()` force/run text) to read `ball.battedType` with a `ゴロ` default.
- `_test_batted_ball_identity_recovery_20260813.js` — new. Focused contract test (task §5).
- `_r1_batted_ball_mutation_check_20260813.js` — new. Mutation detection runner for M-R1-BT-1..6 (task §6).
- `docs/audits/b0805_30_owner_closure_r1_batted_ball_identity.md` — this file.

No other file was touched. `_test_harness_20260804.js` (test27) and `_ci_browser_regression_20260809.py` are unmodified, per task §7's explicit "do not modify test27" / "do not modify CMU motion" instructions.

## 2. Independent confirmation of the b24 ancestry gap (task §2, "do not accept the task document as proof")

Re-verified directly against the GitHub remote, not by trusting `CURRENT_STATE.md`'s prose:

```
$ git merge-base origin/agent/b0805-24-batted-ball-rundown-integrity origin/agent/b0805-29-possession-footwork
a6ed22b0da133c00c9120261d7d45847cd37562b

$ git rev-parse origin/agent/b0805-23-defense-action-policy
a6ed22b0da133c00c9120261d7d45847cd37562b

$ git rev-parse origin/agent/b0805-24-batted-ball-rundown-integrity
e50b5c326feb74ccff855fd355c2d1d304fd07be

$ git merge-base --is-ancestor origin/agent/b0805-24-batted-ball-rundown-integrity origin/agent/b0805-29-possession-footwork
$ echo $?
1   # NO
```

The merge-base between b24 and the current b29 line is exactly b23's head (`a6ed22b0...`), and `--is-ancestor` explicitly reports NO. This independently confirms: b24's work is not inherited by b25→b26→b28→b29→b30; the canonical line branched from b23 directly. PR #17 is read only as a requirements/history source below, not as evidence of a surviving implementation.

## 3. Baseline facts confirmed by reading the current code (task §2)

All confirmed directly in `baseball3d.html` before making any change:

- **`ball.battedType` read, no writer**: the only reference in the whole file was the recorder, `bt:ball.battedType||''` (then at line 121). `grep -n "battedType"` found zero assignment sites (`ball.battedType=` never appeared).
- **`startFlight(c, powerMul, from)`** (then at line 4359): builds `ball={x,y,z,t,vx,vy,vz,bs,ss,exit,la,spray,maxZ,landed}` directly from the contact object `c` (`c.exit`, `c.la`, `c.spray` all available at construction), then calls `const plan=planPlay(ball)` and sets `ball.canCatchAir=plan.air` — a **separate, later** feasibility prediction (whether the assigned defender can reach the ball before it lands), computed from real-time fielder reach/interception timing, not from the ball's own launch physics.
- **`classifyCaughtBall(b)`** (then at line 4458): `if(b.landed) return 'ゴロ'; if(la>45) return 'ポップフライ'; if(la<=20 && maxZ<22) return 'ライナー'; return 'フライ';`. Used only inside `resolveCatch()` for balls actually caught in the air (where `landed` is always false at the call site under normal flow — its `landed` branch is a defensive guard, not the live path).
- **`test19_捕球打球分類`** (`_test_harness_20260804.js`): calls `classifyCaughtBall(...)` directly with four synthetic inputs. It does not exercise `startFlight()`, `battedType`, or any result-path text — confirmed narrow scope, matching the task's description.
- **Hard-coded `ゴロ` result-path literals found** (exhaustive `grep -n "ゴロ"` sweep of the whole file, excluding comments and `classifyCaughtBall`'s own defensive `landed` branch):
  1. `concludePlay()`, rundown-result composite text: `` `${nm}ゴロ` `` — the fallback for `throwPlay.kind` not being `fly`/`outfield`/`steal`/`pickoff`/`breakaway` (i.e. the `infield` case).
  2. `concludePlay()`, single-out text: `` `${nm}ゴロ アウト` ``.
  3. `resolveHit()` (the earlier, more direct force/double-play resolution that runs before any `throwPlay` object exists for a simple contact-based out): `` `${ball.primary.n}ゴロの間に1点` `` / `` `${ball.primary.n}ゴロ アウト` ``.

  Two of these (1, 2) are inside `concludePlay()`'s later rundown/throw-sequence resolution; the third (3) is a separate, earlier direct-resolution path. Both had to be found and fixed — the task's suggested single fix site was insufficient once the code was actually read.

## 4. Physical classification contract

```js
function classifyBattedBallPhysical(c){
  const la = c.la||0;
  if(la<=5) return 'ゴロ';
  if(la<=20) return 'ライナー';
  if(la<=45) return 'フライ';
  return 'ポップフライ';
}
```

Called once, at construction, inside `startFlight()`'s `ball={...}` object literal (`battedType: classifyBattedBallPhysical(c)`), before `planPlay(ball)` / `ball.canCatchAir` are ever computed.

**Boundary provenance** (task: "do not invent thresholds silently"):
- `la<=20 -> ライナー` ceiling and `la>45 -> ポップフライ` are the *exact same* constants `classifyCaughtBall()` already uses for its own liner/fly and fly/popup boundaries — reused, not reinvented.
- `la<=5 -> ゴロ` is the one genuinely new threshold this recovery introduces (no prior boundary existed for the ground/liner split, since `classifyCaughtBall()` never needed one — a caught ball is by definition airborne). 5° was chosen as a round value roughly midway between the owner's ~1° ground example and 9° liner example, leaving margin on both sides rather than sitting close to either pinned example. 0° or 3° would sit close to the "~1°" ground example; 7° or 8° would sit close to the 9° liner example — either risks a threshold-adjacent misclassification looking like a coincidence rather than a real margin. 5° does not.

**Examples pinned in the focused test** (`_test_batted_ball_identity_recovery_20260813.js`, Part 1, pure function level):
| la | expected | note |
|---|---|---|
| -8° | ゴロ | normal negative-angle grounder |
| 0°, 5° | ゴロ | boundary, inclusive ground side |
| ~1° (task's owner-sample-style pin) | ゴロ | |
| 6°, 9°, 11°, 20° | ライナー | 9°/11° are the exact owner examples from the task/audit |
| 21°, 30°, 45° | フライ | |
| 46°, 55° | ポップフライ | |

## 5. canCatchAir independence (task requirement 2)

- `classifyBattedBallPhysical`'s source contains no reference to `canCatchAir` anywhere (checked by the focused test with a regex over the extracted function source, not just by inspection).
- End-to-end: in the browser fixtures (§8 below), all four 9°/11° liner fixtures reach `canCatchAir===false` once the ball actually lands uncaught (a landed ball was, by construction, not caught), while `ball.battedType` stays `ライナー` throughout — the two facts move independently, exactly as required. (Note: at the moment of *contact*, `canCatchAir` is a defender-reach *prediction*, `plan.air`, and can be `true` even for a ball that a real, simulated catch attempt subsequently fails to secure — `canCatchAir` is re-evaluated during flight, e.g. a failed dive sets it to `false` at the point of the failed attempt. The focused test asserts the physically meaningful invariant — `canCatchAir` is false once a ball has actually landed uncaught, decoupled from `battedType` — rather than asserting a fixed value at contact that the game's own mechanics don't guarantee either way.)

## 6. Type persists through landing (task requirement 4)

Two independent lines of evidence:
1. **Structural / exhaustive**: `grep` over the whole file for the only syntactic form a reassignment could take, `ball.battedType\s*=`, finds zero matches. The sole write is the object-literal `battedType:` key at construction. No landing/bounce/settle code path can touch it because none of them use that assignment form.
2. **Behavioral**: in every browser fixture (§8), `ball.battedType` is read again at the exact tick `ball.landed` first becomes `true`, and matches the value read immediately after `startFlight()`, before any flight ticks ran.

## 7. Recorder `bt` (task requirement 8)

`recTick()`'s per-frame `ball` snapshot already read `bt:ball.battedType||''` before this recovery (only the writer was missing). No recorder change was needed — populating `ball.battedType` at construction was sufficient. Verified behaviorally in every browser fixture: `REC.cur.f[last].ball.bt !== ''` once at least one recorded frame exists.

## 8. Result-path fixture evidence (task requirement 9, §5 assertion 7)

Six deterministic browser fixtures, driven through the *real* production entry point `startFlight({exit,la,spray}, powerMul, from)` — the same object shape `doSwing()` itself builds and passes to `startFlight`, so this is not a duplicated approximation of contact, it is the same call production makes, with the timing-minigame RNG in `doSwing`/`evalContact` bypassed in favor of directly supplying the resulting contact parameters. Each fixture calls `newGame()`, reseeds the harness's deterministic PRNG to the same starting state (necessary — see §9.1), then drives real `update(1/60)` ticks until the play concludes.

| Fixture | exit/la/spray | pre-flight type | type at landing | `canCatchAir` at landing | recorder `bt` | final result text | outs |
|---|---|---|---|---|---|---|---|
| `liner_9deg` | 60mph / 9° / 0° | ライナー | ライナー | false | non-empty | 二ライナー アウト | 1 |
| `liner_9deg_mirror` | 60mph / 9° / -10° | ライナー | ライナー | false | non-empty | 遊ライナー アウト | 1 |
| `liner_11deg` | 50mph / 11° / 0° | ライナー | ライナー | false | non-empty | 二ライナー アウト | 1 |
| `liner_11deg_mirror` | 50mph / 11° / -5° | ライナー | ライナー | false | non-empty | 遊ライナー アウト | 1 |
| `grounder_1deg` | 45mph / 1° / 0° | ゴロ | ゴロ | false | non-empty | 投ゴロ アウト | 1 |
| `grounder_negative` | 60mph / -5° / 0° | ゴロ | ゴロ | false | non-empty | 投ゴロ アウト | 1 |

All six exercise `throwPlay.kind==='infield'` (`sawInfieldKind:true` in the raw driver output) — the exact call site (`concludePlay()`'s single-out text) that used to hard-code `ゴロ`. The four liner fixtures prove the fix (result text now says ライナー); the two grounder fixtures, run through the *identical* code path, are the adjacent-case check the task explicitly asked for — they still say ゴロ, proving the fix reads the preserved type rather than always saying ライナー or breaking genuine grounders.

## 9. Failed attempts (kept for the next person, not hidden)

### 9.1 Random-stream order dependency (self-discovered, before it could contaminate the audit)

The first version of the browser fixture ran all six trials back-to-back inside one page load, relying only on the page-load-time PRNG seed. `liner_11deg` (3rd trial in sequence) intermittently resolved as a fielding error (`ベイカーのエラー！`) instead of a clean putout, because `Math.random()` is one continuing stream for the page's lifetime — `newGame()` does not reset it — so trial 3's outcome silently depended on how many random draws trials 1 and 2 happened to consume first. Fixed by exposing an explicit `window.__seedRandom()` reset hook in the deterministic prelude and calling it at the start of every `trial()`. Re-probing then also showed that the *specific* exit-velocity/launch-angle/spray combinations that worked reliably from a fresh-seeded first draw were different from the ones found before the reseed fix (e.g. the working 9° fixture moved from 72mph to 60mph, and 11°/1° needed lower exit velocities entirely, 50mph/45mph) — the final fixture table in §8 reflects the reseed-stable values, found by systematic sweep, not by retrying until one combination happened to pass.

### 9.2 `canCatchAir` at contact vs. at landing

An earlier draft of the focused test asserted `canCatchAir===false` immediately after `startFlight()` returns, for the 9°/11° liner fixtures — this failed, because `plan.air` (the contact-time feasibility *prediction*) can genuinely be `true` for a fast, low liner that a real, simulated fielder then fails to actually catch. That is correct game behavior, not a bug: `canCatchAir` is re-evaluated during flight and is explicitly set `false` when a catch attempt fails (`baseball3d.html`, the failed-dive branch). The assertion was moved to check the physically meaningful moment instead — `canCatchAir` at the tick the ball actually lands, which is unconditionally `false` for any ball that lands (a caught ball never reaches `landed=true`) — see §5.

### 9.3 Node `vm`-sandbox extraction was insufficient for the full-play fixtures

`_test_pitch_motion_bank_cmu124_20260811.js`'s pattern (extract a function's source text, run it in a `vm` context with a handful of stubbed globals) works well for the CMU pitch-motion functions, which are close to pure. `startFlight()`/`update()`/`concludePlay()`/`resolveHit()` are not — they read and mutate a web of shared globals (`fielders`, `runners`, `S`, `throwPlay`, `REC`, and dozens of helper functions calling each other). Attempting to stub all of that by hand would have been a duplicated approximation of production, which the task explicitly forbids. The focused test therefore drives the *real* page (headless Chromium, same deterministic-PRNG-prelude technique as `_ci_browser_regression_20260809.py`) for the full-play assertions, and reserves `vm`-sandbox extraction only for the genuinely pure/structural checks (the classifier function itself, and source-text regex checks).

### 9.4 Windows Chromium discovery

Same known issue as R2/M1 final validation: `_ci_browser_regression_20260809.py` cannot find Chrome via `shutil.which("google-chrome"/"chromium"/"chromium-browser")` on this Windows environment. Per the established precedent (R2 audit §6, M1 final validation audit §3.1), the shared CI script itself was **not** modified; a `google-chrome.cmd` PATH shim was used for the `--manual` and full-suite runs (§10 below). The two *new* files this recovery adds (`_test_batted_ball_identity_recovery_20260813.js`, `_r1_batted_ball_mutation_check_20260813.js`) instead do their own portable discovery (`CHROME_PATH`/`PUPPETEER_EXECUTABLE_PATH` env vars, then `where`/`which` for `google-chrome`/`chromium`/`chromium-browser`/`chrome`, then the standard Windows install path as a last resort) so they do not require the PATH-shim workaround wherever Chromium is already discoverable (e.g. a Linux CI runner).

## 10. Mutation outcomes (task §6)

`node _r1_batted_ball_mutation_check_20260813.js` (production `baseball3d.html` verified byte-identical, SHA-256 `417eb93fad3fef38950cd55f8b17e1e942e5dbbbf442d18e6be90c6de7fd2e4d`, before and after the run):

| Mutant | What it does | Killed | Detected by |
|---|---|---|---|
| M-R1-BT-1 | removes the `battedType:` constructor assignment entirely | yes | assertion 1 — startFlight no longer assigns battedType via classifyBattedBallPhysical(c) |
| M-R1-BT-2 | re-couples type to canCatchAir (`false => ゴロ`) after `plan.air` is known | yes | assertion 5 structural half — a `ball.battedType=` reassignment now exists (0 expected) |
| M-R1-BT-3 | overwrites type with `ゴロ` at first landing | yes | assertion 5 structural half — a `ball.battedType=` reassignment now exists (0 expected) |
| M-R1-BT-4 | restores the hard-coded `ゴロ` in `concludePlay()`'s single-out text | yes | assertion 7 — concludePlay's single-out infield text no longer reads ball.battedType |
| M-R1-BT-5 | recorder always writes `bt:''` | yes | assertion 6 — recorder field bt is empty for a batted ball |
| M-R1-BT-6 | ground/liner boundary pushed to 15°, so 9°/11° become grounders | yes | assertion 3 — 9° owner example is no longer ライナー |

6/6 killed, 0 survivors. `BASELINE` (unmutated, LF-normalized copy) passes first, proving the kills reflect real detection rather than a suite that fails unconditionally.

Note: M-R1-BT-2 and M-R1-BT-3 both happen to be caught by the *structural* immutability check (§6) before the browser fixtures even run, because both mutations add a second `ball.battedType=` assignment. This is a legitimate, fast catch — the task only requires that the named mutation is killed by the suite, not by which specific assertion. The behavioral browser-fixture assertions (`landedType`, `canCatchAirAtLanding`) remain in the suite as a second line of defense for a semantically equivalent mutation using different assignment syntax (e.g. bracket notation or a helper function), even though this run's two structural mutants didn't need them to be caught.

## 11. All required regressions (task §7)

All 12 commands run against the R1-edited working tree.

| # | Command | Result |
|---|---|---|
| 1 | JS syntax check for changed/new JS | PASS — `node --check` on the extracted main `<script>` body of `baseball3d.html` (CRLF-normalized before anchor matching — the checkout has CRLF line endings, a Node-vs-Python text-mode difference, not a file defect); both new `.js` files are plain CommonJS and load/run without syntax errors as part of running them below |
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
| — | new: `node _test_batted_ball_identity_recovery_20260813.js baseball3d.html` | PASS |
| — | new: `node _r1_batted_ball_mutation_check_20260813.js` | PASS, 6/6 killed |
| 13 | `python _ci_browser_regression_20260809.py` (with Chrome via PATH shim) | see §11.1 below |

### 11.1 Browser baseline and mutation suite, before/after

**Before** (R1 repair base `05a4d7968e3952050f891351e964e3b2b6b1ea66`, checked out into an isolated worktree, not the working tree): `python _ci_browser_regression_20260809.py --manual` → `manual baseline failed`, exactly one test failing: `test27_投球モーション時系列` (2 of its internal checks fail — the same pre-CMU-contract mismatch M1 R2/final-validation documented, 50/51 overall). Independently re-confirmed here, not assumed from the task document.

**After** (this R1 working tree): `python _ci_browser_regression_20260809.py --manual` → the identical failure. The two runs' raw failure payloads (test name, per-check failure list, verdict) were byte-diffed and are identical; only the file paths in the Python traceback differ (expected — different worktree locations). **No new browser-level failure was introduced by R1.**

`python _ci_browser_regression_20260809.py` (no `--manual`, the full 22-mutation + 3-architecture-guard suite) was also run on the after-tree. It aborts at `assert_full()`'s baseline gate (`RuntimeError: baseline failed`) before ever reaching the mutation loop, because that gate unconditionally requires a clean 51/51 baseline and does not special-case the known pre-existing test27 failure. This is not a regression: by inspection of `assert_full()`'s code, the same gate aborts at the same point for the same reason on the *before* tree too — the mutation loop (mut28 through mut50, none of which touch code this recovery changed) is unreachable in either state, so re-running the full ~5-minute, ~26-launch suite on the before-tree would provide no additional signal beyond what is already established by (a) the `--manual` before/after diff above and (b) direct code inspection of the unconditional gate. This is recorded rather than silently worked around, per the task's "do not patch the CI runner to hide the baseline failure" instruction — the CI runner was not touched.

## 12. Unresolved limitations

- The full non-manual `_ci_browser_regression_20260809.py` mutation suite (mut28–mut50, architecture guards) cannot currently run to completion on this branch at all, in either the before or after state, because of the pre-existing test27/M1 mismatch this task explicitly forbids touching. Resolving that is M1 Final Validation's job, not R1's, per task scope.
- `resolveHit()`'s other branches (`advanceOnHit(1, ...内野安打！...)`, the outfield hit-type branch) were read and left untouched — their wording ("内野安打", "ヒット", "ツーベース") describes the *hit outcome*, not the batted-ball physical category, so they are outside "paths whose wording is actually batted-ball-type wording" per task §4. If the owner's actual intent extends further (e.g. wanting hit-type text to also reflect batted-ball category), that is a new requirement, not part of this recovery's scope.
- Per task §9, OF-20 through OF-46 (cover-candidate throw targets, force-order throws, rundown premature declaration, backstop draw order, and all of Issue #30/R2/R3) were not investigated or touched here; they remain exactly as characterized in `owner_feedback_closure_matrix_20260813.md`.

## 13. Scope discipline

Per task §9/§6, this recovery did not start M1.1, P1, E1/F1/P2, Issue #30, relay-loop fixes, b29a integration, PR creation, or merge. `baseball3d.html`'s only changes are the four described in §1/§4; `RunnerIntent`, `FieldingAssignment`, `ReachModel`, `DefenseActionPolicy`/`ThrowDecision`, `PlayLifecycle`, b26 double-play continuation, b28 breakaway/transfer, b29 possession footwork, CMU canonical FK/release timing, `pitch.rx/ry/rz`/`pitchPos`/`updatePitch`/`doSwing`, CPU windup 0.85s, and post-release CMU clock semantics are all untouched — verified for the pitch/throw-physics functions specifically via SHA-256 pins in `_test_batted_ball_identity_recovery_20260813.js` (Part 3), reusing the exact same baseline constants already established in `_test_pitch_motion_bank_cmu124_20260811.js`.

## 14. Stop condition

Per task §11: this commit is pushed to `claude/b0805-30-owner-closure-r1-batted-ball-identity` and the session stops here. No PR created, no merge, Recovery R2 not started, M1 Final Validation not resumed, P1 not started.
