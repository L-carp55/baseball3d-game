// 録画JSON全50件を走査し、ファイル名/BUILD/保存日時/プレー数/タグ一覧を索引化する。
// 対応OI番号は OWNER_ISSUE_MASTER_20260805.md 内の "[録画YYYYMMDD_HHMMSS" 表記から逆引きする。
const fs = require('fs');
const path = require('path');
const RECDIR = 'C:/Users/<local-user>/Desktop/Claude Code/野球ゲーム/_archive_for_gpt_handoff_20260805/02_recordings';
const MASTER = 'C:/Users/<local-user>/Desktop/Claude Code/野球ゲーム/OWNER_ISSUE_MASTER_20260805.md';
const OUT = 'C:/Users/<local-user>/Desktop/Claude Code/野球ゲーム/_archive_for_gpt_handoff_20260805/02_recordings/_INDEX_recordings.md';

const masterTxt = fs.readFileSync(MASTER, 'utf8');
// OI-番号ブロックを分割し、各ブロック内に出てくる録画スタンプ(8桁_6桁)を集める
const oiBlocks = masterTxt.split(/(?=^## OI-\d{3} )/m).filter((b) => /^## OI-\d{3} /.test(b));
// 本文中の実際の表記は「録画170919」のように6桁時刻のみ（日付プレフィクスなし）。
// フルスタンプ(8桁_6桁)と6桁時刻(HHMMSS)の両方でインデックスを作る。
const stampToOIs = {};   // フルスタンプ(YYYYMMDD_HHMMSS) -> [OI...]
const timeToOIs = {};    // 時刻のみ(HHMMSS) -> [OI...]（曖昧さが残る場合の補助）
for (const block of oiBlocks) {
  const oiMatch = block.match(/^## (OI-\d{3})/);
  if (!oiMatch) continue;
  const oi = oiMatch[1];
  const fullStamps = [...block.matchAll(/(\d{8}_\d{6})/g)].map((m) => m[1]);
  for (const s of new Set(fullStamps)) (stampToOIs[s] = stampToOIs[s] || []).push(oi);
  const timeStamps = [...block.matchAll(/録画(\d{6})\b/g)].map((m) => m[1]);
  for (const s of new Set(timeStamps)) (timeToOIs[s] = timeToOIs[s] || []).push(oi);
}

const files = fs.readdirSync(RECDIR).filter((f) => f.endsWith('.json'));
const rows = [];
for (const f of files.sort()) {
  const stampMatch = f.match(/(\d{8}_\d{6})/);
  const stamp = stampMatch ? stampMatch[1] : null;
  let build = 'UNKNOWN', savedAt = 'UNKNOWN', plays = 'UNKNOWN', tags = [];
  try {
    const d = JSON.parse(fs.readFileSync(path.join(RECDIR, f), 'utf8'));
    build = (d['版'] || '').replace('baseball3d 記録 v1 ', '') || 'UNKNOWN';
    savedAt = d['保存日時'] || 'UNKNOWN';
    plays = d['プレー数'] != null ? String(d['プレー数']) : 'UNKNOWN';
    tags = (d.plays || []).map((p) => p.tag).filter(Boolean);
  } catch (e) {
    build = 'PARSE_ERROR: ' + e.message;
  }
  const timeOnly = stamp ? stamp.split('_')[1] : null;
  let ois = stamp ? (stampToOIs[stamp] || []) : [];
  let matchKind = ois.length ? 'フルスタンプ一致' : '';
  if (!ois.length && timeOnly && timeToOIs[timeOnly]) {
    ois = timeToOIs[timeOnly];
    matchKind = '時刻のみ一致（録画HHMMSS表記から逆引き）';
  }
  rows.push({ f, stamp, build, savedAt, plays, tags, ois, matchKind });
}

let md = '# 録画JSON 索引（全' + rows.length + '件）\n\n';
md += '> BUILD・保存日時・プレー数は各JSONの `版`/`保存日時`/`プレー数` フィールドから機械抽出。対応OI番号は `OWNER_ISSUE_MASTER_20260805.md` 内で当該録画スタンプが言及されているOI項目を逆引きしたもの（言及が本文になければ空欄=UNKNOWN扱い）。\n\n';
md += '| ファイル名 | BUILD | 保存日時 | プレー数 | 対応OI番号 | 一致方法 |\n|---|---|---|---|---|---|\n';
for (const r of rows) {
  md += `| ${r.f} | ${r.build} | ${r.savedAt} | ${r.plays} | ${r.ois.length ? [...new Set(r.ois)].join(', ') : 'UNKNOWN（本文中の直接言及なし）'} | ${r.matchKind || '-'} |\n`;
}

md += '\n\n## タグ内訳（各録画の1プレー目、参考）\n\n';
for (const r of rows) {
  md += `- **${r.f}**: ${r.tags[0] || '(プレーなし)'}${r.tags.length > 1 ? `　他${r.tags.length - 1}プレー` : ''}\n`;
}

fs.writeFileSync(OUT, md, 'utf8');
console.log('索引作成完了:', rows.length, '件');
console.log('OI対応が見つかった録画:', rows.filter((r) => r.ois.length).length, '件');
console.log('OI対応UNKNOWN:', rows.filter((r) => !r.ois.length).length, '件');
