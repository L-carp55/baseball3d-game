# Baseball3D realism integration v1 — Browser-GPT integrated decision

Date: 2026-08-10
Repository: `L-carp55/baseball3d-game`
Status: **INTEGRATED DESIGN / NO GAMEPLAY IMPLEMENTATION YET**

Gameplay source of truth:

- branch: `agent/b0805-29-possession-footwork`
- BUILD: `b0805-29`
- SHA: `60b993b73fed854934a976e45e8feb9437deb584`
- Draft PR: #23

Research coordination:

- branch: `agent/research-baseball-motion-ai`
- Draft PR: #29
- do not merge without owner instruction

This document is the browser-GPT integration layer after the four independent Codex research agents completed. It supersedes the provisional hypotheses in `baseball_realism_source_seed_20260810.md` where this document makes a firmer decision.

---

## 0. Project boundary

This is the **manual-playable 3D baseball game** project implemented mainly in `baseball3d.html`.

Do not use as source of truth:

- PowerPro / Prospi player-rating formulas
- NPB/MLB ability appraisal tables
- pennant-simulator models
- player-rating conversion research

Those belong to a separate project.

The current task is game-engine realism: motion, fielding AI, possession/body execution, ball/throw physics, animation and presentation.

---

## 1. Inputs independently verified

### Agent A — pitching / hitting motion

- branch: `codex/research-pitching-motion-20260810`
- report SHA: `65d01929539329ff103baf53ca8c340f070f725f`
- report: `docs/research/codex_pitching_motion.md`

### Agent B — fielding AI / pursuit

- branch: `codex/research-fielding-ai-20260810`
- report SHA: `f393060ae879890a989ad5fce9bc363b0293d019`
- report: `docs/research/codex_fielding_ai.md`

### Agent C — catch / throw / footwork execution

- branch: `codex/research-fielding-motion-20260810`
- report SHA: `3d8e8729c4c6ec04b961fd812a11de2e41e0cf69`
- report: `docs/research/codex_fielding_motion.md`

### Agent D — ball / throw physics and game-wide quality

- branch: `codex/research-ball-physics-20260810`
- report SHA: `f35e6babcfd4948103e4d5774b0d95e04a1d6d9a`
- report: `docs/research/codex_ball_physics.md`

### Diff verification

Each report head was compared against the corresponding dispatched task-file commit.

Result:

- A: only `codex_pitching_motion.md` added
- B: only `codex_fielding_ai.md` added
- C: only `codex_fielding_motion.md` added
- D: only `codex_ball_physics.md` added
- no agent changed `baseball3d.html`

Agent D's first isolated run timed out, but the completed report was produced by the independently re-dispatched D worktree and remained isolated from A/B/C outputs.

### Browser-GPT re-audit of current game code

The main Codex findings were checked directly against gameplay SHA `60b993b...`.

Confirmed:

1. `planPlay()` and `interceptPoint()` forward-simulate copies of the exact ball state with `stepBall()`, so current runtime fielding policy has future information unavailable to a human fielder.
2. `startFlight()` persists `ball.pred` / exact plan coordinates and assigns cover with positional preference lists.
3. `armEff()` and `throwOffset()` use cumulative `f.run` as a posture proxy rather than instantaneous velocity, facing, balance, grip and release mode.
4. `beginThrowPhase()` enters `transfer` immediately and can add a hidden `A.fumble()` delay rather than modelling the physical outcome.
5. b29 `prepareThrowerFootwork()` correctly clears the stale pursuit target before `moveFielders()` during `transfer`, while `step` / `approach` remain intentional movement states.
6. `throwFlightTime()` estimates airborne time from initial horizontal velocity while `launchThrow()` / `throwPassHeight()` use drag-integrated flight, so decision ETA and emitted flight are not closed under the same model.
7. `startFlight()` produces arbitrary spin scalars from launch angle/spray and does not persist a real contact-time physical class in the ball data contract.
8. `drawFigure()` has one combined body transform, no independent pelvis/trunk rotation and no forearm roll; the glove is tied to the left forearm.
9. `pitcherPoseK()` is a three-section hand-authored curve, `PITCH_RELEASE_K=.80` is global, and batter motion is one sine-driven scalar with a one-arm bat chain.

The research reports therefore describe real structural seams in the current code rather than hypothetical rewrites detached from b29.

---

## 2. Integrated hypothesis verdicts

| Hypothesis | Integrated verdict | Decision |
|---|---|---|
| H1: hand-authored pitcher motion -> data-derived curves | **ADOPT, modified** | Use event-normalized motion profiles from a commercially usable source. OBP remains biomechanics QA/research, not the shipped curve source unless separately licensed. |
| H2: coarse initial prediction + observation-driven fielding | **ADOPT, modified** | Runtime fielders receive delayed/sampled observations and maintain belief; exact engine future remains offline/test truth only. |
| H3: catch possession is multi-state | **ADOPT** | Introduce `FieldingExecution`; physical outcome, recovery, grip and release readiness persist through the play. |
| H4: defense intelligence and body execution remain separate | **STRONGLY ADOPT** | This becomes a non-regression architecture contract. |
| H5: ML/RL is mainly offline research/test tooling | **ADOPT** | No opaque runtime policy or realtime learned physics in v1. |
| H6: ball physics is distribution-validated | **ADOPT** | Distance can get external Statcast calibration first; apex/hang/bounce/wall/throw require explicitly scoped reference fixtures. |

Additional integrated invariants:

- **H7 — engine truth and player-policy observations are different objects.** A deterministic engine may know the exact future for offline scoring, but the fielder policy must not.
- **H8 — animation never creates physical feasibility.** A glove/IK correction cannot turn an unreachable ball into a catch or alter a rule result.
- **H9 — physical outcome and official scoring are separate.** `DROP`, `MISS`, `DEFLECT`, etc. describe physics/body state; PlayLifecycle/scoring determines whether an error is charged.
- **H10 — tactical target and release execution are separate.** DefenseActionPolicy chooses what the defense wants to do; FieldingExecution determines when/how the body can legally execute it.

---

## 3. Important cross-agent conflicts and their resolutions

### 3.1 OBP commercial restriction is real, but it is no longer a hard motion blocker

Agent A correctly found that OpenBiomechanics Project data and biomechanics documentation are not a safe shipping source for a potentially commercial game without separate commercial rights.

However browser-GPT found an additional primary source after the four agents returned:

**CMU Graphics Lab Motion Capture Database**

- official database: `https://mocap.cs.cmu.edu/`
- official Subject #124 index: `https://mocap.cs.cmu.edu/search.php?subjectnumber=124`
- database terms state the motion data are free for use and may be included in commercially sold products, while direct resale of the data (including converted form) is prohibited; acknowledgement is requested
- Subject #124 contains at 120 fps:
  - Trial 1 — Baseball Pitch
  - Trial 2 — Baseball Pitch
  - Trial 7 — Baseball Swing
  - Trial 8 — Baseball Bunt

**Integration decision:**

- CMU #124 becomes the first candidate **motion source** for a prototype/shipping-compatible representative profile, subject to quality qualification.
- OBP + peer-reviewed biomechanics become **non-copy calibration / QA references** for event order, pelvis/trunk separation, lead-leg behaviour and obvious biomechanical impossibilities.
- Do not derive and ship an OBP curve merely by rewriting its values.
- Do not commit the uncompressed CMU raw archive merely because product use is allowed; preserve provenance and use only the minimum files needed.
- If CMU pitch quality is inadequate for the game's camera/skeleton, fall back to first-party/commissioned capture rather than forcing the source.

This changes Agent A's practical blocker: **commercially usable motion exists to qualify before first-party capture is required.**

### 3.2 B's cadence numbers are implementation defaults, not scientific truth

Agent B proposes approximately:

- perception: 60 Hz
- team role decision: 10 Hz + events
- short role lease around 0.25 s

The architecture is accepted, but the exact numbers are not independently established baseball constants.

**Decision:** put them in one configuration block, record them in traces, and calibrate. Mutation tests protect the existence of delayed observation / lower-rate assignment / hysteresis; tests must not pretend one exact cadence is biologically proven.

### 3.3 C's execution taxonomy is accepted; numerical outcome/recovery values are not yet calibrated

Accept the state ownership and physical outcome taxonomy:

- `SECURE`
- `BOBBLE`
- `KNOCKDOWN`
- `DEFLECT`
- `DROP`
- `MISS`

Accept release-mode concepts:

- `SET_FEET`
- `THROW_ON_RUN`
- `RECOVER_OR_PLANT`
- `PIVOT`

Do **not** freeze recovery seconds, grip thresholds or outcome probabilities as "real baseball" until a documented source or owner-controlled reference fixture exists.

The first execution implementation must be able to route today's behaviour through the new states before changing its probability distribution.

### 3.4 D's physical-class thresholds are telemetry/config until calibrated

Persisting contact-time physical class is accepted immediately because b24 already established that physical batted-ball type must not depend on later catch feasibility.

Any specific LA threshold set such as `<10 / <25 / <50 / else` is initially a named config/telemetry convention, not a new gameplay rule. Existing runner/catch semantics must not silently change merely because the class field is added.

### 3.5 Exact future physics remains legal for engine/tests, illegal for runtime fielder policy

D needs exact deterministic trajectory for physics and validation. B forbids fielders from seeing exact future trajectory.

These are compatible.

**Decision:**

```text
EngineTruth / BallState
  -> rules / renderer / replay / offline oracle: allowed
  -> FieldingPerceptionFrame: current/past observations only
      -> runtime fielder belief / assignment / pursuit
```

No policy helper may smuggle exact future data indirectly through `ReachModel`, assignment utilities or a cached `ball.pred`.

### 3.6 Pitcher animation is not the same project as pitch-flight physics

Agent A recommends keeping `launchPitch`/pitch gameplay unchanged in the first motion implementation. Agent D correctly notes that `pitchPos()` itself is still a hand-authored flight curve.

**Decision:** first fix whole-body motion and release synchronisation without altering pitch outcome/trajectory. A later dedicated pitch-flight phase may replace `pitchPos`, but it must not be bundled into the first visual motion PR.

### 3.7 C release execution and D throw physics meet through a release snapshot

The clean cross-agent interface is:

```text
DefenseActionPolicy
  chooses tactical target
       |
       v
FieldingExecution
  reaches THROW_READY
  freezes release snapshot:
  position, target, arm, accuracy,
  releaseMode, facingError, velocity,
  grip/recovery factors, prepSec
       |
       v
makeThrowBallSpec(releaseSnapshot)
       |
       v
Ball physics integrator
  produces actual flight + target crossing ETA
```

The body layer does not choose a different tactical base. The physics layer does not choose a target. The policy does not zero body velocity or directly launch the ball.

---

## 4. Integrated target architecture

```text
                           ┌──────────────────────────┐
                           │       PlayLifecycle      │
                           │ rules / outs / scoring   │
                           └────────────┬─────────────┘
                                        │ events
                                        │
contact / release ──> BallSpec ──> BallState / fixed-step physics
                              │             │
                              │             ├── renderer / replay / offline oracle
                              │             │
                              │             └── FieldingPerception sampler
                              │                    │ delayed/current observations
                              │                    v
                              │              FielderBelief
                              │                    │
                              │          ┌─────────┴─────────┐
                              │          v                   v
                              │   FieldingAssignmentV2   PursuitIntent
                              │   role/epoch/lease        local steering
                              │          │                   │
                              │          └──── ReachModel ───┘
                              │                    │
                              │                    v
                              │             catch approach intent
                              │                    │
                              │                    v
                              │            FieldingExecution
                              │       catch/secure/recover/grip/plant
                              │                    │
                              │         current availability/envelope
                              │                    v
                              │            DefenseActionPolicy
                              │            + ThrowDecision
                              │                    │ target request
                              │                    v
                              └──────────── FieldingExecution
                                               │ release snapshot
                                               └──> new throw BallSpec

MotionBank / samplePitchMotion / sampleExecutionPose
  reads gameplay/execution display state only
  never writes rules, policy, ball feasibility or outcomes
```

### Ownership that must remain explicit

#### RunnerIntent

Owns runner movement intent and manual-vs-auto semantics. New fielding work must not read hidden runner goals as a defense shortcut.

#### ReachModel

Owns current physical travel capability / arrival estimates. It may evaluate points/regions supplied by allowed observations or assignments. It must not forecast the hidden ball trajectory itself.

#### FieldingAssignmentV2

Owns scarce team roles:

- primary pursuit
- backup
- base cover
- cutoff
- relay
- return/hold

Role changes are atomic/versioned. It does not directly animate a body or choose a throw target.

#### FieldingExecution

Owns body/possession feasibility:

- catch attempt
- physical outcome
- secure possession
- recovery
- grip/transfer
- plant/pivot/on-run execution
- release readiness
- follow-through

It reports a feasible execution envelope. It does not choose which runner/base is strategically best.

#### DefenseActionPolicy / ThrowDecision

Own tactical comparison of legal current actions and continuation value. Preserve b26 expected multi-out continuation and b28 live re-evaluation.

#### Ball physics

Owns actual ball state, collision events, and physical crossing time. It never changes fielding roles or awards bases by itself.

#### PlayLifecycle / scoring

Owns live/dead state, outs, legal base touch/tag, awards, and official error attribution.

#### Motion / rendering

Owns visual skeleton pose and blending. It may be more detailed than physical execution but may never extend actual catch reach or change game state.

---

## 5. Frozen interface contracts

These are architecture gates for future PRs.

### 5.1 `BallSpec` / ball identity

A batted ball's contact identity is immutable for the play record.

At minimum preserve:

- origin
- contact EV / LA / spray
- physical class
- physics version
- spin source / availability
- deterministic variance seed if used

A throw creates a new throw spec instead of deleting the original batted-ball identity.

### 5.2 Fielding perception anti-leak boundary

Runtime fielding code may not receive:

- durable exact landing point
- `ball.pred`
- future `stepBall()` result
- exact future wall/bounce event
- hidden runner `goal` / `autoGoal`

Permitted observations must be typed/serialized and poison-testable.

### 5.3 Assignment is atomic

At any fieldable instant there must be one primary ownership record, not independently mutated booleans that can temporarily disagree. Role replacement carries an epoch/reason and replacement role for the old primary.

### 5.4 Possession cancels stale pursuit

The b29 invariant becomes general:

- when entering a stationary possession/execution state, stale pursuit target/velocity is cleared **before movement integration**
- `SELF_STEP`, `RUNDOWN_APPROACH` and explicitly permitted `THROW_ON_RUN` remain movement exceptions

### 5.5 Physical catch outcome != official error

The physical execution layer returns the ball/body outcome. Scoring separately evaluates whether the expected/routine play should be charged as an error.

### 5.6 Throw ETA closes against emitted flight

The ETA used by ThrowDecision must be obtained from the same physical flight model/version used to launch the throw, within one fixed physics step at target crossing.

Release preparation time is separate from airborne flight time.

### 5.7 Visual release synchronisation

When the ball begins flight from a pitch, the displayed pitcher profile is at its `BR` event within one render-frame tolerance. Renderer sampling does not alter pitch outcome.

### 5.8 Visual reach cannot exceed physical reach

Glove/IK/end-effector correction is clamped to the physically permitted catch window. Disable the clamp in a mutation test and require detection.

---

## 6. Adopt / defer / reject decisions

| Proposal | Integrated decision |
|---|---|
| Event-normalized motion bank | **ADOPT** |
| OBP-derived shipping curves without commercial licence | **REJECT** |
| CMU #124 as first motion candidate | **QUALIFY IMMEDIATELY** |
| Separate pelvis/trunk renderer channels | **ADOPT** |
| Full OpenSim/OpenCap/Pose2Sim runtime dependency | **REJECT** |
| Offline mocap/IK authoring pipeline | **ADOPT LATER / TOOLING** |
| Exact future landing point as runtime fielder authority | **REJECT** |
| Observation-gated belief + local pursuit | **ADOPT** |
| Lightweight central role coordinator + local steering | **ADOPT** |
| Opaque runtime RL fielding policy | **REJECT v1** |
| `FieldingExecution` state machine | **ADOPT** |
| Physical outcome taxonomy secure/bobble/knockdown/deflect/drop/miss | **ADOPT STRUCTURE; CALIBRATE NUMBERS** |
| Cumulative `f.run` as throw posture proxy | **REPLACE** |
| b28 transfer-context distinction | **PRESERVE / UPGRADE TO PROFILES** |
| b29 stale-target guard | **PRESERVE / GENERALIZE** |
| Immutable `BallSpec` + mutable `BallState` | **ADOPT** |
| One fixed-step airborne/collision path | **ADOPT** |
| Same integrator for throw ETA and actual throw | **ADOPT EARLY** |
| Arbitrary LA/spray spin scalars as final realism model | **REPLACE AFTER CALIBRATION** |
| Inventing grass/dirt/wall coefficients now | **REJECT** |
| Surface IDs / collision events before coefficients are calibrated | **ADOPT** |
| Realtime ML physics | **REJECT** |
| Camera composition including relevant receiver/base | **ADOPT AFTER PHYSICS CONTRACT** |

---

## 7. Frozen implementation sequence

Do **not** create one giant realism PR. The following phases are deliberately separated so failures can be attributed and reverted.

### Phase M0 — CMU baseball motion qualification

**Type:** focused research/data qualification; no gameplay-body change.

Inspect only the small Subject #124 baseball set needed initially:

- #124-01 Baseball Pitch
- #124-02 Baseball Pitch
- #124-07 Baseball Swing

Before downloading, record:

- exact files selected
- approximate/download size
- official CMU use terms URL
- attribution/provenance

Prefer ASF/AMC first; do not fetch C3D unless AMC lacks information required for qualification.

Required output:

- clip quality assessment
- handedness
- pitch/swing active-frame window
- joint mapping to current renderer
- event proxies for SFC / MER / BR / follow-through with uncertainty
- pelvis vs trunk sequencing checks
- obvious skeleton/noise problems
- whether #124-01 or #124-02 is usable as the first representative pitch
- whether #124-07 is good enough for a later batter profile
- compact conversion plan

Do not commit raw CMU data as a standalone redistributable dataset. If neither pitch is visually/biomechanically adequate, declare negative finding and switch to first-party/commissioned capture.

**Gate:** one motion source is approved for a v1 profile, or the source is explicitly rejected.

### Phase M1 — pitcher motion foundation

**Highest visible-priority gameplay implementation.**

Implement only:

- backward-compatible pelvis / torso transform split
- required throwing-arm plane / forearm-roll channels
- profile-aware throw/glove side
- event-normalized `MotionBank`
- `samplePitchMotion`
- renderer motion clock
- BR ↔ existing pitch-launch synchronisation
- one approved representative pitch profile + mirrored handedness only if mirror QA passes

Do not change:

- pitch outcome
- pitch-flight formula
- batter contact
- runner logic
- fielding logic

Required gate:

- deterministic gameplay trace equality for pitch outcomes
- event/continuity/mirror mutation tests
- owner visual playtest of windup/stretch/release/follow-through/field-ready transition

If M1 does not clearly look better to the owner, do not proceed by adding more profiles. Fix the renderer/profile mapping first.

### Phase P1 — ball identity + throw ETA closure

Structural physics foundation while **retaining legacy coefficients**.

Implement:

- immutable `BallSpec`
- persisted contact physical class
- throw-origin spec / release metadata
- one fixed accumulator for all live ball paths
- same physical crossing simulation for ThrowDecision ETA and emitted throw
- release prep time separated from airborne time
- surface/collision identity fields, without claiming realistic coefficients

Do not retune drag/lift/bounce in this phase.

Required gate:

- old gameplay physics fixtures under `legacy-b29` remain reproducible where semantics are intended to stay same
- contact class survives catchability/bounce/wall changes
- throw target-crossing ETA closes to one `PHYS_H`
- 30/60/jitter fixed-step invariance

### Phase E1 — `FieldingExecution` state foundation without probability rewrite

Introduce the execution owner first, routing **existing outcomes/timings** through it wherever possible.

Implement:

- serializable execution state
- secure possession / grip / recovery / release-ready stages
- profile selection from existing b28 transfer contexts
- generalized stationary-possession stale-target guard
- explicit `SELF_STEP` / `RUNDOWN_APPROACH` exceptions
- execution diagnostics/recording

Do not yet increase error diversity or globally retune catch probabilities.

Required gate:

- b29 stale-target fixture
- b28 context timing contracts
- self-step/rundown movement contracts
- existing force-chain / RunnerIntent / assignment contracts

### Phase E2 — release snapshot + physical catch outcomes

After E1 is structurally stable:

1. replace cumulative `f.run` release penalty with instantaneous release snapshot factors
2. add backward-release rejection / set-feet / legal on-run / pivot execution
3. introduce seeded physical outcomes:
   - secure
   - bobble
   - knockdown
   - deflect
   - drop
   - miss
4. add dive/jump/slide recovery debt and first-throw consequences
5. keep official error scoring separate

All recovery/outcome numbers remain named calibration parameters. Owner playtest is mandatory.

### Phase F1 — observation-based fielding AI + AssignmentV2

This phase comes **after P1 and E1/E2 interfaces exist**, because B requires both credible physical availability/ETA and an approach/execution contract.

Implement:

- policy-facing `FieldingPerceptionFrame`
- deterministic delay/noise mode
- per-fielder belief/history
- class-specific fly / liner / ground pursuit controllers
- `FieldingAssignmentV2` role epoch/lease
- atomic primary/backup/cover/cutoff/relay assignment
- trajectory-epoch reset on observed bounce/wall/deflect
- anti-future-leak static/poison tests

Initial cadence values are configuration, not scientific claims.

Do not replace DefenseActionPolicy, b26 continuation logic, RunnerIntent or PlayLifecycle.

### Phase P2 — calibrated batted-ball / surface / wall physics and camera

Only after the identity/integrator contract is stable:

- lawful Statcast query manifest + derived distance aggregates
- batted spin input strategy / calibrated uncertainty
- drag/lift/spin-decay calibration
- grass/dirt/warning-track response after reference fixture exists
- wall-face/top/foul-fence/backstop material calibration
- park geometry
- field camera composition around ball + relevant receiver/base/collision zone

Never invent numeric realism merely to fill a config slot. `UNKNOWN` / `NOT_PUBLICLY_CALIBRATED` is valid until evidence exists.

### Phase M2 — batter motion

Use the same MotionBank architecture only after M1 proves the skeleton/data mapping is good.

- qualify CMU #124-07 or another cleared source
- two-hand bat constraint
- front-foot contact / plant / contact anchors
- preserve current contact/outcome calculations initially

M2 must not block P1/E1/F1 critical-path work if pitcher motion is already accepted.

### Later, separate work — pitch-flight physics

`pitchPos()` remains a hand-authored trajectory and deserves its own research/implementation contract. It is explicitly **not** bundled into M1 or D/P1.

---

## 8. Validation stack after implementation begins

No future PR may claim "fixed" solely because one layer passes.

### Layer 1 — architecture/static guards

Examples:

- fielding policy cannot import/read exact future ball truth
- body execution cannot select tactical targets
- DefenseActionPolicy cannot write body velocity/pose
- renderer cannot mutate catch feasibility/outcome
- physical outcome cannot directly assign official error

### Layer 2 — direct deterministic contracts

Must include the report-specific direct + mutation fixtures:

- pitch BR synchronisation
- R/L mirror and pelvis/trunk separation
- physical-class persistence
- throw ETA closure
- stale-target possession
- intentional `step` / `approach`
- backwards-throw rejection
- permitted on-run throw
- dive/jump recovery
- secure vs bobble
- outcome vs scoring separation
- same-past/different-future fielding observation
- one-ball/one-primary
- assignment handoff stability
- visible-runner-only throw decision

### Layer 3 — existing project regressions

Retain and rerun as applicable:

- RunnerIntent / individual runner controls / sliding
- FieldingAssignment / ReachModel
- DefenseActionPolicy
- b26 force-chain continuation
- b28 breakaway / transfer-context
- b29 possession-footwork
- current browser baseline / behavior mutations
- current recording corpus
- 1000-route validation
- 50-game completion

Historical PASS is not a new PASS. Every implementation PR reports the run actually performed.

### Layer 4 — distributions

When the target layer changes distributions, report distributions by meaningful bucket rather than one average:

- EV / LA / spray
- fly / liner / ground / wall / deflect
- defender skill / reaction bucket
- catch action/outcome
- recovery-to-release
- set-feet / on-run / pivot
- throw distance / height / time / miss

### Layer 5 — owner human acceptance

Mandatory for:

- pitcher motion
- batter motion
- catch/recovery visuals
- throw footwork
- pursuit route feel
- wall/bounce feel
- camera readability

Automated PASS means regression protection, not visual approval.

---

## 9. Licensing / provenance decisions

### OpenBiomechanics Project

- code may be used under its code licence where appropriate
- biomechanics data/documentation are treated as non-commercial research/calibration unless separate commercial rights are obtained
- no OBP-derived shipping curve by silent transformation

### CMU Graphics Lab Motion Capture Database

Official source terms currently state commercial product inclusion is allowed while direct resale of the dataset is not. Preserve:

- source URL
- subject/trial IDs
- downloaded-file hashes
- date retrieved
- conversion tool/version
- required/requested acknowledgement text in project provenance

This is a source-terms engineering assessment, not a substitute for legal review if distribution/commercialisation becomes material.

### OpenSim / OpenCap / Pose2Sim

Useful primarily for offline authoring/calibration. If code is directly reused, preserve their respective licence/notices. Do not assume tool licence automatically licenses third-party captured motion.

### Google Research Football / ML-Agents

Architecture concepts only for this project. No runtime dependency is justified.

### Kentops/Baseball-Game

No usable repository licence was identified by the agents. Reject code copying.

### dgrifka/baseball_game_simulator

No usable repository licence was identified. Reject code copying; retain only independently implemented design/calibration ideas.

### Papers / equations

Use factual/algorithmic findings and citations; do not copy protected prose, figures or datasets into the game.

---

## 10. Open blockers and what they do NOT block

### CMU motion quality unknown

Blocks: choosing the actual first profile.

Does not block: MotionBank/skeleton design.

### Catch outcome/recovery numeric calibration missing

Blocks: claiming real-world calibrated bobble/dive recovery frequencies/times.

Does not block: E1 state ownership and diagnostics.

### Batted spin input missing

Blocks: full physically meaningful Magnus/spin calibration.

Does not block: BallSpec, fixed-step closure, physical-class persistence, throw ETA closure.

### Surface/wall/throw empirical trajectories incomplete

Blocks: claiming realistic coefficients.

Does not block: material/event identity and parameterized architecture.

### Human fielding perception calibration values uncertain

Blocks: claiming a particular delay/lease/cadence is biologically exact.

Does not block: anti-future-leak observation architecture.

---

## 11. Critical path after this integration

The next work is **not another broad four-agent research round**.

The critical path is:

```text
M0 CMU qualification
  -> M1 pitcher motion foundation + owner visual gate
  -> P1 BallSpec / fixed-step / throw ETA closure
  -> E1 FieldingExecution structural state
  -> E2 catch/release physical consequences
  -> F1 perception-based fielding + AssignmentV2
  -> P2 calibrated ball/surface/collision/camera
```

M2 batter motion can branch after M1 without blocking the defense/physics critical path.

Do not horizontally expand into unrelated gameplay systems before the current phase clears its gate.

---

## 12. Research-phase completion definition

The original #24 research phase is considered **integrated** when:

- four independent reports are pushed and SHA-verified
- browser-GPT has independently compared them against current b29 code
- conflicts and licensing boundaries are resolved or explicitly deferred
- implementation architecture and sequence are frozen in this document
- no important finding exists only in a Codex final chat response

Those conditions are now met for the original four-agent research program.

The next targeted M0 qualification exists because the post-report browser integration discovered a new commercially usable candidate dataset; it is a narrow source-qualification step, not a reopening of the entire research program.

---

## 13. Final integration decision

The game should not be rebuilt around one new external library or one giant AI model.

The highest-confidence path is to strengthen the existing architecture with four explicit contracts:

1. **Motion data contract** — event-normalized visual motion with commercially clean provenance.
2. **Ball truth contract** — immutable launch identity + deterministic actual physics.
3. **Perception/assignment contract** — fielders act on permitted observations, not engine future truth.
4. **Execution contract** — catch/possession/footwork/release has durable physical state separate from tactical policy.

This directly addresses the recurring failure pattern seen from b26 through b29:

> correct local decision + stale/ambiguous state + duplicated physical assumptions + visual shortcuts

without collapsing RunnerIntent, ReachModel, FieldingAssignment, ThrowDecision, DefenseActionPolicy and PlayLifecycle back into a scenario-specific condition tree.
