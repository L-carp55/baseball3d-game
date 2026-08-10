# Codex Agent A dispatch — pitching / batting biomechanics

Status: READY_FOR_CODEX
Issue: #25 (parent #24)
Repository: `L-carp55/baseball3d-game`
Working branch: `codex/research-pitching-motion-20260810`
Research base: `agent/research-baseball-motion-ai@e6e0d9cae68e629d592e7bd7bc2454084a18224d`
Gameplay source of truth: `agent/b0805-29-possession-footwork@60b993b73fed854934a976e45e8feb9437deb584` / BUILD `b0805-29`
Output: `docs/research/codex_pitching_motion.md`

## Objective
Independently determine how to replace or redesign the visibly unrealistic hand-authored pitcher motion using primary biomechanics / mocap evidence, and whether the same pipeline should improve batting motion. This is a research task, not a game-body implementation task.

## Mandatory first reads
1. `docs/handoff/BASEBALL3D_HANDOFF_20260810.md`
2. `docs/research/CODEX_BASEBALL3D_REALISM_RESEARCH_TASK_20260810.md`
3. `docs/research/baseball_realism_source_seed_20260810.md`
4. Issue #25
5. `baseball3d.html` from gameplay SHA above, including `pitcherPoseK`, `pitcherPose`, `blendPitchPose`, `drawFigure`, and batter pose/swing code.

Do not use PowerPro / パワプロ player-rating or pennant-simulator material as a source of truth.

## Required research
Inspect primary sources and actual code/data definitions, not only READMEs/search summaries:
- `drivelineresearch/openbiomechanics`: baseball_pitching, baseball_hitting, obp, examples, data dictionary, code/data licenses.
- OpenSim (`opensim-org/opensim-core`).
- OpenCap (`stanfordnmbl/opencap-core`).
- Pose2Sim (`perfanalytics/pose2sim`).
- Peer-reviewed pitching kinematic-chain literature covering foot contact, MER, ball release, follow-through and segment sequencing.

For every useful source record exact file/function/class/data field inspected, algorithm/data flow, license, maintenance state where relevant, and mapping to current `baseball3d.html`.

## Questions to answer
- Which joint/segment signals and events are actually available?
- How should foot contact -> MER -> ball release -> follow-through be normalized?
- Which pelvis/trunk/shoulder/elbow/wrist/hip/knee DOFs matter for this simplified skeleton?
- Can representative curves be compressed to roughly 10–30 game key poses without obvious artifacts?
- Median curve vs PCA vs clustering for representative motion?
- How should handedness, arm slot, windup/stretch and pitch-type variation be generated?
- Can the same data-derived representation improve hitting motion?
- Which current hard-coded angles/heuristics can be deleted or replaced?
- What can legally be copied, adapted, learned from only, or rejected?

## Large-data guard
Do NOT download large OBP/raw/full-signal releases until you have first documented approximate file count/size and license. Prefer metadata, docs, sample/small files and repository code for this phase. Raw OBP data must not be silently embedded in a potentially commercial game.

## Required report sections
1. Primary-source inventory
2. Exact code/files/functions/data fields read
3. Findings
4. Mapping to current game code
5. `copy / adapt / concept-only / reject` table
6. Existing heuristics that can be removed/replaced
7. Proposed target architecture
8. Minimal implementation v1 with concrete data structures/functions
9. Direct behavioral/kinematic contract tests
10. Mutation tests
11. Impact on existing recording corpus / 1000-route / 50-game validation
12. Licensing/commercial-use constraints
13. Risks, negative findings, failed approaches, unresolved questions
14. Explicit verdict on relevant browser hypotheses H1 and H4/H5 where applicable

## Non-goals
- Do not edit `baseball3d.html` or gameplay code.
- Do not implement the motion yet.
- Do not coordinate conclusions with Agents B/C/D before independently finishing this report.
- Do not merge any PR.

## QA / Definition of Done
- Report exists at the exact output path.
- Every major recommendation is source-backed and mapped to current functions.
- README-only claims are insufficient when code/data/paper detail is available.
- License boundaries are explicit, especially OBP data vs code.
- Negative findings and unsuitable sources are preserved.
- `git diff` shows no game-body modification.
- Commit the report and any research-only notes to this branch and push it.
- Final Codex response must include pushed branch, commit SHA, output path, sources inspected, and any blockers. Important findings must not exist only in the final chat response.