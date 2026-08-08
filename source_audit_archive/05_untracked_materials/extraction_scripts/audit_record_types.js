const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/<local-user>/Desktop/Claude Code/野球ゲーム/_archive_for_gpt_handoff_20260805/01_session_jsonl';
const files = [
  'bf4fbe1e-6286-44a5-8364-edd1fd0f8f4b',
  'a4ff017c-45da-40dd-818a-23c3a7be590b',
  'bbd2bf55-3359-456b-88b3-e5c5196d4c96',
  'c72ec349-3307-4d2d-930f-f59f851c62fb',
];
const typeCounts = {};
const perFile = {};
files.forEach((f) => {
  const lines = fs.readFileSync(path.join(dir, f + '.jsonl'), 'utf8').split('\n');
  const local = {};
  lines.forEach((l) => {
    if (!l.trim()) return;
    let o;
    try { o = JSON.parse(l); } catch (e) { return; }
    const t = o.type || '(no type)';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
    local[t] = (local[t] || 0) + 1;
  });
  perFile[f] = local;
});
console.log(JSON.stringify({ total: typeCounts, perFile }, null, 1));
