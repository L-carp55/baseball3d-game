# Codex task — CMU Baseball Motion Qualification (M0)

Date: 2026-08-10
Repository: `L-carp55/baseball3d-game`
Branch / worktree: `codex/research-cmu-baseball-motion-qualification-20260810`
Base integration commit: `fdb40272ff2bb42b725ec3e8b4504ec5d343b2e7`
Gameplay source for mapping only: `agent/b0805-29-possession-footwork@60b993b73fed854934a976e45e8feb9437deb584`

## 0. Purpose

Qualify the newly discovered CMU Graphics Lab baseball motion-capture trials before the first pitcher-motion gameplay implementation.

This is a **narrow source-qualification task**, not another broad realism survey.

The integration decision is in:

`docs/research/baseball_realism_integration_v1.md`

Read it first, then read:

- `docs/research/codex_pitching_motion.md` from branch `codex/research-pitching-motion-20260810@65d01929539329ff103baf53ca8c340f070f725f`
- current `baseball3d.html` from gameplay SHA `60b993b73fed854934a976e45e8feb9437deb584`

## 1. Project boundary

This is the manual-playable 3D baseball game.

Do not use or modify PowerPro/Prospi player-rating research, player appraisal tables, or pennant-simulator code.

Do **not** edit `baseball3d.html` in this task.

## 2. Candidate primary source

Official CMU Graphics Lab Motion Capture Database:

- database / use terms: `https://mocap.cs.cmu.edu/`
- Subject #124: `https://mocap.cs.cmu.edu/search.php?subjectnumber=124`

The official site currently states that the dataset is free for use, may be included in commercially sold products, may not be resold directly even in converted form, and requests acknowledgement.

Subject #124 lists 120 fps:

- Trial 1 — Baseball Pitch
- Trial 2 — Baseball Pitch
- Trial 7 — Baseball Swing
- Trial 8 — Baseball Bunt

Initial qualification scope is **only #124-01, #124-02 and #124-07**. Do not crawl the database.

## 3. Data-download guard

Before downloading any motion file:

1. resolve the exact official CMU URL for each required file;
2. record file format and size (HEAD/metadata if possible);
3. record the shared Subject #124 skeleton file required to interpret AMC if applicable;
4. record the official source-terms URL and acknowledgement text;
5. write this proposed manifest into the report/manifest before fetching payload bytes.

Prefer the smallest useful source:

- ASF + AMC first;
- fetch C3D only if AMC/ASF does not contain information necessary for the qualification question.

Do not fetch unrelated Subject #124 trials.
Do not fetch OBP raw/full-signal data.
Do not commit raw CMU AMC/ASF/C3D files to this repository.

If the three baseball AMC files + skeleton are unexpectedly large, stop before download and record the size/blocker instead of silently pulling a large dataset.

## 4. Exact questions to answer

### 4.1 Provenance / rights / file integrity

For each selected file:

- canonical official URL
- filename
- byte size
- SHA-256 after download
- sampling rate
- skeleton/calibration dependency
- retrieval date
- source terms applying to it

Do not make legal conclusions beyond the source's explicit terms. Preserve wording accurately by paraphrase and link to the official page.

### 4.2 Motion quality

Actually parse and inspect the motion frames. Do not stop at the trial title.

For #124-01 and #124-02 determine:

- handedness
- whether the motion is recognisably a baseball overhand pitch rather than a generic throw
- active pitch window within the full capture
- root translation / stride behaviour
- pelvis rotation
- trunk rotation
- throwing shoulder/arm plane
- elbow bend/extension
- forearm/wrist information available or missing in the AMC skeleton
- lead/rear hip and knee motion
- glove/non-throwing arm behaviour
- follow-through and return-to-fielding posture
- obvious marker/skeleton noise or implausible joint motion
- whether the pitch contains a windup, stretch/set delivery, or neither clearly

For #124-07 determine:

- handedness
- active swing window
- load / stride / lower-body rotation
- pelvis vs trunk separation
- two-hand relationship as far as the source skeleton permits
- bat representation availability (if none, say so explicitly)
- contact-frame inference confidence
- whether it is adequate for later M2 batter-motion work

### 4.3 Event qualification

CMU does not necessarily contain baseball-specific labelled events. Infer events only where the kinematics make them supportable, and report confidence.

For each pitch estimate frame/time ranges for:

- set/start
- peak knee/load if visible
- stride-foot contact (SFC) proxy
- foot plant proxy if distinguishable
- maximum external rotation (MER) proxy
- ball release (BR) proxy
- maximum internal rotation/follow-through proxy
- field-ready/recovery

For swing #124-07 estimate where supportable:

- stance/load
- front-foot contact
- front-foot plant
- contact proxy
- finish

Never claim inferred CMU frame labels are measured OBP events.

### 4.4 Biomechanics sanity checks

Use Agent A's inspected peer-reviewed findings and general biomechanics only as **QA constraints**, not as motion data to copy.

Check at minimum:

- pelvis and trunk are independently visible and not a single rigid turn;
- proximal-to-distal sequencing is not obviously reversed/impossible;
- stride/lead-knee behaviour is physically coherent;
- the throwing arm does not require DOFs entirely absent from current renderer without identifying that gap;
- BR is visually plausible relative to arm/trunk state;
- follow-through is continuous rather than a capture artefact.

Do not download OpenBiomechanics data to do this.

### 4.5 Mapping to current renderer

Map CMU channels/joints to the minimum `baseball3d.html` renderer extension proposed in integration v1.

Required table:

| CMU joint/channel | current `drawFigure` capability | M1 new renderer channel | information loss | acceptable for v1? |

Explicitly evaluate:

- root/stride
- pelvis yaw/tilt
- torso yaw/tilt
- throwing shoulder plane/rotation
- elbow
- forearm roll if source supports it
- lead/rear hip/knee
- glove arm

Do not design a full generic skeletal engine unless the current simplified renderer cannot reproduce the source well enough.

## 5. Quantitative qualification

Write a small local parser/analysis script if needed. It may be committed under `tools/motion/` if it contains no CMU raw data and has clear provenance comments.

For each pitch report:

- total frames / seconds
- selected active range
- root displacement over active range
- approximate stride displacement
- peak pelvis rotation timing
- peak trunk rotation timing
- peak throwing-elbow extension timing if derivable
- event frame/time table
- continuity/noise flags

For #124-07 report analogous lower-body / trunk / swing-window metrics where supported.

If exact biomechanical angles cannot be reconstructed from ASF/AMC conventions without a careful FK transform, implement the FK correctly or state the limitation. Do not treat raw Euler channel values from different joints as world-space angles.

## 6. Visual qualification

Generate a local simple-skeleton preview or contact sheet for each candidate if practical, using the parsed ASF/AMC forward kinematics.

The report must describe what was actually visually inspected:

- key poses around SFC / MER / BR / follow-through
- whether arm/body sequencing looks baseball-like
- whether any frame has major distortion

If preview artefacts are generated, commit only compact derived preview images/video if doing so is consistent with the source terms; do not commit a converted full-motion dataset.

## 7. Decision rubric

Give each candidate one verdict:

- `APPROVE_FOR_M1` — good enough to drive the first representative game profile after compression/mapping
- `CONDITIONAL` — potentially usable but requires a clearly named correction or source limitation
- `REJECT` — not good enough; do not force it into the game

Pitch M1 may proceed from CMU only if at least one of #124-01/#124-02 is `APPROVE_FOR_M1` or a narrowly defined `CONDITIONAL` whose correction does not invent the core throwing sequence.

Do not approve merely because the file is licensed.

## 8. Required outputs

### Main report

`docs/research/cmu_baseball_motion_qualification.md`

Must contain:

1. source/use-terms verification
2. exact download manifest and sizes
3. files actually downloaded
4. parser/FK method
5. trial-by-trial motion analysis
6. event estimates + confidence
7. current-renderer mapping
8. biomechanics sanity checks
9. visual inspection result
10. APPROVE / CONDITIONAL / REJECT decision for each trial
11. recommended first M1 pitch trial if any
12. exact M1 data representation recommendation
13. attribution/provenance requirements
14. negative findings and uncertainties

### Manifest

`docs/research/cmu_baseball_motion_manifest_20260810.json`

Store metadata only, not motion samples. Include URLs, filenames, bytes, hashes, fps, trial IDs, retrieval time, source-terms URL and local-analysis-tool version/commit where applicable.

### Optional parser

`tools/motion/inspect_cmu_asf_amc.py`

Only if needed/useful. It must not bundle raw source data.

## 9. QA / Definition of Done

Done means:

- all three selected trials were actually inspected or a precise source/download blocker is documented;
- file count/size/terms were recorded before payload download;
- no unrelated CMU crawl/download occurred;
- no OBP raw data was downloaded;
- no game body was modified;
- raw CMU motion files are not committed;
- every inferred baseball event has a confidence/limitation note;
- at least one explicit M1 GO/NO-GO decision exists;
- important findings exist in GitHub artifacts, not only the final Codex chat;
- commit and push this branch;
- final response includes branch, commit SHA and artifact paths.

## 10. Stop condition

After pushing the qualification artifacts, **stop**.

Do not implement MotionBank, edit `baseball3d.html`, create a gameplay PR, merge any Draft PR, or start P1/E1/F1 work. Browser-GPT will review the CMU qualification and decide whether M1 should proceed.
