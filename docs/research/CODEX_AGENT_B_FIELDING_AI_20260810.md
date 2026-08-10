# Codex Agent B dispatch — fielding AI / ball tracking / multi-agent decisions

Status: READY_FOR_CODEX
Issue: #26 (parent #24)
Repository: `L-carp55/baseball3d-game`
Working branch: `codex/research-fielding-ai-20260810`
Research base: `agent/research-baseball-motion-ai@e6e0d9cae68e629d592e7bd7bc2454084a18224d`
Gameplay source of truth: `agent/b0805-29-possession-footwork@60b993b73fed854934a976e45e8feb9437deb584` / BUILD `b0805-29`
Output: `docs/research/codex_fielding_ai.md`

## Objective
Independently redesign fielding pursuit and multi-agent role decisions so defenders use defensible observations, prediction and replanning rather than durable perfect knowledge of future ball state. The design should remove classes of stale-target/ownership bugs without collapsing the current architecture into scenario-specific condition trees.

## Mandatory first reads
1. `docs/handoff/BASEBALL3D_HANDOFF_20260810.md`
2. `docs/research/CODEX_BASEBALL3D_REALISM_RESEARCH_TASK_20260810.md`
3. `docs/research/baseball_realism_source_seed_20260810.md`
4. Issue #26
5. `baseball3d.html` from gameplay SHA above, including at minimum `planPlay`, `interceptPoint`, ReachModel-related functions, `setPrimaryFielder`, `stepFlight`, FieldingAssignment, DefenseActionPolicy, `chooseThrowTarget`, ThrowDecision.

Do not use PowerPro / パワプロ player-rating or pennant-simulator material as a source of truth.

## Required research
Inspect primary research and actual OSS code, not only READMEs/search summaries:
- LOT / Linear Optical Trajectory baseball-outfielder literature.
- OAC / Optical Acceleration Cancellation literature.
- Newer unified/current-future/affordance-based interception research, including 2025+ work where available.
- Google Research Football code and observation/action architecture.
- Unity ML-Agents code/docs for multi-agent, imitation, decision timing and curriculum patterns.
- `Kentops/Baseball-Game` at code level.
- Other primary/open fielding/interception sources if materially better.

For each useful source record exact paper/repository, exact file/function/class inspected, algorithm/data flow, license, maintenance state where relevant, and mapping to current `baseball3d.html`.

## Questions to answer
- LOT vs OAC vs predicted-landing-point vs newer unified control: strengths, limits and evidence.
- Is coarse initial prediction followed by periodic observation-driven correction appropriate?
- Define exactly what state/observations a fielder may read so there is no future-information leakage.
- Separate reaction time, running speed, fielding skill, route efficiency and decision latency.
- Should fly balls, liners and ground balls use different pursuit controllers?
- How should primary assignment, handoff and retargeting avoid oscillation and stale targets?
- How should backup, cover, cutoff and relay fit FieldingAssignment or adjacent role ownership?
- Centralized planner vs distributed agents: what belongs where?
- Where, if anywhere, should RL/ML be used: core gameplay, offline policy search, imitation, adversarial scenario generation, or reject?
- Which existing heuristics/local patches could be deleted after the new design?

Recent counterexamples that the architecture must structurally address include rolling-handoff instability, stale intercept targets after possession, missing/incorrect base coverage, and actions selected using information a human fielder could not yet know.

## Required report sections
1. Primary-source inventory
2. Exact code/files/functions actually read
3. Findings
4. Mapping to current game code
5. `copy / adapt / concept-only / reject` table
6. Existing heuristics that can be removed/replaced
7. Proposed target architecture
8. State / observation / action definition table
9. Recommended infield and outfield algorithms
10. One-frame / decision-tick pseudocode
11. Minimal implementation v1
12. Direct behavioral contract tests
13. Mutation tests, including future-information-leak mutations
14. Impact on recording corpus / 1000-route / 50-game validation
15. Licensing/commercial-use constraints
16. Risks, negative findings, failed approaches, unresolved questions
17. Explicit verdict on H2, H4 and H5

## Architectural constraints
Prefer strengthening rather than bypassing RunnerIntent / FieldingAssignment / ReachModel / ThrowDecision / DefenseActionPolicy / PlayLifecycle. Keep candidate generation, policy scoring, stale state, physical execution and display/animation separable.

## Non-goals
- Do not edit `baseball3d.html` or gameplay code.
- Do not implement the new AI yet.
- Do not coordinate conclusions with Agents A/C/D before independently finishing this report.
- Do not merge any PR.

## QA / Definition of Done
- Report exists at the exact output path.
- Allowed observations are explicit enough to audit for future-information leakage.
- Major recommendations are source-backed and mapped to current functions.
- README-only claims are insufficient when code/paper detail is available.
- Negative findings and rejected approaches are preserved.
- `git diff` shows no game-body modification.
- Commit the report and research-only notes to this branch and push it.
- Final Codex response must include pushed branch, commit SHA, output path, sources inspected and blockers. Important findings must not exist only in the final chat response.