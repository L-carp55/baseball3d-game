# TASK — Publish Existing Unity Repo to Private GitHub

Date: 2026-08-14
Worker: Grok Build
Purpose: make the existing local `baseball3d-unity` repository fully recoverable from GitHub without changing gameplay code or rewriting history.

## Current facts

- Existing Unity repo/project already exists locally.
- Latest exact local checkpoint reported in the current session: `d234bd7df8fad9e49cc1de273e8e77d1c4f4865e`.
- It is not merged.
- As of task creation, GitHub account `L-carp55` has no accessible repo named `baseball3d-unity`.
- Do **not** create a fresh Unity project and copy files into it.

## Goal

Create a **private** GitHub repository for the existing local Git repository and push the existing history/branches needed for recovery.

Suggested repo name:

`L-carp55/baseball3d-unity`

## Procedure

1. Open the existing local `baseball3d-unity` repository.
2. Run and record:
   - `git status --short --branch`
   - `git log --oneline --decorate --graph -20`
   - `git branch -vv`
   - `git remote -v`
3. Verify the local history contains `d234bd7df8fad9e49cc1de273e8e77d1c4f4865e`.
4. If there are unrelated uncommitted changes, do not silently delete/stash them. Commit only if they are legitimate current project progress and clearly describe the commit; otherwise stop and report.
5. Create a **private** GitHub repository for this existing project. Do not initialize it with a conflicting README/.gitignore/license if that would create unrelated history.
6. Add that repo as `origin` to the existing local Git repo.
7. Push the current development branch and all local branches/tags needed to recover the project history. Preserve ancestry.
8. Do not merge anything.
9. Do not rebase/squash/reset/force-push merely to make history pretty.
10. Verify on remote that `d234bd7df8fad9e49cc1de273e8e77d1c4f4865e` is reachable.
11. Report exact remote repo, default branch, pushed branches, remote HEADs, and final `git status`.

## Security / contents

Before push, verify Unity-generated heavy/cache/build directories remain ignored and are not accidentally tracked, including as applicable:

- `Library/`
- `Temp/`
- `Logs/`
- `obj/`
- `Builds/`
- `.vs/`

Do not remove legitimate source/assets/settings merely to reduce repository size.

## Stop condition

After the existing Unity repo/history is pushed successfully and the remote is verified, STOP.

Do not merge checkpoints.
Do not resume JS R2/R3.
Do not start unrelated feature work as part of this publish task.

After Browser GPT can see the Unity remote, normal batched `/goal` development may resume according to `docs/handoff/SESSION_HANDOFF_20260814_UNITY_CORE_ALPHA.md`.
