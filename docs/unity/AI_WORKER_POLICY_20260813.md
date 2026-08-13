# Unity AI Worker Policy

Date: 2026-08-13
Status: ACTIVE FOR UNITY TECHNICAL SPIKE

## Purpose

The Unity implementation must not depend on any one coding-agent vendor or chat history.

Primary worker at project start: Grok Build.
Fallback/alternate worker: Codex local/CLI.
Browser GPT: architecture, task specification, independent remote review, milestone gate.
Owner: final gameplay/visual acceptance.

Claude Code is no longer the default implementation worker for new Unity work. Historical files or branches containing `CLAUDE_` remain historical artifacts and should not be renamed merely for cosmetics.

## Canonical authority order

For Unity work, use this priority order:

1. current Git repository contents and exact branch/commit;
2. `AGENTS.md` in the Unity repository;
3. `docs/handoff/CURRENT_STATE.md` in the Unity repository;
4. the current task spec under `docs/tasks/`;
5. automated tests / fixtures / recorded evidence;
6. old chat history only as non-authoritative context.

If chat history conflicts with GitHub/repository state, repository state wins.

## Agent-neutral operation

All normal Unity operations should be reachable through stable scripts and Editor automation, not through model-specific GUI clicking.

Target entrypoints:

- `scripts/unity-bootstrap.ps1`
- `scripts/unity-test.ps1`
- `scripts/unity-validate.ps1`
- `scripts/unity-build.ps1`

These scripts may call Unity with `-batchmode`, `-projectPath`, `-executeMethod`, test-runner arguments, or other supported command-line mechanisms.

Grok Build and Codex should call the same scripts.

## Branch naming

New Unity work uses vendor-neutral branches:

- `agent/unity-u0-bootstrap`
- `agent/unity-u1-groundball-slice`
- `agent/unity-<task>`

Do not encode `grok/`, `claude/`, or `codex/` into the long-term branch taxonomy unless the branch is explicitly an ephemeral experiment.

## Task stop discipline

Each task must define an explicit stop condition. The worker must stop after:

1. implementing only the named scope;
2. running required validation;
3. writing the audit/handoff required by the task;
4. committing locally and, when a remote exists and the task allows it, pushing the exact branch.

Do not proceed automatically to the next milestone.

## No hidden manual state

Avoid changes that exist only in a human's Unity Editor session.

Scene/Prefab/importer/project settings that matter to correctness should be reproducible through one of:

- version-controlled Unity assets/settings;
- Editor scripts;
- deterministic bootstrap scripts.

If a manual Editor action is unavoidable, record the exact action and resulting serialized file changes in the task audit.

## Domain/presentation boundary

Do not port the old single-HTML architecture literally.

Prefer:

- `Baseball.Core`: pure game/domain logic, minimal/no UnityEngine dependency where practical;
- `Baseball.Simulation`: orchestration/state stepping;
- `Baseball.Presentation`: GameObjects, rendering, camera, animation views;
- `Baseball.Editor`: project/scene/prefab/build automation;
- `Baseball.Tests`: EditMode/PlayMode tests.

Ball physics, runner/fielding decisions, possession and play lifecycle should remain deterministic/testable rather than being hidden inside scene callbacks.

## Existing JS game

`L-carp55/baseball3d-game` remains a reference/oracle during the technical spike.

Do not blindly translate JS source. Use it to recover:

- behavioral contracts;
- golden fixtures;
- failure cases;
- architecture lessons;
- owner feedback history.

Unity becomes canonical only after an explicit Browser GPT + owner adoption gate.

## Review rule

Worker self-reports are not final approval.

After a worker says a task is complete, Browser GPT independently checks the committed/pushed diff, architecture and evidence before the milestone advances.
