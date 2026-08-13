# Claude Code task — b0805-30 Owner Closure Recovery R1a

Date: 2026-08-13
Repository: `L-carp55/baseball3d-game`
Tracking Issue: #33
Exact repair base: `5088aeefd0ee632282c36120185dcc97ff2fc880`
Create branch: `claude/b0805-30-owner-closure-r1a-classifier-compat`

## Purpose

R1 restored immutable contact-time `ball.battedType`, recorder population, and result-path usage, but Browser GPT independent red-team found one narrow semantic incompatibility.

Read first:

- `agent/research-baseball-motion-ai:docs/audits/b0805_30_owner_closure_r1_browser_redteam_20260813.md`
- R1 audit: `docs/audits/b0805_30_owner_closure_r1_batted_ball_identity.md` on the R1 branch
- R1 task: `docs/implementation/CLAUDE_B0805_30_OWNER_CLOSURE_R1_BATTED_BALL_IDENTITY_TASK_20260813.md`

Do not trust this task as proof; independently inspect current source.

## Blocking defect to reproduce independently

R1 physical classifier currently maps every 6–20° contact to `ライナー`:

```js
function classifyBattedBallPhysical(c){
  const la=c.la||0;
  if(la<=5) return 'ゴロ';
  if(la<=20) return 'ライナー';
  if(la<=45) return 'フライ';
  return 'ポップフライ';
}
```

Existing caught-air classifier is:

```js
function classifyCaughtBall(b){
  if(b.landed) return 'ゴロ';
  if((b.la||0)>45) return 'ポップフライ';
  if((b.la||0)<=20 && (b.maxZ||b.z||0)<22) return 'ライナー';
  return 'フライ';
}
```

Thus an airborne 15–20° high-apex contact can be `battedType='ライナー'` but `flyKind='フライ'` if caught. The physical identity should not depend on the catch outcome.

## Scope — R1a only

Repair only the compatibility between:

- immutable contact-time physical batted-ball identity; and
- existing airborne caught-ball physical category (`classifyCaughtBall` / `flyKind`).

Keep all successful R1 behavior:

- one immutable physical identity established at contact/startFlight;
- no dependency on `canCatchAir` or fielder reach;
- no mutation on landing;
- recorder `bt` populated;
- R1 result paths read preserved identity;
- 9° and 11° owner examples remain liners;
- ~1° and negative-angle examples remain ground balls;
- normal fly and popup remain distinct.

Do not touch R2, b29a, Issue #30, M1 Final Validation, or P1.

## Design requirement

Do not solve this by changing `classifyCaughtBall()` to blindly mirror the current angle-only R1 classifier unless you can independently prove that doing so is the intended existing game semantic. Existing caught semantics use both launch angle and physical apex (`maxZ<22`) for the liner/fly boundary.

Preferred direction:

- define one shared **physical category contract**;
- determine contact-time category from physical contact inputs only (for example exit velocity, launch angle, and a deterministic field-independent predicted trajectory/apex if needed);
- make caught-air labeling and contact-time labeling agree for the same physical trajectory where applicable.

A field-independent trajectory prediction is allowed. A defender-reach prediction is not.

Do not use `canCatchAir`, primary fielder, route probability, catch success, or result outcome to classify the physical contact.

## Required compatibility cases

At minimum pin and execute:

1. negative angle -> `ゴロ`
2. about 1° -> `ゴロ`
3. 9° low-apex owner case -> `ライナー`
4. 11° low-apex owner case -> `ライナー`
5. a 15–20° **high-apex** physically plausible contact for which existing caught semantics classify `フライ` -> physical identity must also be `フライ`
6. ordinary mid/high fly -> `フライ`
7. popup -> `ポップフライ`
8. for representative airborne contacts, contact-time physical type and caught-air physical category agree when evaluated against the same trajectory/apex

Do not merely test synthetic classifier arguments. Include at least one real `startFlight`/physics fixture for the high-apex overlap case.

## Mutation requirement

Add a mutation that recreates the current R1 defect:

- `M-R1A-COMPAT-1`: classify every `la<=20` airborne/non-ground contact as `ライナー` regardless of physical apex.

The unmutated baseline must pass and this mutation must fail the new cross-classifier compatibility contract.

Existing R1 mutations must remain killed.

## Regression requirements

Run the same R1 required regressions and focused/mutation suites. No new browser failures beyond the known stale `test27_投球モーション時系列` failure.

Do not modify test27 or CMU motion.

## Audit

Create:

`docs/audits/b0805_30_owner_closure_r1a_classifier_compat.md`

Include:

- exact repair base and implementation SHA;
- independent reproduction of the incompatibility before editing;
- exact shared physical classification contract;
- how contact-time apex/trajectory information is obtained without defender state;
- cross-classifier cases/results;
- mutation outcome;
- all R1 regression outcomes;
- browser before/after exact failure set;
- unresolved limitations.

## Stop condition

Commit and push R1a, then stop.

Do not create a PR.
Do not merge.
Do not start R2.
Do not resume M1 Final Validation.
Do not start P1.

Browser GPT will independently review R1a before R1 is approved.