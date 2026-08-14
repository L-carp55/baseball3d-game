# M1 issue update — 2026-08-11

Issue family: #24 / #25.

The first b0805-30 implementation candidate at `b93f33410a8604ab8598c34ca1bf4127a6186665` is **REVIEWED_BLOCKED** pending a narrow source-to-rig repair. Browser-GPT found code-level blockers independent of subjective browser playtest:

1. raw root X was normalized as forward stride, producing SFC 4.8 ft -> release 2.30 ft backward translation;
2. exporter bypassed M0 ASF-axis/FK logic and used raw AMC Euler indices;
3. throw-arm retarget does not produce a credible forward release and current audit records 3.810 ft hand/release separation;
4. frame 585 was used as a pseudo-ready source key instead of blending source follow-through into a game-side neutral adapter;
5. tests did not detect these source-to-rig failure classes.

Repair task is ready on `codex/b0805-30-pitch-motion-bank-cmu124-r1` at task commit `da58903fbaf389108fec55b72d07d77ffbc361cc`.

Do not merge or proceed to M1.1/P1/E1/F1/P2 until R1 is pushed and independently reviewed.