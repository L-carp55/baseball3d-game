# Baseball3D CURRENT STATE

Last updated: 2026-08-13
Authority: current GitHub remote + independent Browser GPT audits. If an older chat, PR body, Issue body, worker self-report, or status doc conflicts with this file, verify the remote code/ancestry and prefer the newer independent audit.

## Primary worker policy

New implementation work is now vendor-neutral.

- primary implementation worker: **Grok Build**
- fallback/alternate worker: **Codex local/CLI**
- Browser GPT: architecture, task specification, independent remote red-team, milestone gate
- owner: gameplay/visual acceptance
- Claude Code: historical implementation worker only; do not start new tasks there unless explicitly reactivated

Unity worker policy:

- `docs/unity/AI_WORKER_POLICY_20260813.md`
- policy commit: `daf2a06dc7aa640db7d6dcc883c10eee5c90bb68`

Do not rely on Claude Code chat history for continuation. Git/task/test state is authoritative.

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

Do not resume M1 Final Validation or P1 while owner-feedback recovery / Unity adoption gate is active.

## Owner Closure Recovery — current exact state

Tracking Issue: #33

### R1 — lost b24 batted-ball identity recovery

Branch:

- `claude/b0805-30-owner-closure-r1-batted-ball-identity`
- implementation: `bee15b6594498ef91440b9629604cdac18430c6d`
- final HEAD: `5088aeefd0ee632282c36120185dcc97ff2fc880`

R1 successfully restored the core boundary:

- `ball.battedType` exists at contact;
- it is independent of `canCatchAir`;
- it is immutable through landing;
- recorder `bt` is populated;
- relevant result paths read preserved identity;
- focused/mutation coverage was added.

R1 was not finally approved because Browser GPT found an R1/R1a compatibility problem in liner/fly semantics.

### R1a — shared angle/apex category contract

Branch:

- `claude/b0805-30-owner-closure-r1a-classifier-compat`
- implementation: `90514d7b592b63a993a1374eb6a905c9e4e38880`
- final HEAD: `de8dcd6175ed866a9f96f5768c228eec1b53fb6d`

R1a correctly:

- extracted shared `categorizeAirborneByAngleApex(la, apexZ)`;
- kept caught-air behavior compatible;
- added field-independent `stepBall()` apex prediction;
- fixed the 105mph/18deg high-apex overlap case;
- kept prior R1 mutations killed and added R1a mutation coverage.

**R1a verdict: BLOCKED FOR R1b.**

Browser GPT independent red-team v2 found:

- predictor initializes trajectory at fixed `z=1.4`;
- real `startFlight()` launches from `z=from[1]`;
- normal batting passes `from[1]=Math.max(1.2,pitch.ty)`;
- therefore contact-time classifier can still predict a different physical trajectory from the one actually launched near the absolute 22ft liner/fly apex boundary.

Authority:

- `docs/audits/b0805_30_owner_closure_r1a_browser_redteam_v2_20260813.md`
- audit commit: `2535d8aaa0d963b057a8687b87b51ebea2c0957c`

### R1b — NEXT SINGLE TASK

Task:

- `docs/implementation/TASK_B0805_30_OWNER_CLOSURE_R1B_CONTACT_HEIGHT_COMPAT_20260813.md`
- task commit: `9173f6df984680d9f66e59bd70b6ead6e531d64a`
- exact base: `de8dcd6175ed866a9f96f5768c228eec1b53fb6d`
- create branch: `agent/b0805-30-owner-closure-r1b-contact-height-compat`
- intended worker: **Grok Build**

R1b must pass actual production launch height into the physical trajectory/classification contract and add mutation coverage for the fixed-height defect.

Do not start R2 or Unity U0 in the same task.

## Unity technical spike — QUEUED AFTER R1b APPROVAL

Unity is installed/prepared by the owner. The new Unity implementation will be a separate local repository/project initially, not a rewrite inside this JS repo.

Policy:

- `docs/unity/AI_WORKER_POLICY_20260813.md`

U0 task:

- `docs/unity/TASK_UNITY_U0_BOOTSTRAP_20260813.md`
- task commit: `033281f28d72a6b280cdeccc7c4ed1cb0b71858e`

U0 rules:

- separate local repo/project, suggested `baseball3d-unity`;
- vendor-neutral `AGENTS.md` + `CURRENT_STATE.md`;
- Unity CLI/Editor automation layer;
- Grok/Codex use the same scripts;
- local Git only in U0; **no GitHub remote yet**;
- no baseball vertical slice yet;
- Browser GPT reviews U0 before U1.

After U0 approval, U1 will implement one golden vertical slice based on the owner recording:

- approximately 91mph / 1deg / spray 19deg;
- routine second-base ground ball;
- 4-3 out;
- deterministic simulation + debug observability.

## Strategic sequencing after R1b

Do **not** immediately implement JS R2/R3 after R1b.

Sequence:

1. R1b JS repair and Browser GPT approval.
2. Unity U0 automation/bootstrap.
3. Unity U1 one-play vertical slice.
4. Browser GPT + owner Unity adoption gate.
5. If Unity adoption PASS: JS remains reference/oracle; unresolved owner feedback (b29a/Issue #30) becomes migration/acceptance requirements for Unity rather than automatically being implemented twice in JS.
6. If Unity adoption FAIL: return to JS owner-closure R2/R3.

This sequence avoids spending substantial time implementing the same structural systems twice before the Unity feasibility decision.

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

Do not merge it automatically. If Unity adoption passes, use these as behavioral requirements/reference patches rather than assuming a JS merge is still needed.

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
- tracking Issue: #33

## DO NOT do now

- do not resume Claude Code as primary worker;
- do not merge historical b24;
- do not merge PR #32 automatically;
- do not start JS R2/R3 before the Unity adoption gate unless Browser GPT explicitly changes the sequence;
- do not start Unity U0 before R1b is independently approved;
- do not resume M1 Final Validation;
- do not start P1/E1/F1/P2;
- do not mark Issue #30 closed;
- do not treat Unity as canonical before the U0/U1 adoption gate;
- do not create the Unity GitHub remote during U0.
