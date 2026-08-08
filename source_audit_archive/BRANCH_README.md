# このブランチについて

`agent/source-audit-archive` — 「なぜ直したはずの不具合が再発・部分解決を繰り返したか」を再監査するための一次資料・派生資料集。`main`ブランチ（ゲーム本体のスナップショット）とは独立に運用する。

まず読むもの:
1. [`README.md`](README.md) — 本アーカイブ全体の構成
2. [`BASEBALL3D_HANDOFF_20260808.md`](BASEBALL3D_HANDOFF_20260808.md) — 最新の引継ぎ（経緯・未解決系統・次にやること）
3. [`06_OI_evidence_table.md`](06_OI_evidence_table.md) — オーナー指摘253件の証拠対応表
4. [`VERSION_MISMATCH_INCIDENTS.md`](VERSION_MISMATCH_INCIDENTS.md) — 「再発」報告の一部が実は版ずれによる誤報だった事例
5. [`POST-OI_UNNUMBERED.md`](POST-OI_UNNUMBERED.md) — 正式なOI番号が振られていない2件の録画

## 含まれていないもの（意図的）

- 元セッションの生JSONL、録画JSON原本 — ローカルの一次資料として別途保管。ローカルの絶対パスを含むため非公開。
- 現在進行中セッションのJSONL。

## 公開前の安全確認

このブランチの全ファイルは、公開前に以下を確認済み: ローカル絶対パス（`C:\Users\<実ユーザー名>`）の除去、メールアドレス（GitHubのnoreplyアドレスを除く）の非混入、APIキー/トークン様文字列の非混入、他プロジェクト名・内部情報を含むファイルの除外（4件除外・2件は該当行のみ一般化編集）。詳細はコミットメッセージ参照。
