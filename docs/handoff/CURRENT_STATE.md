# Baseball3D CURRENT STATE

Last updated: 2026-08-14
Authority: current GitHub remote + independent Browser GPT audits. If an older chat, PR body, Issue body, worker self-report, or status doc conflicts with this file, verify the remote code/ancestry and prefer the newer independent audit.

## Primary worker policy

New implementation work is vendor-neutral.

- primary implementation worker: **Grok Build**
- fallback/alternate worker: **Codex local/CLI**
- Browser GPT: architecture, task specification, independent remote red-team, milestone gate
- owner: gameplay/visual acceptance
- Claude Code: historical implementation worker only; do not start new tasks there unless explicitly reactivated

Unity worker policy:

- `docs/unity/AI_WORKER_POLICY_20260813.md`
- policy commit: `daf2a06dc7aa640db7d6dcc883c10eee5c90bb68`

Do not rely on Claude Code/Grok chat history for continuation. Git/task/test state is authoritative.

## Canonical gameplay ancestor

- branch: `agent/b0805-29-possession-footwork`
- SHA: `60b993b73fed854934a976e45e8feb9437deb584`
- BUILD: `b0805-29`
- Draft PR: #23
- status: not merged

## Owner-played JS line

Owner recording on 2026-08-13 confirmed BUILD `b0805-30`.

Underlying CMU R2 line:

- `codex/b0805-30-pitch-motion-bank-cmu124-r1@05a4d7968e3952050f891351e964e3b2b6b1ea66`

M1 Final Validation task branch:

- `claude/b0805-30-m1-final-validation@8f0f389f637fe892c7b7356fc12361937a94fb08`
- status: **PAUSED**

Do not resume M1 Final Validation or P1 while the Unity adoption gate is active.

## Owner Closure Recovery — R1 implementation-review gate passed

Tracking Issue: #33

The batted-ball identity recovery was completed through R1 -> R1a -> R1b. Browser GPT has now approved the implementation candidate through R1b.

This does **not** mean the owner-feedback item or Issue #33 is CLOSED. The project closure rule still requires integration into an owner-playable line and owner verification where applicable.

### R1 — lost b24 batted-ball identity recovery

Branch:

- `claude/b0805-30-owner-closure-r1-batted-ball-identity`
- implementation: `bee15b6594498ef91440b9629604cdac18430c6d`
- final HEAD: `5088aeefd0ee632282c36120185dcc97ff2fc880`

Recovered:

- `ball.battedType` established at contact;
- independence from `canCatchAir`;
- immutability through landing;
- recorder `bt` population;
- result paths using preserved identity;
- focused/mutation coverage.

R1 itself exposed the first compatibility gap and proceeded to R1a.

### R1a — shared angle/apex category contract

Branch:

- `claude/b0805-30-owner-closure-r1a-classifier-compat`
- implementation: `90514d7b592b63a993a1374eb6a905c9e4e38880`
- final HEAD: `de8dcd6175ed866a9f96f5768c228eec1b53fb6d`

Added:

- shared `categorizeAirborneByAngleApex(la, apexZ)`;
- field-independent `stepBall()` apex prediction;
- fix for the 105mph/18deg high-apex liner/fly mismatch;
- R1a mutation coverage.

Browser GPT then found that the predictor still assumed fixed initial z=1.4 instead of the actual production launch height, leading to R1b.

### R1b — actual contact-height compatibility — APPROVED

Branch:

- `agent/b0805-30-owner-closure-r1b-contact-height-compat`
- exact base: `de8dcd6175ed866a9f96f5768c228eec1b53fb6d`
- implementation: `4d1b9f039b3f6028f31290eb1f69848890539700`
- final HEAD: `33b5518a3eb9e76e6525dc7e23556c55ed88ec5d`

R1b makes actual launch height explicit:

- `classifyBattedBallPhysical(c, launchZ)`;
- `predictBattedBallApexFt(c, launchZ)`;
- production `startFlight()` passes `from[1]` directly;
- no global pitch/fielder/canCatchAir input is introduced;
- `battedType` remains initialized once and immutable.

Permanent browser fixtures launch real `startFlight()` balls at multiple heights (1.2/2.5/3.5 ft), clone the actual initial ball state, step it with real `stepBall()`, and require contact-time type to agree with the measured apex category.

Threshold-adjacent fixture:

- 95mph / 16deg;
- fixed old z=1.4 -> apex about 21.856ft -> ライナー;
- actual z=2.5 -> apex about 22.956ft -> フライ.

Mutation `M-R1B-HEIGHT-1` recreates fixed z=1.4 and is reported killed while the prior R1/R1a mutations remain killed (8/8 total).

Independent Browser GPT approval:

- `docs/audits/b0805_30_owner_closure_r1b_browser_redteam_20260814.md`
- audit commit: `3af9b45f0444b275060a17b7a8f4af99441bda71`

### Known non-blocking batted-ball semantic debt

Do not silently forget this in Unity:

- contact-time `classifyBattedBallPhysical` deliberately maps `la<=5` to `ゴロ`;
- existing caught-air `classifyCaughtBall` can label an unlanded very-low-angle ball `ライナー`.

This is older semantic ambiguity, not an R1b launch-height regression. Do **not** start another JS R1c before the Unity feasibility gate solely for this. Unity must choose and test one coherent physical-category definition.

## NEXT SINGLE TASK — Unity U0 Bootstrap

Unity technical spike is now unblocked.

Task:

- `docs/unity/TASK_UNITY_U0_BOOTSTRAP_20260813.md`
- task commit: `033281f28d72a6b280cdeccc7c4ed1cb0b71858e`

Worker policy:

- `docs/unity/AI_WORKER_POLICY_20260813.md`

Intended worker: **Grok Build**.

U0 rules:

- create a separate local Unity project/repository, suggested `baseball3d-unity`;
- initialize local Git and use `agent/unity-u0-bootstrap`;
- no GitHub remote in U0;
- create vendor-neutral `AGENTS.md` and Unity-side `docs/handoff/CURRENT_STATE.md`;
- establish Unity CLI/Editor automation callable by Grok Build or Codex through the same scripts;
- add real deterministic smoke tests;
- generate a minimal scene through automation;
- run bootstrap/tests/validation/build where installed modules permit;
- commit locally, leave worktree clean, then STOP;
- do not start U1 until Browser GPT reviews U0.

After U0 approval, U1 will implement one golden vertical slice based on the owner recording:

- approximately 91mph / 1deg / spray 19deg;
- routine second-base ground ball;
- 4-3 out;
- deterministic simulation + debug observability.

Unity is **not canonical yet**. Adoption decision comes after U0 + U1 + owner/Browser GPT gate.

## Strategic sequencing

1. **Unity U0** automation/bootstrap.
2. Browser GPT independent U0 review.
3. **Unity U1** one-play golden vertical slice.
4. Browser GPT + owner Unity adoption gate.
5. If Unity adoption PASS: JS remains reference/oracle; unresolved b29a/Issue #30 requirements migrate into Unity acceptance work rather than being automatically implemented twice.
6. If Unity adoption FAIL: return to JS owner-closure R2/R3.

Do not immediately implement JS R2/R3 now.

## Parallel b29a owner-fix candidate

- branch: `agent/b0805-29a-entitled-slide-fixes`
- head: `411255ac1aa2258fe60047a12cbb5698ff22aa73`
- Draft PR: #32
- automated status: focused checks + browser baseline reported PASS
- owner status: visual verification pending
- integration status: **NOT in b0805-30 / R1 line**

Contains candidate repairs for:

- excessive high-fly first bounce / ground-rule doubles;
- head-slide body sinking/disappearing;
- head-first return slides.

Do not merge automatically. If Unity adoption passes, use these as behavioral requirements/reference patches.

## Issue #30 structural owner feedback

Still **NOT IMPLEMENTED** in the owner-played JS line for the main root systems:

- RunnerContact / TagEvent;
- complete ThrowRoute / relay-progress / cycle prevention;
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

The current `throwCount > 6 -> P` escape is not a repair.

If Unity is adopted, these become explicit Unity acceptance requirements and must not be silently forgotten.

## Critical historical ancestry defect

Historical PR #17 / b0805-24 is **NOT an ancestor** of the current b25→b26→b28→b29→b30 line.

Facts:

- b25 implementation `c51eee353569dfcee00434f9e837bacafe4be7f2` has parent b23 `a6ed22b0da133c00c9120261d7d45847cd37562b`;
- PR #20 base is b23;
- historical b24 branch is not a trustworthy clean implementation source;
- compare b24→b29 diverges at b23.

Consequences:

- never merge historical b24 wholesale;
- use its prose only as requirements/history;
- verify real current source;
- permanent tests/mutations must guard recovered contracts.

## Confirmed surviving JS architecture/examples

Examples independently checked in b0805-30 lineage:

- RunnerIntent + `manualIntentLocked`;
- FieldingAssignment;
- ReachModel;
- DefenseActionPolicy / ThrowDecision;
- PlayLifecycle;
- b26 `doublePlayContinuation`;
- b28 breakaway and transfer contexts;
- b29 `prepareThrowerFootwork`;
- caught-ball `classifyCaughtBall` / `flyKind` path;
- routine chest-height fly waiting;
- horizontal-only ground-dive amount;
- position-specific fielder ready poses.

The 2026-08-13 owner recording directly showed b29 transfer-footwork working in one routine second-base ground-ball sample.

## Owner feedback acceptance rule

An item is CLOSED only when all applicable states are true:

- IMPLEMENTED
- INTEGRATED into the owner-playable line
- AUTOMATED VERIFIED with mutation/fixture recreating the old mechanism
- OWNER VERIFIED on that integrated build

Do not call an item closed solely from worker self-report, PR body, CI success, or audit prose.

Unity adoption does not erase unresolved owner feedback. It changes the implementation target.

## Current audit authority

- `docs/audits/owner_feedback_closure_matrix_20260813.md`
- `docs/audits/b0805_30_owner_closure_r1_browser_redteam_20260813.md`
- `docs/audits/b0805_30_owner_closure_r1a_browser_redteam_v2_20260813.md`
- `docs/audits/b0805_30_owner_closure_r1b_browser_redteam_20260814.md`
- tracking Issue: #33

## DO NOT do now

- do not resume Claude Code as primary worker;
- do not merge historical b24;
- do not merge PR #32 automatically;
- do not start JS R2/R3 before the Unity adoption gate unless Browser GPT explicitly changes the sequence;
- do not resume M1 Final Validation;
- do not start P1/E1/F1/P2;
- do not mark Issue #30 or Issue #33 closed;
- do not treat Unity as canonical before the U0/U1 adoption gate;
- do not create the Unity GitHub remote during U0;
- do not start U1 during the U0 task.
