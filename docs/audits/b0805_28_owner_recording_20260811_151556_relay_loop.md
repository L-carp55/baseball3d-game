# b0805-28 owner recording — recursive relay ping-pong audit

Date: 2026-08-11
Reviewer: Browser GPT
Repository: `L-carp55/baseball3d-game`
Recording: `野球ゲーム記録_20260811_151556.json`
Recording build: `b0805-28-defense1`
Current gameplay source reviewed: `agent/b0805-29-possession-footwork@60b993b73fed854934a976e45e8feb9437deb584`
Status: **CONFIRMED / ROOT CAUSE IDENTIFIED / NOT IMPLEMENTED**

## 1. Owner observation

The defense performed a meaningless series of throws instead of getting the ball toward third or home. The ball repeatedly travelled between the second baseman and right fielder while the runners scored.

The observation is fully confirmed by the recording.

## 2. Recorded play

Tag:

`打球 64mph 6° 方向44° / 2死 塁010`

Initial state:

- two outs;
- runner on second;
- first baseman eventually fields the rolling ball deep on the first-base/right-field side;
- the lead runner scores;
- the batter-runner continues through second, third and home while the relay loop runs.

### Throw sequence reconstructed from the 0.1 s frames

| Approx. time | Holder / thrower | Recorded final target | Actual receiver | Decision context |
| --- | --- | --- | --- | --- |
| 6.3–6.4 s | 1B | 3B | 2B at `(131.1, 141.0)` | `containment`, first relay |
| 6.9–7.7 s | 2B | 3B | RF at `(145.4, 218.7)` | `forced-threat`, `relay-receive` |
| 8.2–9.0 s | RF | 3B | 2B | `forced-threat`, `relay-receive` |
| 9.5–10.4 s | 2B | Home | RF | target updates as batter-runner advances |
| 10.8–11.6 s | RF | Home | 2B | same recursive relay path |
| 12.1–12.9 s | 2B | Home | RF | same recursive relay path |
| 13.4–15.7 s | RF | Pitcher | Pitcher | `throw-limit` safety fallback |

Final result:

`ランニングホームラン！ 2点`

The relay loop therefore consumed six competitive throws before the seventh-throw safety fallback returned the ball to the pitcher.

## 3. Geometric proof that the relay went backwards

Relevant recorded positions:

- 2B: `(131.1, 141.0)`
- RF: `(145.4, 218.7)`
- 3B target: approximately `(-63.6, 63.6)`
- Home target: `(0, 0)`

Remaining distance to 3B:

- from 2B: about `209.5 ft`
- from RF: about `260.3 ft`

The 2B -> RF relay therefore **increased** remaining distance to third by about `50.7 ft`.

Remaining distance to home:

- from 2B: about `192.5 ft`
- from RF: about `262.6 ft`

The 2B -> RF relay therefore **increased** remaining distance to home by about `70.1 ft`.

This was not a visually odd but strategically valid cutoff. It was a route that physically moved the ball away from the declared target.

## 4. Current-code root cause

The b29 source still uses the same relay construction as the recording build.

During `transfer`:

1. `decideThrowTarget(...)` chooses the current final base target.
2. `coverOf(target, thrower)` identifies the nominal final receiver.
3. If the current thrower cannot reach that point with the accepted low trajectory, the code searches for a `cut` fielder.
4. It replaces the immediate receiver with that cut and stores only:

   `T.relayTo = T.target`

5. After the cut catches, the cut becomes `T.thrower`, the same final target is restored, and `transfer` begins again.
6. The same relay-selection code is then run from scratch.

The route has no persistent ordered plan. `relayTo` records only the eventual base, not the already selected path or visited relay fielders.

### Missing invariants

The current cut selection does **not** require that:

- the cut be between the thrower and final target;
- the cut lie inside a reasonable throw-line corridor;
- remaining distance to the final target decrease;
- total estimated route time improve;
- the candidate not be a previous holder;
- the same two fielders not repeat;
- relay-hop count remain within a baseball-plausible route;
- a route exists before the first throw is released.

It only minimizes a local broken-path distance over currently eligible fielders and requires that the first leg be reachable.

### Why these exact two fielders alternated

At the first 2B possession:

- 1B remains the primary fielder and is excluded;
- 3B is the nominal final receiver and is excluded;
- SS, catcher and pitcher are occupied by base-cover roles;
- among the freely eligible fielders, RF gives the smallest local broken-path score even though RF is farther from third.

After RF receives, 2B becomes the best freely eligible cut. On the next possession RF becomes eligible again. The algorithm therefore deterministically creates:

`2B -> RF -> 2B -> RF ...`

Changing the final target from third to home does not break the cycle because the route is rebuilt with the same unconstrained local rule.

## 5. Why the existing throw-count limit is not a repair

The source increments `S.throwCount` and, after more than six throws outside a rundown, rewrites the target to `P` with source `throw-limit`.

That safety guard prevented an infinite loop but did not preserve baseball behavior. In this play it allowed both runners to score before sending the seventh throw to the pitcher.

A watchdog may remain as a final nontermination guard, but it must never be the normal exit from a relay route.

## 6. Relationship to Issue #30

This recording is a new concrete manifestation of the same broader systems already tracked in Issue #30:

- incomplete multi-leg `ThrowDecision`;
- role-constrained relay candidate generation;
- incomplete `FieldingExecution / BallPossession` route state;
- missing `HOLD_BALL` / advance-with-ball alternative.

It adds a distinct failure contract: **recursive relay route generation can cycle and can move the ball farther from the declared target.**

## 7. Required repair architecture

### A. Plan the complete route before release

Create an explicit route object, for example:

```text
ThrowRoute {
  finalTargetBase,
  finalReceiver,
  hops[],
  currentHop,
  plannedAtSeq,
  reason,
  estimatedCompletionTime
}
```

A relay should be evaluated as one action such as:

`1B -> 2B cutoff -> 3B`

rather than as unrelated one-hop decisions.

### B. Monotonic progress gate

Every accepted relay hop must satisfy all of the following unless it is an explicit emergency recovery:

- remaining distance to final target decreases by a configured minimum;
- estimated completion time improves versus holding/running/direct alternatives;
- the cut lies within a route corridor around the thrower-to-target segment;
- the cut is not already in the visited-holder set;
- no immediate A -> B -> A cycle is possible.

### C. Atomic replanning

If the live threat changes final target from third to home:

- invalidate the previous route atomically;
- build a new complete route from the current holder;
- never keep an old intermediate hop merely because `relayTo` was already set.

### D. Valid alternatives when no route exists

Candidate generation must include:

- `HOLD_BALL`;
- run/advance with possession toward the infield;
- nearest safe receiver;
- containment at an actually useful base;
- only then a route abandonment fallback.

Do not select a cut merely because some reachable free fielder exists.

### E. Role coordination

Relay planning and base coverage must be solved jointly. A legitimate infielder may be temporarily used as a cut only if the resulting coverage and route are better than keeping the current assignments. The algorithm must not choose an outfielder behind the ball solely because all useful infielders were pre-consumed by cover roles.

## 8. Required deterministic regression

Create a compact fixture from this recording with at least these positions:

- holder / 1B near `(128.5, 130.7)`;
- 2B near `(131.1, 141.0)`;
- RF near `(145.4, 218.7)`;
- 3B receiver near `(-63.4, 64.0)`;
- SS covering second;
- catcher covering home;
- pitcher covering first;
- batter-runner manually continuing beyond second;
- lead runner already scoring.

Assertions:

1. no route contains the repeated holder sequence `2B -> RF -> 2B`;
2. every normal relay hop reduces remaining target distance;
3. a hop outside the target corridor is rejected;
4. route target change clears the prior route atomically;
5. no more than the explicitly planned relay-hop count is released;
6. failure to find a valid route selects hold/run/safe-receiver, not arbitrary free-fielder relay;
7. `throw-limit` is not reached in the canonical fixture;
8. restore the old unconstrained `pick` logic as a mutation and prove the fixture reproduces the ping-pong loop.

## 9. Final verdict

**Owner report confirmed.**

This is not a cosmetic animation problem and not merely excessive transfer speed. It is a route-planning cycle caused by rebuilding each relay hop independently without a progress invariant, route memory, visited-holder protection, or a non-throw alternative.
