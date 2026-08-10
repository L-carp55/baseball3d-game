# CMU Baseball Motion Qualification (M0)

Date: 2026-08-11
Branch: codex/research-cmu-baseball-motion-qualification-20260810
Base integration decision: docs/research/baseball_realism_integration_v1.md
Gameplay mapping source only: agent/b0805-29-possession-footwork at 60b993b73fed854934a976e45e8feb9437deb584

## 1. Result

This is a narrow, actual-file qualification of CMU Graphics Lab Subject #124 trials 124-01, 124-02, and 124-07. It is not a gameplay implementation, broad CMU survey, PowerPro/Prospi appraisal task, or OpenBiomechanics download. baseball3d.html was read only.

| Trial | Official label | Verdict | Reason |
|---|---|---|---|
| 124-01 | Baseball Pitch | **APPROVE_FOR_M1** | A continuous windup-like overhand delivery is visually and kinematically evident. Its event timing is suitable for a compressed visual-only pitch profile, with explicit limits on laterality, release, and raw scale. |
| 124-02 | Baseball Pitch | **CONDITIONAL** | Contains a usable second delivery-like sequence, but the full capture contains more than one action and large root/foot travel. Use only a manually bounded phase if needed; it is not the first M1 source. |
| 124-07 | Baseball Swing | **CONDITIONAL** for later M2 only | A swing-like two-arm sequence is present, but the capture contains repeated actions, no bat representation, and no defensible measured contact event. |

**M1 source-qualification gate: GO, using 124-01 only.** This is a technical source decision, not authorization to implement M1. No MotionBank, game-body change, pull request, merge, or later P1/E1/F1 work is included here.

## 2. Source, terms, and pre-download guard

The official CMU Graphics Lab Motion Capture Database homepage and Subject #124 page were checked on 2026-08-11:

- Database and use terms: https://mocap.cs.cmu.edu/
- Subject #124 index: https://mocap.cs.cmu.edu/search.php?subjectnumber=124

The official homepage says the data are free for use, may be included in commercially sold products, may not be resold directly, including in converted form, and requests acknowledgement for published results. This report does not make a legal conclusion beyond those stated terms.

Requested acknowledgement:

> The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.

Before any payload bytes were retrieved, the companion manifest recorded the exact URLs, ASF/AMC formats, HEAD metadata, expected bytes, shared skeleton dependency, terms URL, and acknowledgement. The selected skeleton plus three AMC files total 2,597,670 bytes (about 2.60 MB), so the task's large-download stop condition did not apply.

Only the smallest useful ASF + AMC set was fetched. No C3D, no other Subject #124 trial, no CMU crawl, and no OpenBiomechanics raw/full-signal material was fetched.

## 3. Exact files retrieved and integrity

Raw source files were downloaded once to a temporary location outside this repository on 2026-08-11T00:23:10+09:00, parsed locally, and deliberately not committed. The JSON manifest contains the same metadata in machine-readable form.

| File | Role / official URL | Bytes | SHA-256 |
|---|---|---:|---|
| 124.asf | shared skeleton; https://mocap.cs.cmu.edu/subjects/124/124.asf | 7,248 | b0e6a62b7e151200497b8bbcf42d0e95800decabec9254f8653e57dcde45dd45 |
| 124_01.amc | 124-01 Baseball Pitch; https://mocap.cs.cmu.edu/subjects/124/124_01.amc | 510,538 | 7fd098ab1b535c38a3a6ae7c82f7c87299e177ce665dd65fa19db110e22f0857 |
| 124_02.amc | 124-02 Baseball Pitch; https://mocap.cs.cmu.edu/subjects/124/124_02.amc | 1,046,974 | 26490cc86d6ce41416355ab320a6d6818142521fbdc28c6d9579c2df5b0f89d2 |
| 124_07.amc | 124-07 Baseball Swing; https://mocap.cs.cmu.edu/subjects/124/124_07.amc | 1,032,910 | 4d9773480a816e24c272ba9414c6bd407d2768cedb72698287ba47b3709ff36f |

The Subject #124 index labels all three selected files as 120 fps. The ASF has a shared root channel order TX TY TZ RX RY RZ, a length-unit value of 0.45, and 31 articulated bones. The AMC files contain these frame counts and nominal durations:

| Trial | Frames | Seconds at 120 fps |
|---|---:|---:|
| 124-01 | 643 | 5.358 |
| 124-02 | 1,319 | 10.992 |
| 124-07 | 1,297 | 10.808 |

## 4. Parser and FK method

tools/motion/inspect_cmu_asf_amc.py is a compact local-only inspection tool, not a source-data converter. It:

1. parses the shared ASF hierarchy, per-bone axes, directions, lengths, and declared degrees of freedom;
2. parses every AMC frame for the three selected files;
3. applies an Acclaim-style axis-basis sandwich for each bone rotation and parent-to-child forward kinematics;
4. derives only aggregate values: root/foot displacement, wrist-speed proxies, geometric elbow proxies, and global root/thorax yaw-rate proxies;
5. writes aggregate JSON and simple skeleton contact sheets outside the repository.

It does **not** treat raw AMC Euler values from unrelated local bone bases as world-space angles. It does not export per-frame motion data, convert raw files for reuse, or put raw CMU files in Git.

The source skeleton exposes a root transform and a lowerback → upperback → thorax chain, but no separate pelvis bone. Accordingly, root yaw is only a pelvis/heading proxy; it is not a measured pelvic segment angle. Key available rotations are:

| Segment | Source DOFs | Qualification consequence |
|---|---|---|
| thorax | rx, ry, rz | torso orientation can be inspected separately from root/heading. |
| each humerus | rx, ry, rz | shoulder/upper-arm plane is observable. |
| each radius | rx only | elbow-chain movement is observable, but not a full forearm orientation. |
| each wrist | ry only | limited wrist orientation exists. |
| each hand | rx, rz | hand direction is partially represented. |
| each femur | rx, ry, rz | hip/upper-leg movement is observable. |
| each tibia | rx | knee flexion/extension proxy is observable. |

There is no explicit forearm pronation/supination or independent forearm-roll channel, no ball, no bat, no force plate, and no baseball-specific event labels. The database homepage also cautions that toe and hand joints tend to be noisy; no event finding relies on toe, finger, or thumb joints.

## 5. Visual inspection and measurement conventions

For every selected trial, the parser generated local XY and ZY skeleton contact sheets from the FK result. Broad 12-pose sheets verified the full capture; focused 12-pose sheets inspected:

| Trial | Focused inspected frames |
|---|---|
| 124-01 | 180, 200, 220, 235, 245, 255, 265, 275, 285, 295, 310, 340 |
| 124-02 | 760, 800, 830, 850, 870, 885, 900, 915, 930, 950, 980, 1020 |
| 124-07 | 220, 240, 260, 280, 295, 310, 325, 340, 355, 370, 390, 420 |

No preview image is committed. Given the source terms, compact images were not necessary for review, and keeping them local avoids distributing a converted motion sequence.

Frame times use one-based frame minus one, divided by 120. Distances remain ASF source units. A source-unit value is used only as a relative continuity check and is never converted to feet/metres or copied directly into gameplay.

## 6. Quantitative qualification summary

The parser's automatic high-energy window is deliberately narrow around a peak. The wider visual windows in the table include preparation and follow-through and are the windows used for qualification.

| Trial | Visually reviewed active window | Auto high-energy window | Root horizontal net displacement in visual window | Root net / average left thigh+shank | Wrist-speed peak(s) | Root-yaw / thorax-yaw proxy near release or swing |
|---|---|---|---:|---:|---|---|
| 124-01 | 1–410 (0.000–3.408 s); pitching core 231–351 | 287–307 | 5.718 | 0.768 | R 296: 1066.61; L 296: 997.04 source units/s | 302 / 297 |
| 124-02 | selected second delivery 720–1,079 (5.992–8.983 s); core 861–1,020 | 900–937 | 12.504 | 1.678 | R 919: 968.52; L 918: 848.85 source units/s | 921 / 919 |
| 124-07 | selected first swing 119–472 (0.983–3.925 s); core 226–390 | 298–343 | 4.247 | 0.570 | R 317: 1178.74; L 318: 1379.05 source units/s | 328 / 318 |

The normalising left thigh+shank reference is 7.451 source units. It helps identify gross discontinuity but does not calibrate physical stride length. In particular, source-foot travel from preparatory frame to the low/slow foot candidate is 24.244 units for 124-01 (frame 1→247, left foot) and 19.530 for 124-02 (frame 720→877, left foot). Those values are too source-convention-sensitive to become an in-game stride distance. M1 must retain only a normalised visual stride amount.

The geometric elbow extension proxies also need careful interpretation: 124-01 reaches its highest positive rate at source-right frame 350 and source-left frame 339; 124-02 at source-right 1,063 and source-left 952; 124-07 at source-right 343 and source-left 341. They show continuous arm extension/recovery but do not independently establish the throwing/batting side or a clinical elbow angle.

For 124-02, the maximum root/thorax proxy over the *whole* selected segment occurs later in the return portion (frames 1,052 / 1,049), not at the release proxy. This is why the table gives the local release-neighbourhood values and why neither proxy is treated as a validated kinetic-sequencing measurement.

## 7. Trial 124-01 — Baseball Pitch

### Motion-quality finding

**Handedness: provisional right-handed, medium-low confidence.** The source has no handedness label or ball. The source-right wrist is slightly faster at the release proxy, and the source-left foot produces the clearest low/slow stride-foot candidate; that combination is consistent with a right-handed delivery. It must remain a mirrorable profile field, not a permanent identity claim.

The inspected sequence is recognisably an overhand baseball-style pitch rather than a generic static throw: it contains a long preparatory lift/load, stride, high-cocked arm phase, rapid arm/trunk transition, continuous deceleration, and a later upright return. The preparation is **windup-like** rather than clearly a stretch/set delivery, with medium confidence.

- Root/stride: large forward/lateral source movement is continuous through the delivery. It is sufficient to drive a relative visual stride, but its scale is not safe for physics or world-position copying.
- Pelvis/trunk: root/heading and thorax use independently observed transforms. Their peak-rate proxies cluster around the arm acceleration rather than showing a visibly rigid single-body turn.
- Throwing arm plane: the focused sheets show a high-cocked upper arm before the rapid forward transition. Humerus rotations support this visual observation.
- Elbow/wrist: a large bend-to-extension transition is visible. Wrist movement is available only as a limited orientation/speed proxy; source data do not supply forearm roll/pronation.
- Hips/knees: the lifted/retracted leg and later planted source-left foot are visible. There is no implausible knee inversion in the inspected poses.
- Glove/non-throwing arm: the opposing arm remains separately articulated through stride and deceleration; it is adequate as a compressed glove-arm cue, not as an exact glove trajectory.
- Continuity/noise: no gross skeletal explosion, disconnected limb, or single-frame distortion was seen in the focused or broad previews. Hands/toes were deliberately excluded from event inference.

### Event estimates

All labels below are inferred pose/kinematics proxies, never measured CMU baseball events.

| Event | Estimated frame range | Time range | Confidence | Basis / limitation |
|---|---:|---:|---|---|
| set/start | 1–59 | 0.000–0.483 s | Low | Capture begins already in preparation; no labelled set position. |
| peak knee/load | 118–176 | 0.975–1.458 s | Medium | Visible lifted/retracted lower-body load. |
| stride-foot contact (source-left foot) | 231–247 | 1.917–2.050 s | Medium | Low/slow FK candidate at frame 247 plus the focused pose sequence; no force plate. |
| foot plant | 245–265 | 2.033–2.200 s | Low–medium | Post-contact stabilisation only; contact and plant cannot be separated precisely. |
| maximum external rotation proxy | 275–295 | 2.283–2.450 s | Low | High-cocked arm appearance only; no measured humeral external-rotation event. |
| ball-release proxy | 293–302 | 2.433–2.508 s | Medium–low | Both wrist-speed peaks at 296 and thorax-rate proxy at 297; there is no ball. |
| maximum internal rotation / follow-through proxy | 310–351 | 2.575–2.917 s | Medium | Continuous arm crossing/decaying trunk motion in the FK preview. |
| field-ready/recovery | 526–585 | 4.375–4.867 s | Medium | Broad contact sheet shows upright, re-centred posture; not a labelled fielding-ready event. |

### Verdict

**APPROVE_FOR_M1.** The core throwing sequence exists in the source and can be compressed without inventing it. M1 must use a right/left mirror flag, relative stride only, and an explicitly visual release alignment; it must not map raw root translation to ball physics or claim a measured release frame.

## 8. Trial 124-02 — Baseball Pitch

### Motion-quality finding

**Handedness: provisional right-handed, low confidence.** The source-right wrist speed proxy is higher around frames 918–919, but no label or ball independently confirms it.

The full 1,319-frame capture includes more than one delivery-like action. The later sequence around frames 720–1,079 is the cleanest complete candidate in the inspected sheets, but it has substantially more root and foot travel than 124-01. It is recognisably a baseball-style overhand delivery in that selected range, with a windup-like preparation. The full-file timeline must not be fed to any game animation.

- The source-left foot has the clearest low/slow candidate at frame 877. It is a stride-foot proxy, not a force-verified plant.
- Root and thorax move separately, and the arm sequence remains continuous across the selected range.
- The later broad-window root/thorax proxy maxima occur during return/continued movement, confirming that raw global rates cannot be used as a direct biomechanics event stream.
- No major skeleton discontinuity was seen, but multiple actions and scale-sensitive root travel make this a secondary source.

### Event estimates for selected second delivery

| Event | Estimated frame range | Time range | Confidence | Basis / limitation |
|---|---:|---:|---|---|
| set/start | 720–800 | 5.992–6.658 s | Low–medium | Selected sequence start; capture-wide context is not a single labelled pitch. |
| peak knee/load | 760–830 | 6.325–6.908 s | Low–medium | Visible lower-body loading; no labelled knee event. |
| stride-foot contact (source-left foot) | 861–877 | 7.167–7.300 s | Medium | Low/slow source-left-foot FK candidate at 877. |
| foot plant | 877–900 | 7.300–7.492 s | Low–medium | Visual settling after the candidate contact; no force signal. |
| maximum external rotation proxy | 885–915 | 7.367–7.617 s | Low | Cocked-arm visual proxy only. |
| ball-release proxy | 915–921 | 7.617–7.667 s | Medium–low | Wrist-speed peaks at 918–919 and local root/thorax proxy peaks at 921/919; no ball. |
| maximum internal rotation / follow-through proxy | 930–1,020 | 7.742–8.492 s | Medium | Continuous forward arm/body deceleration in focused sheets. |
| field-ready/recovery | 1,079–1,199 | 8.983–9.983 s | Low–medium | Broad preview indicates re-centring; not a labelled fielding transition. |

### Verdict

**CONDITIONAL.** It is a usable optional variant only after selecting and retiming the bounded 720–1,079 delivery-like segment, normalising root movement, and preserving source-side uncertainty. Those corrections compress a visible sequence; they do not invent a throw. It is not recommended as the first M1 profile because 124-01 is cleaner.

## 9. Trial 124-07 — Baseball Swing

### Motion-quality finding

**Handedness: indeterminate from this source alone.** The left wrist speed proxy is higher at the swing peak, but a speed difference without a bat, ball, or source-side label does not establish batting handedness.

The first clear swing-like action spans approximately frames 119–472, with the highest combined motion at 298–343. Later portions of the file contain additional actions; the full file is not a single swing clip.

- Load/stride/lower body: a lower-body load and transition are visible. A low/slow source-left-foot candidate occurs around frames 226–240, but the source does not identify that anatomical side as the baseball front foot.
- Pelvis/trunk: separate root/heading and thorax transforms exist. In the local motion peak, thorax yaw rate occurs near frame 318 and root yaw near 328; that is a useful interpolation cue, not a biomechanical proof because root is not an isolated pelvis.
- Two hands: both arm chains are separately captured and move through the turn. The minimum two-wrist separation occurs at frame 374 over the full capture, but no bat/grip constraint exists, so this is not a hand-on-bat validation.
- Bat/contact: there is no bat bone, bat marker, ball, or collision channel. A contact frame cannot be measured.
- Continuity/noise: the selected first action is visually continuous with no gross skeleton break. The repeated actions and absence of a bat are the substantive limitations.

### Event estimates for first swing-like sequence

| Event | Estimated frame range | Time range | Confidence | Basis / limitation |
|---|---:|---:|---|---|
| stance/load | 119–220 | 0.983–1.825 s | Medium–low | Visual preparation and lower-body loading. |
| front-foot contact / plant proxy | 226–260 | 1.875–2.158 s | Low | Source-left-foot low/slow candidates only; front-foot side and force are unknown. |
| contact proxy | 317–328 | 2.633–2.725 s | Low | Wrist-speed peaks at 317–318 and local torso/root turn peak neighbourhood; no bat or ball. |
| finish | 355–472 | 2.950–3.925 s | Medium | Continuous post-turn deceleration and return pose. |

### Verdict

**CONDITIONAL for later M2 batter-motion work; not an M1 input.** A manually bounded, mirrored-or-not-yet-mirrored visual swing can be derived only after a future M2 task chooses the intended batting side, creates an independent bat attachment, and treats the contact instant as a game-timing decision rather than source ground truth.

## 10. Biomechanics sanity checks

Agent A's reviewed pitching findings are used only as sanity constraints: visible lower-body loading/stride, distinct body/arm phases, a plausible release-neighbourhood, and continuous deceleration. No peer-review value is copied into CMU motion data, and no OpenBiomechanics data were downloaded.

| Check | Finding | Result |
|---|---|---|
| Pelvis and trunk are not one rigid visual turn | Root/heading and lowerback/upperback/thorax are separate in ASF and visibly change independently. Root remains a heading proxy, not a measured pelvis segment. | Pass with limitation |
| Proximal-to-distal sequence is not visibly impossible | 124-01 and selected 124-02 show lower-body/torso/arm progression and continuous follow-through. Root/thorax rate peaks cluster within a few frames of wrist speed and cannot establish causal sequencing. | Pass as visual QA only |
| Stride and lead-knee behaviour are coherent | The selected pitch poses show load, stride-foot candidate, plant-like settling, and knee change without a visible inversion. | Pass as visual QA only |
| Required arm DOFs are named | Humerus, radius, wrist, and hand channels exist, but explicit forearm roll/pronation does not. Current renderer also lacks independent shoulder/forearm channels. | Gap identified; acceptable after M1 compression |
| Ball-release position is plausible | Wrist/trunk peaks occur in high-cocked-to-forward-arm transition for both pitch candidates. There is no ball, so this is a proxy only. | Pass with medium-low confidence |
| Follow-through is continuous | 124-01, selected 124-02, and first 124-07 action show continuous deceleration with no gross pose break. | Pass |

The apparent local order of root and thorax rate peaks must not be over-read. In this skeleton the root is not an isolated pelvis, and global heading also reacts during recovery. The review therefore finds no obvious impossible reversal, but does **not** certify high-fidelity biomechanical timing.

## 11. Mapping to the current renderer

The mapping target was read only from baseball3d.html at gameplay SHA 60b993b73fed854934a976e45e8feb9437deb584. Current drawFigure has one root/body transform, per-side sagittal arm/leg angles, arm Z spread, elbow and knee bends, and a glove fixed to the left forearm. pitcherPoseK supplies three hand-authored curves. drawBatter uses a single swing scalar and a hard-coded side. None of those code paths were changed.

| CMU joint/channel | Current drawFigure capability | M1 new renderer channel | Information loss | Acceptable for v1? |
|---|---|---|---|---|
| root TX/TY/TZ and root rotation | Global fx/fz placement; face plus one body turn; rise/crouch | rootStride01, rootRise, baseFacing and pelvisYaw | Raw units and full 3D root path must be normalised; no direct world copy | Yes |
| root heading plus lowerback/upperback | One body lean/turn shared by all segments | pelvisYaw plus torsoYaw relative to pelvis | Root is only a pelvis proxy; detailed spine segmentation is dropped | Yes |
| thorax rx/ry/rz | One body lean plus shared turn | torsoYaw, torsoLean, torsoTilt | 3-axis torso curve is compressed | Yes |
| throwing humerus rx/ry/rz | armL/armR fore-aft plus armLZ/armRZ | throwArmElevation and throwArmPlane, profile-side aware | Internal/external shoulder rotation is not preserved literally | Yes, visual-only |
| throwing radius rx | elbowL/elbowR bend | throwElbowFlex | Axial forearm orientation is absent | Yes |
| wrist ry and hand rx/rz | No independent wrist/hand channel | optional wristYaw or a hand-offset cue | Fine wrist/hand orientation is heavily reduced | Yes |
| forearm roll / pronation-supination | No current channel; source has no explicit roll channel | None; do not invent a sampled roll | Not present in the selected source | Yes, but record as absent |
| femur rx/ry/rz and tibia rx | legL/legR and kneeL/kneeR, mostly sagittal | leadHipFlex, rearHipFlex, leadKneeFlex, rearKneeFlex | Hip rotation/abduction and ankle detail are compressed | Yes |
| source-left/right foot | No independent foot orientation or planted-foot constraint | relative stride/plant phase only | No foot lock, force, or precise plant | Yes |
| non-throwing humerus/radius and glove side | Two arms exist, but glove is always attached to left forearm | gloveArmElevation, gloveArmPlane, gloveElbow, gloveSide/mirror | Exact glove path and catching hand orientation are reduced | Yes |

The minimum justified extension is a small profile-driven pitcher renderer: a pelvis child transform, a torso child transform, profile-aware throwing/glove arm selection, shoulder plane, per-side leg/knee values, and a normalised stride offset. This is enough to preserve the source's major silhouette and timing. A generic skeletal engine, raw AMC playback, full-body IK, or a physics coupling is not justified for M1.

## 12. Exact M1 data representation recommendation

Use one compressed, metadata-carrying profile derived from 124-01. Do not ship AMC rows, do not use source units as world coordinates, and do not use the source release proxy to change launchPitch, pitchPos, ball physics, or gameplay outcomes.

~~~json
{
  "schema": "pitch-motion-profile/v1",
  "id": "cmu124_01_representative",
  "source": {
    "trial": "124-01",
    "fps": 120,
    "file_sha256": "7fd098ab1b535c38a3a6ae7c82f7c87299e177ce665dd65fa19db110e22f0857",
    "terms_url": "https://mocap.cs.cmu.edu/",
    "acknowledgement_required": true
  },
  "laterality": "provisional_right_mirrorable",
  "phase_keyframes": [
    {
      "phase": "load",
      "source_frame_range": [118, 176],
      "channels": ["rootStride01", "pelvisYaw", "torsoYaw", "torsoLean", "leadHipFlex", "leadKneeFlex", "throwArmElevation", "throwArmPlane", "throwElbowFlex", "gloveArmElevation", "gloveElbowFlex"]
    },
    {
      "phase": "plant",
      "source_frame_range": [231, 265]
    },
    {
      "phase": "cocking",
      "source_frame_range": [275, 295]
    },
    {
      "phase": "release_proxy",
      "source_frame_range": [293, 302],
      "game_visual_alignment": "PITCH_RELEASE_K"
    },
    {
      "phase": "follow_through",
      "source_frame_range": [310, 351]
    },
    {
      "phase": "recover",
      "source_frame_range": [526, 585]
    }
  ],
  "excluded_channels": [
    "raw_root_translation",
    "raw_forearm_roll",
    "bat_or_ball_contact",
    "gameplay_or_ball_physics"
  ]
}
~~~

Between roughly 12 and 18 manually reviewed phase keyframes are sufficient. Interpolate scalar visual channels only. Keep a fixed release-proxy to existing visual timing, and retain the existing separation between animation and game state described by the integration decision.

## 13. Attribution and provenance requirements

Any future use of a derived profile must retain:

1. the official CMU URLs, file hashes, trial identity, source terms URL, and requested acknowledgement above;
2. a record that only a compressed visual derivative was used;
3. the source limitation that raw CMU files and converted full-motion derivatives are not to be resold directly under the page's stated terms;
4. a statement that event markers are inferred visual proxies, not measured CMU baseball labels.

This is provenance handling, not an independent legal interpretation.

## 14. Negative findings, limits, and non-actions

- No raw ball, bat, contact, force plate, pitching velocity, or baseball event labels are in the selected ASF/AMC qualification set.
- The source page does not label handedness. Pitch handedness is provisional; swing handedness is indeterminate.
- Root values have no safe direct gameplay scale. They are useful only after normalisation into a visual stride.
- A root-heading proxy is not a pelvis segment measurement, so precise pelvis-to-trunk sequencing is unresolved.
- No explicit forearm roll/pronation-supination source channel is available.
- 124-02 contains multiple delivery-like actions and needs manual bounded selection.
- 124-07 contains repeated actions, no bat representation, and has only a low-confidence contact proxy.
- C3D was not fetched because ASF+AMC was sufficient to answer this M0 qualification; it may be reconsidered only in a separately authorised task if a specific unresolved question requires it.
- No OpenBiomechanics data were fetched.
- No raw CMU source data or preview images are committed.
- baseball3d.html is unchanged. No M1 implementation, game physics change, PR, merge, or follow-on work was started.

## 15. Reproducibility / QA

- Parsed all 643 + 1,319 + 1,297 selected AMC frames against the shared 124.asf skeleton.
- Python syntax check passed for tools/motion/inspect_cmu_asf_amc.py.
- Generated and visually inspected two FK contact sheets per candidate (XY and ZY), plus focused event-window sheets outside Git.
- Verified hashes after download and kept payload files outside the repository.
- Manifest contains metadata only; no motion sample or raw source file is staged.

The next authorised reviewer may decide whether M1 should proceed. This task stops at the qualified research artifacts.
