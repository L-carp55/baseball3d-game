# Baseball3D CURRENT STATE

Last updated: 2026-08-14
Authority: current GitHub remote + independent Browser GPT audits. For Unity local-only facts that have not yet been pushed, this file records the exact owner/Grok report but does not pretend the source is independently inspectable.

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

Development now uses **batched autonomous `/goal` work**, not stop/review after every checkpoint.

Rules:

- preserve meaningful checkpoint commits;
- do not merge merely because a checkpoint exists;
- target roughly 4–8 meaningful checkpoints or one coherent major milestone per Browser GPT review batch;
- do not weaken/delete tests to obtain green;
- do not use old test/build results as evidence for a newer HEAD;
- if runtime validation is environment-blocked, record that accurately and continue safe static/architectural work;
- larger batch is not complete until current-HEAD runtime/test/build gates actually run.

## 2. JS reference/oracle — R1/R1a/R1b gate passed

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

R1b makes actual launch height explicit in the physical batted-ball identity path. Issue #33 is **not CLOSED** because integration/owner verification remains distinct from implementation review.

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

Issue #30 requirements remain acceptance requirements if Unity is adopted, including RunnerContact/TagEvent, complete ThrowRoute, cycle prevention, HOLD_BALL, chase+cover, FieldingExecution/BallPossession, rundown receive/transfer, stationary-ball retarget, run-through pickup, wall topology, RundownAdmission, and possession-to-display lifecycle.

Known relay-loop failure to prevent:

`1B -> 2B -> RF -> 2B -> RF -> 2B -> RF -> P`

A throw-count watchdog is not a real solution.

## 4. Unity repo status — CRITICAL

The Unity implementation exists in a separate local Git repo/project (`baseball3d-unity`).

As of 2026-08-14, GitHub account `L-carp55` has **no accessible repository named `baseball3d-unity`**, and `baseball3d-game` has no Unity branch.

Therefore Unity source/history through the latest reported local checkpoint is **not yet on GitHub** and cannot yet be independently reviewed by Browser GPT.

First recovery/upload action before relying on GitHub-only continuation:

1. create a **private** GitHub repo for the existing local `baseball3d-unity` repo;
2. preserve existing local history — do not create a new Unity project or rewrite history;
3. add `origin` and push all branches/history needed for recovery;
4. do not merge as part of upload;
5. verify latest local checkpoint is reachable remotely.

## 5. Unity U0 local bootstrap — completed earlier checkpoint

Reported U0 results at that checkpoint:

- bootstrap PASS, generated `Assets/Baseball/Scenes/U0Prototype.unity` through Editor automation
- EditMode 4/4 PASS
- PlayMode 2/2 PASS
- `unity-validate.ps1` PASS
- Windows Mono development build PASS
- Unity-side audit: `docs/audits/U0_BOOTSTRAP_AUDIT_20260813.md`
- Unity-side handoff: `docs/handoff/CURRENT_STATE.md`

Reported build support installed:

- Windows standalone
- WebGL

Not installed:

- Android
- iOS
- Windows IL2CPP
- Linux
- Mac
- UWP

These U0 results are historical checkpoint evidence only and must not be cited as proof for newer Unity commits.

## 6. Current Unity local-only checkpoint — U4.5a

Latest exact local Unity commit reported this session:

`d234bd7df8fad9e49cc1de273e8e77d1c4f4865e`

Status:

- committed
- not merged
- **PROVISIONAL CHECKPOINT**
- not independently inspectable on GitHub yet

Reported immediate Input root cause/fix:

- Input System package had been removed but `activeInputHandler: 1` and an orphaned Actions reference remained;
- set `activeInputHandler: 0`;
- removed orphaned Actions reference;
- kept Legacy keyboard `Space / R / T / C`;
- kept IMGUI mouse UI;
- added no exception suppression.

Reported Core/Simulation diff for this checkpoint versus its parent: empty.

## 7. U4.5a grounder fixture coverage

Reported fixture set:

| Fixture | EV | LA | Spray | Core expected primary |
|---|---:|---:|---:|---|
| golden | 91 | 1° | 19° | 2B |
| Pitcher front | 84 | 0° | 0° | P |
| Pitcher front / slow roller | 58 | 0° | 2° | P |
| Second-base side / hard grounder | 108 | 0° | 24° | 2B |
| Shortstop side / close play | 94 | -1° | -14° | SS |
| Shortstop side | 78 | 1° | -22° | SS |

Reported fixture contract:

- all six contact definitions are unique;
- fixture does not retain/force expected primary into simulation;
- HUD shows fixture name, EV, LA, spray, expected primary, actual primary.

## 8. Mandatory next Core gap — 1B / 3B assignment

Current `Diamond.AssignPrimaryForGrounder` reportedly returns only:

- P
- 2B
- SS

It does not yet assign 1B or 3B.

This is `GROK_REQUIRED` and must not be hidden by fixture selection.

Extend real deterministic Core/Simulation competition to at least:

- P
- 1B
- 2B
- 3B
- SS

Requirements:

- expected-primary fixture metadata is expectation only, never simulation input;
- add first-base-line / first-baseman-side fixture;
- add third-base-line / third-baseman-side fixture;
- add boundary/competition cases where two fielders are plausible;
- avoid making the final model a simplistic hard-coded spray-angle role partition;
- use deterministic geometry/reach/fielding suitability;
- add adverse/mutation detection where practical.

## 9. Current U4.5a verification state

Current-code results reported:

- static fixture/config checks: PASS
- `unity-validate.ps1`: PASS

Current-code runtime gates are **ENVIRONMENT-BLOCKED** due Unity Licensing Client / Package Manager IPC failure:

- EditMode: stopped before discovery
- PlayMode: stopped before discovery
- Windows Development Build: not generated
- runtime Console confirmation: not available because no new build

Do **not** reuse older results (reported previous 29 EditMode / 4 PlayMode or old build) as evidence for U4.5a or later HEAD.

IPC diagnosis may proceed non-destructively. Do not destructively remove license/credentials/project data without owner approval.

When IPC is healthy, run against **current HEAD**:

- full EditMode
- full PlayMode
- `unity-validate.ps1`
- Windows Development Build
- WebGL Development Build if supported by already-installed module
- runtime smoke check

## 10. Active batched `/goal` priority after remote upload

Continue autonomously instead of stopping after every small checkpoint.

Priority:

1. complete P/1B/2B/3B/SS ground-ball primary assignment
2. fielding assignment quality
3. explicit BallPossession
4. FieldingExecution
5. ThrowRoute progress / cycle prevention
6. HOLD_BALL
7. receive -> transfer timing
8. RunnerContact / TagEvent
9. close-play authority
10. debugging / observability

Do not use visual polish to hide missing Core behavior.

## 11. Review / merge gate

`d234bd7...` and later checkpoints are not automatically approved.

Use checkpoint commits for recovery/bisect/review, but do not merge merely because they exist.

Browser GPT performs a batched independent review after a coherent milestone group and current-code validation are ready. Return to per-commit stop/review only for a high-severity contract defect or genuinely risky operation.

## 12. Recovery order for the next Browser GPT session

1. read this file;
2. read `docs/handoff/SESSION_HANDOFF_20260814_UNITY_CORE_ALPHA.md`;
3. read `docs/handoff/NEXT_SESSION_PROMPT_20260814.md`;
4. inspect whether private `baseball3d-unity` now exists on GitHub;
5. if it exists, verify ancestry/HEAD and ensure `d234bd7...` is reachable before continuing;
6. if absent, first publish the existing local Unity repo without rewriting history;
7. continue batched `/goal` development using current remote truth.

## DO NOT automatically do now

- do not merge Unity checkpoints before the batch gate;
- do not recreate the Unity project to solve missing remote;
- do not rewrite local Unity history when publishing it;
- do not claim current runtime PASS from stale results;
- do not work around missing 1B/3B assignment through fixture selection;
- do not make expected-primary metadata authoritative;
- do not resume JS R2/R3, M1, P1, or PR #32 automatic integration;
- do not mark Issue #30 or #33 closed.
