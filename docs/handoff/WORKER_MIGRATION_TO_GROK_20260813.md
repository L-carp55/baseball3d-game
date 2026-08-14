# Worker Migration Handoff — Claude Code -> Grok Build

Last updated: 2026-08-14
Repository: `L-carp55/baseball3d-game`
Status: **MIGRATION COMPLETE / NEXT = UNITY U0**

## Purpose

Primary implementation work has moved from Claude Code to Grok Build without carrying chat-history state or worker-specific assumptions.

This handoff is cold-startable from Git/GitHub state.

## Roles

- Primary implementation worker: **Grok Build**
- Fallback/alternate implementation worker: **Codex local/CLI**
- Browser GPT: architecture, task authoring, independent remote red-team, milestone gate
- Owner: final gameplay and visual acceptance
- Claude Code: historical worker only; no new task should be started there unless explicitly reactivated

## JS recovery state inherited from worker migration

### R1

`claude/b0805-30-owner-closure-r1-batted-ball-identity`

- implementation: `bee15b6594498ef91440b9629604cdac18430c6d`
- final HEAD: `5088aeefd0ee632282c36120185dcc97ff2fc880`

### R1a

`claude/b0805-30-owner-closure-r1a-classifier-compat`

- implementation: `90514d7b592b63a993a1374eb6a905c9e4e38880`
- final HEAD: `de8dcd6175ed866a9f96f5768c228eec1b53fb6d`

### R1b — first Grok Build implementation task

`agent/b0805-30-owner-closure-r1b-contact-height-compat`

- implementation: `4d1b9f039b3f6028f31290eb1f69848890539700`
- final HEAD: `33b5518a3eb9e76e6525dc7e23556c55ed88ec5d`
- Browser GPT verdict: **APPROVED implementation candidate**

Independent review:

`docs/audits/b0805_30_owner_closure_r1b_browser_redteam_20260814.md`

The R1/R1a/R1b implementation-review gate is therefore complete. This is not equivalent to closing Issue #33: integration/owner verification gates still exist.

## NEXT SINGLE TASK — Unity U0

Task:

`docs/unity/TASK_UNITY_U0_BOOTSTRAP_20260813.md`

Policy:

`docs/unity/AI_WORKER_POLICY_20260813.md`

Read current truth first:

`docs/handoff/CURRENT_STATE.md`

### Grok U0 cold-start procedure

1. Finish/leave the JS R1b session stopped. Do not add commits to R1b.
2. Read the latest `agent/research-baseball-motion-ai:docs/handoff/CURRENT_STATE.md`.
3. Read `agent/research-baseball-motion-ai:docs/unity/AI_WORKER_POLICY_20260813.md`.
4. Read `agent/research-baseball-motion-ai:docs/unity/TASK_UNITY_U0_BOOTSTRAP_20260813.md` in full.
5. Detect the installed Unity/PowerShell/Git/Grok toolchain instead of assuming versions/paths.
6. Create a **separate local** Unity project/repository, suggested sibling name `baseball3d-unity`.
7. Initialize local Git and use branch `agent/unity-u0-bootstrap`.
8. Execute **U0 only**: project/bootstrap/automation/architecture seed/tests/validation/build/audit/handoff.
9. Do not create a GitHub remote during U0.
10. Commit locally, ensure worktree clean, then STOP and report the local project path, exact Unity version/path, local final commit SHA, test/build results, and audit/handoff paths.

Browser GPT reviews U0 before U1.

## U0 intent

U0 proves that Grok Build/Codex can operate Unity through stable, vendor-neutral automation rather than repetitive GUI manipulation.

Expected entrypoints include:

- `scripts/unity-common.ps1`
- `scripts/unity-bootstrap.ps1`
- `scripts/unity-test.ps1`
- `scripts/unity-validate.ps1`
- `scripts/unity-build.ps1`

Unity Editor scripts should provide deterministic `-executeMethod` style setup/build actions.

No real baseball vertical slice is implemented in U0.

## U1 after U0 approval

U1 will be the first baseball vertical slice:

- approximately 91mph / 1deg / spray 19deg;
- routine second-base ground ball;
- 4-3 out;
- deterministic simulation;
- observable fielding/throw/possession state.

Unity becomes canonical only after U0 + U1 + Browser GPT/owner adoption gate.

## Known requirement debt to carry into Unity

Do not blindly port JS behavior. Preserve owner requirements and explicitly revisit known ambiguities, including:

- very-low-angle (`la<=5`) contact-time ground classification versus existing caught-air liner labeling;
- b29a high-fly bounce/head-slide/return-slide owner fixes;
- Issue #30 structural systems: RunnerContact/TagEvent, ThrowRoute, HOLD_BALL, FieldingExecution/BallPossession, chase+cover assignment, rundown admission/receive timing, stationary-ball retarget, run-through pickup, walls, possession/display lifecycle.

Unity adoption does not erase these requirements.

## Do not do now

- do not start new Claude Code implementation work;
- do not continue modifying R1b after approval;
- do not create/merge a JS PR for R1b unless explicitly requested later;
- do not start JS R2/R3 before the Unity adoption decision;
- do not merge PR #32 automatically;
- do not resume M1 Final Validation or P1;
- do not create a Unity GitHub remote in U0;
- do not start U1 inside U0.

## Authority rule

If this file conflicts with an older Claude/Grok chat, PR body, Issue body, or stale status document:

1. inspect current GitHub remote;
2. read `docs/handoff/CURRENT_STATE.md`;
3. prefer the newest independent audit/current task;
4. do not infer missing state from chat memory.
