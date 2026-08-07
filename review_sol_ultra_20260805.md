# 野球ゲーム全体レビュー（Sol Ultra 厳格版）

- 開始日: 2026-08-05
- 最上位目的: **オーナーが1セッション遊び、バグの指摘がゼロであること。リアルさはその次。**
- 現行対象: `baseball3d.html` BUILD `b0805-06`
- 現行対象 SHA-256: `2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183`
- 既存ハーネス SHA-256: `8C4EF06D934C68A4993F27B3139AF1EEF317BA237A00287A05466CCA5EDE85F8`
- 保護対象: `baseball3d.html` と `_test_harness_20260804.js` は読取専用として扱う。検査用コピーは `_tmp_` 接頭辞だけを使い、終了時に削除する。
- 作業面: 判断・全体管理は Codex Desktop、再現・抽出・統計・ハッシュ検証は反復可能な Terminal 実行を正本とする。

## 開始前 Task Contract

1. **最終目的**: 静的な「直って見える」を排し、実行で覆せる欠陥と検査の盲点を第三者が再検証できる状態にする。
2. **範囲**: 工程0〜5を指定順で全量実施する。既存2レビューは主張一覧としてのみ使い、独立実行なしに転記・採用しない。実装・既存ハーネスは変更しない。
3. **読む正本**: `_sol_ultra_task_full_review_20260805.md`、現行・修正前の実装、`OWNER_ISSUE_MASTER_20260805.md`、`REVIEW_SYNTHESIS_20260805.md`、既存2レビュー、既存ハーネス。コードの状態判定は必ず現行実行を優先する。
4. **成果物**: 本ファイルと `review_sol_ultra_repro_20260805.js`。所見は1件ずつ両方へ追記する。
5. **品質基準**: 工程0は旧版3 FAIL・現行3 PASSかつ全試行成立。工程1はコード未読で6仕様を固定。工程2は全経路を件数照合。工程3は指定全件＋無作為20件＋修理9件各2隣接以上。工程4は各条件1000試行以上。工程5は宣言済み10変異を全実測する。
6. **検証方法**: 各工程の完了宣言を次工程より先に保存する。実行ログ、再現関数名、引用行、行番号を相互照合する。最後に保護対象のハッシュ不変、一時物ゼロ、JS構文、所見必須欄、未実施項目を機械検査する。
7. **並行可否**: 工程内の独立確認だけを xhigh 補助担当へ分担する。工程をまたぐ成果物の確定は並行化せず、本ファイルへ前工程の完了宣言を保存後に開始する。

## 工程0: 検出力の自己校正

### 検査手順（旧版へ適用する前に固定）

共通手順: 各ビルドの単一HTMLからゲーム本体の JavaScript を抽出し、新しい Node VM 文脈へ読み込む。DOM・Canvas・WebGL・音声・時間関数は無描画スタブにするが、`update()`、`startFlight()`、`beginThrowPhase()`、`concludePlay()` とゲーム状態は実装本体を使う。各ビルドは別文脈で実行し、同じ試験コード・同じ入力・同じ `1/60` 秒刻みを適用する。単に例外が出なかった場合や試行数0の場合は PASS にしない。

| 校正ID | 固定する場面と操作 | FAIL の機械判定 | PASS の機械判定 | 成立条件 |
|---|---|---|---|---|
| CAL-1 捕球時反転 | 0死・二塁走者・`exit=92, la=-3, spray=10, q=0.7` のゴロを開始し、キー無入力で260フレーム以内を追跡 | 一度 `goal>=3` になった二塁走者の `goal` が後フレームで減少した試行が1件以上 | 成立した全試行で減少0件 | 二塁走者を生成できた `trials>0` |
| CAL-2 未到達得点 | 0死・三塁走者で送球開始まで実走後、`p=3.70, goal=4, autoGoal=4, playClock=11.85` とし、以後 `p<=3.90` に固定 | 本塁未到達なのに総得点が1点以上増える、または三塁へ戻らない試行が1件以上 | 全成立試行で得点増0かつ全員三塁へ戻る | `throwPlay` 成立後に配置できた `trials>0` |
| CAL-3 塁間12秒終了 | 0死・一塁走者のゴロで送球開始まで実走後、`playClock=11.7`、走者を `p=1.5, goal=2, autoGoal=2` に固定し、`concludePlay` 呼出時の状態を記録 | 塁間のまま `playClock<=12.6` で `concludePlay` が1回以上呼ばれる | その早期呼出しが0件 | `throwPlay` 成立かつ走者を捕捉した `trials>0`; 呼出し未観測は時刻上限と状態を別記 |

合格条件は、**同一試験コード**で修正前 `b0804-33` が CAL-1〜3すべて FAIL、現行 `b0805-06` がすべて PASS になり、各試験の `trials>0` と生データが保存されること。1件でも旧版を検出できなければ本審査を停止する。

### 対象スナップショットの固定

校正の初回実行中、作業開始時の `b0805-06` が外部コミットによりライブ上で `b0805-08` へ更新された。異なる版の結果を混ぜないため初回ライブ実行は工程判定から除外し、依頼で指定された `b0805-06` を commit `2c9bd8012cd23702ca74bf656adf09068ca067de` から `_tmp_target_b0805-06.html` へ復元した。復元 SHA-256 は開始時に記録した `2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183` と完全一致した。以後の全工程はこの固定版を対象にし、ライブ `b0805-08` を混ぜない。

### 実行結果

- 実行環境: Node `v24.14.0`、DOM/Canvas/WebGL無描画スタブ、`update(1/60)`。
- 乱数: ハーネス実行全体で `Math.random=()=>0.5` に固定し、終了時に復元。
- 再現コマンド: `node review_sol_ultra_repro_20260805.js --calibrate`
- 再現コード: `calibrateDetectionPower()`、`runCalibrationOnHtml()`、`runGoalTransitionTrace()`。

| 校正ID | 修正前 `b0804-33` | 固定対象 `b0805-06` | 判定 |
|---|---|---|---|
| CAL-1 捕球時反転 | 12/12で反転、FAIL。自然遷移では frame 95、`phase=throwing`、`throwStage=transfer`、`p=2.443` で `goal 3→2` | 0/12、PASS。逐次プローブの反転イベント0、最終 `p=3, goal=3` | 検出力あり |
| CAL-2 未到達得点 | 8試行成立、7件が+1点・三塁再配置なし、1件は三塁再配置、総合FAIL | 8試行成立、誤得点0/8・三塁再配置8/8、PASS | 検出力あり |
| CAL-3 塁間12秒終了 | 6/6で塁間のまま `playClock=12.00` に `concludePlay`、FAIL | 12秒台打切り0/6、観測呼出しは全て `playClock=15.07` かつ `mid=false`、PASS | 検出力あり |

CAL-2は、`throwPlay` が成立した後にだけ `S.playClock=11.85` を差し込み、走者を毎フレーム `p<=3.90` に固定した。CAL-3は `concludePlay` を包み、呼び出された瞬間の時計と塁間状態を記録した。この2条件により「時間切れ分岐へ未到達なのにPASS」「終了を観測する前に打切り」という偽PASSを排除した。

独立確認では、別の最小状態注入を3回反復し、旧版だけが `goal 3→2`、未到達 `+1点`、`playClock=12.0067`・`p=1.5` での終了を再現した。固定対象は順に `goal 3→3`、`+0点`・三塁配置、12秒経過後も継続した。

検出限界: DOM/WebGL/描画/実時間は無描画スタブのため、ここで証明したのはゲーム状態、関数呼出順、得点、塁配置だけである。描画位置、実ブラウザの入力イベント順、GPU、可変フレーム時間は工程0では未検証。

### 工程0の新規所見

固定対象 `b0805-06` に対する新規欠陥所見は0件。工程0は所見探索ではなく、既知欠陥を旧版で落とせることを測るゲートとして実施した。

## 工程0完了宣言 — 検出力の自己校正 合格

同一の実行検査で、修正前 `b0804-33` は CAL-1〜3がすべて `trials>0` のFAIL、固定対象 `b0805-06` はすべて `trials>0` のPASSとなった。生JSONと逐次トレースは `review_sol_ultra_repro_20260805.js` から再生成できる。よって本審査へ進む検出力ゲートを満たした。

## 工程1: 白紙の期待仕様

この仕様は、工程0と並行して隔離した xhigh 担当が、`baseball3d.html`、ハーネス、既存レビューを一切読まず、2026 Official Baseball Rulesだけから作成した。工程0が先にコード実行を要求する順序矛盾を解消するため、白紙仕様の作成者をコード未読の別文脈へ隔離した。以下を比較前の固定仕様とし、後工程でコードとの差が出ても書き換えない。

共通記号: `L`=ボール生存(1/0)、`B_r`=走者が権利ある塁に接触(1/0)、`C`=野手が球を確実に保持(1/0)、`F`=フォース状態(1/0)、`O`=アウト数、`t_x`=事象時刻。

### ① 挟殺

1. 開始条件は `L=1 ∧ B_r=0 ∧ tagAttempt=1`。単なる離塁だけでは挟殺開始としない。
2. 走者は前進・帰塁を何回でも切り替えられるが、タッグ企図時の走路から逃避目的で `>3ft` 外れればアウト。
3. 通常の成立条件は `L=1 ∧ B_r=0 ∧ legalTag=1 ∧ C=1`。直後の落球で支配を示せなければ `legalTag=0`。
4. `F=1` の走者だけは、野手が球を保持して到達義務のある塁に触れてもアウト。後続走者のアウト等で `F=0` になれば本人へのタッグが必要。
5. 同じ塁に2走者が触れた場合は原則として後位走者をタッグしてアウト。フォースで塁の権利が移った場合だけ先位走者がアウト対象。
6. 崩壊条件は `runnerOut=1`、`runnerSafelyOnEitherBase=1`、規則上の `L=0` のいずれか。経過秒数だけでは崩壊しない。
7. 球を持たない野手が対象走者の走路を塞げば走塁妨害。対象へプレー中なら直ちに死球とし最低1個先の塁を保障。
8. 決着時 `O<3` なら球は原則生存し、他走者の進塁・帰塁・別挟殺を続ける。対象走者だけの決着で全員停止させない。
9. `O=3` なら得点の前後関係と許されるアピールを確定後に攻守交代する。

### ② けん制

1. 投球動作前かつ `L=1` なら、投手は占有塁、または走者が進塁を企図した無人塁へ送球できる。
2. 投手板に触れている場合は対象塁への直接の踏み出しが送球より先、すなわち `t_step<t_throw`。満たさなければボーク。
3. 投手板上から一塁・三塁への偽投は不可、二塁への偽投は可。無人塁への送球・偽投は現実のプレー目的がある場合だけ可。
4. 軸足を投手板の後方へ外した後は内野手扱いとなり、どの塁にも送球でき、悪送球も通常の生きた内野送球として扱う。
5. `receiverAtCatchPoint(t_ball)=0` なら捕球・タッグ・アウトを生成せず、球をそのまま通過させる。
6. カバー野手は送球時点で塁上にいる必要はないが、球到達時に捕球点へいること `receiverAtCatchPoint(t_ball)=1` が必要。
7. 通常のけん制は `F=0` なので、塁を踏むだけではアウトにせず `B_r=0 ∧ legalTag=1` を要求する。
8. ボークは死球扱いを基本として全走者を1個進める。送球後に全走者が1個以上進んだ等の規則上の例外は別判定。
9. カバー不在、帰塁成功、悪送球のいずれでも、他走者が動ける間はプレーを閉じない。

### ③ 盗塁

1. 開始条件は `L=1 ∧ runnerChoosesAdvance=1`。投球リリース後という条件や秒数閾値は置かない。
2. 投手の投球義務違反や不正な欺瞞はボーク処理し、盗塁の成否を通常タッグだけで裁かない。
3. 走者は次塁到達前なら進塁継続・帰塁を選べる。捕手・野手の捕球だけを理由に目標塁を自動反転させない。
4. `F=0` の盗塁では塁を踏むだけではアウトにせず、`legalTag=1` を要求する。
5. `t_tag<t_baseTouch` はアウト、`t_baseTouch<t_tag` はセーフ。同時刻は固定した事象順または審判判定で一意化する。
6. 一度触れてもオーバースライドで `B_r=0` となり、その後タッグされればアウト。塁との接触維持を省略しない。
7. 捕球されたファウルチップは `L=1` なので盗塁継続。捕球されない通常ファウルは `L=0` で元塁へ無条件帰塁。
8. 帰塁中も `L=1 ∧ B_r=0` ならタッグアウト対象。死球・ボーク等の保障帰塁中はアウト対象外。
9. 盗塁走者以外も独立して進退を続け、1人の帰塁・アウトで全走者を停止しない。

### ④ タッチアップ

1. 対象はフェアまたはファウルの飛球が正式捕球された場合。ファウルチップにはタッチアップ義務なし。
2. 合法離塁の時刻条件は `t_depart>=t_firstFielderTouch`。完全捕球確定時刻まで待つ必要はない。
3. `t_depart<t_firstFielderTouch` で最終的に捕球された場合は元塁への再接触が必要。
4. 修正条件は `t_retouch>=t_firstFielderTouch` かつ守備のアピール成立前。通過済みの塁は逆順に踏み直す。
5. 早期離塁は自動アウトにせず、捕球後に走者本人または元塁を球保持野手が触れて明確にアピールした時だけアウト。
6. アピール期限は次の投球・プレー・プレー企図より前。半回終了場面では投手と全内野手がフェア地域を離れる前。
7. 飛球が落ちて正式捕球でなければタッチアップ義務は `0`。走者は進塁・帰塁判断を続ける。
8. 捕球による打者アウト後も通常は `L=1`。全走者の進退・アピール可能性が消えるまでプレーを閉じない。
9. 各走者を個別判定し、1走者の合法離塁・帰塁・アピールアウトを他走者へ一括適用しない。

### ⑤ 得点の確定

1. 走者が一塁→二塁→三塁→本塁を合法順に触れた時だけ得点候補。`homeTouched=0` の近接・通過・時間切れは0点。
2. 通常のタイムプレーは `t_home<t_thirdOut` だけ得点、`t_home>t_thirdOut` は得点なし。
3. 第三アウトが打者走者の一塁到達前なら、そのプレー中の全得点を0にする。
4. 第三アウトがフォースアウトなら、本塁到達時刻にかかわらず、そのプレー中の全得点を0にする。
5. 第三アウトが先位走者の塁空過・リタッチ失敗のアピールアウトなら、その後位走者の得点を0にする。
6. 第三アウトがフォースでない別走者へのタッグなら、`t_home<t_tagOut` の得点は有効、後なら無効。
7. 守備が有利なアピール上の第四アウトを選べる間は暫定得点とし、成立時は選ばれたアウトで再計算する。
8. 一度合法に成立した得点は、走者が誤って三塁へ戻ろうとしても取り消さない。
9. 満塁押し出しサヨナラは三塁走者の本塁接触と打者走者の一塁接触がともに `1` になるまで終了しない。

### ⑥ プレー終了

1. 公式規則に万能な「1プレー終了」信号はないため、以下を規則から再導出したゲーム用離散仕様とし、推測の秒数は使わない。
2. 終了経路A: `O=3`。当該プレーの得点順と許されるアピールを確定または明示的に放棄してから閉じる。
3. 終了経路B: 規則上 `L=0` となり、全アウト・得点・進塁保障・帰塁保障の反映が完了した時。
4. 終了経路C: `L=1` だが、全生存走者で `B_r=1 ∧ advanceIntent=0 ∧ returnIntent=0`、かつ `C=1`、球の飛行・転動・送球・タッグ企図が全て0の時。
5. 終了経路D: 審判が天候・暗さ・照明故障・負傷等で正式にTimeを宣告し、必要な走者配置を完了した時。
6. `∃r:B_r=0`、すなわち1人でも塁間にいる間は終了不可。走者が静止・無入力でも同じ。
7. `ballAirborne=1 ∨ ballLoose=1 ∨ throwInProgress=1` なら終了不可。捕球前・送球中を時間切れで閉じない。
8. `advanceIntent=1 ∨ returnIntent=1 ∨ inputHeld=1 ∨ pendingTagOrAppeal=1` なら終了不可。
9. 経過時間だけの終了条件は置かない。救済タイマーを置く場合も、A〜Dの成立判定より先に発火させない。

規則根拠: [MLB Official Information](https://www.mlb.com/official-information)、[2026 Official Baseball Rules](https://mktg.mlbstatic.com/mlb/official-information/2026-official-baseball-rules.pdf)。参照箇所は 5.06(a)–(c)、5.07(d)–(e)、5.08、5.09(b)–(e)、5.12、6.01(h)、6.02(a)、Definitions of Terms の `CATCH` と `TAG`。

### 工程1の新規所見

0件。工程1ではコードを読まず期待仕様だけを固定したため、実装との差について「解決／未解決」を判定していない。差分所見は工程2以降で実行または照合の深さを明示して追記する。

## 工程1完了宣言 — 白紙期待仕様を固定

6場面を各9条件で固定し、各項目を10行以内に収めた。以後この節は変更せず、コード側が異なる場合は期待仕様を寄せずに差として扱う。


## 工程2 — 経路の全列挙（構造監査）

### 2-A. 終了関数の全呼び出し

対象は開始時に凍結した `b0805-06`。以下の行番号は同一内容の `baseball3d.html` に対応する。HTMLの非script部を改行数を保ったまま除外し、JavaScript全体を構文解析した。文字列検索と構文解析は、定義4件、実呼び出し25件（`concludePlay` 10、`endRundown` 9、`concludeOrChaseHome` 2、`finishPlay` 4）で一致した。

判定語は次の意味で用いる。

- `閉じる`: その状態を明示的に許容して終了関数へ入る。
- `閉じ得る`: その状態を拒否する完全な条件がなく、構造上は終了関数へ到達できる。実行再現済みという意味ではない。
- `閉じない`: この呼び出しまでの明示条件が当該状態を拒否する。
- 危険度は構造上の優先度であり、症状の発生率ではない。

#### `concludePlay` 全10呼び出し

| file:line | 逐語1行 | 3判定（塁間走者／キー押下中／球が空中） | 危険度 |
|---|---|---|---|
| `baseball3d.html:1887` | `return concludePlay();` | 閉じる：`midBase`は8秒延長だけ／閉じる：`keyHeld`も8秒延長だけ／閉じる：`ballLive`も8秒延長だけ | 中 |
| `baseball3d.html:1899` | `if(T.target==='P' && T.stage!=='rundown' && !flyWait && !keyHeld && allSettled) return concludePlay();` | 閉じない：`allSettled`が全走者の塁上・goal到達を要求／閉じない：S・Z・Xを`!keyHeld`で拒否／閉じ得る：投手返球の飛行完了条件がない | 低 |
| `baseball3d.html:1927` | `return concludePlay();` | 閉じ得る：次の送球対象なし以外に全走者条件なし／閉じ得る：入口保留は人間攻撃のS・Zかつ8秒未満だけ／閉じない：保持者がタッチ済み | 高 |
| `baseball3d.html:1967` | `if(tr && Math.abs(tr.p-tr.origin)<=0.05) return concludePlay();` | 閉じ得る：対象走者だけを検査／閉じ得る：Xまたは8秒以後は入口保留なし／閉じない：けん制球はまだ保持中 | 高 |
| `baseball3d.html:1969` | `return concludePlay();                     // それでも間に合わない＝中止` | 閉じ得る：全走者条件なし／閉じ得る：Xまたは8秒以後は入口保留なし／閉じない：けん制球はまだ保持中 | 高 |
| `baseball3d.html:2120` | `if(T.chased && T.t>8) return concludePlay();   // 収拾できなければプレーを閉じる` | 閉じる：塁間門番なし／閉じる：通常はplayClockも8秒超／閉じ得る：`ballLive`検査なし | 高 |
| `baseball3d.html:2402` | `concludePlay();` | 閉じ得る：3アウト時、または塁上から後方へ戻る走者を`unsettled`が拾わない／閉じ得る：Xまたは8秒以後／閉じ得る：relay保存条件から漏れれば通る | 中 |
| `baseball3d.html:2423` | `return concludePlay();` | 閉じ得る：3アウト時または後方goalのblind spot／閉じ得る：Xまたは8秒以後／閉じない：実呼び出し時は受球後 | 中 |
| `baseball3d.html:2483` | `return concludePlay();` | 閉じ得る：判定対象外の走者を全量確認しない／閉じ得る：Xまたは8秒以後／閉じない：フライ返球の受球後 | 高 |
| `baseball3d.html:2535` | `concludePlay();` | 閉じ得る：続行条件が前進差`>0.15`だけで、帰塁中・差0.15以下を拾わない／閉じ得る：Xまたは8秒以後／閉じない：塁判定時は保球中 | 高 |

#### `endRundown` 全9呼び出し

全経路は2368行の共通処理へ入り、3アウト未満で`unsettled`なら続行する。ただしキー自体は完全な門番ではない。

| file:line | 逐語1行 | 3判定（塁間走者／キー押下中／球が空中） | 危険度 |
|---|---|---|---|
| `baseball3d.html:1886` | `if(inRundown) return endRundown('セーフ！','#3fd66a');` | 一旦続行するが次フレーム1887で閉じ得る／閉じ得る：時計は32秒超／relayなら一旦保存するが次フレーム1887で閉じ得る | 中 |
| `baseball3d.html:1909` | `if(T.stage==='rundown') return endRundown('タッチアウト！','#95a3b4');` | 他の未決着走者は続行／Xは保護なし、S・Zも8秒以後は保護なし／閉じない：保持者がタッチ済み | 低 |
| `baseball3d.html:2258` | `return endRundown('セーフ！','#3fd66a');` | 他の未決着走者は続行／キー単独では門番にならない／閉じない：chaseで保球中 | 低 |
| `baseball3d.html:2260` | `markOut(r,'tag'); return endRundown('タッチアウト！','#95a3b4');` | 他の未決着走者は続行／キー単独では門番にならない／閉じない：chaseで保球中 | 低 |
| `baseball3d.html:2266` | `markOut(r,'tag'); return endRundown('タッチアウト！','#95a3b4'); }` | 他の未決着走者は続行／キー単独では門番にならない／閉じない：chaseで保球中 | 低 |
| `baseball3d.html:2325` | `return endRundown('セーフ！','#3fd66a');` | 他の未決着走者は続行／キー単独では門番にならない／閉じ得る：走者到達を送球中にも判定し、他走者なしなら空中球保存分岐へ入らない | 中 |
| `baseball3d.html:2347` | `if(R.fumble) return endRundown('送球がそれてセーフ！','#3fd66a');` | 現走者が塁間なら続行／キーではなく`unsettled`で続行／現走者が未決着ならrelay球を保存 | 低 |
| `baseball3d.html:2351` | `markOut(r,'tag'); return endRundown('タッチアウト！','#95a3b4');` | 他の未決着走者は続行／キー単独では門番にならない／閉じ得る：距離成立時に球を手へ固定していない | 中 |
| `baseball3d.html:2366` | `return endRundown('戻ってセーフ','#3fd66a');` | 現走者のgoalを手前塁へ直すため続行／キーではなく`unsettled`で続行／relay中なら保存、chase中なら保球済み | 低 |

#### `concludeOrChaseHome` 全2呼び出し

| file:line | 逐語1行 | 3判定（塁間走者／キー押下中／球が空中） | 危険度 |
|---|---|---|---|
| `baseball3d.html:2463` | `if(b==='P') return concludeOrChaseHome();   // 投手への返球はアウト判定を伴わない` | 通常は続行するが3アウト時・後方goalのblind spotでは閉じ得る／Xまたは8秒以後は閉じ得る／閉じない：投手受球後 | 低〜中 |
| `baseball3d.html:2469` | `if(b==='P') return concludeOrChaseHome();` | 到達不能／到達不能／到達不能：2463行の同一条件が先に必ずreturnする | 低 |

#### `finishPlay` 全4呼び出し

| file:line | 逐語1行 | 3判定（塁間走者／キー押下中／球が空中） | 危険度 |
|---|---|---|---|
| `baseball3d.html:2665` | `finishPlay({out:outs, runs, bases:nb, hit, moves:null, throwTo:null, text, color});` | 閉じる：sink自体に門番なし／閉じる：上流入口を通過後は無条件／閉じ得る：上流が空中球を渡せる | 高 |
| `baseball3d.html:2936` | `finishPlay(ball.landed ? resolveHit(4.6,{x:ball.x,y:ball.y},true) : resolveHomer());` | 閉じる／閉じる／閉じる：柵越え・エンタイトルでルール上デッド | 低 |
| `baseball3d.html:3022` | `finishPlay({out:1, runs:0, bases:nb, hit:false, moves:null, throwTo:null,` | 閉じる：全走者を元塁へ戻す／閉じる／閉じない：捕球・速度ゼロ後 | 低 |
| `baseball3d.html:3029` | `finishPlay({out:1, runs:0, bases:[null,null,null], hit:false, moves:null, throwTo:null, quick:1.3,` | 該当なし：塁上走者なし条件／閉じるが進塁可能走者なし／閉じない：捕球後 | 低 |

定義は `endRundown` 2368行、`concludeOrChaseHome` 2408行、`concludePlay` 2566行、`finishPlay` 3205行。共通sinkの`concludePlay`は2571〜2575行で「人間攻撃・3アウト未満・S/Z・playClock 8秒未満」だけを保留し、X、一般的な塁間状態、球の飛行を拒否しない。`finishPlay`は3219〜3222行で端数goalを手前塁へ丸めるが、終了自体を拒否しない。

### 2-B. 走者 `goal` 書き換えの全列挙

文字検索では書換候補27行だったが、2610行はコメント内の旧コードなので除外した。JavaScript構文走査では実書換26行・28式（直接19式、object初期値9式）を確認した。`setAutoGoal` はその28式とは別に呼び出し10箇所を全列挙した。したがって計36物理行・38論理箇所である。複合代入、`++/--`、bracket、destructure、`Object.assign`、`Reflect.set`による別経路は0件だった。

「一時コピー」はETA計算専用で、live走者を書き換えない。

| file:line | 逐語1行 | 適用条件の明示 | 危険度 |
|---|---|---|---|
| `baseball3d.html:1350` | `runners.unshift({p:0, goal:1, autoGoal:1, extra:0, origin:0, sp:A.speed(bat.走)});` | `mode==='keep' && runners.length`時の新規打者走者 | 低 |
| `baseball3d.html:1356` | `: [{p:0, goal:1, autoGoal:1, extra:0, origin:0, sp:A.speed(bat.走)*rnd(0.94,1.0)}];` | `mode!=='noBatter'`時の新規打者走者 | 低 |
| `baseball3d.html:1362` | `runners.push(b?{p, goal:p, autoGoal:p, extra:0, origin:i+1, sp:(b.sp\|\|21)}:null); });` | `bases[i]`がある塁上走者だけ生成 | 低 |
| `baseball3d.html:1369` | `setAutoGoal(r, mv ? mv.to : r.origin, true);` | `applyRunnerResult`内の全走者。`out`門番なし、`force=true`で手動指示も上書き | 高 |
| `baseball3d.html:1664` | `if(runnerBackETA({...r, goal:b}) > throwETAof(f,b)+0.05) return {nb:b};` | 非アウトかつ帰塁走者のETA用一時コピー | 低 |
| `baseball3d.html:1690` | `runnerBackETA({...r, goal:homeB}) > throwETAof(f,homeB) - 0.15);` | 非強制前進走者の踏切ETA用一時コピー | 低 |
| `baseball3d.html:1776` | `const back={...r, goal:lo}, fwd={...r, goal:hi};` | `back.goal=lo`。塁間中央、非全速、野手80ft以内のETA用一時コピー | 低 |
| `baseball3d.html:1776` | `const back={...r, goal:lo}, fwd={...r, goal:hi};` | `fwd.goal=hi`。同条件のETA用一時コピー | 低 |
| `baseball3d.html:1808` | `setAutoGoal(r, auto);` | `kind!=='fly'`かつ非アウト。既存`r.cmd`ならsetterがgoalを保持 | 低 |
| `baseball3d.html:2157` | `const back={...r, goal:lo}, fwd={...r, goal:hi};` | `back.goal=lo`。approach中の非アウト・非塁上走者のETA用一時コピー | 低 |
| `baseball3d.html:2157` | `const back={...r, goal:lo}, fwd={...r, goal:hi};` | `fwd.goal=hi`。同条件のETA用一時コピー | 低 |
| `baseball3d.html:2238` | `r.extra=0; setAutoGoal(r, lo);` | `beginRundown`へ渡された走者。関数内の`!out`門番なし、手動cmd時は不発 | 中 |
| `baseball3d.html:2312` | `setAutoGoal(r, away);` | 挟殺chase中、現在goalまで閾値未満、受け手カバー済みの切返し | 低 |
| `baseball3d.html:2334` | `if(!r.out){ r.extra=0; r.cmd=null; setAutoGoal(r, Math.min(4, R.hi), true); r.v=Math.max(r.v\|\|0,(r.sp\|\|23)*0.5); }` | 挟殺relay悪送球が10ft超過し、落球または1.2秒超、かつ非アウト | 中 |
| `baseball3d.html:2364` | `r.goal=back; r.autoGoal=back; r.cmd=null;` | 挟殺時間切れ時、対象走者が存在し非アウト | 低 |
| `baseball3d.html:2550` | `r.out=true; r.outKind=kind; r.goal=r.p;` | `markOut`冒頭で既アウトならreturn。アウト成立位置で停止 | 低 |
| `baseball3d.html:2584` | `if(!r.out && r.mustReturn) r.goal=Math.min(r.goal, r.origin);` | フライconclude時、非アウトかつ踏み直し義務あり | 低 |
| `baseball3d.html:2598` | `if(r.p>=3.97){ r.goal=4; if(!timePlay \|\| timePlay.includes(r)) runs++; return; }` | 非アウト、丸めたgoalが4以上、実位置3.97以上 | 低 |
| `baseball3d.html:2607` | `r.goal=g;` | 非アウト、占有衝突を解いた後の`g>=1` | 低 |
| `baseball3d.html:2611` | `r.goal=Math.max(0, Math.floor(r.p+1e-9));` | 非アウト、置ける塁`g<1`、既に3アウト | 低 |
| `baseball3d.html:2613` | `r.out=true; r.outKind='tag'; r.goal=r.p;` | 非アウト、`g<1`かつ3アウト未満。重複占有解消 | 中 |
| `baseball3d.html:2778` | `if(go){ setAutoGoal(r, Math.min(4, r.origin+1)); r.v=(r.sp\|\|23)*0.5; }` | 打球開始時の既存塁走者。強制・2死・打球方向等から`go=true`。直前再生成に依存 | 中 |
| `baseball3d.html:2891` | `runners.forEach(r=>{ if(r.origin>0 && (isForced(r) \|\| r.tagUp)) setAutoGoal(r, Math.min(4, r.origin+1)); });` | 初回着地時、既存塁走者で強制またはtagUp | 低 |
| `baseball3d.html:2898` | `runners.forEach(r=>{ if(r.origin>0){ setAutoGoal(r, Math.max(r.autoGoal\|\|0, r.origin+1));` | 外野へ抜けた後の全既存塁走者。`out`門番なし | 中 |
| `baseball3d.html:2910` | `runners.forEach(r=>{ if(r.origin>0){ if(r.cmd==='S') r.tagUp=true; setAutoGoal(r, r.origin); } });` | 捕球可能な高い飛球・2死未満。ただし`cmd==='S'`なら4338行がreturnし、帰塁goalが不発 | 高 |
| `baseball3d.html:3020` | `r.goal=r.origin; r.autoGoal=r.origin; r.cmd=null;` | 捕球が第三アウトになる経路の非アウト・非打者走者 | 低 |
| `baseball3d.html:3103` | `r.mustReturn=true; r.cmd=null; r.goal=r.origin;` | 捕球時、非アウト・非打者で`p>origin+0.12` | 低 |
| `baseball3d.html:3112` | `r.goal = wants ? Math.min(4, r.origin+1) : r.origin;` | 捕球時、非アウト・非打者で`p<=origin+0.12`。X/S/tagUp/deep犠飛で分岐 | 低 |
| `baseball3d.html:3183` | `runners.forEach(r=>{ r.p=r.origin; r.goal=r.origin; r.autoGoal=r.origin; r.cmd=null; r.v=0; r.mustReturn=false; r.tagUp=false; });` | `foulBall`へ入った全走者をリセットし、直後に打者走者を除外 | 低 |
| `baseball3d.html:3221` | `if(Math.abs(r.goal-Math.round(r.goal))>0.02) r.goal=Math.max(0,Math.floor(r.goal+1e-9));` | `finishPlay`時の非アウト走者でgoalが塁から0.02超 | 中 |
| `baseball3d.html:3343` | `runners.forEach(r=>{ if(r.jumped){ r.goal=r.origin; r.cmd=null; } });` | 牽制開始時の`jumped`走者。`out`門番なし | 中 |
| `baseball3d.html:3381` | `if(g>=1){ nb[g-1]={id:Math.random(), sp:r.sp}; r.goal=g; }` | 盗塁/牽制結末の非アウト走者、占有解消後`g>=1` | 低 |
| `baseball3d.html:4012` | `r.goal=Math.min(4, r.origin+1); r.jumped=true;` | windup時、投球前からS/Z保持、非アウトかつorigin<4 | 中 |
| `baseball3d.html:4102` | `r.goal=Math.max(here, Math.min(here+1, max, 4)); r.cmd='S';` | tagPhase中のlive打者走者だが、`leadOnly`/`picked`門番より前に実行 | 高 |
| `baseball3d.html:4108` | `if(r.origin<3) setAutoGoal(r, r.origin+0.45, true);` | go＋tagPhase、非アウト既存走者、Z/塁指定門番通過、origin 1/2 | 低 |
| `baseball3d.html:4134` | `r.goal = Math.max(here, Math.min(here+1, max, 4));` | 通常進塁、非アウト、mustReturn解消済み、Z/塁指定門番通過 | 低 |
| `baseball3d.html:4146` | `r.goal = Math.min(4, Math.max(here, min));` | 通常帰塁、非アウト、塁指定門番通過、後続走者との重複回避 | 低 |
| `baseball3d.html:4339` | `r.goal=g;` | setter内は`if(!force && r.cmd) return;`だけ。out、phase、範囲、帰塁義務はcaller依存 | 高 |

構造上の再発面は、(a) 2910→4338でS入力中の帰塁指定がsetter門番に阻まれる、(b) 4102で打者走者だけがZ・1〜3キーの対象門番より先に書き換わる、(c) 強制setterがout・phase・goal範囲を検査しない、の3点。いずれもこの工程では実行未検証とする。

### 2-C. 打球担当 `primary`／カバー `coverBase` 書き換えの全列挙

コード内に独立した`pri`状態はなく、120行の`pri:`は記録用の読取りである。実状態は`ball.primary`と各野手の`f.primary`。構文・文字検索の照合結果は、`primary`直接書換10箇所、`coverBase`直接書換13箇所、`rundownCover`間接呼出し7箇所、`put`間接呼出し4箇所。bracket・`Object.assign`・delete経路は0件だった。

#### `primary` 全直接書き換え

| file:line | 逐語1行 | 適用条件 | 危険度 |
|---|---|---|---|
| `baseball3d.html:928` | `cx:h.x, cy:h.y, tx:h.x, ty:h.y, primary:false, run:0, face:0, v:0};` | `buildFielders`が生成する全野手 | 低 |
| `baseball3d.html:1269` | `ball.primary = plan.f; ball.planT = ball.t + Math.min(plan.t, 0.25); plan.f.coverBase = null;` | 捕球失敗後、`planPlay(ball,true)`が選んだ新担当 | 中 |
| `baseball3d.html:1270` | `fielders.forEach(x=>{ x.primary=(x===plan.f); });` | 同上。新担当だけtrue、全旧担当false | 低 |
| `baseball3d.html:2719` | `ball.pred=plan.firstLand; ball.primary=plan.f; ball.canCatchAir=plan.air; ball.planT=plan.t;` | 全打球の開始時、初回`planPlay`結果 | 低 |
| `baseball3d.html:2728` | `fielders.forEach(f=>{ f.primary=(f===plan.f); });` | 同上。全野手フラグ同期 | 低 |
| `baseball3d.html:2848` | `ball.primary = plan2.f; ball.planT = ball.t + plan2.t;` | 着地済み、0.35秒経過、旧担当から遠い、旧担当へ接近中でない、新旧担当が異なる | 中 |
| `baseball3d.html:2850` | `fielders.forEach(f=>{ f.primary=(f===plan2.f); });` | 同上。全野手フラグ同期 | 低 |
| `baseball3d.html:2949` | `ball.primary=plan.f; ball.planT=ball.t+plan.t;` | フェンス到達、未反射、外向き速度`vr>0`の壁反射 | 高 |
| `baseball3d.html:2952` | `fielders.forEach(f=>{ f.primary=(f===plan.f); if(f.primary) setTarget(f, plan.x, plan.y); });` | 同上。全野手フラグ同期 | 高 |
| `baseball3d.html:3198` | `f.primary=false; f.face=0; f.v=0; f.stun=0; f.fumbled=false; f.run=0;` | `resetFielders`対象の全野手 | 低 |

`buildFielders`による間接初期化トリガーは980・3202行、`resetFielders`による間接消去トリガーは3185・3264・3269行。別名参照は2808行の`const prim=ball.primary;`だけである。

#### `coverBase` 全直接書き換え

| file:line | 逐語1行 | 適用条件 | 危険度 |
|---|---|---|---|
| `baseball3d.html:1269` | `ball.primary = plan.f; ball.planT = ball.t + Math.min(plan.t, 0.25); plan.f.coverBase = null;` | 捕球失敗後、新担当だけカバー解除 | 低 |
| `baseball3d.html:2030` | `cut.coverBase=null;` | 直送不能で中継野手が見つかった時。2032行で元塁を再配置 | 中 |
| `baseball3d.html:2049` | `cut.coverBase=null;` | 158ft超の本塁送球、指定内野手が投手・受手・主担当でない | 高：元塁再配置なし |
| `baseball3d.html:2213` | `if(best){ best.coverBase=base; setTarget(best,p[0],p[1]); }` | `rundownCover`が除外者以外の最近野手を選ぶ。空き役割条件なし | 高 |
| `baseball3d.html:2734` | `fielders.forEach(f=>{ f.coverBase=null; });` | 全打球開始時、全解除 | 低 |
| `baseball3d.html:2735` | `const put = (b, names) => { const f=take(names); if(f){ f.coverBase=b; const p=throwPoint(b); setTarget(f,p[0],p[1]); } };` | 候補名順の未割当野手。主担当は`assigned`で除外 | 低 |
| `baseball3d.html:2851` | `plan2.f.coverBase = null;` | 着地後の担当交代で新担当になった野手 | 低 |
| `baseball3d.html:2866` | `prim.coverBase=bb; const p=throwPoint(bb); setTarget(prim,p[0],p[1]);` | 旧担当が無担当・非主担当で、未カバー塁あり | 低 |
| `baseball3d.html:2951` | `plan.f.coverBase=null;` | 壁反射後の新担当。2953行で元塁再配置 | 中 |
| `baseball3d.html:3344` | `fielders.forEach(f=>{ f.coverBase=null; });` | 有効な牽制対象検出時、全解除 | 低 |
| `baseball3d.html:3347` | `if(f){ f.coverBase=b; const p=throwPoint(b); setTarget(f,p[0],p[1]); } });` | 牽制時の固定名対応野手 | 低 |
| `baseball3d.html:4043` | `fielders.forEach(f=>{ f.coverBase=null; });` | 盗塁開始済みかつ`!S.stealCover`の初回 | 低 |
| `baseball3d.html:4046` | `if(f){ f.coverBase=b; const p=throwPoint(b); setTarget(f,p[0],p[1]);` | 盗塁時の固定名対応野手 | 低 |

#### `rundownCover`経由の全7書き換え

全て2213行の`best.coverBase=base`へ到達する。

| file:line | 逐語1行 | 適用条件 | 危険度 |
|---|---|---|---|
| `baseball3d.html:1272` | `if(freed!=null) rundownCover(freed, plan.f);` | 捕球失敗後、新担当が外れた塁。新担当以外の空き適格条件なし | 高 |
| `baseball3d.html:2032` | `if(freed!=null) rundownCover(freed, cut);` | 中継に抜いた野手の元担当塁。中継野手以外の空き適格条件なし | 高 |
| `baseball3d.html:2236` | `const hiCover = rundownCover(hi, T.rd.holder);` | 挟殺開始、高側。保持者だけ除外 | 高 |
| `baseball3d.html:2237` | `rundownCover(lo, T.rd.holder, hiCover);` | 挟殺開始、低側。保持者と高側担当だけ除外 | 高 |
| `baseball3d.html:2275` | `const recv=rundownCover(chasing, R.holder);` | 挟殺の切返し。保持者だけ除外 | 高 |
| `baseball3d.html:2856` | `if(freed!=null) rundownCover(freed, plan2.f, prim);` | 着地後の担当交代。新旧担当を両方除外 | 中 |
| `baseball3d.html:2953` | `if(freedW!=null) rundownCover(freedW, plan.f);` | 壁反射後。新担当だけ除外 | 高 |

#### `put`経由の全4書き換え

全て2735行の`f.coverBase=b`へ到達し、主担当・既割当野手を除外する。

| file:line | 逐語1行 | 適用条件 | 危険度 |
|---|---|---|---|
| `baseball3d.html:2736` | `put(1, ['一','投','二']);` | 一塁。候補順、主担当・割当済み除外 | 低 |
| `baseball3d.html:2737` | `put(3, ['三','遊','投']);` | 三塁。同条件 | 低 |
| `baseball3d.html:2741` | `put(2, (c.spray>5 ? ['遊','二','投','一'] : ['二','遊','投','一']));` | 二塁。打球方向で遊撃/二塁優先を反転 | 低 |
| `baseball3d.html:2742` | `put(4, ['捕','投']);` | 本塁。捕手、次に投手 | 低 |

構造上の再発面は、(a) 壁反射時に2808行で保存した旧`prim`を担当変更後の2958〜3063行でも使う、(b) 長距離本塁中継の2049行だけ元カバー塁を再配置しない、(c) `rundownCover`が`coverBase==null`・`!primary`を要求せず別役割を奪える、(d) `resetFielders`は`primary`を消すが`coverBase`を消さない、の4点。いずれもこの工程では実行未検証とする。

## 所見1: 最終時間切れは、走者・操作・球がライブでも20秒でプレーを閉じ得る
- 目的への影響: 長い挟殺や悪送球処理で、オーナーがまだ走者を動かしている最中、または球が転送中なのに画面が結果へ切り替わる危険が残る。
- 真因: `baseball3d.html:1885-1887` — `if(S.playClock > (inRundown?24:12) + grace){` / `if(inRundown) return endRundown('セーフ！','#3fd66a');` / `return concludePlay();`
- 深さ: 実行。走者`p=1.50`、S押下中、球`z=5ft`の空中送球、`playClock=20.051〜20.053`を3回実行し、3/3で0.01秒後に`phase=play`・`throwPlay=null`へ閉じた。
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding1HardTimeoutLiveState`（一括入口 `--phase3-structural-runtime`）。
- 修理案: 全終了sinkの先頭に「3アウト未満かつ、塁間走者・S/Z/X入力・飛行/転動/送球中の球・未決着タッグ/アピールのいずれかがあるなら終了しない」という共通門番を置き、その後に救済時間を評価する。3アウト成立後、規則上のデッドボール、全走者が整数塁で無入力かつ球と判定が静止済みの場面では発動しない。

## 所見2: 高い飛球でS入力中の帰塁命令がsetterの手動指示門番で無効になる
- 目的への影響: タッチアップのためSを押している走者が捕球前に元塁へ戻らず、捕球の瞬間から逆向きに戻り始める、または本来のスタートを失う見た目につながる危険がある。
- 真因: `baseball3d.html:2910,4338-4339` — `if(r.cmd==='S') r.tagUp=true; setAutoGoal(r, r.origin);` に対し、setterは `if(!force && r.cmd) return;` のため`r.cmd==='S'`時に `r.goal=r.origin;`へ到達しない。
- 深さ: 実行。高い捕球可能飛球、一塁走者`p=1.08`、`goal=2`、S入力を3回実行し、3/3で`tagUp=true`・`autoGoal=1`なのに`goal=2`のまま残った。
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding2TagUpReturnBlocked`（一括入口 `--phase3-structural-runtime`）。
- 修理案: 「捕球可能な高い飛球・2死未満・捕球前」に限り、`tagUp`を保存した上で帰塁goalを`force=true`で設定するか、手動指示と安全帰塁を別状態にする。2死、既に捕球済み、落球確定、通常ゴロでは発動しない。

## 所見3: 高い飛球中の打者走者だけ、Z・塁指定の対象制限より先に進塁goalを書き換える
- 目的への影響: オーナーが「先頭だけ」を意図してZを押した場面や1〜3キーで別走者を選んだ場面でも、打者走者まで一塁方向へ動き、指示していない走者が刺される危険がある。
- 真因: `baseball3d.html:4096-4106` — 打者走者分岐の `r.goal=Math.max(here, Math.min(here+1, max, 4)); r.cmd='S';` が、`if(leadOnly && r!==lead) return;` と `if(picked && r!==picked) return;` より前にある。
- 深さ: 実行。高い飛球中にZのみ、または一塁走者指定の1+Sを各3回実行し、対象外の打者走者がZで`goal 1→2`、1+Sで`goal 1→0`となった。6/6で対象制限を破った。
- 再現: `review_sol_ultra_repro_20260805.js` 内の `runPhase3ControlScopeExpansion`（`--phase3-control-scope`）。
- 修理案: `leadOnly`と`picked`の門番を打者走者分岐より前へ移し、全live走者へ同じ対象選択を適用する。通常のS、Zで打者走者自身が先頭の場合、対象指定なしの自動走塁では抑止しない。

## 所見4: 壁反射で担当交代した同じ物理刻みだけ、捕球判定が旧担当を使い続ける
- 目的への影響: フェンス際で担当表示と実際に捕球・拾球を判定される野手が食い違い、旧担当が離れているのに捕ったように見える、または新担当が球に届いても捕らない危険がある。
- 真因: `baseball3d.html:2808,2949,2958` — `const prim=ball.primary;` で旧担当を固定後に `ball.primary=plan.f;` と交代するが、その後も `const d2=Math.hypot(ball.x-prim.cx, ball.y-prim.cy);` が旧`prim`を参照する。
- 深さ: 実行。壁反射で左翼手から中堅手へ担当を替え、中堅手を315.659ft離した状態を3回実行した。3/3で`ball.primary='中'`なのに同一刻みで旧担当の左翼手が捕球した。
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding4WallHandoffStalePrimary`（一括入口 `--phase3-structural-runtime`）。
- 修理案: 壁反射で担当が変わったら、その刻みの残り処理をreturnして次刻みで新`ball.primary`を再取得するか、以後の距離・捕球・送球参照を新担当へ更新する。担当が変わらない反射、壁に到達しない打球では発動しない。

## 所見5: 158ft超の本塁中継だけ、抜いた野手の元カバー塁を埋め直さない
- 目的への影響: 長い本塁送球の間に別走者が進塁・帰塁すると、本来いるはずの塁カバーが消え、タッチされない、誰もいない塁へ送る、野手が不自然に持ち場を離れる危険がある。
- 真因: `baseball3d.html:2047-2050` — `if(cut && cut!==T.thrower && cut!==recv && !cut.primary){` の中で `cut.coverBase=null;` と中継位置への`setTarget`を行うが、同型の2030〜2032行にある元値保存と`rundownCover(freed, cut)`がない。
- 深さ: 実行。中堅から本塁170ft、一塁手が一塁カバーの状態を3回実行した。3/3で一塁手は中継位置へ移動し、`coverBase=null`、一塁担当0人になった。
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding5LongHomeRelayDropsCover`（一括入口 `--phase3-structural-runtime`）。
- 修理案: 中継へ出す前に`freed=cut.coverBase`を保存し、解除後、主担当・送球者・受手・他カバーを除く空き適格野手へ元塁を再割当する。`freed==null`、距離158ft以下、中継を使わない送球では発動しない。

## 所見6: `rundownCover`は空き野手を選ばず、別塁カバーや打球担当の役割を上書きできる
- 目的への影響: 挟殺や担当交代の途中で、別の塁を守っていた野手まで突然移動し、複数走者がいる場面で無人の塁や不自然な守備移動が発生する危険がある。
- 真因: `baseball3d.html:2210-2213` — 候補条件は `if(f===exclude || f===exclude2) return;` と距離比較だけで、`f.coverBase==null`、`!f.primary`、元役割の再補充条件がないまま `best.coverBase=base;` を実行する。
- 深さ: 実行。最寄り投手が別塁coverの状態とprimaryの状態を各3回、計6回実行した。6/6で空いている遊撃手でなく投手を選び、別塁cover消失またはprimaryとの二重割当になった。
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding6RundownCoverStealsRole`（一括入口 `--phase3-structural-runtime`）。
- 修理案: 候補を`!primary && (coverBase==null || coverBase===base)`に限定し、別塁担当を動かす必要がある場合は元塁の再補充を同一処理で原子的に行う。既に同じ塁を担当する野手の再照準、他に空き野手がいる場面では役割連鎖を起こさない。

## 工程2完了宣言 — 構造監査

凍結した`b0805-06`全4,395行を読了し、終了関数25呼び出し、`goal` 38論理書換箇所、`primary` 10直接書換、`coverBase` 13直接書換＋11間接呼出しを全列挙した。文字検索とJavaScript構文走査の件数は一致した。構造差6件を所見1〜6として1件ずつ保存し、`node review_sol_ultra_repro_20260805.js --phase2-static`で6/6の照合器が`matched:true`、BUILDが`b0805-06`になることを再確認した。

工程2の保存時点では全所見の深さを「照合」とし、実際の試合症状について「解決／未解決」を断定しなかった。凍結対象のSHA-256は工程終了時も `2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183` で不変。その後、工程3で所見1〜6を独立実行し、本体の深さを「実行」へ更新した。

## 工程3 — 実行検証

### 3-0. 対象と無作為20件の事前固定

`REVIEW_SYNTHESIS_20260805.md` §1の「どちらか一方でも部分解決以下」97件のうち、依頼文どおり、どちらか一方が明示的に`未解決`または`退行`とした項目は20件だった。両レビューの表を機械抽出し、OI-001〜239の全IDを突合した。

`OI-008, 052, 056, 060, 063, 073, 080, 133, 137, 140, 141, 144, 169, 171, 186, 213, 217, 230, 237, 238`

この20件は全件を対象とする。似た項目を同一シナリオで刺激する場合も、各OIについて期待値・観測・判定を個別に残す。

両者がともに`解決`とした母集団は117件。恣意的選択を避けるため、実行前に次の方法で20件を固定した。

1. 対象はOI-001〜239で、Fable/Solの判定がともに完全一致で`解決`のIDだけ。
2. 固定文字列 `SOL-ULTRA-20260805`、凍結ソースSHA-256、OI-IDを `SOL-ULTRA-20260805|2A76...151C183|OI-NNN` の形でUTF-8連結する。
3. 各文字列のSHA-256を求め、16進値の昇順で先頭20件を無作為標本とする。復元抽出なし。
4. 入力レビューのSHA-256はFable `56CB8E49...42168`、Sol `DD633FC5...68A070`、synthesis `59DB90F4...21AF8`。選定後は入替えない。

| 順位 | OI | SHA-256順位値 |
|---:|---|---|
| 1 | OI-088 | `00D2CEA948EB6CA0A73EEA77BFE012D7E458A5BAEC4FDBC89B39E395F7FE4ECD` |
| 2 | OI-032 | `042B4748159A880A5A74470F2E773BBBF23A078D5CD7B99714137D4A0EACE665` |
| 3 | OI-155 | `09BAE810F5661F14E1C3C88E179F80D8D79523D9FB213D3B5A8CB3AFEA2AF92F` |
| 4 | OI-033 | `09F8A3CED5D8BBC81BD0E86A375D60BCB57DE2788F71142BD29221896F3AC9DF` |
| 5 | OI-228 | `0A24DD0C6B2E54A36DABE6213CD33F7401C48605F882A432D6E19AB35E582C6B` |
| 6 | OI-219 | `0AD85E5BB5BF0AC7E4D87732F780FDEE431D3CA6B6B780B7FE7CF78965018060` |
| 7 | OI-139 | `13519D520D0644F38D475D37EDAEFC4032604817D6F937EC902B42C3423F4F16` |
| 8 | OI-116 | `165E418FFD858787E20565A42AF7BB294FB3A12053F7B712B4743E81C5295F2F` |
| 9 | OI-011 | `17ABFD63B343F3E3B2E5FF6F9F616E9CBE5C6AE3F9C0CA1D645A3DCAAC083B5B` |
| 10 | OI-069 | `18B760CD497DFABA3E6A8BB5A5306E2B0BE6A345D830DE5033930221832F2D8C` |
| 11 | OI-115 | `1C187FEFEBB7BE7573645AFF2815BEBFBDFE9CBE6706830A58C61A842662032B` |
| 12 | OI-006 | `1DCE62B9A13684BBCA532934B18082747F93C628196B08CDD97A901CF35A7CD6` |
| 13 | OI-076 | `1DE6C1D7823443D2FE427BDCC6516A5764C9BEE0264740DD2BB6EB5327FDB8D2` |
| 14 | OI-224 | `204AE8B5F2519F780E057DF1DCDFF0634059AA047AB3CABC7916062E5844BFF3` |
| 15 | OI-016 | `207702D4BE567D0C541600FBDA797A2C5BE6ECBB61B6646A3D6204A6B59C0F80` |
| 16 | OI-199 | `21208795EC10B8B1FDBE975ADDB4EFCBE707276BDD4E220504708DF141B162EC` |
| 17 | OI-007 | `216E1ABFADEB463CAAA4030E61708E3F3E69A208354E34D09BDA9D05C4891D25` |
| 18 | OI-123 | `238ACDE4B115A8B8916AF882157A57D56CACD868A4A8B2B583919F5BE7CB3A24` |
| 19 | OI-198 | `23F1D3CB694DEF512F4B886F5179E21FDC915E94B7DF53A0B0925202096B728D` |
| 20 | OI-121 | `260E51FEDAAC851EE29A734FA524C6BF02A1C8C5192355352E83524606BFD34F` |

選定の再計算は `node review_sol_ultra_repro_20260805.js --phase3-select` で行う。

## 所見7: 高い飛球中はZ「先頭だけ」が打者走者にも漏れ、無指示の二塁進塁になる
- 目的への影響: 二塁走者だけを動かしたつもりでも打者走者が一塁を回り、オーナーの意図しない挟殺・アウトへ直結する。両レビューが「解決」とした無作為標本OI-088を5/5で覆した。
- 真因: `baseball3d.html:4096-4106` — 打者走者に `r.goal=Math.max(here, Math.min(here+1, max, 4)); r.cmd='S';` を適用してから、後段で `if(leadOnly && r!==lead) return;` を評価している。
- 深さ: 実行。`b0805-06`、0死、高い捕球可能飛球、打者走者p=1/goal=1、二塁走者p=2.50/goal=3、Zのみ押下を5回実行し、5/5で打者走者goalが1→2になった。旧症状はこの条件で未解決。
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding7TagFlySelectedRunnerLeak`（`node review_sol_ultra_repro_20260805.js --finding7`）。
- 修理案: Z・1〜3キーの対象門番を`origin===0`分岐より前へ移し、対象外走者にはgoal/cmd/tagUpのどれも書かない。通常S、打者走者自身が先頭のZ、対象指定なしの自動走塁ではこの抑止を発動しない。

## 所見8: 高い飛球で一塁走者だけを選ぶと、打者走者のgoalが一塁から本塁へ巻き戻る
- 目的への影響: 一・三塁で一塁走者だけを動かした操作が、無関係な打者走者を打席付近へ止める。オーナーには「打ったのに打者が一塁へ走らない」という即時のバグとして見える。両レビューが「解決」とした同型OI-165を5/5で覆した。
- 真因: `baseball3d.html:4096-4106` — `origin===0`分岐が`picked`門番より先に入り、前走者のgoalが1の時に `max=0`、続く `r.goal=Math.max(here, Math.min(here+1, max, 4));` が打者走者goalを1→0へ上書きする。
- 深さ: 実行。`b0805-06`、0死、高い捕球可能飛球、打者走者p=0/goal=1、一塁・三塁走者あり、`1+S`で一塁走者だけを指定する条件を5回実行し、5/5で打者走者goal=0を観測した。旧症状はこの条件で未解決。
- 再現: `review_sol_ultra_repro_20260805.js` 内の `runPhase3ControlScopeExpansion`（`node review_sol_ultra_repro_20260805.js --phase3-control-scope`）。
- 修理案: 走者選択門番を打者走者分岐より前へ移す一方、打者走者の一塁必達は手動選択と独立した下限`goal>=1`として保持する。ファウル、捕球済み、打者走者がアウト済みの場面ではこの下限を適用しない。

### 所見1 実行追記 — 照合から実行へ更新

`reproFinding1HardTimeoutLiveState`を3回実行。毎回、`playClock=20.051〜20.053`、走者p=1.50、S押下、球z=5ftのライブ状態から0.01秒後に`phase=play`、`throwPlay=null`となった。3/3 FAIL。したがって所見1は`b0805-06`で**未解決**と実行判定する。

### 所見2 実行追記 — 照合から実行へ更新

`reproFinding2TagUpReturnBlocked`を3回実行。毎回、一塁走者p=1.08、goal=2、cmd=Sの高い飛球で`tagUp=true`・`autoGoal=1`になった一方、実goalは2のままだった。3/3 FAIL。したがって所見2は`b0805-06`で**未解決**と実行判定する。

### 所見3 実行追記 — 照合から実行へ更新

`runPhase3StructuralRuntimeConfirmations`を使い、Z「先頭だけ」3回と`1+S`の塁指定3回を実行。対象外の打者走者は前者でgoal 1→2、後者でgoal 1→0となり、6/6 FAIL。したがって所見3は`b0805-06`で**未解決**。可視症状は所見7・8として個別保存した。

### 所見4 実行追記 — 照合から実行へ更新

`reproFinding4WallHandoffStalePrimary`を3回実行。壁反射後の`ball.primary`は中堅へ変わったが、新担当まで315.659ftある同じ刻みで旧担当の左翼手が捕球者となり`throwing`へ移行した。3/3 FAIL。したがって所見4は`b0805-06`で**未解決**。担当交代を確実に発火させるため`planPlay`の返値だけを制御し、交代後の捕球処理は実コードを通した。

### 所見5 実行追記 — 照合から実行へ更新

`reproFinding5LongHomeRelayDropsCover`を3回実行。中堅から本塁170ftの送球で、一塁手は中継点`[0,45]`へ移り`coverBase=null`、一塁担当は空配列になった。3/3 FAIL。したがって所見5は`b0805-06`で**未解決**と実行判定する。

### 所見6 実行追記 — 照合から実行へ更新

`reproFinding6RundownCoverStealsRole`を、別塁カバー3回・打球primary3回で実行。全6回で最寄りの投手を選び、前者は一塁カバー消失、後者はprimaryと二塁カバーの兼任になった。6/6 FAIL。したがって所見6は`b0805-06`で**未解決**と実行判定する。

### 3-2. 本日の修理9件に対する隣接挙動

実行入口は `review_sol_ultra_repro_20260805.js` の `runPhase3RepairAdjacencySuite`（`node review_sol_ultra_repro_20260805.js --phase3-repair-adjacency`）である。凍結版 `b0805-06`／SHA-256 `2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183` をNode VM・無描画スタブで実行し、35状態を各3回、計105観測した。乱数は `Math.random=()=>0.5` に固定した。

| 修理 | 隣接して実行した状態 | 反復結果 | 判定 |
|---|---|---:|---|
| R1 時間切れ先行＋grace 8秒 | 静止12.001秒、塁間12.001秒、塁間20.001秒 | 各3回同値 | 前2状態はPASS。20.001秒は実装どおり閉じたが、工程1の白紙仕様「live条件が残る限り閉じない」にはFAILであり、所見1を再確認 |
| R2 得点 `p>=3.97` | `p=3.969`、`3.970`、`4.000` | 各3回同値 | PASS。閾値直下は0点・三塁残留、閾値以上は1点 |
| R3 捕球時踏切0.35 | `p-origin=0.349`、`0.350` | 各3回同値 | PASS。直下は帰塁、閾値以上は次塁継続 |
| R4 全塁間走者の継続 | `endRundown` 1–2/2–3/3–本、切返し送球、`concludeOrChaseHome` 1–2/2–3/3–本、両経路の定着済み | 各3回同値 | 9状態すべてPASS |
| R5 けん制のカバー待ち | 不在2.599秒、不在2.601秒、帰塁差0.049、カバー到着済み | 各3回同値 | 4状態すべてPASS。待機・中止・送球開始を分離確認 |
| R6 担当交代 | 接近内積+200、離反-200、旧担当を空き本塁へ、全塁埋まり時18ft後方へ | 各3回同値 | 4状態すべてPASS |
| R7 余裕点0.12 | `planPlay` の差0.233/0.083、`interceptPoint` の差0.225/0.100 | 各3回同値 | 4状態すべてPASS。両実装で境界の両側を確認 |
| R8 再照準の反応再徴収 | 走行率0/0.5/1で反応待ち0.112/0.056/0秒 | 各3回同値 | 3状態すべてPASS。狙い時刻は0.979167→0.929167→0.904167秒 |
| R9 走行中は続きから支払う | 走行率0/0.5/1、反応待ちはゼロに隔離 | 各3回同値 | 3状態すべてPASS。所要1.629167→1.429167→1.229167秒、全て物理下限以上 |

この隣接検査で新規所見はゼロだった。省略ではなく、上表の35状態・105観測を全て実行した結果である。ただし、実行器が返す `overallPass:true` は「修理設計どおり20秒で打ち切る」という局所oracleに対する値であり、工程1で固定した上位oracleではR1の20秒打切りはPASSではない。したがって、修理9件全体を「問題なし」とは判定せず、所見1を未解決のまま維持する。


## 所見9: 難易度は1つの共通設定しかなく、打撃・投球・守備を別々に選べない
- 目的への影響: オーナーは自分の苦手な操作だけを易しくできず、難易度を1段変えると投球の見やすさ、打撃の狙いやすさ、CPU打者の強さまで同時に変わる一方、守備専用の選択肢は現れない。希望した遊び方を設定画面で作れない状態である。
- 真因: `baseball3d.html:949,1022,1031,3475,4255-4260` — 状態は `let DIFF_I = 1;` の1個だけで、投球は `dur:P.dur*SPD[DIFF_I]`、CPU打撃は `const sk = DIFF[DIFF_I].cpu;`、プレイヤー打撃は `const D0=isPlayerBatting()?DIFF[DIFF_I]:CPU_WIN;` を同じ値から読み、画面も `b.onclick=()=>{ DIFF_I=i; ui();};` の1組しか作らない。
- 深さ: 実行。`b0805-06`で3設定を各3回切り替えた。毎回、操作名は`DIFF_I`の1個だけで、投球時間は0.8424/0.6968/0.5720秒、打撃許容は118/94/74、CPU能力は0.70/0.85/1.12へ同時に変わった。9野手の速度列は3設定とも完全同値だった。独立設定3個という期待に対し3/3 FAILで、OI-169は未解決。
- 再現: `review_sol_ultra_repro_20260805.js` 内の `runPhase3UnresolvedB`（`node review_sol_ultra_repro_20260805.js --phase3-unresolved-b`、結果の`OI-169`）。
- 修理案: `batDifficulty`・`pitchDifficulty`・`fieldDifficulty`を別状態・別ボタンにし、打撃判定は打撃値、投球の見やすさと精度は投球値、守備反応・捕球・送球は守備値だけを読む。打撃設定を変えた場面では投球時間・CPU打撃・野手能力を変えず、投球設定では打撃許容・守備を変えず、守備設定では投球・打撃を変えない。
## 所見10: 場外へ出た悪送球を追球扱いに戻し、2個の進塁権もプレー終了も適用しない
- 目的への影響: ベンチや観客席へ入って本来デッドになる悪送球でも守備が追い続け、走者は投球時から2個先を保証されない。オーナーには競技区域外の球を野手が回収し続ける不自然なプレーとして見え、進塁結果も野球規則と食い違う。
- 真因: `baseball3d.html:2927-2936,2108-2120` — 場外のエンタイトル処理は打球側の `if(dist>fd && Math.abs(ang)<=45.5){` と `finishPlay(ball.landed ? resolveHit(4.6,{x:ball.x,y:ball.y},true) : resolveHomer());` にだけあり、送球側は `if(!T.chased ... ) T.chased=true;`、`setTarget(T.receiver, ball.x, ball.y);`、最後に `if(T.chased && T.t>8) return concludePlay();` と追球・時間切れへ進むだけである。
- 深さ: 実行。`b0805-06`で走者を一塁、送球を中心から400ft（同方向のフェンス330ft）に置く場外状態を3回実行した。毎回、更新後は`chased=true`、`stage=fly`、`concludePlay`呼出し0、走者goal=1のままで、期待したgoal=3・即時終了は0/3。OI-171は未解決。
- 再現: `review_sol_ultra_repro_20260805.js` 内の `runPhase3UnresolvedB`（`node review_sol_ultra_repro_20260805.js --phase3-unresolved-b`、結果の`OI-171`）。
- 修理案: 送球更新の先頭で球がベンチ・観客席など競技区域外へ越えた瞬間を検出し、投球時の各走者位置を基準に2個先へgoalを確定して球をデッドにし、プレーを1回だけ終了する。フェア区域内の通常送球、フェンスで跳ね返る球、捕手後方でも競技区域内に残る球、通常の打球フェンス越えではこの送球規則を発動しない。
## 所見11: 結果表示の時間が切れると、球が空中で動いていても次のプレーへ進む
- 目的への影響: 打球や返球がまだ画面内を飛んでいる最中に結果表示が消え、次の打者へ切り替わり得る。オーナーが指摘した「送球が空中のときにプレーが打ち切られた」を、見た目だけ動かして終了条件は直していない。
- 真因: `baseball3d.html:3427-3445` — 結果画面中も `if(ball && !throwAnim && Math.hypot(ball.vx||0, ball.vy||0, ball.vz||0)>3){ stepBall(ball, dt); ... }` で球を動かす一方、終了側が待つ条件は `if(moving && !S.quickPlay && S.playWait < 5.0) break;` という走者だけで、直後に `setMsg(''); afterPlay();` を実行する。球が空中か・速度を持つかの門番が無い。
- 深さ: 実行。到達可能な`play`状態へ高さ20ft・速度53.852ft/sの球を注入し、結果タイマー2.2秒から更新する関数契約テストを3回行った。毎回133フレーム後、球は高さ47.762ft・速度29.440ft/s、42.188ft移動したライブ状態のまま`afterPlay`が1回発火した。3/3 FAILでOI-213は未解決。通常の打席開始からこの状態へ至る自然経路の発生率は未測定。
- 再現: `review_sol_ultra_repro_20260805.js` 内の `runPhase3UnresolvedB`（`node review_sol_ultra_repro_20260805.js --phase3-unresolved-b`、結果の`OI-213`）。
- 修理案: 結果表示の終了門番へ「球が空中、転動中、または送球中なら待つ」を走者条件と同列に追加し、球が静止・捕球・規則上デッドのいずれかになるまで`afterPlay`を呼ばない。野手の手中で速度0の球、ファウルや場外で既にデッドになった球、全状態が静止済みの場面では待機を発動しない。
## 所見12: 外野を転がる悪送球は、球速が残っていても追球開始から8秒で強制終了する
- 目的への影響: 悪送球が外野を転々として野手がまだ追っている最中にプレーが消え、走者の進塁機会と守備の回収結果が途中で打ち切られる。オーナーが見た症状を時間だけで再発させる経路が残っている。
- 真因: `baseball3d.html:2109-2120` — 追球中は最寄り野手を選び直して `setTarget(T.receiver, ball.x, ball.y);` するが、その直後に球速・走者位置・回収完了を調べず `if(T.chased && T.t>8) return concludePlay();   // 収拾できなければプレーを閉じる` を実行する。
- 深さ: 実行。`b0805-06`で外野の転動球を速度15.524ft/s、`chased=true`、追球時刻7.999秒に置き、0.01秒進める試験を3回行った。毎回、球が座標(250.125, 200.033)、高さ0.198ftで動いているまま時刻8.009秒に`concludePlay`が1回発火した。3/3 FAILでOI-230は未解決。
- 再現: `review_sol_ultra_repro_20260805.js` 内の `runPhase3UnresolvedB`（`node review_sol_ultra_repro_20260805.js --phase3-unresolved-b`、結果の`OI-230`）。
- 修理案: `T.t>8`だけの終了を削り、球が静止または野手に回収済み、全走者が整数塁で停止、入力なし、未決着のタッグ・送球なしを同時に満たした時だけ閉じる。球が転動・空中・送球中、走者が塁間、進塁入力中、野手が回収中の場面では時間にかかわらず発動しない。
### 所見1 実行追記 — OI-144の20秒境界を独立確認

`runPhase3UnresolvedB`のOI-144を3回実行した。毎回、走者をp=1.50の塁間に置いたまま、開始時刻12.001秒では12.002秒・`concludePlay` 0回、19.998秒では19.999秒・0回、20.001秒では20.002秒・1回となった。20秒を越えた3/3で塁間走者が残ったまま終了したため、OI-144の絶対要求「塁間で終了0」は`b0805-06`で**未解決**。真因は既存所見1の`baseball3d.html:1884-1887`にある同じ最終時間切れであり、新規所見には数えず、所見1の実行証拠へ追加する。

再現入口は `review_sol_ultra_repro_20260805.js` 内の `runPhase3UnresolvedB`（`node review_sol_ultra_repro_20260805.js --phase3-unresolved-b`、結果の`OI-144`）。
### 工程3：固定無作為抽出20件のうち未実行17件の敵対的実行確認

凍結対象 `b0805-06`（SHA-256 `2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183`）に対し、既存の `bootGameInVm` と無描画の計測用preludeを使って、未実行17件を各3反復、合計51試行した。判定は **PASS 16件 / FAIL 0件 / 再現不能（手順つき）1件**。OI-139は記録・保存機構そのものが3/3成功したが、「利用者の追加説明なしで未知の不具合を改善まで完結できる」というOWNERの最終成果は受け渡し後の診断工程を含む。再現手順は「F/Gで保存したJSONを別セッションへ渡し、追加説明なしに症状特定・修理・同一録画で再検証まで完走できるかを観測する」であり、このVM内では受け渡し後を実行できないためPASSへ丸めず再現不能とした。新規FAILがないため、本表から所見は追加しない。

| ID | OWNER原文 | 事前固定oracle | 主要観測（3反復） | 反復 | 判定 |
|---|---|---|---|---:|---|
| OI-032 | 打球が飛んでいる間に Shift（またはボタン）で、走者が塁打数より1つ多く狙います：どういうことですか？進塁と帰塁キーの二つを用意したらいいだけでは？ | Sで次塁、Xで帰塁という2操作が働く。 | 3回とも、走者p=1.2からSで`goal=2, cmd=S`、Xで`goal=1, cmd=X`。 | 3/3 | PASS |
| OI-155 | サードの送球がファーストの頭より明らかに高いのにファーストに吸い込まれました | 受け手と水平距離0でも高さ9.5ft超なら捕球せず、悪送球として通過させる。 | 高さ13/14/15ftはいずれも`stage=fly`を維持し`sailed=true`。捕球への吸い込みなし。 | 3/3 | PASS |
| OI-033 | やっぱり矢印キーじゃなくてs,z,x,cキーがいいです | 守備中の実キーイベントがS=二塁、Z=三塁、X=本塁、C=一塁へ対応する。 | 各反復で実keydownを送信し、S→2、Z→3、X→4、C→1を確認。 | 3/3 | PASS |
| OI-139 | プレイを録画してあなたが改善するときにいちいち説明しなくても改善できるようにすることはできますか？ | 0.1秒状態記録を保持し、Fで直前1プレー、Gで全プレーをbuild付きJSONとして保存する。 | F/Gとも保存成功。プレー数は1/2、両JSONに`b0805-06`、各プレーに1フレーム。機械部分は3/3成功。そのJSONを別セッションへ渡し、追加説明なしで症状特定→修理→同一録画再検証まで観測する必要がある。 | 3/3（機械部分） | **再現不能（手順つき）** |
| OI-116 | 守備にスライディングキャッチを実装してほしいです（どれだけの距離を飛びつけるかは守備力に依存します） | 同じ6.4ftの打球を守備力100は飛び込み捕球し、守備力1は届かず、到達距離も能力依存になる。 | 守備力1は`flight, diveT=0, reach=1.2875`、守備力100は`throwing, diveT=0.7, reach=5`。画面上のモーション品質は未確認。 | 3/3 | PASS |
| OI-011 | 変化球が変化していなかったり | カーブ・フォーク・シュートすべてで、軌道中点が直線軌道から0.2ft超変位する。 | 変位量はカーブ0.7438ft、フォーク0.7759ft、シュート0.4419ft。 | 3/3 | PASS |
| OI-069 | ランナーが複数人いるときに、一人がホームインするとつっかえてしまって、二人目以降が三塁から進めない現象が起きているので修正して | 先行走者が生還済みなら、後続走者が本塁をgoalにでき実際に到達する。 | 先行p=4・後続p=3で、後続は`goal=4`となり237フレームでp=4へ到達。 | 3/3 | PASS |
| OI-115 | 明らかに内野の頭の上を超えている打球がたびたびライナーで捕球判定になるので修正してほしいです | 内野手の真上でも捕球上限8.6ftを超える打球は捕球せず、過去の最接近距離も残さない。 | 高さ9.2/12/18ftはいずれも`flight`継続。頭上通過時の最接近値は保持されず、25ft先・高さ5ftへ移した後も遡及捕球なし。 | 3/3 | PASS |
| OI-006 | 変化球がちゃんと変化していない | カーブ・フォーク・シュートの軌道中点が直線軌道から0.2ft超変位する。 | 変位量はカーブ0.7438ft、フォーク0.7759ft、シュート0.4419ft。 | 3/3 | PASS |
| OI-076 | 2アウトの時は打ち上げてもランナーは止まらずに自動スタートしてほしいです | 2アウトでは捕球可能な高い飛球でも、入力なしで既存走者が次塁へスタートする。 | 一塁走者で3回とも`forcedGo=true, goal=2, v=12.5`。 | 3/3 | PASS |
| OI-224 | ミートカーソルは横長の楕円であるべきで、〇なのはバットの形状からしておかしいので修正して | 描画用楕円が横長で、同じ距離なら横ずれを許し縦ずれを拒否する当たり判定になる。 | 描画関数の外寸は幅1.08・高さ0.54・比率2:1。同じ1単位ずれで横は命中、縦は非命中。最終ピクセルのアンチエイリアス等は未確認。 | 3/3 | PASS |
| OI-016 | ワンバウンドしてフェンスに直撃したらエンタイトルツーベースになる問題が直っていません | 着地済み・高さ9.4ft未満の壁直撃は二塁打確定せず、反射してflightを続ける。 | 着地済み、高さ2ft、外向き速度100ft/sで壁へ入れ、3回とも`wallHit=true`、反射後`vy=-34.981`、`phase=flight`。 | 3/3 | PASS |
| OI-199 | いつも内野ゴロのときにファーストが1塁より後ろでボールをとるようになったせいで極端に内野安打が増えています。おそらくボールがそれたときに取りに行くプログラムが悪さをしていると思います。二塁打や三塁だとの気も同様の問題があるのでいい感じに修正して | 三・遊・二から一塁への通常送球では、一塁手が塁後方へ動かず塁上でcatchへ入る。 | 三塁手・遊撃手・二塁手から各1回。全て`stage=catch, sailed=false`、一塁手の塁からの距離0ft、目標最大ずれ0ft。 | 3/3 | PASS |
| OI-007 | ファーストとサード、セカンドとショート、ライトとレフトが逆になっています | 一・二・右=+X、三・遊・左=-Xで、一三塁手が対応する塁に近い。 | X座標は一52、三-52、二34、遊-34、右152、左-152。一三塁手の対応塁距離21.74ft、反対塁117.09ft、左右補正`MIRROR[0]=-1`。最終ピクセルは未確認。 | 3/3 | PASS |
| OI-123 | バウンドが大きい打球だとcpu守備がまっすぐ近づいた結果がバウンドが大きいせいで頭の上を超えて後逸することが多いので、バウンドに合わせるようにしてください | 現在地でなく、将来の捕球可能高さ6.2ft以下となる軌道点を迎えに行く。 | 3条件で現在地から51.104〜63.799ft先を目標化。予測軌道との最小距離0ft、その地点の高さ0.345〜1.004ft。 | 3/3 | PASS |
| OI-198 | エラーした後の硬直時間が長いので直して | ゴロエラーの硬直は約0.30秒、再計画待ちは最大0.25秒で、0.32秒以内に移動を再開する。 | 3回とも硬直0.30秒、再計画待ち0.25秒、移動再開0.31秒。 | 3/3 | PASS |
| OI-121 | 依然として内野の頭を超えた打球がライナーキャッチ判定される | 再指摘条件でも高さ9.2/12/18ftの頭上通過を捕球しない。 | 3高度すべてで`flight`継続、捕球判定なし、遡及捕球なし。 | 3/3 | PASS |

実行前後の対象SHA-256はともに `2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183` で不変だった。既に別経路で実行済みの OI-088 / OI-219 / OI-228 はこの17件から除外した。

## 所見13: 無入力の打者走者へ本塁進塁を自動指定し、三塁で止まらずタッチアウトになる
- 目的への影響: オーナーが進塁を指示していないのに、三塁で止まるはずの打者走者が本塁へ向かい、得られていた三塁打を自動走塁で失う。
- 対応owner指摘: OI-052「sを押していないのに、打ったバッターは三塁で止まらずに勝手にホームに向かってアウトになりました」
- 真因: `baseball3d.html:1705-1709,1754-1757`。逐語: `const m = re - te - ((b===4)?0.35:0.05);` に対し、走塁側は `const slack=(r===lead)?0.55:1.35;` と `if(runnerETA(r,b) < throwETAof(f,b)+slack) best=b; else break;` を使う。差が0.35〜0.55秒の領域では、守備が「刺せる」と判断する本塁へ走塁側が同時に自動進塁を選ぶ。
- 深さ: 実行。`b0805-06`で、打者走者を三塁直後`p=3.05/3.15`、S/Z/X・`cmd`なしに固定し、速度4段階×中堅距離9段階×2位置×3反復の216条件を実行。216/216で`goal=4`が自動設定され、61/216でその走者がタッチアウトになったため、旧症状は**未解決（FAIL）**。
- 再現: `review_sol_ultra_repro_20260805.js`内の`reproFinding13UncommandedHomeAdvance`（`node review_sol_ultra_repro_20260805.js --finding13`）。数値oracleは「無入力・`cmd`なしで`goal>=3.99`が自動設定され、その走者が`out=true`」。
- 修理案: 走塁と守備で別々の猶予値を使わず、同じ到達時刻比較から「進む／止まる／五分」を一度だけ決める。本塁への自動進塁は少なくとも守備側が確実アウトと判定する領域では禁止し、五分の進塁はS入力がある場合だけ許す。三塁以前の通常自動進塁、明示S入力、送球逸れ後の再進塁は抑止しない。
## 所見14: 守備の送球先が走者の内部goalに依存し、同じ動きでも攻撃側の意図だけで変わる
- 目的への影響: 画面上の走者位置・速度・守備配置が同じでも、守備が見えないはずの走者の内部目標により送球先が変わる。守備判断が現場の状態ではなく攻撃側の思考変数を先読みする。
- 対応owner指摘: OI-056「中継が本塁へ投げたのも、これが原因の可能性が高い：そもそも守備の思考が走塁の思考と独立していないのがおかしいです / 守備は守備でその場で最適な行動をとるべきです」
- 真因: `baseball3d.html:1379,1655-1659`。逐語: `r.dir = r.p<r.goal-1e-6 ? 1 : (r.p>r.goal+1e-6 ? -1 : 0);` で内部`goal`から方向を作り、守備側は `const live=runners.filter(r=>!r.out && (` に続いて `r.dir>0` を送球候補条件にする。実際の位置・速度が一切変化していないゼロ時間でも、`goal`だけで候補集合が変わる。
- 深さ: 実行。`p=2.18/2.42/2.68`、`v=18`と各野手状態を固定し、`goal=3`と`goal=2`だけを入れ替えた比較を3反復実行。全3反復で、前者は三塁送球、後者は投手返球となった。物理状態は同一のため、旧症状は**未解決（FAIL）**。
- 再現: `review_sol_ultra_repro_20260805.js`内の`reproFinding14DefenseReadsRunnerGoal`（`node review_sol_ultra_repro_20260805.js --finding14`）。数値oracleは「同一`p`・`v`・守備状態で`goal`だけにより`chooseThrowTarget().nb`が変化」。
- 修理案: 守備用の走行方向を内部`goal`から作らず、直前位置との差または実際の速度符号から更新する観測値へ分離する。ゼロ時間更新では直前の実移動方向を維持し、停止走者は位置・封殺関係・到達時刻だけで判断する。攻撃側の`goal`と`cmd`は守備の送球先選択から参照しない。
## 所見15: けん制のカバー待ち中止経路が、生存走者を塁間に残したままプレーを直接終了する
- 目的への影響: 挟殺から送球準備へ移った走者がまだ塁間を移動中でも、守備側のカバー待ち時間だけで結果画面へ移り、走者操作とタッグ機会が失われる。
- 対応owner指摘: OI-137「まだランナーが挟まれた時に強制的にプレーが打ち切られたり」
- 真因: `baseball3d.html:1956-1969`。逐語: `if(T.t < T.transfer + 2.6) return;` の直後に `return concludePlay();                     // それでも間に合わない＝中止` がある。通常の`allSettled`・塁間走者・未決着走者の門番を通らない。
- 深さ: 実行。同一seedの挟殺状態を毎回新しいVMで3反復。全3回で`playClock=6.283`、走者`p=3.15`、`goal=3.1`、未アウト、塁間、`throwPlay.stage='transfer'`の瞬間に`concludePlay`が呼ばれた。旧症状は**未解決（FAIL）**。
- 再現: `review_sol_ultra_repro_20260805.js`内の`reproFinding15PickoffCoverTimeoutEndsMidBase`（`node review_sol_ultra_repro_20260805.js --finding15`）。数値oracleは「`concludePlay`呼出時に対象走者が`out=false`かつ整数塁から0.02以上離れている」。
- 修理案: けん制中止を`concludePlay`直行にせず、球を投手保持へ戻したうえで共通の終了可否判定へ渡す。生存走者が塁間または目標塁未到達ならプレーを継続し、全走者が塁上で停止した場合だけ終了する。3アウト成立済みや走者なしの通常けん制中止は従来どおり即時終了できる。
## 所見16: 既存16テストが全PASSでも、現存する3欠陥を直接測る検査がない
- 目的への影響: ハーネスの16/16合格を品質保証として扱っても、無入力の本塁暴走、守備判断への攻撃意図漏洩、挟殺後の強制打切りが残る。検査対象外の症状には、緑の件数が増えても検出力は生まれない。
- 対応owner指摘: OI-063「どうしてあなたのチェックではこのような私が指摘している大量のミスを見つけられないのですか？」
- 真因: `_test_harness_20260804.js:321-412`。逐語: `// ===== test12: 走者の行き先が捕球の瞬間に反転しないか`、`// ===== test13: 本塁に届いていない走者を得点にしないか`、`// ===== test14: 走者が塁間にいる間に時間切れで打ち切らないか` の3固定fixtureだけが今回系統の追加検査であり、OI-052の無入力三塁通過、OI-056の守備判断独立性、OI-137のけん制中止直行を直接測るoracleはない。
- 深さ: 実行。正本ハーネスを通常条件の新規VMで3回実行し、各回16/16 PASS。工程0で`test12/13/14`は修正前`b0804-33`をFAIL、現行`b0805-06`をPASSに分離でき、既知3系統への検出力は確認済みだった。追記器で既知変異3種も各1回実行し、`test12`は12試行、`test13`は8試行、`test14`は6試行で、対応変異を全てFAILとして検出した。一方、同じ現行版で独立所見13〜15がFAILとなり、既存16本には対応検査がない。したがって「既存検査が通っても大量の指摘型を見つけられない」という旧症状は**未解決（FAIL）**。ハーネス全体へ一律`Math.random=0.5`を与えた追加試行は、`test3`と`test13`のfixture前提を変えたため正本実測から除外した。
- 再現: `review_sol_ultra_repro_20260805.js`内の`reproFinding16HarnessCoverageGap`（`node review_sol_ultra_repro_20260805.js --finding16`）。数値oracleは「既存16本の通常実行が完了しても、独立検証で現存FAILが1件以上残り、その症状を直接測る専用testがない」。
- 修理案: 所見13〜15の数値oracleをそれぞれ独立テストとして追加し、全テストの先頭でテスト固有seedを固定・末尾で必ず復元する。正常版は全seedでPASS、各変異は対応テストが必ずFAILすることを採用条件にする。owner ID→検査名→破壊する変異の対応表も工程5で固定し、単なる件数合格を保証として使わない。
### 3-A. 残存・退行候補の独立実行 — PASS 5件／再現不能（手順つき）1件

凍結版`b0805-06`、SHA-256 `2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183`をNode VM・無描画スタブで実行した。判定語は、PASS＝下記の事前固定した数値oracle内で旧症状なし、再現不能＝原文から状態・数値閾値・終了条件を一意に作れない、を意味する。PASSはゲーム全体でのバグ不存在を意味しない。

| OI | owner原文 | 独立状態と数値oracle | 3反復の観測 | 判定 |
|---|---|---|---|---|
| OI-008 | 「全体的に粗すぎるのでちゃんと精査して」 | 新規VMでbuild・phase・野手9人・座標有限性を確認。ただし「粗い」に対応する数値閾値と表示終了条件がない。再現手順は同じ1920×1080構図を比較対象画像と並べ、輪郭・材質・照明の合格閾値を先に固定して第三者盲検する | 3/3で初期化成功。比較画像と合格閾値が無いため、見た目の粗さは無描画VMで真偽を決められない | **再現不能（手順つき）** |
| OI-060 | 「ツーベースヒットを打って、二塁を回って三塁に向かったのですが、セカンドがサードに投げたらあきらかにアウトのタイミングだったのに、セカンドがボールをとった時点でスリーベース判定になり、プレーが打ち切られました」 | 二塁直後`p=2.08/2.22/2.36`、低速走者、二塁手から三塁へ明示送球。未アウトかつ`p<2.98`で`concludePlay`なら旧症状 | 3/3で先にタッチアウト。終了呼出時`p=2.402/2.434/2.389`はいずれも`out=true` | **PASS** |
| OI-073 | 「ランナーが塁間にいるときにプレイが打ち切られることがちょこちょこあるので修正して」 | 実打球から送球状態を作り、走者を一・二塁間`p=1.18/1.50/1.82`、`playClock=11.85`へ固定。生存塁間で`concludePlay`なら旧症状 | 2件は終了時にアウト済み、1件は二塁到達済み。生存塁間終了0/3 | **PASS** |
| OI-080 | 「走者が塁間で打ち切られる：直っていません」 | 一・二塁走者あり、無入力の実打球3経路。`concludePlay`時に生存塁間走者が1人以上なら旧症状 | 3経路とも終了呼出時の生存塁間走者0 | **PASS** |
| OI-140 | 「私の攻撃時に、内野ゴロでランナーが自動スタートしたのに、内野がゴロを補給すると勝手に戻ってしまいます」 | 三塁へ自動進塁した二塁走者について、`goal>=3`観測後にgoalが0.01以上低下すれば旧逆走 | 3/3で最初の送球時も`goal=3`、低下0回、最終三塁到達 | **PASS** |
| OI-238 | 「セカンドごろでセカンドランナーが三塁に走っていたのにセカンドが打球をとった瞬間に勝手にセカンドに戻り始めた」 | 指摘相当の二塁走者・内野打球を3seedで実行。捕球時に三塁向きgoalが二塁へ低下すれば旧症状 | 3/3で最初の送球時`p=2.440, goal=3`、低下0回、最終`p=3` | **PASS** |

FAIL 4件は所見13（OI-052）、所見14（OI-056）、所見15（OI-137）、所見16（OI-063）として個別保存する。全10件の機械結果は`runPhase3UnresolvedA`が返す。

## 所見17: OI-133の「MLB The Show級」には実画面が到達していない
- 目的への影響: 「遊んでいてバグに出会わない」という最上位目的への直接の機能毀損ではないが、毎投球で角張った箱型選手と単純な球場が見え、次順位の「リアルさ」を常時毀損する。Playwright実ブラウザで凍結版を3回リロードし、3回とも同じ低ポリゴン形状を確認した。
- 真因: `baseball3d.html:664,667-673` — `function buildPlayer(shirt, pants, skin, cap){` に続き、胴・肩・首・帽子を `box(...)`、頭を `sphere(..., 10)` だけで構成している。外観、人体、材質、照明、演出をMLB The Show級へ上げるモデル・骨格・物理ベース材質の入力がない。
- 深さ: 実行。凍結版 `b0805-06` をlocalhostで実ブラウザ表示し、打席画面を3回リロードしてスクリーンショットを目視した。ページタイトルも3回とも `BASEBALL 3D — 投打守フル [b0805-06]`。選手は箱形の胴体・四肢と単色面のままで、目標を3/3で満たさなかった。
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding17TheShowVisualGap`。同関数が出す4段階のブラウザ手順を実施する。
- 修理案: 単一HTMLの自作プリミティブを選手描画の正本にせず、外部glTF選手・骨格アニメーション・物理ベース材質・影付き照明・専用カメラを一体で読み込む。タイトル画面やHUDなど写実3Dを表示しない場面では発動せず、試合3D画面だけに適用する。



## 所見18: OI-217の「実写と見間違えるテクスチャ」は地面以外に実装されていない
- 目的への影響: 最上位のバグ回避を直接壊す挙動ではないが、プレー中に最も注視する選手・帽子・ユニフォーム・フェンスが単色のままなので、次順位のリアルさは毎プレーで未達と分かる。
- 真因: `baseball3d.html:351` — `を1枚の高解像度テクスチャ(2048px)で地面だけに貼る。選手・フェンス等は従来の頂点色。`。実際の生成も `baseball3d.html:374` の `const N=2048, cv=document.createElement('canvas')` による地面1枚であり、人物や設備には写真・法線・粗さ・金属度の各材質がない。
- 深さ: 実行。Playwright実ブラウザで3回描画し、芝の縞はある一方、選手の肌・布・革・帽子、フェンス、マウンドは写真質感ではなく平坦な色面だった。3/3で「実写と見間違える」を満たさなかった。
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding18PhotorealTextureGap`。同関数の素材構成検査と4段階のブラウザ手順を併用する。
- 修理案: 選手・用具・球場ごとに色、法線、粗さ、遮蔽の各テクスチャを外部資産として読み込み、物理ベースのシェーダーで表示する。低品質設定と2Dのスコア/HUDでは発動させず、高品質の試合3D画面だけで有効にする。



### 3-3. 残存対象BのPASS・限定PASS・実画面判定

実行入口は `runPhase3UnresolvedB`。凍結版 `b0805-06` を各ID 3回実行した。OI-133/OI-217はNode VMの視覚保留をそのまま結論にせず、Playwright実ブラウザで同じ凍結版を3回描画して最終判定した。

| OI | 固定した期待 | 3回の主要観測 | 判定 | 限界 |
|---|---|---|---|---|
| OI-141 | 遊・三正面では二塁走者停止、二・一方向または難しい打球では三塁へ | 遊5ftはgoal=2.085・速度0、二5ftと遊25ftはgoal=3・速度11 | **PASS** | 走塁判断を隔離。実打球の発生分布は未測定 |
| OI-186 | エラー直後もライブ継続 | p=1.5、goal=2、phase=flight、finish 0、球速11.177ft/s | **PASS（限定）** | `deflectBall`直後だけ。全エラー終端は未網羅 |
| OI-237 | 右翼手が追跡途中に無指示停止しない | 104mph・10°・18°を272フレーム、最大速度26.099、停止0、担当右→右 | **PASS（限定）** | OWNER録画が無く、同一プレーではなく候補1軌道 |
| OI-133 | MLB The Show級 | VMでは生成経路を3/3確認。続けて実ブラウザを3回描画し、箱型選手・単色面・簡易照明を3/3で確認 | **FAIL** | 同一構図のThe Show画像との数値採点ではなく、要求を満たさない明白な反例の目視 |
| OI-217 | 実写と見間違えるテクスチャ | VMでは2048px地面1枚・52,015 fillRect。実ブラウザ3回とも芝以外の選手・用具・フェンスは平坦な頂点色 | **FAIL** | 第三者盲検までは未実施。ただし「実写と見間違える」合格を否定する反例は3/3で成立 |

OI-133とOI-217の再現は所見17・18に分離した。PASSは表の条件内だけであり、バグの永久不存在へ一般化しない。


## 所見19: 高い飛球で三塁走者だけを選んでも、打者走者のgoalが一塁から本塁へ巻き戻る
- 目的への影響: 一・三塁のタッチアップで三塁走者だけを発進させるOWNER操作が、無関係な打者走者の一塁到達指示を消す。三塁走者は捕球後に本塁へ発進でき、`3+X`で三塁へ帰塁もできるが、「別々に動かす」というOI-152の中心要件を満たさない。既存所見8と同じ真因の、別OWNER場面での再現である。
- 真因: `baseball3d.html:4096-4106`。逐語: 打者走者分岐 `if(r.origin===0){` 内で `r.goal=Math.max(here, Math.min(here+1, max, 4)); r.cmd='S';` と書いた後に、対象外を除く `if(picked && r!==picked) return;` がある。一塁走者`goal=1`のため`max=0`となり、`3+S`でも打者走者`goal`を1→0へ上書きする。
- 深さ: 実行。凍結版`b0805-06`、SHA-256 `2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183`、0死、高い捕球可能飛球、打者走者と一三塁の条件で5反復した。三塁走者の`tagUp=true`と捕球後`goal=4`は5/5、`3+X`帰塁`goal=3`も5/5成功した一方、`3+S`直後の打者走者`goal`は5/5で1→0となった。一塁走者`goal=1`は5/5で不変だったため、旧症状は**未解決（FAIL）**。
- 再現: `review_sol_ultra_repro_20260805.js`内の`reproFinding19TagUpSelectionLeaksToBatter`（`node review_sol_ultra_repro_20260805.js --finding19`）。
- 修理案: `picked`または`leadOnly`で対象が限定されている時の対象門番を`origin===0`分岐より前へ移し、対象外の打者走者には`goal/cmd/tagUp`を書かない。通常Sで打者走者を進める場合、打者走者自身が先頭となるZ、選択キーなしの自動走塁ではこの抑止を発動しない。捕球済み、ファウル、打者走者アウト後にも一塁必達の下限を誤適用しない条件を併記する。
### OI-088同型・OWNER系列全体の実行補完

凍結版 `b0805-06`（SHA-256 `2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183`）を無描画Node VMで実行した。対象はOWNER正本で個別走塁操作の系列を構成する `OI-059 / OI-086 / OI-088 / OI-152 / OI-165 / OI-219 / OI-228` の全7件。各OIを5反復し、計35回のOI単位反復を行った。追加3件では各反復内に複数の進退場面を置いた。実行前後の凍結HTML hashは一致した。

実行入口は `review_sol_ultra_repro_20260805.js` へ追記する `runPhase3ControlScopeFull`（`node review_sol_ultra_repro_20260805.js --phase3-control-scope-full`）。

| OWNER ID | OWNER原文（正本行） | 実行した条件とオラクル | 5反復の観測 | 判定 |
|---|---|---|---|---|
| OI-059 | 「複数ランナーがいるときは打ったバッターもランナーも帰塁ができません」（`OWNER_ISSUE_MASTER_20260805.md:325`） | 打者走者・一塁走者・二塁走者を置き、全体S進塁、全体X帰塁、`2+S`個別進塁、`2+X`個別帰塁の4場面を各反復で確認。対象外走者を変更せず、追い越しも起こさないこと。 | 4場面×5反復＝20/20 PASS。全体進塁goal `[1,2,3]`、全体帰塁goal `[1,2,3]`、個別進塁 `[1,1,3]`、個別帰塁 `[1,1,2]`。 | **PASS** |
| OI-086 | 「ランナー1,3塁の時は重盗を仕掛けたいことがあるのですが、今は盗塁時は盗塁するランナーしか動かせないし、途中で戻れないようになっているので、打球処理時と同じように操作できるようにしてほしいです」（`:464`） | `S.stealing=true`・送球中・一三塁で、全体S重盗、全体X帰塁、`3+S`三塁走者だけ進塁、`1+X`一塁走者だけ帰塁を確認。途中位置からgoalとcmdが個別に変わること。 | 4場面×5反復＝20/20 PASS。全体進塁 `[2,4]`、全体帰塁 `[1,3]`、三塁だけ進塁 `[2,4]`、一塁だけ帰塁 `[1,4]`。対象外走者のcmdは未設定のまま。 | **PASS** |
| OI-088 | 「例えばランナー2塁の時にセンター前ヒットでセカンドランナーを本塁に返したいときに、先に打ったバッターが一塁に到達していると、セカンドランナーを本塁に向かわせるために、打ったバッターが1塁を回って1,2塁間で挟まれないといけません。ランナーの個別操作もできるようにしてほしいです」（`:474`） | 高い捕球可能飛球中、打者走者は一塁到達済み、二塁走者は本塁方向。Zで先頭走者だけを進め、打者走者goalを1に保つこと。 | 0/5 PASS。5/5で打者走者goalが1→2へ変化。 | **FAIL（既存所見7）** |
| OI-152 | 「ランナーを別々に動かせるようにしてほしいです（例えばランナー一三塁でタッチアップで3塁ランナーだけスタートみたいな感じ）」（`:800`） | 0死・高い捕球可能飛球・打者走者と一三塁。`3+S`で三塁走者だけタッチアップ準備→捕球後に本塁へ発進し、`3+X`では三塁へ帰塁すること。全過程で打者走者・一塁走者へ漏れないこと。 | 三塁走者のtagUp設定と捕球後goal=4は5/5 PASS、三塁だけの帰塁goal=3も5/5 PASS。しかし`3+S`直後、5/5で対象外の打者走者goalが1→0へ巻き戻った。 | **FAIL（所見19）** |
| OI-165 | 「ランナーを個別操作したいのですが、先頭の奏者だけしか個別操作できないので、ランナー1,3塁の時1塁ランナーだけを動かせないです」（`:865`） | 高い捕球可能飛球中、打者走者と一三塁。`1+S`で一塁走者だけを選び、打者走者goal=1・三塁走者goal=3を保つこと。 | 0/5 PASS。一塁走者はgoal=1.45となる一方、5/5で打者走者goalが1→0へ巻き戻った。 | **FAIL（既存所見8）** |
| OI-219 | 「フライの時はバッターが1塁より先にsを押しても進めないのも修正して」（`:1135`） | 高い捕球可能飛球中、打者走者p=1.05でSを押し、goal=2となること。 | 5/5 PASS。毎回goal=2。 | **PASS** |
| OI-228 | 「挟殺プレーでユーザーが操作できないのも謎ですし」（`:1180`） | 挟殺stage・走者p=1.5でSを押し、通常の走者操作経路を通ってgoal=2となること。 | 5/5 PASS。毎回goal=2。 | **PASS** |

結論: 系列全体では **4 PASS / 3 FAIL**。追加対象だけでは OI-059・OI-086がPASS、OI-152がFAIL。OI-152の三塁走者そのものの発進・帰塁は動くが、「三塁だけ」という選択範囲が打者走者へ漏れるため、OWNER要求全体としては未解決である。OI-088・OI-152・OI-165の3 FAILは、いずれも高い飛球中に走者選択の門番より先に打者走者分岐を実行する同じ真因へ収束する。

### 3-4. 両者「解決」無作為20件の最終集計と同型展開

事前固定した20件は `OI-088,032,155,033,228,219,139,116,011,069,115,006,076,224,016,199,007,123,198,121`。選定後に入替えはしていない。判定は **PASS 18 / FAIL 1 / 再現不能 1**。FAILはOI-088（所見7）、再現不能はOI-139（owner原文だけでは表示タイミングと数値oracleを一意に固定できない）。OI-228は挟殺中Sで5/5 `goal=2`、OI-219は高い飛球中に一塁を越えた打者走者へSで5/5 `goal=2`を明示観測した。残り17件は`runPhase3Random17`の51試行でPASS 16、FAIL 0、再現不能1だった。

20件中1件でも覆ったため、OI-088と同じ「個別走者操作」系列を開始時OWNER正本から全抽出し、OI-059/086/088/152/165/219/228の7件を各5反復した。結果はPASS 4 / FAIL 3。追加したOI-059は4場面×5反復の20/20 PASS、OI-086も4場面×5反復の20/20 PASS、OI-152は三塁走者自体の発進・帰塁には成功したが対象外の打者走者を5/5で書き換えたためFAIL（所見19）。したがって標本1件の反例を「1/20だけ」と縮小せず、同じ適用条件の全OWNER系列へ拡張済みである。
### 工程3中の材料更新と固定範囲

依頼本文と`REVIEW_SYNTHESIS_20260805.md:3-4`が指定する241件版はcommit `0751399527208554ab9d17e03d71dcbf46fd72c8`（SHA-256 `DA1C24534183BA5809EBE47CA845A5EDAB96D6D3E84B5E2FA4D9F7924FE37141`、OI-001〜241）である。工程3中に観測した中間版はOI-242〜251を末尾追加したcommit `a49a26b49bf24c66cf092f2164b5395f6edac198`（SHA-256 `0F732E8035FBC061B0704BE3F7159CF8E8EAA6E65C23CEC3199275A105EC9983`、251件）で、さらにcommit `dbf2604b245c4908d6e7f91712df56c552878491`でOI-252/253が増えた。差分確認ではOI-001〜241本文は不変。OI-240はFable/Sol双方の追補で未解決判定、OI-241はFable追補に判定があるが、SYNTHESIS §1の97件と両者解決117件は追補前に共通判定したOI-001〜239の母集団で固定されている。したがって工程3は依頼どおりその固定母集団を維持し、追補OI-240/241や241件版より後に追加されたOI-242〜253を97件・117件へ推測混入していない。この材料差を明示し、追加12件を検査済みと偽っていない。
## 工程3 完了宣言

工程3を完了した。判定対象は依頼で固定された`b0805-06`（SHA-256 `2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183`）と、`REVIEW_SYNTHESIS_20260805.md`が共通判定したOI-001〜239である。OWNER正本の件数矛盾と後着分は直前節に分離し、検査済みへ水増ししていない。

- 既存2レビューの一方以上が明示的に未解決・退行とした20件: **FAIL 11 / PASSまたは限定PASS 8 / 再現不能 1**。20件を全件個別記録し、再現不能OI-008には不足している数値条件と実施手順を記した。
- 両者とも解決とした117件から事前固定した無作為20件: **FAIL 1 / PASS 18 / 再現不能 1**。選定方法・全20ハッシュ・全20判定を保存した。
- 無作為標本の反例OI-088と同型の個別走者操作系列: 共通判定母集団内の7件を全件各5反復し、**FAIL 3 / PASS 4**。追加反例OI-152を所見19へ保存した。
- 本日の修理9件の隣接挙動: 各修理2状態以上、合計35状態×3反復＝105観測を実行。修理局所oracleは35/35一致したが、R1の20秒打切りは工程1の上位oracleに反するため所見1を維持した。
- 工程2の静的所見1〜6: 全6件を独立VMで実行し、合計24/24で反例を再現した。以後、照合だけで解決・未解決を断定していない。
- 工程3で追加した実行所見: 所見7〜19の13件。各所見に目的への影響、行番号と逐語コード、深さ、実在する再現関数、適用しない条件を含む修理案を保存した。
- 実装`baseball3d.html`と正本ハーネス`_test_harness_20260804.js`は未編集。再現スクリプトは一時HTMLが無くても固定commitから直接読み、旧版・対象版の期待SHAを共通入口で強制照合する。

以上を工程3の完了条件とし、この宣言の保存後にのみ工程4へ進む。
## 工程4 — 統計検証

### 4-0. 結果を見る前に固定した条件・乱数・判定

共通対象は凍結版`b0805-06`、SHA-256 `2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183`。各実行器は開始前後にSHAを照合し、試行の失敗を都合よく引き直さない。各系列は別seedの再現可能PRNGを使い、seed規則を結果にも保存する。

1. **送球のずれ**: 送球精度100/70/40 × 距離90/150/210ftの9セル。セルごとに文字列`SOL-ULTRA-20260805|throw-offset|acc=<値>|distance=<値>`をFNV-1a 32bitでseed化したxorshift32を使う。当初は各20,000の実軌道を指定したが、最大480物理刻み/球の180,000球は120秒上限までに完走せず最終結果が無かったため、その未完値と別のraw-only先行値は採用しない。閾値・seed・条件を変えず、要求1,000以上を満たす各5,000試行、合計45,000球を最初から完走させる。投手は`run=0`の静止・良体勢に隔離し、実関数`throwOffset(f,d)`から`launchThrow`まで通す。ずれ分布は生成された狙い点の`hypot(offX,offY)`ftを示す。悪送球相当は前後方向のoffsetを単純加算せず、実装同様に`launchThrow`後の軌道を`stepBall`で480刻み追い、塁中心への最小水平距離`bestD>=5ft`またはその時の高さ`bestZ>8.5ft`（`baseball3d.html:2096`の反条件）と固定する。これは公式失策そのものではなく「塁上で通常捕球できない率」であり、依頼で与えられた内野送球約2%の錨とは送球100/70・90/150ftを中心に比較する。210ft・送40を同じ内野平均へ一般化しない。
2. **守備の追跡効率**: seed `SOL-ULTRA-P4-TRACK-20260805`をSHA-256先頭32bitからxorshift32化。走者なし・0死で、初速45–110mph、角度-20–55°、方向-43–43°、質0.15–0.95を一様生成し、`startFlight→update`を60Hz・最大25秒で回す。野手処理へ至った有効打球1,000件を得るまで最大3,000生成する。最終処理野手の全フレーム走行距離÷開始点から最終処理点の直線距離を測り、直線1ft未満、ファウル・本塁打等で守備処理なしは分母から除外して件数を残す。担当交代は`ball.primary`の同一性変化、交代距離比は「新担当から球÷旧担当から球」（1未満が近い）と固定する。運用上の過大迂回は比率1.25超、害のある交代候補は距離比1超として件数を出すが、外部実測錨が無いため、この閾値だけで実野球との差を断定しない。
3. **けん制結果**: seed `SOL-ULTRA-P4-PICKOFF-20260805`のxorshift32、1,500試行。塁1/2/3、lead 0.16–0.32塁（14.4–28.8ft）、走力18–30ft/s、守備Team0/1を一様生成し、標準配置（該当時の内野78%前進を含む）から`beginPickoff→update`を60Hz・最大35秒で実行する。実経路`updateStealCommands`が早出し走者を`origin+0.16`以上へ置くため、先行確認で使ったlead 0.03–0.159の試行は実経路外として全て破棄し、結果には採用せず最初から再実行する。分類優先順を「悪送球＝発進後`sailed/chased/errorBy`」「刺殺＝対象走者out」「中止＝一度も発進せず終了」「帰塁＝発進・無失策・無アウトで元塁」と固定し、未分類0を必須にする。
4. **1試合水準**: 修理前`b0804-33`と対象`b0805-06`を同じ10 seed（`0x5A170805 + game×0x9E3779B9`、uint32、mulberry32）で各10試合。両軍を本文のCPU打撃へ統一し、`cpuChoosePitch→launchPitch`、無キーの自動走塁・実守備、60Hzの`update`を省略せず使う。各試合の9回終了時点を必ず保存し、同点時は本文どおり延長も完走する。主OBPはエラー到達を分子に入れず`(安打+四球)/PA`のゲーム内近似、エラー込みは別名「到達率」。ゴロはゲーム本文の記録分類と同じ、正式打球の結果確定時`ball.maxZ<7ft`とし、そのうち`res.hit===true`かつ`S.errorBy`なしをゴロ安打とする。新旧差は同seedの試合差、95% CI、対応効果量dzを出す。錨は依頼記載の「あなた9.3点/CPU2.5点/ゴロ安打率29%」。新旧の絶対差が得点1.0/試合、OBP 0.03、ゴロ安打率5ポイントのいずれか以上なら実用上の変化として所見候補にし、95% CIが0をまたぐ場合は不確実性も併記する。

ゼロ所見の場合も、上記全試行数・除外数・未分類数・統計量を省略せず残す。

### 工程4-1: 送球のずれ分布（固定 b0805-06）

- 最上位目的への影響: 通常の内野送球が頻繁に受け手から外れるなら、オーナーが1試合遊ぶだけで不自然な進塁・失策に遭遇する。本検査は「送球が非常にそれる」を能力と距離に分解して数値化した。
- 対象: commit `2c9bd8012cd23702ca74bf656adf09068ca067de` / BUILD `b0805-06` / SHA-256前後とも `2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183`（不変）。
- 事前固定: 送100/70/40 × 90/150/210ft、各5,000試行、合計45,000球。`run=0`（静止・体勢良好）、`launchThrow`の肩係数`arm=1.0`に固定し、送球精度と距離以外を混ぜなかった。各セルのseed文字列は `SOL-ULTRA-20260805|throw-offset|acc=<送>|distance=<ft>`、FNV-1a 32bit→xorshift32。百分位はnearest-rank、標準偏差は母標準偏差。
- 実経路: `baseball3d.html:1486-1490` の本体 `throwOffset(f,d)` → `baseball3d.html:2037-2039` と同じ `launchThrow(..., target+off, ...)` → 本体 `stepBall` を最大480刻み実行。全45,000球で初速3成分は有限値だった。
- ずれ: 本体が生成した目標ずれ `hypot(offX,offY)` ft。
- 悪送球の事前定義: 軌道の塁中心への最小水平距離・その時の高さが、本体の塁上待機捕球条件 `bestD<5 && bestZ<=8.5`（`baseball3d.html:2096`）を満たさない球。すなわち `bestD>=5.0ft || bestZ>8.5ft`。これは「塁上で普通に処理できない送球」であり、公式記録上の失策率とは同一ではない。
- 手順訂正の記録: 最初の予備案 `hypot(offX,offY)>=5` は前後方向のずれまで悪送球に数え、本体判定と一致しないため棄却した。閾値5ftを結果に合わせて動かさず、本体の軌道判定へ直してから下表を採った。20,000/セル案は本体同一の物理計算が120秒で完走せず結果未取得だったため、依頼条件1,000以上を満たす5,000/セルへ固定して完走した。

| 送 | 距離ft | seed32 | n | 平均ft | 標準偏差ft | p50 | p90 | p95 | p99 | 最大ft | 軌道bestD 平均/p95/最大ft | 悪送球 件数/率 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 90 | 2972390660 | 5,000 | 0.4512 | 0.2387 | 0.4168 | 0.7835 | 0.8885 | 1.0882 | 1.5951 | 0.3120 / 0.7190 / 1.3501 | 0 / 0.00% |
| 100 | 150 | 4284596057 | 5,000 | 0.7506 | 0.3872 | 0.7063 | 1.2818 | 1.4431 | 1.8037 | 2.5621 | 0.4730 / 1.1478 / 2.3896 | 0 / 0.00% |
| 100 | 210 | 3362396972 | 5,000 | 1.0621 | 0.5497 | 0.9991 | 1.8006 | 2.0323 | 2.5844 | 3.6153 | 0.6790 / 1.6289 / 2.9485 | 0 / 0.00% |
| 70 | 90 | 104384472 | 5,000 | 1.0025 | 0.5220 | 0.9456 | 1.7042 | 1.9538 | 2.3996 | 3.4172 | 0.6472 / 1.5593 / 3.2365 | 0 / 0.00% |
| 70 | 150 | 1518926701 | 5,000 | 1.6602 | 0.8830 | 1.5411 | 2.8766 | 3.2780 | 3.9981 | 5.7497 | 1.0613 / 2.6055 / 4.9395 | 0 / 0.00% |
| 70 | 210 | 2474437848 | 5,000 | 2.2961 | 1.2021 | 2.1604 | 3.9259 | 4.4927 | 5.5031 | 7.8403 | 1.4682 / 3.6206 / 7.2202 | 32 / 0.64% |
| 40 | 90 | 1945797611 | 5,000 | 1.5320 | 0.7898 | 1.4535 | 2.5898 | 2.9846 | 3.6309 | 5.8254 | 0.9891 / 2.3676 / 4.6560 | 0 / 0.00% |
| 40 | 150 | 1480144276 | 5,000 | 2.5534 | 1.3340 | 2.3769 | 4.4034 | 4.9737 | 6.2514 | 8.2131 | 1.6163 / 4.0231 / 8.2118 | 66 / 1.32% |
| 40 | 210 | 2407566241 | 5,000 | 3.5762 | 1.8676 | 3.3680 | 6.0398 | 6.9915 | 8.7401 | 11.8207 | 2.2663 / 5.4955 / 11.8208 | 393 / 7.86% |

#### 依頼文の「内野送球で概ね2%」との比較

- 通常の内野塁間に近い90ftでは、送100/70/40の全条件が観測0/5,000（0.00%）。この条件では「非常にそれる」を支持しない。
- 深い位置の150ftでも、送100=0.00%、送70=0.00%、送40=1.32%で、全条件が2%未満だった。
- 外野級の210ftは送100=0.00%、送70=0.64%、送40=7.86%。送40・210ftだけ2%を大きく超えるが、低い送球能力かつ外野級距離なので平均的な内野送球と同一条件ではない。
- 従って、この9セル・`run=0`の検査から新規所見は0件。0件の省略ではなく、45,000球の手順と全セルを上表に残した。
- 検出限界: `baseball3d.html:1487-1489` は追走距離に応じて別の乱れを加える。本検査は`run=0`かつ肩係数`arm=1.0`固定なので、走りながら・体勢を崩した送球や実選手の肩能力分布は判定していない。また5ft/8.5ftはゲーム内の通常捕球幅で、公式失策の記録定義ではない。

### 工程4・1試合水準（事前固定条件どおり）

- 対象: 修理前 `b0804-33` と固定対象 `b0805-06`。SHA-256は両版とも実行前後で一致した。
- 試合数: 各10試合、各9回。旧新とも10/10完走、延長0、停止0。刻みは `1/60` 秒。
- seed: game 0..9 を `0x5A170805 + game*0x9E3779B9 (uint32)`、PRNGは `mulberry32`。旧新の同番号へ同seedを投入した。分岐後は乱数消費数が変わり得るため、イベント単位の同一乱数ではなく「同seed・同操作規則」の対応比較である。
- 操作方針: 本文が測定用に許す `isPlayerBatting=()=>false` でCPU対CPU化。表は本文の全100打線、裏は本文のCPU打線。難易度ふつう。各 `aimPitch` で本文の `cpuChoosePitch()` を `launchPitch()` へ渡す。打撃は本文のCPU打撃、走塁・守備送球はキー無入力の自動判断。演出時間も飛ばさず `update(1/60)` だけで進行した。
- 主OBP: `(H+BB)/PA`。このゲームに死球・捕手妨害・犠牲フライの専用機構はない。エラー到達はOBP分子から除外し、別名「到達率」にだけ含めた。
- ゴロ: 正式打球で打席が終了した時の本文分類と同じ `ball.maxZ < 7ft`。エラー到達はゴロ安打から除外した。全20試合で計測Hとゲーム内スコアボードHが一致した。

| 版・打線 | PA | H | BB | エラー到達 | OBP | 到達率 | 点/試合 | ゴロ | ゴロ安打 | ゴロ安打率 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| b0804-33・あなた（全100） | 496 | 177 | 45 | 12 | 44.76% | 47.18% | 10.8 | 129 | 64 | 49.61% |
| b0805-06・あなた（全100） | 437 | 141 | 30 | 10 | 39.13% | 41.42% | 8.1 | 106 | 26 | 24.53% |
| b0804-33・CPU | 397 | 122 | 30 | 1 | 38.29% | 38.54% | 3.4 | 100 | 42 | 42.00% |
| b0805-06・CPU | 367 | 93 | 27 | 1 | 32.70% | 32.97% | 2.2 | 90 | 16 | 17.78% |
| b0804-33・両軍合算 | 893 | 299 | 75 | 13 | 41.88% | 43.34% | 14.2合計 | 229 | 106 | 46.29% |
| b0805-06・両軍合算 | 804 | 234 | 57 | 11 | 36.19% | 37.56% | 10.3合計 | 196 | 42 | 21.43% |

| 同seedの対応比較（新−旧） | 平均差 | 95% CI | 検定 | 効果量 |
|---|---:|---:|---:|---:|
| あなたの得点/試合 | -2.7点 | -7.86〜+2.46 | 対応t, p=0.267 | dz=-0.37 |
| CPUの得点/試合 | -1.2点 | -4.27〜+1.87 | 対応t, p=0.399 | dz=-0.28 |
| あなたのゴロ安打率（試合別率） | -25.36pt | -38.51〜-12.20pt | 対応t, p=0.00181 | dz=-1.38 |
| CPUのゴロ安打率（試合別率） | -23.78pt | -38.66〜-8.90pt | 対応t, p=0.00561 | dz=-1.14 |
| 両軍合算ゴロ安打率（試合別率） | -23.97pt | -33.78〜-14.15pt | 対応t, p=0.000369 | dz=-1.75 |

- 得点は点推定では下がったが、10試合の対応検定では差0を棄却できない。現行のあなた8.1点は95% CI 6.47〜9.73（錨9.3を含む、p=0.131）、CPU2.2点は1.14〜3.26（錨2.5を含む、p=0.536）。「得点水準が壊れた」とは断定しない。
- ゴロ安打率は旧新差が両打線で同方向かつ大きく、試合を単位にしても差0を棄却した。全100打線の現行24.53%のWilson 95% CIは17.32〜33.51%で錨29%を含むため、現行値単独は錨との不一致と断定しない。両軍合算21.43%のCIは16.26〜27.69%だが、錨29%が全100打線だけか両軍合算か正本に明記されていないため、合算比較は補助扱いにする。
- OBPの旧新差は全100打線 -5.63pt（打席単位の二比率p=0.082、Cohen h=-0.11）、CPU -5.59pt（p=0.107、h=-0.12）。率そのものの差は10試合では断定しない。

#### 各試合スコア（あなた-CPU）

| seed番号 | b0804-33 | b0805-06 | 新−旧（あなた / CPU） |
|---:|---:|---:|---:|
| 0 | 10-3 | 11-5 | +1 / +2 |
| 1 | 7-1 | 7-0 | 0 / -1 |
| 2 | 12-5 | 9-1 | -3 / -4 |
| 3 | 5-2 | 11-2 | +6 / 0 |
| 4 | 14-0 | 5-4 | -9 / +4 |
| 5 | 16-6 | 10-2 | -6 / -4 |
| 6 | 24-4 | 5-3 | -19 / -1 |
| 7 | 8-12 | 6-1 | -2 / -11 |
| 8 | 6-1 | 8-2 | +2 / +1 |
| 9 | 6-0 | 9-2 | +3 / +2 |

## 所見20: 修理9件の前後でゴロ安打率が両打線とも約24ポイント低下した
- 目的への影響: 内野ゴロが安打になる頻度が明確に減るため、オーナーには「内野安打が急に出にくくなった」と見える。一方、現行の全100打線24.53%は錨29%の不確実範囲内で、得点8.1/2.2も錨9.3/2.5からの有意な逸脱ではない。修理を戻す根拠ではなく、水準が変わった事実を回帰監視へ昇格させる所見である。
- 真因: `baseball3d.html:1208` `if(best2 && best2.t!==undefined && (t - best2.t) > 0.12) return [best2[0],best2[1]];`、`baseball3d.html:1324` `hit = (h0 && (!hM || hM.t - h0.t > 0.12)) ? h0 : (hM || h0);`、`baseball3d.html:2843-2844` `const approaching = ... > 0; if(... && !approaching){` が、ゴロ処理の突っ込み点と担当継続を旧版から変えた。旧新比較が直接分離したのは修理9件の束であり、3行それぞれの寄与率は個別アブレーション未実施なので未検証。
- 深さ: 統計（各版9回×10試合を実行。両軍合算の試合別ゴロ安打率差 -23.97pt、95% CI -33.78〜-14.15pt、p=0.000369、dz=-1.75）
- 再現: `review_sol_ultra_repro_20260805.js` 内の `runPhase4GameLevels`
- 修理案: まず担当交代の `approaching` 門番と走行中の反応再徴収廃止は維持し、50試合以上の再測定でも全100打線のゴロ安打率が錨帯を外れた場合だけ、`ball.landed && ball.maxZ<7 && '投一二三遊'.includes(primary.n)` のゴロ内野守備に限って `0.12` の余裕差を二分探索で再較正する。空中の打球、外野到達後、送球・挟殺・けん制では発動させない。

#### 検出限界

- 10試合はユーザー指定の最小単位であり、得点のばらつきには不足する。差が見えなかったことは同等性の証明ではない。
- 同seedでも旧新の分岐後は乱数の消費位置がずれる。対応比較は同じ初期seedと同じ操作方針によるもので、各投球・打球の乱数をイベント単位で固定した比較ではない。
- 錨29%の母集団が「全100打線のみ」か「両軍合算」かは既存記録から一意に確定できない。そのため主比較は全100打線、両軍合算は補助に分けた。
### 工程4-2: 守備の追跡効率（事前固定条件と実測）

- 対象: 固定 `b0805-06`。実行前後 SHA-256 はともに `2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183`、`shaGuard=true`。
- 乱数: `SOL-ULTRA-P4-TRACK-20260805` を SHA-256 化し先頭32bitを xorshift32 の初期値とした（`seed32=3952753128`）。
- 入力: 走者なし・0死で実装の `startFlight→update` を60Hz実行。`exit=45–110mph`、`la=-20–55°`、`spray=-43–43°`、`q=0.15–0.95` を各一様抽出。
- 比率: 最終処理野手の全フレーム移動距離合計 ÷ 同野手の開始位置から最終処理位置への直線距離。直線距離 `<1.0ft` は小さい分母による膨張を避けて比率から除外する。
- 球の扱い: 野手処理に至らない場外本塁打・ファウルは `no-fielding` として除外。フェンス接触後でも野手処理に至れば含め、未捕球でも回収から送球へ進めば含める。
- 1000有効打球を1000生成で確保。未完走0、`no-fielding=0`、直線 `<1ft` 除外11、比率母数989。フェンス球24、未捕球後回収267。処理種別は内野538、外野462。

| 指標 | n | 平均 | 中央値 | p90 | p95 | p99 | 最大 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 追跡効率比 | 989 | 1.1056 | 1.0001 | 1.0303 | 1.1043 | 2.3129 | 35.0687 |
| 絶対余分距離（実走−直線、ft） | 989 | 1.7612 | 0.0029 | 0.9903 | 6.1447 | 49.8706 | 121.7245 |

| 閾値 | 件数 | 比率（母数989） |
|---|---:|---:|
| `>1.10` | 56 | 5.66% |
| `>1.25` | 34 | 3.44% |
| `>1.50` | 20 | 2.02% |
| `>2.00` | 14 | 1.42% |

- 最大比率は試行748。初期条件は `exit=63.794282, la=31.521284, spray=30.873893, q=0.211098`。右翼手は109.3972ft走ったが開始点 `(152,252)` から処理点 `(149.0499,253.0139)` への直線は3.1195ftで、余分距離106.2777ft、比率35.0687だった。
- 試行748の `primary` は開始から終了まで右翼手だけで、担当交代0。目標は開始時 `(120.0713,194.8803)`、2.97秒以降 `(137.12,221.70)` 付近、4.17秒で `(151.3344,259.3083)` へ逆向きに移り、その後も0.2秒前後ごとに更新された。したがって最大比率は「交代した新担当が遠かった」だけでは説明できない。
- 絶対余分距離最大は試行881。左翼手が140.2308ft走り、直線18.5063ft、余分121.7245ft、比率7.5775。初期条件は `exit=68.176641, la=36.937711, spray=-27.645206, q=0.542763`。
- 担当交代は75/1000打球（7.5%）、全80回。交代瞬間の「新担当から現在球まで ÷ 旧担当から現在球まで」は中央値6.7262、`<1` は6/80、`>=1` は74/80。この距離比は未来の捕球点を考慮しないので、それ単独を誤交代の判定には使わない。

### 工程4-3: けん制結果分布（事前固定条件と実測）

- 対象: 固定 `b0805-06`。実行前後 SHA-256 は上記と同一で `shaGuard=true`。
- 乱数: `SOL-ULTRA-P4-PICKOFF-20260805`（`seed32=898821937`）。1500試行。
- 入力: 対象塁1/2/3を一様、初期飛び出しを0.16–0.32塁（14.4–28.8ft）、走力18–30ft/s、守備側Team0/Team1を各一様。配置は実装の標準配置で、三塁走者かつ2死未満だけ実装どおり内野78%前進。人工的な位置ずらしなし。
- 入力の自己訂正: 最初に0.03–0.32塁で試したが、実ゲームの `updateStealCommands` が早出し時に最低0.16塁へ置くため無効化した。下表は0.16–0.32塁で全1500試行を最初からやり直した結果だけである。
- 排他分類の優先順: ①悪送球=`throwPlay.sailed/chased` または `S.errorBy`、②刺殺=対象走者out、③中止=送球が一度も発進せず終了、④帰塁=送球発進・無失策・無アウトで元塁、⑤未分類。35秒上限。

| 結果 | 全体 n=1500 | 一塁 n=506 | 二塁 n=488 | 三塁 n=506 |
|---|---:|---:|---:|---:|
| 刺殺 | 3 (0.20%) | 3 (0.59%) | 0 (0.00%) | 0 (0.00%) |
| 帰塁 | 51 (3.40%) | 33 (6.52%) | 0 (0.00%) | 18 (3.56%) |
| 中止 | 1446 (96.40%) | 470 (92.89%) | 488 (100.00%) | 488 (96.44%) |
| 悪送球 | 0 (0.00%) | 0 | 0 | 0 |
| 未分類 | 0 | 0 | 0 | 0 |

- 停止0、未分類0。経過時間は平均1.0454秒、p95=1.55秒、最大2.65秒。
- 二塁は488/488で投球前に中止し、刺殺・帰塁・悪送球はいずれも0だった。

## 所見21: 外野手の追跡で最大121.7ftの余分移動が生じ、別試行では目標反転を実測した
- 目的への影響: オーナーには、一部の外野手が打球へ一直線に入らず、いったん大きく前進してから元の定位置付近へ戻る「無駄な回り込み」として見える。目標反転を全履歴で確認した試行748の余分移動は106.28ftで、別の試行881が絶対余分距離の最大121.72ftだった。1000打球中34件（比率母数989の3.44%）が直線の1.25倍超で、1セッション中に視認され得る。
- 真因: `baseball3d.html:2818,2830` — `if((ball.t > (ball.planT||0) + 0.15 || ball.landed) && ball.t > (ball.aimT||0) + 0.20){` / `const ip=interceptPoint(prim); setTarget(prim, ip[0], ip[1]);`。着地後は0.20秒ごとに新しい先回り点で目標を無条件上書きし、既に走った経路・現在の進行方向・新旧目標が逆向きかを適用条件にしていない。試行748では担当交代なしの右翼手の目標が `(120.07,194.88)` から `(137.12,221.70)`、さらに `(151.33,259.31)` へ反転し、109.40ft走って開始点から3.12ftの位置で処理した。
- 深さ: 統計
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding21RouteDetour`
- 修理案: 再照準時に「現在目標を続ける残り時間」と「新目標へ曲がる時間（90°超の方向転換には減速・再加速の時間を加算）」を同じ単位で比較し、新目標が最低0.12秒以上早い時だけ `setTarget` を上書きする。球が壁で反射した、現在目標がフェンス外・捕球不能になった、または担当交代した場面ではこの門番を発動させない。

## 所見22: 早出しへのけん制が96.4%無送球で終わり、二塁では488回すべて中止する
- 目的への影響: オーナーが早めに盗塁操作しても、投手はほぼ毎回ボールを持ったまま終え、二塁では一度も送球も刺殺も起きない。盗塁の早出しを罰するはずのけん制が見た目にも勝負にもならず、同じ無送球動作を繰り返す不具合として遭遇する。
- 真因: `baseball3d.html:1962-1968` — `if(tr && Math.abs(tr.p-tr.origin)<=0.05) return concludePlay();` / `if(T.t < T.transfer + 2.6) return;`。カバー到着を待つ間にも走者は帰塁を続け、塁まで0.05以内へ戻った瞬間に投球前終了する。早出し走者 (`jumped`) か、開始時に何ft離れていたかを終了条件に含めないため、二塁の遠いカバー待ちでは全例が送球前に消える。
- 深さ: 統計
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding22PickoffCancellation`
- 修理案: `jumped` で始まったけん制は、投手が反応した時点から対象塁のカバーを先行始動させ、送球可能になるまでの待ちを走者の帰塁完了だけで即終了しない。開始時の飛び出しが0.12塁未満の通常リード、ユーザーが早出ししていない通常投球、またはカバーが2.6秒以内に到達不能な異常配置では発動させず、従来どおり中止する。

## 工程4 完了宣言 — 統計検証

- 送球のずれ: 送100/70/40×90/150/210ftを各5,000、合計45,000球で実行した。通常内野条件に近い90/150ftは全条件2%未満だったため新規所見0件とし、`run=0`・肩係数`arm=1.0`固定という検出限界も残した。
- 守備追跡: 有効1,000打球、停止0。直線距離1ft未満11件を比率だけから除外し、母数989で比率分布と絶対余分距離を保存した。目標反転を全履歴で確認した試行748と、余分距離最大の別試行881を混同せず所見21に分離した。
- けん制: 実経路内の飛び出し0.16–0.32塁で1,500試行し、刺殺3・帰塁51・中止1,446・悪送球0・未分類0・停止0を得た。二塁488/488の無送球中止を所見22にした。
- 1試合水準: 修理前`b0804-33`と対象`b0805-06`を同じ10 seed、各9回×10試合で全完走した。得点差は差0を棄却できないため断定せず、両軍で同方向だったゴロ安打率の約24ポイント低下だけを所見20にした。
- 独立再監査で全試行数・表値・CI・p値・効果量・BUILD・SHA・再現関数・必須5項目を照合した。試行748と881の結び付け過ぎ、および送球の肩係数記載漏れを修正後、数値・母数・再現性のblockerは0件となった。
- 工程4の新規所見は所見20〜22の3件。各所見を別々に追記し、所見21・22には専用の再現入口を別追記した。
- 固定対象SHA-256は実行前後とも`2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183`、旧版は`B70F4202653E3942CBD7E4C107F304223ABD66A4A5697FA104B32C6E89E091DC`、正本ハーネスは`8C4EF06D934C68A4993F27B3139AF1EEF317BA237A00287A05466CCA5EDE85F8`。実装・正本ハーネスは編集していない。

以上を工程4の完了条件とし、この宣言の保存後にのみ工程5へ進む。

## 工程5 — ハーネスの変異監査

### 5-0. 実行前宣言 — 10変異の注入箇所・内容を固定

この表を保存する時点では、工程5のBASELINEも変異版もハーネス実行0回、変異HTML構築0回。固定対象はcommit `2c9bd8012cd23702ca74bf656adf09068ca067de` / BUILD `b0805-06` / SHA-256 `2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183`、正本ハーネスの期待SHA-256は`8C4EF06D934C68A4993F27B3139AF1EEF317BA237A00287A05466CCA5EDE85F8`。計画だけを固定版へ照合し、10変異・11置換が各宣言行に1回だけ一致し、S-1〜S-13のunionが過不足なく一致した。

固定計画SHA-256: `4F63608AA1DC8FFEF774DA4CF92B46FB505720EC6AC8E156A64A29153493ED42`

| 変異 | 対応系統 | 注入箇所と逐語変更（固定版の行） | 意図的に戻すバグ | 既存16項目で直接落ちるべき項目 |
|---|---|---|---|---|
| M01 | S-1 / S-7 | L1885 `if(S.playClock > (inRundown?24:12) + grace){` → `if(S.playClock > (inRundown?24:12)){`。L2598 `if(r.p>=3.97){ r.goal=4; if(!timePlay \|\| timePlay.includes(r)) runs++; return; }` → `if(r.goal>=3.97){ r.goal=4; if(!timePlay \|\| timePlay.includes(r)) runs++; return; }` | grace8秒を消して塁間でも12秒で閉じ、実位置ではなくgoalだけで得点させる | `test14_塁間での時間切れ`と`test13_本塁未到達での得点`の両方。片方だけなら部分検出 |
| M02 | S-2 | L1469 `return (106 + 58*(arm-0.55)) * eff;` → `return (106 + 58*(arm-0.55)) * eff * 1.30;` | 全送球を30%高速化し、弱肩も遠距離を直送する | `test10_中継` |
| M03 | S-3 | L2807 `if(ball.z<=0.02) ball.landed=true;` → `if(ball.z<=0.02 && ball.t>0.2) ball.landed=true;` | 0.2秒未満の叩きつけを未着地に戻し、跳ね上がりを空中捕球させる | `test4_叩きつけバウンド` |
| M04 | S-4 / S-5 | L1520、`coverArrival`関数内だけの `return best;` → `return 0;` | カバー未到着でも即座に塁上プレー可能と見なし、送球先判断と実送球待ちの両方からカバー時刻を消す | 直接対応なし。`test5_封殺` / `sweep128`は副次候補 |
| M05 | S-6 | L2313 `if(r.goal!==gBefore) r.v=0;` → `r.v=0;` | 行き先が変わらない挟殺走者も毎tick速度を失う | `test1_挟殺S突込` |
| M06 | S-8 / S-13代表例 | L1798 `const committed = (r.origin>0 && r.p - r.origin >= 0.35);` → `const committed = false;` | 踏み切った走者にも適用条件なしの帰塁上書きを戻し、goal 3→2を再発させる | `test12_走者目標の反転`。S-13全般は全10変異の総合結果で判定 |
| M07 | S-9 | L1489 `... + 0.012*run` → `... + 0.028*run` | コメントに残る初版係数へ戻し、追走後の送球を過度にそれさせる | 直接対応なし。`test5_封殺` / `test9_幽霊飛行` / `sweep128`は副次候補 |
| M08 | S-10 | L2843 `const approaching = (ball.vx*(prim.cx-ball.x) + ball.vy*(prim.cy-ball.y)) > 0;` → `const approaching = false;` | 球が旧担当へ接近中でも距離だけで担当交代させる | 直接対応なし。`test3_エラー回収` / `sweep128`は副次候補 |
| M09 | S-11 | L3527 `const ang = side*(0.42+0.55*lineHug)*(0.35+0.65*far);` → `const ang = 0;` | 線際でも正面カメラに固定し、ポール・観客席による遮蔽を戻す | 対応なし。既存16項目は描画結果を見ない |
| M10 | S-12 | L885 `const F_REACT = 0.28, ACC_T = 1.90, ACC_F = 1.15;` → `const F_REACT = 0.28, ACC_T = 1.90, ACC_F = 0.80;` | コメント記載の旧加速値へ戻し、守備が速すぎる較正の揺り戻しを注入する | 直接対応なし。`test5_封殺` / `sweep128`は副次候補 |

実行規則も結果を見る前に固定する。BASELINEが16/16 PASSでなければ変異を開始しない。`Math.random=()=>0.5`をゲーム起動前から全runへ適用し、変異による乱数消費位置の違いを排除する。BASELINEと各M01〜M10は新しい子プロセス・新しいVMへ隔離し、1件150秒上限、正本16キー集合と各`verdict`の存在を必須にする。変異は固定HTMLの文字列へメモリ内でだけ注入し、変異HTMLをディスクへ保存しない。FAILは検出成功なので実行エラーとせず、注入失敗・timeout・16キー不一致・SHA不一致だけを監査失敗とする。

M01はtest13とtest14を別系統として判定する。M04は「カバー到着前の塁は成立した送球先ではない」という1つの共通契約を壊す。M06が落ちてもS-13全般を検出したとはせず、S-13は10変異全体で既知回帰を何件捕らえたかにより評価する。別目的のテストが偶然落ちても、その系統を十分に監視した証拠にはしない。FAIL 0本の変異はハーネスの穴として、症状を直接作り、成立回数の下限を持つ追加テスト仕様を所見へ書く。

以上の表・固定SHA・判定規則を結果取得前の正本とし、この保存後にだけBASELINEと10変異を実行する。

### 5-0a. 基準検査の失敗と実行条件の改訂（変異実行前）

- 初回条件: `Math.random=()=>0.5` をゲーム起動前から全runへ適用し、BASELINEを実行した。
- 初回結果: BASELINEは15/16 PASS、`test3_エラー回収`だけFAIL（`fumbles=0`）。基準ゲートで停止したため、M01〜M10は0件実行、変異HTMLも0件構築、工程5の監査結果としては無効である。
- 保存境界: 初回失敗の前後で、固定対象HTML SHA-256=`2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183`、正本ハーネス SHA-256=`8C4EF06D934C68A4993F27B3139AF1EEF317BA237A00287A05466CCA5EDE85F8` は不変。実装・正本ハーネスは書き換えていない。
- 真因: 定数0.5は、test3が必要とする失策分岐を一度も発生させない。この条件ではハーネス16項目の自己整合性を確認できず、変異検出力を測れない。
- 改訂: 乱数を32-bit `xorshift32`、seed=`0x5A170805`（十進1511458821）へ変更する。BASELINEと各M01〜M10の子プロセスごとにゲーム起動直前で同じseedへ戻し、ゲーム起動からハーネス終了まで1本の乱数列を連続使用する。ハーネス内の一時的な乱数上書きは各テスト終了時に元の列へ復元されることも検査する。
- 比較限界: 全子プロセスの開始seedは同一だが、変異が分岐や乱数消費回数を変えた後はイベント単位の対照乱数にはならない。したがって、判定は各テストの明示oracleが落ちたかで行い、個別の乱数値の一致を根拠にしない。
- 宣言維持: M01〜M10の注入箇所、変更内容、S-1〜S-13対応、直接期待テストは5-0表から変更しない。
- 計画版: 旧計画SHA-256=`4F63608AA1DC8FFEF774DA4CF92B46FB505720EC6AC8E156A64A29153493ED42` を失敗記録として保存し、改訂計画schema=`sol-ultra-phase5-mutation-plan-v2`、SHA-256=`FE532BEDB9054D1728BE4A7D4BB8E5AABF4146FA46C9755D426EFF0851277E3A`で置き換える。
- 再開条件: この改訂を保存した後、まずBASELINE 16/16を再確認する。16/16でなければ再び変異を0件のまま停止する。16/16ならM01〜M10を各々新しい子プロセス・新しいVMで実行する。

以上を工程5の改訂済み実行条件として先に保存し、この後にBASELINEと10変異を実行する。

### 5-0b. 改訂v2の基準失敗と、固定seedの決定論的な適格化手順（変異実行前）

- 改訂v2実測: seed=`0x5A170805`でBASELINEは15/16 PASS。`test3_エラー回収`は失策25回を発生させ、最大静止0.08秒だったが、最大回収時間3.23秒が正本条件`maxRec<3.2`を超えたためFAILした。
- ゲート動作: BASELINE 16/16ではなかったためM01〜M10は再び0件実行、変異HTMLも0件構築。v2の監査結果は無効である。
- 不変確認: v2失敗の前後で固定対象HTML・正本ハーネス・現行実装のSHA-256はすべて不変だった。
- 適格化の目的: 既存ハーネスが通常想定する失策分岐を発生させつつ、BASELINE自体の確率的な境界落ちを除き、同一条件を第三者が再実行できるようにする。ハーネスの閾値は変更しない。
- seed候補の生成: 文字列`SOL-ULTRA-P5-BASELINE-SEED:<i>`（`i=1,2,...`）をUTF-8でSHA-256化し、先頭8桁を符号なし32-bit整数として使う。`i`を1から昇順に試し、BASELINEが初めて16/16 PASSした候補で停止する。後の候補は見ない。
- 選定境界: seed探索中はBASELINEだけを実行し、M01〜M10は実行しない。各候補のtest3だけでなく16項目すべての結果を保存する。0はxorshift32で無効なため、0になった候補だけ次へ送る。
- 固定手順: 最初の16/16候補を見つけた後、そのseedを再現スクリプトの計画v3へ固定し、計画SHAを報告書へ保存する。その保存後に、固定seedでBASELINEをもう一度ゼロから実行し、16/16なら初めてM01〜M10を実行する。
- 比較限界: これは基準ハーネスが自己矛盾せず走るseedの適格化であり、各変異を落としやすいseedの探索ではない。変異結果を見てseedを再選択しない。

以上をseed探索前に保存する。

### 5-0c. 適格seedの固定と計画v3（本番変異実行前）

- 決定論的探索結果: 候補`i=1`だけを実行し、最初の候補で停止した。入力文字列は`SOL-ULTRA-P5-BASELINE-SEED:1`、SHA-256先頭8桁から得たseedは`0x71D22228`（十進1909596712）。後続候補は実行していない。
- BASELINE適格結果: 16/16 PASS、FAIL 0、項目数16、無効行0、乱数列復元PASS。M01〜M10は0件実行、変異HTMLは0件構築、一時ファイルは0件。
- 不変確認: 適格探索の前後で固定対象HTML SHA-256=`2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183`、正本ハーネス SHA-256=`8C4EF06D934C68A4993F27B3139AF1EEF317BA237A00287A05466CCA5EDE85F8`、現行実装SHA-256=`892CB56BBEC37E967FAF445635E8C0208372025F290C8AF2394A6B524BB56415`は不変だった。
- 固定内容: 計画v3はseed=`0x71D22228`、候補番号1、選定規則、子プロセスごとのseedリセット、ゲーム起動からハーネス終了までの連続乱数列、テスト一時上書き後の復元確認を固定する。
- 計画v3: schema=`sol-ultra-phase5-mutation-plan-v3`、計画SHA-256=`130E026F9AD24A6D975B5A1D9C7F3EBC71B3C10A15794A0EB452BD1AC64C884E`。10変異・11置換・S-1〜S-13の対応と注入行は5-0表から変更していない。
- 本番ゲート: この記録の保存後、固定seedで別のBASELINE子プロセスを起動する。そこで16/16を再確認できた場合だけM01〜M10を順に実行する。変異結果を理由にseedを変えない。

以上を本番監査の固定条件として保存し、この後にBASELINEと10変異を実行する。

### 5-1. 変異監査の実測結果

- 固定条件: 計画v3 SHA-256=`130E026F9AD24A6D975B5A1D9C7F3EBC71B3C10A15794A0EB452BD1AC64C884E`、seed=`0x71D22228`。本番BASELINEは16/16 PASS、FAIL 0、乱数列復元PASS。
- 完走: M01〜M10を各1回、別子プロセス・別VMで全10件実行した。注入は宣言どおり11/11置換、実行失敗0、timeout 0、一時ファイル0。

| 変異 | 対応系統 | 落ちた本数 / 16 | 実際に落ちた項目 | 判定 |
|---|---|---:|---|---|
| M01 | S-1 / S-7 | 2 | `test13_本塁未到達での得点`, `test14_塁間での時間切れ` | 2系統を直接検出 |
| M02 | S-2 | 1 | `test10_中継` | 直接検出 |
| M03 | S-3 | 1 | `test3_エラー回収` | 変異は検出したが、直接対応の`test4_叩きつけバウンド`はPASS（所見27） |
| M04 | S-4 / S-5 | 0 | なし | ハーネスの穴（所見23） |
| M05 | S-6 | 1 | `test1_挟殺S突込` | 直接検出 |
| M06 | S-8 / S-13代表 | 1 | `test12_走者目標の反転` | S-8を直接検出。S-13全体は10変異中6件のみ検出 |
| M07 | S-9 | 0 | なし | ハーネスの穴（所見24） |
| M08 | S-10 | 0 | なし | ハーネスの穴（所見25） |
| M09 | S-11 | 0 | なし | ハーネスの穴（所見26） |
| M10 | S-12 | 1 | `test9_幽霊飛行` | 変異は検出したが、守備速度を直接測っていない（所見28） |

- 検出力: 10変異中、1本以上落ちた変異6件、0本4件。単純な変異検出率は60%。S-13（既知バグ再発の横断防止）としては、宣言した10変異の40%を全PASSで見逃した。
- 直接性: M01 / M02 / M05 / M06は意図した症状のoracleが落ちた。M03 / M10は別項目だけが落ちたため、「系統を直接守るテスト」としては未完成である。
- 不変確認: 実行前後で固定対象HTML SHA-256=`2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183`、正本ハーネス SHA-256=`8C4EF06D934C68A4993F27B3139AF1EEF317BA237A00287A05466CCA5EDE85F8`、現行実装SHA-256=`892CB56BBEC37E967FAF445635E8C0208372025F290C8AF2394A6B524BB56415`は不変だった。

以下、0本の4変異を必須所見として1件ずつ保存し、その後に直接oracle不一致の2件を保存する。

## 所見23: カバー到着待ちを0秒へ戻してもハーネス16項目が全PASSする
- 目的への影響: オーナーには、誰も入っていない塁へ守備が投げ、カバーが後着して走者だけが助かる「守備が状況を理解していない」バグとして見える。現行ハーネスは、この再発を1件も赤くできない。
- 真因: `_test_harness_20260804.js:166-167` — `out.test5_封殺={trials, outs, アウト率pct:+(outs/trials*100).toFixed(0), verdict: (outs/trials>=0.80)?'PASS':'FAIL'};`。カバー関連で最も近いtest5も20打球の最終アウト率だけを見ており、正本ハーネス内の`coverArrival`参照は0件である。固定対象`baseball3d.html:1510-1520`の`function coverArrival(b, thrower){ ... return best; }`をM04で`return 0;`へ戻しても16/16 PASSした。
- 深さ: 実行（固定seed `0x71D22228`、M04の一意置換1件、16 PASS / 0 FAIL、乱数列復元PASS）
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding23HarnessMissCoverArrival`
- 修理案: CC側で「カバー成立時刻」テストを追加する。production状態で①対象塁カバー不在なら`coverArrival=99`、②カバーが80ft以上離れていれば`throwETAof`が送球単体時刻ではなくカバー到着時刻+0.12秒以上、③カバーが塁から2ft未満なら待ち0秒、④けん制で`coverArrival=99`ならtransfer後2.599秒までは送球せず2.601秒で中止、を各3反復で直接assertする。投手宛て`b==='P'`と既に2ft未満でカバー済みの場面には待ち時間を要求しない。


## 所見24: 走りながらの送球ずれを旧係数へ戻してもハーネス16項目が全PASSする
- 目的への影響: 外野手が追走後に投げるたび大きくそれる再発が、試合中には繰り返し見えるのに検査では無傷になる。オーナーが一度のセッションで「送球が非常にそれる」と再指摘する経路を現行ハーネスは防げない。
- 真因: `_test_harness_20260804.js:170-179` — `const v0=throwSpeed(a[1],a[0]), th=throwAngle(a[0],v0); ... out.test6_送球高さ={...res, verdict: bad===0?'PASS':'FAIL'};`。送球テストは高さだけを測り、`throwOffset`と野手の`run`を一度も測らない。固定対象`baseball3d.html:1489`の`const sigma = d*(0.004 + 0.016*(100-acc)/100 + 0.012*run);`をM07で旧`0.028*run`へ戻しても16/16 PASSした。
- 深さ: 実行（固定seed `0x71D22228`、M07の一意置換1件、16 PASS / 0 FAIL、乱数列復元PASS）
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding24HarnessMissRunningThrowDeviation`
- 修理案: CC側で「走行中の送球ずれ」統計テストを追加する。送70・距離200ft・同一固定seedで`run=0`と`run=70`を各10,000送球し、x/y成分の標準偏差比を1.8以上3.0未満、有限値率100%とする。現行式の理論比は2.36、M07は4.18なので分離できる。距離90ft未満の短送球、`run=0`の静止送球、送球高さtest6にはこの比率条件を発動しない。


## 所見25: 球が旧担当へ近づく最中の担当交代を復活させてもハーネス16項目が全PASSする
- 目的への影響: 捕球直前の野手が急に打球を捨て、遠い別野手へ担当が飛ぶため、オーナーには「目の前の球を無視して逆方向へ歩く」守備として見える。現行ハーネスは担当交代の瞬間を観測していない。
- 真因: `_test_harness_20260804.js:291,298-299` — `while(t<40 && ['flight','throwing','play'].includes(S.phase) && !S.over){` / `const stray=runners.filter(r=>!r.out && r.p<3.999 && Math.abs(r.p-Math.round(r.p-0.085))>0.13);`。sweep128は終了・塁間残留・保存則だけを測り、`ball.primary`の交代時刻と球の進行方向を記録しない。固定対象`baseball3d.html:2843-2844` — `const approaching = (ball.vx*(prim.cx-ball.x) + ball.vy*(prim.cy-ball.y)) > 0;` / `if(Math.hypot(ball.x-prim.cx, ball.y-prim.cy) > CATCH_R + 3 && !approaching){`。M08で前者を`const approaching = false;`へ戻しても16/16 PASSした。
- 深さ: 実行（固定seed `0x71D22228`、M08の一意置換1件、16 PASS / 0 FAIL、乱数列復元PASS）
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding25HarnessMissApproachingGate`
- 修理案: CC側で工程3のproduction状態を正本ハーネスへ移植する。旧担当`x=20`、球`x=0`、距離20ft、別候補`x=80`に固定し、①`vx=+10`（dot=+200）では1 tick後も`planPlay`呼出0・担当old、②`vx=-10`（dot=-200）では呼出1・担当new、③交代後は旧担当が空き塁をカバー、④全塁担当済みなら新担当の18ft後方へ入る、を各3反復でassertする。dot<=0で球が遠ざかる場面と、旧担当が捕球圏外になった場面には担当維持を要求しない。


## 所見26: 線際カメラの回り込みを0へ戻してもハーネス16項目が全PASSする
- 目的への影響: レフト線・ライト線の打球がポールや観客席に隠れる再発は、操作中には即座に見える一方、現行ハーネスは描画を一切判定せず合格を出す。
- 真因: `_test_harness_20260804.js:275-309` — `out.sweep128={scenarios:n, failCount:fails.length, verdict:fails.length===0?'PASS':'FAIL', ...};`。16項目はゲーム状態だけを検査し、正本ハーネス内の`camTargets`・`fieldView`・`camera`参照は0件である。固定対象`baseball3d.html:3527`の`const ang = side*(0.42+0.55*lineHug)*(0.35+0.65*far);`をM09で`const ang = 0;`へ戻しても16/16 PASSした。
- 深さ: 実行（固定seed `0x71D22228`、M09の一意置換1件、16 PASS / 0 FAIL、乱数列復元PASS）
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding26HarnessMissCameraOcclusion`
- 修理案: CC側で数値テストと無描画画像テストを追加する。数値側は`S.fieldView=true`、球`(x,y,z)=(+230,300,10)`と`(-230,300,10)`で`camTargets()`を呼び、各々`abs(eye[0]-(0.55*x-6))>=60ft`、左右対称差5ft以内をassertする。画像側は同じ2場面を1280×720で描き、球が画面中央80%内かつポール・観客席より手前の深度であることを確認する。中央寄り`abs(x)<=60ft`では60ft回り込み条件を発動しない。


## 所見27: 着地遅延の変異は落ちたが、対応するバウンドtest4はPASSのままだった
- 目的への影響: 「地面に当たった球をノーバウンド捕球として扱う」再発を狙った検査が、その症状を直接赤くしていない。別のエラー回収test3が偶発的に落ちるだけでは、乱数や周辺修理でtest3が通った時にオーナーが同じ誤捕球へ再遭遇する。
- 真因: `_test_harness_20260804.js:126-140` — `if(flyCatch) bad++; ... verdict:bad===0?'PASS':'FAIL'`。固定対象`baseball3d.html:2807`の`if(ball.z<=0.02) ball.landed=true;`をM03で旧`if(ball.z<=0.02 && ball.t>0.2) ...`へ戻した結果、落ちたのは`test3_エラー回収`1本で、直接対応の`test4_叩きつけバウンド`はPASSした。
- 深さ: 実行（固定seed `0x71D22228`、M03の一意置換1件、15 PASS / 1 FAIL。意図したtest4はPASS）
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding27BounceOracleMismatch`
- 修理案: CC側でtest4へ症状直結ケースを追加する。球を`t=0.10秒, z=0.01ft, vz<0, landed=false`に置いてproductionの1 tickを進め、同tickで`landed=true`になること、同位置の野手接触がフライアウトを付けないことを30反復でassertする。球が`z>0.02ft`、上昇中`vz>=0`、または実際に地面へ届いていない場面には着地判定を要求しない。


## 所見28: 守備加速の変異は落ちたが、落ちたのは速度を測らない幽霊飛行test9だけだった
- 目的への影響: 野手の一歩目が速すぎる再発を直接測らないため、別の球速症状との偶然の結び付きが消えると、オーナーには全守備が不自然に瞬間加速するのにハーネスは合格する。
- 真因: `_test_harness_20260804.js:221-236` — `if(Math.hypot(ball.vx,ball.vy,ball.vz)>10) ghosts++; ... verdict: ghosts===0?'PASS':'FAIL'`。test9は捕球後の球速だけを測る。固定対象`baseball3d.html:885`の`const F_REACT = 0.28, ACC_T = 1.90, ACC_F = 1.15;`をM10で旧`ACC_F = 0.80`へ戻すとtest9だけがFAILし、野手の加速時間・移動距離を直接見る項目は0件だった。
- 深さ: 実行（固定seed `0x71D22228`、M10の一意置換1件、15 PASS / 1 FAIL。唯一のFAILはtest9）
- 再現: `review_sol_ultra_repro_20260805.js` 内の `reproFinding28FielderSpeedOracleMismatch`
- 修理案: CC側で「守備の一歩目」テストを追加する。`v=30ft/s, d=30ft`でproductionの`runTime`を1.55〜1.60秒（現行1.575秒）とし、停止状態から0.80秒後の移動を7.5〜9.2ftに収めることを、内野4人×左右2方向×3反復でassertする。既に最高速で走行中の野手、30ftを超える定速区間、走者の`ACC_T`にはこの一歩目条件を適用しない。


## 工程5 完了宣言 — ハーネス変異監査

- 検出力の前提: 定数0.5の初回BASELINE（15/16、失策0）と固定seed v2（15/16、最大回収3.23秒）は、いずれも基準ゲートで停止し、変異0件の無効runとして経緯を保存した。結果を見て基準FAILを握りつぶしていない。
- 最終固定条件: 結果を見る前に宣言したSHA-256候補列の先頭`i=1`でBASELINE 16/16となったseed=`0x71D22228`を固定した。計画v3 SHA-256は`130E026F9AD24A6D975B5A1D9C7F3EBC71B3C10A15794A0EB452BD1AC64C884E`、宣言済み10変異・11置換・S-1〜S-13のunionは変更していない。
- 実行完了: 別子プロセス・別VMでBASELINE 16/16 PASSを再確認後、M01〜M10を全10件実行した。全件valid、注入11/11、timeout 0、乱数列復元11/11、一時ファイル0、監査全体`auditValid=true`。
- 検出結果: M01=2本、M02=1本、M03=1本、M04=0本、M05=1本、M06=1本、M07=0本、M08=0本、M09=0本、M10=1本。1本以上検出6/10、全PASS見逃し4/10（M04 / M07 / M08 / M09）。
- 穴の処理: 0本の4変異は所見23〜26へ1件ずつ保存し、カバー成立時刻・走行中送球ずれ・担当交代方向・線際カメラについて、数値条件と非発動条件を含むCC側追加テスト仕様を書いた。
- 直接性の処理: M03は対応test4ではなくtest3だけ、M10は守備速度ではなくtest9だけが落ちたため、単なる「検出済み」で済ませず所見27〜28へ直接oracle不足として保存した。
- 再現確認: `reproFinding23HarnessMissCoverArrival`〜`reproFinding26HarnessMissCameraOcclusion`は各16 PASS / 0 FAILを再実行し、`reproFinding27BounceOracleMismatch`はtest3だけFAIL・意図したtest4はPASS、`reproFinding28FielderSpeedOracleMismatch`はtest9だけFAILを再実行した。全関数で乱数列復元PASS・一時ファイル0。
- 独立監査: 別のxhigh監査で本番監査を再実行し、BASELINE 16/16、10変異全件valid、各FAIL本数・項目、4穴、乱数復元、正本不変が一致した。所見23〜28の必須5項目・行引用・追加テスト仕様・再現関数に、完了宣言を除くblockerは0件だった。本宣言がその最後のblockerを解消する。
- 不変確認: 固定対象HTML SHA-256=`2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183`、正本ハーネス SHA-256=`8C4EF06D934C68A4993F27B3139AF1EEF317BA237A00287A05466CCA5EDE85F8`、現行実装SHA-256=`892CB56BBEC37E967FAF445635E8C0208372025F290C8AF2394A6B524BB56415`は工程5実行前後で不変。`baseball3d.html`と`_test_harness_20260804.js`は編集していない。
- 未実施: 工程5の指定項目は0件。工程0〜5の指定工程もすべて完了し、各工程の完了宣言を保存した。

以上を工程5の完了条件とし、この宣言の保存後に全成果物の最終検証と一時ファイル削除へ進む。

### 最終検証補遺 — 一時HTML削除後の自己校正

- 一時ファイル削除後、`--calibrate`の初回最終実行は120秒でtimeoutした。判定FAILではなく、旧版に対して校正対象外のtest1〜11と`sweep128`まで含む正本ハーネス全体を走らせていた再現スクリプトの実行上限超過だった。
- 修正: 正本ハーネスSHA-256を検証した後、その逐語ソースから`function totalRuns()`を開始点、`console.log(JSON.stringify(out,null,1));`を終了点としてtest12〜14だけを抽出し、旧版・対象版へ同じ抽出コード、同じ`Math.random=0.5`、同じVM条件で適用するよう再現スクリプトを変更した。実装HTMLと正本ハーネスは変更していない。
- 再実行: Gitの凍結blobから直接読み、旧`b0804-33`はtest12=FAIL（12試行）、test13=FAIL（8試行）、test14=FAIL（6試行）、対象`b0805-06`は同じ12/8/6試行で全3件PASS、`gatePassed=true`。実行時間5.2秒。
- 再現入口: `review_sol_ultra_repro_20260805.js --calibrate`。`_tmp_old_b0804-33.html`と`_tmp_target_b0805-06.html`が存在しなくても、固定commitのGit blobと期待SHA-256から再構築する。
- 検出条件・試行数・判定結果は工程0の保存値と一致し、校正以外の工程結果は変更していない。
