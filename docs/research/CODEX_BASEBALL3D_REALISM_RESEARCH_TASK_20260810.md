# Codex task — BASEBALL 3D realism research program

Date: 2026-08-10
Repository: `L-carp55/baseball3d-game`
Base branch: `agent/b0805-29-possession-footwork`
Base BUILD: `b0805-29`
Parent issue: #24
Subtasks: #25 / #26 / #27 / #28

## 0. This task is NOT the PowerPro player-rating project

This repository is the **3D baseball game implementation project**.

Do not research or modify:
- パワプロ能力査定
- 選手の走力/ミート/パワー査定基準
- NPB/MLB player rating tables
- historical player ability conversion
- パワプロ/プロスピの能力値比較

Those belong to a different project.

This task is exclusively about improving the **game engine, baseball behavior, AI, physics, animation and biomechanics** in `L-carp55/baseball3d-game`.

## 1. Goal

Move the game away from repeated local behavioral patches and toward a source-backed realism architecture using:
- open-source sports/baseball implementations
- peer-reviewed baseball biomechanics and perception research
- motion-capture / kinematics tools
- validated ball-flight physics
- multi-agent decision architecture

The browser-GPT owner session will integrate the findings and make final design decisions.
Codex should perform large-scale code reading, source discovery and independent analysis.

**Do not edit the game body during this research phase.**
This is read-only analysis.

## 2. Current architecture that must be understood first

Read `baseball3d.html` on `agent/b0805-29-possession-footwork` and identify the current boundaries around:

- RunnerIntent
- FieldingAssignment
- ReachModel
- ThrowDecision
- DefenseActionPolicy
- PlayLifecycle
- b0805-29 possession/thrower footwork

Recent bugs to keep in mind as counterexamples:

1. third baseman taking the easy 1B out instead of valuing a 2B-force -> 1B double-play chain
2. early runner movement becoming a fixed-base pickoff and allowing other runners to advance freely
3. fielding ability G incorrectly slowing down easy relay/pickoff receptions
4. second baseman bobbling a ground ball, recovering it, then continuing toward a stale intercept target while throwing backward
5. slide/dive catches recovering and throwing unrealistically quickly
6. fielding errors represented too simplistically
7. pitcher motion looking biomechanically incorrect

The objective is to find designs that remove whole classes of these failures, not another list of special-case `if` statements.

## 3. Parallel execution requirement

Run **four independent subagents in parallel**.
Do not have one agent do all four areas sequentially.
Do not make the four agents converge on a shared answer before they independently report.

### Agent A — pitching and batting motion / biomechanics / mocap

Primary target: replace or redesign the hand-authored pitcher motion.

Must inspect current code including:
- `pitcherPoseK`
- `pitcherPose`
- `blendPitchPose`
- `drawFigure`
- batter pose/swing code

Must inspect primary/open sources including:
- `drivelineresearch/openbiomechanics`
  - baseball_pitching
  - baseball_hitting
  - obp
  - examples
  - data dictionary
  - code/data licenses
- `opensim-org/opensim-core`
- `stanfordnmbl/opencap-core`
- `perfanalytics/pose2sim`
- peer-reviewed pitching kinematic-chain literature

Questions:
- What joint/segment signals and biomechanical events are actually available?
- How should foot contact -> MER -> ball release -> follow-through be normalized?
- Which pelvis/trunk/shoulder/elbow/wrist/hip/knee DOFs matter for a game skeleton?
- Can representative curves be compressed to 10-30 game key poses without obvious artifacts?
- How should handedness, arm slot, stretch vs windup, and pitch-type variations be generated?
- Can the same pipeline improve hitting motion?
- What may legally be copied, adapted, or only learned from?

### Agent B — fielding AI / fly-ball tracking / multi-agent decisions

Must inspect current code including:
- `planPlay`
- `interceptPoint`
- ReachModel-related functions
- `setPrimaryFielder`
- `stepFlight`
- FieldingAssignment
- DefenseActionPolicy
- `chooseThrowTarget`
- ThrowDecision

Must inspect primary/open sources including:
- LOT (Linear Optical Trajectory) fielding literature
- OAC (Optical Acceleration Cancellation) literature
- newer/current-future/unified interception research, including recent work where available
- Google Research Football
- Unity ML-Agents
- `Kentops/Baseball-Game` at code level, not only README level

Questions:
- Should outfielders initially estimate a landing region and then correct from visual information?
- Which information should a fielder be allowed to observe so the AI does not know the future?
- How should reaction, speed, fielding skill and route efficiency be separated?
- Should line drives, flies and ground balls use different pursuit controllers?
- How should primary ownership and retargeting work without oscillation or stale targets?
- How should backup, cut-off, relay and base-cover assignments fit into one shared role system?
- Should RL/ML be gameplay logic, offline policy search, adversarial scenario generation, or not used?

### Agent C — catch/throw/footwork state machine and animation

Must inspect current code including:
- `moveFielders`
- `fielderPose`
- `prepareThrowerFootwork`
- `transferTime`
- `setTransferContext`
- `beginThrowPhase`
- `updateThrowPhase`
- catch/dive/fumble logic
- `throwOffset`
- `armEff`
- `launchThrow`

Research:
- baseball/softball fielding biomechanics
- throwing on the run
- double-play pivots
- catch-to-throw transfer
- recovery from dives/slides
- markerless mocap for fielding actions
- sports animation state-machine / locomotion / IK / blending implementations
- open-source baseball or comparable sports-game catch/throw implementations

Questions:
- Define realistic possession states such as pursuit / catch attempt / secure / bobble / knockdown / deflect / drop / posture recovery / grip transfer / throw-ready / release.
- What catch types should exist: routine, forehand, backhand, jump, dive, slide, running catch, etc.?
- How should momentum and body orientation survive the catch transition?
- When is throwing while moving valid, and when must a player plant or recover first?
- How do easy relay/pickoff receptions differ from fielding a batted ground ball?
- How should catch difficulty affect error probability, recovery time and first-throw accuracy?
- What minimum IK/blending system is feasible in the single-file WebGL architecture?

### Agent D — ball/throw physics and game-wide quality

Must inspect current code including:
- `stepBall`
- drag / lift / spin terms
- bounce/wall logic
- batted-ball classification
- `throwSpeed`
- `throwAngle`
- `throwFlightTime`
- `launchThrow`
- `throwOffset`
- camera/backstop/visibility code

Must inspect primary/open sources including:
- `dgrifka/baseball_game_simulator`, especially `Model/bbe_physics.py` and its validation/metadata
- Alan Nathan baseball trajectory work and original references
- peer-reviewed baseball drag/lift/spin literature
- other useful open sports-game physics implementations

Questions:
- Are current drag, Magnus, spin decay and bounce models dimensionally and empirically sound?
- Are EV/LA/spray -> distance, apex and hang-time distributions realistic?
- Should batted-ball physical class be persisted instead of inferred from later state?
- What should differ between grass, dirt, wall and backstop collisions?
- Which portions of throw physics may reuse batted-ball physics, and which require a throw-specific model?
- How should weak-arm long throws, low-line throws, relays and cutoff behavior be modeled?
- What additional improvements outside defense have high expected impact?

## 4. Required source-reading standard

For every source/repository:

Do not stop at a search result or README.
Report:
- exact repository/paper
- exact file/function/class/data field actually inspected
- algorithm/data flow
- license
- last meaningful maintenance state where relevant
- which current `baseball3d.html` system it maps to

For OSS, classify every useful idea as:
- `copy` — code can realistically be reused under license and architecture
- `adapt` — algorithm/design can be adapted, but direct reuse is not appropriate
- `concept-only` — useful research/design inspiration only
- `reject` — not suitable for this game

## 5. Required outputs from EACH subagent

Each report must contain:

1. Primary-source inventory
2. Code/files/functions actually read
3. Findings
4. Mapping to current game code
5. `copy / adapt / concept-only / reject` table
6. Existing heuristics that could be deleted/replaced
7. Proposed target architecture
8. Minimal implementation v1
9. Direct behavioral contract tests
10. Mutation tests
11. Impact on existing recording corpus / 1000-route / 50-game validation
12. Licensing/commercial-use constraints
13. Risks and unresolved questions

Suggested report names:
- `docs/research/codex_pitching_motion.md`
- `docs/research/codex_fielding_ai.md`
- `docs/research/codex_fielding_motion.md`
- `docs/research/codex_ball_physics.md`

Do NOT edit `baseball3d.html` in this phase.

## 6. Integration constraints

Recommendations should preferably strengthen rather than bypass:
- RunnerIntent
- FieldingAssignment
- ReachModel
- ThrowDecision
- DefenseActionPolicy
- PlayLifecycle

Reject proposals that:
- give fielders access to future information a human could not know
- fix only one recorded example with a special-case branch
- merge policy selection and body animation back into one giant state tree
- silently change unrelated batting/running behavior
- cannot be protected with direct regression + mutation tests

## 7. Current browser-GPT hypotheses to challenge, not blindly accept

H1. Pitcher motion should move from hand-authored joint poses to data-derived representative motion curves.

H2. Outfield pursuit should use coarse initial prediction plus repeated observation-driven correction instead of durable exact-future intercept targets.

H3. Catch possession should be a multi-state process rather than a boolean caught/not-caught result.

H4. Defense intelligence and physical body execution should remain separate layers.

H5. RL/ML is more likely useful for research, policy search and adversarial test generation than as opaque core gameplay logic.

H6. Ball physics should be validated using EV/LA/spray-bucket distributions rather than visual anecdotes alone.

Each agent should explicitly confirm, modify or reject the hypotheses relevant to its area.

## 8. Stop condition

Research phase is complete only when all four independent reports exist and contain implementation-grade recommendations.

After that, the browser-GPT owner session will compare them and create an integrated design before any game-body implementation begins.
