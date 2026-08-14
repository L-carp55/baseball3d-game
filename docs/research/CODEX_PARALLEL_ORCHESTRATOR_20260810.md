# Codex parallel orchestrator — Baseball3D realism research

Date: 2026-08-10
Repository: `L-carp55/baseball3d-game`
Status: READY_FOR_CODEX
Parent issue: #24
Canonical gameplay source: `agent/b0805-29-possession-footwork@60b993b73fed854934a976e45e8feb9437deb584` / BUILD `b0805-29`
Research coordination source: `agent/research-baseball-motion-ai`

## Mandatory execution model

Run **four independent subagents concurrently / in parallel**. Do NOT have one agent process A→B→C→D sequentially. Do NOT let the agents converge on a shared answer before each has independently completed and pushed its own report.

Use separate branches/worktrees so no two agents edit the same file:

| Agent | Issue | Branch/worktree | Task file | Required report |
|---|---:|---|---|---|
| A | #25 | `codex/research-pitching-motion-20260810` | `docs/research/CODEX_AGENT_A_PITCHING_MOTION_20260810.md` | `docs/research/codex_pitching_motion.md` |
| B | #26 | `codex/research-fielding-ai-20260810` | `docs/research/CODEX_AGENT_B_FIELDING_AI_20260810.md` | `docs/research/codex_fielding_ai.md` |
| C | #27 | `codex/research-fielding-motion-20260810` | `docs/research/CODEX_AGENT_C_FIELDING_MOTION_20260810.md` | `docs/research/codex_fielding_motion.md` |
| D | #28 | `codex/research-ball-physics-20260810` | `docs/research/CODEX_AGENT_D_BALL_PHYSICS_20260810.md` | `docs/research/codex_ball_physics.md` |

All four branches were created from `agent/research-baseball-motion-ai@e6e0d9cae68e629d592e7bd7bc2454084a18224d` before their task files were added.

## Shared mandatory context
Each subagent must first read:
- `docs/handoff/BASEBALL3D_HANDOFF_20260810.md`
- `docs/research/CODEX_BASEBALL3D_REALISM_RESEARCH_TASK_20260810.md`
- `docs/research/baseball_realism_source_seed_20260810.md`
- its assigned issue and task file
- the relevant parts of `baseball3d.html` from the canonical gameplay SHA above

This is the manual 3D baseball-game project. It is NOT the PowerPro / パワプロ player-rating or pennant-simulator project. Those materials must not be used as the source of truth.

## Independence rules
- Agent A: pitching + batting biomechanics / mocap only.
- Agent B: fielding AI / perceptual pursuit / multi-agent decisions only.
- Agent C: catch / throw / footwork / animation state machine only.
- Agent D: batted-ball + throw physics / collision / game-wide quality only.
- Cross-stream implications may be recorded as interface requirements, but an agent must not wait for, read, or harmonize with another agent's unfinished report.
- Each agent writes only its own report/research notes on its own branch.
- Parent/orchestrator must not synthesize the four results. Browser-GPT will perform integration after all four are pushed.

## Research standard
- Prefer primary papers, official documentation and source repositories.
- For OSS, read actual files/functions/classes; README-only evaluation is insufficient when implementation is available.
- Record exact source, file/function/data field, algorithm/data flow, license, maintenance status where relevant, current-game mapping, and `copy / adapt / concept-only / reject` (or calibration-only where appropriate).
- Preserve negative findings, incompatible licenses, stale/unmaintained code, failed approaches and unresolved conflicts.
- Before downloading any large external dataset, first record approximate file count/size and license. Do not silently download/embed raw OpenBiomechanics data.

## Hard non-goals
- Do NOT edit `baseball3d.html` or any game-body implementation in this phase.
- Do NOT merge Draft PR #21/#22/#23/#29 or any new PR.
- Do NOT treat the previously claimed b27 richer catch model as implemented; it is not canonical.
- Do NOT create one giant scenario-specific state tree that collapses RunnerIntent / FieldingAssignment / ReachModel / ThrowDecision / DefenseActionPolicy / PlayLifecycle.

## Per-agent completion contract
Each subagent must:
1. Complete the exact report requested by its task file.
2. Verify `git diff` contains no game-body change.
3. Commit research artifacts on its assigned branch.
4. Push the branch to GitHub.
5. Return branch + pushed commit SHA + report path + source/QA summary + blockers.
6. Ensure all important findings are in GitHub artifacts, not only in Codex chat.

## Orchestrator stop condition
The parallel research wave is complete only when all four output reports exist on their respective remote branches and all four pushed commit SHAs are known.

After that, stop. Do not integrate and do not implement. Browser-GPT will read the four remote branches directly, cross-check contradictions, map recommendations to current `baseball3d.html`, decide adoption/rejection, and produce `docs/research/baseball_realism_integration_v1.md` before gameplay implementation.