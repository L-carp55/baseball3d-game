const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/<local-user>/Desktop/Claude Code/野球ゲーム/_archive_for_gpt_handoff_20260805/01_session_jsonl';
const f = 'a4ff017c-45da-40dd-818a-23c3a7be590b';
const lines = fs.readFileSync(path.join(dir, f + '.jsonl'), 'utf8').split('\n');
const wanted = ['last-prompt', 'mode', 'custom-title'];
const seen = {};
for (const l of lines) {
  if (!l.trim()) continue;
  let o;
  try { o = JSON.parse(l); } catch (e) { continue; }
  if (wanted.includes(o.type) && !seen[o.type]) {
    seen[o.type] = true;
    console.log('=== ' + o.type + ' ===');
    console.log(JSON.stringify(o).slice(0, 500));
    console.log();
  }
  if (Object.keys(seen).length === wanted.length) break;
}
