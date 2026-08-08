// OI証拠対応表の生成（全253件）。
// 列: OI番号/原文/日時/ClaudeセッションID/queued or turn/対応録画JSON/報告BUILD/原因/修正BUILD/修正commit/回帰テスト名/現在の判定/備考
// 方針: すべて機械的な突合で埋める。突合できない欄は UNKNOWN。推測で埋めない。
const fs = require('fs');
const { execSync } = require('child_process');

const ARCH = 'C:/Users/<local-user>/Desktop/Claude Code/野球ゲーム/_archive_for_gpt_handoff_20260805';
const GAME = 'C:/Users/<local-user>/Desktop/Claude Code/野球ゲーム';

// ---------- 1. OWNER_ISSUE_MASTER から OI本体を抽出 ----------
const masterTxt = fs.readFileSync(`${GAME}/OWNER_ISSUE_MASTER_20260805.md`, 'utf8');
const oiBlocks = masterTxt.split(/(?=^## OI-\d{3} )/m).filter((b) => /^## OI-\d{3} /.test(b));
const oi = {}; // OI-NNN -> record
for (const block of oiBlocks) {
  const head = block.match(/^## (OI-\d{3}) \[([^\]]+)\][^\n]*/);
  if (!head) continue;
  const num = head[1];
  const dateTag = head[2]; // 例: "07-31 07:34" または "08-05 11:16"
  const quoteMatch = block.match(/^> ([\s\S]*?)(?=\n\n|\n記録|\n$)/m);
  const quote = quoteMatch ? quoteMatch[1].replace(/\n/g, ' ').trim() : '';
  const recMatch = block.match(/録画(\d{6,15})/);
  const recTag = recMatch ? recMatch[1] : null;
  oi[num] = { num, dateTag, quote, recTag, rawBlock: block };
}

// ---------- 2. 152件抽出（session/queued-or-turn/正確なISO日時）と日時+本文前方一致で突合 ----------
const reaudit = fs.readFileSync(`${ARCH}/01_session_jsonl/owner_messages_full_reaudit.md`, 'utf8');
const msgEntries = [...reaudit.matchAll(/===== #\d+ \[([^\]]+)\] \(session:([a-f0-9]{8}) \/ (turn|queued)\) =====\n([\s\S]*?)(?=\n\n\n=====|$)/g)]
  .map((m) => ({ iso: m[1], sessionShort: m[2], kind: m[3], text: m[4].trim() }));

// dateTagは "08-04 06:26" 形式。同じ月日時分のmsgHitだけを正当な一致として採用する
// （本文の短い部分一致だけで判定すると、全く別の日の似た文言に誤って一致することがある。
//  実際にOI-140でこの誤マッチが起き、07-31の別メッセージへ誤って結びついていた＝要検算）。
function dateTagToMD(tag) {
  const m = tag.match(/(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]} ${m[3]}:${m[4]}`;
}
function isoToMD(iso) {
  const m = iso.match(/2026-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]} ${m[3]}:${m[4]}`;
}
function findMsgMatch(quote, dateTag) {
  if (!quote) return null;
  const wantMD = dateTagToMD(dateTag);
  const prefix = quote.slice(0, 30);
  const candidates = msgEntries.filter((m) => m.text.startsWith(prefix) || m.text.includes(prefix) ||
    (quote.length > 15 && m.text.includes(quote.slice(0, 15))));
  if (!candidates.length) return null;
  // 日時が一致（同一分）する候補を優先。無ければ「日時不一致のため不採用」として null を返す
  // （誤った組み合わせを見えなくするよりは、UNKNOWNのほうが安全）。
  const dateMatched = candidates.filter((m) => isoToMD(m.iso) === wantMD);
  if (dateMatched.length) return dateMatched[0];
  return { mismatch: true, candidates: candidates.length };
}

// ---------- 3. 録画索引（OI-NNN -> 録画ファイル名・BUILD） ----------
const recIndexTxt = fs.readFileSync(`${ARCH}/02_recordings/_INDEX_recordings.md`, 'utf8');
const recRows = [...recIndexTxt.matchAll(/^\| (野球ゲーム記録_[^\|]+\.json) \| ([^\|]+) \| [^\|]+ \| [^\|]+ \| ([^\|]+) \|/gm)];
const oiToRecording = {}; // OI-NNN -> {file, build}
for (const r of recRows) {
  const file = r[1].trim();
  const build = r[2].trim();
  const oisField = r[3].trim();
  const nums = [...oisField.matchAll(/OI-\d{3}/g)].map((m) => m[0]);
  for (const n of nums) {
    if (!oiToRecording[n]) oiToRecording[n] = { file, build };
  }
}

// ---------- 4. git commit メッセージから "OI-NNN" 言及 -> 修正commit・修正BUILD ----------
const REPO = 'C:/Users/<local-user>/Desktop/Claude Code';
const allCommits = execSync(
  `git log --since="2026-07-31" --until="2026-08-08" --pretty=format:"%H|%aI|%s" -- "野球ゲーム/"`,
  { cwd: REPO, encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 }
).split('\n').filter(Boolean).map((l) => {
  const [sha, date, ...m] = l.split('|');
  return { sha, date, msg: m.join('|') };
});
const oiToCommit = {}; // OI-NNN -> [{sha, date, msg}]
for (const c of allCommits) {
  const nums = [...c.msg.matchAll(/OI-\d{3}/g)].map((m) => m[0]);
  for (const n of new Set(nums)) (oiToCommit[n] = oiToCommit[n] || []).push(c);
}
// 補強: commit subjectだけでなく、diff本文（コード内コメント含む）からもOI番号を拾う。
// ★重要: OWNER_ISSUE_MASTER.md / REBUILD_CHARTER.md への追記commitは「そのOIを記録しただけ」で
// 「直した」わけではない。実際の修正commitとして数えてよいのは baseball3d.html /
// _test_harness_20260804.js のdiffにOI番号が現れる場合だけ（コード側の変更）。
// 文書系commitへの言及は別集計（docMention）として保持し、fixCommitとは混ぜない。
const commitBySha = {};
for (const c of allCommits) commitBySha[c.sha] = c;
const CODE_LOGS = ['log_baseball3d_html.txt', 'log__test_harness_20260804_js.txt'];
const DOC_LOGS = ['log_REBUILD_CHARTER_md.txt', 'log_OWNER_ISSUE_MASTER_20260805_md.txt'];
const oiToDocCommit = {};
function scanLogs(fileList, target) {
  for (const lf of fileList) {
    const p = `${ARCH}/03_git_history/${lf}`;
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    const chunks = txt.split(/(?=^commit [0-9a-f]{40}$)/m);
    for (const chunk of chunks) {
      const shaMatch = chunk.match(/^commit ([0-9a-f]{40})$/m);
      if (!shaMatch) continue;
      const sha = shaMatch[1];
      const c = commitBySha[sha];
      if (!c) continue;
      // diffの追加行（+で始まる行）だけを見る＝そのcommitで新たに書かれた内容に限定
      const addedLines = chunk.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
      const nums = [...addedLines.join('\n').matchAll(/OI-\d{3}/g)].map((m) => m[0]);
      for (const n of new Set(nums)) {
        target[n] = target[n] || [];
        if (!target[n].some((x) => x.sha === sha)) target[n].push(c);
      }
    }
  }
}
scanLogs(CODE_LOGS, oiToCommit);
scanLogs(DOC_LOGS, oiToDocCommit);
// 各OIの配列を時系列(古い→新しい)に揃える
for (const n of Object.keys(oiToCommit)) oiToCommit[n].sort((a, b) => new Date(a.date) - new Date(b.date));
for (const n of Object.keys(oiToDocCommit)) oiToDocCommit[n].sort((a, b) => new Date(a.date) - new Date(b.date));
function buildOfCommit(sha) {
  try {
    const content = execSync(`git show ${sha}:"野球ゲーム/baseball3d.html"`, { cwd: REPO, encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 });
    const m = content.match(/const BUILD = '([^']+)'/);
    return m ? m[1] : 'UNKNOWN';
  } catch (e) { return 'UNKNOWN'; }
}

// ---------- 5. 3レビューの判定 ----------
const fableTxt = fs.readFileSync(`${GAME}/review_fable_20260805.md`, 'utf8');
const fableVerdict = {};
for (const m of fableTxt.matchAll(/^\| ?(\d{3}) \| ?(解決|未解決|部分解決|退行|判定不能|対象外)/gm)) {
  fableVerdict['OI-' + m[1]] = m[2];
}
const solTxt = fs.readFileSync(`${GAME}/review_sol_20260805.md`, 'utf8');
const solVerdict = {};
for (const m of solTxt.matchAll(/^\| (OI-\d{3}) \| (\S+) \|/gm)) {
  solVerdict[m[1]] = m[2];
}
const ultraTxt = fs.readFileSync(`${GAME}/review_sol_ultra_20260805.md`, 'utf8');
const ultraFindings = ultraTxt.split(/(?=^## 所見\d+)/m).filter((b) => /^## 所見\d+/.test(b));
const oiToUltraFinding = {};
for (const block of ultraFindings) {
  const numMatch = block.match(/^## (所見\d+)/);
  if (!numMatch) continue;
  const finding = numMatch[1];
  const nums = [...block.matchAll(/OI-\d{3}/g)].map((m) => m[0]);
  for (const n of new Set(nums)) (oiToUltraFinding[n] = oiToUltraFinding[n] || []).push(finding);
}

// ---------- 6. 回帰テスト名（harnessコメントからOI番号を逆引き） ----------
const harnessTxt = fs.readFileSync(`${GAME}/_test_harness_20260804.js`, 'utf8');
const testBlocks = harnessTxt.split(/(?=\/\/ ===== test\d+)/).filter((b) => /^\/\/ ===== test\d+/.test(b));
const oiToTest = {};
for (const block of testBlocks) {
  // "// ===== test12: 走者目標の反転（..." のコメント見出し1行だけを対象にする（本文全体を誤爆させない）
  const headLine = block.split('\n')[0];
  const nameMatch = headLine.match(/test\d+[:：]?\s*([^\n（(=]+)/);
  if (!nameMatch) continue;
  const testName = ('test' + headLine.match(/test(\d+)/)[1] + '_' + nameMatch[1].trim()).replace(/\s+/g, '');
  const nums = [...block.matchAll(/OI-\d{3}/g)].map((m) => m[0]);
  for (const n of new Set(nums)) (oiToTest[n] = oiToTest[n] || []).push(testName);
}

// ---------- 7. 組み立て ----------
const oiNums = Object.keys(oi).sort();
const rows = [];
for (const num of oiNums) {
  const rec = oi[num];
  const msgHitRaw = findMsgMatch(rec.quote, rec.dateTag);
  const msgHit = msgHitRaw && !msgHitRaw.mismatch ? msgHitRaw : null;
  const dateMismatch = msgHitRaw && msgHitRaw.mismatch;
  const recording = oiToRecording[num];
  const commits = oiToCommit[num] || [];
  const fixCommit = commits.length ? commits[commits.length - 1] : null; // 最新（最後に言及された）commit
  const fixBuild = fixCommit ? buildOfCommit(fixCommit.sha) : 'UNKNOWN';
  const ultra = oiToUltraFinding[num] || [];
  const test = oiToTest[num] || [];

  // 判定の統合（3者を並記。UNKNOWNは非対象を意味する）
  const verdicts = [];
  if (fableVerdict[num]) verdicts.push('Fable=' + fableVerdict[num]);
  if (solVerdict[num]) verdicts.push('Sol=' + solVerdict[num]);
  if (ultra.length) verdicts.push('Ultra=' + ultra.join('/'));
  const verdictStr = verdicts.length ? verdicts.join(' / ') : 'UNKNOWN（3レビューいずれも本OI番号を直接判定していない）';

  // 原因: OWNER_ISSUE_MASTER内の「記録:」テキストがあればそれを使う（真因の記述）
  const causeMatch = rec.rawBlock.match(/記録: ([\s\S]*?)(?=\n\n|$)/);
  const cause = causeMatch ? causeMatch[1].replace(/\n/g, ' ').trim().slice(0, 300) : 'UNKNOWN（記録欄なし＝未対応 or 要望・質問系）';

  rows.push({
    num,
    quote: rec.quote || 'UNKNOWN',
    datetime: msgHit ? msgHit.iso : ('2026-' + rec.dateTag.replace(' ', 'T') + ':00+09:00（推定・本文ヘッダより）'),
    sessionId: msgHit ? msgHit.sessionShort : (dateMismatch ? 'UNKNOWN（本文類似候補はあるが日時不一致のため不採用）' : 'UNKNOWN'),
    kind: msgHit ? (msgHit.kind === 'turn' ? '通常userターン' : 'queued_command/queue-operation') : 'UNKNOWN',
    recording: recording ? recording.file : (rec.recTag ? `UNKNOWN（本文に録画${rec.recTag}の言及があるが50件索引に一致ファイル無し）` : 'UNKNOWN（本文に録画言及なし）'),
    reportedBuild: recording ? recording.build : 'UNKNOWN',
    cause,
    fixBuild: fixCommit ? fixBuild : 'UNKNOWN',
    fixCommit: commits.length ? commits.map((c) => c.sha.slice(0, 8)).join('; ') + ` （最新: ${fixCommit.date}）` : 'UNKNOWN（コード側diffにOI番号の追記行なし。記録欄の内容から人間が対応commitを推定する必要あり）',
    testName: test.length ? test.join('/') : 'UNKNOWN',
    verdict: verdictStr,
    note: (oiToDocCommit[num] || []).length
      ? `文書(charter/master)への言及commit: ${oiToDocCommit[num].map((c) => c.sha.slice(0, 8)).join('; ')}`
      : '',
  });
}

// ---------- 8. CSV + Markdown 出力 ----------
function csvEscape(s) {
  s = String(s || '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
const header = ['OI番号', '原文', '日時', 'ClaudeセッションID', '発言種別', '対応録画JSON', '報告BUILD', '原因', '修正BUILD', '修正commit', '回帰テスト名', '現在の判定', '備考'];
const csvLines = [header.join(',')];
for (const r of rows) {
  csvLines.push([r.num, r.quote, r.datetime, r.sessionId, r.kind, r.recording, r.reportedBuild, r.cause, r.fixBuild, r.fixCommit, r.testName, r.verdict, r.note].map(csvEscape).join(','));
  // (note列は既にheader/rowへ含まれている。以降のロジック追加なし)
}
fs.writeFileSync(`${ARCH}/06_OI_evidence_table.csv`, csvLines.join('\n'), 'utf8');

let md = `# OI証拠対応表（全${rows.length}件）\n\n`;
md += '> 機械的な突合による生成。不明な欄はUNKNOWNのまま（推測で埋めていない）。生成スクリプト=`05_untracked_materials/extraction_scripts/build_oi_evidence_table.js`。同フォーマットのCSV=`06_OI_evidence_table.csv`。\n\n';
md += '| OI | 日時 | セッション | 種別 | 録画 | 報告BUILD | 修正BUILD | 修正commit(コード) | テスト | 判定 | 備考 |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
for (const r of rows) {
  md += `| ${r.num} | ${r.datetime.slice(0, 16)} | ${r.sessionId} | ${r.kind} | ${r.recording} | ${r.reportedBuild} | ${r.fixBuild} | ${r.fixCommit} | ${r.testName} | ${r.verdict} | ${r.note} |\n`;
}
fs.writeFileSync(`${ARCH}/06_OI_evidence_table.md`, md, 'utf8');

// ---------- 9. 完成度サマリ ----------
const summary = {
  total: rows.length,
  session特定済み: rows.filter((r) => r.sessionId !== 'UNKNOWN').length,
  録画対応あり: rows.filter((r) => !r.recording.startsWith('UNKNOWN')).length,
  修正commit特定済み: rows.filter((r) => !r.fixCommit.startsWith('UNKNOWN')).length,
  文書のみ言及: rows.filter((r) => r.fixCommit.startsWith('UNKNOWN') && r.note).length,
  回帰テストあり: rows.filter((r) => r.testName !== 'UNKNOWN').length,
  判定あり: rows.filter((r) => !r.verdict.startsWith('UNKNOWN')).length,
};
console.log(JSON.stringify(summary, null, 1));
