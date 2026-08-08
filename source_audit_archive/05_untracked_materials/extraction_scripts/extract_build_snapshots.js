// BUILD別スナップショット抽出。
// 前提の確認結果: baseball3d.htmlのgit履歴は全7コミットのみで、そこに現れるBUILD値は
// b0804-33 / b0805-01 / b0805-02 / b0805-06 / b0805-08 / b0805-10 の6種類だけ。
// b0805-03/04/05/07/09 はコミット間の生ブラウザ編集中に一時的に存在した値で、
// 個別コミットとして記録されていないため git からは復元不能（後述のREADMEに明記）。
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = 'C:/Users/<local-user>/Desktop/Claude Code';
const OUTDIR = 'C:/Users/<local-user>/Desktop/Claude Code/野球ゲーム/_archive_for_gpt_handoff_20260805/04_build_snapshots';

function log(file) {
  const raw = execSync(
    `git log --follow --pretty=format:"%H|%aI|%s" -- "野球ゲーム/${file}"`,
    { cwd: REPO, encoding: 'utf8', maxBuffer: 1024 * 1024 * 20 }
  );
  return raw.split('\n').filter(Boolean).map((l) => {
    const [sha, date, ...m] = l.split('|');
    return { sha, date, msg: m.join('|') };
  });
}

const gameCommits = log('baseball3d.html'); // newest first
const harnessCommits = log('_test_harness_20260804.js'); // newest first

// 各コミットのBUILD値を取得
function buildAt(sha) {
  try {
    const content = execSync(`git show ${sha}:"野球ゲーム/baseball3d.html"`, {
      cwd: REPO, encoding: 'utf8', maxBuffer: 1024 * 1024 * 20,
    });
    const m = content.match(/const BUILD = '([^']+)'/);
    return m ? m[1] : null;
  } catch (e) { return null; }
}

// BUILD値ごとに「その値を持つ最も新しいコミット」を採用（次のBUILD変更直前の最終状態）
const buildToCommit = {};
for (const c of gameCommits) { // newest -> oldest; 最初に見つかった = 最新
  const b = buildAt(c.sha);
  if (b && !buildToCommit[b]) buildToCommit[b] = { ...c, build: b };
}

const wanted = ['b0804-33', 'b0805-01', 'b0805-02', 'b0805-03', 'b0805-04', 'b0805-05',
  'b0805-06', 'b0805-07', 'b0805-08', 'b0805-09', 'b0805-10'];

let report = '# BUILD別スナップショット 取得結果\n\n';
report += '| BUILD | git復元 | コミットSHA | 日時 | 対応harnessコミット | 保存先 |\n|---|---|---|---|---|---|\n';

// BUILDタグごとの「有効期間」を作る（そのBUILDになった時刻 〜 次のBUILDになる直前まで）。
// 最後のBUILD(b0805-10)の有効期間は無限大まで延ばす＝その後のharness単独コミットも含める。
const foundBuilds = wanted.filter((b) => buildToCommit[b]).map((b) => ({ build: b, ...buildToCommit[b] }));
foundBuilds.sort((a, c) => new Date(a.date) - new Date(c.date)); // 昇順（古い→新しい）
for (let i = 0; i < foundBuilds.length; i++) {
  foundBuilds[i].windowStart = new Date(foundBuilds[i].date).getTime();
  foundBuilds[i].windowEnd = i + 1 < foundBuilds.length ? new Date(foundBuilds[i + 1].date).getTime() : Infinity;
}

for (const b of wanted) {
  const hit = buildToCommit[b];
  const dir = path.join(OUTDIR, b);
  if (!hit) {
    report += `| ${b} | ✗ 復元不能 | - | - | - | (無し。理由: 個別コミットが無く、コミット間の一時的なBUILD値のため) |\n`;
    continue;
  }
  fs.mkdirSync(dir, { recursive: true });
  execSync(`git show ${hit.sha}:"野球ゲーム/baseball3d.html" > "${path.join(dir, 'baseball3d.html')}"`, { cwd: REPO, shell: true });
  // 対応するharnessコミット = このBUILDが有効だった期間[windowStart, windowEnd)内で最新のharnessコミット。
  // 無ければ期間開始以前で直近のもの（そのBUILD時点でharnessが未更新だった場合）にフォールバック。
  const win = foundBuilds.find((f) => f.build === b);
  let harnessHit = null;
  for (const h of harnessCommits) { // newest -> oldest
    const t = new Date(h.date).getTime();
    if (t >= win.windowStart && t < win.windowEnd) { harnessHit = h; break; }
  }
  if (!harnessHit) {
    for (const h of harnessCommits) {
      if (new Date(h.date).getTime() <= win.windowStart) { harnessHit = h; break; }
    }
  }
  let harnessNote = '(該当harnessコミットなし)';
  if (harnessHit) {
    execSync(`git show ${harnessHit.sha}:"野球ゲーム/_test_harness_20260804.js" > "${path.join(dir, '_test_harness_20260804.js')}"`, { cwd: REPO, shell: true });
    harnessNote = harnessHit.sha.slice(0, 8) + ' (' + harnessHit.date + ')';
  }
  report += `| ${b} | ✓ | ${hit.sha.slice(0, 8)} | ${hit.date} | ${harnessNote} | \`04_build_snapshots/${b}/\` |\n`;
}

report += '\n## b0805-03/04/05/07/09 が復元不能な理由\n\n';
report += 'baseball3d.htmlのgit履歴は全7コミットで、そこに含まれるBUILD値は上表の「git復元=✓」の6種類のみ。';
report += '未コミットの5値（03/04/05/07/09）は、コミットとコミットの間でブラウザ上での編集・検証を繰り返した際に';
report += '`const BUILD` を一時的に書き換えた記録であり、その状態のままコミットされたことが一度もない。';
report += 'したがって git のどのオブジェクトにも該当コードは存在せず、復元手段が無い。';
report += '実プレー中の録画にこれらのBUILD値が記録されている場合、対応するコードは「次に実際にコミットされたBUILD値の直前」の状態として近似するしかない';
report += '（例: b0805-07の録画があれば、それはb0805-06のコードにこの後の修理が部分的に混ざった過渡状態で、b0805-08のコミットには含まれる）。\n';

fs.writeFileSync(path.join(OUTDIR, '_INDEX_build_snapshots.md'), report, 'utf8');
console.log(report);
