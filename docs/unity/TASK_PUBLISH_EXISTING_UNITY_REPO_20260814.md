# TASK — Publish Existing Unity Repo to Private GitHub

Date: 2026-08-14
Worker: Grok Build
Purpose: make the existing local `baseball3d-unity` repository fully recoverable from GitHub without changing gameplay code or rewriting history.

## Current facts

- Existing Unity repo/project already exists locally.
- Earlier provisional checkpoint: `d234bd7df8fad9e49cc1de273e8e77d1c4f4865e`.
- Later reported implementation commit prefix: `3f04f4a` (`Core: assign grounder primary from intercept and ReachModel`).
- Later follow-up/record prefix: `f1d2292`.
- **Latest exact local HEAD reported:** `f1d2292244178d1e630423a4e7fdeef459fee9a3`.
- Current reported branch: `agent/unity-u0-bootstrap`.
- These checkpoints are not merged.
- As of the latest Browser GPT check, GitHub account `L-carp55` has no accessible repo named `baseball3d-unity`.
- Do **not** create a fresh Unity project and copy files into it.

## Goal

Create a **private** GitHub repository for the existing local Git repository and push the existing history/branches needed for recovery.

Suggested repo name:
`L-carp55/baseball3d-unity`

## Procedure

1. Open the existing local `baseball3d-unity` repository.
2. Run and record:
   - `git status --short --branch`
   - `git log --oneline --decorate --graph -30`
   - `git branch -vv`
   - `git remote -v`
3. Verify local history contains exact latest HEAD `f1d2292244178d1e630423a4e7fdeef459fee9a3`.
4. Verify whether `d234bd7df8fad9e49cc1de273e8e77d1c4f4865e` is an ancestor/reachable checkpoint rather than assuming it. Record the result.
5. Identify the full SHA corresponding to implementation prefix `3f04f4a` and record it.
6. If there are unrelated uncommitted changes, do not silently delete/stash them. Commit only if they are legitimate current project progress and clearly describe the commit; otherwise stop and report.
7. Before push, verify heavy/cache/build directories are ignored and not accidentally tracked, including as applicable:
   - `Library/`
   - `Temp/`
   - `Logs/`
   - `obj/`
   - `Builds/`
   - `.vs/`
8. Create a **private** GitHub repository for this existing project. Do not initialize it with a conflicting README/.gitignore/license if that creates unrelated history.
9. Add that repo as `origin` to the existing local Git repo.
10. Push the current development branch and all local branches/tags needed to recover project history. Preserve ancestry.
11. Do not merge anything.
12. Do not rebase/squash/reset/force-push merely to make history pretty.
13. Verify on remote that exact latest HEAD `f1d2292244178d1e630423a4e7fdeef459fee9a3` is reachable.
14. Verify the remote contains the full `3f04f4a` implementation commit and report its full SHA.
15. If `d234bd7...` is part of the real ancestry, verify it is also remotely reachable; if not, report the actual relationship instead of forcing history.
16. Report exact remote repo, default branch, pushed branches, remote HEADs, exact implementation SHA, ancestry result, and final `git status`.

## Security / contents

Do not remove legitimate source/assets/settings merely to reduce repository size.
Do not publish credentials, machine-local secrets, Unity license material, or unrelated user data.

## Stop condition

After the existing Unity repo/history is pushed successfully and remote reachability is verified, STOP.

Do not merge checkpoints.
Do not resume JS R2/R3.
Do not start unrelated feature work as part of this publish task.

After Browser GPT can see the Unity remote, normal batched `/goal` development may resume according to `docs/handoff/SESSION_HANDOFF_20260814_UNITY_CORE_ALPHA.md`.
