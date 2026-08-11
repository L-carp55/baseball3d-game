# b0805-29a entitlement-bounce and runner-slide repair audit

Date: 2026-08-11
Branch: `agent/b0805-29a-entitled-slide-fixes`
Gameplay base: `60b993b73fed854934a976e45e8feb9437deb584` (`b0805-29`)
Implementation commit: `aef3d695bbca736e476f80696d1769a446ed7100`
Permanent-CI commit: `8cf3a49a0d960e7c294f4e26e534822495481eb4`
Target build: `b0805-29a`
Status: **IMPLEMENTED / CI PASS / OWNER VISUAL REVIEW REQUIRED / NOT MERGED**

## Changes

- replaced universal vertical impact restitution with trajectory-aware first-impact rebound;
- capped medium/high fly first-bounce vertical speed below fence-clearing height;
- preserved visible low-angle ground-ball hops and unchanged horizontal retention/rolling drag;
- made shared `stepBall()` persist first-impact `landed` state for live and prediction balls;
- carried `landed`, `maxZ`, and `la` into interception/slow-roll prediction clones;
- ordinary returns now start a head-first slide within the existing 12.6 ft window;
- removed double vertical lowering from head-first and feet-first slide poses;
- retained routine upright first-base arrivals when the play is not close;
- no slide speed, ETA, tag, scoring, throw, or fielding-policy changes.

## Physics rationale

The previous universal vertical restitution was `0.55`. A high fly arriving at roughly `-50 ft/s` therefore rebounded at `27.5 ft/s`; without drag, that corresponds to an apex of approximately `11.7 ft`, above the game's `9.4 ft` fence.

The new first-impact model is trajectory-aware:

- `maxZ >= 18 ft`: restitution `0.28`, vertical rebound capped at `14 ft/s`;
- `maxZ >= 10 ft`: restitution `0.38`, capped at `16 ft/s`;
- hard lower-trajectory impact: restitution `0.43`, capped at `20 ft/s`;
- ordinary low-angle ground-ball hops retain the existing visible `0.55` response.

This is a targeted first-impact correction, not a full batted-ball physics recalibration.

## Automated contracts

`_test_bounce_slide_ownerfix_20260811.js` verifies:

- old `0.55` high-fly rebound would clear the `9.4 ft` fence;
- new high-fly first rebound cannot clear it;
- low-angle ground-ball bounce remains visibly non-zero;
- production uses the helper and prediction metadata;
- head-first / feet-first pose bases are not underground;
- ordinary return slides and routine first-base non-slide behavior.

`_test_bounce_landed_state_20260811.js` verifies that shared physics writes the impact state and that prediction clones inherit the same trajectory metadata.

The existing focused runner controls/sliding test was extended with ordinary-return and body-height assertions.

## Validation evidence

Permanent workflow: `Baseball3D regression`

- workflow run: `31467120851`
- conclusion: `success`
- static JavaScript / Python checks: PASS
- architecture guard: PASS
- RunnerIntent: PASS
- runner controls/sliding: PASS
- FieldingAssignment: PASS
- ReachModel: PASS
- DefenseActionPolicy: PASS
- force-chain decision: PASS
- b0805-28 breakaway / transfer-context: PASS
- b0805-29 possession footwork: PASS
- new bounce and shared-impact-state contracts: PASS
- browser baseline: `51/51 PASS`
- all existing architecture and behavioral mutations detected

The temporary apply workflow was removed after permanent CI passed.

## Remaining owner checks

- deep fly balls near the wall no longer generate frequent entitlement doubles;
- ordinary grounders still visibly hop rather than slide;
- batter-runner remains visible through a close head-first slide into first;
- returns to first/second/third visibly slide and do not receive a timing bonus.

No merge is authorized by this audit.
