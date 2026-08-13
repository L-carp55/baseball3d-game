# b0805-30 Owner Closure R1a — Browser GPT independent red-team v2

Date: 2026-08-13
Repository: `L-carp55/baseball3d-game`
Reviewed branch: `claude/b0805-30-owner-closure-r1a-classifier-compat`
Reviewed HEAD: `de8dcd6175ed866a9f96f5768c228eec1b53fb6d`
Implementation commit: `90514d7b592b63a993a1374eb6a905c9e4e38880`
Repair base: R1 final `5088aeefd0ee632282c36120185dcc97ff2fc880`

## Verdict

**R1a: BLOCKED FOR R1b — one narrow production-trajectory compatibility defect remains.**

The main R1/R1a architecture is directionally correct and should be preserved:

- immutable `ball.battedType` is established before defender reach/catch feasibility;
- `canCatchAir` is separate;
- result paths and recorder use the preserved identity;
- R1a extracted one shared `categorizeAirborneByAngleApex(la, apexZ)` contract;
- `classifyCaughtBall()` uses the shared table with measured apex;
- `classifyBattedBallPhysical()` uses a field-independent predicted apex;
- R1a added a mutation that recreates the angle-only defect.

However, the predicted trajectory is not yet the same physical trajectory that production `startFlight()` launches.

## Remote diff verified

`5088aeef... -> de8dcd61...` is exactly two commits and four changed files:

- `baseball3d.html`
- `_test_batted_ball_identity_recovery_20260813.js`
- `_r1_batted_ball_mutation_check_20260813.js`
- `docs/audits/b0805_30_owner_closure_r1a_classifier_compat.md`

The second commit only records the implementation SHA in the audit.

## Blocking finding R1a-F2 — launch height omitted from contact-time apex prediction

R1a production code currently predicts apex with a fixed initial height:

```js
function predictBattedBallApexFt(c){
  const v=(c.exit||0)*1.467, laRad=(c.la||0)*RAD;
  const b={x:0,y:0,z:1.4,vx:0,vy:v*Math.cos(laRad),vz:v*Math.sin(laRad),
    bs:clamp(((c.la||0)+6)/30,-0.4,1.1), ss:0};
  ...
}
```

But real production `startFlight()` launches from the supplied `from` position:

```js
function startFlight(c, powerMul, from){
  ...
  ball={ x:from[0], y:from[2], z:from[1], ...,
    battedType: classifyBattedBallPhysical(c) };
```

Normal batting calls use:

```js
startFlight(c, ..., [pitch.tx, Math.max(1.2,pitch.ty), 1.4]);
```

so real launch height is `Math.max(1.2,pitch.ty)`, not a constant 1.4 ft.

The R1a browser fixture itself calls:

```js
startFlight({exit,la,spray:0}, 1, [0, 2.5, 1.4]);
```

while its isolated physical prediction still assumes 1.4 ft. The selected 105mph/18deg fixture is far enough above the 22 ft boundary that both classifications are `フライ`, so the test does not detect the input mismatch.

This matters because the shared liner/fly boundary is an **absolute apex height of 22 ft**. A roughly 1–2 ft launch-height error can flip contacts near that threshold. Therefore the same real trajectory can still be classified from a different predicted trajectory at contact time.

This violates the R1a task requirement that contact-time identity and caught-air identity agree **for the same physical trajectory/apex**.

## Why this is not a defender-state problem

Passing the actual launch/contact height into the field-independent trajectory predictor does not couple classification to a fielder or result. It is part of the batted ball's initial physical state, just like exit velocity and launch angle.

R1b should preserve the separation from:

- `canCatchAir`
- `planPlay`
- primary fielder
- reach probability
- catch success
- result outcome

while making the initial trajectory state complete.

## Test gap

The R1a focused suite checks:

- the 105mph/18deg overlap case;
- shared categorization;
- R1 owner pins;
- one real `startFlight()` high-apex fixture.

But `apexOnlyTrial()` launches that fixture at `from[1]=2.5` while comparing it to a predictor initialized at 1.4, and the assertion only compares the resulting category on a non-boundary case. It does not require predicted apex to match the same real launch-height trajectory or sweep/pin a threshold-adjacent case at different launch heights.

## Required R1b closure

R1b must:

1. make contact-time apex prediction receive/use the actual production launch height (or otherwise prove an exactly equivalent same-trajectory formulation);
2. call the physical classifier from `startFlight()` with the relevant physical initial state;
3. preserve immutable `battedType` and all R1/R1a semantics;
4. add at least one threshold-adjacent physically plausible case where ignoring launch height is killed;
5. add a mutation that restores a fixed launch height and prove the focused contract kills it;
6. verify representative `startFlight` contacts at multiple launch heights against their actual measured `stepBall()` apex/category;
7. keep all prior R1/R1a mutations killed and introduce no new browser regression beyond stale test27.

## Local independent rerun limitation

Browser GPT attempted a clean external clone for an additional local rerun, but the audit container could not resolve `github.com` DNS. Therefore this review is based on remote GitHub code/diff/test/audit inspection plus direct cross-check of production call sites. This limitation does not affect the launch-height finding, which is visible directly in the committed source.

## Scope decision

Do not start R2, Issue #30 implementation, M1 Final Validation, or P1 yet.

The next single JS recovery task is R1b. It is suitable as the first Grok Build implementation task after the worker migration.
