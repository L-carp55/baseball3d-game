# Baseball3D: 打球・送球物理、衝突、全体品質の独立調査

**担当:** Agent D（Issue #28）
**調査日:** 2026-08-10
**ゲーム正本を読んだ版:** `agent/b0805-29-possession-footwork@60b993b73fed854934a976e45e8feb9437deb584`
**本報告の変更範囲:** 調査文書のみ。`baseball3d.html` は変更していない。

## 結論

現行の打球計算は「単位が破綻した式」ではない。ft / s の二乗抗力、重力、固定刻みという骨格は成立している。しかし、回転が rpm / spin axis ではない任意値、抗力・揚力・回転減衰・地面・壁・ネットの係数が較正されていないこと、送球の到達時間が実際に発射する物理とは別計算であること、打球種別が接触時に保存されないことが、現実らしさと再現性を同時に損ねている。

v1 は新しい汎用物理エンジンやリアルタイム ML ではない。1 個の `BallSpec`（接触時の不変記録）と 1 個の固定刻み積分器を導入し、打球と送球で「共有する空力」と「別に持つ発射条件」を分ける。まず公式 CSV の EV / LA / spray 別の距離分布と、出典を明示した数値ゴールデンで較正可能にする。草・土・壁・ネットの係数をこの段階で推測して固定してはならない。

---

## 1. Primary-source inventory

| Source | 実際に読んだ箇所 | 得たもの | 保守・ライセンス | 今回の扱い |
|---|---|---|---|---|
| Alan M. Nathan, [Analysis of Baseball Trajectories (2017)](https://baseball.physics.illinois.edu/TrajectoryAnalysis.pdf) | Eq. 1--11、座標系、RK4、訓練/検証の説明 | 抗力・Magnus のベクトル式、`K=0.5 rho A/m`、`CD=0.297+0.0292*spin/1000`、`CL=1.120*S/(0.583+2.333*S)` | 著者サイト。明示的な再利用ライセンスは確認できない | 方程式と較正手法を **concept-only / calibration-only** |
| Alan Nathan, [Trajectory Calculator, updated 2026-06-26](https://baseball.physics.illinois.edu/trajectory-calculator-new3D.html) | 説明、更新履歴、README への導線 | 打球/投球を 3D で扱い、spin-decay `tau` を可変化。固定係数は 2016 Statcast に適合と明記 | 同サイトは Copyright / all rights reserved 表記 | **concept-only**。xlsx は取得していない |
| Lyu, Smith, Kensrud et al., [The dependence of baseball lift and drag on spin (2022)](https://baseball.physics.illinois.edu/LyuDragLiftSpin.pdf) | Eq. 1--4、実験方法、Results / Discussion | `CD`,`CL` は無次元、`S=omega r/V`。104 球 x 4 試行、速度・入射角・縫目/回転軸で挙動が変化 | 論文 PDF に再利用ライセンス記載を確認できない | **concept-only**。係数をそのまま移植しない |
| Brosnan, McNitt, Schlossberg, [An Apparatus to Evaluate the Pace of Baseball Field Playing Surfaces](https://plantscience.psu.edu/research/centers/ssrc/documents/pennbounce.pdf) | Abstract、方法、結論 | surface pace は反発後/前速度比。実測では natural grass が最も遅く、skinned infield がより速い。速度・入射角依存 | ASTM 論文、copyright 表記 | **concept-only**。草/土を同一にしない根拠 |
| MLB, [Ground Rules](https://www.mlb.com/official-information/umpires/ground-rules) | Universal Ground Rules | フィールド側のネット反射は live、アウトオブプレー側のスクリーンは dead 等、衝突の物理と裁定は別 | MLB 公式。ソフトウェア/データ再配布ライセンスではない | **concept-only**（ルール表現） |
| Baseball Savant / MLB, [Statcast CSV documentation](https://baseballsavant.mlb.com/csv-docs) | `bb_type`, `hc_x`, `hc_y`, `hit_distance`, `launch_speed`, `launch_angle` | EV/LA/距離/座標を持つ公式抽出の定義。標準 CSV は apex / hang time / bounce trajectory を提供しない | 公開データだが本調査で利用許諾・再配布条件を確定していない | **calibration-only**。派生集計のみ保存候補 |
| [dgrifka/baseball_game_simulator](https://github.com/dgrifka/baseball_game_simulator) | `Model/bbe_physics.py`, `Model/feature_engineering.py`, `tests/test_bbe_physics.py`, `Model/model_metadata.json` | Nathan 型の `nathan_spin`, `air_density_K`, `spin_aware_carry`、wall polygon への ray cast、数値ゴールデンと season-forward metadata | `bbe_physics.py` の最終 meaningful commit は 2026-07-24。GitHub API は repository `license: null`、root LICENSE も確認できず | **reject for copying; adapt/concept-only for design** |
| [slothman3878/bevy-rapier-baseball-flight](https://github.com/slothman3878/bevy-rapier-baseball-flight) | `src/ball_flight_state.rs`, `src/systems.rs`, `Cargo.toml` | 1 ms 内部刻み、状態と物理エンジンの force injection の分離、drag/Magnus/SSW の切替 | `Cargo.toml` は `MIT OR Apache-2.0`。ただし該当ファイル最終 commit は 2024-11-03（message: seam orientation bugs remain）、Rust/Bevy/Rapier alpha | **concept-only**。コード移植は不適切 |

### large-data guard

- OpenBiomechanics、Statcast 生 CSV、dgrifka のデータ parquet、いずれもダウンロードしていない。OpenBiomechanics は D の必要範囲ではない。
- dgrifka repository の GitHub metadata 上の概算サイズは 59,672 KiB だが、取得したのは上表の小さなソース・metadata の本文だけである。ライセンス未宣言のため clone / copy はしない。
- 将来 Statcast を取る場合は、取得前に「query URL・日付範囲・HTTP Content-Length・列・行数・利用条件・保存先」を manifest に記録し、raw CSV はこのリポジトリへ commit しない。集計 JSON と再現 query だけを version 管理する。

## 2. Exact code/files/functions actually read

### 現行ゲーム `baseball3d.html`

| 行 | 読んだ対象 | 物理上の役割 |
|---|---|---|
| 120--121 | recording snapshot の `ball.bt` | `battedType` を出力しようとしているが、代入箇所は存在しない |
| 1205--1265 | `DRAG`, `stepBall` | 打球・送球・ルーズボール共通の抗力、重力、回転、バックネット、地面反発、転がり減速 |
| 1274--1429 | `interceptPoint`, `planPlay` | 同じ `stepBall` を予測と実行に使う。物理の精度が守備到達判断へ直結 |
| 1712--1863 | `throwSpeed`, `armEff`, `throwOffset`, `throwFlightTime`, `launchThrow`, `throwPassHeight`, `throwAngle`, `throwFlatOK` | 送球の初速・誤差・発射・到達時間・中継可否 |
| 3195--3231 | `buildThrow`, `updateThrow` | プレー確定後の表示専用送球。実際の live throw と別の線形補間軌道 |
| 3233--3249 | `startFlight` | EV / LA / spray から初速、任意回転値、初期守備計画を作る |
| 3320--3367 | `updateFlight`, `classifyCaughtBall` | 固定 1/240 秒で飛球を進め、捕球後だけ打球表示名を決める |
| 3395--3557 | `stepFlight` | 着地、再ターゲット、ファウル、HR、壁面反射、wall-handoff |
| 3695--3707 | `homerDistance`, `resolveHomer` | 同じ `stepBall` で落下点まで飛距離を表示 |
| 4164--4189, 4202--4204 | `camTargets`, `updateCam`, field FOV | ボール中心の field camera、38 degree FOV、指数平滑 |
| 481--584, 768--774 | `drawGround`, `buildStadium`, `buildBackstop` | dirt / warning track / grass は描画メッシュにあるが、衝突 material には未接続 |

### 公開実装

1. `dgrifka/Model/bbe_physics.py`
   - `nathan_spin(launch_angle, spray_adj, bat_side)` は LA、handedness-adjusted spray から backspin / sidespin rpm を作る。
   - `air_density_K(altitude_ft,temp_f)` は ft 系の `K=0.5 rho A/m` を返す。
   - `spin_aware_carry(...)` は 0.01 s 刻みで、spin vector、`CD`、`CL`、着地時の線形補間を用いて carry を返す。
   - `tests/test_bbe_physics.py` は RH pull / LH oppo spin、103 mph・28 degree・海面・70 F の 414.877736 ft、温度・標高の単調性、shape、入力検証を pin している。
2. `dgrifka/Model/feature_engineering.py`
   - `categorize_launch_angle`: `<10 ground`, `<25 line`, `<50 fly`, else popup。
   - `_ray_polygon_distance` / `wall_distance_at_spray` は spray ray と球場 wall polygon の最近交点を取る。
   - `_drag_carry_scalar` は SI 単位の drag-only Euler。`create_features_for_prediction` は wall distance、carry、over-fence margin、spin/temperature carry を別 feature として保持する。
   - 重要な否定結果: `_USE_LIFT=False`。同 repo は feature bake-off で Magnus が log loss / calibration / HR tail を改善しなかったため、標準 carry は drag-only としている。これは「Magnus が物理的に不要」ではなく、その outcome classifier の指標で採用しなかったという範囲に限る。
3. `slothman3878/bevy-rapier-baseball-flight/src/ball_flight_state.rs`
   - `BaseballFlightState` は translation / velocity / spin / seam state を別に持つ。
   - `update_state` は 1 ms 刻み、`rk4` / `derivs` は drag・Magnus・SSW を加算する。`systems.rs` は物理 state から external force を Rapier へ渡す。
   - ただし SSW seam 実装は著者自身が未解決 bug と記しており、wall / ground material / 野球裁定の実装ではない。

## 3. Current equations and unit audit

### 現行式の確認

`startFlight` は `exit mph * 1.467` を ft/s にしている。`stepBall` の重力 32.2 は ft/s2、`BASEPOS[1] = 63.64` も 90 ft の塁間を sqrt(2) で投影した値であり、空間単位は ft と一貫している。

| 現行項目 | 現行コード | 単位・整合性 | 根拠状態 / 判定 |
|---|---|---|---|
| 重力 | `vz -= 32.2*dt` | ft/s2。適切 | **source-backed** |
| 二乗抗力 | `v -= v*(DRAG*speed)*dt`, `DRAG=0.0013` | `DRAG` は ft-1 なら次元は正しい | **uncalibrated**。Nathan の標準 `K*CD` は spin 0 で約 0.00164 ft-1、約 2000 rpm で約 0.00196 ft-1。現行は約 21--34% 小さいが、現行 spin に rpm 対応がないため単純置換不可 |
| backspin lift | `bs*0.00005*speed^2` | 係数は ft-1 なら次元は正しい | **uncalibrated**。`bs` は LA 由来の -0.4..1.1 で rpm / axis でなく、Nathan 型 `CL(S)` と比較不能 |
| sidespin | `ss*0.00019*speed^2` を水平直交方向へ | 次元は正しい | **uncalibrated**。`ss=-spray/38` は spin rate/axis ではない。縫目・active spin を表さない |
| spin decay | `0.88^dt` | time constant は約 7.82 s、half-life は約 5.42 s | **conflict**。Nathan 2017 は推定 20 s 超、未公表 Trackman では約 30 s と説明し、2026 calculator は `tau` を可変化。現行の固定値は速すぎる可能性が高い |
| 地面反発 | `vz=-0.55*vz`, `vx/vy *= .78` | normal / tangent を一律に処理 | **uncalibrated**。grass、dirt、warning track が同じ。入射角・速度・回転・湿りを捨てる |
| 転がり減速 | speed から `(5 + .055*speed)*dt` | 加速度としての単位は成立 | **uncalibrated**。surface ID なし、滑り→転がり遷移や spin-ground 摩擦なし |
| outfield wall | radial normal を 0.35 で反射、`vz *= .55` | radial 成分の反発の考え方はある | **uncalibrated**。wall face の tangent である vertical 成分も別途潰し、壁材・角・上端面・foul fence を表さない |
| backstop | radial 0.5、`vz *= .6`、`R>62 && y<8 && z<24` | 描画メッシュより粗い半径条件 | **uncalibrated / geometry mismatch**。net と solid wall を区別せず、打球・送球の rule outcome も同一 |
| throw speed | `(106 + 58*(arm-.55))*eff` ft/s | arm=1 で最大約 90 mph、arm=.8 は約 82 mph。値域は表面的には妥当 | **uncalibrated**。position / release / crow hop / fatigue / action type の観測データに結び付かない |
| throw offset | distance-linear Gaussian sigma | 距離に対する広がりのモデル | **uncalibrated**。release posture、target height、catch type、arm action と独立 |
| throw angle | 抵抗付き `throwPassHeight` を二分探索 | target height 5 ft を通す角を選ぶので発射自体は改善済み | **partially sound**。一律 5 ft、回転ゼロ、風ゼロ、同じ `ball` object を再利用 |
| throw ETA | `d/(v0*cos(theta)) + throwHopTime` | 初速で割る近似。実際の水平抗力を積分しない | **incorrectly coupled**。`launchThrow` は抵抗付きで飛ぶため、意思決定 ETA と目に見える到着時刻がずれる |

### 特に重要な送球矛盾

`throwAngle` は `throwPassHeight` で抗力を 1/240 s ずつ積分するが、`throwFlightTime` は `d / (v0 cos(theta))` である。抗力がある限り、実際の水平速度は低下するので後者は通常短すぎる。さらに `throwHopTime` の 0 / 0.15 / 0.35 s は発射準備を flight time に混ぜている。この二つは、ThrowDecision が早すぎる到着を前提にしても、画面の球だけは遅れて届く原因になる。

### 積分上の注意

- `updateFlight`、予測、HR distance、live throw の主要経路は 1/240 s で動くため、その部分の刻みは良い。
- `S.phase==='play'` の loose ball は `stepBall(ball, dt)` を frame dt で呼ぶ。反発・転がり・ネット接触が frame rate に依存する経路が残る。
- 現行の Euler は v を先に更新して position を更新する semi-implicit Euler である。v1 では同じ fixed accumulator を全経路で使う。RK4 は数値参照・offline calibration には有用だが、60 fps WebGL の v1 に必須ではない。

## 4. Findings

1. **共有するのは球の位置・速度・重力・抗力であり、打球の回転と送球の発射プロファイルではない。** `launchThrow` が `bs/ss=0` にする判断は正しい方向だが、同じ mutable `ball` を再利用しているため、起源・接触時特徴・physical class の履歴を失う。
2. **現行 `battedType` は telemetry にだけ登場し、実際には一度も代入されない。** `classifyCaughtBall` は捕球後に `flyKind` を決め、`landed` / `maxZ` / LA を見ている。これは表示の改善にはなるが、打球の物理分類を接触時から保存する要件を満たしていない。
3. **空力は「ある」だけでは較正ではない。** `DRAG` は次元的には正しいが、`bs`,`ss` は無次元の演出量で、Nathan/Lyu の rpm、spin axis、spin factor と対応しない。係数を微調整しても EV/LA/spray 分布を検証しない限り、局所的に見えるだけになる。
4. **単一 surface は実測と反する。** Pennbounce は natural grass と skinned infield に一貫した pace 差を報告する。描画には dirt / warning track が既にあるのに、物理は全地点で同じ ground response である。
5. **衝突と野球裁定を混ぜると球場差を増やせない。** MLB ground rules は field-facing net と out-of-play screen の結果を区別する。物理側は `collision event` を出し、PlayLifecycle 側が surface の rule flag に従って live/dead/award を解決すべきである。
6. **dgrifka は参考実装であり、ゲーム物理の答えではない。** 同 repo の強みは「入力 feature と geometry を分離し、数値ゴールデンと season-forward calibration を持つ」こと。fielding、bounce、wall rebound、throw、camera は扱わない。また license 未宣言なので code copy は不可。
7. **Magnus を一律に強くする提案は退ける。** dgrifka が outcome model で lift off を選んだことと、Nathan/Lyu が飛球運動に spin を測ることは矛盾しない。前者は分類性能、後者は物理軌跡。ゲームでは spin vector を持てない間、Magnus は「小さな視覚補正」にせず、明示的な calibration preset で only-batted-ball に限定する。
8. **camera はプレイ可能性に直接影響するが、現行は ball-only である。** `camTargets` はボールの距離・左右・高さだけで `eye/at` を決め、送球先、wall face、cover fielder、画面外へ出る ball を考慮しない。物理を改善しても long throw / wall rebound が見えなければ体感品質は上がらない。

## 5. Mapping to current game code

| 現行部分 | 置換/補強する責務 | v1 で変えないこと |
|---|---|---|
| `stepBall` | `integrateBall(state, h)` に物理を集約。flight kind / surface / environment を入力にする | RunnerIntent、FieldingAssignment の ownership |
| `startFlight` | immutable `BallSpec` を接触時に作り、`physicalClass` と launch telemetry を固定 | 現行の batting input / hit outcome の意味 |
| `classifyCaughtBall` | 表示名は `BallSpec.physicalClass` を読む。catch feasibility / `landed` から型を作り直さない | 捕球可否とアウト判定は Catch/PlayLifecycle 側 |
| `launchThrow`, `throwAngle`, `throwFlightTime` | `ThrowReleaseProfile` と `simulateToTarget` を共有。ETA は実発射と同じ fixed-step crossing time | ThrowDecision / DefenseActionPolicy の候補比較という境界 |
| `stepFlight` wall/backstop branches | swept collision が `surfaceHit` event を返す。役割変更は今の wall-handoff を継続 | FieldingAssignment の handoff 方針 |
| `buildThrow/updateThrow` | 実プレーの live physics と、確定後の presentation trail を明示分離 | 結果表示タイミングの改善は別作業 |
| `camTargets` | camera target を `ball + relevant receiver/base + collision zone` の composition にする | 投打 duel camera の操作感 |

## 6. Copy / adapt / calibration-only / concept-only / reject

| 提案 / source | 区分 | 理由 |
|---|---|---|
| Nathan の vector drag/Magnus equations | **adapt** | 物理式は実装可能だが、現行座標・WebGL・ゲームの spin input に合わせて独自実装する |
| Nathan 2017 coefficient set | **calibration-only** | 90+ mph、20--35 degree の Tropicana 2016 fly balls に適合。grounder/throw/壁反射へ流用禁止 |
| Nathan 2026 configurable spin `tau` | **concept-only** | 可変化の設計は採るが、default 値は現行 game data で再較正する |
| Lyu の seam / spin-factor dependency | **concept-only** | 現行に seam orientation / active spin input がない。複雑な seam model は v1 外 |
| Pennbounce の surface-separated material | **adapt** | grass / dirt / track を別 material parameter にする設計を採る。数値は実測 fixture ができてから |
| MLB net/screen rule separation | **adapt** | `collision event` と `rule resolution` の分離だけを採る |
| Savant CSV EV/LA/distance fields | **calibration-only** | raw の同梱/再配布はしない。集計分布と query manifest のみ |
| dgrifka `nathan_spin`, `spin_aware_carry`, ray cast source code | **reject** | repository license 未宣言。Python / outcome-model architecture も単一 HTML に合わない |
| dgrifka の feature contract / pinned numerical tests / wall-distance concept | **adapt** | code は写さず、入力・出力・golden test の discipline を採る |
| bevy-rapier-baseball-flight code | **reject** | permissive crate 表記はあるが、Rust alpha / Rapier / unresolved seam bug。単一 HTML に依存を入れる利益がない |
| bevy の state vs external-force boundary | **concept-only** | `BallState` を renderer / rule state から分ける設計の参考 |
| realtime ML physics | **reject** | 説明不能、決定性テストを弱める。offline fitting / adversarial test generation のみ許可 |

## 7. Coefficient source / uncalibrated flag table

| Parameter group | 現在値 | 根拠 | v1 の処置 |
|---|---:|---|---|
| `g` | 32.2 ft/s2 | 標準物理 | 維持 |
| `DRAG` | 0.0013 ft-1 | source link なし | `K * CD(spin, airDensity)` に変更可能な preset。現行値を legacy preset として比較保存 |
| `LIFT`, `SIDE` | 0.00005 / 0.00019 ft-1 | コメント上の見た目目標のみ | rpm + spin-axis を持てるまで arbitrary spin multiplier を廃止。unknown spin は calibrated mean / variance を明示 |
| spin decay | 0.88 per second | source link なし | `tauSec` を config 化。default 採用は golden/distribution gate 後 |
| ground restitution / tangent | 0.55 / 0.78 | source link なし | `material.normalRestitution(vn,angle)`, `tangentRetention(vt,spin)` に分離。最初は値を **unknown** として fixture 収集 |
| roll decel | 5 + .055v | source link なし | surface-dependent rolling resistance。草と土の順位だけ先に contract 化 |
| wall / net | .35/.55, .5/.6 | source link なし | material + geometry + rule flag に分ける。top / face / net を別 event |
| throw strength / error | local formulas | source link なし | position/action/distance bucket の observed release and arrival distribution に offline fitting |
| throw arc / hop | distance threshold | source link なし | `releasePrepSec` と physical flight crossing を分離。固定 90/150 ft branch は削除候補 |

## 8. Existing heuristics that can be removed or replaced

1. `bs=(LA+6)/30` と `ss=-spray/38` の「角度をそのまま回転に見立てる」近似。
2. `0.88^dt` 固定 spin decay。
3. 全 field に共通の `0.55/.78` bounce と `5+.055v` roll deceleration。
4. radial circle + `z>9.4` だけの outfield wall。wall face / top / foul fence / backstop net を一段階に潰す近似。
5. `throwFlightTime=d/(v0 cos theta)+hop`。`hop` を空中時間へ混ぜる近似。
6. `battedType` を empty のまま、捕球後に `flyKind` を後付けする表示分類。
7. `buildThrow/updateThrow` の結果表示用軌道を、live physics の根拠に使う余地。presentation-only と明記する。

これらを一括で消すのではなく、legacy preset と同じ fixture を走らせ、各置換ごとに distribution gate を通す。

## 9. Proposed target architecture

```text
contact / release
  -> BallSpec (immutable: origin, EV/LA/spray or release profile,
               spin availability, physicalClass, environment, physicsVersion)
  -> BallState (mutable: x/y/z, v, omega, phase, lastSurface, time)
  -> fixed accumulator (all live paths use h=1/240)
       -> force model (gravity + drag + permitted Magnus)
       -> swept collision (ground / wall face / wall top / foul fence / net)
       -> CollisionEvent
  -> PlayLifecycle / FieldingAssignment / ThrowDecision consume event or ETA
  -> renderer / camera consume sampled state and relevant target
```

### Data contracts

`BallSpec` must include at minimum:

- `origin: 'batted' | 'throw' | 'loose'`
- `physicalClass: 'ground_ball' | 'line_drive' | 'fly_ball' | 'popup'` computed once from the contact snapshot and never from `canCatchAir`, `landed`, or later catch result
- `contact: { exitMph, launchDeg, sprayDeg, heightFt }` for a batted ball
- `release: { sourceHeightFt, targetHeightFt, speedFtPerSec, prepSec, intent }` for a throw
- `spin: { vectorRadPerSec | null, source: observed|calibratedMean|none }`
- `environment: { airDensity, windVector, surfaceMapVersion }`
- `physicsVersion` and deterministic seed for any calibrated variance.

The class threshold can initially mirror the independently inspected dgrifka convention (`<10 / <25 / <50 / else`) only as an **uncalibrated presentation/telemetry config**. It must not change runner/fielding rules until a Statcast calibration report says otherwise.

### Separation of responsibilities

- Physics never selects a throw target, awards bases, or switches a fielder.
- `ThrowDecision` asks the same integrator for a target-crossing time; it does not use a shorter formula.
- `PlayLifecycle` interprets `CollisionEvent` under surface rule flags. This preserves the current ownership boundaries.
- For H2, the full deterministic prediction remains debug/reference data only. A fielder controller may receive current/short-history ball observations and an uncertainty region, not an exact future landing coordinate.
- For H4, this confirms the separation of intelligence and body/physical execution. No giant catch/throw/ball scenario tree is proposed.

## 10. Minimal implementation v1

1. Add pure, side-effect-free helpers in the single file: `makeBattedBallSpec`, `makeThrowBallSpec`, `integrateBallFixed`, `timeToTargetCrossing`, `classifyPhysicalBattedBall`.
2. At `startFlight`, create and record `BallSpec`; at `launchThrow`, make a new throw spec instead of mutating/erasing the batted-ball history. Preserve the original batted spec in the play record.
3. Route every live ball path, including loose ball, through the same fixed accumulator. Keep legacy coefficients as `physicsVersion='legacy-b29'` for A/B comparison.
4. Replace only `throwFlightTime` with the crossing time of the same drag integrator already used by `launchThrow`; split `releasePrepSec` from flight. Do not alter ThrowDecision utility weights in this change.
5. Add a small `surfaceAt(x,y)` matching existing visual dirt circle, base paths, warning track, grass, wall and backstop geometry. Initially it may retain legacy numbers, but material identity must be recorded per collision.
6. Add collision event types `ground`, `wall-face`, `wall-top`, `foul-fence`, `backstop-net`; map them to the current rule behavior without changing scoring. The special ground rules remain a later park configuration step.
7. Add ball + receiver/base framing state to `camTargets` only after screen-space contracts pass. Do not change duel camera in v1.

Non-goal: no Rapier dependency, no imported Python, no model inference in the frame loop, no new baseball outcome classifier, no modification in this research branch.

## 11. Distribution-based validation by EV / LA / spray

### Input and buckets

Use one frozen official Statcast regular-season query, starting with one season and excluding rows without `launch_speed`, `launch_angle`, `hit_distance`, `hc_x`, or `hc_y`. Record query manifest before download. Analyse only bins with at least 100 reference balls:

- EV mph: `[50,70)`, `[70,85)`, `[85,95)`, `[95,105)`, `[105,120]`
- LA deg: `[-30,0)`, `[0,10)`, `[10,20)`, `[20,30)`, `[30,40)`, `[40,55]`
- raw spray deg from `hc_x/hc_y`: `[-45,-15)`, `[-15,15]`, `(15,45]`

### Gates

| Measure | Reference | Concrete gate |
|---|---|---|
| landing distance | Savant `hit_distance` per eligible EV/LA/spray cell | simulated vs reference median within 12 ft; P10 and P90 each within 20 ft; report all failed cells, not only aggregate |
| HR/wall boundary | same cells plus real park wall geometry where lawful source is available | no single global threshold: report calibration curve of `overFenceMargin` vs actual HR. Do not tune a hidden HR multiplier |
| apex and hang time | Nathan numerical reference on a deterministic matrix: EV 80/100/110, LA 5/15/25/35/45, spray -30/0/+30, fixed environment | engine vs reference numerical error <= 0.25 ft apex and <= 0.01 s hang time. This proves integration, not MLB realism |
| landing direction | same deterministic matrix | radial landing error <= 1 ft and curvature sign matches configured sidespin sign |
| grass/dirt/warning bounce | controlled fixture matrix: impact speed 30/50/70/90 mph, incidence 5/20/45 deg, 20 trials per condition per surface | after empirical collection, engine median exit-speed ratio within 0.05 and P90 exit-angle error within 5 deg of the measured fixture. Before collection the only valid gate is `grass pace < dirt pace`; invented numeric coefficients fail review |
| wall/net outcome | at least 50 labelled, legal reference clips or instrumented fixtures divided face/top/net | event label match 100%; after velocity labels exist, median `vout/vin` within 0.10 and median deflection within 10 deg. Until then, preserve `UNKNOWN`, not guessed coefficients |

**Negative finding:** standard Savant CSV documents projected hit distance and contact coordinates but not a full batted trajectory, apex, hang time, ground bounce speed/angle, or wall impact state. Therefore only distance can receive an official large-sample external gate immediately. Apex/hang are numerical-reference gates until a lawful trajectory source is acquired; this must be reported as a limitation, never as “validated MLB realism.”

## 12. Throw flight-time / height / accuracy validation

| Class | Distance bucket | Metrics and gate |
|---|---|---|
| short receive / relay | 30--70 ft | crossing time, target height, lateral miss |
| standard infield | 70--100 ft | same, plus 4.5--6.5 ft target-height median for intended chest throws |
| double-play pivot | 70--95 ft | same, with pivot `releasePrepSec` measured separately from airborne time |
| long outfield / cutoff | 170--260 ft | flight time, apex, target height, relay decision boundary |

Direct numeric contracts:

1. `throwFlightTime` and the emitted ball state must agree to one `PHYS_H` at target crossing for every fixture.
2. A line throw that is physically reachable must not receive a `throwHopTime` invisible delay; the delay belongs to release prep and is recorded separately.
3. A direct long throw that requires an unsafe / high arc must have a deterministic `lowLineReachable=false`, allowing the existing policy to choose a cutoff without a special-case distance branch.
4. `throwOffset` seeds must reproduce exact errors. Calibrate its distribution offline with at least 30 high-frame reference throws per class before asserting real-world sigma; target gate is median time error <=0.06 s and P90 <=0.12 s against that labelled fixture.

No public source inspected here provides a representative, licensed full-flight dataset of position-specific game throws. Accordingly, current throw speed/accuracy values remain **NOT_PUBLICLY_CALIBRATED**, not “validated.”

## 13. Direct behavioral contract tests

1. **Contact class persistence:** start a low line drive, make it uncatchable, bounce it, wall-hit it, then catch it later; `BallSpec.physicalClass` and recording `bt` remain line drive throughout.
2. **No catchability classification leak:** set same EV/LA/spray with different fielder speeds; class is identical even though `canCatchAir` differs.
3. **Fixed-step invariance:** feed identical real-time deltas summing to 3 s as 30 fps, 60 fps, and jittered frames; final x/y/z/v, collision sequence, landing and class match within one physics step.
4. **Nathan numeric golden:** the documented 103 mph, 28 degree, center, 70 F reference preset produces 414.877736 ft within the declared numerical tolerance under matching launch height / coefficient version.
5. **Wall taxonomy:** face impact below top = `wall-face`; crossing above top while fair and airborne = HR; top impact and net impact are distinct events. No wall handoff may occur before the collision event.
6. **Surface identity:** an identical low grounder must record grass / dirt / warning-track material correctly from the existing geometry; it may not use one unlabelled ground branch.
7. **Throw closure:** target crossing from `launchThrow` equals ETA used by `ThrowDecision` to one `PHYS_H`.
8. **Camera visibility:** on required long-throw/wall fixtures, projected ball and relevant receiver/base stay inside a 5--95% safe rectangle for at least 95% of active frames, unless a documented cinematic cut intentionally owns the exception.

## 14. Mutation tests

1. Set drag to zero or flip its sign; Nathan golden and monotonic distance tests must fail.
2. Replace physical spin vector with current LA/spray scalar without marking it calibrated; spin-source/schema test must fail.
3. Delete `BallSpec.physicalClass` and derive it from `landed`; contact persistence / catchability-leak tests must fail.
4. Remove the fixed accumulator from loose-ball play; 30/60/jitter invariance must fail.
5. Force grass and dirt to the same material id; surface identity/ranking test must fail.
6. Change wall normal reflection sign or remove swept collision; wall taxonomy must fail.
7. Restore `d/(v0*cos(theta))` as throw ETA; target-crossing closure must fail.
8. Remove the receiver/base from field-camera composition; safe-rectangle test must fail.

## 15. Extensions to recording corpus / 1000-route / 50-game validation

- **Recording corpus:** add `physicsVersion`, `origin`, `physicalClass`, launch/release fields, material/collision event, predicted vs actual target-crossing time, apex/hang/landing. Existing recordings without these fields are legacy and must not be silently scored as v1 passes.
- **Current 138-case corpus:** rerun without changing acceptance semantics. Add the two class-persistence cases, three wall/net cases, grass/dirt cases, and four throw-distance cases as named fixtures.
- **1000-route:** retain route ratio/nontermination checks, but log and reject nonfinite ball state, more than one collision event in one fixed substep, impossible negative time, target-crossing ETA mismatch > one `PHYS_H`, and primary ownership based on a stale pre-collision trajectory.
- **50 full games:** retain completion check and add distributions for EV/LA/spray bucket counts, landing distance, hang time, apex, bounce material, wall outcome, throw time/height. Compare each seed set to its frozen baseline; do not hide failed buckets inside an overall mean.
- **Owner visual acceptance:** keep separate. A distribution pass cannot prove camera readability, wall feel, or animation quality.

## 16. Licensing / commercial-use constraints

| Asset / source | Commercial-use result |
|---|---|
| Nathan calculator / website | No explicit permissive code/data license found; site carries all-rights wording. Learn equations and calibrate independently; do not ship spreadsheet/content/code. |
| Nathan, Lyu, Brosnan papers | Use factual findings/equations with attribution; do not copy figures/tables/text or assume a software-data license. |
| Savant CSV / MLB rules | Official reference/calibration input only until the relevant terms and permitted storage/republication are reviewed. Store query manifest and derived aggregates, not raw redistributed data. |
| dgrifka repository | Public visibility is not a license. GitHub API reports no license and no root LICENSE was found; direct code copying is prohibited for this work. |
| bevy-rapier-baseball-flight crate | `Cargo.toml` declares MIT OR Apache-2.0, but no code import is justified. If any code were ever reused, preserve the actual license/notice and separately audit dependencies/assets. |

## 17. Game-wide high-impact quality opportunities outside defense

1. **Contact distribution calibration:** `evalContact` currently generates EV / LA / spray with local tanh/Gaussian formulae. Keep player-control feel, but offline-fit its output distributions to the same EV/LA/spray buckets. This improves hitting, HR distance, fielding workload and camera in one place.
2. **Pitch flight is not physical:** `pitchPos` is a hand-authored quadratic curve, not the audited ball integrator. It should not be folded into D v1, but Agent A's motion work should be paired later with a separate pitch-trajectory contract so visual release and ball path agree.
3. **Park geometry:** current `fenceDist(a)` is a symmetric 330/400 ft approximation and 9.4 ft uniform wall. A ray-cast `parkSpec` can later give wall distance, height, foul-fence and top-face semantics without a park-specific code tree.
4. **Camera/replay telemetry:** expose ball height, hang time, landing marker and planned cutoff only in debug/replay tools first. This raises diagnosability without giving player/AI hidden future knowledge during play.
5. **Weather:** air density/wind belongs in a park/environment configuration, not random per-frame perturbation. Leave disabled until an owner-approved game mode and calibration source exist.

## 18. Risks, negative findings, failed approaches, unresolved questions

- **No shortcut dataset:** public CSV fields are enough for distance distributions, not for full trajectories, bounce, wall impact or game throws. It would be misleading to set “real” apex/bounce/throw thresholds from visual intuition.
- **Coefficient-domain risk:** Nathan 2017 fitted a restricted fly-ball domain, so using it for grounders/throws without a boundary is a false precision error.
- **Spin observability risk:** current contact produces LA/spray but not batted spin axis/rpm. A full seam-shifted wake or measured Magnus model therefore has no valid input. Bevy's unresolved seam-orientation issue reinforces rejection of that route.
- **Collision tunneling risk:** fixed 1/240 reduces it but a high-speed ball can still cross a thin geometry. Swept collision against the known surface is required before arbitrary smaller steps.
- **Rule coverage risk:** MLB rules are park-specific. Implement only the generic event/rule architecture in v1; no claim of complete MLB ground-rule simulation.
- **AI information leak risk:** an exact physical future path is useful for tests but cannot be passed intact to fielder policy. H2 remains a constraint for Agent B's controller design.
- **No source supports realtime ML:** learnt physics should be restricted to offline parameter fitting, reference-distribution comparison and adversarial fixture generation. Realtime opaque inference is rejected.

## 19. Explicit hypothesis verdicts

| Hypothesis | Verdict | D-scope consequence |
|---|---|---|
| H6: validate ball physics by EV/LA/spray distributions | **Confirm, with a constraint** | Distance receives an official external distribution gate now. Apex/hang/bounce/wall require named numerical or empirical fixtures; do not call them externally validated before data exists. |
| H5: ML/RL primarily research/test rather than opaque core logic | **Confirm** | Use offline calibration / adversarial generation only. Reject realtime ML flight or collision logic. |
| H2: observation-driven outfield pursuit | **Implication only** | Physics must supply deterministic actual state and debug trajectory, but fielders only get allowed observations/uncertainty, not a durable exact landing point. |
| H4: decision and body execution stay separate | **Confirm** | Ball physics returns state/events/ETA; FieldingAssignment, ThrowDecision and PlayLifecycle retain decisions and rule ownership. |

## Implementation readiness and blocker

The architecture and direct/mutation contracts are ready to inform an integrated design; no gameplay code is proposed in this branch. The blocker to numerical realism claims is not coding: it is the absence of a documented, lawful reference fixture for bounce/wall/throw trajectories and the absence of batted spin input. Until those are collected under a manifest, the only defensible values there are `unknown` / `NOT_PUBLICLY_CALIBRATED`.
