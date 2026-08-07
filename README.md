# baseball3d-game

単一HTML（外部依存なし）で作った3D野球ゲーム。オーナーが遊びながら不具合報告→AI（Claude Code / Codex）が直す、というサイクルで開発している個人プロジェクト。

このリポジトリは、作業元の巨大なプロジェクト用リポジトリ（他の非公開プロジェクトを多数含む）から、このゲームのフォルダだけを履歴なしで切り出したものです。

## まず読むもの

- [`REBUILD_CHARTER.md`](REBUILD_CHARTER.md) — 開発の経緯・方針・修正履歴・検証ハーネスの説明
- [`OWNER_ISSUE_MASTER_20260805.md`](OWNER_ISSUE_MASTER_20260805.md) — オーナーの全指摘（原文つき・番号付き）と再発系統の分析
- [`REVIEW_SYNTHESIS_20260805.md`](REVIEW_SYNTHESIS_20260805.md) — 独立レビュー2件の突合・裁定

## 実行方法

`baseball3d.html` をブラウザで直接開くだけ（サーバー不要）。

## 検証

`_test_harness_20260804.js` の全文を、ゲームを開いた状態のブラウザ開発者コンソールに貼り付けて実行するとPASS/FAILが出ます。
