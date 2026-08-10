# Pitching and batting motion research — implementation recommendation

Date: 2026-08-10
Research branch: `codex/research-pitching-motion-20260810`
Gameplay source audited: `agent/b0805-29-possession-footwork@60b993b73fed854934a976e45e8feb9437deb584` (`b0805-29`)
Scope: pitching and batting biomechanics / motion capture only. This document deliberately proposes **no** change to game rules, ball physics, batting outcome logic, runner logic, or fielding policy.

## Decision

Replace the hand-authored pitch and swing curves with a small, self-owned **event-normalized motion bank**.  The bank is sampled at 60 fps by the renderer, while gameplay keeps owning pitch flight, contact, and all decisions.  Start with one right-handed fastball windup/stretch profile and one right-handed swing profile, but make handedness, delivery family, arm slot, and later pitch-type variation explicit data fields—not more `if` branches.

This is not permission to put OpenBiomechanics Project (OBP) data, its derived curves, or its biomechanics documentation in a potentially commercial game.  OBP is excellent for defining the offline pipeline and its test checks, but its data/documentation licence prohibits that use. The shipped bank needs first-party captures, a separately obtained commercial licence, or another source with a reviewed commercial grant.

## 1. Primary-source inventory

| Source inspected | Exact files / paper portions read | Useful evidence and current maintenance | Licence / commercial conclusion |
|---|---|---|---|
| [Driveline Research OpenBiomechanics](https://github.com/drivelineresearch/openbiomechanics) | `LICENSE-CODE.md`, `LICENSE-DATA.md`, `baseball_pitching/README.md`, `baseball_hitting/README.md`, root `data_dictionary.json`, `baseball_pitching/data/data_dictionary.csv`, `obp/core.py`, `examples/03_join_fullsig.py`, `scripts/download_data.sh`, release `dataset-v1` asset metadata | Repo `main` was pushed 2026-07-20. Root `data_dictionary.json` groups pitching/hitting POI and metadata dictionaries; `obp.core.load_poi/load_metadata/full_sig_dir` identifies POI/metadata/full-signal entry points; the joining example uses `(session_pitch,time)`. Pitching tables expose 360 Hz marker-derived angles/velocities and 1,080 Hz force-plate data; hitting exposes the analogous tables and bat data. | Source code is MIT. **All data and biomechanics documentation are CC BY-NC-SA 4.0**, with a further professional-organisation exclusion. Raw files, POI/full-signal files, documentation-derived curves, and any derivative shipped motion are rejected without written commercial rights. |
| [OpenSim core](https://github.com/opensim-org/opensim-core) | `OpenSim/Tools/InverseKinematicsTool.cpp::run`, `OpenSim/Simulation/InverseKinematicsSolver.cpp::{setupGoals,setupMarkersGoal,setupOrientationsGoal,updateGoals}` | `main` was pushed 2026-08-07. The tool creates marker/coordinate references, fits each frame, reports marker error, and writes a motion file. The solver creates weighted marker/orientation goals and updates observations at each time. | Apache-2.0. Technically reusable, but C++/Simbody is inappropriate for this single-file, no-dependency WebGL renderer. Use as an **offline reference**, not a runtime dependency. |
| [OpenCap core](https://github.com/opencap-org/opencap-core) | `main.py::main`; `utilsOpenSim.py::{runScaleTool,runIKTool,generateVisualizerJson}` | `main` was pushed 2026-08-07. `main` orders calibration → pose detection → synchronisation → triangulation → marker augmentation → OpenSim. `runScaleTool` selects marker sets and scales a model; `runIKTool` runs OpenSim IK and records error output; `generateVisualizerJson` transforms recorded coordinates for visualisation. | Apache-2.0. Useful as an offline capture-to-curve pipeline. It is not an in-browser runtime solution and OpenCap’s default human model is not a validated baseball throwing model. |
| [Pose2Sim](https://github.com/perfanalytics/pose2sim) | `Pose2Sim/Pose2Sim.py::{triangulation,filtering,markerAugmentation,kinematics,runAll}`; `Pose2Sim/kinematics.py::kinematics_all`; `LICENSE` | `main` was pushed 2026-07-30. The pipeline explicitly performs multi-view 2D pose → 3D triangulation → filtering → optional marker augmentation → model scaling/IK; `kinematics_all` trims outlier frames before scaling and writes `.mot` joint-angle results. | BSD-3-Clause. Appropriate for an offline, controlled own-footage prototype; not a drop-in browser runtime and not evidence that its generic model measures high-speed pitching accurately enough without validation. |
| [Orishimo et al., 2023](https://pubmed.ncbi.nlm.nih.gov/35836313/) | Abstract and methods/results record | In 29 fastball pitchers, mean peak pelvis velocity occurred at 12% and trunk velocity at 36% of the stride-foot-contact-to-ball-release window; trunk velocity predicted part of ball-velocity variance. This supports separate pelvis and trunk channels and their order, not a single whole-body `turn`. | Peer-reviewed evidence; calibration-only. It is not a motion clip or a universal target value. |
| [Dowling et al., 2022](https://pubmed.ncbi.nlm.nih.gov/36479467/) | Abstract/method/results record | 157 professional fastball pitchers were captured at 480 Hz. Pelvis orientation at foot contact, stride length, lead-knee behaviour, and velocity covaried. This supports making stride, pelvis, and lead-knee channels independently inspectable at foot contact. | Peer-reviewed evidence; calibration-only. Do not turn group averages into a mandatory pose for every avatar. |
| [Scarborough et al., 2021](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2021.699251/pdf) | pp. 1–5: segment definitions, timing-based kinematic-sequence method, fastball/curveball results | Peak segment angular velocities are measured for pelvis, trunk, arm, forearm, and hand. The intended order is proximal-to-distal, but the study found several real orders; none of its samples had the perfectly ideal sequence. This is a strong warning against forcing a single “perfect” curve or using pitch type as a cosmetic synonym. | CC BY article; concept/calibration-only. |

### Large-data guard — completed before any download

No OBP raw C3D or full-signal archive was downloaded in this task. The `dataset-v1` release contains 12 assets totalling **1,127,624,083 bytes (about 1.05 GiB)**: seven pitching archives (including a 176.1 MiB C3D archive) and five hitting archives (including a 412.3 MiB C3D archive). The small in-repository metadata/POI files were read only: **411 fastball trials / 100 athletes** and **677 swings / 98 athletes**. Pitching POI records `p_throws=L/R` but all 411 listed trials are `FF`; hitting metadata has `hitter_side=L/R`. This coverage is insufficient evidence for a data-derived curveball/slider/changeup motion family.

## 2. What the inspected data actually contains

### Pitching

OBP’s pitching documentation specifies a laboratory frame (`+x` toward home, `+y` toward first, `+z` upward), marker and force-plate collection, and six full-signal table families: `joint_angles`, `joint_velos`, `forces_moments`, `energy_flow`, `force_plate`, and `landmarks`.

The marker-derived tables share a **360 Hz** clock and join on `session_pitch` + `time`; force-plate data is **1,080 Hz** and must not be inner-joined casually to the 360 Hz channels. Every full-signal row carries common event times for foot contact (10% bodyweight), foot plant (100% bodyweight), maximum external rotation (MER), ball release (BR), and maximum internal rotation (MIR). `metadata.csv` supplies `session_pitch`, athlete/session identifiers, height/mass, playing level, velocity, and C3D/model filenames. POI adds `p_throws`, `pitch_type`, `arm_slot`, stride length/angle, pelvis/trunk/shoulder/elbow/knee measurements, and timing such as `timing_peak_torso_to_peak_pelvis_rot_velo`.

The minimum signal set worth keeping for this game skeleton is below. “Keep” means include in a legally cleared offline capture/export; it does **not** mean copy it from OBP.

| Game channel | Evidence-backed source signal(s) | Why the current skeleton needs it |
|---|---|---|
| root/stride | pelvis/landmark translation; `stride_length`, `stride_angle`; SFC/foot-plant event | Current `stride` is a single forward offset and has no measured event anchor. |
| pelvis | pelvis anterior/lateral tilt and axial rotation; peak pelvis angular velocity | Pelvis must rotate separately before the torso; it cannot remain folded into `turn`. |
| torso | torso anterior/lateral tilt and axial rotation; hip–shoulder separation | Current `lean` + `turn` makes the whole figure rotate together and loses separation. |
| throwing shoulder | horizontal ab/adduction, ab/adduction, external/internal rotation; `arm_slot` | Current `armR` and `armRZ` are too few and do not distinguish layback from arm plane. |
| elbow/forearm/wrist | elbow flexion, pronation/supination, wrist flexion/deviation | Current `elbowR` bends a forearm but has no forearm/wrist orientation. |
| lead/rear hip and knee | hip 3-D angles, knee flexion; lead-knee extension metrics | Current `legL/legR/kneeL/kneeR` can represent only a reduced subset, but it must be fed from distinct lead/rear channels. |
| glove arm | glove-side shoulder angles / landmarks | The glove arm must counterbalance the throw rather than follow a mirrored generic arm curve. |

### Hitting

OBP’s hitting set supplies bat rigid-body markers, bat angle/velocity, joint angles/velocities, landmarks, force plates, `session_swing`, `hitter_side`, bat length/weight, exit velocity, and contact/ball-tracking POI data. Its aligned event markers are **front-foot contact**, **front-foot plant**, and **contact**. Its landmarks include both shoulder, elbow, wrist, hand, hip, knee, and ankle centres. This is enough to build a motion-bank exporter with a two-handed bat constraint.

The data does **not** justify importing OBP swings or assuming that pitching-machine swings at the documented setup generalise to every game situation. It does support the structural conclusion that the current one-scalar swing cannot represent lower-body loading, pelvis/trunk separation, two-hand grip, bat path, and post-contact deceleration independently.

## 3. Current-game audit and mapping

The following claims refer to `baseball3d.html` at `60b993b73fed854934a976e45e8feb9437deb584`; no game file was changed.

| Current element | Current method actually read | Source-backed replacement | Difficulty | Expected visual effect | Decision |
|---|---|---|---|---|---|
| `drawFigure` (lines 4304–4349) | One `body` matrix combines base yaw, `lean`, and a handful of limb rotations; both hips share that body, and lower-arm twist is absent. | Backwards-compatible pose extension with separate pelvis and torso matrices, shoulder-plane rotation, and forearm roll. | Medium | Enables visible hip–shoulder separation and arm layback without changing gameplay. | **Adapt** |
| `pitcherPoseK` (4416–4434) | Three hard-coded blocks split at `k=.35` and `.62`; every angle, knee position, turn, and stride is manually chosen. | `samplePitchMotion(profile, phase)` from event-normalized self-owned curves compressed to key poses. | Medium | Removes the visibly arbitrary pose jumps and links the release pose to BR. | **Replace** |
| `blendPitchPose` (4435–4439) | Linear interpolation of arbitrary object fields, not angular/quaternion-aware and without event metadata. | Key-pose sampler with per-channel interpolation, phase/event anchors, clamping, and angular continuity. | Low | Predictable speed through SFC→MER→BR and no one-frame discontinuity. | **Replace** |
| `PITCH_RELEASE_K` / `pitcherPose` (4441–4464) | A global `.80` release value and a post-release window based on pitch flight fraction; it blends to a fixed settle pose. | A profile-owned BR anchor plus a short physical post-release/MIR/recover track measured in motion time, then renderer-only settle. | Low | The ball cannot visibly leave while the arm is still in stride. | **Replace** |
| pitch launch/render coupling (1111–1133; 4223–4228) | `launchPitch` sets a fixed release point while `pitcherPose` independently guesses pose; render moves a pitcher only by pose `stride`. | Capture `motionId`, `motionStart`, and BR state when a pitch begins. The visual ball-release marker must equal the same update tick as `launchPitch`; retain existing physics coordinates in v1. | Low | Eliminates a timing contradiction while avoiding an unrequested physics retune. | **Adapt** |
| `drawBatter` (4491–4524) | `sw = sin(pπ) * … * 2`; one scalar drives body, legs, arms, bat orientation; every hitter is a right-hander; bat is attached to one arm chain. | `sampleSwingMotion(profile, phase)` with front-foot-contact/plant/contact anchors and a bat transform constrained by both hands. | Medium | Gives a recognisable load, stride, rotation, contact, and deceleration rather than a waving bat. | **Replace** |
| `anim.wind` / `anim.swing` (1077, 4058–4059, 4116–4117) | Global timers expire at 1.1 s / .45 s, even though visible motion stops at different conceptual events. | A renderer-owned `motionClock` with profile duration, event markers, and a separately named recovery tail. | Low | No dependence on pitch-flight duration or implicit magic timer. | **Replace** |

## 4. Findings and non-negotiable constraints

1. **H1 is confirmed, with a licence gate.** Hand-authored poses should be replaced by data-derived representative motion *only when the data source is commercially cleared*. The replacement must preserve events, not merely imitate a video silhouette.
2. **The event order is the primary invariant.** Use `set → peak knee/load (delivery-specific) → stride-foot contact → foot plant → MER → BR → MIR/follow-through → recover`. OBP directly supplies FC/plant/MER/BR/MIR; a game profile may add set/peak-knee from its own capture. SFC, MER, BR, and MIR must be stored as explicit anchors, not reconstructed from fixed global fractions.
3. **Do not force a mythical universal sequence.** The literature supports pelvis-before-trunk as a useful proximal-to-distal target, but Scarborough et al. observed multiple legitimate sequences even within a pitch type. Use sequence checks to reject impossible timing, not to overwrite all player/style variation.
4. **There is no evidence here for pitch-type motion synthesis.** OBP’s currently read pitching POI is fastball-only. It cannot support “derive slider motion by perturbing fastball wrist angle.” Initially let pitch type select flight physics as today and use the same delivery family; introduce type-specific motion only after a cleared, sufficiently sampled source and a deception/fairness design decision.
5. **Windup and stretch are distinct locomotion families.** They can share SFC→MIR arm/torso timing but must have separate pre-SFC tracks and profile IDs. OBP fields read in this task do not establish a labelled windup/stretch distribution, so this split needs own/cleared captures rather than a guessed scale factor.
6. **H4 is confirmed.** The sampler may read a display `motionId` and current animation time only. It must not alter `launchPitch`, `pitchPos`, `doSwing`, contact quality, runner state, FieldingAssignment, ThrowDecision, or DefenseActionPolicy.
7. **H5 is confirmed with a narrow offline role.** PCA/clustering can help select representative captures and discover bad profiles offline. Do not put a trained model or per-frame inference in the core game loop.

## 5. Recommended representation and compression

### Offline pipeline (only with commercially cleared input)

1. Ingest marker/video-derived joint angles and landmarks. Keep provenance: consent/licence ID, capture date, side, delivery, pitch type, arm slot, sampling rate, processing version, and event-detection version.
2. Validate raw event order. Reject trials without strictly increasing `SFC < MER < BR < MIR`, missing key landmarks, implausible segment lengths, or excessive interpolation gaps.
3. Map each trial into event-normalized time, not an arbitrary 0–1 whole-pitch clock. For each adjacent event pair, resample a fixed number of points; allocate more samples from MER through MIR, where angular speed is highest.
4. Convert source conventions into the game’s coordinate system once in an export step, then mirror in a documented local coordinate system. Never flip signs ad hoc in the renderer.
5. Partition before averaging: `{throwSide, deliveryFamily, armSlotBand, velocityBand}`. For a profile, choose a **medoid** usable trial or a constrained median curve after checking forward kinematics; do not use an unconstrained component average as a pose.
6. Run PCA only as an offline quality/variation diagnostic. It can show redundancy and help cluster trials, but arbitrary PCA weights can produce impossible shoulder/elbow combinations and are not a direct runtime motion format.
7. Adaptive-resample the selected curve to about **15 pitcher keys** and **13 swing keys**. Validate reconstruction error and angular velocity before accepting an export. The number is a budget, not a promise: add keys around MER/BR/contact if a profile fails continuity QA.
8. Export a compact, self-owned JSON/JS literal with only the game channels listed below. Do not export full C3D, force-plate, POI, or person-level identifiers into the game.

### Pitch key allocation (v1 target: 15 keys)

`set`, `hand-separation`, `knee-rise`, `peak-knee`, `stride-early`, `stride-late`, `SFC`, `foot-plant`, `arm-cocking`, `MER`, `late-cocking`, `BR-approach`, `BR`, `MIR`, `field-ready`.

The additional values between named scientific events are interpolation samples, not invented biomechanical events. They prevent visual popping in a 60 fps renderer.

### Swing key allocation (v1 target: 13 keys)

`stance`, `load`, `first-move`, `stride`, `front-foot-contact`, `front-foot-plant`, `pelvis-peak`, `torso-peak`, `hands-forward`, `contact-approach`, `contact`, `deceleration`, `finish`.

Only front-foot contact, plant, and contact are required measured anchors in the inspected hitting documentation. The velocity peaks are derived channels for sampling density and QA, not hard universal events.

## 6. Proposed target architecture

```text
cleared capture / licensed mocap
  -> offline event detector + coordinate conversion + QA
  -> clustered, event-normalized profile export
  -> MOTION_BANK (small self-owned key data)
  -> samplePitchMotion / sampleSwingMotion at render time
  -> drawFigure skeleton pose only

existing launchPitch / pitchPos / doSwing / game AI
  -> unchanged in v1
```

### Runtime data shape

```js
const MOTION_BANK = {
  pitch: {
    R_windup_fastball_v1: {
      provenance: { licenseId: 'FIRST_PARTY_CAPTURE_...', exportVersion: 1 },
      throwSide: 'R', delivery: 'windup', armSlotDeg: 42,
      events: { set: 0, sfc: 0.56, plant: 0.60, mer: 0.74, br: 0.82, mir: 0.90, ready: 1 },
      keys: [
        // event/time plus only renderer channels; no raw source samples.
        { q: 0, pelvisYaw: 0, torsoYaw: 0, trunkPitch: 0, /* ... */ },
        // ... approximately 15 adaptive keys ...
      ]
    }
  },
  swing: {
    R_standard_v1: {
      batSide: 'R',
      events: { ffc: 0.38, ffp: 0.48, contact: 0.72, finish: 1 },
      keys: [ /* approximately 13 adaptive keys */ ]
    }
  }
};
```

The example event fractions are schema placeholders, **not values to ship**. The exporter writes values from a cleared profile; tests check their order.

### Required future functions

| Function / change | Responsibility | Boundary |
|---|---|---|
| `validateMotionProfile(profile)` | Reject malformed profiles: event order, finite channels, monotonic key time, side/delivery metadata, and legal provenance ID. | Offline/export and test only. |
| `sampleEventTrack(profile, q)` | Find bracketing keys and interpolate each channel with angle unwrapping / cubic Hermite or monotone interpolation where needed. | Pure renderer helper; no global game mutation. |
| `samplePitchMotion(motionId, deliveryQ, postReleaseQ)` | Map windup time to `set…BR`; map a fixed short post-release track through MIR/ready; return a named pose. | Called by a rewritten `pitcherPose`; must not choose a pitch or move the ball. |
| `sampleSwingMotion(motionId, q)` | Return pelvis, torso, legs, both arms/hands, and bat-frame channels. | Called by `drawBatter`; must not affect `doSwing`. |
| `mapMotionToFigurePose(sample)` | Map biomechanical channels to the simplified skeleton. It must use separate `pelvisTurn` and `torsoTurn`, shoulder plane/rotation, elbow bend/forearm roll, lead/rear leg values, and a two-hand bat transform. | Render adapter; no rule/AI ownership. |
| minimal `drawFigure` extension | Create pelvis and torso matrices separately; retain the old pose fields as defaults for every runner/fielder. Add optional forearm-roll / second-hand attachment fields. | Visual-only backward-compatible renderer work. |
| `beginPitchMotion` / `beginSwingMotion` | Store profile ID and the renderer clock when the existing game starts a pitch/swing. At the precise BR tick, call existing `launchPitch`; at contact, existing `doSwing` remains authoritative. | Synchronisation only; no outcome logic. |

### Handedness, arm slot, delivery, and pitch type

- **Handedness:** export an R profile and generate an L render profile by a tested local-space mirror, swapping throw/glove arm roles and bat side. Do not merely negate `face`: current `drawFigure` hard-wires the glove to the left forearm (line 4345), and this must be made profile-aware.
- **Arm slot:** use a continuous profile channel for the throwing-arm plane and optional visual release-point offset. In v1, retain `launchPitch`’s existing physical release coordinate so cosmetic work does not silently change pitches.
- **Windup/stretch:** use separate profile IDs and pre-SFC key tracks; share only a compatible later arm/torso subtrack when validated. Never implement stretch as `windup * 0.7`.
- **Pitch type:** v1 uses the same delivery profile for all types because the inspected OBP pitch trials are all fastballs. If type-specific profiles later exist, their pre-release divergence requires an explicit gameplay fairness/deception decision and a test; do not leak the selected pitch with arbitrary early animation.
- **Hitting:** mirror before sampling so left/right bat paths remain coherent. Compute the bat frame from both hand transforms (or an explicit grip frame), not by attaching the bat to the current right-arm chain alone.

## 7. Minimal implementation v1

1. Add the profile validator, sampler, one first-party/cleared R windup fastball profile, one R stretch profile, and one R standard swing profile. Do not ingest OBP files in the repository or browser.
2. Split renderer matrices only enough to show pelvis vs torso rotation and a forearm roll; preserve defaults so existing runners, fielders, catchers, and their tests render identically.
3. Replace `pitcherPoseK`, `blendPitchPose`, `PITCH_RELEASE_K`, and the hard-coded post-release settle with `samplePitchMotion`. Keep existing `launchPitch` / `pitchPos` values and timing except for synchronising the visual BR tick to the existing launch tick.
4. Replace the `drawBatter` sine scalar with `sampleSwingMotion`; retain existing contact computations and the current click/bunt semantics exactly.
5. Add profile diagnostics behind a development flag: profile ID, phase/event label, BR alignment error, and current pelvis/torso yaw. Diagnostics must not be recorded as decision inputs.
6. Do **not** implement IK, OpenCap, Pose2Sim, PCA, model inference, new ball release physics, or procedural pitch-type differences in the browser loop.

## 8. Direct behavioural and kinematic contracts

| Contract | Test evidence / assertion |
|---|---|
| Release is visually synchronous | At the update tick `launchPitch` first creates `pitch`, sampled pose is at BR within one render frame; ball is not rendered airborne while sample phase is before BR. |
| Event order holds for every shipped profile | `set ≤ SFC < plant ≤ MER < BR < MIR < ready`; no duplicate/reversed anchors. The exact relation of SFC/plant is profile-defined but must remain chronological. |
| Proximal channels are separable | A profile with nonzero hip–shoulder separation yields `pelvisTurn !== torsoTurn`; an assertion fails if all rotation is collapsed into legacy `turn`. |
| No discontinuity at key boundaries | Sample each key and the two neighbouring 60 fps frames. Position/angle and estimated angular velocity must stay under declared per-channel jump limits; use unwrapped angles. |
| R/L mirror is anatomical, not cosmetic | Mirroring swaps throw and glove arms, mirrors stride and pelvis/torso yaw, keeps event times unchanged, and places the bat between both hands. |
| Swing event order and contact image | `FFC < FFP < contact < finish`; at contact the bat grip is within tolerance of both hands and its sweet-spot direction matches the sampled bat frame. |
| Existing gameplay is unchanged in v1 | Fixed seeds and identical user inputs produce the same `pitchPos`, contact result, runners, outs, and scoreboard traces before and after the visual-motion change. |
| Renderer budget | Sampling every current player at 60 fps uses no per-frame allocation after profile load and stays within the existing frame-time budget on the supported browser target. |

## 9. Mutation tests

1. Swap `MER` and `BR` in a profile: the profile validator must reject it.
2. Change BR to a global `.80` while a profile has another BR event: release-synchronisation test must fail.
3. Delete separate `pelvisTurn` and route both rotations through `turn`: proximal-channel test must fail.
4. Remove unwrapping at a `+π/-π` boundary: continuity test must fail.
5. Leave `glove` permanently on the left arm after L mirroring: handedness test must fail.
6. Attach the bat only to the trailing arm: two-hand contact test must fail.
7. Change `launchPitch` coordinates or `doSwing` outcome inside the motion patch: seeded gameplay-trace comparison must fail.
8. Add pitch-type-specific pre-release keys without a disclosure flag: the pitch-identity leakage test must fail.

## 10. Validation impact

The research branch made no implementation change and therefore did not run or claim a new gameplay PASS. When v1 is implemented, validation must be in two layers:

1. **Motion layer:** the direct and mutation contracts above, profile provenance validation, 60 fps continuity capture, and left/right visual screenshots at SFC/MER/BR/MIR and FFC/FFP/contact.
2. **Game-regression layer:** replay the existing recording corpus and its architectural/behavioural mutation suite, then run the established 1000-route and 50-game checks on the actual implementation branch. Compare deterministic game-state traces, not just “looks right.” The b29 handoff reports historical 51-browser and broader route/game validations, but this report does not represent them as rerun here.

No runner/fielding policy contract should change. If a future implementation alters the physical release location rather than only synchronising the renderer, classify that separately as pitch-flight physics work and require its own distribution tests.

## 11. Copy / adapt / concept-only / reject table

| Candidate | Classification | Reason and permitted use |
|---|---|---|
| OBP `obp/core.py` loader and `examples/03_join_fullsig.py` | **Reject** for game runtime | MIT code, but it is Python/pandas data-loading code and would pull a separately restricted dataset into the wrong layer. |
| OBP event/table schema (`session_pitch`, `time`, FC/plant/MER/BR/MIR; hitting FFC/FFP/contact) | **Calibration-only** | Use to design an importer, source-data QA, and event contract. Do not ship OBP-derived curves without a commercial licence. |
| OBP raw C3D/full-signal/POI/metadata and README biomechanics documentation | **Reject** for this game until written commercial permission | CC BY-NC-SA 4.0 plus explicit professional-organisation restriction; derivative motion files are not safe to treat as commercially clean. |
| OpenSim weighted marker/orientation IK idea | **Concept-only** | Correct offline model-fitting reference, but not a browser renderer dependency or validated baseball model. |
| OpenCap stage decomposition and output/error discipline | **Adapt** offline | Use calibration → pose → triangulate → augment → IK → error audit as a controlled own-capture workflow. Do not call it during play. |
| Pose2Sim filtering/scaling/IK workflow | **Adapt** offline | BSD-3-Clause permits reuse with notices, but validate fast throwing separately; export only cleared compact game channels. |
| Orishimo / Dowling / Scarborough event and sequence results | **Calibration-only** | Set invariants and QA bands, never copy a group mean as a player’s literal animation. |
| PCA score sampling in the game loop | **Reject** | Hard to constrain and diagnose; it can create impossible joints. PCA is useful only for offline analysis. |
| Cluster → medoid / constrained median → adaptive key compression | **Adapt** | The recommended offline method once input rights and quality are established. |

## 12. Licensing and commercial-use gate

Before any motion file is added to the game, maintain a profile-level provenance record containing source agreement, contributor consent, allowed uses, transformation software/version, and export hash. The gate is:

```text
source has explicit commercial game-use rights
AND capture consent covers derivative animated characters
AND export contains no restricted raw samples or identifiers
AND legal/provenance review is recorded
=> profile may enter MOTION_BANK
otherwise => research/calibration only; not shipped
```

MIT, Apache-2.0, and BSD-3-Clause in the inspected tools do not override OBP’s separate data/documentation licence. “We rewrote the values by hand” is not a sufficient clearance argument if the shipped curve remains a derivative of restricted data.

## 13. Risks, negative findings, and unresolved questions

- **OBP is not a commercial motion library.** This is the material blocker for an OBP-derived shipping profile, not a missing parser.
- **Fastball-only sample.** The inspected OBP pitching POI contains `FF` only. It cannot validate pitch-type, sidearm/submarine, windup/stretch, fatigue, youth, or other delivery variation.
- **Generic IK models are not baseball-proof.** OpenSim/OpenCap/Pose2Sim produce a rigorous workflow, not automatically valid shoulder/scapula/forearm kinematics during a high-speed pitch. Validate against a known reference capture before treating output as a master curve.
- **Current skeleton lacks required degrees of freedom.** Without a pelvis/torso split, forearm roll, profile-aware glove hand, and two-hand bat relation, feeding more accurate data into existing pose fields will still look wrong.
- **No body-motion-to-performance coupling in v1.** Keeping current ball/contact maths is intentional risk control. A later physics coupling needs a separate design because it would change batter timing, pitch release, and game balance.
- **Avatar style is a design choice.** A realistic full-body curve may clip through the current uniform mesh/camera framing. Key reduction must be checked in the actual WebGL camera, not only with an offline skeleton viewer.
- **Event detectors need tolerance.** A one-frame difference at 360/480 Hz is normal; tests should use measured frame tolerance but never tolerate a reversed phase order.

## Final verdict

Implement the motion-bank architecture, but do not use OBP data as the bank’s source without a written commercial licence. The most valuable first code change is the small renderer-skeleton split that preserves pelvis-versus-torso and two-hand/bat relationships; then synchronise an owned profile’s BR to the already-existing `launchPitch` tick. This removes the present structural visual mismatch without turning animation research into an unbounded rewrite of gameplay.
