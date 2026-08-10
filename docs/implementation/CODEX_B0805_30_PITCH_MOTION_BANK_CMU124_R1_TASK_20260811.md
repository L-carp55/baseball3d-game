# Codex repair task — b0805-30 CMU #124-01 pitch motion bank R1

Date: 2026-08-11
Repository: `L-carp55/baseball3d-game`
Repair branch: `codex/b0805-30-pitch-motion-bank-cmu124-r1`
Repair base: `b93f33410a8604ab8598c34ca1bf4127a6186665`
Gameplay ancestry: `agent/b0805-29-possession-footwork@60b993b73fed854934a976e45e8feb9437deb584`
Target BUILD: remain `b0805-30`

## 0. Objective

Repair the CMU 124-01 source-to-renderer conversion in the existing b0805-30 candidate without changing gameplay, pitch flight, 0.85 s CPU windup, batting results, runner logic, fielding AI, defense policy, or release coordinates.

This is **not** M1.1 and not a broader animation rewrite. Preserve the good M1 isolation/provenance architecture and correct only the blocking source/retargeting defects found by browser-GPT red-team.

Do not merge. Do not open a PR. Commit and push the repaired branch, then stop.

## 1. Required source documents

Read directly from GitHub before editing.

### Candidate implementation

- branch/head: `codex/b0805-30-pitch-motion-bank-cmu124@b93f33410a8604ab8598c34ca1bf4127a6186665`
- implementation commit: `7633fed30fe5b61019bce3b60dc0262f8f1a3494`
- `baseball3d.html`
- `tools/motion/export_cmu124_pitch_profile.py`
- `docs/third_party/cmu124_pitch_profile_v1.json`
- `docs/third_party/cmu_mocap_subject124.md`
- `_test_pitch_motion_bank_cmu124_20260811.js`
- `docs/audits/b0805_30_pitch_motion_cmu124.md`

### Browser red-team — authoritative repair requirements

Read from `agent/research-baseball-motion-ai`:

- `docs/audits/b0805_30_pitch_motion_cmu124_browser_redteam_20260811.md`
- commit containing it: `fe4a833dc17371992852d851ad160c3cbd5218be`

### M0 qualification and canonical FK reference

Read from commit `e38d6bc658c5d0a011f888c6cdae1e4ca92fdd0a`:

- `docs/research/cmu_baseball_motion_qualification.md`
- `docs/research/cmu_baseball_motion_manifest_20260810.json`
- `tools/motion/inspect_cmu_asf_amc.py`

Also read browser M0 red-team:

- `agent/research-baseball-motion-ai:docs/research/cmu_baseball_motion_m0_redteam_20260811.md`

## 2. Preserve these accepted M1 properties

Do not regress:

1. exact gameplay ancestry / BUILD lineage;
2. CMU source file SHA verification;
3. no raw `.asf`, `.amc`, `.c3d`, full-frame converted motion, or preview sequence in Git;
4. compact source-provenanced profile;
5. CPU gameplay windup remains exactly `0.85 s`;
6. `pitch.rx/ry/rz`, `pitchPos`, pitch target, `pitch.dur`, contact/batting logic, runner state and rules unchanged;
7. renderer-owned post-release seconds clock, not `pitch.t`;
8. once a batted ball enters live `flight`, `fielderPose()`/fielding movement wins immediately;
9. legacy `drawFigure` path remains byte/behavior compatible for non-pitch callers as far as practical;
10. mirror architecture remains first-class and deterministic;
11. all b25–b29 regressions remain protected.

## 3. BLOCKER F1 — replace raw-root-X `rootForward`

Current bad logic:

```python
rootForward = (root[0] - root_x_start) / root_x_span
```

and runtime:

```js
pose.stride = sample.rootForward * 4.8;
```

Current profile therefore produces:

- SFC: 4.8 ft visual stride
- release: about 2.30 ft
- MIR/follow: about 0 ft

This makes the rendered pitcher move about 2.5 ft backward between foot contact and release.

### Required source geometry

Use the correctly reconstructed ASF/AMC world geometry, not a raw coordinate component.

Create/reuse one canonical Acclaim ASF/AMC FK implementation. Prefer extracting the reusable parsing/FK math from the M0 `inspect_cmu_asf_amc.py` rather than implementing another inconsistent interpretation.

Construct a source delivery coordinate frame:

- up = source world +Y after canonical FK verification;
- forward = a documented horizontal stride direction inferred from the qualified 124-01 sequence, preferably the source-left lead-foot displacement from load/stride onset to SFC/plant;
- lateral = orthogonal horizontal axis;
- verify the forward direction against focused source frames/contact-sheet geometry before using it.

Project root world displacement onto this fixed forward axis. Preserve source lateral motion separately only if useful; do not alias lateral travel into forward stride.

### Visual stride retarget

- keep source physical metres available for QA only;
- do not change gameplay fielder coordinates or physical pitch release;
- retarget the source forward progression into the simple rig with one documented visual scale/offset calibration;
- the visual channel must not make a multi-foot backward reversal from SFC through release;
- small source-backed settling is allowed, but define and test a tight engineering tolerance rather than silently accepting the current reversal.

### Direct contract

At minimum assert on the final rendered stride track:

- SFC -> plant -> MER -> release has no backwards step greater than `0.15 ft` between adjacent selected keys;
- total SFC -> release reversal is not more than `0.25 ft`;
- any exception requires source-world FK evidence recorded in audit.

These are renderer engineering tolerances, not claims of baseball biomechanics constants.

## 4. BLOCKER F2 — all motion channels must come from canonical FK/geometry, not raw AMC Euler indices

Current exporter directly uses raw fields such as:

```python
root[4]
lowerback[1] + upperback[1] + thorax[1]
rhumerus[0]
rhumerus[2]
rradius[0]
```

This bypasses ASF bone-axis bases and contradicts M0's canonical FK discipline.

### Required repair architecture

Add a reusable local tool/module, for example:

`tools/motion/cmu_asf_amc_fk.py`

or another clearly named equivalent, containing one canonical implementation of:

- ASF units/root/bone axes/DOF/hierarchy parsing;
- AMC frame parsing;
- axis-basis sandwich;
- parent-to-child FK;
- source-to-delivery coordinate-frame transform.

The exporter must consume this canonical result.

Derive compact renderer channels from reconstructed transforms/geometric vectors:

### Root/pelvis proxy

- root orientation transformed into the delivery coordinate frame;
- still label it root/pelvis proxy, not measured pelvis kinematics.

### Torso

- use thorax/world orientation relative to root/pelvis proxy via rotation-matrix composition;
- extract renderer yaw/lean/tilt from the relative transform using one documented convention;
- do not sum raw lowerback/upperback/thorax Euler channel numbers.

### Throwing and glove arm

Use geometric joint vectors from FK:

- shoulder/upper-arm vector in torso-local coordinates;
- elbow flexion from shoulder-elbow-wrist geometry;
- same for glove arm.

Map the 3D source upper-arm direction to the two available simple-rig controls (`arm*`, `arm*Z`) through a geometry-based inverse mapping of the actual `drawFigure` segment transform, not an arbitrary affine angle formula.

Do not invent forearm pronation.

### Legs

Use root/pelvis-local thigh vectors and geometric knee flexion. Dropping unsupported lateral DOF is allowed but must be explicit.

## 5. BLOCKER F3 — actual rendered hand must align with unchanged physical release

Current audit records a hand/ball proxy separation of `3.810438 ft` at release.

The current helper is an approximate second kinematic implementation; it is not the exact drawFigure endpoint.

### Required repair

Refactor the relevant segment transform math so the same pure helper can be used by:

- `drawFigure()` to place the arm segments; and
- a test/debug function to return the **actual rendered throwing-hand endpoint** for a pose.

There must not be two different hand kinematics implementations.

Keep:

- `pitch.rx=0.95`
- `pitch.ry=5.75`
- `pitch.rz=54.0`

unchanged.

Retarget only visual root/torso/arm calibration.

### Release gate

For the simple rig, require the actual renderer hand endpoint at `release_proxy` to be within **0.75 ft 3D distance** of the unchanged game release point.

This is an engineering visual-alignment tolerance, not a claim that CMU measured the release point.

Also assert:

- from MER/high-cock to release, the throwing hand progresses toward the game release direction rather than receding;
- release -> early follow-through continues a coherent forward/cross-body path before recovery.

If 0.75 ft cannot be achieved without creating an obviously distorted pose, do not hide the failure. Report the conflict and stop instead of moving the physical ball.

## 6. MAJOR F4 — replace frame-585 pseudo-ready key with a real game-side ready adapter

The task required source-derived follow-through around frames 310–351, then a blend to the existing field-ready/neutral pose.

Current implementation exports frame 585 as `field_ready_adapter_proxy`, with clamp-edge/extreme source-derived channels.

Repair:

1. source-derived post-release motion ends at/near the qualified 351 follow-through proxy;
2. after that, use an explicitly marked **game adapter key/pose**, not a CMU event key;
3. derive the adapter from the existing pitcher/fielder ready contract so it cannot introduce raw-source clamp extremes;
4. metadata must distinguish `sourceKey:true` from `adapterKey:true` or equivalent;
5. no adapter key may pretend to have a CMU source frame;
6. post-release interpolation toward ready should remain renderer-time-based and may be interrupted instantly by live fielding.

Add a direct test that adapter channels remain inside declared ready-pose bounds and that no channel is accepted merely because the exporter clamp forced it to a limit.

## 7. MAJOR F5 — strengthen tests so the old broken implementation cannot pass

Extend `_test_pitch_motion_bank_cmu124_20260811.js` and/or add an exporter-level test.

Required new direct/mutation contracts:

1. **FK-only exporter:** selected key channels must be generated from canonical FK/geometric output. Mutation to raw AMC-index derivation must fail.
2. **Stride direction:** the current SFC=4.8 -> release=2.30 -> follow=0 trajectory must fail.
3. **Actual hand endpoint:** current ~3.81 ft release separation must fail the <=0.75 ft gate.
4. **Forward arm action:** replacing geometry-based retarget with the current affine `-2.95 + sourceAngle*1.25` mapping must fail.
5. **Ready adapter:** restoring source frame 585 as the adapter must fail.
6. **Existing M1 mutations** (.80 release, `pitch.t`, collapsed torso/root, hard-coded glove) must still be detected.
7. **Gameplay trace parity** remains identical to b29.
8. **No raw data in Git** remains enforced.

## 8. Event timing

Keep CPU gameplay release at 0.85 s.

Do not use this repair to change delivery cadence.

The pre-track may retain source-relative timing or use a clearer event-segment-normalized retiming if necessary to make the repaired motion coherent, but:

- `release_proxy` must remain on the exact existing `launchPitch()` tick;
- steal/input/gameplay timing cannot change;
- any changed visual event timing must be recorded in the audit and remain deterministic.

Do not claim one retiming curve is biomechanically correct.

## 9. Player-controlled pitching remains deferred

Do not add a click-to-release delay for the user's pitching half in this repair.

The existing `aimPitch -> launchPitch` path has no 0.85 s pre-release display track. Changing that would alter gameplay pacing and belongs to M1.1 or another explicit task.

Document the limitation; do not silently change it.

## 10. Required regressions

Run at minimum:

- repaired CMU profile/exporter tests including all new direct/mutation contracts;
- byte-identical exporter regeneration from verified CMU hashes;
- architecture guard;
- RunnerIntent;
- runner controls/sliding;
- FieldingAssignment;
- ReachModel;
- DefenseActionPolicy;
- force-chain;
- b28 breakaway/transfer context;
- b29 possession-footwork + mutation.

Attempt the browser regression if Chromium is available. If unavailable, record exactly why and do not claim PASS.

Do not quote historical 138/1000/50 results as newly rerun unless they are actually rerun.

## 11. Required audit

Create/update:

`docs/audits/b0805_30_pitch_motion_cmu124_r1.md`

Must include:

- exact repair base and final SHA;
- changed files;
- canonical FK implementation used;
- delivery-axis definition and evidence;
- source frames/keys;
- old vs repaired stride values for SFC/plant/MER/release/early follow;
- actual renderer hand endpoint and unchanged physical release coordinates;
- release endpoint distance;
- arm/hand progression from MER -> release -> early follow;
- ready adapter definition;
- direct/mutation test results;
- every failed or unavailable validation;
- explicit statement that gameplay traces/release coordinates/timing remain unchanged;
- player-controlled pre-release limitation;
- negative findings / unresolved questions.

Do not place any important result only in the final Codex chat response.

## 12. Definition of Done

Done only when all of the following are true:

- F1–F5 are repaired in code, exporter, profile and tests;
- source-to-rig channels derive from canonical ASF/FK/geometric data;
- no large backward SFC->release visual translation survives;
- actual renderer hand endpoint is <=0.75 ft from unchanged release point at release proxy;
- source-derived follow-through ends around the qualified source range and blends to an explicit game adapter;
- gameplay timing / pitch flight / batting / runner / fielding-policy behavior remains trace-identical to b29 within existing deterministic harness;
- all required tests pass or unavailable browser validation is honestly recorded;
- audit is committed;
- branch is pushed;
- no merge, PR, M1.1, P1, E1, F1 or P2 work is started.

Commit and push all repair changes, then stop.