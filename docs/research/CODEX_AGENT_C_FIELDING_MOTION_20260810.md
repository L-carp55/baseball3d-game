# Codex Agent C dispatch — catch / throw / footwork / animation state machine

Status: READY_FOR_CODEX
Issue: #27 (parent #24)
Repository: `L-carp55/baseball3d-game`
Working branch: `codex/research-fielding-motion-20260810`
Research base: `agent/research-baseball-motion-ai@e6e0d9cae68e629d592e7bd7bc2454084a18224d`
Gameplay source of truth: `agent/b0805-29-possession-footwork@60b993b73fed854934a976e45e8feb9437deb584` / BUILD `b0805-29`
Output: `docs/research/codex_fielding_motion.md`

## Objective
Independently redesign physical catch-to-throw execution as a state machine that preserves momentum, orientation, catch type, recovery and possession context. Revisit the useful but NOT canonically implemented b27 concepts from first principles and evidence.

## Mandatory first reads
1. `docs/handoff/BASEBALL3D_HANDOFF_20260810.md`
2. `docs/research/CODEX_BASEBALL3D_REALISM_RESEARCH_TASK_20260810.md`
3. `docs/research/baseball_realism_source_seed_20260810.md`
4. Issue #27
5. `baseball3d.html` from gameplay SHA above, including at minimum `moveFielders`, `fielderPose`, `prepareThrowerFootwork`, `transferTime`, `setTransferContext`, `beginThrowPhase`, `updateThrowPhase`, catch/dive/fumble logic, `throwOffset`, `armEff`, `launchThrow`.

Treat the prior b27 implementation claim as false: the current GitHub gameplay does NOT contain the completed richer b27 catch-error/recovery model. The concepts may be evaluated but not assumed implemented.
Do not use PowerPro / パワプロ player-rating or pennant-simulator material as a source of truth.

## Required research
Inspect primary research and actual implementations where available:
- Baseball/softball fielding biomechanics.
- Throwing on the run and movement-to-throw constraints.
- Double-play pivot and catch-to-throw transfer literature.
- Dive/slide/jump recovery evidence where available.
- Markerless mocap applicability through OpenCap / Pose2Sim / OpenSim.
- Sports animation state-machine, locomotion, IK and blending implementations.
- Open-source baseball, softball, cricket or comparable sports-game catch/throw implementations at code level where useful.

Record exact paper/repository and exact file/function/class actually inspected, algorithm/data flow, license and mapping to current code.

## Questions to answer
- Define evidence-backed possession states: pursuit / catch attempt / secure / bobble / knockdown / deflect / drop / miss / posture recovery / grip-transfer / throw-ready / release.
- Which catch types matter: routine, forehand, backhand, running, jump, dive, slide, wall-adjacent, etc.?
- How should momentum and body orientation survive the catch transition?
- When is throwing while moving valid, when is a plant/set step required, and how should backward/off-balance throws differ?
- How should dive/jump/slide recovery affect release delay and first-throw quality?
- Why should easy relay/pickoff/rundown reception differ from batted-ground fielding?
- How should double-play pivot, first-baseman footwork and catcher transfer be specialized without creating giant scenario trees?
- How should arm strength, throwing accuracy, posture, momentum and grip state combine into release speed/offset/error?
- What is the smallest useful IK/blending layer feasible in the single-file WebGL architecture?
- Which current transfer/catch heuristics can be removed after the new state machine?

## Required report sections
1. Primary-source inventory
2. Exact code/files/functions actually read
3. Findings
4. Mapping to current game code
5. `copy / adapt / concept-only / reject` table
6. Existing heuristics that can be removed/replaced
7. Proposed target architecture
8. State-transition diagram/table
9. Ability inputs and movement permissions per state
10. Catch outcome / error branch table
11. First-throw accuracy/speed/recovery model
12. Minimal implementation v1 with concrete functions/data structures
13. Direct behavioral contract tests
14. Mutation tests, including stale-target/instant-recovery/context-collapse mutations
15. Impact on recording corpus / 1000-route / 50-game validation
16. Licensing/commercial-use constraints
17. Risks, negative findings, failed approaches, unresolved questions
18. Explicit verdict on H3 and H4, and H5 where relevant

## Architectural constraints
DefenseActionPolicy may decide what action is desirable, but physical execution should own whether/how the body can execute it. Do not collapse policy selection and body animation into one state tree. Preserve b28 possession-context separation and b29 stale-target lesson unless evidence supports a cleaner general replacement.

## Non-goals
- Do not edit `baseball3d.html` or gameplay code.
- Do not implement the state machine yet.
- Do not coordinate conclusions with Agents A/B/D before independently finishing this report.
- Do not merge any PR.

## QA / Definition of Done
- Report exists at the exact output path.
- State transitions and ownership are implementation-grade, not conceptual only.
- Major recommendations are source-backed and mapped to current functions.
- README-only claims are insufficient when code/paper detail is available.
- Negative findings and rejected approaches are preserved.
- `git diff` shows no game-body modification.
- Commit the report and research-only notes to this branch and push it.
- Final Codex response must include pushed branch, commit SHA, output path, sources inspected and blockers. Important findings must not exist only in the final chat response.