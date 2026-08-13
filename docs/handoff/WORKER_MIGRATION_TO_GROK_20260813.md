# Worker Migration Handoff — Claude Code -> Grok Build

Date: 2026-08-13
Repository: `L-carp55/baseball3d-game`
Status: ACTIVE

## Purpose

Move primary implementation work from Claude Code to Grok Build without carrying chat-history state or worker-specific assumptions.

This handoff is intentionally cold-startable from Git/GitHub state.

## Roles after migration

- Primary implementation worker: **Grok Build**
- Fallback/alternate implementation worker: **Codex local/CLI**
- Browser GPT: architecture, task authoring, independent remote red-team, milestone gate
- Owner: final gameplay and visual acceptance
- Claude Code: historical worker only; no new task should be started there unless explicitly reactivated

## What Claude Code completed and pushed

### R1

Branch:

`claude/b0805-30-owner-closure-r1-batted-ball-identity`

- implementation: `bee15b6594498ef91440b9629604cdac18430c6d`
- final HEAD: `5088aeefd0ee632282c36120185dcc97ff2fc880`

### R1a

Branch:

`claude/b0805-30-owner-closure-r1a-classifier-compat`

- implementation: `90514d7b592b63a993a1374eb6a905c9e4e38880`
- final HEAD: `de8dcd6175ed866a9f96f5768c228eec1b53fb6d`

Browser GPT independently confirmed both remote branches/commit structure and reviewed the production diff.

Claude Code reported its `baseball3d-game` working tree clean after R1a. That local-clean statement is a worker self-report; continuation must rely on the remote commits above, not on assumed local state.

No additional Claude Code-generated handoff is required.

## Important: R1a is NOT finally approved

R1a fixed the angle-only liner/fly classifier incompatibility, but Browser GPT independent red-team v2 found one remaining narrow defect:

- `predictBattedBallApexFt(c)` assumes fixed initial `z=1.4`;
- production `startFlight()` launches from `z=from[1]`;
- normal batting uses `from[1]=Math.max(1.2,pitch.ty)`;
- the physical identity classifier therefore may predict a different trajectory from the actual launched ball near the absolute 22ft liner/fly boundary.

Authority:

`docs/audits/b0805_30_owner_closure_r1a_browser_redteam_v2_20260813.md`

## NEXT SINGLE TASK — Grok Build R1b

Task:

`docs/implementation/TASK_B0805_30_OWNER_CLOSURE_R1B_CONTACT_HEIGHT_COMPAT_20260813.md`

Exact repair base:

`de8dcd6175ed866a9f96f5768c228eec1b53fb6d`

Create vendor-neutral branch:

`agent/b0805-30-owner-closure-r1b-contact-height-compat`

Do not continue on the old `claude/` branch.

## Grok cold-start procedure

1. Open the existing local `baseball3d-game` repository.
2. Run `git status` first.
3. If unrelated local changes exist, STOP and report them; do not silently stash/delete/overwrite them.
4. `git fetch origin`.
5. Independently verify that remote R1a HEAD is exactly:
   `de8dcd6175ed866a9f96f5768c228eec1b53fb6d`.
6. Read, in order:
   - `agent/research-baseball-motion-ai:docs/handoff/CURRENT_STATE.md`
   - `agent/research-baseball-motion-ai:docs/unity/AI_WORKER_POLICY_20260813.md`
   - `agent/research-baseball-motion-ai:docs/audits/b0805_30_owner_closure_r1a_browser_redteam_v2_20260813.md`
   - `agent/research-baseball-motion-ai:docs/implementation/TASK_B0805_30_OWNER_CLOSURE_R1B_CONTACT_HEIGHT_COMPAT_20260813.md`
7. Create `agent/b0805-30-owner-closure-r1b-contact-height-compat` from the exact R1a HEAD.
8. Execute **R1b only**.
9. Run all required focused/mutation/regression gates.
10. Commit and push the R1b branch.
11. STOP and report exact branch, implementation/final SHA, changed files, test results and audit path.

Browser GPT will independently review the remote diff after completion.

## Do not do during R1b

- do not create/merge a PR;
- do not start JS R2/R3;
- do not integrate PR #32;
- do not implement Issue #30 systems;
- do not resume M1 Final Validation;
- do not start P1;
- do not start Unity U0 in the same task;
- do not rename historical Claude task/audit files merely because the primary worker changed.

## Unity is queued, not started

After Browser GPT approves R1b, the next task is Unity U0:

`docs/unity/TASK_UNITY_U0_BOOTSTRAP_20260813.md`

Worker policy:

`docs/unity/AI_WORKER_POLICY_20260813.md`

U0 creates a separate local `baseball3d-unity` project/repository with Unity CLI/Editor automation and no GitHub remote yet.

Unity does not become canonical in U0. The adoption decision comes after U0 and U1 (one deterministic 91mph/1deg/spray19deg routine 4-3 ground-ball vertical slice) are independently reviewed and owner-tested.

## Authority rule

If this file conflicts with an older Claude Code chat, old PR body, old Issue body, or stale status document:

1. inspect current GitHub remote;
2. read `docs/handoff/CURRENT_STATE.md`;
3. prefer the newest independent audit/task;
4. do not infer missing state from chat memory.
