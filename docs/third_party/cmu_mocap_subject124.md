# CMU Motion Capture Database — Subject 124 / Trial 124-01

## Purpose in this repository

`b0805-30` uses a compact, renderer-only motion profile derived from CMU Graphics Lab Motion Capture Database Subject **124**, Trial **124-01**. The profile is used only to pose the pitcher visually before and after the existing launch tick. It does not supply ball coordinates, pitch speed, pitch movement, timing rules, batting outcomes, runners, or fielding decisions.

The committed compact artifact is [cmu124_pitch_profile_v1.json](cmu124_pitch_profile_v1.json). It contains 16 reviewed event keys, not the source motion sequence.

## Source identity and reproducibility

| Field | Value |
| --- | --- |
| Database | CMU Graphics Lab Motion Capture Database |
| Subject / trial | `124` / `124-01` |
| Skeleton file | `124.asf` |
| Skeleton SHA-256 | `b0e6a62b7e151200497b8bbcf42d0e95800decabec9254f8653e57dcde45dd45` |
| Motion file | `124_01.amc` |
| Motion SHA-256 | `7fd098ab1b535c38a3a6ae7c82f7c87299e177ce665dd65fa19db110e22f0857` |
| Frame inventory | 643 frames at 120 fps |
| Exporter | `tools/motion/export_cmu124_pitch_profile.py`, `b0805-30-cmu124-export-v1` |

Rebuild the compact artifact only from a temporary local copy of the two verified source files:

```powershell
python tools/motion/export_cmu124_pitch_profile.py `
  --asf <temporary-source>\124.asf `
  --amc <temporary-source>\124_01.amc `
  --output <temporary-output>\cmu124_pitch_profile_v1.json
```

The exporter refuses a filename or SHA-256 mismatch, checks the expected 1–643 frame inventory, and emits only the selected compact key data. Compare the temporary output byte-for-byte with the committed JSON before updating it.

## Terms, attribution, and repository boundary

The CMU database terms reviewed for this task permit use, including use inside commercial work, but prohibit directly reselling the data or converted data. The CMU FAQ also permits copying, modification, and redistribution under that boundary. This repository retains provenance and attribution in this file and the profile metadata; attribution is treated as requested/appreciated rather than as an asserted additional license condition.

Do not commit any of the following:

- raw `.asf`, `.amc`, or `.c3d` source payloads;
- a full-frame converted sequence, even if JSON-encoded;
- source-root translation as game-world player movement;
- a claim that Subject 124-01 includes a ball, bat, force plate, release-speed, pronation, or laboratory biomechanical annotation.

The source-unit conversion `1 CMU length unit × 0.056444 = metres` is retained only as offline exporter QA. It must never change `launchPitch()`'s existing release coordinates or the game field scale.

## Motion interpretation limits

The selected frame ranges are navigation proxies, not measured scientific event labels:

- set: 1–59
- peak-knee/load proxy: 118–176
- source-left SFC proxy: 231–247
- plant proxy: 245–265
- MER proxy: 275–295
- release proxy: 293–302
- MIR/follow-through proxy: 310–351
- field-ready adapter proxy: 526–585

The source laterality is recorded as **provisional right, mirrorable**. The renderer has a deterministic right/left mirror contract rather than treating laterality as final athlete metadata. Root yaw is a rendering proxy and is not a measured pelvis orientation.

## Source links

- CMU Graphics Lab Motion Capture Database: <https://mocap.cs.cmu.edu/>
- Subject 124 listing: <https://mocap.cs.cmu.edu/search.php?subjectnumber=124>
