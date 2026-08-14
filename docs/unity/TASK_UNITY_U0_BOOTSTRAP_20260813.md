# TASK — Unity U0 Bootstrap

Date: 2026-08-13
Worker-neutral task; intended first worker: Grok Build
Reference repository: `L-carp55/baseball3d-game`
Status: READY

## 0. Goal

Create a separate local Unity repository/project for the baseball game technical spike, with an AI-operable automation layer and strict architectural boundaries.

This task is **U0 only**. Do not implement the baseball vertical slice yet.

Suggested local repository/project name:

`baseball3d-unity`

Place it as a sibling of the existing `baseball3d-game` checkout when practical.

Do **not** create a GitHub remote in U0. The owner will decide remote visibility later.

## 1. Read first

From the existing `baseball3d-game` repository, read:

- `docs/unity/AI_WORKER_POLICY_20260813.md` from branch `agent/research-baseball-motion-ai`;
- `docs/handoff/CURRENT_STATE.md` from branch `agent/research-baseball-motion-ai`;
- `docs/audits/owner_feedback_closure_matrix_20260813.md` from branch `agent/research-baseball-motion-ai`;
- the owner recording context for the later U1 golden fixture: BUILD b0805-30, approximately `91 mph / 1° / spray 19°`, routine 4-3 ground-ball out.

Do not treat old chats as canonical.

## 2. Detect the local toolchain — do not guess

Before creating the project, independently detect and record:

- Windows version relevant to command paths;
- installed Unity Hub path if present;
- installed Unity Editor path(s);
- exact Unity version(s);
- whether the selected Editor has URP/Universal 3D templates/packages available;
- PowerShell version;
- Git version;
- Grok Build version and selected model if the CLI exposes this reliably.

Prefer an installed Unity 6 LTS/appropriate Unity 6 editor. Do not uninstall or replace an existing Editor merely because another version might be newer.

If multiple suitable Unity Editors exist, choose the most appropriate installed stable/LTS editor and document why.

## 3. Create a separate Unity project

Create a new Unity 3D project, preferably using URP/Universal 3D when the installed Editor supports it cleanly.

Constraints:

- separate from the JS repository;
- local Git repository initialized;
- no GitHub remote yet;
- no paid/licensed third-party assets in U0;
- no CMU motion import in U0;
- no attempt to recreate the full stadium/game.

## 4. Required repository structure

Establish at minimum:

```text
baseball3d-unity/
  AGENTS.md
  README.md
  docs/
    handoff/
      CURRENT_STATE.md
    tasks/
    audits/
  scripts/
    unity-common.ps1
    unity-bootstrap.ps1
    unity-test.ps1
    unity-validate.ps1
    unity-build.ps1
  Assets/
    Baseball/
      Core/
      Simulation/
      Presentation/
      Editor/
      Debug/
      Tests/
        EditMode/
        PlayMode/
  Packages/
  ProjectSettings/
```

Adapt Unity-generated package/folder conventions as needed; do not fight Unity's normal serialization/layout merely to match this tree exactly.

## 5. AGENTS.md contract

Create a concise but strong `AGENTS.md` stating:

- Git/repo state is authoritative over chat history;
- worker-neutral operation: Grok/Codex must use the same scripts;
- no broad rewrite without task scope;
- no hidden manual Editor state;
- no automatic progression to next milestone;
- no PR/remote creation unless a task explicitly allows it;
- Core/Simulation should avoid UnityEngine dependencies where practical;
- Presentation/Editor may use Unity APIs;
- tests and audit are mandatory before claiming completion;
- owner visual acceptance is required for visual/game-feel completion.

## 6. Automation layer — mandatory

Create a reliable way for a coding agent to operate Unity without repetitive GUI clicking.

### PowerShell entrypoints

Implement stable scripts:

- `scripts/unity-common.ps1`
  - discover/resolve the chosen Unity Editor path;
  - centralize project path/log/result paths;
  - fail loudly on ambiguity/missing editor.

- `scripts/unity-bootstrap.ps1`
  - run project bootstrap/scene generation through Unity CLI/Editor code;
  - idempotent or safely repeatable.

- `scripts/unity-test.ps1`
  - run the project's automated test suite through Unity command line;
  - produce machine-readable results when supported;
  - return nonzero on real test failure.

- `scripts/unity-validate.ps1`
  - compile/smoke checks plus project-specific validation;
  - verify expected generated scene/assets exist;
  - do not silently repair failures.

- `scripts/unity-build.ps1`
  - create at least one local development build target supported by the installed setup;
  - Web build may be deferred if the required module is not installed; detect/report rather than install silently.

### Editor code

Create Editor automation under `Assets/Baseball/Editor/`, e.g.:

- `ProjectBootstrap.cs`
- `SceneBuilder.cs`
- `BuildAutomation.cs`

Exact names may differ, but there must be a callable static `-executeMethod` style entrypoint that can create/update a minimal prototype scene deterministically.

## 7. Minimal generated scene

U0 scene is an automation proof, not baseball gameplay.

Generate and save a minimal scene through code with at least:

- ground plane or simple field placeholder;
- main camera;
- directional light if the render setup needs it;
- `SimulationRoot` GameObject;
- `DebugRoot` GameObject;
- one obvious primitive marker proving scene generation ran.

Do not hand-place these as the only implementation. Re-running bootstrap on a clean serialized state should reproduce the important setup.

## 8. Architecture seed

Create minimal compiling classes/interfaces demonstrating the intended boundary, without implementing real baseball behavior yet.

Suggested examples:

- `Baseball.Core/SimulationClock` or equivalent pure stepping abstraction;
- `BallState` plain data structure;
- `BaseballSimulation` minimal deterministic step/smoke state;
- `BallView` presentation adapter that reads simulation state;
- debug component that displays/logs current deterministic tick/state.

The important acceptance criterion is that at least one EditMode test can instantiate/step the Core/Simulation logic without needing a loaded Unity scene.

Do not prematurely implement ThrowDecision, ReachModel, BallPossession, etc. U1+ will introduce real contracts deliberately.

## 9. Tests

At minimum add permanent tests for:

1. pure/deterministic simulation stepping produces the same state from the same input;
2. bootstrap expected assets/scene path contract exists or can be validated;
3. required Core code does not require a scene to execute;
4. automation scripts return appropriate success/failure codes.

Use EditMode/PlayMode appropriately; do not create fake tests that only assert `true`.

## 10. Validation run

Before completion, run from terminal using the created scripts:

1. bootstrap;
2. tests;
3. validation;
4. at least one local development build if the installed Unity modules allow it.

Then open/inspect the generated project/scene once if necessary to verify the automation did not create a broken/empty setup. Record any manual inspection separately from automated evidence.

## 11. Current-state handoff

Create `docs/handoff/CURRENT_STATE.md` in the new Unity repo containing only current truth:

- Unity version and executable path selected;
- project path/name;
- local Git branch/HEAD;
- U0 status;
- automation commands;
- test/build status;
- known environment limitations/modules not installed;
- next single task: U1 golden ground-ball vertical slice;
- explicit `DO NOT` list.

Do not turn it into a historical diary.

## 12. U0 audit

Create:

`docs/audits/U0_BOOTSTRAP_AUDIT_20260813.md`

Include:

- detected tool versions/paths;
- exact project creation method;
- changed/created major files;
- automation entrypoints and exact commands run;
- test results;
- build result;
- any failed attempts;
- any manual Unity Editor steps that were unavoidable;
- local Git commit SHA;
- unresolved limitations.

## 13. Git

Initialize a fresh local Git repository in `baseball3d-unity`.

Use vendor-neutral branch naming. For U0, use:

`agent/unity-u0-bootstrap`

Create an initial baseline commit and/or a final U0 commit in a way that leaves history understandable. Do not create many noisy intermediate commits solely because automation generated files.

Do not add a remote and do not push in U0.

## 14. Explicitly out of scope

Do not implement in U0:

- 91mph/1°/19° gameplay fixture;
- fielding AI;
- ThrowDecision;
- ReachModel;
- RunnerIntent;
- BallPossession;
- RunnerContact/TagEvent;
- pitching/batting UI;
- CMU pitching animation;
- detailed player models;
- detailed stadium;
- networking;
- save systems;
- porting the full JS game;
- GitHub remote/PR creation.

## 15. Stop condition

When U0 is complete:

- all required scripts/files/tests/audit/handoff exist;
- required terminal validations have run;
- local Git is clean;
- U0 commits exist on `agent/unity-u0-bootstrap`;

then STOP.

Report:

- chosen Unity version/path;
- local project path;
- final local commit SHA;
- test/build summary;
- exact files/commands for Browser GPT independent review.

Do not start U1 until Browser GPT reviews U0.