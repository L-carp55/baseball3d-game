# Session Handoff — Unity Core Alpha / Grok Build

Date: 2026-08-14
Repository containing this handoff: `L-carp55/baseball3d-game`
Research branch: `agent/research-baseball-motion-ai`
Authority: GitHub remote for the JS/reference repository plus exact owner/Grok reports captured here. The Unity repository is still local-only at the time of this handoff, so do not invent remote Unity state.

## 0. Executive state

Primary implementation worker is **Grok Build**. Codex local/CLI is fallback. Browser GPT owns architecture/tasking/independent red-team and the owner owns gameplay/visual acceptance.

The development process changed during this session from fine-grained stop/review after every task to **batched autonomous development**:

- Grok `/goal` may continue across several meaningful milestones.
- Preserve clean checkpoint commits.
- Do not merge checkpoint branches merely because a checkpoint exists.
- Browser GPT reviews a coherent batch later instead of blocking every small milestone.
- Target review batch size: roughly 4–8 meaningful checkpoint commits, or one coherent major milestone.
- Full current-code EditMode/PlayMode/validation/build evidence is required before the larger batch is declared complete.
- Old test/build results must never be reused as evidence for a newer commit.

## 1. JS reference/oracle state

Repository: `L-carp55/baseball3d-game`

Canonical gameplay ancestor remains:

- branch: `agent/b0805-29-possession-footwork`
- SHA: `60b993b73fed854934a976e45e8feb9437deb584`
- BUILD: `b0805-29`

Owner-played current JS build observed in the 2026-08-13 recording: `b0805-30`.

### R1 -> R1a -> R1b batted-ball identity recovery

R1:

- branch: `claude/b0805-30-owner-closure-r1-batted-ball-identity`
- implementation: `bee15b6594498ef91440b9629604cdac18430c6d`
- final HEAD: `5088aeefd0ee632282c36120185dcc97ff2fc880`

R1a:

- branch: `claude/b0805-30-owner-closure-r1a-classifier-compat`
- implementation: `90514d7b592b63a993a1374eb6a905c9e4e38880`
- final HEAD: `de8dcd6175ed866a9f96f5768c228eec1b53fb6d`

R1b:

- branch: `agent/b0805-30-owner-closure-r1b-contact-height-compat`
- implementation: `4d1b9f039b3f6028f31290eb1f69848890539700`
- final HEAD: `33b5518a3eb9e76e6525dc7e23556c55ed88ec5d`
- Browser GPT independent verdict: **APPROVED as implementation candidate**
- independent audit: `docs/audits/b0805_30_owner_closure_r1b_browser_redteam_20260814.md`

R1b repaired contact-time physical classification so production `startFlight()` passes its actual launch height to the apex/classification path instead of relying on fixed `z=1.4`.

Important: this does **not** close Issue #33. Project closure still requires integration/owner verification where applicable.

Known semantic debt to carry into Unity instead of starting JS R1c now:

- contact-time classifier uses `la<=5 -> ゴロ`;
- existing caught-air classifier can call an unlanded very-low-angle ball `ライナー`.

Unity should choose and test one coherent physical-category definition.

## 2. JS work that remains paused

Do not automatically resume these while the Unity path is being evaluated/developed:

- JS owner-closure R2/R3
- PR #32 automatic integration
- Issue #30 implementation in JS
- M1 Final Validation
- P1/E1/F1/P2

Issue #30 structural requirements must not be forgotten if Unity is adopted. They include:

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

Known relay-loop failure from JS recording:

`1B -> 2B -> RF -> 2B -> RF -> 2B -> RF -> P`

A throw-count watchdog is not considered a real fix.

## 3. Unity migration policy

Unity implementation is a separate project/repository named/suggested as `baseball3d-unity`.

Policy source in the JS/reference repo:

- `docs/unity/AI_WORKER_POLICY_20260813.md`

Key rules:

- do not port the giant JS file literally;
- deterministic Core/Simulation should be separated from Unity presentation;
- Unity Rigidbody/PhysX must not become the sole authority for baseball gameplay physics;
- presentation should read simulation state rather than own the authoritative result;
- no hidden manual Editor state where automation/version-controlled state can be used;
- Grok Build and Codex should use the same automation scripts;
- owner visual/game-feel acceptance is required for visual claims;
- checkpoint self-reports are not final approval.

## 4. Unity U0 — completed local bootstrap checkpoint

U0 was completed locally before the batched-review policy was adopted.

Reported local results:

- `bootstrap`: PASS
  - Editor automation generated `Assets/Baseball/Scenes/U0Prototype.unity`
- `tests`: PASS at that U0 checkpoint
  - EditMode 4/4
  - PlayMode 2/2
- `unity-validate.ps1`: PASS
- Windows development build: PASS
  - `Builds/Windows/baseball3d-unity.exe` (gitignored)
- Unity-side audit: `docs/audits/U0_BOOTSTRAP_AUDIT_20260813.md`
- Unity-side handoff: `docs/handoff/CURRENT_STATE.md`
- branch at that stage: `agent/unity-u0-bootstrap`
- worktree reported clean

U0 environment notes reported by Grok:

- first bootstrap initially failed because template packages produced `CS0619` errors after package changes;
- U0-unneeded Input System / Timeline / AI Navigation / Collab Proxy packages were removed;
- installed build support included Windows standalone and WebGL;
- Android, iOS, Windows IL2CPP, Linux, Mac, UWP were not installed;
- U0 build used Windows Mono standalone;
- no modules were silently installed.

Do not use these U0 test/build results as evidence for later Unity commits.

## 5. Development mode changed to batched `/goal`

The user explicitly requested faster development and fewer stop/review cycles.

Approved working model:

```text
checkpoint A
-> checkpoint B
-> checkpoint C
-> checkpoint D
-> current-HEAD full validation
-> batched Browser GPT red-team
```

Grok should continue autonomously through routine engineering decisions and stop early only for genuinely destructive/irreversible actions, owner design choices, credentials, data-loss risk, or an architectural contradiction that cannot be resolved within scope.

Do not weaken/delete tests to get green. If runtime validation is temporarily environment-blocked, preserve tests and record the blocker accurately.

## 6. Current Unity local-only checkpoint — U4.5a

Latest exact Unity commit reported by Grok/owner in this session:

`d234bd7df8fad9e49cc1de273e8e77d1c4f4865e`

Status:

- committed locally
- **not merged**
- treat as **PROVISIONAL CHECKPOINT**, not approved and not rejected
- Unity GitHub remote is still absent from the GitHub repositories accessible to Browser GPT as of 2026-08-14
- therefore Browser GPT cannot independently inspect this commit yet

### What `d234bd7...` changed

Reported root cause for the immediate Input issue:

- Input System package had been removed;
- `activeInputHandler: 1` remained;
- an orphaned Actions reference remained;
- this was inconsistent with `UnityEngine.Input` / Legacy Input usage.

Reported fix:

- set `activeInputHandler: 0`;
- remove the orphaned Actions reference;
- preserve Legacy keyboard controls `Space / R / T / C`;
- preserve IMGUI mouse UI;
- no exception suppression was added.

Reported scope statement:

- Core/Simulation changes in this checkpoint: none;
- diff to the parent for Core/Simulation: empty.

### Ground-ball fixture/config coverage at this checkpoint

Reported fixtures:

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
- fixture data does **not** retain/force the expected primary into simulation;
- HUD shows fixture name, EV, LA, spray, Core expectation, and actual primary.

### Current fielding-assignment limitation — mandatory follow-up

`Diamond.AssignPrimaryForGrounder` currently returns only:

- P
- 2B
- SS

It does **not** yet independently assign 1B or 3B.

This was explicitly marked `GROK_REQUIRED` and must not be worked around by selecting only fixtures that avoid 1B/3B.

The real Core/Simulation assignment model must be extended to deterministic, realistic competition across at least:

- P
- 1B
- 2B
- 3B
- SS

Expected primary must remain fixture expectation only, not an input to Core assignment.

Add coverage for first-base-line / first-baseman-side and third-base-line / third-baseman-side grounders, plus competition/boundary cases where two fielders are plausible. Avoid a simplistic hard-coded spray-angle partition as the final model; use deterministic baseball geometry/reach/fielding suitability.

## 7. Current verification state at `d234bd7...`

Reported current-code checks:

- static fixture/config checks: PASS
- `unity-validate.ps1`: PASS

Current-code runtime/test/build verification is **ENVIRONMENT-BLOCKED**, not PASS and not yet evidence of code failure:

- EditMode: stopped before test discovery due Unity Licensing Client / Package Manager IPC failure
- PlayMode: same IPC failure before test discovery
- Windows Development Build: not generated due same IPC failure
- Development Console runtime confirmation: unavailable because no new build was generated

Do **not** cite older pre-U4.5a results as evidence for `d234bd7...` or later HEADs.

Grok explicitly reported that previous results (29 EditMode / 4 PlayMode and the previous build) are older than U4.5a and therefore not accepted as current evidence.

## 8. Unity IPC blocker handling

The Unity Licensing Client / Package Manager IPC problem may be diagnosed/recovered non-destructively while development continues.

Allowed examples:

- inspect Unity / licensing / package manager logs;
- detect stale/concurrent Unity automation processes;
- cleanly stop/restart ordinary Unity/Hub/licensing processes when safe;
- retry batchmode after normal process cleanup;
- verify whether a minimal project initializes.

Do not delete licenses, credentials, project data, or machine-wide caches destructively without owner approval.

If IPC remains broken, record it accurately and continue static/architectural work that is safe to do without runtime execution. However, do not declare the larger batch complete or merge until current-HEAD test/build gates run successfully.

## 9. Next autonomous development requirements

Continue the active `/goal` rather than stopping for Browser GPT at every checkpoint.

Priority 1 — complete real five-role infield grounder assignment:

- P / 1B / 2B / 3B / SS
- deterministic geometry/reach/fielding suitability
- fixture expected-primary metadata must not influence output
- include boundary/competition cases
- add adverse/mutation detection where practical (e.g. make 1B or 3B unreachable and ensure suite detects it)

Then continue structural Core Alpha requirements, prioritizing:

- fielding assignment quality
- explicit BallPossession
- FieldingExecution
- ThrowRoute progress / cycle prevention
- HOLD_BALL
- receive -> transfer timing
- RunnerContact / TagEvent
- close-play authority
- debugging / observability

Do not spend visual polish merely to hide missing Core behavior.

When Unity IPC becomes healthy, immediately run against **current HEAD**:

- full EditMode suite
- full PlayMode suite
- `unity-validate.ps1`
- Windows Development Build
- WebGL Development Build if installed/supported without adding modules
- runtime smoke check

Fix real failures before calling the batch complete.

## 10. Git / review policy from this point

- preserve checkpoint commits;
- no automatic merge;
- no force-push merely to tidy history;
- no dozens of noisy commits;
- roughly 4–8 meaningful checkpoints per review batch is a good target;
- Browser GPT performs batched red-team after the coherent batch and current-code validation are ready.

## 11. CRITICAL GitHub gap at session handoff

As of this handoff, GitHub account `L-carp55` has **no accessible repository named `baseball3d-unity`**, and `baseball3d-game` has no `unity` branch.

Therefore the Unity source/history through local commit `d234bd7df8fad9e49cc1de273e8e77d1c4f4865e` is **not yet independently recoverable from GitHub**.

This is the first task to close before relying on GitHub-only continuation:

1. create a **private** GitHub repository for the existing local `baseball3d-unity` repository;
2. add it as `origin` without rewriting local history;
3. push all local branches/history needed for recovery, including the branch containing `d234bd7...`;
4. do not merge anything merely as part of the upload;
5. verify `git status`, remote branch HEADs, and that `d234bd7...` is reachable remotely;
6. then Browser GPT can independently inspect Unity commits in later sessions.

Do not create a fresh Unity project and copy files into it. Preserve the existing local Git history.

## 12. Next-session recovery order

A new Browser GPT session should:

1. read `docs/handoff/CURRENT_STATE.md` on `agent/research-baseball-motion-ai`;
2. read this file;
3. read `docs/handoff/NEXT_SESSION_PROMPT_20260814.md`;
4. inspect GitHub for the newly pushed `baseball3d-unity` private repo;
5. if it exists, verify remote ancestry/HEAD and inspect `d234bd7...` plus later checkpoints before giving implementation instructions;
6. if it still does not exist, the first action is to have Grok publish the existing local Unity repository without rewriting history;
7. continue batched `/goal` development; do not revert to per-commit stop/review unless a high-severity contract defect is found.

## 13. Do not do automatically

- do not merge Unity checkpoints before batched review/full current-code gates;
- do not resume JS R2/R3 simply because a Unity runtime gate is temporarily blocked;
- do not resume M1/P1;
- do not merge PR #32 automatically;
- do not mark Issue #30 or #33 closed;
- do not discard local Unity history when creating the remote;
- do not claim `d234bd7...` tests/build passed using older results;
- do not work around 1B/3B assignment by excluding those plays from fixtures;
- do not make fixture expectation authoritative simulation input.
