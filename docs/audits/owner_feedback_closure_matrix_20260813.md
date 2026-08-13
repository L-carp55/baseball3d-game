# Owner Feedback Closure Matrix — b0805-30 reality check

Date: 2026-08-13
Reviewer: Browser GPT
Repository: `L-carp55/baseball3d-game`
Owner-played build evidence: uploaded recording `野球ゲーム記録_20260813_170604.json`
Current owner-played BUILD: `b0805-30`
Current M1 validation branch inspected: `claude/b0805-30-m1-final-validation@8f0f389f637fe892c7b7356fc12361937a94fb08`
Gameplay ancestor: `agent/b0805-29-possession-footwork@60b993b73fed854934a976e45e8feb9437deb584`

Status: **RECONSTRUCTED / OWNER-FACING CLOSURE NOT ACHIEVED / M1-P1 ADVANCE PAUSED**

## 1. Why this audit exists

The owner replayed the localhost build and reported that most defects raised during the Browser-GPT work still appeared unfixed. This audit does not trust PR descriptions or previous PASS labels. It asks four separate questions for every owner-feedback item:

1. Was code actually implemented?
2. Is that code present in the currently played b0805-30 ancestry?
3. Is there a regression/mutation test that detects the original mechanism?
4. Has the owner visually/replay-verified it on an integrated build?

An item is not CLOSED unless all applicable gates are satisfied. Automated PASS alone is not owner closure.

## 2. Immediate facts from the 2026-08-13 owner recording

The uploaded recording identifies itself as:

- `baseball3d 記録 v1 b0805-30`
- save time `2026-08-13T08:06:04.453Z`

Therefore the localhost page at the time of the complaint is not b29a and not a combined owner-fix build. It is the CMU pitching branch family built on b29.

The sample play also confirms one old repair is active: after the second baseman secures the ground ball at approximately `(42.5, 131.3)`, the fielder remains at that location throughout `transfer` until release. The b29 stale-intercept backward-footwork symptom is not reproduced in this sample.

However, every frame records `ball.bt = ""`. b0805-30's recorder reads `ball.battedType`, but production has no writer for that property. This exposed a larger ancestry defect described below.

## 3. Critical branch-history defect: b24 was dropped from the canonical line

### 3.1 Intended history

PR #17 described b0805-24 as adding/preserving:

- immutable physical batted-ball identity;
- separation of physical type from `canCatchAir`;
- low-line-drive identity even when no fielder can catch it in air;
- consistent type through later result paths;
- recording of physical batted-ball type;
- additional live-play integrity fixes.

### 3.2 Actual history

The real canonical line does **not** contain b24.

- b23: `agent/b0805-23-defense-action-policy@a6ed22b0...`
- b25 implementation commit `c51eee353569dfcee00434f9e837bacafe4be7f2`
- parent of that b25 implementation commit: **b23 `a6ed22b0...`**, not b24.
- PR #20 also explicitly uses b23 as its base.
- b26 uses b25 as its base.
- b28 uses b26.
- b29 uses b28.
- b30 uses b29.

GitHub compare between current b24 branch head `e50b5c326f...` and b29 reports `diverged`, with merge base exactly b23 `a6ed22b0...`.

### 3.3 The b24 branch itself never became a clean game implementation

The current b24 branch head is `e50b5c326f...` (`chore: reconstruct b0805-24 from compressed payload`). Comparing b23 -> that head shows only temporary payload/chunk/workflow files; no `baseball3d.html` modification.

The supposed validation base `54eb18e795...` is itself a workflow/bootstrap commit, and its `baseball3d.html` still reports BUILD `b0805-23`.

Thus PR #17's prose must not be treated as evidence that the described game-body patch survived. The canonical b25 line was created directly from b23 while b24 remained a failed/unfinished materialization branch.

### 3.4 Concrete surviving symptom

b0805-30 contains:

```js
bt: ball.battedType || ''
```

in recording, but `battedType` has no production writer. The 2026-08-13 owner recording therefore logs `bt:""` throughout the play.

The current browser regression only checks `classifyCaughtBall(...)` for **caught** balls and `flyKind` for follow-up labels. It does not pin physical identity for an uncaught low liner. Therefore the broader b24 contract is not protected.

## 4. Parallel-branch defect: b29a fixes are not in b30

PR #32 / `agent/b0805-29a-entitled-slide-fixes@411255ac...` contains three owner fixes:

1. excessive high-fly bounce / ground-rule doubles;
2. head-first slide body sinking/disappearing at first;
3. head-first slides on returns.

It is a separate child of b29. Compare b29a -> current b30 reports `diverged`, merge base `60b993b...` (b29). Therefore none of these three fixes exists in the currently played b0805-30.

Current b30 still contains:

- universal vertical ground restitution `b.vz=-b.vz*0.55`;
- old head slide pose `lean:1.28,crouch:1.38,rise:-0.52`;
- return slide only when `runnerClosePlayAtBase(...)` succeeds.

This fully explains why those owner complaints can still be seen on localhost b30.

## 5. Closure matrix

Legend:

- `IN_B30` — production mechanism is present in current b30 ancestry.
- `PARTIAL` — original mechanism was repaired, but a broader/adjacent owner symptom is still possible.
- `LOST_B24` — described as b24 work but not in canonical ancestry.
- `PARALLEL_ONLY` — implemented on another branch, not b30.
- `NOT_IMPLEMENTED` — root cause identified only.
- `PENDING_OWNER` — code exists but owner acceptance is not complete.
- `NOT_CONFIRMED` — investigated owner suspicion was not independently reproduced as that exact mechanism.

| ID | Owner feedback / symptom | Current b30 status | Evidence / interpretation | Owner-closed? |
|---|---|---|---|---|
| OF-01 | ノーバウンドの低い捕球ライナーを「ゴロ」と表示 | `IN_B30` | `classifyCaughtBall()` survives and test19 checks caught low liner | No owner closure recorded |
| OF-02 | フライ捕球後の別アウトで「投ゴロ」等へ化ける | `IN_B30` | `flyKind` / `flyOutLabel()` survive | No owner closure recorded |
| OF-03 | 同じアウト文言が捕球時と終了時に二重表示 | `IN_B30` | `presentFinalMessage()` deduplicates identical final message | No owner closure recorded |
| OF-04 | 余裕のある通常フライでも毎回ジャンプする | `IN_B30` | `shouldWaitForChestCatch()` survives | No owner closure recorded |
| OF-05 | 頭上球で下方向へ飛び込む/不要なdive pose | `IN_B30/PARTIAL` | horizontal dive logic survives; later routine-roller dive is a different mechanism | Not fully closed |
| OF-06 | 明らかに手遅れの本塁へ後追い送球する | `IN_B30/PARTIAL` | containment fallback survives, but complete relay/home route still missing | Not fully closed |
| OF-07 | 外野・内野・捕手が同じ深い構え | `IN_B30` | `fielderReadyPose()` retains position-specific stance | No owner closure recorded |
| OF-08 | 二塁カバーがいないように見える | `NOT_CONFIRMED` as original mechanism | b13 investigation found `c2` already existed; not patched as a separate defect | N/A; monitor |
| OF-09 | 高いバウンドだけで普通のゴロへ横っ飛び | `IN_B30/PARTIAL` | `groundDiveAmount()` uses horizontal shortage; later routine-roller dive remains open | Not fully closed |
| OF-10 | 球を離してから腕を振る投球時系列 | `SUPERSEDED/PENDING_OWNER` | old hand-authored timing was replaced by CMU M1; final visual acceptance not complete | No |
| OF-11 | 高フライ中にSを押しても進塁しない/止まる | `IN_B30` | b22 manual intent contract survives through RunnerIntent | No recent owner recheck |
| OF-12 | Xで帰塁できない経路 | `IN_B30` | b22/manual selection survives | No recent owner recheck |
| OF-13 | 外野手が現在の本塁脅威を無視して古い二塁等へ投げる | `IN_B30/PARTIAL` | b23 comparison/release reevaluation survives; full multi-leg route does not | No |
| OF-14 | 中継/受球後に古い送球先へ固執 | `IN_B30/PARTIAL` | ThrowDecision reevaluation survives; relay route itself has cycle defect | No |
| OF-15 | 少し待てば普通に捕れるのに不要な派手捕球 | `IN_B30/PARTIAL` | b23 wait-vs-dive policy survives; run-through ground pickup missing | No |
| OF-16 | 挟殺で距離条件だけに反応して早投げ | `IN_B30/PARTIAL` | `planRundownAction()` survives, but rundown receive path bypasses transfer state | No |
| OF-17 | 低いライナーで `canCatchAir=false` になると物理種別まで「ゴロ」化 | `LOST_B24` | immutable `battedType` writer absent; b24 not in ancestry | **No** |
| OF-18 | 非捕球/送球/結果経路でも元打球種別を保持 | `LOST_B24` | b30 still has hard-coded ground-result paths; no persistent physical type | **No** |
| OF-19 | 打球物理種別を録画に残したい/後で追跡したい | `LOST_B24` | recorder reads `battedType`, but production never writes it; owner recording shows blank `bt` | **No** |
| OF-20 | カバー未成立の塁を送球候補化しない | `LOST_B24 / NEEDS RE-AUDIT` | b24 package not inherited; later assignment/ThrowDecision may cover some cases but no b24 fixture survived | No |
| OF-21 | 先行フォースを無視して後続一塁だけ取る | `RECOVERED_LATER` | b26 `doublePlayContinuation()` exists in b30 | No recent owner recheck |
| OF-22 | 挟殺成立前に「挟まれた！」と宣言する | `LOST_B24 + NOT_IMPLEMENTED` | current `beginRundown()` immediately sets message; Issue #30 later reproduces false rundown | **No** |
| OF-23 | 捕手が現在の三塁/本塁脅威を再評価しない | `PARTIAL` | generic ThrowDecision reevaluation exists, but HOLD_BALL/latent-third-threat utility missing | **No** |
| OF-24 | バックネット/描画順でプレーが見づらい | `LOST_B24 / NEEDS VISUAL RECHECK` | b24 ancestry missing; not independently recovered here | No |
| OF-25 | 一塁で止めた打者走者が後で勝手に二塁へ進む | `IN_B30` | `manualIntentLocked` is present and guarded | No recent owner recheck |
| OF-26 | 前/後ろの走者を個別に進塁・帰塁したい | `IN_B30` | b25 A/C/D/Z controls and selection survive | No recent owner recheck |
| OF-27 | 2B/3B等で野球らしいスライディングを表示 | `IN_B30/PARTIAL` | b25 slide system exists; return/head clearance problems remain | No |
| OF-28 | 0死一塁等で二塁封殺→一塁併殺を評価せず一塁へ直送 | `IN_B30` | `doublePlayContinuation()` exists | No recent owner recheck |
| OF-29 | 投球前の飛び出しを元塁固定の「牽制」として処理し続ける | `IN_B30` | `beginBreakaway()` live-play path exists | No recent owner recheck |
| OF-30 | ゴロ処理の遅さを簡単な送球受球後にもそのまま適用 | `IN_B30` | b28 transfer contexts exist (`batted-ground`, `relay-receive`, etc.) | No recent owner recheck |
| OF-31 | 弾く→再捕球後、古い追跡点へ後退しながら送球 | `IN_B30`, sample confirmed | `prepareThrowerFootwork()` exists; 2026-08-13 sample remains fixed at `(42.5,131.3)` through transfer | **Mechanism looks fixed; owner full recheck still pending** |
| OF-32 | スライド表示では塁に届いて見えるのに同tickでアウト | `NOT_IMPLEMENTED` | RunnerContact/TagEvent geometry missing | **No** |
| OF-33 | 弱肩外野手が中継→本塁ルートを候補化せず三塁へ | `NOT_IMPLEMENTED` | no complete multi-leg action route | **No** |
| OF-34 | 三塁手が近い打球を追わず三塁カバーへ固定 | `NOT_IMPLEMENTED` | chase + cover assignment not jointly optimized | **No** |
| OF-35 | 挟殺受球者が握り替えなしに即投げ返す | `NOT_IMPLEMENTED` | rundown `R.holder=R.recv; R.sub='chase'` bypasses receive/transfer stage | **No** |
| OF-36 | 野手が止まった/遅い球の数ft手前で数秒停止 | `NOT_IMPLEMENTED` | stationary-ball retarget/execution state incomplete | **No** |
| OF-37 | 実際に拾っていないのに時間経過だけで保球になる | `NOT_IMPLEMENTED` | `grounded || (ball.landed && ball.t>7) || ball.t>9` still grants `beginThrowPhase` | **No** |
| OF-38 | 通常処理可能な転がり球へセンター等が不要なdive | `NOT_IMPLEMENTED` | no RUN_THROUGH_PICKUP / ATHLETIC_SCOOP state | **No** |
| OF-39 | 捕手が三塁走者を残したまま遠い投手へ返し本塁を空ける | `NOT_IMPLEMENTED` | no real HOLD_BALL; `no-visible-threat` falls back to `P` | **No** |
| OF-40 | ファウル側の壁がなく打球が境界を抜ける | `NOT_IMPLEMENTED` | complete foul-side collision topology absent | **No** |
| OF-41 | 実際には守備に挟まれていないのにrundown開始 | `NOT_IMPLEMENTED` | no geometric RundownAdmission; immediate `beginRundown` message remains | **No** |
| OF-42 | プレー終了後に保持球が旧位置へ浮く | `NOT_IMPLEMENTED` | explicit BallPossession owner/lifecycle missing | **No** |
| OF-43 | 2B↔RF等で意味不明な中継を往復 | `NOT_IMPLEMENTED` | no complete ThrowRoute, visited-owner set, progress or cycle guard; only throw-count escape | **No** |
| OF-44 | 高フライ初回バウンドが高すぎ、エンタイトルツーベース過多 | `PARALLEL_ONLY` | fixed on PR #32/b29a; b30 still uses universal 0.55 vertical restitution | **No on b30** |
| OF-45 | 一塁head-first slideで身体が地面へ沈み消える | `PARALLEL_ONLY` | fixed on PR #32; b30 still has `crouch:1.38,rise:-0.52` | **No on b30** |
| OF-46 | 帰塁時にもhead-first slideしてほしい | `PARALLEL_ONLY` | fixed on PR #32; b30 still requires close-play gate on returns | **No on b30** |
| OF-47 | 捕球結果が単純すぎる / difficult catch後の回復・送球を自然に | `NOT_IMPLEMENTED` | b27 candidate was never canonical; later E1/E2 design only | **No** |
| OF-48 | 投手モーションが視覚的に不自然/壊れて見える | `PENDING_OWNER` | CMU M1 R2 architecture approved, final full visual gate not completed | **No** |

## 6. What the current automated regression actually proves

The current browser suite protects many architecture contracts, but it does **not** prove all owner-visible defects are closed.

Important example: current `test19_捕球打球の分類` checks only:

```js
classifyCaughtBall({landed:false,la:12,...}) === 'ライナー'
```

That protects caught-ball labeling from b11. It does **not** test the later b24 requirement that an uncaught low liner keeps immutable physical identity from contact through landing/throw/result. The missing `battedType` writer can therefore coexist with a green regression suite.

Similarly, the current suite can pass while Issue #30 mechanisms remain by design because those owner recordings have not yet been converted into compact fail-before/pass-after fixtures.

## 7. Revised acceptance model

From this point, owner feedback uses four independent columns:

1. **IMPLEMENTED** — source contains the intended mechanism.
2. **INTEGRATED** — the owner-playable branch actually contains it.
3. **AUTOMATED VERIFIED** — original mechanism plus mutation is detected.
4. **OWNER VERIFIED** — owner replay/visual check on the integrated build is acceptable.

Only items satisfying all applicable columns may be labeled CLOSED.

A PR description, a CI success badge, or an audit document alone is not closure.

## 8. Revised next sequence

Pause the existing M1 Final Validation and do not enter P1 yet.

### Recovery R0 — freeze and reconstruct

- Treat b0805-30 as the observed owner baseline, not as owner-approved.
- Preserve the uploaded b30 recording as evidence.
- Add the closure matrix as the tracking authority.

### Recovery R1 — restore the lost b24 contract against the real current line

Do **not** merge the historical b24 branch. It is a failed payload/workflow branch and diverged from canonical.

Instead, re-implement from the current b30/b29 source with new focused tests:

- immutable physical batted-ball identity from contact;
- `canCatchAir` separate from physical type;
- non-caught 9°/11° liner remains liner through later paths;
- type persists after landing;
- recording `bt` is non-empty for batted balls;
- result labels read physical type rather than hard-coded `ゴロ` where appropriate;
- re-audit the other b24 live-play items instead of assuming they survived.

### Recovery R2 — integrate the already-implemented b29a fixes onto the same owner-validation line

Port/cherry-pick by code review, not blind branch merge:

- trajectory-aware first bounce;
- corrected slide ground clearance;
- return head-first slide.

Re-run all existing tests and b29a mutation tests.

### Recovery R3 — implement Issue #30 owner defects in root-system order

1. BallPossession + FieldingExecution ownership/invariants;
2. rundown receive/transfer + RundownAdmission;
3. stationary-ball retarget and remove time-only possession;
4. complete ThrowRoute + relay progress/cycle guards + HOLD_BALL;
5. joint chase/cover assignment;
6. RUN_THROUGH_PICKUP / ATHLETIC_SCOOP;
7. complete foul-wall topology;
8. RunnerContact / TagEvent shared rule/display geometry.

Every original recording must become a fixture, and each repaired mechanism needs a mutation that recreates the old behavior.

### Recovery R4 — one integrated owner-verification build

Only after R1-R3 produce one branch containing all repaired owner-feedback mechanisms should the owner replay representative scenarios. Recordings from that branch become the acceptance evidence.

Then resume CMU M1 final visual validation and later P1/E1 sequencing as appropriate.

## 9. Current verdict

- Handoff understanding by Claude Code: **not the main problem found here**.
- Owner-feedback closure: **FAIL / incomplete**.
- Historical b24 status: **previously overstated; not in canonical ancestry**.
- b29a status: **implemented but not integrated into b30**.
- Issue #30: **root causes identified, mostly not implemented**.
- b29 possession-footwork: **present in b30 and supported by the new owner recording sample**.
- Proceeding directly to P1: **BLOCKED until recovery/closure work is completed**.
