# b0805-29a — entitlement bounce and runner-slide repair

Date: 2026-08-11
Repository: `L-carp55/baseball3d-game`
Branch: `agent/b0805-29a-entitled-slide-fixes`
Exact base: `60b993b73fed854934a976e45e8feb9437deb584` (`b0805-29`)
Target build: `b0805-29a`

## Scope

Owner-requested isolated gameplay repair:

1. investigate and reduce excessive ground-rule / entitlement doubles caused by high fly balls bouncing over the 9.4 ft fence;
2. fix the batter-runner becoming invisible during a head-first slide into first base;
3. make runners slide head-first on ordinary returns to a base, not only when the current throw is classified as close.

Do not merge or modify the separate CMU pitching-motion branches.

## Root findings fixed by this branch

### Bounce

`stepBall()` applies the same vertical restitution `0.55` to every impact. A high fly descending at 50 ft/s rebounds at 27.5 ft/s, whose no-drag ballistic apex is about 11.7 ft—higher than the game's 9.4 ft fence. That can turn routine deep fly-ball landings into entitlement doubles.

The repair must preserve visible low-angle ground-ball hops while applying a lower, capped first-impact rebound to balls whose pre-impact `maxZ` identifies a medium/high air trajectory. Prediction clones must carry the same `landed`, `maxZ`, and `la` metadata so planning and execution do not diverge.

### Head-first slide disappearance

`runnerSlidePose()` currently combines a large positive `crouch` with a negative `rise`. `drawFigure()` computes body base height as `rise - crouch`, so the head-first pose starts roughly 1.9 ft below the field before the body is rotated. The runner can therefore disappear underground.

The repair must keep slide poses near ground level without double-counting vertical lowering.

### Return slides

`desiredRunnerSlide()` currently requires `runnerClosePlayAtBase()` before a returning runner (`dir < 0`) may slide. Ordinary fly-ball returns can therefore remain upright. Any runner returning to a legal base within the existing slide-start distance should use a head-first return slide. Sliding remains visual and must not add speed or timing bonuses.

## Required contracts

- high first-impact fly rebound apex remains below the 9.4 ft fence;
- ground-ball hops remain visibly non-zero;
- planning clones use the same bounce metadata as the live ball;
- ordinary return to first, second, or third triggers a head-first slide near the base;
- routine forward arrival at first remains upright unless the play is close;
- head-first and feet-first pose base heights remain above the underground-disappearance threshold;
- existing RunnerIntent, FieldingAssignment, ReachModel, ThrowDecision, PlayLifecycle, b28 and b29 contracts remain unchanged;
- owner visual playtest remains required.

## Non-goals

- no slide timing advantage or tag-geometry redesign in this branch;
- no broad ball-physics recalibration beyond first-impact vertical response;
- no change to fence height;
- no pitching-motion work;
- no merge without owner instruction.
