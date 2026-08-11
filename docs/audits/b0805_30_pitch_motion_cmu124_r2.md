# b0805-30 CMU124 pitch motion — M1 R2 audit

## 1. Scope and identity

| item | value |
|---|---|
| repair base branch | `codex/b0805-30-pitch-motion-bank-cmu124-r1` |
| repair base exact SHA | `8599274e7be1ec2cf0d7b12570dd351d51c2b0a4` |
| gameplay canonical base (unchanged) | `60b993b73fed854934a976e45e8feb9437deb584` (b0805-29) |
| implementation SHA | see §9 (recorded after commit) |
| BUILD constant | `b0805-30` (unchanged — R2 is an architecture repair, not a new motion revision) |
| scope | **R2-F3 and R2-F5 only.** No M1.1, no pre-release pacing, no P1/E1, no perception fielding AI, no ball physics, no Issue #30 work, no relay-loop work, no b29a integration, no PR, no merge. |

R2 addresses the two items the browser red-team left BLOCKED on R1:

- **F3 (shared-transform architecture)** — QA and the real renderer were not on one kinematics path.
- **F5 (mutation coverage)** — tests only required `composeFigureSegment()` sharing, so the divergence above could not be detected.

## 2. Changed files

| file | change |
|---|---|
| `baseball3d.html` | `drawFigure()` now consumes `buildFigurePoseTransforms(...)`; its duplicated base/pelvis/torso/body block is deleted (38 lines → 15, net −23) |
| `_test_pitch_motion_bank_cmu124_20260811.js` | R2-F3/F5 contract assertions added (+71/−4); the old assertion that *required* the duplication is replaced |
| `_r2_mutation_check_20260811.js` | **new** — detection-power runner that injects the forbidden regressions into temp copies and requires the contract test to fail for each |

No other file is touched. `_ci_browser_regression_20260809.py` is **not** modified (see §6 for how Chrome was located instead).

## 3. F3 — the single shared transform path

Before R2 the body transform existed twice:

- `buildFigurePoseTransforms()` (used by `actualRenderedFigureHandWorldPosition()` → QA)
- an identical inline copy inside `drawFigure()` (the real renderer)

They agreed numerically, so `0.642056 ft` was reported truthfully — but the moment either copy changed alone, QA would pass while the screen was wrong. That is the failure mode R1's F3 Definition of Done forbids.

After R2, `drawFigure()` is:

```js
const T = buildFigurePoseTransforms(fx, fz, face, runDist, scale, speed01, pose);
const {P, s, sp, ph, sw, aw, bob, lean, hipY, shY, KNEE, ELB, split, base, pelvis, body} = T;
drawMesh(MESH[kit], body);
```

All of `P, s, sp, ph, sw, aw, bob, lean, hipY, shY, KNEE, ELB, split, base, pelvis, body` are received from the helper, as required. Both the legacy one-piece branch (`if(!split)`) and the pelvis/torso split branch now live only inside the helper, so legacy callers are unchanged in behaviour.

QA path and renderer path are therefore the same pure transform code, and `composeFigureSegment()` remains shared below it.

## 4. Numbers (unchanged by R2 — this is the point)

Contract test on the R2 build:

| metric | R1 (`8599274`) | R2 | gate |
|---|---|---|---|
| release hand world position | `x=1.0735032558441162, y=5.1201019287109375, z=54.0145149230957` | **identical** | — |
| actual release hand distance to ball | `0.642056 ft` | **`0.642056 ft`** | `<= 0.75 ft` PASS |
| MER→release · release→earlyFollow dot | `0.351916` | **`0.351916`** | `> 0` PASS |
| stride: sfc / plant / mer / release | `6.275048 / 6.135048 / 6.035048 / 6.035048` | **identical** | no multi-foot reversal |

The refactor is behaviour-preserving to the last digit, which is the expected result when only duplication is removed.

Hand progression across the eight QA events (sampled through the same helper the renderer uses):

| event | stride | armR | elbowR | pelvisYaw | torsoYaw | torsoLean | hand (x,y,z) |
|---|---|---|---|---|---|---|---|
| set | 0.000 | 0.300 | 1.56 | 0.000 | 0.070 | −0.048 | (0.65, 5.06, 59.17) |
| knee rise | 0.000 | 0.326 | 1.57 | −0.150 | 0.087 | −0.054 | (0.85, 4.81, 58.52) |
| SFC | 6.275 | 0.224 | 1.96 | −0.293 | 0.042 | 0.015 | (0.45, 5.09, 54.65) |
| MER | 6.035 | −0.019 | 2.05 | −0.514 | −0.068 | −0.159 | (0.25, 5.23, 54.88) |
| release | 6.035 | −0.077 | 2.06 | −0.735 | −0.101 | −0.214 | (1.07, 5.12, 54.01) |
| early follow | 6.935 | −0.203 | 2.04 | −0.608 | −0.080 | −0.165 | (1.01, 5.06, 53.55) |
| late follow | 6.915 | 0.086 | 1.02 | −0.443 | 0.073 | 0.163 | (1.88, 4.30, 52.17) |
| ready | 0.000 | 0.300 | 0.65 | 0.000 | 0.000 | 0.120 | (0.87, 3.40, 61.54) |

Observations from these numbers: stride never reverses by more than `0.24 ft` between SFC and release (the F1 symptom was ~`2.5 ft`); the hand advances monotonically toward the plate through MER → release → early follow (z 54.88 → 54.01 → 53.55); elbow and knee angles stay inside plausible human ranges; `ready` returns to a fielding stance.

## 5. F5 — detection power, measured

`node _r2_mutation_check_20260811.js` writes each mutant to a **temporary copy** and points the contract test at it. The production file is never mutated; the runner asserts the production SHA-256 is byte-identical before and after.

BASELINE (unmutated) must pass first, otherwise kills would prove nothing.

| mutant | what it re-introduces | killed | detected by |
|---|---|---|---|
| M-R2-1 | renderer re-implements the body transform while the helper still exists (**the exact R1 BLOCKED state**) | yes | `drawFigure calls buildFigurePoseTransforms` |
| M-R2-2 | QA keeps the helper, renderer bypasses it (**QA PASS / screen FAIL divergence**) | yes | same |
| M-R2-3 | renderer shares `composeFigureSegment()` only and recomputes base/pelvis/body | yes | same |
| M-R2-4 | call deleted, explanatory comment still names the helper (comment-only compliance) | yes | same |
| M-R2-6 | helper still called **and** a second body transform computed alongside it | yes | `drawFigure must not re-implement the body transform` |
| M-R2-5 | legacy one-piece transform dropped from the helper | yes | `legacy one-piece transform remains available inside the shared helper` |

**6 mutants, 6 killed, 0 survived.** M-R2-6 exists specifically because the first five were all caught by the "calls the helper" assertion; without it the duplicate-signature detector would have been dead weight that never fired. M-R2-4 exists because my own first version of the assertion matched the function name inside a comment — a mutant that deleted the call but kept the comment would have passed. Both holes were found and closed before this audit.

The requirement "`composeFigureSegment()` sharing alone must not pass" is asserted directly (M-R2-3 and an in-test segment-only mutant), not merely asserted in prose.

## 6. Browser regression

Chrome **is** available in this environment (`C:\Program Files\Google\Chrome\Application\chrome.exe`). `_ci_browser_regression_20260809.py` looks only for `google-chrome` / `chromium` / `chromium-browser` on PATH, which are Linux names, so a `google-chrome.cmd` shim was placed on PATH for the run. **The CI script itself was not modified.**

| build | baseline | architecture + behavioural mutations |
|---|---|---|
| b29 base `60b993b` | **51/51 PASS** | all detected |
| R1 `8599274` | **50/51** — `test27_投球モーション時系列` FAIL | all detected |
| R2 (this change) | **50/51** — identical failure | all detected |

Full CI stdout for R1 and R2 was captured and diffed: the only differences are temporary directory names and the script's own path. **R2 changes nothing in the browser regression.**

Because `assert_full()` aborts at the baseline check, the behavioural mutation phase was additionally evaluated with a patched copy of the runner kept in a scratch directory (baseline failure downgraded to a note). It printed `all architecture and behavioral mutations detected` for b29, R1 and R2 alike. The 3 architecture guard pages (`guard-goal`, `guard-cover`, `guard-retarget`) are killed in every build.

### 6.1 Pre-existing regression discovered (NOT introduced by R2)

`test27_投球モーション時系列` (OI-245 contract) fails on R1 and passes on the b29 base. It was never seen before because the Codex environment had no Chromium, so R1 shipped with browser regression unrun.

Two sub-checks fail:

1. `投球開始時にはリリース姿勢` — expects `stride>4 && elbowR<0.8`. Measured at `anim.wind=0.85`: `stride=6.035` (ok) but `elbowR=2.059` (bent throwing elbow), so the assertion fails.
2. `例外` — the test then reads `releaseAfter.stride`, but `pitcherPose()` returns `null` at `S.phase='pitch'` with `anim.pitchMotionReleased` unset, so it throws.

This is a genuine mismatch between the legacy hand-authored pitch pose contract and the CMU-driven motion. **Fixing it changes pitch motion behaviour and is therefore outside R2's scope** (§1). It is recorded here as an open item for the next milestone, not silently carried.

## 7. Visual QA — partially completed, honestly reported

Required checks were approached two ways.

**Completed (objective):** per-event pose and hand-endpoint numbers for all eight events (§4 table), sampled through the same helper the renderer uses. These cover "does not recede after SFC", "arm swings toward release", "hand and ball are close at release", "follow-through is continuous", "returns naturally to ready", and "pelvis/torso split is not broken" numerically. In the live page, `pitcherPose()` returns the correct `sourceEvent` for all eight events and the renderer produces a full frame (100 % non-background coverage) at every one.

**Completed (visual):** one rendered frame — MER — was captured and inspected. The figure is a coherent pitching pose: striding, torso rotated, throwing arm up and back near the head, glove arm across the body. No scrambled joints.

**NOT completed:** a clean set of all eight screenshots in a single run. Documented so the next reviewer does not have to rediscover it:

- Headless Chrome `--screenshot` captures an empty canvas, because the WebGL context is created without `preserveDrawingBuffer`; the buffer is discarded at composite. My first attempt produced byte-identical PNGs for every pose and would have "passed" a careless eye — it verified nothing.
- Copying the framebuffer with `drawImage()` immediately after `draw()` succeeded for only one random event per run. Giving each Chrome invocation its own `--user-data-dir` raised it to two. `gl.readPixels()` and adding `snapCam()` before `draw()` did not stabilise it in headless mode.
- The interactive preview pane renders correctly (verified: 100 % coverage, correct `sourceEvent`) but screenshots fail with "the Browser pane is not displayed, so the page is not compositing frames".

Recommended for the next run: enable `preserveDrawingBuffer` in a temp copy **and** drive the real `frame()` loop rather than calling `draw()` directly, or capture with the pane visible.

## 8. Preserved invariants (checked, not assumed)

Canonical ASF/AMC FK, no raw AMC Euler direct mapping, no multi-foot SFC→release reversal, release hand ≤ 0.75 ft, MER→release→early-follow progression, no frame-585 adapter, game-side ready adapter, mirror, no raw ASF/AMC/C3D in Git, CPU windup 0.85 s, physical `pitch.rx/ry/rz`, `pitchPos`, `updatePitch`, `doSwing`, runners, fielding AI, gameplay rules, b29 deterministic pitch traces, post-release renderer clock independent of `pitch.t`, live batted-ball handing over to `fielderPose`.

All are enforced by the existing contract test (baseline SHAs for `launch`, `pitchPos`, `updatePitch`, `doSwing`, `fielderReadyPose`, `trace`) which passes unchanged, plus:

| suite | result |
|---|---|
| `_test_pitch_motion_bank_cmu124_20260811.js` | PASS |
| `_architecture_guard_20260808.js` | PASS |
| `_test_thrower_footwork_20260810.js` | PASS |
| `_test_breakaway_transfer_context_20260810.js` | PASS |
| `_test_runner_intent_20260808.js` | PASS |
| `_test_fielding_assignment_20260808.js` | PASS |
| `_test_reach_model_20260808.js` | PASS |
| `_test_defense_action_policy_20260809.js` | PASS |
| `_test_force_chain_decision_20260809.js` | PASS |
| `_test_runner_controls_sliding_20260809.js` | PASS |
| `_r2_mutation_check_20260811.js` | PASS (6/6 killed) |

`_test_runner_reversal_20260805.js` is a browser-console script, not a Node test; it throws under Node by design and was not counted.

## 9. Failed attempts (kept, because they are the useful part)

1. **The first R2-F5 assertion matched a comment.** `drawFigure` mentions `buildFigurePoseTransforms()` in its explanatory comment, so "calls the helper" was satisfied by prose. Fixed by stripping comments before matching, and pinned by mutant M-R2-4.
2. **The first mutation runner failed to find its anchor** because the working tree is CRLF while the anchor string was LF. Fixed by normalising to LF for the temp copies only; production bytes are still asserted unchanged.
3. **The first screenshot harness produced byte-identical PNGs** for all eight events (WebGL buffer discarded at composite). Detected by hashing the outputs rather than trusting that files existed.
4. **The second screenshot harness fabricated `pitch = {t:0}`** for the post-release events; `draw()` then threw `Cannot read properties of undefined (reading 'bx')`. Replaced with the real `launchPitch(0,0,0)` path.
5. **`preserveDrawingBuffer` patch silently did not apply** (anchor mismatch in the patch script) while I believed it had. Caught by noticing the output was bit-for-bit identical to the previous run.

## 10. Unresolved limitations

1. `test27_投球モーション時系列` fails on R1 and R2 (passes on b29). Pre-existing, out of R2 scope, needs a decision in the next milestone: relax the legacy pose contract, or adjust the CMU-driven release pose. **Until then the browser baseline is 50/51, not 51/51.**
2. Full eight-event screenshot set not captured in one run (§7). Numeric QA and one inspected frame stand in; this is not equivalent to a full visual pass.
3. The R2 assertions are structural (source-level). They prove QA and renderer share one transform path and that the duplication cannot silently return; they do **not** prove the transform maths itself is correct — that remains the job of the numeric release-hand gate and visual inspection.
4. `_ci_browser_regression_20260809.py` still cannot find Chrome on Windows without an external PATH shim. Left unmodified deliberately; worth a portable lookup in a later, separately-scoped change.
