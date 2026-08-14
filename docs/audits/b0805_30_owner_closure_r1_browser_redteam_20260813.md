# b0805-30 Owner Closure R1 — Browser GPT independent red-team

Date: 2026-08-13
Reviewer: Browser GPT
Repository: `L-carp55/baseball3d-game`
Implementation branch: `claude/b0805-30-owner-closure-r1-batted-ball-identity`
Task commit: `9e007df92c8bf56673ee15e842e259d74d7972c4`
Implementation commit: `bee15b6594498ef91440b9629604cdac18430c6d`
Remote head reviewed: `5088aeefd0ee632282c36120185dcc97ff2fc880`
Repair base: `05a4d7968e3952050f891351e964e3b2b6b1ea66`

## Verdict

**R1: BLOCKED FOR ONE NARROW SEMANTIC REPAIR (R1a).**

The core recovery is real and well-scoped, but the new physical classifier is not fully compatible with the existing caught-ball classifier. Do not start R2 yet.

## What independently passed

- Remote branch head is `5088aeef...`; its parent is implementation `bee15b65...`.
- `9e007df... -> 5088aeef...` is exactly 2 commits and exactly 4 changed files:
  - `_r1_batted_ball_mutation_check_20260813.js`
  - `_test_batted_ball_identity_recovery_20260813.js`
  - `baseball3d.html`
  - `docs/audits/b0805_30_owner_closure_r1_batted_ball_identity.md`
- Follow-up `5088aeef...` changes only the audit SHA line.
- Production now has one construction-time physical identity write:
  `battedType: classifyBattedBallPhysical(c)` inside `startFlight()` before `planPlay(ball)` / `canCatchAir` assignment.
- Current production contains 5 `battedType` references and no later `ball.battedType = ...` writer. The immutable identity boundary is therefore genuinely present in the reviewed source.
- Recorder `bt:ball.battedType||''` is now fed by a real production value.
- The three batted-ball-type result wording paths found by R1 now read preserved `battedType` with a ground fallback.
- The implementation diff does not touch M1 pitch functions, RunnerIntent, FieldingAssignment, ReachModel, DefenseActionPolicy, force-chain, breakaway, possession footwork, b29a, or Issue #30 systems.
- Focused test is meaningful: it calls the real `startFlight()/update()/concludePlay()/resolveHit()` path in headless Chrome and checks landing persistence, recorder output, and result wording.
- Mutation runner executes the focused contract against temporary mutated HTML copies and verifies production SHA unchanged. The six required mutations are represented.
- The implementation audit reports the required focused/regression commands PASS and the same pre-existing browser `test27_投球モーション時系列` failure before/after. Browser GPT did not independently execute the local Windows/Chrome commands; this red-team approval is based on remote source/diff/test-code inspection, not on trusting the PASS labels alone.

## Blocking finding — physical/caught classification can disagree for the same airborne contact

R1 introduced:

```js
function classifyBattedBallPhysical(c){
  const la = c.la||0;
  if(la<=5) return 'ゴロ';
  if(la<=20) return 'ライナー';
  if(la<=45) return 'フライ';
  return 'ポップフライ';
}
```

Existing production `classifyCaughtBall(b)` remains:

```js
function classifyCaughtBall(b){
  if(b.landed) return 'ゴロ';
  if((b.la||0)>45) return 'ポップフライ';
  if((b.la||0)<=20 && (b.maxZ||b.z||0)<22) return 'ライナー';
  return 'フライ';
}
```

Therefore an airborne contact with `la=20` and `maxZ>=22` is:

- physical `battedType`: `ライナー`
- existing caught-ball `flyKind`: `フライ`

The same mismatch exists for any 6–20° contact whose trajectory rises to 22ft or more. This is not an exotic impossible input: `startFlight()` uses `vz = exit*1.467*sin(la)`, so high-exit 15–20° contacts can readily produce substantially higher arcs than 22ft before considering the game's spin model.

This matters because R1's purpose is an immutable **physical** identity. The current implementation can label the same physical contact differently solely depending on whether it is caught before landing (`classifyCaughtBall`) or survives into the infield result path (`battedType`). That is not a stable single identity contract.

## Why the current focused test misses it

The test correctly pins:

- physical 20° -> `ライナー`;
- existing caught-ball examples including a 12° / maxZ 6.5 liner and a 32° fly;
- byte identity of `classifyCaughtBall()`.

But it never cross-checks the two classifiers on an overlapping high-arc 6–20° contact. Byte-preserving the old classifier proves it was not accidentally edited; it does **not** prove semantic compatibility with the newly introduced classifier.

This is a test gap relative to task §5 assertion 8: `existing caught-ball classifyCaughtBall / flyKind behavior remains compatible`.

## Required R1a repair

Keep all successful R1 behavior, but make contact-time physical identity and airborne caught-ball classification semantically compatible.

Requirements:

1. Do not re-couple identity to `canCatchAir` or any fielder reach result.
2. Do not rewrite identity after landing.
3. Preserve owner pins:
   - negative angle -> ground
   - ~1° -> ground
   - 9° -> liner
   - 11° -> liner
   - normal fly -> fly
   - popup -> popup
4. Preserve existing caught-air semantics unless a deliberate shared-contract change is justified and regression-tested.
5. Add a cross-classifier compatibility test over overlapping airborne contacts, including at least:
   - low-apex 9°/11° liner cases;
   - a 15–20° high-apex contact that existing caught semantics call `フライ`;
   - fly/popup boundaries.
6. The physical classifier may use contact-time physical inputs such as exit velocity / launch angle and a deterministic field-independent trajectory/apex prediction. It must not use defender feasibility.
7. If a shared classification helper is introduced, both contact-time identity and caught-air labeling should derive from the same physical categorization contract where applicable.
8. Add a mutation that restores the current R1 bug (all <=20° always liner) and require the new compatibility test to kill it.
9. No R2, Issue #30, b29a, M1 Final Validation, or P1 changes.

## Stop condition

R1 remains not approved until R1a is independently reviewed. After R1a passes, proceed to Recovery R2.