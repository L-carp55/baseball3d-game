# Baseball realism research — source seed / integration hypotheses

Date: 2026-08-10
Status: browser-GPT provisional integration seed
Base: `agent/b0805-29-possession-footwork` / BUILD `b0805-29`
Umbrella issue: #24
Canonical Codex task: `docs/research/CODEX_BASEBALL3D_REALISM_RESEARCH_TASK_20260810.md`

> **Project boundary:** This is the `baseball3d-game` 3D game-engine project. It is NOT the separate PowerPro player-rating/査定 project. Do not mix player ability-rating research into this workstream.

## Purpose

Codexの4並列調査（#25〜#28）が戻る前に、ブラウザGPT側で確認済みの一次資料と、現行設計に対する暫定仮説を固定する。

この文書は結論ではない。Codexの独立レポートで反証・修正される前提。

## Verified primary/open sources

### Motion / biomechanics

1. Driveline Research — OpenBiomechanics Project
   - https://github.com/drivelineresearch/openbiomechanics
   - modules: baseball_pitching / baseball_hitting / high_performance / computer_vision
   - current repository documentation reports approximately 411 fastball trials across ~100 athletes and hitting trials across ~99 athletes.
   - code: MIT
   - data + biomechanics documentation: CC BY-NC-SA 4.0 with additional exclusions; treat direct data reuse as non-commercial unless separately licensed.
   - POI/metadata remain in-repo; large full-signal/raw archives are distributed via GitHub Releases.

2. OpenSim
   - https://github.com/opensim-org/opensim-core
   - musculoskeletal modeling / inverse kinematics / dynamics reference implementation.

3. OpenCap
   - https://github.com/stanfordnmbl/opencap-core
   - two-or-more-camera video -> 3D marker positions -> OpenSim kinematics pipeline.

4. Pose2Sim
   - https://github.com/perfanalytics/pose2sim
   - multiview markerless sports kinematics; 2D pose -> triangulation/filtering -> OpenSim joint angles.

### Fielding perception / interception

1. McBeath et al. (1995), How baseball outfielders determine where to run to catch fly balls.
   - LOT / optical-trajectory control evidence.
2. Catching fly balls in virtual reality: a critical test of the outfielder problem (2010).
   - tests predictive interception vs online OAC/LOT-like control.
3. 2025 unified current-future / affordance-based account of running to catch fly balls.
   - do not freeze implementation to a 1990s theory without comparing newer synthesis.

### Multi-agent/game AI

1. Google Research Football
   - https://github.com/google-research/football
   - multi-agent observations/actions/scenarios/replays; useful as architecture reference, not baseball logic source.
2. Unity ML-Agents
   - https://github.com/Unity-Technologies/ml-agents
   - multi-agent cooperative/competitive training, imitation learning, curriculum, environment randomization.
3. Kentops/Baseball-Game
   - https://github.com/Kentops/Baseball-Game
   - unfinished Unity baseball game; code-reading comparison only, not quality authority.

### Ball physics / outcome modeling

1. dgrifka/baseball_game_simulator
   - https://github.com/dgrifka/baseball_game_simulator
   - current public model uses exit velocity, launch angle, spray, venue features; `Model/bbe_physics.py` includes a physics-informed spin/carry layer and tests/metadata.
   - useful for feature engineering, validation discipline, and physics/model separation; not a fielding engine.

## Browser-GPT provisional integration hypotheses

### H1 — Pitcher motion should move from hand-authored poses to data-derived representative curves

Current risk:
- `pitcherPoseK()` encodes a handful of manually chosen joint angles.
- visually plausible local fixes can still violate whole-body sequencing.

Provisional target:
- normalize real pitches on biomechanical events (e.g. foot contact, MER, release, follow-through).
- derive representative joint curves for pelvis/trunk/throwing shoulder/elbow/lead knee.
- compress to a small game-safe key-pose set and interpolate.
- keep raw OBP data out of the shipped game until licensing is explicitly resolved.

### H2 — Outfield pursuit should be observation-driven rather than perfect-future-point-driven

Current risk:
- a fielder can effectively know too much of the future trajectory.
- retarget bugs become severe because an exact target point is treated as durable truth.

Provisional target:
- coarse physical prediction for initial assignment.
- periodic observation-based correction while the ball is airborne.
- compare LOT/OAC/current-future models before selecting update law.
- expose only defensible observable state to the fielder policy.

### H3 — Catch possession must be a state machine, not a boolean

Target state family:
- pursuit
- receive/catch attempt
- secure possession
- bobble/drop/deflect/knockdown
- posture recovery
- grip/transfer
- throw-ready
- release

Momentum, body orientation, catch type and difficulty should carry across states.

### H4 — Defense intelligence and body execution should remain separate

Preserve the architectural direction already established by:
- FieldingAssignment
- ReachModel
- ThrowDecision
- DefenseActionPolicy
- PlayLifecycle

New research should improve observation/action generation and physical execution, not collapse these back into one giant local condition tree.

### H5 — ML/RL is primarily a research/test tool unless it clearly beats deterministic contracts

Possible use:
- search for policy failures
- generate adversarial situations
- compare candidate utility weights
- imitation/trajectory discovery

Do not introduce opaque trained policies into core gameplay merely because ML-Agents exists.

### H6 — Ball physics should be validated by distributions, not visual anecdotes

Add validation distributions by EV/LA/spray bucket:
- hang time
- landing distance
- apex
- ground-bounce speed/angle
- wall outcome
- throw flight time / height

The existing 1000-route and 50-game checks should be extended with physical-distribution contracts after Codex D reports.

## Decision gates after Codex returns

For every proposed import/adaptation:

1. Does it remove an identified heuristic rather than just add another layer?
2. Is the source/license usable for code, data, both, or only conceptual learning?
3. Can the behavior be expressed as a direct contract and mutation test?
4. Can current recordings reproduce the old failure and distinguish the new model?
5. Does it preserve b23+ shared ownership boundaries?

No game-body implementation before the four independent reports are compared.
