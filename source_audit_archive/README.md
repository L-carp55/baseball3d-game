# 野球ゲーム GPT引継ぎ用アーカイブ（2026-08-05収集）

> 目的: 「オーナーが指摘してきた多数の問題が、なぜ直したはずなのに再発・部分解決を繰り返したのか」を、元会話・録画・Git履歴まで遡って再監査できる状態にすること。既存の `github.com/L-carp55/baseball3d-game`（コード成果物のみ、履歴なし）を補完する一次資料集。

## フォルダ構成

| フォルダ/ファイル | 内容 | サイズ目安 |
|---|---|---|
| `01_session_jsonl/` | 元セッション4本の生JSONL＋抽出物 | 35MB |
| `02_recordings/` | 録画JSON全50件＋索引 | 8.7MB |
| `03_git_history/` | 4対象ファイルの全コミットdiff＋構造化索引 | 508KB |
| `04_build_snapshots/` | BUILD別スナップショット（6/11件を復元） | 1.7MB |
| `05_untracked_materials/` | タスク台帳・メモリ・change_log抜粋・全抽出スクリプト | 232KB |
| `06_OI_evidence_table.md` / `.csv` | OI証拠対応表（全253件） | 277KB |

## 各フォルダの詳細

### 01_session_jsonl/
- 対象4セッション（bf4fbe1e / a4ff017c / bbd2bf55 / c72ec349）の生jsonlをバイト単位でコピー。
- `owner_messages_full_reaudit.md`: 152件の人間発言（通常ターン＋queued_command＋queue-operation）を再抽出。`owner_messages_original_extraction_v2.md`（初回抽出）との差分は書式のみで内容は完全一致（`reaudit_diff_vs_original.txt`）＝OWNER_ISSUE_MASTERの元抽出は正確だったことを再確認済み。
- `dropped_records_audit.txt`: フィルタで除外したレコードの監査ログ（Stop hook feedback等のノイズのみで、人間発言の取りこぼしなし）。
- **★重要な限界**: 現在進行中の5セッション目（`d04cd6f9-...`、OI-237〜253を生んだセッション）のjsonlは、安全機構によりコピーがブロックされた。無理な回避はしていない。このセッションはOI-237以降の後半戦を丸ごと含む一次資料であり、**再監査に必須**。ユーザー自身が `~/.claude/projects/C--Users-<local-user>-Desktop-Claude-Code/d04cd6f9-3344-4901-a174-38bc5353feb4.jsonl` をコピーするか、セッション終了後に別セッションから改めて依頼することを推奨する。

### 02_recordings/
- `_INDEX_recordings.md`: 全50件のBUILD・保存日時・プレー数・対応OI番号（フルスタンプ一致48件・時刻のみ一致を含む）。
- **★発見1**: `野球ゲーム記録_20260805_125004.json`（b0805-01・9プレー）は正式なOI番号が振られていないが、現在セッションで実際に解析され「けん制のカバー待ち・concludePlay門番」の修理につながった一次資料。OWNER_ISSUE_MASTERへの正式な採番漏れ。
- **★発見2**: `野球ゲーム記録_20260804_202809.json`は前後の録画（202603/202825/202928）が全てOI番号を持つのに対し、唯一言及が見つからない。中身は未検証。

### 03_git_history/
- `_INDEX_git_history.md`: baseball3d.html(7)/harness(5)/REBUILD_CHARTER(2)/OWNER_ISSUE_MASTER(6)、計20コミットのSHA・日時・メッセージ・その時点のBUILD値。
- `log_*.txt`: 各ファイルの `git log -p --follow` 生出力（diff本体）。
- **★このセッションで判明した重要な事実（再発の直接証拠）**: commit `9001391b`「Sol便の『退行2件』を実機検証し誤判定と確定(版ずれ)」。Sol検査便がOI-140/238を「退行」と報告したが、実際には検査中に修理が入った版ずれによる誤報だった（`05_untracked_materials/change_log_excerpt_baseball.md` のCHG-20260805-003に詳細）。**「再発した」という報告そのものが誤りだった実例**として、他の「再発」報告も同様に版ずれを疑って良いことを示唆する。

### 04_build_snapshots/
- `_INDEX_build_snapshots.md`: 取得結果の一覧。
- **11件中6件のみgit復元可能**（b0804-33 / b0805-01 / b0805-02 / b0805-06 / b0805-08 / b0805-10）。b0805-03/04/05/07/09はコミット間の一時的な値で、個別コミットが存在しないため**原理的に復元不能**（理由は同ファイルに明記）。

### 05_untracked_materials/
- `tasks/_RAW_task_export.md`: Hub直下tasks.db（SQLite）から野球ゲーム関連18件を全文抽出。GitHubには一切含まれない。
- `memory/`: `~/.claude`配下、このプロジェクトの作業で新設・参照された学習メモリ29件のコピー（例: 「門番は合流点に置く」「自作テストは実装を呼ぶ」等、直したはずが再発した機構そのものを言語化したもの）。
- `change_log_excerpt_baseball.md`: 全プロジェクト共通のchange_log.mdから野球ゲーム関連3件を抜粋。
- `extraction_scripts/`: 本アーカイブを生成した全スクリプト（再実行可能・検算可能）。

### 06_OI_evidence_table.md / .csv
- 全253件、機械的な突合のみで生成。不明な欄は推測せずUNKNOWN。
- **正直な限界**: 「修正commit(コード)」列は、baseball3d.html/harnessの**diff追加行にOI番号が明示されているもの限定**で11件のみ特定できた。残り242件は文書（OWNER_ISSUE_MASTER/REBUILD_CHARTER）への言及commitのみ判明（備考列）——多くの修理は複数OIをまとめて1つの機構修理として行っており、個々のOI番号をコードコメントへ書いていないため。これは検出の失敗ではなく、当時の作業スタイルの実態。
- 日時・セッション・種別の突合は「本文の類似度」だけでなく「日時が一致するか」も必須条件にしている（初版でOI-140が誤った07-31のメッセージに誤マッチする不具合を自己発見・修正済み）。

## Git管理の状態（重要・要確認）

このアーカイブのうち、以下は **Hub側のローカルgit（`Desktop/Claude Code`）にコミット済み**:
- `03_git_history/` `04_build_snapshots/` `05_untracked_materials/` `06_OI_evidence_table.*` `README.md`（このファイル）

以下は **意図的に未コミット**（サイズが大きく、モノレポを永久に肥大化させるため）:
- `01_session_jsonl/`（35MB、生の会話ログ）
- `02_recordings/`（8.7MB、録画JSON）

**公開GitHubリポジトリ（`L-carp55/baseball3d-game`）へは何もプッシュしていない。** 特に `01_session_jsonl/` の生ログには、ローカルの絶対パス（`C:\Users\<local-user>\...`）やこのマシン固有の情報が含まれるため、公開リポジトリへ入れる前にオーナーの明示判断が必要。
