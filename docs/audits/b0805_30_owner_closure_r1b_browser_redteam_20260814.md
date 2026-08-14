# b0805-30 Owner Closure R1b — Browser GPT independent red-team

Date: 2026-08-14
Repository: `L-carp55/baseball3d-game`
Reviewed branch: `agent/b0805-30-owner-closure-r1b-contact-height-compat`
Reviewed final HEAD: `33b5518a3eb9e76e6525dc7e23556c55ed88ec5d`
Implementation commit: `4d1b9f039b3f6028f31290eb1f69848890539700`
Exact base: `de8dcd6175ed866a9f96f5768c228eec1b53fb6d`
Verdict: **APPROVE R1b implementation candidate**

## 1. Remote/ancestry verification

GitHub remote independently confirms:

- branch HEAD is `33b5518a3eb9e76e6525dc7e23556c55ed88ec5d`;
- its parent is implementation commit `4d1b9f039b3f6028f31290eb1f69848890539700`;
- compare R1a HEAD -> R1b HEAD is `ahead`, 2 commits, merge-base exactly R1a HEAD;
- changed files are limited to:
  - `baseball3d.html`;
  - `_test_batted_ball_identity_recovery_20260813.js`;
  - `_r1_batted_ball_mutation_check_20260813.js`;
  - `docs/audits/b0805_30_owner_closure_r1b_contact_height_compat.md`.

The final `33b5518...` commit changes only the audit SHA line. No gameplay code is hidden in the follow-up commit.

## 2. Production repair review

R1b changes the physical classification interface to accept explicit launch height:

```js
function classifyBattedBallPhysical(c, launchZ){
  const la = c.la||0;
  if(la<=5) return 'ゴロ';
  return categorizeAirborneByAngleApex(la, predictBattedBallApexFt(c, launchZ));
}
```

The apex predictor accepts the same explicit launch height and uses it as initial z:

```js
function predictBattedBallApexFt(c, launchZ){
  const z0 = (launchZ==null ? 1.4 : +launchZ);
  ...
  const b={...,z:z0,...};
  ... stepBall(b,1/240) ...
}
```

Most importantly, production `startFlight()` does not rely on the helper default:

```js
ball={..., z:from[1], ...,
  battedType: classifyBattedBallPhysical(c, from[1]) };
```

This repairs the exact R1a-F2 defect: contact-time classification now receives the same actual launch z that the real ball receives.

No global `pitch`, fielder reach, `planPlay`, or `canCatchAir` is introduced into the physical classifier/predictor.

## 3. Whole-file invariants checked remotely

Against final production `baseball3d.html`:

- exactly one production definition/call path for `classifyBattedBallPhysical` is present;
- the only production call is `classifyBattedBallPhysical(c, from[1])` in `startFlight()`;
- `battedType:` has one production initializer;
- there are zero `ball.battedType=` reassignments.

Therefore the R1 immutability contract still survives R1b.

## 4. Same-trajectory behavioral test quality

The permanent browser fixture does not merely compare two copies of the predictor.

`sameTrajectoryTrial()`:

1. calls real `startFlight({exit,la,spray:0}, 1, [0,startZ,1.4])`;
2. reads the resulting `ball.battedType`;
3. clones the real launched ball state (`x/y/z/vx/vy/vz/bs/ss`);
4. advances that clone with real `stepBall()`;
5. measures physical apex;
6. requires `categorizeAirborneByAngleApex(la, measuredApex)` to equal contact-time type.

Browser fixtures cover launch heights 1.2, 2.5 and 3.5 ft, including the threshold-adjacent 95 mph / 16 deg case.

The key browser assertions require:

- 95 mph / 16 deg / z=1.2 -> ライナー;
- 95 mph / 16 deg / z=2.5 -> フライ;
- 95 mph / 16 deg / z=3.5 -> フライ;
- changing only `from[1]` across the threshold changes the contact-time classification.

This directly exercises the production wiring that R1a lacked.

## 5. Threshold-adjacent defect detection

The implementation audit documents a systematic pre-edit search and chooses:

- `exit=95 mph`;
- `la=16 deg`;
- actual `startZ=2.5 ft`.

Reported real-stepBall apexes:

- fixed old z=1.4 -> 21.856 ft -> ライナー;
- actual z=2.5 -> 22.956 ft -> フライ.

This is well targeted to the absolute 22 ft category boundary rather than a far-from-boundary fixture that would pass both implementations.

## 6. Mutation review

`M-R1B-HEIGHT-1` specifically replaces:

```js
const z0 = (launchZ==null ? 1.4 : +launchZ);
```

with fixed:

```js
const z0 = 1.4;
```

It therefore recreates the exact R1a mechanism while leaving the production function signature and `from[1]` call visually intact. This is a good mutation because a merely structural `startFlight` assertion cannot kill it; the threshold-adjacent behavioral contract must do so.

The audit reports baseline PASS and 8/8 R1/R1a/R1b mutants killed, with production SHA unchanged by mutation execution.

## 7. Regression evidence

The implementation audit records PASS for the required focused architecture/gameplay suites and reports the browser before/after failure set as identical: only the already-known stale `test27_投球モーション時系列` mismatch remains.

There are no GitHub combined status checks attached to final HEAD, so Browser GPT did not treat CI metadata as independent proof. Review was based on remote committed source/diff plus the permanent tests/mutation mechanism and the worker's recorded command results.

The Browser GPT environment was not able to independently execute the local Chrome/Node regression commands against a fresh checkout; this is an environment limitation, not hidden evidence. Static/mechanism review found no blocker in the R1b diff.

## 8. Non-blocking semantic debt

The R1b implementation audit correctly notes an older semantic mismatch that R1b does not create:

- `classifyBattedBallPhysical` deliberately maps `la<=5` to `ゴロ` at contact;
- existing `classifyCaughtBall` can call an unlanded low-angle ball `ライナー`.

This means very-low-angle balls caught before touching ground can still have different contact-time `battedType` and caught-air display category.

This issue is **not a launch-height regression and is outside the explicit R1b scope**. Do not reopen another JS recovery subtask solely for this before the Unity feasibility gate. Carry it forward as an explicit Unity physical-category design/acceptance requirement so the new architecture chooses one coherent definition rather than silently inheriting the ambiguity.

## 9. Approval meaning

R1b is approved as an implementation candidate. This also clears the R1 -> R1a -> R1b Browser-GPT implementation-review gate for the recovered batted-ball identity work.

This does **not** mean Issue #33 or the owner-feedback item is CLOSED under the project's four-gate rule. The recovery is not merged/integrated into a single owner-playable line and has not received owner visual/gameplay verification.

Because the project is now evaluating Unity before spending more time duplicating structural repairs in JS, the next single task is Unity U0 bootstrap.

Do not start JS R2/R3 at this point unless the Unity adoption gate later fails or Browser GPT explicitly changes sequencing.
