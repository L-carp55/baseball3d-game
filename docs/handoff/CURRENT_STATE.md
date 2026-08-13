# Baseball3D CURRENT STATE

Last updated: 2026-08-13
Authority: current GitHub remote + independent audits. If an older chat, PR body, Issue body, or status doc conflicts with this file, verify the remote code/ancestry and prefer the newer audit.

## Canonical gameplay ancestor

- branch: `agent/b0805-29-possession-footwork`
- SHA: `60b993b73fed854934a976e45e8feb9437deb584`
- BUILD: `b0805-29`
- Draft PR: #23
- status: not merged

## Owner-played current line

- observed BUILD from 2026-08-13 recording: `b0805-30`
- current CMU R2 code line: `codex/b0805-30-pitch-motion-bank-cmu124-r1@05a4d7968e3952050f891351e964e3b2b6b1ea66`
- final-validation task branch: `claude/b0805-30-m1-final-validation@8f0f389f637fe892c7b7356fc12361937a94fb08`
- status: **M1 Final Validation PAUSED pending owner-feedback recovery**

## Current critical path

**Issue #33 Owner Feedback Closure Recovery**

Do not proceed to P1 while Issue #33 is open at the recovery gate.

Recovery order:

1. R1 — restore lost b24 batted-ball identity/live-play integrity contract against the real current line.
2. R2 — port the three b29a owner fixes onto the same owner-validation line.
3. R3 — implement Issue #30 root systems.
4. R4 — create one integrated owner-verification build and obtain owner replay/visual acceptance.
5. Then resume M1 Final Validation and later P1/E1 sequencing.

## Critical newly discovered ancestry defect

Historical PR #17 / b0805-24 is **NOT an ancestor** of the current b25→b26→b28→b29→b30 line.

Facts:

- b25 implementation commit `c51eee353569dfcee00434f9e837bacafe4be7f2` has parent b23 `a6ed22b0da133c00c9120261d7d45847cd37562b`.
- PR #20 base is b23.
- current b24 branch `agent/b0805-24-batted-ball-rundown-integrity@e50b5c326feb74ccff855fd355c2d1d304fd07be` is a failed/payload reconstruction branch, not a clean game implementation.
- compare b24→b29 is diverged with merge base b23.

Consequences:

- do not merge historical b24;
- do not trust PR #17 prose as proof of current implementation;
- re-implement required b24 contracts from current source with new focused regression/mutation tests.

The clearest current symptom is `ball.battedType`: b30 recorder reads it, but production has no writer; the 2026-08-13 owner recording reports blank `bt` for all frames.

## Parallel owner-fix branch

- branch: `agent/b0805-29a-entitled-slide-fixes`
- head: `411255ac1aa2258fe60047a12cbb5698ff22aa73`
- Draft PR: #32
- automated status: 51/51 PASS + focused mutations
- owner status: visual verification pending
- integration status: **NOT in b0805-30**

Contains:

- trajectory-dependent first bounce for high flies;
- head-slide ground-clearance fix;
- head-first slides on returns.

Issue #31 body is stale; its comment now points to PR #32.

## Open owner-feedback structural work

Issue #30 remains NOT IMPLEMENTED for the main root systems:

- RunnerContact / TagEvent;
- multi-leg relay / complete ThrowRoute;
- HOLD_BALL;
- chase + cover joint assignment;
- FieldingExecution / BallPossession;
- rundown receive/transfer;
- stationary-ball retarget and removal of time-only possession;
- run-through pickup / athletic scoop;
- foul-side wall topology;
- geometric RundownAdmission;
- possession-to-display lifecycle.

Additional confirmed relay-loop recording:

`1B -> 2B -> RF -> 2B -> RF -> 2B -> RF -> P`

The current `throwCount > 6 -> P` escape is not considered a repair.

## What is confirmed to survive in b0805-30

Examples independently checked in production source:

- b11 caught-ball `classifyCaughtBall` and `flyKind` display path;
- duplicate final-message suppression;
- routine chest-height fly waiting;
- position-specific fielder ready poses;
- horizontal-only ground dive amount for the old high-bounce dive defect;
- RunnerIntent + `manualIntentLocked`;
- DefenseActionPolicy / ThrowDecision framework;
- b26 `doublePlayContinuation`;
- b28 `beginBreakaway` and transfer contexts;
- b29 `prepareThrowerFootwork`.

The 2026-08-13 owner recording directly shows the b29 transfer-footwork mechanism working in one second-base ground-ball sample.

## Owner feedback acceptance rule

An item is CLOSED only when all applicable states are true:

- IMPLEMENTED
- INTEGRATED into the owner-playable line
- AUTOMATED VERIFIED with a mutation recreating the old mechanism
- OWNER VERIFIED on that integrated build

Do not call an item closed solely from a PR body, CI success, or audit prose.

## Current audit authority

- `docs/audits/owner_feedback_closure_matrix_20260813.md`
- audit commit: `978c2779c615c2af3babc2a325bdacb280eed165`
- tracking Issue: #33

## Do not do now

- do not merge the historical b24 branch;
- do not blindly merge PR #32 into the CMU branch;
- do not start P1;
- do not start E1/F1/P2 independently of the owner-closure recovery plan;
- do not mark Issue #30 closed based on architectural research alone;
- do not mark M1 complete before full owner visual acceptance;
- do not treat old status docs as current if they predate this file.
