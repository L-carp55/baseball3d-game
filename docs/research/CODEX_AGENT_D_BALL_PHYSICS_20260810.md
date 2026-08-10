# Codex Agent D dispatch — batted-ball / throw physics / collision / game-wide quality

Status: READY_FOR_CODEX
Issue: #28 (parent #24)
Repository: `L-carp55/baseball3d-game`
Working branch: `codex/research-ball-physics-20260810`
Research base: `agent/research-baseball-motion-ai@e6e0d9cae68e629d592e7bd7bc2454084a18224d`
Gameplay source of truth: `agent/b0805-29-possession-footwork@60b993b73fed854934a976e45e8feb9437deb584` / BUILD `b0805-29`
Output: `docs/research/codex_ball_physics.md`

## Objective
Independently audit and redesign batted-ball flight, throw flight, bounce/wall collision and other high-impact game-wide realism systems using primary research and actual OSS code. This stream is explicitly not defense-only.

## Mandatory first reads
1. `docs/handoff/BASEBALL3D_HANDOFF_20260810.md`
2. `docs/research/CODEX_BASEBALL3D_REALISM_RESEARCH_TASK_20260810.md`
3. `docs/research/baseball_realism_source_seed_20260810.md`
4. Issue #28
5. `baseball3d.html` from gameplay SHA above, including at minimum `stepBall`, drag/lift/spin terms, bounce/wall logic, batted-ball classification, `throwSpeed`, `throwAngle`, `throwFlightTime`, `launchThrow`, `throwOffset`, and camera/backstop/visibility code.

Do not use PowerPro / パワプロ player-rating or pennant-simulator material as a source of truth.

## Required research
Inspect primary sources and actual code, not only READMEs/search summaries:
- `dgrifka/baseball_game_simulator`, especially `Model/bbe_physics.py`, its feature engineering, model metadata and validation code.
- Alan Nathan baseball trajectory work and the original technical references it relies on.
- Peer-reviewed baseball drag/lift/spin/trajectory literature.
- Useful open-source sports/baseball collision and ball-flight implementations where they add real evidence.

For each useful source record exact paper/repository, exact file/function/class inspected, algorithm/equations/data flow, units, license, maintenance state where relevant, and mapping to current `baseball3d.html`.

## Questions to answer
- Are current drag, Magnus, spin-decay and integration terms dimensionally and empirically sound?
- Are EV / launch angle / spray -> distance, apex and hang-time distributions realistic?
- Which coefficients are evidence-backed vs currently uncalibrated?
- How should batted-ball physical class be persisted instead of being inferred from later catchability/landing state?
- What should differ among grass, dirt, wall, foul fence and backstop collisions?
- Which portions of throw physics can share the batted-ball model, and which require throw-specific assumptions?
- How should weak-arm long throws, low-line throws, high-arcing throws, relays and cutoff behavior be calibrated?
- Which camera/visibility constraints materially hurt playable realism?
- What other batting, pitching, running, animation or camera improvements have high expected impact based on primary/open sources?
- Should ML be realtime physics, calibration/validation only, or rejected?

## Large-data guard
Do not download large external datasets before documenting approximate file count/size and license. Prefer code, papers, metadata and small/sample datasets first.

## Required report sections
1. Primary-source inventory
2. Exact code/files/functions actually read
3. Current equations and unit audit
4. Findings
5. Mapping to current game code
6. `copy / adapt / calibration-only / concept-only / reject` table
7. Coefficient source / uncalibrated flag table
8. Existing heuristics that can be removed/replaced
9. Proposed target architecture
10. Minimal implementation v1
11. Distribution-based validation plan by EV/LA/spray bucket: distance, hang time, apex, landing, bounce and wall outcome
12. Throw flight-time/height/accuracy validation plan
13. Direct contract tests
14. Mutation tests
15. Extensions to existing recording corpus / 1000-route / 50-game validation
16. Licensing/commercial-use constraints
17. Game-wide high-impact quality opportunities outside defense
18. Risks, negative findings, failed approaches, unresolved questions
19. Explicit verdict on H6 and H5, and any implications for H2/H4

## Non-goals
- Do not edit `baseball3d.html` or gameplay code.
- Do not implement physics changes yet.
- Do not coordinate conclusions with Agents A/B/C before independently finishing this report.
- Do not merge any PR.

## QA / Definition of Done
- Report exists at the exact output path.
- Current formulas are audited with units and source status.
- Major recommendations are source-backed and mapped to current functions.
- README-only claims are insufficient when code/paper detail is available.
- Distribution validation thresholds/inputs are concrete enough to implement next.
- Negative findings and rejected approaches are preserved.
- `git diff` shows no game-body modification.
- Commit the report and research-only notes to this branch and push it.
- Final Codex response must include pushed branch, commit SHA, output path, sources inspected and blockers. Important findings must not exist only in the final chat response.