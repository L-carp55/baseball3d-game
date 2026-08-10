# Baseball3D complete handoff — 2026-08-10

Repository: `L-carp55/baseball3d-game`

This document is the **canonical handoff for the 3D baseball game work discussed in the browser-GPT session on 2026-08-09〜2026-08-10**.

It exists so a new chat can reconstruct the exact current state from GitHub without relying on the old conversation.

---

## 0. Project boundary — read this first

This repository is the **interactive/manual 3D baseball game** implemented mainly in `baseball3d.html`.

It is **NOT** the separate PowerPro player-rating / pennant-simulator project.

Do not use the following as the source of truth for this task:

- パワプロ査定 formulas
- player ability appraisal tables
- NPB/MLB rating conversion work
- the TypeScript + SQLite pennant simulator
- uploaded `00_READ_ME_FIRST.md`, `01_SRC_CODE.md`, `02_SCRIPTS.md`, etc. from the appraisal project

Those belong to a different project and were accidentally present in the browser project context. The game-research task file explicitly excludes them.

---

## 1. Current source of truth

### Gameplay implementation head

- branch: `agent/b0805-29-possession-footwork`
- head SHA at handoff creation: `60b993b73fed854934a976e45e8feb9437deb584`
- BUILD: `b0805-29`
- Draft PR: #23
- PR status: open / Draft / not merged

This branch contains the current gameplay implementation to inspect before any further code change.

### Research / Codex coordination head

- branch: `agent/research-baseball-motion-ai`
- based directly on `agent/b0805-29-possession-footwork`
- Draft PR: #29
- PR status: open / Draft / not merged
- game body is intentionally unchanged on this research branch

### Codex task source of truth

**Path to give Codex:**

`docs/research/CODEX_BASEBALL3D_REALISM_RESEARCH_TASK_20260810.md`

Branch:

`agent/research-baseball-motion-ai`

Supporting source seed:

`docs/research/baseball_realism_source_seed_20260810.md`

Umbrella research issue:

- #24 `Codex research program: 実測・OSSベースで野球ゲーム品質を再設計する`

Parallel Codex subtasks:

- #25 投手・打撃モーション / biomechanics / mocap
- #26 守備AI / 打球追跡 / multi-agent decision
- #27 捕球・送球・フットワーク / animation state machine
- #28 打球・送球物理 / collision / game-wide quality

The explicit requirement is to use **four independent Codex subagents in parallel**, not one agent sequentially doing everything.

---

## 2. Important PR / branch chain

### b23 — shared DefenseActionPolicy

Historical implementation PR:

- PR #15 `b0805-23: 守備行動を即決型から比較評価型へ統合`

Validation PR:

- PR #16

Core architectural change:

- throw / catch / rundown decisions moved toward one comparative utility layer
- candidate actions are ranked using ETA, success probability, out/run-prevention value, risk and wait value
- this was intended to remove duplicated local decision logic

Verified validation reported in PR #16:

- 138/138 recording corpus PASS
- 1000-ball route validation PASS
- mean route ratio 1.0421
- p95 1.1856
- >1.25 ratio 4.39%
- nontermination 0
- 50/50 full games completed

Do not assume automated PASS means visuals are correct; owner playtest remains required for feel/animation bugs.

### b24 — batted-ball classification / play integrity

Historical PR:

- PR #17
- validation PR #18

The key design decision was to separate:

1. original physical batted-ball type
2. whether current defenders can catch it before landing

Before this, low liners could become “grounders” merely because `canCatchAir=false`.

Do not reintroduce classification from catch feasibility or later landing state.

### b25 — individual runner controls / sliding base

Canonical base used by b26:

- branch: `agent/b0805-25-runner-controls-sliding-base`
- SHA: `3bbdfe247bfc1b4a0858343b8d161fa0fa171dca`

Runner-control contract:

- `S` = all live runners advance
- `X` = all live runners return
- `Z` = frontmost runner advance
- `A` = frontmost runner return
- `C` = rearmost runner advance
- `D` = rearmost runner return

Front/rear is determined by physical progress, not array order.

Manual command semantics:

- manual intent locks out AUTO only
- later manual input may replace earlier manual input
- forced rule/result resolution may override manual intent

Sliding contract:

- 2B/3B when stopping: feet-first by default
- close 1B/home play: headfirst
- close return: headfirst
- no slide while rounding through a base

Any later fielding/AI rewrite must rerun runner-control/sliding regressions.

---

## 3. b26 — force-chain decision

Draft PR:

- PR #21
- branch: `agent/b0805-26-force-chain-decision`
- head SHA: `ea2475a6010be22057a648b8991f1869feceed2e`
- base: b25 branch above

User-reported failure:

- third baseman fielded a grounder with runner forced from 1B to 2B
- second base was covered
- defense still threw directly to 1B

Recording used:

- `野球ゲーム記録_20260809_213741.json`

Root cause:

- second base was not missing as a candidate
- throw utility only valued the **immediate first out**
- it did not value 2B force → transfer → relay to 1B as a multi-out continuation

Implemented concept:

- `doublePlayContinuation(...)`
- compare expected full force chain against direct 1B out
- model first-force probability, receiver transfer, relay throw, 1B cover and batter ETA
- choose 2B only when expected chain value beats direct 1B
- do not hardcode “always throw second”

Diagnostics added:

- expected outs `de`
- continuation probability `dc`

Dedicated test:

- `_test_force_chain_decision_20260809.js`

Validation reported for b26:

- browser baseline 51/51
- architecture / behavioral mutations detected
- validation branch reported 138/138 corpus, 1000 route stability, 50-game completion

Human playtest is still a separate acceptance gate.

---

## 4. b27 — IMPORTANT correction: not canonical

This is the biggest history trap in this session.

A browser session developed a **local candidate** for a richer catch-outcome model, including ideas such as:

- secure catch vs bobble / deflect / smother / drop / miss
- dive/jump recovery delay
- first-throw accuracy penalty after difficult catches
- arm-speed penalty after difficult catches
- grip bobble delay
- catch difficulty separate from official-error scoring
- transfer-stage recovery gate

However the browser assistant **prematurely reported b0805-27 as implemented/saved/fully validated**.

That was incorrect.

The actual GitHub canonical gameplay chain did **not** contain that completed b27 model.

Therefore:

- do NOT treat b27 as merged into current gameplay
- do NOT quote prior claims of full b27 CI / 138 corpus / 1000 / 50 games as verified
- do NOT base new work on a supposed b27 branch implementation

The conceptual work remains useful and is one reason issue #27 exists, but it must be re-designed/re-implemented from the real b29 source after the research phase.

The user still explicitly wants realistic catch-error diversity and difficult-catch recovery mechanics. This requirement remains open.

---

## 5. b28 — breakaway live play + transfer context

Draft PR:

- PR #22
- branch: `agent/b0805-28-breakaway-transfer-context`
- head SHA: `cbeb83bd60ff23d5f2b1343633540036290bb642`
- base: b26

### 5.1 Runner breakaway / “牽制” redesign

User observation:

- when runner moved early, old “pickoff” logic effectively locked the pitcher into the original base
- runner could keep advancing rather than return, while other runners also advanced
- this made the fixed-base pickoff behavior exploitable

Design change:

- display changed from `牽制！` to `飛び出した！`
- create a distinct `breakaway` live-play type instead of treating it as fixed pickoff-return logic
- pitcher with ball may evaluate 1B/2B/3B/home
- receiving fielder also reevaluates current threats
- home-advancing threat receives strong priority
- play remains live until runners are out or safely settled on legal bases
- historical `jumped=true` must not keep a runner in breakaway state after the runner has settled

### 5.2 Transfer context separation

Critical user design judgment:

Fielding ability G should be slow when processing a batted grounder because the fielder must:

- field the ball
- secure/grip it
- choose target
- restore throwing posture

But the same fielder should not need that full delay after an easy throw reception in:

- breakaway/pickoff
- relay
- rundown
- ordinary throw reception

So transfer preparation was split by context:

- `batted-ground`
- `batted-air`
- `pickoff-receive`
- `rundown-receive`
- `relay-receive`
- `throw-receive`
- `double-play-pivot`
- `held-ball`

Representative values reported with all defensive abilities=1:

- batted-ground: about 1.0846 s
- pickoff/breakaway receive: about 0.2287 s
- relay receive: about 0.3184 s
- ordinary throw receive: about 0.3182 s

The principle is more important than these exact numbers:

**fielding a batted ball and receiving an already-controlled throw are different motor tasks.**

Diagnostics added:

- `thr.pc` = possession/transfer context
- `thr.pt` = remaining preparation time

### 5.3 Rolling-handoff direction hysteresis

A one-frame direction hysteresis was added for ordinary rolling-ball assignment handoff so a fielder is not switched while the ball is still approaching.

Important nuance:

- wall reflection may reverse ball velocity inside one physics frame
- regression fixture was corrected to distinguish `rolling-handoff` from valid wall-reflection handoff

Reported CI:

- GitHub Actions run `31354897076`: success

Human playtest focus:

- multiple runners moving simultaneously after an early jump
- pitcher/receiver retargeting toward the actually dangerous base

---

## 6. b29 — possession footwork / stale intercept target

Current gameplay head.

Draft PR:

- PR #23
- branch: `agent/b0805-29-possession-footwork`
- head SHA: `60b993b73fed854934a976e45e8feb9437deb584`

User-reported visual/physical bug:

- second baseman bobbled a grounder
- recovered the ball
- then moved backward while throwing to first

This was **not just animation**.

Recording evidence showed:

- re-catch position roughly `(37.0, 135.9)`
- stale `intercept-replan` target roughly `(32.3, 146.7)`
- while already holding the ball and in throw preparation, the fielder continued moving toward the stale target
- throw occurred after actual coordinates had moved backward to about `(32.5, 146.4)`

Root cause:

- `beginThrowPhase()` moved state into transfer but did not clear previous pursuit target / movement
- `updateThrowPhase()` continued calling `moveFielders(dt,true)`
- the thrower therefore still obeyed old batted-ball pursuit AI while possessing the ball

Fix:

- add `prepareThrowerFootwork(T)`
- while `T.stage==='transfer'`:
  - reset old target to current location
  - zero old pursuit velocity
  - orient body toward current throw target
- run this before `moveFielders()` so there is no one-frame stale motion
- if target changes during transfer, update body orientation that frame

Do **not** freeze every possession state:

- `step` = fielder intentionally moves to touch a base → must still move
- `approach` = rundown fielder closes on runner → must still move
- `transfer` = securing throwing posture → must not continue old ball-pursuit target

Dedicated recording-based regression:

- `_test_thrower_footwork_20260810.js`
- fixture uses the actual recorded start and stale target coordinates
- removing the fix intentionally reproduces backward motion and is detected

Reported validation:

- focused contracts PASS
- architecture guard PASS
- RunnerIntent / FieldingAssignment / ReachModel / DefenseActionPolicy / force-chain PASS
- b28 breakaway/transfer context PASS
- possession-footwork regression + mutation PASS
- GitHub Actions `Baseball3D regression` run `31371859955`: completed / success
- existing 51-browser baseline + behavioral mutation suite PASS

Owner human visual check remains important.

---

## 7. Current bug taxonomy / diagnosis discipline

Before changing code for any new gameplay report, classify the failure into one of these categories:

1. candidate action missing
2. DefenseActionPolicy / utility scoring wrong
3. stale state enters otherwise-correct policy
4. physical execution after correct decision is wrong
5. display / animation mismatch
6. manual-control conflict

Do not immediately add a local `if` until the category is established.

For an uploaded gameplay recording, inspect frame-by-frame when present:

- throw target/by/reason/margin/utility
- b26 continuation diagnostics `de/dc`
- b28 possession context `pc/pt`
- ball/catch mode/outcome fields
- runners / intent / goals
- fielder assignment/role/target
- slide state

If the same visible bug survives an earlier claimed fix, do not defend the earlier implementation. Reopen root-cause analysis.

Automated tests are necessary but insufficient for animation/feel problems.

---

## 8. Architectural direction that should be preserved

The historical b14→b23 work progressively separated ownership of decisions.

Important existing boundaries:

- RunnerIntent
- FieldingAssignment
- ReachModel
- ThrowDecision
- DefenseActionPolicy
- PlayLifecycle

The next realism work should **improve observations, candidate generation, scoring and physical execution without collapsing these boundaries back into a giant scenario tree**.

The working root-cause model is:

> shared mutable state + duplicated domain decisions + local scenario patches + incomplete regression detection + stale/ambiguous ownership

b23 improved decision-policy centralization, but recent b26/b28/b29 failures show that:

- continuation value matters, not just immediate action
- live play must be reevaluated instead of keeping stale fixed objectives
- motor/possession context matters
- correct decision logic can still be undermined by stale movement/execution state

---

## 9. Realism research program now in progress

The user asked whether public code/research can improve realism, not just defense but the entire game, especially the visibly incorrect pitcher motion.

A research program was created instead of continuing local patches.

### Codex division of labor

#### #25 — Pitching / hitting biomechanics and mocap

Priority target: replace hand-authored pitcher pose curves.

Must examine:

- Driveline OpenBiomechanics Project
- OpenSim
- OpenCap
- Pose2Sim
- primary pitching kinematic-chain research

Current code areas to inspect include:

- `pitcherPoseK`
- `pitcherPose`
- `blendPitchPose`
- `drawFigure`
- batter swing/pose code

Goal is to determine a minimal data-derived motion representation suitable for 60fps WebGL, including event normalization such as foot contact / MER / ball release / follow-through.

Important license warning:

- OBP code: MIT
- OBP biomechanics data/docs: CC BY-NC-SA 4.0 / non-commercial constraints

Do not silently embed raw OBP motion data in a potentially commercial game.

#### #26 — Fielding AI / perceptual pursuit

Compare:

- LOT
- OAC
- newer unified/current-future interception research
- sports multi-agent architecture references
- public baseball game code

Provisional idea, not yet final:

- initial coarse physical prediction for assignment
- then observation-driven correction while ball is airborne
- avoid an AI that has perfect durable knowledge of exact future landing point

The Codex report must explicitly define what state a fielder is allowed to observe, to prevent future-information leakage.

#### #27 — Catch / throw / footwork state machine

This is where the unimplemented b27 concepts should be properly revisited.

Target state family includes:

- pursuit
- catch attempt
- secure possession
- bobble / knockdown / deflect / drop / miss
- posture recovery
- grip / transfer
- throw-ready
- release

Momentum, orientation, catch type and difficulty should survive across state transitions.

This work must explain:

- backward throw vs throw-on-run vs set-feet throw
- dive/jump/sliding recovery
- first-throw accuracy penalty
- relay/pickoff/rundown reception distinct from batted-ball fielding
- double-play pivot and catcher-specific transfer

#### #28 — Ball / throw physics + game-wide quality

Compare current implementation against:

- public baseball flight code
- Alan Nathan / baseball-flight research
- `dgrifka/baseball_game_simulator`
- relevant collision / ball-flight sources

Validation should move beyond “looks okay” to distributions by EV/LA/spray:

- hang time
- landing distance
- apex
- bounce speed/angle
- wall outcome
- throw flight time / height

The user explicitly said quality improvement should not be defense-only.

---

## 10. Browser-GPT provisional integration hypotheses

These are written in `docs/research/baseball_realism_source_seed_20260810.md` and must be treated as hypotheses to challenge, not conclusions.

H1. Pitcher motion should move from hand-authored poses to data-derived representative joint curves.

H2. Outfield pursuit should become more observation-driven instead of perfect-future-point-driven.

H3. Catch possession should become a state machine rather than a boolean catch/fail flag.

H4. Defense intelligence and body execution should remain separate layers.

H5. ML/RL should primarily be a research/test/adversarial-scenario tool unless a trained policy clearly beats deterministic explainable contracts.

H6. Ball physics should be validated by distributions rather than visual anecdotes.

---

## 11. Local test-build history and what is / is not canonical

During browser testing, disposable local HTML builds were produced, including all-defense-1 variants.

Examples historically used:

- b26 all-defense-1 test build
- b28 all-defense-1 test build
- b29 all-defense-1 test build

Purpose:

- amplify fielding/throwing flaws so animation and timing failures become easy to reproduce

Rules:

- these are test artifacts, not source-of-truth branches
- do not push a defense-all-1 roster override as normal gameplay unless explicitly requested
- regenerate from the current canonical gameplay source when needed

The current canonical source is the GitHub b29 branch, not an old local HTML.

---

## 12. GitHub / PR rules

- Do not merge Draft PRs unless the owner explicitly requests a merge.
- Current relevant PRs #21, #22, #23 and #29 are all Draft/open/not merged at this handoff.
- Research PR #29 intentionally changes docs only.
- Base new gameplay implementation on the real current GitHub source, not a claimed local build.
- Record exact branch and SHA whenever declaring a build canonical.
- Do not claim CI/corpus success unless the run was actually executed and checked.
- For visible/feel bugs, final “fixed” status requires owner human playtest in addition to automated validation.

---

## 13. Current highest-priority open work

Do **not** immediately start another narrow gameplay patch unless the owner reports a new blocking bug.

The intended next phase is:

1. Run Codex task from:
   `docs/research/CODEX_BASEBALL3D_REALISM_RESEARCH_TASK_20260810.md`
2. Use four independent Codex subagents for #25〜#28.
3. Have browser-GPT inspect and compare the four reports rather than accepting them independently.
4. Produce one integrated design, expected path:
   `docs/research/baseball_realism_integration_v1.md`
5. Freeze a prioritized implementation sequence.
6. Likely first major implementation candidate: pitcher-motion overhaul, because the user explicitly says the current pitcher motion is clearly wrong and unusually strong public biomechanics data exists.
7. Then revisit catch/throw state machine, fielding pursuit, and physics according to evidence rather than previous local assumptions.

No large raw external dataset should be downloaded without first reporting approximate file count/size/license to the owner.

---

## 14. Owner intent / development style

The owner repeatedly prefers:

- root-cause fixes over local condition patches
- actual code/data verification over plausible explanations
- broad enough investigation to avoid repeating the same bug class
- large data/code research delegated to Codex
- independent subagents used in parallel for separable work
- browser-GPT acting as integration/analysis/design/final-judgment layer
- exact progress preserved in GitHub
- minimal scope creep after the current decision is clear

When a bug is visual, the owner expects a playable build for human confirmation after automated checks.

---

## 15. New-chat recovery checklist

A new browser-GPT session should do these steps before changing anything:

1. Confirm repository `L-carp55/baseball3d-game`.
2. Read this handoff file.
3. Read `docs/research/CODEX_BASEBALL3D_REALISM_RESEARCH_TASK_20260810.md`.
4. Read `docs/research/baseball_realism_source_seed_20260810.md`.
5. Inspect PR #23 and branch `agent/b0805-29-possession-footwork` as current gameplay implementation.
6. Inspect PR #29 and issues #24〜#28 as current research program.
7. Verify current heads have not moved since this handoff.
8. Do not use PowerPro appraisal project files as the source of truth for this game.
9. Continue by launching/reviewing Codex parallel research unless the owner gives a different immediate task.

---

## 16. Short handoff state

Current gameplay:

`b25 runner controls/sliding` → `b26 force-chain expected-outs` → `b28 breakaway live play + transfer-context separation` → `b29 possession-footwork stale-target fix`

Current research:

`b29` → `agent/research-baseball-motion-ai` → issues #24-#28 + Codex task MD + source seed

Most important unresolved realism items:

- pitcher whole-body motion is visibly wrong
- catch failures/recovery/first-throw consequences are still too simple and b27 was never canonically implemented
- pursuit AI may know too much future information
- ball/throw physics needs distribution-based calibration
- human body execution and defense decision policy need a cleaner interface

This is the state to continue from.
