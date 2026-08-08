// v2: capture ALL human-origin prompts (normal user turns + queued commands)
const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/<local-user>/.claude/projects/C--Users-<local-user>-Desktop-Claude-Code';
const ids = [
  'bf4fbe1e-6286-44a5-8364-edd1fd0f8f4b',
  'a4ff017c-45da-40dd-818a-23c3a7be590b',
  'bbd2bf55-3359-456b-88b3-e5c5196d4c96',
  'c72ec349-3307-4d2d-930f-f59f851c62fb',
];
const noise = t =>
  !t ||
  t.startsWith('Caveat:') || t.startsWith('<local-command-caveat>') ||
  /^<command-(name|message|args)>/.test(t) ||
  t.includes('<local-command-stdout>') ||
  t.startsWith('Stop hook feedback:') ||
  t.startsWith('[Request interrupted') ||
  t.startsWith('The previous response failed') ||
  t.startsWith('Base directory for this skill:') ||
  t.startsWith('This session is being continued') ||
  t.startsWith('<task-notification>');

const items = [];
const seen = new Set();
const push = (ts, id, src, txt) => {
  txt = (txt || '').replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
  if (noise(txt)) return;
  const key = txt.slice(0, 200);
  if (seen.has(key)) return;
  seen.add(key);
  items.push({ ts: ts || '', id: id.slice(0, 8), src, txt });
};

for (const id of ids) {
  const lines = fs.readFileSync(path.join(dir, id + '.jsonl'), 'utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch (e) { continue; }
    if (o.type === 'user' && o.message) {
      const m = o.message;
      let txt = '';
      if (typeof m.content === 'string') txt = m.content;
      else if (Array.isArray(m.content)) for (const c of m.content) if (c.type === 'text') txt += c.text + '\n';
      push(o.timestamp, id, 'turn', txt);
    } else if (o.type === 'attachment' && o.attachment && o.attachment.type === 'queued_command') {
      const a = o.attachment;
      if (a.origin && a.origin.kind && a.origin.kind !== 'human') continue;
      push(a.timestamp || o.timestamp, id, 'queued', a.prompt);
    } else if (o.type === 'queue-operation' && o.operation === 'enqueue') {
      push(o.timestamp, id, 'queued', o.content);
    }
  }
}
items.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
const out = items.map((i, n) => `\n\n===== #${n + 1} [${i.ts}] (${i.id}/${i.src}) =====\n${i.txt}`).join('');
fs.writeFileSync(path.join(__dirname, 'owner_all_v2.md'), out, 'utf8');
console.log('messages:', items.length, 'bytes:', Buffer.byteLength(out));
