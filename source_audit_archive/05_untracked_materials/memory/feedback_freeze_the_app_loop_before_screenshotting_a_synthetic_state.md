---
name: feedback-freeze-the-app-loop-before-screenshotting-a-synthetic-state
description: 常時描画のアプリで合成した場面を撮る時は、アプリ自身のループを止めないと撮影までに上書きされる
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a4ff017c-45da-40dd-818a-23c3a7be590b
  modified: 2026-08-04T03:48:42.194Z
---

requestAnimationFrame などで**常時描き直しているアプリ**の画面を確認する時、検証コードで場面を作って `draw()` を呼んでも、**撮影までの間にアプリ自身のループが現在の状態で描き直す**ため、意図した場面が写らない。

2026-08-04の野球ゲームで2回無駄撃ちした。「深いフライを追うカメラ」を確認したくて、その状態を作って描いたのに、撮れた画像は通常の打席画面だった。evaluate が返ってから screenshot が走るまでの間に、ゲームのループが数フレーム回っていた。

**ポーズ機能を使うのは半分しか正しくない**。ポーズは暗幕や「ポーズ中」の文字を重ねる作りが多く、色や明るさが変わって見た目の判断に使えない。

**How to apply:**
1. 合成した場面を撮る時は、**更新だけを止める**（`window.update = ()=>{}` のように差し替える）。描画は動いたままなので、同じ場面が描き続けられる
2. アプリのポーズ機能は、暗幕や文字が乗らないと確認してから使う
3. 撮影後はリロードして差し替えを戻す（後続の検証に漏れないように）
4. 「実際の操作でその場面に到達させて、到達した瞬間に撮る」方法も使えるが、狙った場面が出るまで時間がかかるので、状態を直接作れるなら上の方が速い

関連: [[feedback-preview-pane-cannot-run-realtime-apps]] / [[feedback-measure-by-apparatus-not-eyeball]]
