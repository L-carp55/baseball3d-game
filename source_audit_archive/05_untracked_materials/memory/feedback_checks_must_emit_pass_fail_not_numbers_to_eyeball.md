---
name: feedback-checks-must-emit-pass-fail-not-numbers-to-eyeball
description: 検査は数値と期待値を並べて目視で比べる形にしない。コードに判定させてPASS/FAILを出させる。目視比較は読み飛ばして逆の結果でも合格にする
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a4ff017c-45da-40dd-818a-23c3a7be590b
  modified: 2026-08-04T07:30:19.159Z
---

自分で書く検査は、**「実測値と期待値を並べて表示し、目で比べる」形式にしない**。比較そのものをコードにやらせて **PASS / FAIL** を出させる。

2026-08-04の野球ゲームで実害。バックネットの表示検査で `"打席の視点 1 / 後方95ft 0 / 外野側 0（前2つは0、最後は1が正しい）"` という出力を得た。**書いた期待値（0/0/1）と実測（1/0/0）が正反対**なのに、そのまま「直った」と報告した。数字は出力に全部あった——比較する工程だけが人間（私）に残されていて、そこで読み飛ばした。結果、利用者が3回目の「まだ邪魔」を報告することになり、しかも真因（ネットがマウンドの上に建っていた＝ジオメトリの誤り）はこの検査形式では永遠に見つからなかった。

**Why:** 数値の羅列＋注釈は「検査をした」という体裁を作るが、判定は行われていない。特に修正を重ねた終盤は「今度こそ直ったはず」という予期があり、目は期待に合う読み方をする。コードの `===` に予期は無い。

**How to apply:**
1. 検査の出力は `PASS` / `FAIL(期待X 実測Y)` の形式にする。数値を並べて「〜が正しい」と注記する形式を書きそうになったら、その注記を比較式に変える
2. FAIL が1つでもあれば、修正報告を書き始める前に止まる（レポート生成を条件分岐にすると強制できる）
3. 表示・配置・ジオメトリの類は数値検査に加えて**実画面を1枚見る**（呼び出し回数や座標のhypotは「どこに建っているか」を語らない）[[feedback-new-obstacle-must-be-checked-on-the-main-path]]
4. 同じ症状の再報告が来たら、前回の検査の**出力ログを読み直す**——合格と報告した検査が実は落ちていたことがある

関連: [[feedback-self-verify-before-report]] / [[feedback-measure-the-symptom-not-the-mechanism-you-fixed]] / [[feedback-check-the-do-nothing-baseline-before-setting-a-threshold]]
