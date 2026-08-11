# b0805-29a entitlement-bounce and runner-slide repair audit

Date: 2026-08-11
Branch: `agent/b0805-29a-entitled-slide-fixes`
Gameplay base: `60b993b73fed854934a976e45e8feb9437deb584` (`b0805-29`)
Target build: `b0805-29a`
Status: implementation tree generated; final commit and CI run are recorded in the GitHub handoff/comment after push.

## Changes

- replaced universal vertical impact restitution with trajectory-aware first-impact rebound;
- capped medium/high fly first-bounce vertical speed below fence-clearing height;
- preserved visible low-angle ground-ball hops and unchanged horizontal retention/rolling drag;
- carried `landed`, `maxZ`, and `la` into interception/slow-roll prediction clones;
- ordinary returns now start a head-first slide within the existing 12.6 ft window;
- removed double vertical lowering from head-first and feet-first slide poses;
- retained routine upright first-base arrivals when the play is not close;
- no slide speed, ETA, tag, scoring, throw, or fielding-policy changes.

## Automated contracts

`_test_bounce_slide_ownerfix_20260811.js` verifies:

- old 0.55 high-fly rebound would clear the 9.4 ft fence;
- new high-fly first rebound cannot clear it;
- low-angle ground-ball bounce remains visibly non-zero;
- production uses the helper and prediction metadata;
- head-first / feet-first pose bases are not underground;
- ordinary return slides and routine first-base non-slide behavior.

The existing focused runner controls/sliding test is extended with ordinary-return and body-height assertions. Full architecture, focused contracts, and browser regression are run before the implementation commit is pushed.

## Remaining owner checks

- deep fly balls near the wall no longer generate frequent entitlement doubles;
- ordinary grounders still visibly hop rather than slide;
- batter-runner remains visible through a close head-first slide into first;
- returns to first/second/third visibly slide and do not receive a timing bonus.

No merge is authorized by this audit.
