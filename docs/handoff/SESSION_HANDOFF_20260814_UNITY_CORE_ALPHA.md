# Session Handoff — Unity Core Alpha / Grok Build

Date: 2026-08-14
Repository containing this handoff: `L-carp55/baseball3d-game`
Research branch: `agent/research-baseball-motion-ai`
Authority: GitHub remote for the JS/reference repository plus exact owner/Grok reports captured here. Unity source is still local-only until a private `baseball3d-unity` remote is published.

## Executive state

Primary implementation worker is **Grok Build**. Codex local/CLI is fallback. Browser GPT owns architecture/tasking/independent red-team; owner owns gameplay/visual acceptance.

Development policy changed to **batched autonomous `/goal`**:
- Grok may continue across several meaningful milestones;
- leave clean checkpoint commits;
- do not merge merely because checkpoints exist;
- Browser GPT reviews a coherent batch later;
- target roughly 4–8 meaningful checkpoint commits or one coherent major milestone per review batch;
- old test/build results are never evidence for a newer HEAD;
- larger batch is not complete until current-HEAD Unity test/build gates actually run.

## 1. JS reference/oracle

Repository: `L-carp55/baseball3d-game`.

Canonical gameplay ancestor:
- `agent/b0805-29-possession-footwork`
- `60b993b73fed854934a976e45e8feb9437deb584`
- BUILD `b0805-29`

Owner recording observed BUILD `b0805-30` on 2026-08-13.

R1/R1a/R1b batted-ball identity recovery:
- R1 implementation `bee15b6594498ef91440b9629604cdac18430c6d`, final `5088aeefd0ee632282c36120185dcc97ff2fc880`
- R1a implementation `90514d7b592b63a993a1374eb6a905c9e4e38880`, final `de8dcd6175ed866a9f96f5768c228eec1b53fb6d`
- R1b implementation `4d1b9f039b3f6028f31290eb1f69848890539700`, final `33b5518a3eb9e76e6525dc7e23556c55ed88ec5d`
- Browser GPT independent verdict through R1b: **APPROVED as implementation candidate**
- independent audit: `docs/audits/b0805_30_owner_closure_r1b_browser_redteam_20260814.md`

Issue #33 remains open because integration/owner verification is separate from implementation review.

Known semantic debt carried into Unity instead of starting JS R1c now:
- contact-time physical category uses `la<=5 -> ゴロ`;
- existing caught-air semantics can label an unlanded very-low-angle ball `ライナー`.

## 2. JS work deliberately paused

Do not automatically resume while Unity is being developed:
- JS R2/R3
- PR #32 automatic integration
- Issue #30 implementation in JS
- M1 Final Validation
- P1/E1/F1/P2

Issue #30 requirements remain Unity acceptance requirements if Unity is adopted:
- RunnerContact / TagEvent
- complete ThrowRoute / relay progress / cycle prevention
- HOLD_BALL
- chase + cover joint assignment
- FieldingExecution / BallPossession
- rundown receive/transfer timing
- stationary-ball retarget / removal of time-only possession
- run-through pickup / athletic scoop
- foul-side wall topology
- geometric RundownAdmission
- possession-to-display lifecycle

Known JS relay-loop failure:
`1B -> 2B -> RF -> 2B -> RF -> 2B -> RF -> P`

A throw-count watchdog is not considered a repair.

## 3. Unity architecture policy

Policy source:
- `docs/unity/AI_WORKER_POLICY_20260813.md`

Core rules:
- do not translate the giant JS file literally;
- deterministic Core/Simulation separate from Unity Presentation;
- Unity physics engine is not sole gameplay authority;
- presentation reads authoritative simulation state;
- avoid hidden manual Editor state;
- Grok/Codex use the same automation scripts;
- owner acceptance required for visual/game-feel claims;
- worker self-report is not final approval.

## 4. U0 bootstrap — earlier local checkpoint

Reported at U0:
- bootstrap PASS, Editor automation generated `Assets/Baseball/Scenes/U0Prototype.unity`
- EditMode 4/4 PASS
- PlayMode 2/2 PASS
- `unity-validate.ps1` PASS
- Windows Mono development build PASS
- Unity audit `docs/audits/U0_BOOTSTRAP_AUDIT_20260813.md`
- Unity handoff `docs/handoff/CURRENT_STATE.md`

Installed build support reported: Windows standalone + WebGL. Android/iOS/Windows IL2CPP/Linux/Mac/UWP not installed.

These are historical U0 results only.

## 5. Earlier U4.5a checkpoint — Input configuration repair

Earlier exact local checkpoint:
`d234bd7df8fad9e49cc1de273e8e77d1c4f4865e`

Status: committed, not merged, provisional, not independently inspectable yet.

Reported fix:
- Input System package was removed but `activeInputHandler: 1` remained;
- orphaned Actions reference remained;
- changed to `activeInputHandler: 0`;
- removed orphaned Actions reference;
- preserved Legacy keyboard `Space/R/T/C` and IMGUI mouse UI;
- no exception suppression;
- Core/Simulation diff versus parent reported empty.

At this checkpoint, static fixture/config checks and `unity-validate.ps1` passed. Unity runtime tests/build were environment-blocked and old results were explicitly not reused.

## 6. LATEST local checkpoint — five-role grounder assignment

A later Grok result arrived after the first handoff draft and supersedes the prior statement that 1B/3B primary assignment still needed implementation.

Reported branch:
`agent/unity-u0-bootstrap`

Reported implementation commit prefix:
`3f04f4a` — `Core: assign grounder primary from intercept and ReachModel`

Reported record/follow-up prefix:
`f1d2292`

Latest exact reported local HEAD:
`f1d2292244178d1e630423a4e7fdeef459fee9a3`

Status:
- local-only
- not merged
- Browser GPT has not independently inspected ancestry/diff yet

### Reported architecture

Old authority:
- `Diamond.AssignPrimaryForGrounder(spray)` with fixed `>8° -> 2B`, `<-8° -> SS`, otherwise `P`
- 1B and 3B could never be primary

Reported new authority:
- `Assets/Baseball/Core/FieldingAssignment.cs`

Reported flow:
1. `BallPhysics.cs` predicts the rolling ball using the same equations as production `PlaySimulation`;
2. `ReachModel.cs` computes fielder arrival time from reaction + acceleration + running;
3. P / 1B / 2B / 3B / SS compete for reachable intercept points;
4. earliest feasible fielder becomes primary;
5. pitcher is constrained from chasing beyond the mound-front area into middle-infielder depth.

Fixture inputs reportedly contain only batted-ball contact values (EV/LA/spray); expected primary is not fed into simulation.

### Reported required fixtures

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

Reported boundary behavior:
- moving the nearby defender toward the predicted batted-ball point flips 1B/2B or 3B/SS assignment;
- intended as evidence that assignment is not a fixed coordinate/spray-role table;
- old angle table would select 2B for +42° and SS for -42°, while new model reports 1B/3B.

Golden 91mph / 1° / spray19° remains 2B and an out.

U1–U4 EditMode tests reportedly remain present.

## 7. Latest verification evidence

At latest local HEAD `f1d2292244178d1e630423a4e7fdeef459fee9a3`, Grok reported:
- `scripts/unity-validate.ps1`: PASS
- shipped Core/Simulation + EditMode tests executed outside the normal Unity Editor test script using the same NUnit attributes: **48/48 PASS**

Evidence boundary:
- this 48/48 is useful supplementary evidence but is **not equivalent** to `scripts/unity-test.ps1` completing under Unity Editor;
- `scripts/unity-test.ps1` did not complete;
- reported blocker: Unity `6000.5.8f1` was also being used by Luna's U4.5a worktree, preventing IL post-processing from starting; retry after the other run ended still failed at that stage;
- Grok did not terminate unrelated Unity projects/processes;
- PlayMode Editor tests were not rerun;
- current-HEAD Windows/WebGL build was not reported successful.

Do not cite earlier 29 EditMode / 4 PlayMode or old builds as current evidence.

## 8. New structural gap exposed by valid 1B primary

Grok explicitly reported:

> If 1B fields the grounder, CPU still throws to first, but who covers first is outside this change.

This is now the next high-priority gameplay architecture gap.

Defense needs **joint primary + cover assignment**, especially when 1B leaves the bag to field. A legal first-base receiver/cover (often P depending on live geometry/play) must be assigned explicitly; do not allow an uncovered-base throw or pretend the 1B can field and simultaneously cover.

This directly matches the known Issue #30 chase + cover joint-assignment requirement.

Do not special-case fixture names or expected-primary metadata. Cover derives from live defensive roles/geometry.

## 9. Luna / concurrency note

Grok reported it did not inspect or merge:
`agent/luna-u4_5-owner-playtest-layer`

Do not assume compatibility/ancestry until actual Git history is inspected. Do not destructively kill unrelated Unity sessions merely to obtain test green; coordinate a clean test window.

## 10. Critical GitHub gap

As of the latest GitHub check on 2026-08-14, account `L-carp55` still has no accessible `baseball3d-unity` repository.

Therefore neither `d234bd7...` nor latest exact HEAD `f1d2292244178d1e630423a4e7fdeef459fee9a3` is independently recoverable/reviewable from GitHub yet.

First task before GitHub-only continuation:
1. create private `L-carp55/baseball3d-unity` from the **existing local repo**;
2. preserve its current history/branches;
3. do not create a fresh project;
4. do not rebase/squash/reset/force-push to make history pretty;
5. push enough history/branches to recover latest HEAD and earlier checkpoints;
6. verify remote reachability of `f1d2292244178d1e630423a4e7fdeef459fee9a3` and, if part of ancestry, `d234bd7...`.

Publish task:
- `docs/unity/TASK_PUBLISH_EXISTING_UNITY_REPO_20260814.md`

## 11. Batched `/goal` priority after remote publication

Do not blindly assign “implement 1B/3B primary” again. Remote inspection should first verify `3f04f4a`/latest HEAD.

Priority after verification:
1. independently verify five-role assignment code/tests on remote;
2. implement primary + base-cover coordination, especially 1B-fields -> first-base cover;
3. restore current-HEAD Unity Editor tests/build execution;
4. improve assignment boundary realism if review/tests reveal issues;
5. explicit BallPossession;
6. FieldingExecution;
7. ThrowRoute progress/cycle prevention;
8. HOLD_BALL;
9. receive -> transfer timing;
10. RunnerContact / TagEvent;
11. close-play authority;
12. debugging/observability.

When environment is healthy, run against current HEAD:
- full EditMode
- full PlayMode
- `unity-validate.ps1`
- Windows Development Build
- WebGL Development Build if already supported
- runtime smoke check

## 12. Review / merge policy

- preserve meaningful checkpoint commits;
- no automatic merge;
- no force-push merely to tidy history;
- roughly 4–8 meaningful checkpoints per review batch is appropriate;
- Browser GPT performs batched independent red-team after coherent batch + current-code validation;
- revert to per-commit stop/review only for high-severity contract defects or genuinely risky actions.

## 13. Next-session recovery order

1. read `docs/handoff/CURRENT_STATE.md`;
2. read this file;
3. read `docs/handoff/NEXT_SESSION_PROMPT_20260814.md`;
4. inspect whether private `baseball3d-unity` exists;
5. if yes, verify exact branch/HEAD/ancestry, ensure `f1d2292244178d1e630423a4e7fdeef459fee9a3` is reachable, then inspect `FieldingAssignment.cs`, `BallPhysics.cs`, `ReachModel.cs`, fixtures/tests and commits around `3f04f4a`/`f1d2292`;
6. if no, publish existing local Unity repo first without rewriting history;
7. continue batched `/goal` development from remote truth.

## 14. Do not automatically do

- do not merge Unity checkpoints before the batch gate;
- do not recreate Unity project to solve missing remote;
- do not rewrite local Unity history when publishing;
- do not claim Unity Editor tests/build passed from the 48/48 supplementary runner;
- do not blindly redo 1B/3B primary work if remote confirms it already exists;
- do not ignore the 1B-fielding / first-base-cover gap;
- do not make expected-primary metadata authoritative simulation input;
- do not resume JS R2/R3, M1/P1, or PR #32 automatic integration;
- do not mark Issue #30/#33 closed.
