---
name: feedback-preview-pane-cannot-run-realtime-apps
description: アプリ内プレビュー枠はコマ送りが止まりタイマーも1秒刻みに絞られるため、ゲーム・アニメーションの動作確認には使えない。実ブラウザで検証する
metadata: 
  node_type: memory
  type: feedback
  originSessionId: bf4fbe1e-6286-44a5-8364-edd1fd0f8f4b
  modified: 2026-07-31T10:32:12.499Z
---

アプリ内の Browser ペイン（`mcp__Claude_Browser__*` が映すプレビュー枠）は、**リアルタイムに動くもの（ゲーム・アニメーション・時間で進む画面）の検証には使えない**。2026-07-31 に実測で確認した挙動:

- `requestAnimationFrame` が**1回だけ発火して以降止まる**（ページが再描画されないと次のコマが来ない＝裏に回ったタブと同じ扱い）
- 予備の `setInterval` は動くが**1秒刻みまで間引かれる**ため、進行が実時間の1/20になる
- `screenshot` も「Browser pane is not displayed」で失敗することがある
- `location.reload()` しても直らない（枠の性質であってページの問題ではない）

**Why:** 野球ゲームを作った際、ユーザーから「ここから動きません」と報告された。ゲーム側は正常で、原因はプレビュー枠側だった。原因究明に時間を使ったうえ、ユーザーには「壊れている」と見えていた。

**How to apply:**
1. 動くものを作ったら、**プレビュー枠での見た目を「動作確認」と呼ばない**。静止画の確認までにとどめる。
2. 検証は実ブラウザで行う。playwright は `file:` を拒否するので、`preview_start` で簡易サーバ（`python -m http.server`）を立て、`http://localhost:<port>/...` を playwright で開く。終わったらサーバ停止と `launch.json` の追記を元に戻す。
3. 状態を固定して画面を確認したい時は、`for(let i=1;i<20000;i++) clearInterval(i)` と `requestAnimationFrame` の無効化を**同じ evaluate 内で**行う（別呼び出しの間にブラウザが再読込されて状態が進むことがある）。
4. **ユーザーに渡す時は「普通のブラウザで開いてください」と明記する。** 併せて、コマ送りが止まる環境ではタイマー駆動へ自動切替するフォールバックを実装しておく。

関連: [[feedback-operational-status-needs-execution-evidence]] / [[feedback-measure-by-apparatus-not-eyeball]]
