// Merge + dedup owner messages across the 4 baseball sessions
const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/<local-user>/.claude/projects/C--Users-<local-user>-Desktop-Claude-Code';
const ids = [
  'bf4fbe1e-6286-44a5-8364-edd1fd0f8f4b',
  'a4ff017c-45da-40dd-818a-23c3a7be590b',
  'bbd2bf55-3359-456b-88b3-e5c5196d4c96',
  'c72ec349-3307-4d2d-930f-f59f851c62fb',
];
const items = [];
const seen = new Set();
for (const id of ids) {
  const lines = fs.readFileSync(path.join(dir, id + '.jsonl'), 'utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch (e) { continue; }
    if (o.type !== 'user') continue;
    const m = o.message; if (!m) continue;
    let txt = '';
    if (typeof m.content === 'string') txt = m.content;
    else if (Array.isArray(m.content)) for (const c of m.content) if (c.type === 'text') txt += c.text + '\n';
    txt = txt.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
    if (!txt) continue;
    if (txt.startsWith('Caveat:') || txt.startsWith('<local-command-caveat>')) continue;
    if (/^<command-(name|message|args)>/.test(txt)) continue;
    if (txt.includes('<local-command-stdout>')) continue;
    if (txt.startsWith('Stop hook feedback:')) continue;
    if (txt.startsWith('[Request interrupted')) continue;
    if (txt.startsWith('The previous response failed')) continue;
    if (txt.startsWith('Base directory for this skill:')) continue;
    if (txt.startsWith('This session is being continued')) { items.push({ ts: o.timestamp, id: id.slice(0,8), txt: '(前セッションからの自動要約 — 別途参照)', skip: true }); continue; }
    const key = (o.timestamp || '') + '|' + txt.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ ts: o.timestamp || '', id: id.slice(0, 8), txt });
  }
}
items.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
const out = items.filter(i => !i.skip).map((i, n) => `\n\n===== #${n + 1} [${i.ts}] (${i.id}) =====\n${i.txt}`).join('');
fs.writeFileSync(path.join(__dirname, 'owner_all.md'), out, 'utf8');
console.log('merged messages:', items.length, 'bytes:', Buffer.byteLength(out));
