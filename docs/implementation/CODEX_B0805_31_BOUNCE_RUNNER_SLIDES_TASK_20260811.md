# Codex implementation task — b0805-31 batted-ball bounce and runner-slide repair

Date: 2026-08-11
Repository: `L-carp55/baseball3d-game`
Implementation branch: `codex/b0805-31-bounce-runner-slides`
Exact gameplay base: `60b993b73fed854934a976e45e8feb9437deb584`
Base branch: `agent/b0805-29-possession-footwork`
Current gameplay BUILD: `b0805-29`
Target BUILD: `b0805-31`

## 0. Objective

Implement three owner-requested repairs in one narrowly scoped gameplay build:

1. reduce unrealistically frequent ground-rule / entitled doubles caused by high fly balls rebounding too high after first ground contact;
2. fix the batter-runner visually disappearing during a head-first slide into first base;
3. make runners perform a head-first slide when returning to an integer base, with the rendered body facing the return direction.

Keep the changes isolated from the CMU pitching-motion branch and from Issue #30's defense / possession / relay redesign. Do not merge any draft PR.

## 1. Project boundary

This is the manually playable 3D baseball game. Do not use or modify the separate PowerPro / Prospi rating or pennant-simulator project.

Do not include:

- CMU motion M1 or M1 R1;
- FieldingExecution / BallPossession redesign from Issue #30;
- relay-route loop repair;
- wall topology redesign;
- fielding AI policy changes;
- pitch, contact, runner speed, tag timing, score calibration, or result rules except where directly required by these three defects.

## 2. Required source to inspect

Read directly from GitHub at the exact base SHA:

- `baseball3d.html`
- `stepBall`
- `stepFlight`
- the fence / entitled-double branch that checks `ball.landed` and `ball.z > 9.4`
- `makeRunner`
- `runnerClosePlayAtBase`
- `desiredRunnerSlide`
- `updateRunnerSlide`
- `runnerSlidePose`
- `updateRunners`
- `runnerPos`
- the runner draw loop in `render`
- `drawFigure`
- current b25–b29 regression / architecture tests

Read owner context from:

- Issue #30 for adjacent but explicitly out-of-scope defense defects;
- PR #20 for the original slide contract;
- this task as the authoritative scope for b0805-31.

## 3. Confirmed root causes

### F1 — one restitution coefficient is used for both low grounders and high fly impacts

Current `stepBall` applies:

```js
if(b.vz < -1.2){
  b.vz = -b.vz * 0.55;
  b.vx *= 0.78;
  b.vy *= 0.78;
}
```

for every ground impact.

This coefficient was raised to make low ground-ball hops visible. It is also applied to a high fly arriving at large downward velocity.

Ignoring drag after impact, a 60 ft/s downward impact rebounds at 33 ft/s and reaches roughly:

```text
33^2 / (2 * 32.2) = 16.9 ft
```

The outfield fence is only 9.4 ft. Therefore a fly that lands before the fence can frequently rebound above the wall and be classified as an entitled double.

Do not solve this by deleting entitled doubles or by changing the fence-result rule. Repair the collision response.

### F2 — the head-first pose translates the horizontal body below the ground

Current head-first pose:

```js
{ lean:1.28, crouch:1.38, rise:-0.52, ... }
```

`drawFigure` computes:

```js
bob = rise - crouch
```

for an explicit crouch. That is `-1.90 ft` before the near-horizontal body rotation. The body core and head can therefore be below the ground plane and become depth-occluded, which looks like the batter-runner disappears.

The runner draw loop does not intentionally remove a runner at first base; the only explicit removal is at home (`p >= 3.999`). This is a pose / clearance defect, not a runner-list deletion.

### F3 — return sliding is gated by a live close-play throw, and return facing is not reversed

`desiredRunnerSlide` currently permits a return slide only through `runnerClosePlayAtBase(...)`. A normal or manually commanded return can therefore reach the base upright when no qualifying `throwPlay` targets that base.

The runner render loop always uses `q.face`, which points in increasing basepath order. A runner moving from a later position back toward the previous base should use the opposite facing direction.

## 4. Required repair A — velocity-dependent batted-ball ground response

### 4.1 Separation of batted balls from throws

Do not globally change every use of `stepBall` without checking callers. Throws also use `stepBall`.

Use an explicit classifier / helper such as:

```js
function isBattedBallPhysicsBody(b) { ... }
function groundImpactResponse(b, impactVZ) { ... }
```

A committed batted ball contains batted-ball identity such as finite `exit` / `la` values. Do not rely on the mutable global `ball` object inside a helper that is also used for copied forecast bodies unless the copied body carries the same identity.

Keep existing throw-bounce behavior unchanged unless a direct regression proves a minimal compatibility adjustment is necessary.

### 4.2 Velocity-dependent restitution

Use a continuous response where:

- low / ordinary batted-ball hops remain visibly alive;
- high vertical impacts lose substantially more energy;
- no abrupt branch creates a discontinuity near one magic velocity;
- repeated bounces decay to rolling naturally.

A valid starting profile, to be verified rather than copied blindly, is:

```js
const t = clamp((impactVZ - 14) / 50, 0, 1);
const verticalRestitution = lerp(0.52, 0.32, t);
const horizontalRetention = lerp(0.78, 0.68, t);
```

where `impactVZ = -preImpactVZ`.

Expected approximate free-flight apexes under that starting profile:

| downward impact | current `e=.55` apex | proposed-profile apex |
| ---: | ---: | ---: |
| 12 ft/s | 0.68 ft | 0.60 ft |
| 20 ft/s | 1.88 ft | 1.53 ft |
| 40 ft/s | 7.52 ft | 4.30 ft |
| 60 ft/s | 16.91 ft | 6.31 ft |
| 70 ft/s | 23.02 ft | 7.79 ft |
| 80 ft/s | 30.06 ft | 10.18 ft |

This preserves visible low hops, suppresses routine high-fly rebounds over a 9.4 ft wall, and still allows an extreme impact to produce a rare high rebound.

The final constants may differ if deterministic QA shows a better curve, but the audit must record the tested curve and results.

### 4.3 Do not hard-code the result

Forbidden shortcuts:

- `if (ball.landed) never entitled double`;
- cap every post-bounce `z` below 9.4 ft;
- change all landed over-fence balls to live balls;
- reduce all bounces to nearly zero;
- alter the fence height to hide the physics issue.

A landed fair ball must still be able to bounce over the fence occasionally.

## 5. Required repair B — visible head-first slide into first

### 5.1 Pose clearance

Retune the head-first pose so the body core, head, shoulders, and extended hands remain visibly above the ground throughout the slide.

Do not merely disable depth testing or draw runners after the field. The body must occupy a physically plausible height.

A likely correction is to reduce the total negative translation. For example, use a positive `rise` with a smaller `crouch` so `rise - crouch` is approximately `-0.4` to `-0.7 ft`, not `-1.90 ft`, while keeping the body nearly horizontal.

Do not assume the sample values are final. Validate against the actual `drawFigure` transform and mesh reference points.

### 5.2 Renderer-space diagnostic

Add a deterministic helper for tests / debug, such as:

```js
function runnerSlidePoseClearance(pose) { ... }
```

or expose transformed representative points using the same matrix order as `drawFigure`.

At minimum verify representative body-core / head / hand heights are finite and above the ground by a declared tolerance during a first-base head-first slide.

The diagnostic must use the actual render transform convention. A separate hand-waved estimate that can disagree with `drawFigure` is not sufficient.

### 5.3 Do not change runner existence or timing

The runner must remain in `runners`; do not hide the issue by:

- extending / shortening the play solely to keep the runner visible;
- drawing a duplicate runner;
- changing `p` or `goal` timing;
- changing safe / out rules;
- giving sliding a speed bonus.

## 6. Required repair C — slide on return and face the return direction

### 6.1 Return slide contract

When a live runner is actually moving toward a previous integer base (`goal < p`) and enters the existing slide-start distance, select a head-first slide.

Cover at least:

- manual `X`, `A`, or `D` return commands after they are normalized through RunnerIntent;
- mandatory retouch after a caught fly (`mustReturn`);
- pickoff / breakaway returns;
- rundown returns to an actual integer base;
- ordinary automatic return to the runner's occupied base.

Do not require a current `throwPlay.target === base` merely to animate a return slide.

Do not slide when:

- `goal` is fractional rundown machinery rather than an integer base;
- the runner is stationary on the base;
- the runner is just rounding through a base with a farther forward goal;
- the runner is already out or scored.

Return slide remains visual only.

### 6.2 Facing contract

Create one helper, e.g.:

```js
function runnerRenderFace(r, pathFace) {
  return r.goal < r.p - EPS ? pathFace + Math.PI : pathFace;
}
```

Use it in the production runner draw call so both upright return running and head-first return sliding face the previous base.

Normalize the angle only if needed by existing matrix math. Do not mutate `runnerPos` into an intent-aware function; keep path geometry and render-facing responsibility separate.

### 6.3 Preserve existing forward slide policy

Must remain true:

- forward stop at second / third: feet-first;
- close forward play at first / home: head-first;
- no slide merely while rounding second or third;
- no slide timing or speed advantage;
- existing recording fields `slideMode`, `slideBase`, `slideDir`, `slideSeq` remain valid.

## 7. BUILD and diagnostics

- Change `BUILD` from `b0805-29` to `b0805-31`.
- Keep recording format backwards compatible.
- If adding bounce diagnostics, keep them compact and do not inflate every 0.1 s frame unnecessarily.
- If useful, add only event-level fields such as first-impact vertical speed / restitution to the current play record or to the dedicated test output. Do not redesign recordings in this task.

## 8. Dedicated deterministic tests

Create:

```text
_test_b0805_31_bounce_runner_slides_20260811.js
```

and any small supporting analysis script needed.

Required contracts:

### Bounce

1. **low-hop preservation** — batted-ball downward impact around 8–20 ft/s still produces a visible positive rebound;
2. **high-fly damping** — a routine 50–70 ft/s downward batted-ball impact has first rebound apex below the 9.4 ft fence;
3. **rare extreme preservation** — an extreme impact is not hard-capped below the fence, proving entitled doubles were not deleted by rule;
4. **continuity** — restitution / retention do not jump materially around interpolation boundaries;
5. **throw isolation** — identical throw body input retains the b29 throw-bounce trace;
6. **forecast parity** — copied bodies used by `planPlay`, `interceptPoint`, throw trajectory helpers, or other predictors receive the same collision rule as the actual batted ball;
7. **deterministic fence scenario** — a representative fly landing before the wall no longer clears it solely because of the old `.55` rebound;
8. **grounder sanity** — representative low ground-ball travel / hop remains within a declared narrow tolerance of b29 where expected.

### Head-first visibility

9. **first-base runner retained** — a batter-runner at `p < 1` with head-first slide is still present and selected by the render loop;
10. **clearance** — actual representative transformed body points do not place the whole torso / head below the ground;
11. **finite transform** — no NaN / Infinity across the full `0.82 s` slide window;
12. **shadow / body location** — runner world position remains at the basepath location, not an off-screen duplicate.

### Return slide

13. **manual return** — runner returning to first, second, or third receives `head` mode near the base even with no throw targeting that base;
14. **retouch return** — `mustReturn` runner uses head-first slide;
15. **return facing** — render face differs from forward path face by π within tolerance;
16. **fractional exclusion** — no slide for fractional rundown goal;
17. **forward preservation** — feet-first second / third and close first / home behavior remain unchanged;
18. **no timing bonus** — same seeded `p` trace before / after slide-visual changes.

### Mutation tests

Prove the suite fails when each defect is deliberately restored:

- constant batted-ball restitution `.55`;
- old head-first `{rise:-0.52,crouch:1.38}` depth translation;
- return slide still gated only by `runnerClosePlayAtBase`;
- return-facing reversal removed.

## 9. Distribution QA for entitled doubles

Create a reproducible same-seed analysis, suggested:

```text
_analyze_entitled_double_rate_20260811.js
```

Requirements:

1. run the exact b29 physics baseline before modifying thresholds;
2. run the same generated contact / trajectory sample after the repair;
3. report at least:
   - total fair balls in play;
   - airborne balls that first land in play;
   - landed balls that subsequently cross the wall above 9.4 ft;
   - entitled-double rate overall and within landed airborne balls;
   - ordinary doubles / triples / homers if the harness can observe them without changing gameplay;
   - first-bounce apex distribution (`p50`, `p90`, `p95`, `max`) by impact-speed band;
4. use enough samples for a stable comparison, preferably at least 10,000 fair contacts or a fixed exhaustive grid;
5. do not tune contact generation or fence dimensions between baseline and candidate.

Acceptance principle:

- entitled doubles must fall materially from the b29 baseline;
- they must not be mechanically forced to zero;
- low grounder visual bounce and broad game calibration must remain acceptable.

Do not invent a final target percentage before measuring the baseline. Record the result and reasoning in the audit.

## 10. Existing regression suite

Run at minimum:

- JavaScript syntax / extraction checks;
- `_architecture_guard_20260808.js`;
- focused RunnerIntent tests;
- runner control / sliding tests from b25;
- FieldingAssignment;
- ReachModel;
- DefenseActionPolicy / force-chain;
- b28 breakaway / transfer-context;
- b29 possession-footwork;
- current browser baseline / behavioral mutations when Chromium is available;
- fixed-seed full-game / route validation if the existing harness makes it feasible.

Do not claim a historical pass as a fresh run.

If Chromium is unavailable, record that explicitly, but still run all non-browser contracts and do not call visual acceptance complete.

## 11. Owner visual checklist

The pushed branch must contain a directly playable `baseball3d.html`.

Owner checks:

- high flies that land before the wall usually produce a modest grass / warning-track rebound rather than a second towering fly;
- occasional legitimate bounce-over-fence outcome remains possible;
- ordinary grounders still visibly hop and do not look glued to the turf;
- batter-runner remains visible for the entire head-first slide into first;
- head-first body lies just above the ground rather than inside it;
- runners returning to first / second / third visibly dive head-first;
- returning runners face the base they are returning to;
- forward feet-first slides at second / third still look unchanged;
- no scoring, out, speed, tag, or runner-control regression.

Automated PASS is not visual acceptance.

## 12. Required audit

Create:

```text
docs/audits/b0805_31_bounce_runner_slides.md
```

Include:

- exact base SHA and final implementation SHA;
- changed files;
- exact restitution curve and why;
- b29 versus b31 entitled-double distribution;
- bounce-apex table by impact band;
- head-first pose before / after and renderer-space clearance result;
- return-slide and facing contract;
- exact tests and counts;
- mutation results;
- browser / visual limitations;
- remaining uncertainties;
- negative findings and failed approaches.

Important knowledge must not remain only in the Codex final response.

## 13. Definition of Done

Done only when all are true:

1. implementation is based exactly on `60b993b...`;
2. `BUILD === 'b0805-31'`;
3. batted high-fly bounce uses a continuous, impact-dependent response;
4. throw physics is unchanged or any minimal change is explicitly justified and tested;
5. entitled doubles remain possible but are materially less frequent in same-seed QA;
6. head-first first-base slide remains visibly above ground by renderer-consistent diagnostic;
7. all actual integer-base returns trigger head-first slide near the base;
8. return render-facing is reversed;
9. forward slide contracts are preserved;
10. no gameplay timing / speed / safe-out bonus is introduced;
11. dedicated and existing tests pass, with all required mutations detected;
12. audit is committed;
13. all changes are committed and pushed to `codex/b0805-31-bounce-runner-slides`;
14. no merge, PR, M1, P1, E1, F1, P2, or Issue #30 implementation is started.

After push, stop and report branch, final SHA, exact test results, entitled-double baseline/candidate counts, and the audit path.