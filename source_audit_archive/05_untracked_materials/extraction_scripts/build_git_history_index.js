// baseball3d.html / _test_harness_20260804.js / REBUILD_CHARTER.md / OWNER_ISSUE_MASTER_20260805.md の
// 全コミット履歴を構造化する（SHA・日時・message・BUILD番号）。diffの本体は log_*.txt に既に保存済み。
const { execSync } = require('child_process');
const fs = require('fs');

const REPO = 'C:/Users/<local-user>/Desktop/Claude Code';
const OUT = 'C:/Users/<local-user>/Desktop/Claude Code/野球ゲーム/_archive_for_gpt_handoff_20260805/03_git_history/_INDEX_git_history.md';
const files = [
  ['baseball3d.html', 'log_baseball3d_html.txt'],
  ['_test_harness_20260804.js', 'log__test_harness_20260804_js.txt'],
  ['REBUILD_CHARTER.md', 'log_REBUILD_CHARTER_md.txt'],
  ['OWNER_ISSUE_MASTER_20260805.md', 'log_OWNER_ISSUE_MASTER_20260805_md.txt'],
];

let md = '# Git履歴 構造化索引（baseball3d.html / harness / REBUILD_CHARTER / OWNER_ISSUE_MASTER）\n\n';
md += '> 生成元: `git log --follow -p --since=2026-07-31 --until=2026-08-08 -- 野球ゲーム/<file>`（diff本体は同ディレクトリの `log_*.txt`）\n';
md += '> BUILD番号は、そのコミット時点の `baseball3d.html` 内 `const BUILD = \'...\'` を `git show <sha>:野球ゲーム/baseball3d.html` で直接読んで確認（baseball3d.html自身の履歴以外では「同時刻のbaseball3d.htmlの状態」として参考表示）。\n\n';

for (const [file, logfile] of files) {
  md += `## ${file}\n\n`;
  const fmt = '%H|%aI|%s';
  let raw;
  try {
    raw = execSync(
      `git log --follow --since="2026-07-31" --until="2026-08-08" --pretty=format:"${fmt}" -- "野球ゲーム/${file}"`,
      { cwd: REPO, encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 }
    );
  } catch (e) {
    md += `(取得失敗: ${e.message})\n\n`;
    continue;
  }
  const lines = raw.split('\n').filter(Boolean);
  md += `全 ${lines.length} コミット（新しい順）。diff本体 = \`${logfile}\`\n\n`;
  md += '| SHA(短縮) | 日時 | メッセージ | 当該コミット時点のBUILD |\n|---|---|---|---|\n';
  for (const line of lines) {
    const [sha, date, ...msgParts] = line.split('|');
    const msg = msgParts.join('|').replace(/\|/g, '\\|').slice(0, 100);
    let build = 'UNKNOWN';
    try {
      const content = execSync(`git show ${sha}:"野球ゲーム/baseball3d.html"`, {
        cwd: REPO, encoding: 'utf8', maxBuffer: 1024 * 1024 * 20,
      });
      const m = content.match(/const BUILD = '([^']+)'/);
      build = m ? m[1] : 'BUILD定数なし（このコミット時点でbaseball3d.htmlに未実装 or 別名）';
    } catch (e) {
      build = 'baseball3d.htmlがこの時点で存在しない/取得失敗';
    }
    md += `| ${sha.slice(0, 8)} | ${date} | ${msg} | ${build} |\n`;
  }
  md += '\n';
}

fs.writeFileSync(OUT, md, 'utf8');
console.log('done');
