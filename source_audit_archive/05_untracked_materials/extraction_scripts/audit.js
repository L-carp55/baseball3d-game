// Audit: what got dropped by merge filters
const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/<local-user>/.claude/projects/C--Users-<local-user>-Desktop-Claude-Code';
const ids = [
  'bf4fbe1e-6286-44a5-8364-edd1fd0f8f4b',
  'a4ff017c-45da-40dd-818a-23c3a7be590b',
  'bbd2bf55-3359-456b-88b3-e5c5196d4c96',
  'c72ec349-3307-4d2d-930f-f59f851c62fb',
];
const rows = [];
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
    const raw = txt.trim();
    if (!raw) continue;
    const stripped = raw.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
    let reason = 'KEPT';
    if (!stripped) reason = 'only-system-reminder';
    else if (stripped.startsWith('Caveat:') || stripped.startsWith('<local-command-caveat>')) reason = 'caveat';
    else if (/^<command-(name|message|args)>/.test(stripped)) reason = 'command';
    else if (stripped.includes('<local-command-stdout>')) reason = 'command-stdout';
    else if (stripped.startsWith('Stop hook feedback:')) reason = 'stop-hook';
    else if (stripped.startsWith('[Request interrupted')) reason = 'interrupted';
    else if (stripped.startsWith('The previous response failed')) reason = 'retry';
    else if (stripped.startsWith('Base directory for this skill:')) reason = 'skill';
    else if (stripped.startsWith('This session is being continued')) reason = 'auto-summary';
    if (reason !== 'KEPT') rows.push([id.slice(0,8), o.timestamp, reason, stripped.length, JSON.stringify(stripped.slice(0, 160))].join(' | '));
  }
}
fs.writeFileSync(path.join(__dirname, 'dropped.txt'), rows.join('\n'), 'utf8');
console.log('dropped:', rows.length);
