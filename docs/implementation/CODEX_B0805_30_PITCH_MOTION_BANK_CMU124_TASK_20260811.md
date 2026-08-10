# Codex implementation task — b0805-30 CMU #124-01 pitch motion bank

Date: 2026-08-11
Repository: `L-carp55/baseball3d-game`
Implementation branch: `codex/b0805-30-pitch-motion-bank-cmu124`
Exact gameplay base: `60b993b73fed854934a976e45e8feb9437deb584`
Current gameplay BUILD: `b0805-29`
Target BUILD: `b0805-30`

## 0. Objective

Replace the current hand-authored pitcher pose sequence with a small, source-provenanced, event-normalized motion profile derived from **CMU Graphics Lab Subject #124 trial 124-01 only**, while keeping game rules, pitch flight, launch timing, batting results, runner behavior, fielding AI and defense policy unchanged.

This is the first gameplay implementation after the realism research program. It must remain narrowly visual/animation-focused so owner playtest can determine whether the pitcher motion is materially improved before any delivery-cadence or pitch-physics change.

## 1. Why this task exists

The current pitcher animation is structurally limited:

- `drawFigure()` uses one combined body transform for pelvis/torso motion;
- `pitcherPoseK()` is a three-section hand-authored pose curve;
- `PITCH_RELEASE_K=.80` is a global magic phase;
- visual post-release motion is tied to `pitch.t`, so fastballs and breaking balls stretch recovery differently because their ball-flight duration differs;
- the visual throwing hand and game-authoritative `launchPitch()` release tick are only loosely coupled.

Independent research and M0 qualification found CMU #124-01 to contain a usable continuous windup-like overhand pitching sequence at 120 fps. M1 should use that source to replace the hand-authored silhouette/timing relationships without changing gameplay semantics.

## 2. Required documents and refs to read before editing

Read from GitHub directly; do not rely on chat summaries.

### Current game

- `agent/b0805-29-possession-footwork@60b993b73fed854934a976e45e8feb9437deb584`
- `baseball3d.html`
- Draft PR #23 for current b29 context; do not merge it.

### Integrated research

Read from `agent/research-baseball-motion-ai`:

- `docs/research/baseball_realism_integration_v1.md`
- `docs/research/cmu_baseball_motion_m0_redteam_20260811.md`

The browser-GPT M0 review commit containing the latter is:

`295150ce9998ef0e3ca92a4af92596a317cf48a6`

### M0 qualification source

Read from commit:

`e38d6bc658c5d0a011f888c6cdae1e4ca92fdd0a`

Files:

- `docs/research/cmu_baseball_motion_qualification.md`
- `docs/research/cmu_baseball_motion_manifest_20260810.json`
- `tools/motion/inspect_cmu_asf_amc.py`

### Agent A source-backed design

Read from commit:

`65d01929539329ff103baf53ca8c340f070f725f`

- `docs/research/codex_pitching_motion.md`

## 3. Project boundary

This is the manual-playable 3D baseball game.

Do not use or modify the separate PowerPro/Prospi player-rating or pennant-simulator project, its appraisal formulas, or its NPB/MLB rating data.

## 4. Source data allowed for this task

Use **CMU Subject #124 trial 124-01 only** as the motion source.

Official source files:

- `https://mocap.cs.cmu.edu/subjects/124/124.asf`
- `https://mocap.cs.cmu.edu/subjects/124/124_01.amc`

Expected hashes from the reviewed M0 manifest:

- `124.asf` SHA-256: `b0e6a62b7e151200497b8bbcf42d0e95800decabec9254f8653e57dcde45dd45`
- `124_01.amc` SHA-256: `7fd098ab1b535c38a3a6ae7c82f7c87299e177ce665dd65fa19db110e22f0857`

Expected total payload is about 0.52 MB. The large-download guard has already been satisfied for this exact pair; still verify hashes after retrieval.

### Raw-data rule

- download raw ASF/AMC only to temporary non-repository storage;
- do not commit raw ASF/AMC;
- do not commit a full-frame converted copy of the AMC sequence;
- commit only the compact game profile and provenance/export metadata required by the implementation.

### CMU terms/provenance

Official CMU pages were independently rechecked by browser-GPT:

- database says data are free for all uses and may be included in commercially sold products;
- data may not be resold directly, even in converted form;
- FAQ says mocap data may be copied, modified, or redistributed without permission;
- acknowledgement is requested/appreciated for published results.

Keep a source/provenance note in the repository. Do not state that attribution is legally mandatory unless you have additional primary-source evidence; project policy is to preserve the requested acknowledgement anyway.

CMU requested acknowledgement text:

`The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.`

## 5. Important correction from M0 red-team

CMU's official FAQ provides a physical conversion for database ASF/AMC bone lengths and root positions:

`source units * 0.056444 = metres`

M0 wording that source units cannot safely be converted was too strong.

Use physical conversion only for offline QA/plausibility. Do **not** wire raw CMU root translation directly into the game world or change `launchPitch()` release coordinates.

## 6. Critical gameplay isolation decision

Current gameplay launches the CPU pitch after a `0.85 s` windup timer. CMU 124-01's inferred release proxy is around source frames 293–302, roughly 2.43–2.51 s into the source capture.

**Do not change the 0.85 s gameplay windup in b0805-30.**

Changing it would alter steal windows, batting pacing and difficulty, making visual-motion validation inseparable from gameplay timing.

Instead:

1. event-normalize the source pre-release track;
2. retime that visual track into the existing 0.85 s pre-release gameplay window;
3. make the source-derived `release_proxy` phase coincide with the exact tick on which existing `launchPitch()` creates `pitch`;
4. use a renderer-owned post-release motion clock rather than `pitch.t` as the time source;
5. if a batted ball starts fielding before recovery finishes, fielding/locomotion authority wins; do not freeze the pitcher in a cosmetic follow-through while he needs to field.

This visual retiming is an isolation compromise. It is **not** a claim that a 0.85 s windup is realistic.

A later M1.1 can consider delivery cadence only after owner playtest and must be a separate gameplay/pacing change.

## 7. Current source areas that must be inspected

At minimum, inspect and map:

- `beginAtBatPhase`
- `launchPitch`
- `update`
- `updatePitch`
- `drawFigure`
- `pitcherPoseK`
- `blendPitchPose`
- `PITCH_RELEASE_K`
- `pitcherPose`
- pitcher draw call / fielding transition
- `fielderPose` interaction once a ball is put in play
- any recording/debug fields related to pitch animation

Do not edit unrelated fielding, runner, batting-outcome or throw-policy code unless a direct compile/runtime dependency requires a minimal compatibility change.

## 8. Required offline export step

Create or extend a reproducible source-processing tool, suggested path:

`tools/motion/export_cmu124_pitch_profile.py`

It may reuse the reviewed ASF/AMC parsing/FK logic, but it must:

1. verify source hashes before export;
2. use 124-01 only;
3. use an explicit manually reviewed source window/key list;
4. map source local transforms to a small renderer-facing channel set;
5. record every selected source frame/range and mapping version;
6. produce a compact profile, not a full-frame converted sequence;
7. make R/L mirroring deterministic and testable;
8. preserve source-side uncertainty in metadata (`provisional_right_mirrorable` or equivalent);
9. write no raw payload to Git.

### Key count

Target approximately **12–18 reviewed pitch keys**. Fewer is allowed only if continuity tests prove it; more is allowed only around fast arm/release transitions where compression otherwise produces visible artifacts.

Suggested phase coverage:

- start / preparation
- load / knee rise
- stride early
- stride-foot-contact proxy
- plant proxy
- cocking
- MER/high-cock proxy
- release approach
- release proxy
- early follow-through
- late follow-through
- field-ready/settle adapter

Do not invent scientific event labels. Source events are visual/kinematic proxies and metadata must say so.

## 9. Runtime data contract

Create one compact renderer-only pitch profile, either embedded in `baseball3d.html` or generated into the existing single-file build in a reproducible way.

Required metadata:

- schema/version
- profile ID
- source database / Subject # / trial
- source ASF and AMC SHA-256
- source FPS
- CMU source/terms URL
- exporter version/hash
- source laterality confidence
- exact source frame/range for each key or phase
- explicit note: no ball / no measured release event / event labels are inferred proxies

Required visual channels should be the minimum needed by the current procedural renderer:

- `rootStride01`
- optional `rootRise`
- root/pelvis-proxy visual turn
- torso-relative yaw/lean/tilt
- throwing-arm elevation / plane
- throwing elbow flex
- glove-arm elevation / plane / elbow flex
- lead/rear hip and knee channels
- profile-aware `gloveSide`

Do not invent forearm pronation/roll from CMU #124-01; the qualified source does not provide an explicit usable roll channel.

## 10. Renderer architecture

### Backwards compatibility is mandatory

`drawFigure()` currently serves pitchers, fielders, runners and batter rendering.

Implement optional pitcher-capable channels without silently changing legacy poses for other figures.

Preferred pattern:

- preserve the exact old transform path when new pelvis/torso/profile fields are absent;
- only use a split pelvis/torso transform path when the new pitch profile supplies it;
- attach legs/hips to the lower/root transform and upper body/arms to the torso transform only in the new path;
- retain current legacy defaults for all existing fielder/runner poses;
- make glove side configurable for the new profile while defaulting to current left-glove behavior elsewhere.

Do not perform a full `SkinnedMesh`, skeleton-engine or IK migration.

## 11. Motion sampling

Replace `pitcherPoseK()` / `blendPitchPose()` / global `PITCH_RELEASE_K` authority with a data-driven sampler, suggested responsibilities:

- `validatePitchMotionProfile(profile)`
- `samplePitchMotion(profile, phase, segment)`
- `mirrorPitchMotionSample(sample)`
- `mapPitchMotionToFigurePose(sample)`

Use angle unwrapping / interpolation that cannot jump across ±π. Linear interpolation is acceptable for non-angular scalars; use a continuity-safe angle interpolation for rotations.

No per-frame allocations in the hot render loop after profile initialization if reasonably avoidable.

## 12. Release and motion clocks

### Pre-release

The existing `S.phase==='windup'` / 0.85 s timer remains gameplay authority.

The pitch-motion sample should progress through the source-derived pre-release event sequence and arrive at `release_proxy` on the exact transition to `launchPitch()`.

### Post-release

Do not use normalized `pitch.t` to determine animation speed.

Use an animation clock measured in seconds. Derive the main follow-through shape from the qualified source frames after release (roughly 310–351), then blend toward the existing field-ready/neutral pose without waiting for the full source recovery tail.

Post-release motion may be interrupted by a live batted-ball fielding transition. Do not let renderer motion block `FieldingAssignment`, locomotion or gameplay state.

### Pitch type

All current pitch types use the same delivery profile in b0805-30. Do not generate curve/fork/sinker tells from unsupported source data.

## 13. Release-point visual QA

M1 must not alter physical `pitch.rx/ry/rz` or pitch flight.

Add a debug/test helper that can estimate or expose the throwing-hand world position from the sampled release pose sufficiently to compare it with the existing game release location.

Goal:

- visually plausible hand/ball relationship at the launch tick;
- no ball visibly departing while the body remains in an earlier stride/cocking phase;
- any residual offset is reported in the audit rather than hidden by moving the physical pitch release.

Do not change gameplay release coordinates to make the animation fit.

## 14. Handedness / mirror

124-01 source laterality is provisional.

Implement mirror support as a first-class data transform:

- swap throw/glove arms;
- swap lead/rear leg roles as appropriate;
- mirror lateral root/arm-plane/yaw components;
- keep event/phase times identical;
- do not duplicate a second hand-authored profile.

Even if current gameplay visually uses one side first, the mirror contract must be tested now so source-side uncertainty is not baked into the architecture.

## 15. Direct behavioral contracts

Add a dedicated deterministic test, suggested filename:

`_test_pitch_motion_bank_cmu124_20260811.js`

Required assertions:

1. **profile validity** — monotonic key times, finite channels, event order, valid provenance and source hashes;
2. **source isolation** — no full AMC/ASF payload or full-frame converted sequence is committed;
3. **release synchronization** — on the exact update tick that creates `pitch`, sampled motion is at `release_proxy` within one render-frame tolerance;
4. **gameplay timing parity** — pre-release gameplay timer remains 0.85 s;
5. **pitch trace parity** — with deterministic RNG/input harness, pitch type, target, `pitch.dur`, pitch path, contact result and subsequent rule state remain unchanged versus b29;
6. **pitch-type animation isolation** — same release/follow-through motion-clock shape regardless of pitch `dur`;
7. **legacy figure compatibility** — figures without the new optional channels take the legacy transform path and preserve existing pose outputs;
8. **mirror contract** — mirror swaps anatomical side/lateral signs while preserving event timing;
9. **continuity** — sampling around every key boundary produces no one-frame angle/position discontinuity above declared tolerance;
10. **no policy coupling** — motion helpers do not write RunnerIntent, FieldingAssignment, ReachModel, ThrowDecision, DefenseActionPolicy, PlayLifecycle, pitch target or batting outcome;
11. **fielding handoff** — once a ball becomes live in fielding, the pitch recovery visual cannot freeze the pitcher or overwrite his fielding movement;
12. **mutation detection** — deliberately restore global `.80` release, tie follow-through to `pitch.t`, collapse torso/root turn, or hard-code left glove and prove the test detects each mutation.

## 16. Existing regressions that must still pass

Run the repository's existing test/validation suite relevant to b29, at minimum:

- architecture guard
- RunnerIntent / runner-control/sliding tests
- FieldingAssignment
- ReachModel
- DefenseActionPolicy / force-chain
- b28 breakaway / transfer-context
- b29 possession-footwork regression + mutation
- current browser baseline / behavioral mutations available on the branch

Do not claim the historical 138-recording / 1000-route / 50-game result as a fresh pass unless you actually rerun it.

Because M1 should be gameplay-trace neutral, run broader validation if the existing harness makes that feasible and record exact counts.

## 17. Human visual acceptance build

The final pushed branch must contain a directly playable `baseball3d.html` for owner review.

Owner visual checklist:

- knee/load phase reads as a baseball windup, not a generic arm wave;
- pelvis/root and torso visibly separate rather than rotate as one rigid block;
- stride/plant silhouette looks coherent;
- high-cock/release sequence is continuous;
- ball launch visually coincides with release phase;
- glove arm counterbalances rather than staying generic;
- follow-through is not scaled by pitch type;
- pitcher returns to fielding without a cosmetic freeze when ball is put in play;
- no runner/fielder/batter visual regression from `drawFigure` compatibility changes.

Automated PASS does not authorize declaring the motion visually fixed. Owner playtest is required.

## 18. Required audit/provenance outputs

Persist important information in GitHub, not only in Codex final chat.

Create:

### A. Implementation audit

`docs/audits/b0805_30_pitch_motion_cmu124.md`

Must include:

- exact base SHA and final SHA
- changed files
- source URLs/hashes/terms
- exact selected source frames and key count
- source-unit-to-metre QA values used, if any
- mapping table from CMU channels to runtime pose channels
- exact removed/replaced heuristics (`pitcherPoseK`, `PITCH_RELEASE_K`, etc.)
- timing decisions and the 0.85 s isolation rationale
- release hand/ball visual-offset diagnostic
- test commands and exact results
- mutations verified
- regressions rerun and exact pass counts
- negative findings / remaining visual limitations
- owner playtest checklist
- explicit statement that M1.1 cadence is still unresolved

### B. Source provenance note

Use a clear path such as:

`docs/third_party/cmu_mocap_subject124.md`

Include source URLs, selected trial, file hashes, official terms summary, no-direct-resale note, source limitations, and the requested acknowledgement text. Do not falsely label the acknowledgement as a mandatory licence condition unless the verified source says so.

### C. Exporter/provenance metadata

Persist exporter code and/or a compact export manifest sufficient to reproduce the profile from the official CMU files and hashes.

Important rule:

`important implementation/source knowledge that exists only in Codex final chat = 0`

## 19. Definition of Done

M1 is complete only when all are true:

- branch is still based on b29 gameplay source, with no unrelated research-branch merge;
- 124-01 is the only source motion used;
- source hashes are verified;
- no raw ASF/AMC or full converted sequence is committed;
- game contains a compact source-provenanced motion profile;
- `pitcherPoseK` / global `PITCH_RELEASE_K` are no longer production authority for pitcher motion;
- drawFigure compatibility preserves non-pitcher legacy behavior;
- release proxy aligns with existing `launchPitch` tick;
- 0.85 s gameplay windup and pitch physics remain unchanged;
- post-release motion uses seconds, not `pitch.t` duration scaling;
- deterministic direct + mutation tests pass;
- relevant b25–b29 regressions pass;
- implementation audit + provenance note are committed;
- playable `baseball3d.html` exists on branch;
- no PR is merged;
- all changes are committed and pushed to `codex/b0805-30-pitch-motion-bank-cmu124`.

## 20. Stop condition

After commit and push:

- do not merge;
- do not implement M1.1 cadence changes;
- do not start P1/E1/F1/P2;
- do not create batting motion from 124-07;
- do not broaden into pitch physics.

Return only a concise completion summary with branch, final commit SHA, changed files, test result headline, audit path, and any blocker. Browser-GPT will review the pushed implementation directly from GitHub before owner playtest.
