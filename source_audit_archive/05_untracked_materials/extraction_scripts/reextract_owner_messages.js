// 再監査用: OWNER_ISSUE_MASTER_20260805.md の元になった抽出を、アーカイブ内の生jsonlから再実行する。
// 抽出対象タイプは user / attachment(queued_command) / queue-operation(enqueue) の3つ。
// last-prompt / mode / custom-title は audit_record_types.js + peek_types.js で中身を確認済み:
//   - custom-title: セッションタイトルのみ（本文なし）
//   - mode: UIモード切替イベントのみ（本文なし）
//   - last-prompt: 直近送信文の複製（UI復元用）。user/queue系と内容が重複するため独立の情報源ではない
// つまり152件抽出（v2版）が全人間発言型を網羅していたことを確認できる。
const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/<local-user>/Desktop/Claude Code/野球ゲーム/_archive_for_gpt_handoff_20260805/01_session_jsonl';
const ids = [
  'bf4fbe1e-6286-44a5-8364-edd1fd0f8f4b',
  'a4ff017c-45da-40dd-818a-23c3a7be590b',
  'bbd2bf55-3359-456b-88b3-e5c5196d4c96',
  'c72ec349-3307-4d2d-930f-f59f851c62fb',
];
const noise = (t) =>
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
const push = (ts, id, src, txt, extra) => {
  txt = (txt || '').replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
  if (noise(txt)) return;
  const key = txt.slice(0, 200);
  if (seen.has(key)) return;
  seen.add(key);
  items.push({ ts: ts || '', id: id.slice(0, 8), src, txt, extra });
};

for (const id of ids) {
  const lines = fs.readFileSync(path.join(dir, id + '.jsonl'), 'utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch (e) { continue; }
    if (o.type === 'user' && o.message) {
      const m = o.message;
      let txt = '';
      if (typeof m.content === 'string') txt = m.content;
      else if (Array.isArray(m.content)) for (const c of m.content) if (c.type === 'text') txt += c.text + '\n';
      push(o.timestamp, id, 'turn', txt, { uuid: o.uuid });
    } else if (o.type === 'attachment' && o.attachment && o.attachment.type === 'queued_command') {
      const a = o.attachment;
      if (a.origin && a.origin.kind && a.origin.kind !== 'human') continue;
      push(a.timestamp || o.timestamp, id, 'queued', a.prompt, { source_uuid: a.source_uuid });
    } else if (o.type === 'queue-operation' && o.operation === 'enqueue') {
      push(o.timestamp, id, 'queued', o.content, {});
    }
  }
}
items.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

const md = items
  .map((i, n) => `\n\n===== #${n + 1} [${i.ts}] (session:${i.id} / ${i.src}) =====\n${i.txt}`)
  .join('');
const header = `# 元発言 全量再抽出（再監査用、2026-08-05アーカイブ作成時に再実行）\n\n` +
  `対象セッション: bf4fbe1e / a4ff017c / bbd2bf55 / c72ec349\n` +
  `抽出タイプ: type=user（通常ターン） / type=attachment かつ attachment.type=queued_command（作業中の割り込み投入） / type=queue-operation かつ operation=enqueue（キュー投入）\n` +
  `除外: Stop hook feedback・コマンドキャプション・自動要約等のノイズ（下記noise関数参照）\n` +
  `重複除去: 本文先頭200文字で判定（同一メッセージが複数レコード型で二重記録されるため）\n\n` +
  `**総件数: ${items.length}件**（2026-08-05 12:xx時点の初回抽出=152件と一致するはず。差異があればここに記載する）\n\n` +
  `record type網羅性の確認: last-prompt/mode/custom-titleの3型は本文を持たない、または直近送信文の複製に過ぎないことを別途確認済み（audit_record_types.js・peek_types.js参照）。したがってこの3型（user/queued attachment/queue-operation）以外に人間発言の情報源は無い。\n`;

fs.writeFileSync(
  path.join('C:/Users/<local-user>/Desktop/Claude Code/野球ゲーム/_archive_for_gpt_handoff_20260805/01_session_jsonl', 'owner_messages_full_reaudit.md'),
  header + md,
  'utf8'
);
console.log('件数:', items.length);
