# b0805-28 owner-recording batch audit — seven defense / baserunning defects

Date: 2026-08-11
Reviewer: Browser GPT
Repository: `L-carp55/baseball3d-game`
Recording build: `b0805-28-defense1`
Current gameplay source of truth during review: `agent/b0805-29-possession-footwork@60b993b73fed854934a976e45e8feb9437deb584`
Status: **REVIEWED_FROM_OWNER_RECORDINGS / NOT IMPLEMENTED / QUEUED**

## Scope and boundary

The owner supplied seven play-recording JSON files and described one or more defects in chronological order. This audit reconstructs the recorded state transitions and maps them to the current b29 architecture. It does not implement a repair, merge a PR, or change the current motion-program critical path.

All seven recordings identify themselves as `baseball3d 記録 v1 b0805-28-defense1`. PR #23 / b29 only addresses the stale pursuit target and residual velocity acting on a thrower during `transfer`; that repair does not cover the seven defect classes below.

Important distinction:

- **Recorded fact** means directly supported by the JSON sequence.
- **Code finding** means directly supported by b29 source.
- **Repair direction** is an architectural recommendation and still requires an isolated implementation task, tests, and owner visual playtest.

## Executive result

All seven owner observations are valid. They reduce to six root systems rather than seven unrelated special cases:

1. `RunnerContact / TagEvent` geometry is missing; slide is display-only.
2. `ThrowDecision` does not generate all strategically valid multi-leg actions and has no real hold-ball candidate.
3. `FieldingAssignment` can commit a nearby infielder to cover before jointly comparing him as a chase candidate.
4. `FieldingExecution / BallPossession` is incomplete across pickup, receive, transfer, rundown exchange, and play conclusion.
5. Ground-ball pickup actions lack a run-through / athletic-scoop alternative between routine reach and dive.
6. Ball collision does not represent the complete foul-territory wall boundary.

The highest-leverage shared repair is an explicit possession/execution state machine. Individual `if` patches for each symptom would leave the same failure mode available in another play path.

---

## 1. 17:43:55 — close slide at second is called out despite visual arrival

Recording:

- tag: `打球 85mph 28° 方向-10° / 1死 塁100`
- late breakaway sequence at second base
- at recording time 16.5–16.7 s, runner log is `1:1.9→2S` and slide is `1:feet@2#1`
- at 16.8 s, the play closes with runner log `1:2→2XS` and `飛び出し → タッチアウト！`

### Verdict

**Owner concern confirmed.** The recorded display rounds runner `p` to one decimal place, so the internal scalar may still have been slightly below 2.0. Nevertheless, the visual contract tells the player that the feet-first slide reached the bag in the same displayed tick in which the out is declared.

### Code finding

- `desiredRunnerSlide` / `updateRunnerSlide` only create `slideMode`, `slideBase`, `slideT`, and a pose.
- Runner speed, contact point, reach, and tag geometry are unchanged by sliding.
- Base decisions still compare scalar `runnerETA(...)` to a fixed `0.02 s` threshold.

Therefore the game draws feet extending toward the bag while the rule engine still evaluates the runner's abstract body-path scalar. A mathematically small deficit can look like a tie or safe slide.

### Repair direction

Create one authoritative `RunnerContact / TagEvent` calculation:

- actual lead contact point for feet-first / head-first / upright arrival;
- bag contact timestamp;
- tag contact timestamp;
- explicit tie policy;
- unrounded margin recorded in trace.

Do not solve this with a hidden random slide bonus. Animation and rule contact must read the same geometry.

---

## 2. 17:46:29 — weak-armed RF abandons the run at home and plays to third

Recording:

- tag: `打球 86mph 24° 方向17° / 0死 塁100`
- RF fields at approximately `(110,338)` around 4.9 s
- initial decision is `to:2`, reason `containment`
- release at 5.9 s changes to `to:3`, still reason `containment`
- at release, batter-runner is about `1.9→2` while the lead runner is `3.3→4`
- throw goes RF -> second baseman/cutoff near `(54.6,198.4)` -> third base
- lead runner scores before the later third-to-home attempt can matter

### Verdict

**Owner concern confirmed.** The live scoring threat was home. The defense used the weak direct-throw result to abandon home and contain the trailing runner at third instead of considering a relay route to home.

### Code finding

- Direct throw ETA already uses `armEff(f)`, so the engine is not wholly unaware of the fielder's arm.
- `chooseThrowTarget` discards an outfield direct challenge when its margin is below `-0.75`.
- It then calls `containmentBaseForTrailingRunner`, which can choose third.
- The candidate set contains direct base throws and a containment fallback, but not a full action such as `RF -> cutoff -> home` evaluated with both throwers' arms, cutoff location, transfer time, and receiver readiness.

Thus arm weakness is represented only as a reason to abandon the direct play. It is not used to construct the correct relay plan.

### Repair direction

Add multi-leg defensive candidates:

- direct home;
- cutoff-to-home;
- cutoff hold / fake / redirect;
- containment only after run-prevention candidates are evaluated.

Score the complete route using current fielder arm, cutoff arm, actual cutoff position, each transfer context, home receiver arrival, and run value. Reject containment at a base the lead runner has already passed.

---

## 3. 17:48:11 — third baseman covers third instead of attacking a nearby ball

Recording:

- tag: `打球 96mph -12° 方向-28° / 2死 塁011`
- from the first recorded frame, third baseman has `coverBase=3` / `batted-ball-cover`
- at about 0.7 s, ball is near `(-43.7,80.6)` and third baseman near `(-54.9,77.4)`: approximately 11.65 ft apart
- LF remains primary roughly 200 ft away at that moment

### Verdict

**Owner concern confirmed.** This does not prove third baseman certainly fields the ball, but it proves the assignment system never gave a very near infielder a fair chase comparison because he was already committed to third-base cover.

### Code finding

`assignCoverRole` refuses a primary fielder, while `setPrimaryFielder` clears the new primary's cover role. The ownership mutation is internally consistent. The defect is earlier: primary/cover candidate generation and assignment are not solved jointly, so a useful chase candidate can be consumed by cover duty before the best coverage arrangement is selected.

### Repair direction

Generate primary candidates before freezing cover roles, or jointly score:

- each feasible ball chaser;
- replacement cover at every vacated base;
- runner threats and force state;
- time-to-ball versus time-to-cover.

Do not add a special rule saying “3B always chases left-side balls.”

---

## 4. 17:50:58 — rundown receivers throw back essentially instantly

Recording:

- tag: `打球 96mph -2° 方向-16° / 1死 塁011`
- normal throw path reaches second baseman around 6.0 s and enters a `relay-receive` transfer context
- rundown starts at 6.3 s
- during the rundown, ball reaches first around 8.8 s and is already moving back by about 9.1 s
- similar immediate reversals repeat at later endpoints without a visible new receive/transfer stage

### Verdict

**Owner concern confirmed.** The normal transfer contexts exist, but the internal rundown relay path bypasses them.

### Code finding

In `updateRundown`:

- `chase` chooses `throw-window` and calls `launchThrow(...)` directly;
- `relay` advances the ball;
- on arrival it directly assigns `R.holder=R.recv; R.sub='chase'`.

No new `BallPossession`, `catch`, grip, body-set, or transfer interval is created for the receiver. On the next update, the newly assigned holder is eligible to choose another throw.

### Repair direction

Every rundown exchange must pass through the same physical execution contract:

`ThrowFlight -> ReceiveOutcome -> PossessionSecured -> Transfer/Grip -> ReleaseReady -> ThrowFlight`

Use a dedicated `rundown-receive` context, but do not make it zero. It should depend on catch difficulty, receiving body direction, arm/fielding/catching ability, and whether a barehand transfer is physically plausible.

---

## 5. 17:56:30 — LF stops in front of a rolling ball for more than two seconds

Recording:

- tag: `打球 82mph 4° 方向-37° / 1死 塁011`
- LF reaches the old intercept point around `(-134.8,178.9)` by about 3.8 s
- ball continues and stops around `(-131.3,173.1)`, approximately 6.77 ft away
- LF remains stationary on the old target through about 6.0 s
- at 6.2 s, ball snaps from its stopped location to LF's hand and `throwing/transfer` begins

### Verdict

**Owner concern confirmed.** This is not a realistic hesitation. It is stale interception plus a possession timeout.

### Code finding

- LF's aim remains the old `intercept-replan` point.
- Ground pickup requires `grounded` contact range.
- But `stepFlight` also executes `beginThrowPhase(...)` when `ball.landed && ball.t>7` or `ball.t>9`, even if the fielder has not physically reached the ball.
- `beginThrowPhase` then zeros the ball and snaps it to the fielder.

### Repair direction

- when the ball becomes slow/stationary and the fielder is outside pickup radius, retarget to actual ball position;
- add an approach/pickup action;
- delete possession creation from a pure elapsed-time fallback;
- watchdog may choose a new chaser or fail safely, but cannot grant possession.

---

## 6. 01:07:59 — CF dives for a routine roller; catcher makes an unsafe distant return

Recording:

- tag: `打球 95mph 18° 方向-15° / 1死 塁000`

### 6A. CF sliding pickup

- around 5.4 s, ball is a slow/stationary roller near `(-99.2,344.0)`
- CF is near `(-93.7,340.9)`, about 6 ft away and still approaching
- at 5.5 s possession begins with `ball.cm='dive'`

#### Verdict

**Owner concern confirmed.** The fielder was close enough to continue through the ball, but the action taxonomy treated “outside static routine radius” as a dive situation.

#### Code finding

`planCatchAction` offers routine/jump/dive/wait-routine. Ground logic lacks a run-through pickup, one-more-step scoop, or charge-and-field action. `groundDiveAmount` can therefore classify a moving fielder just outside `CATCH_R` as a dive.

#### Repair direction

Add `RUN_THROUGH_PICKUP / ATHLETIC_SCOOP` with current velocity, approach angle, ball speed, and short-horizon reach. Reserve dive for a ball that would otherwise pass beyond physical reach.

### 6B. Catcher returns to a far-away pitcher and exposes home

- relay chain reaches catcher at home around 12.1 s
- runner retreats to/stops at third
- at 13.4 s catcher releases to `P`, reason `no-visible-threat`
- pitcher is displaced near `(-45.7,180.5)`, not near the mound
- while the long return is in flight, owner sends the runner home; the runner scores

#### Verdict

**Owner concern confirmed.** “No runner moving at this instant” was treated as permission to make a long, unsafe live-ball return.

#### Code finding

- `chooseThrowTarget` returns `P` when `visibleRunnerThreat` produces no current moving threat.
- There is no true `HOLD_BALL` action.
- Target `P` means the pitcher's current displaced position, so the return can be very long.
- Latent threat from a runner standing on third and the time during which home is uncovered are not scored.

#### Repair direction

Add a hold-ball candidate and distinguish:

- safe routine return to a nearby pitcher;
- distant pitcher chase/return;
- runner-on-third latent scoring threat;
- nearest safe receiver and home coverage.

Do not release to `P` merely because `runnerObservedDir===0` in one frame.

---

## 7. 01:10:02 — missing foul-wall collision, false rundown, and floating held ball

Recording:

- tag: `打球 81mph 37° 方向-43° / 2死 塁100`

### 7A. Deflected ball crosses the foul-side wall boundary

- LF deflects near `(-227,226)` around 3.8 s
- ball continues through approximately `(-266,240)` by 6.0 s
- no side-wall collision is recorded
- at 6.2 s, the same elapsed-time possession fallback snaps the ball back to LF

#### Verdict

**Owner concern confirmed.** The current collision model handles the fair radial fence and backstop, but not the complete foul-territory side-wall geometry through which this ball travelled.

#### Code finding

- `stepFlight` only applies the radial outfield fence when `abs(angle)<=45.5`.
- `stepBall` has a backstop collision.
- There is no swept collision against a continuous left/right foul-side wall segment.

#### Repair direction

Represent the whole playable wall as collision segments/curves and perform swept collision per physics substep. A deflected high-speed ball must not tunnel through a missing side-boundary branch.

### 7B. Rundown starts although the runner is not bracketed

- batter-runner is around `3.4→4`
- cutoff/SS receives around `(-74,159)` near 10.3 s, far behind third base
- runner is between third and home, while catcher remains at home
- at 10.6 s the game announces `挟まれた！` and enters rundown

#### Verdict

**Owner concern confirmed.** A runner being between two bases is not sufficient to call a rundown. Here the ballholder was not in a meaningful rear-side bracket position.

#### Code finding

`judgeAtBase` sends a non-force runner to `beginRundown` when a throw arrives before the runner, and `beginRundown` initializes lane limits and cover players. Admission does not require actual geometric bracketing of the runner by possession holder and front defender along the basepath.

#### Repair direction

Create a `RundownAdmission` gate using basepath projection:

- runner position and direction;
- holder position relative to the runner and rear base;
- front defender/catcher position;
- actual possession;
- maximum pursuit/throw gaps;
- whether either side can physically close the lane.

If those conditions fail, continue ordinary chase/throw play instead of creating abstract rundown limits.

### 7C. Ball remains floating at the old holder position after play conclusion

- through 12.0 s, held ball follows SS during rundown
- at 12.1 s, phase becomes `play` and `throwPlay` is cleared
- ball freezes around `(-64.3,136.5,z=4.4)`
- SS and other fielders continue moving while the ball remains at that world coordinate

#### Verdict

**Owner concern confirmed.** This is a possession-to-display lifecycle break.

#### Code finding

During `play`, only a free ball with speed greater than 3 continues through `stepBall`. A zero-speed ball is not attached to a holder once `throwPlay` is null. Clearing the play state therefore destroys ownership information but leaves the ball object visible.

#### Repair direction

Persist explicit `BallPossession.owner` beyond tactical play conclusion. Before clearing the tactical state, choose one legal display transition:

- remain attached to holder;
- hand off/return to pitcher;
- remove ball only when the next phase intentionally owns a new ball.

A zero-speed free world ball is not a valid possession state.

---

## Cross-defect architecture map

| Root subsystem | Recorded defects |
|---|---|
| `RunnerContact / TagEvent` | #1 |
| `ThrowDecision / multi-leg route / hold` | #2, #6B |
| `FieldingAssignment` joint chase-cover allocation | #3 |
| `FieldingExecution / BallPossession / transfer` | #4, #5, #7C |
| Ground pickup action taxonomy | #6A |
| Wall/collision topology | #7A |
| `RundownAdmission` | #7B |

## Recommended implementation order

1. **Possession and execution invariant** — no receive, pickup, transfer, or conclusion may create/destroy possession implicitly.
2. **Rundown receive and admission** — fixes #4 and #7B and prevents false tactical state.
3. **Stationary-ball approach + watchdog removal** — fixes #5 and part of #7A's snap-back symptom.
4. **Throw candidates: relay-to-home and hold-ball** — fixes #2 and #6B.
5. **Joint chase/cover assignment** — fixes #3 without position-specific exceptions.
6. **Ground run-through pickup** — fixes #6A.
7. **Complete wall collision** — fixes #7A.
8. **Runner contact/tag geometry** — fixes #1 and aligns slide display with rules.

This order reflects dependency structure, not severity alone. The possession invariant should be established before more tactical decisions are built on top of implicit ownership.

## Test requirements for a future task

- compact fixtures derived from all seven recordings, with original timestamps and exact state deltas;
- mutation tests that restore each confirmed failure;
- no hidden possession grant by timeout;
- every thrown ball has one owner or is in one flight, never both/neither;
- every receive creates non-zero execution time unless a documented physically valid exception exists;
- throw decisions include current ability, receiver state, multi-leg ETA, and a hold candidate;
- rundown cannot begin without geometric bracketing;
- slide/tag test records unrounded contact margin;
- browser/owner visual review remains mandatory.

## Current project status

No gameplay code was changed by this audit. Current gameplay source of truth remains b29 / PR #23. The CMU pitching-motion R1 remains the current recorded critical path unless the owner explicitly reprioritizes this gameplay-defect batch.