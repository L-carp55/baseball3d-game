# b0805-30 CMU 124-01 pitch motion — Browser-GPT red-team

Date: 2026-08-11
Reviewer: browser-GPT integration / final design judgment
Repository: `L-carp55/baseball3d-game`

## Scope

Candidate implementation:

- branch: `codex/b0805-30-pitch-motion-bank-cmu124`
- task/base commit: `ff15ebb5f934341c54e7c8dd74fa8a8963999b28`
- implementation commit: `7633fed30fe5b61019bce3b60dc0262f8f1a3494`
- final branch head: `b93f33410a8604ab8598c34ca1bf4127a6186665`
- gameplay base: `60b993b73fed854934a976e45e8feb9437deb584` (`b0805-29`)

Reviewed directly from GitHub:

- full compare from task commit to final head
- `baseball3d.html`
- `tools/motion/export_cmu124_pitch_profile.py`
- `docs/third_party/cmu124_pitch_profile_v1.json`
- `docs/third_party/cmu_mocap_subject124.md`
- `_test_pitch_motion_bank_cmu124_20260811.js`
- `docs/audits/b0805_30_pitch_motion_cmu124.md`
- M0 qualification and M0 browser red-team

No merge was performed.

## Verdict

**BLOCKED / REPAIR REQUIRED before owner visual acceptance.**

The gameplay-isolation work is strong: `pitchPos`, `updatePitch`, `doSwing`, the 0.85 s CPU windup, and the tactical/runner/fielding boundaries are protected by direct hashes and tests. The branch also correctly keeps raw CMU payloads out of Git and separates post-release display time from `pitch.t`.

However the motion-data conversion itself has structural errors that can make the pitcher visibly move and throw incorrectly even while every current test passes. These are not cosmetic preference questions; they are source-to-rig correctness failures.

## Finding F1 — `rootForward` is not forward stride and causes large backward world translation

Severity: **BLOCKER**

Exporter implementation:

```python
selected_root_x = [get(frames[frame], "root", 0) ...]
root_x_start = selected_root_x[0]
root_x_span = max(selected_root_x) - root_x_start
"rootForward": clamp((root[0] - root_x_start) / root_x_span, 0.0, 1.0)
```

Runtime implementation:

```js
pose.stride = sample.rootForward * 4.8;
...
const sz = f.cy - pose.stride;
```

The committed profile contains:

- stride-early frame 205: `rootForward=0.615256`
- SFC proxy frame 247: `rootForward=1.000000` -> `4.8 ft`
- plant proxy frame 265: `0.951635`
- MER proxy frame 285: `0.717968`
- release proxy frame 297: `0.479358` -> `2.300918 ft`
- early follow-through frame 310: `0.284829`
- late follow-through frame 340: `0.040514`
- MIR/follow frame 351: `0.000000`

Therefore the rendered pitcher moves roughly **2.50 ft backward from SFC to release**, then returns nearly the full visual stride by early follow-through. `root[0]` was assumed to be the home-plate direction without proving that coordinate interpretation, and its selected-range maximum was treated as stride maximum.

This violates the M1 owner acceptance goal that stride/plant be coherent. Continuous interpolation does not make an incorrect direction physically plausible.

### Required repair

- derive a documented delivery/forward axis from the correctly reconstructed CMU world/FK geometry rather than assuming raw root X;
- project source root displacement onto that fixed axis, separately from lateral displacement if needed;
- use CMU's physical unit conversion only for QA;
- do not map the raw source metre value directly to gameplay coordinates;
- ensure the visual forward-stride channel does not contain a multi-foot post-plant reversal before release unless an independently inspected source trajectory genuinely shows such a reversal;
- add a direct contract covering root/stride trajectory through SFC -> plant -> release -> early follow-through.

## Finding F2 — M1 exporter bypasses the M0 ASF-axis/FK method and directly interprets raw AMC Euler channels

Severity: **BLOCKER**

M0 explicitly built `inspect_cmu_asf_amc.py` to avoid treating AMC Euler values from unrelated bone coordinate bases as world/anatomical angles. It applies the ASF axis-basis sandwich and parent-to-child FK.

M1 exporter does not parse ASF bone axes/hierarchy at all beyond checking that `:root` exists. It directly derives runtime channels using expressions such as:

```python
"pelvisYaw": radians(root[4], 0.55)
"torsoYaw": radians(lowerback[1] + upperback[1] + thorax[1], 0.28)
"throwArmElevation": radians(-rhumerus[0], 0.78)
"throwArmPlane": radians(rhumerus[2], 0.42)
"throwElbow": radians(rradius[0] - 20.0, 0.86)
```

Those values are local ASF/AMC channels with bone-specific axis bases. Summing/scaling the raw components does not reproduce the independently qualified FK transforms.

The implementation task required the M0 qualification tool to be read and called for mapping source transforms to renderer-facing channels. The current implementation regresses the exact coordinate-basis problem M0 guarded against.

### Required repair

- share or reuse one canonical ASF/AMC parser + FK implementation with M0;
- derive renderer channels from reconstructed world/parent-relative transforms or geometric joint vectors produced by that FK;
- do not derive pelvis/torso/arm planes by directly summing raw AMC channel indices;
- add an independent test that exporter channels match the canonical FK extraction on selected frames;
- add a mutation that replaces FK-derived channels with raw AMC values and prove it fails.

## Finding F3 — throwing-arm mapping produces no credible forward release and is consistent with the 3.81 ft hand/ball gap

Severity: **BLOCKER for visual acceptance**

Runtime calibration:

```js
function mapPitchMotionThrowArmAngle(sourceAngle){
  return clamp(-2.95 + sourceAngle*1.25, -2.90, -1.55);
}
```

Using committed source controls:

- set `throwArmElevation=0.623552` -> about `-2.17 rad`
- release `0.270685` -> about `-2.61 rad`
- late follow-through `-0.026430` -> clamps near `-2.90 rad`

The upper-arm channel moves farther into the negative/overhead direction through release/follow-through instead of producing an evident cock -> acceleration -> forward-release arc in the current rig.

Codex's own audit reports that at release the approximate renderer hand proxy is:

- hand `(0.084, 4.646, 57.543)`
- game release `(0.950, 5.750, 54.000)`
- separation **3.810 ft**

A 3.8 ft release separation is too large to treat as a minor unverified offset when the purpose of M1 is to improve visible pitching motion.

### Required repair

- correct the source transform first (F2), then retarget the resulting upper-arm/elbow geometry into the simple rig;
- use the same transform math as `drawFigure` to compute the actual rendered throwing-hand endpoint, not a separate approximate kinematic proxy;
- keep physical `pitch.rx/ry/rz` unchanged;
- tune only the visual retarget/root scaling so the release pose puts the actual rendered hand near the existing release point;
- establish a declared release endpoint tolerance appropriate to the simple rig and fail the direct test when exceeded.

## Finding F4 — source frame 585 is used as the field-ready adapter despite the task requiring a blend to the existing neutral/field-ready pose

Severity: **MAJOR**

Task requirement:

> derive the main follow-through shape from qualified source frames after release (roughly 310–351), then blend toward the existing field-ready/neutral pose without waiting for the full source recovery tail.

Implementation instead exports frame 585 as `field_ready_adapter_proxy` at 2.4 s. Its committed channels include several clamp-edge/extreme values:

- `pelvisLean=-1.015290`
- `pelvisYaw=-1.580383`
- `throwArmElevation=-2.750000`
- `throwArmPlane=1.650000`

Ordinary pitch phases can interpolate toward this key after 0.45 s, even though the task called for an adapter to the existing neutral/ready rendering rather than another raw-derived late source pose.

### Required repair

- keep source-derived follow-through through approximately frame 351;
- after that, blend to an explicit game-side neutral/field-ready adapter derived from the existing ready pose contract;
- do not represent the neutral adapter as if it were another CMU biomechanical key;
- test that all post-source adapter values remain in the intended neutral envelope and that no channel hits arbitrary exporter clamp limits.

## Finding F5 — current tests protect continuity but not source-to-rig physical direction

Severity: **MAJOR test gap**

The new test verifies finite values, key continuity, mirror behavior, pitch trace parity, policy isolation and mutations for `.80`, `pitch.t`, collapsed torso yaw, and left glove.

It does not detect:

- SFC -> release backward root translation;
- use of raw AMC Euler channels instead of ASF/FK transforms;
- throwing arm never reaching a forward-release configuration;
- excessive actual hand-to-ball separation;
- late adapter clamp-edge distortion.

The present PASS therefore cannot establish visual-motion correctness.

## Non-blocking / deferred note — player-controlled pitching still has no pre-release windup track

When the user is pitching, `beginAtBatPhase()` enters `aimPitch`, and clicking calls `launchPitch()` directly. The CMU pre-release track runs only during `S.phase==='windup'`, which is the CPU-pitcher path.

Fixing that would require changing the click-to-release timing contract and is therefore **not required in this b0805-30 repair**. Preserve it as a documented M1.1/gameplay-pacing question rather than smuggling a delay into the visual repair.

## What is accepted from the current candidate

These parts should be preserved unless the repair directly requires a narrow change:

- exact gameplay base and BUILD lineage;
- raw-source hash/provenance guard;
- no raw ASF/AMC/C3D in Git;
- compact profile concept;
- 0.85 s CPU gameplay windup unchanged;
- `launchPitch()`/`pitchPos()` gameplay output unchanged;
- renderer-owned post-release seconds clock;
- fielding handoff: `pitcherPose()` yields to `fielderPose()` in live `flight`;
- optional `drawFigure` legacy path for non-pitch motion;
- profile-aware glove side / mirror architecture;
- existing b25–b29 regression contracts.

## Browser status

The candidate audit correctly records that Chromium browser regression was not run in the Codex environment. Browser visual acceptance remains required after the above blockers are repaired. The blocking findings above are code/data-conversion findings and do not depend on a subjective browser impression.

## Final decision

**b0805-30 candidate `b93f334...` is not owner-playtest-ready.**

Do not merge and do not proceed to M1.1/P1/E1/F1/P2.

Next step: create a narrowly scoped repair branch from `b93f334...` that fixes F1–F5 while preserving gameplay trace parity and all accepted M1 boundaries.