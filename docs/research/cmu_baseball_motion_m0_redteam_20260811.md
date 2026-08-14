# CMU baseball motion M0 — Browser-GPT red-team review

Date: 2026-08-11
Repository: `L-carp55/baseball3d-game`
Reviewer role: browser-GPT integration / final design judgment

Gameplay source of truth remains:
- branch: `agent/b0805-29-possession-footwork`
- BUILD: `b0805-29`
- SHA: `60b993b73fed854934a976e45e8feb9437deb584`
- Draft PR #23; do not merge without owner instruction

M0 source reviewed:
- branch: `codex/research-cmu-baseball-motion-qualification-20260810`
- commit: `e38d6bc658c5d0a011f888c6cdae1e4ca92fdd0a`
- `docs/research/cmu_baseball_motion_qualification.md`
- `docs/research/cmu_baseball_motion_manifest_20260810.json`
- `tools/motion/inspect_cmu_asf_amc.py`

## 1. Integrity result

Compared M0 task commit `c1fe741ca9c58ce691462bd2d4b887911ae4aafe` against result commit `e38d6bc658c5d0a011f888c6cdae1e4ca92fdd0a`.

Only these files were added:
- `docs/research/cmu_baseball_motion_manifest_20260810.json`
- `docs/research/cmu_baseball_motion_qualification.md`
- `tools/motion/inspect_cmu_asf_amc.py`

`baseball3d.html` was not changed.

The Python tool does not embed CMU raw motion samples. It parses ASF/AMC, performs an Acclaim-style local-axis transform/FK, derives aggregate diagnostics, and writes optional contact sheets outside the repository.

## 2. External source re-verification

Browser-GPT independently rechecked the official CMU Graphics Lab Motion Capture Database pages.

Confirmed from the official site:
- the database describes the data as free for all uses;
- data may be included in commercially sold products;
- the data may not be resold directly, even in converted form;
- the FAQ additionally says motion-capture data may be copied, modified, or redistributed without permission;
- Subject #124 lists trial 1 and 2 as `Baseball Pitch`, trial 7 as `Baseball Swing`, all at 120 fps;
- CMU warns that hand/toe joints may be noisy and that finger/thumb joints are not actually captured;
- the FAQ gives an explicit ASF/AMC length/root-position conversion to metres: `(1/0.45) * 2.54/100 = 0.056444 m per source unit` for database files.

Therefore CMU #124 is usable as a source candidate for a motion profile embedded in this game, subject to the database's no-direct-resale condition and provenance preservation.

## 3. Trial verdicts

### 124-01 — APPROVE_FOR_M1

Accept the M0 conclusion.

Reasons:
- one clean, continuous windup-like overhand pitching sequence exists;
- sufficient major-segment DOFs exist for a simplified game silhouette;
- event proxies are coherent enough for animation phase alignment;
- no gross FK discontinuity was reported across the inspected core sequence;
- the sequence is mirrorable, so uncertain source handedness need not become a hard-coded identity.

Use only as a visual source. It is not a source of pitch velocity, exact ball release location, gameplay timing, arm-strength values, or pitch physics.

### 124-02 — CONDITIONAL / NOT M1 PRIMARY

Accept M0. Do not use in M1 v1. The file contains multiple delivery-like actions and substantially more root travel. Reconsider later only as a second animation style after 124-01 is stable.

### 124-07 — DEFER TO M2

Accept M0. It may become a batting-motion reference later, but lack of bat/ball/contact ground truth makes it unsuitable for the current pitcher-motion implementation.

## 4. Corrections to M0 wording

### C1 — physical unit conversion is available

M0 repeatedly says source-unit values are not safe to convert directly to physical units. This is too strong.

CMU's official FAQ explicitly supplies the conversion for ASF/AMC bone lengths and root positions:

`source units * 0.056444 = metres`

Using that official conversion, some M0 aggregate values correspond approximately to:
- 124-01 active-window root net: `5.718` -> `0.323 m`
- 124-01 preparatory-to-contact source-left-foot travel: `24.244` -> `1.368 m`
- 124-02 selected root net: `12.504` -> `0.706 m`

These values may be used for **QA and plausibility checks**.

They still must **not** directly drive gameplay world translation or `launchPitch` coordinates, because:
- the selected time windows include different motion phases;
- a foot path is not the same quantity as pitcher COM/root displacement;
- current game release coordinates and gameplay timing are separate contracts;
- M1 is intentionally visual-only.

### C2 — attribution is requested/recommended, not proven mandatory by the displayed terms

The official homepage says acknowledgement is appreciated when publishing results. The M0 manifest field `acknowledgement_required: true` overstates the text actually verified.

Project policy for M1: preserve CMU provenance and include the requested acknowledgement in a third-party/source note anyway. Treat this as an internal provenance decision, not a claim that the visible CMU terms impose a mandatory attribution licence clause on the game.

### C3 — `root yaw` is not measured pelvis rotation

Keep M0's own limitation. Subject #124 ASF has no separate pelvis bone; root heading can only be a pelvis/heading proxy. The runtime/profile metadata must not present this as clinical/biomechanical pelvic kinematics.

## 5. Timing conflict discovered during integration

Current gameplay:
- player-batting CPU windup lasts `0.85 s` before `launchPitch()`;
- `launchPitch()` is the gameplay-authoritative release tick;
- current post-release pitcher motion is partly driven by `pitch.t`, so its visual follow-through duration depends on pitch flight duration.

CMU 124-01 qualification:
- stride-foot-contact proxy roughly 1.92–2.05 s into source capture;
- release proxy roughly 2.43–2.51 s;
- recovery/field-ready proxy much later.

Direct playback at source timing would change the pre-pitch gameplay window and therefore can affect stealing, interaction pacing, and difficulty. That violates M1's visual-only isolation.

### M1 decision

For first implementation:
- keep gameplay windup duration / `launchPitch` timing unchanged;
- event-normalize and retime the CMU-derived visual track into the existing pre-release window;
- force the CMU-derived release-proxy key to coincide with the exact existing `launchPitch()` transition;
- use an independent renderer motion clock after release, instead of scaling follow-through from `pitch.t`;
- do not change pitch flight, contact logic, steal timing, or `pitchPos` in M1.

This deliberately compresses source tempo. It is an isolation tradeoff, not a claim that 0.85 s is realistic.

After owner visual playtest, a later **M1.1 delivery-cadence gate** may independently consider changing windup/release timing. That would be a gameplay/pacing change and must not be smuggled into M1.

## 6. M1 architecture decisions

### Motion source

M1 uses **124-01 only**.

Raw CMU ASF/AMC remains outside Git. The implementation branch may re-download only:
- `124.asf`
- `124_01.amc`

It must verify SHA-256 against the M0 manifest before export.

### Motion profile

Create one compressed renderer-facing profile with approximately 12–18 reviewed keys. Store provenance:
- source trial `124-01`
- source AMC SHA-256
- source ASF SHA-256
- source FPS 120
- CMU source/terms URL
- exporter version/hash
- exact source frames/ranges used by every exported key
- statement that release/SFC/MER-like labels are inferred visual proxies, not CMU-labelled baseball events.

Do not store the entire AMC sequence in code.

### Renderer compatibility

Extend `drawFigure` only through optional fields and preserve an exact legacy path for all non-pitcher figures.

Required pitcher-only channels:
- normalized visual root stride/rise
- pelvis/root-heading visual turn
- torso-relative turn/lean/tilt
- throwing-arm elevation/plane
- throwing elbow flex
- glove-arm elevation/plane/elbow
- lead/rear hip and knee values
- profile-aware glove side

Forearm pronation/roll must not be invented from CMU because the qualified source lacks an explicit channel.

### Handedness

124-01 handedness remains provisional. Implement a documented mirror transform and source-side metadata. Do not make uncertain source laterality a permanent game-truth claim.

### Release alignment

Animation cannot move the physical ball release point in M1.

At the gameplay tick on which `launchPitch()` creates `pitch`, the rendered pitch profile must be at its designated `release_proxy` phase. A debug helper should report visual throwing-hand world position versus the existing pitch release point, but this is QA only.

### Post-release

Follow-through/recovery uses a renderer-owned motion clock and source-derived phase shape. It must not be stretched differently for fastball/curve/fork/sinker merely because their `pitch.dur` values differ.

## 7. Required direct contracts

1. `baseball3d.html` gameplay trace parity: fixed-seed inputs produce identical pitch target, pitch duration, contact result, runners, outs and score before/after M1.
2. Release phase parity: the first tick with a created `pitch` is the same tick on which the sampled motion is at `release_proxy` within one render-frame tolerance.
3. Pitch-type timing isolation: changing pitch type/duration does not change post-release motion-clock duration.
4. Legacy figure compatibility: runner/fielder/catcher pose matrices remain on the old path when new pitcher channels are absent.
5. Mirror contract: source-side swap changes throw/glove arms and yaw/stride lateral signs but not phase-event times.
6. Provenance contract: profile validator rejects missing CMU source SHA/terms/trial/export metadata.
7. No source-data leakage: repository contains no full AMC/ASF payload and no full-frame converted motion sequence.
8. No gameplay coupling: motion sampler cannot write pitch physics, batting outcome, runner intent, FieldingAssignment, ThrowDecision or DefenseActionPolicy.
9. Continuity: no key boundary produces a one-frame angle/position pop above declared renderer tolerances.
10. Human visual acceptance remains required for SFC/load, high-cock, release, follow-through and recovery silhouette.

## 8. M1 non-goals

Do not include in M1:
- changing 0.85 s gameplay windup timing;
- changing `launchPitch` release coordinates;
- replacing `pitchPos` physics;
- adding pitch-type-specific delivery tells;
- implementing batting motion from 124-07;
- fielding AI, FieldingExecution, throw physics or ball physics;
- full skeleton/SkinnedMesh migration;
- runtime OpenSim/OpenCap/Pose2Sim/IK;
- OBP raw/data-derived motion.

## 9. Final M0 decision

**M0 = REVIEWED / CLOSED.**

Proceed to M1 implementation using CMU 124-01 as the only source motion candidate, with the corrections and isolation constraints above.
