# TASK — b0805-30 Owner Closure Recovery R1b

Date: 2026-08-13
Worker-neutral task; intended worker: **Grok Build**
Repository: `L-carp55/baseball3d-game`
Exact repair base: `de8dcd6175ed866a9f96f5768c228eec1b53fb6d`
Create branch: `agent/b0805-30-owner-closure-r1b-contact-height-compat`
Tracking Issue: #33

## 0. Purpose

R1 restored immutable batted-ball physical identity. R1a correctly unified the liner/fly angle/apex category table, but Browser GPT independent red-team found that R1a predicts apex from a **fixed 1.4 ft initial height** while production `startFlight()` launches from variable `from[1]` (`Math.max(1.2,pitch.ty)` in normal batting).

Because liner/fly uses an absolute 22 ft apex boundary, contact-time classification is not yet guaranteed to describe the same physical trajectory as the ball that production actually launches.

Read first:

- `agent/research-baseball-motion-ai:docs/audits/b0805_30_owner_closure_r1a_browser_redteam_v2_20260813.md`
- R1a audit on repair base: `docs/audits/b0805_30_owner_closure_r1a_classifier_compat.md`
- R1a task: `agent/research-baseball-motion-ai:docs/implementation/CLAUDE_B0805_30_OWNER_CLOSURE_R1A_CLASSIFIER_COMPAT_TASK_20260813.md`
- `agent/research-baseball-motion-ai:docs/handoff/CURRENT_STATE.md`

Do not trust prose as proof; independently inspect the exact base code and reproduce the mismatch mechanism.

## 1. Scope — R1b only

Repair only the missing **launch/contact height** input in the contact-time physical trajectory/classification contract.

Preserve all successful R1/R1a behavior:

- immutable `ball.battedType` established at contact;
- no `canCatchAir`/fielder/catch-result dependency;
- no reclassification on landing;
- recorder `bt` populated;
- result paths read preserved identity;
- shared `categorizeAirborneByAngleApex(la, apexZ)` contract;
- caught-air semantics unchanged;
- R1 owner pins remain valid;
- high-apex 15–20° overlap case remains fixed.

Do not touch b29a, Issue #30 root systems, M1 Final Validation, or P1.

## 2. Baseline defect to confirm

Current R1a predictor:

```js
function predictBattedBallApexFt(c){
  ...
  const b={x:0,y:0,z:1.4,...};
```

Current real launch:

```js
ball={x:from[0], y:from[2], z:from[1], ...,
  battedType: classifyBattedBallPhysical(c) };
```

Normal batting calls:

```js
startFlight(c, ..., [pitch.tx, Math.max(1.2,pitch.ty), 1.4]);
```

Independently confirm that physical type can be based on a different initial z than the actual launched ball. Do not assume the exact threshold-adjacent fixture in advance; search systematically over plausible contact values if needed.

## 3. Design contract

The physical classification must be based on the same relevant initial physical state as the real `startFlight()` trajectory.

A suitable shape is conceptually:

```js
predictBattedBallApexFt(contact, launchZ)
classifyBattedBallPhysical(contact, launchZ)
```

and inside `startFlight()`:

```js
battedType: classifyBattedBallPhysical(c, from[1])
```

Exact API naming is your choice.

Requirements:

- actual launch/contact height is explicit;
- do not read global `pitch` from inside the physical classifier;
- do not read defenders or `canCatchAir`;
- do not derive launch height from result state;
- do not silently use a default in the production `startFlight()` call when the actual height is known;
- keep the classifier deterministic and testable.

If a safe default is retained for isolated/helper callers, production must still pass the real launch height explicitly and tests must cover that production wiring.

## 4. Same-trajectory compatibility requirement

For representative airborne contacts, test this invariant:

1. initialize/launch through the real `startFlight(c, ..., from)`;
2. record contact-time `ball.battedType`;
3. independently step a clone of the **same initial ball state** with real `stepBall()` to obtain actual physical apex before landing;
4. compute `categorizeAirborneByAngleApex(c.la, actualApex)`;
5. require equality with the contact-time `ball.battedType`.

Run this at multiple launch heights, not only one fixed height.

At minimum include:

- low contact height around 1.2–1.5 ft;
- normal/mid contact height around 2.5 ft;
- high contact height around 3.3–3.5 ft;
- one threshold-adjacent 6–20° contact where restoring fixed `z=1.4` would produce a classification mismatch.

The threshold-adjacent case must be physically plausible. Find it via deterministic sweep/probe if necessary; document the selected exit/la/startZ and both apex values.

## 5. Existing category pins

Re-verify all prior pins:

- negative-angle grounder -> `ゴロ`
- about 1° ground-type contact -> `ゴロ`
- 9° low-apex owner case -> `ライナー`
- 11° low-apex owner case -> `ライナー`
- R1a 15–20° high-apex case -> `フライ`
- normal mid/high fly -> `フライ`
- popup -> `ポップフライ`

Do not move category thresholds to hide the height bug.

## 6. Mutation detection — mandatory

Keep all 7 existing R1/R1a mutations killed and add:

### M-R1B-HEIGHT-1

Recreate the defect by ignoring the supplied production launch height and forcing the apex predictor/classifier to use fixed `z=1.4`.

The new threshold-adjacent same-trajectory test must kill this mutant.

Prefer a mutation that passes all non-boundary cases so it proves the suite specifically detects launch-height compatibility, not merely syntax/structure.

Unmutated baseline must pass first. Production file must remain byte-identical before/after mutation runs.

## 7. Production wiring test

Add a structural assertion that `startFlight()` passes its real `from[1]` (or equivalent explicit actual launch z) into physical classification.

Also add behavioral browser fixtures proving different `from[1]` values reach the classifier and preserve same-trajectory agreement.

## 8. Regression requirements

Run at minimum the same R1/R1a required suites:

- syntax checks;
- architecture guard;
- M1 pitch-motion focused contract;
- R2 mutation check;
- b29 thrower-footwork;
- b28 breakaway/transfer-context;
- RunnerIntent;
- FieldingAssignment;
- ReachModel;
- DefenseActionPolicy;
- force-chain;
- runner-controls/sliding;
- updated batted-ball identity focused test;
- updated mutation runner;
- browser baseline before/after.

No new browser failures beyond the already-known stale `test27_投球モーション時系列` mismatch.

Do not modify test27 or CMU motion.

## 9. Audit

Create:

`docs/audits/b0805_30_owner_closure_r1b_contact_height_compat.md`

Include:

- exact base SHA;
- implementation/final SHA;
- exact changed files;
- independent reproduction of the fixed-height defect;
- exact threshold-adjacent fixture found;
- classifier/predictor API contract;
- evidence production passes real launch height;
- multiple launch-height same-trajectory comparisons;
- all 8 mutation outcomes;
- full regression commands/results;
- browser before/after failure set;
- failed attempts;
- unresolved limitations.

## 10. Branch and worker migration rules

Use the vendor-neutral branch:

`agent/b0805-30-owner-closure-r1b-contact-height-compat`

Do not create a `grok/` branch prefix.

The GitHub repository/task state is authoritative over Claude Code chat history. This is the first implementation task after migration of the primary worker role to Grok Build.

## 11. Stop condition

Commit and push R1b, then STOP.

Do not create a PR.
Do not merge.
Do not start R2.
Do not resume M1 Final Validation.
Do not start P1.
Do not start Unity U0 in the same task.

Browser GPT will independently review the remote R1b diff. If approved, the next single task becomes Unity U0 bootstrap using `docs/unity/TASK_UNITY_U0_BOOTSTRAP_20260813.md`.
