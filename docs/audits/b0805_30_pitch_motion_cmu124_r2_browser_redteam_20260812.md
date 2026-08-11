# b0805-30 CMU124 pitch motion — M1 R2 independent browser red-team

Date: 2026-08-12 JST
Reviewer role: browser ChatGPT independent red-team
Implementation branch: `codex/b0805-30-pitch-motion-bank-cmu124-r1`
Repair base: `8599274e7be1ec2cf0d7b12570dd351d51c2b0a4`
Implementation SHA: `ab81c9d2a8b67ba2404ae496d262d3a42266f406`
Remote audit/head: `05a4d7968e3952050f891351e964e3b2b6b1ea66`

## Verdict

- **R2-F3: APPROVED**
- **R2-F5: APPROVED**
- **R2 scope overall: APPROVED**
- **M1 overall: NOT YET MERGE-READY**
- Next gate: M1 final validation only — migrate stale browser `test27` to the CMU motion contract and complete full visual QA. Do not proceed to M1.1/P1/E1/F1/P2 yet.

## Remote/diff verification

GitHub compare `8599274... -> ab81c9d...` shows one implementation commit. Code changes are limited to:

- `baseball3d.html`
- `_test_pitch_motion_bank_cmu124_20260811.js`
- `_r2_mutation_check_20260811.js`

The R2 audit document is also added in that commit. `ab81c9d... -> 05a4d796...` changes only the audit document by three lines. Remote branch head is exactly `05a4d796...`. No PR exists for this branch.

## F3 independent code review

`drawFigure()` now calls:

```js
const T = buildFigurePoseTransforms(fx, fz, face, runDist, scale, speed01, pose);
const {P, s, sp, ph, sw, aw, bob, lean, hipY, shY, KNEE, ELB, split, base, pelvis, body} = T;
```

The previous inline construction of `base / pelvis / torso / body` is absent from `drawFigure()`. Both legacy non-split and CMU split transforms live in `buildFigurePoseTransforms()`. Arm/leg segments continue through the shared `composeFigureSegment()` path. This closes the R1 failure mode where QA and the real renderer could drift while retaining matching formulas temporarily.

The QA endpoint helper also calls `buildFigurePoseTransforms()` and `composeFigureSegment()`, so renderer body transform and diagnostic hand transform now share the same kinematic path.

No new F3 blocker found.

## F5 independent test review

The focused contract now strips comments before checking the helper call, preventing comment-only compliance. It checks both renderer and QA helper use, destructured shared fields, absence of known duplicated transform signatures, and presence of legacy/split branches inside the helper.

`_r2_mutation_check_20260811.js` independently creates temporary mutants and asserts production SHA remains unchanged. The six mutants cover:

1. exact R1 duplicated renderer transform;
2. QA helper / renderer bypass split;
3. segment-helper-only sharing;
4. comment-only helper name;
5. helper call plus a second adjacent body computation;
6. deletion of the legacy non-split helper branch.

The mutations are real source changes and, by inspection, each targets a distinct R2 contract. The runner counts any test failure as a kill, but the constructed mutations do not depend on runtime execution of `drawFigure()` and are expected to fail the intended structural assertions. This is adequate for the scoped regression guard. It is not a formal proof against arbitrary future reimplementations, which is acceptable for this milestone.

No new F5 blocker found.

## Browser regression finding

The reported `50/51` browser baseline is consistent with the current source and is **not introduced by R2**. R2 changes only `drawFigure()` sharing and R2 tests; `pitcherPose()` and the CMU profile behavior are unchanged from R1.

The failing browser harness `test27_投球モーション時系列` is stale relative to M1 in three material ways:

1. It hard-codes the old right-arm release heuristic `releaseBefore.elbowR < 0.8`, while the CMU profile is mirror-aware and currently uses `defaultRigThrowSide='L'`. A fixed `elbowR` threshold is no longer the release authority.
2. It manually sets `S.phase='pitch'; pitch={t:0}` without executing the production release transition. Current `pitcherPose()` intentionally requires `anim.pitchMotionReleased`, which `beginPitchMotion()` sets.
3. It advances `pitch.t` to judge follow-through and recovery. M1 explicitly moved the post-release visual track to `anim.pitchMotionPostSec` so animation duration is independent of pitch-flight duration/type.

Therefore the next repair should **migrate test27 to the new production contract**, not deform the CMU release pose merely to satisfy the old hand-authored thresholds.

Recommended replacement browser contract:

- exercise the real release transition (`launchPitch()` / `beginPitchMotion()` path rather than manually fabricating `S.phase='pitch'`);
- assert release-boundary pose continuity across that transition;
- assert `anim.pitchMotionReleased === true` and post sampling uses `anim.pitchMotionPostSec`;
- use throw-side-aware geometric criteria / actual hand-to-release distance instead of fixed `elbowR`;
- verify post-release source-event progression and eventual ready adapter;
- verify live batted-ball/fielding handoff still supersedes pitch animation.

This should restore a meaningful `51/51` baseline without weakening the regression suite.

## Visual QA gate

R2 audit honestly records only one inspected rendered frame (MER) plus numeric/live-frame checks for eight events. Because the first M1 candidate previously looked severely scrambled despite passing automated tests, M1 should not be declared visually complete until all representative events are inspected reliably:

- set
- knee rise
- SFC
- MER
- release
- early follow-through
- late follow-through
- ready

Use a temporary capture harness if necessary (`preserveDrawingBuffer` in a temp copy and the real `frame()` loop is a reasonable path), do not commit bulk capture data, and do not count identical/blank screenshots as evidence.

## Independent execution limitation

The browser reviewer attempted to clone the public repository into its execution container for a second local run, but outbound DNS to `github.com` is unavailable in that container. Therefore the reviewer does **not** claim an independent rerun of Node/Chrome commands. Approval is based on direct GitHub remote/diff inspection, implementation source review, test/mutation source review, and independent inspection of the browser harness/current `pitcherPose()` contract.

## Next milestone

Create a narrow **M1 final-validation** change from `05a4d796...`:

1. update only the stale browser OI-245/test27 contract to exercise M1 production semantics;
2. run unchanged broader browser regression and require a meaningful `51/51` plus all architecture/behavioral mutations;
3. complete eight-event visual inspection;
4. do not tune the motion merely to satisfy the legacy test unless visual/geometry evidence independently says the pose is wrong;
5. if the full visual gate passes, mark M1 `READY_FOR_OWNER_PLAYTEST`; otherwise open a narrowly scoped motion-tuning repair.

Do not merge or proceed to M1.1/P1/E1/F1/P2 before this validation gate.