# Baseball3D CURRENT STATE

Last updated: 2026-08-14
Authority: current GitHub remote + independent Browser GPT audits. Unity facts not yet pushed to GitHub are explicitly labeled as owner/Grok reports and must be verified once the Unity remote exists.

Detailed handoff:
- `docs/handoff/SESSION_HANDOFF_20260814_UNITY_CORE_ALPHA.md`

Next-session startup prompt:
- `docs/handoff/NEXT_SESSION_PROMPT_20260814.md`

## 1. Worker / review policy

- primary implementation worker: **Grok Build**
- fallback: **Codex local/CLI**
- Browser GPT: architecture, tasking, independent red-team, batch gate
- owner: gameplay/visual acceptance
- Claude Code: historical worker only

Development uses **batched autonomous `/goal` work** rather than stop/review after every checkpoint.

Rules:
- preserve meaningful checkpoint commits;
- do not merge merely because a checkpoint exists;
- target roughly 4–8 meaningful checkpoints or one coherent major milestone per Browser GPT review batch;
- do not weaken/delete tests to obtain green;
- do not use old test/build results as evidence for a newer HEAD;
- if runtime validation is environment-blocked, record that accurately and continue safe static/architectural work;
- a larger batch is not complete until current-HEAD runtime/test/build gates actually run.

## 2. JS reference/oracle — R1/R1a/R1b implementation-review gate passed

Repository: `L-carp55/baseball3d-game`

Canonical gameplay ancestor:
- `agent/b0805-29-possession-footwork`
- SHA `60b993b73fed854934a976e45e8feb9437deb584`
- BUILD `b0805-29`

Owner recording confirmed BUILD `b0805-30` on 2026-08-13.

R1:
- implementation `bee15b6594498ef91440b9629604cdac18430c6d`
- final `5088aeefd0ee632282c36120185dcc97ff2fc880`

R1a:
- implementation `90514d7b592b63a993a1374eb6a905c9e4e38880`
- final `de8dcd6175ed866a9f96f5768c228eec1b53fb6d`

R1b:
- branch `agent/b0805-30-owner-closure-r1b-contact-height-compat`
- implementation `4d1b9f039b3f6028f31290eb1f69848890539700`
- final `33b5518a3eb9e76e6525dc7e23556c55ed88ec5d`
- Browser GPT independent verdict: **APPROVED as implementation candidate**
- audit: `docs/audits/b0805_30_owner_closure_r1b_browser_redteam_20260814.md`

Issue #33 is **not CLOSED** because integration/owner verification remains distinct from implementation review.

Known semantic debt carried into Unity instead of starting JS R1c now:
- contact-time physical classification maps `la<=5` to `ゴロ`;
- caught-air semantics can call an unlanded very-low-angle ball `ライナー`.

Unity should define/test one coherent physical-category contract.

## 3. JS work intentionally paused

Do not automatically resume during Unity development:
- JS R2/R3
- PR #32 automatic integration
- Issue #30 implementation in JS
- M1 Final Validation
- P1/E1/F1/P2

Issue #30 requirements remain Unity acceptance requirements if Unity is adopted, including RunnerContact/TagEvent, complete ThrowRoute, cycle prevention, HOLD_BALL, chase+cover joint assignment, FieldingExecution/BallPossession, rundown receive/transfer, stationary-ball retarget, run-through pickup, wall topology, RundownAdmission, and possession-to-display lifecycle.

Known relay-loop failure to prevent:
`1B -> 2B -> RF -> 2B -> RF -> 2B -> RF -> P`

A throw-count watchdog is not a real solution.

## 4. Unity repo status — CRITICAL

The Unity implementation exists in a separate local Git repo/project (`baseball3d-unity`).

As of the latest check on 2026-08-14, GitHub account `L-carp55` still has **no accessible repository named `baseball3d-unity`**, and `baseball3d-game` has no Unity branch.

Therefore current Unity source/history is **not yet on GitHub** and cannot yet be independently reviewed by Browser GPT.

First recovery/upload action before GitHub-only continuation:
1. create a **private** GitHub repo for the existing local `baseball3d-unity` repo;
2. preserve existing local history — do not create a new Unity project or rewrite history;
3. add `origin` and push all branches/history needed for recovery;
4. do not merge as part of upload;
5. verify the latest local HEAD and earlier checkpoints are reachable remotely.

Publish task:
- `docs/unity/TASK_PUBLISH_EXISTING_UNITY_REPO_20260814.md`

## 5. Unity U0 local bootstrap — completed earlier checkpoint

Reported U0 results at that checkpoint:
- bootstrap PASS; generated `Assets/Baseball/Scenes/U0Prototype.unity` through Editor automation
- EditMode 4/4 PASS
- PlayMode 2/2 PASS
- `unity-validate.ps1` PASS
- Windows Mono development build PASS
- Unity-side audit: `docs/audits/U0_BOOTSTRAP_AUDIT_20260813.md`
- Unity-side handoff: `docs/handoff/CURRENT_STATE.md`

Installed build support reported:
- Windows standalone
- WebGL

Not installed:
- Android
- iOS
- Windows IL2CPP
- Linux
- Mac
- UWP

These are historical U0 checkpoint results only and are not evidence for newer commits.

## 6. Earlier U4.5a provisional checkpoint

Earlier exact local Unity checkpoint reported:
`d234bd7df8fad9e49cc1de273e8e77d1c4f4865e`

Status:
- committed
- not merged
- PROVISIONAL CHECKPOINT
- not independently inspected because Unity repo is still local-only

Reported immediate Input fix:
- Input System package had been removed but `activeInputHandler: 1` and an orphaned Actions reference remained;
- set `activeInputHandler: 0`;
- removed orphaned Actions reference;
- kept Legacy keyboard `Space / R / T / C`;
- kept IMGUI mouse UI;
- no exception suppression added.

Reported Core/Simulation diff versus its parent: empty.

At that checkpoint, static fixture/config checks and `unity-validate.ps1` passed, but EditMode/PlayMode/build were blocked before meaningful current-code execution by Unity environment/IPC problems. Old results were explicitly not reused.

## 7. LATEST local-only Unity checkpoint — five-role grounder assignment

A later Grok response arrived after the first handoff was written. This supersedes the old statement that 1B/3B assignment still needed implementation.

Reported branch:
`agent/unity-u0-bootstrap`

Reported implementation commit prefix:
`3f04f4a` — `Core: assign grounder primary from intercept and ReachModel`

Reported record/follow-up commit prefix:
`f1d2292`

Latest exact reported local HEAD:
`f1d2292244178d1e630423a4e7fdeef459fee9a3`

This HEAD is **not merged** and is still local-only. Browser GPT has not independently inspected the diff/ancestry yet.

### Reported new assignment architecture

The old `Diamond.AssignPrimaryForGrounder(spray)` angle table was replaced as assignment authority.

Reported current authority:
- `Assets/Baseball/Core/FieldingAssignment.cs`

Reported pipeline:
1. `BallPhysics.cs` predicts the ground-ball path using the same equations as production `PlaySimulation`;
2. `ReachModel.cs` computes arrival time from reaction + acceleration + running;
3. P / 1B / 2B / 3B / SS compete for intercept points, with the earliest feasible fielder becoming primary;
4. pitcher has a constraint preventing unrealistic pursuit past the front of the mound into 2B/SS depth.

The fixture reportedly contains only contact inputs (exit velocity / launch angle / spray). Expected primary is not retained/forced as simulation input.

### Reported five-role fixture coverage

| Contact | Expected primary |
|---|---|
| 58 mph / 2° / 0° pitcher-front slow roller | P |
| 78 / 2 / 42 first-base line | 1B |
| 82 / 2 / 40 first-base side | 1B |
| 91 / 1 / 19 golden grounder | 2B |
| 88 / 1 / 15 second-base side | 2B |
| 78 / 2 / -42 third-base line | 3B |
| 82 / 2 / -40 third-base side | 3B |
| 88 / 1 / -18 shortstop side | SS |

Boundary/competition behavior was also reported: moving the nearby fielder toward the predicted ball point flips 1B/2B or 3B/SS assignment, intended to show the result is not a fixed spray-angle role table.

The old angle rule would have selected 2B at +42° and SS at -42°, while the new assignment reports 1B / 3B.

Golden 91mph / 1° / spray19° remains 2B and remains an out in the Core golden-grounder test.

U1–U4 EditMode tests reportedly remain in the codebase.

## 8. Latest verification state at `f1d2292...`

Reported:
- `scripts/unity-validate.ps1`: PASS
- a non-Editor execution of shipped Core / Simulation + EditMode tests using the same NUnit attributes: **48/48 PASS**, including new FieldingAssignment fixtures/boundaries

Important evidence boundary:
- this 48/48 run is supplementary and does **not** replace successful execution of `scripts/unity-test.ps1` through Unity Editor;
- `scripts/unity-test.ps1` did not complete;
- reported blocker: the same Unity `6000.5.8f1` was being used by Luna's U4.5a worktree, and IL post-processing could not start; retry after that run ended still failed at that stage;
- Grok did not stop unrelated Unity instances/projects;
- PlayMode Editor tests were not rerun;
- Windows/WebGL current-HEAD builds are not reported as successful for this HEAD.

Therefore `f1d2292...` remains **PARTIALLY VERIFIED / ENVIRONMENT-BLOCKED**, not fully green.

Do not cite the earlier U0 build or older EditMode/PlayMode runs as evidence for this HEAD.

## 9. New known gameplay gap after 1B became a valid primary

Grok explicitly reported:

> When 1B fields the ball, CPU still throws to first. Who covers first base after 1B leaves the bag is outside this change.

This is now a high-priority structural follow-up, not something to hide in fixture selection.

The next assignment/defense layer should model **primary + cover jointly**. For a normal ground ball fielded by 1B, the defense needs an explicit legal first-base receiver/cover decision (commonly P depending on geometry/play), rather than throwing toward an uncovered base or assuming the fielder can simultaneously field and cover.

This aligns with the existing Issue #30 requirement for chase + cover joint assignment.

Do not special-case the fixture name. Base coverage must derive from live defensive roles/geometry.

## 10. Luna worktree / concurrency note

Grok reported it did **not** inspect or merge:
`agent/luna-u4_5-owner-playtest-layer`

Do not assume compatibility or ancestry with that worktree until remote/local Git state is inspected. Do not stop/kill unrelated Unity processes destructively merely to make tests run; coordinate or wait for a clean test window.

## 11. Active batched `/goal` priority after remote upload

The old priority “implement 1B/3B primary” is now reported completed and must not be assigned again blindly.

After publishing the existing Unity repo and independently verifying the new fielding-assignment diff, priorities are:
1. verify five-role assignment implementation/ancestry on remote;
2. implement primary + base-cover coordination, especially 1B-fields -> first-base cover;
3. restore current-HEAD Unity Editor test/build execution (without weakening tests);
4. fielding assignment quality/boundary realism;
5. explicit BallPossession;
6. FieldingExecution;
7. ThrowRoute progress / cycle prevention;
8. HOLD_BALL;
9. receive -> transfer timing;
10. RunnerContact / TagEvent;
11. close-play authority;
12. debugging / observability.

When the Unity environment is healthy, run against **current HEAD**:
- full EditMode
- full PlayMode
- `unity-validate.ps1`
- Windows Development Build
- WebGL Development Build if supported by already-installed module
- runtime smoke check

## 12. Review / merge gate

`d234bd7...`, `f1d2292...`, and later checkpoints are not automatically approved.

Use checkpoints for recovery/bisect/review, but do not merge merely because they exist.

Browser GPT performs batched independent review after a coherent milestone group and current-code validation are ready. Return to per-commit stop/review only for a high-severity contract defect or genuinely risky operation.

## 13. Recovery order for the next Browser GPT session

1. read this file;
2. read `docs/handoff/SESSION_HANDOFF_20260814_UNITY_CORE_ALPHA.md`;
3. read `docs/handoff/NEXT_SESSION_PROMPT_20260814.md`;
4. inspect whether private `baseball3d-unity` now exists on GitHub;
5. if it exists, verify exact remote ancestry and ensure latest reported HEAD `f1d2292244178d1e630423a4e7fdeef459fee9a3` is reachable; also verify `d234bd7...` ancestry rather than assuming it;
6. inspect `FieldingAssignment.cs`, `BallPhysics.cs`, `ReachModel.cs`, fixtures/tests, and the exact diff around `3f04f4a` before giving new Core instructions;
7. if the Unity remote is still absent, first publish the existing local Unity repo without rewriting history;
8. continue batched `/goal` development using current remote truth.

## DO NOT automatically do now

- do not merge Unity checkpoints before the batch gate;
- do not recreate the Unity project to solve missing remote;
- do not rewrite local Unity history when publishing it;
- do not claim current Unity Editor runtime PASS from the 48/48 supplementary runner;
- do not re-implement 1B/3B primary blindly if remote confirms `3f04f4a` already did it;
- do not ignore the new 1B-fielding / first-base-cover gap;
- do not make expected-primary metadata authoritative;
- do not resume JS R2/R3, M1, P1, or PR #32 automatic integration;
- do not mark Issue #30 or #33 closed.
