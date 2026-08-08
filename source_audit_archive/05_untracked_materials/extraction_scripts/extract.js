// Extract owner (human) messages from CC session transcripts
const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/<local-user>/.claude/projects/C--Users-<local-user>-Desktop-Claude-Code';
const ids = process.argv.slice(2);
for (const id of ids) {
  const file = path.join(dir, id + '.jsonl');
  const out = [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch (e) { continue; }
    if (o.type !== 'user') continue;
    const m = o.message;
    if (!m) continue;
    let txt = '';
    if (typeof m.content === 'string') txt = m.content;
    else if (Array.isArray(m.content)) {
      for (const c of m.content) {
        if (c.type === 'text') txt += c.text + '\n';
      }
    }
    txt = txt.trim();
    if (!txt) continue;
    // skip system-generated
    if (txt.startsWith('<system-reminder>')) continue;
    if (txt.startsWith('Caveat:')) continue;
    if (/^<command-(name|message|args)>/.test(txt)) continue;
    if (txt.includes('<local-command-stdout>')) continue;
    // strip trailing system-reminder blocks
    txt = txt.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
    if (!txt) continue;
    out.push('### [' + (o.timestamp || '') + ']\n' + txt);
  }
  const dest = path.join(__dirname, 'user_' + id.slice(0, 8) + '.md');
  fs.writeFileSync(dest, out.join('\n\n'), 'utf8');
  console.log(id.slice(0, 8), 'messages:', out.length, 'bytes:', fs.statSync(dest).size);
}
