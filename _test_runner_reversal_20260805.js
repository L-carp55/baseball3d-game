/* ============================================================================
   走者の逆走（OI-140 / OI-238「退行」）の検証
   2026-08-05。使い方: baseball3d.html をブラウザで開き、開発者コンソールへ全文貼り付け。

   何を確かめるか:
     打球時（beginPlay 付近）は「二塁走者を二・一方向のゴロで三塁へ自動スタート」させる。
     捕球時（beginThrowPhase）は非強制の内野ゴロで走者を r.origin へ戻す処理を持つ。
     この2つが競合すると、走り出した二塁走者が捕球の瞬間に三塁→二塁へ**反転して逆走**する。

     2026-08-05 12:39 の修理（BUILD b0805-01）で beginThrowPhase に committed 判定
     （塁を0.35以上離れていれば踏み切ったとみなし戻さない）が入った。
     Sol検査便の第2便は**この修理より前の版**を読んで「退行」と判定した可能性が高いため、
     現行版で実際に逆走が起きるかを機械で確かめる。

   判定:
     PASS = 踏み切った走者の goal が捕球後も進行方向のまま（逆走しない）
     FAIL = goal が元の塁へ戻る（＝退行が現存する）
   ============================================================================ */
(function () {
  const out = {};
  const log = (name, ok, detail) => {
    out[name] = ok;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  };

  /** 二塁手正面のゴロを捕った瞬間を作り、二塁走者の行き先がどうなるかを見る */
  function runCase({ label, runnerP, outs, expectForward }) {
    newGame();
    S.outs = outs;
    // 二塁走者だけを置く。origin=2、p は「今どこまで進んでいるか」（2.0=二塁上）
    const r = { p: runnerP, goal: 2, autoGoal: 2, extra: 0, origin: 2, sp: 23, cmd: null, out: false };
    runners = [r];
    S.bases = [0, 1, 0];

    // 二塁手が正面のゴロを捕球した状態を作る
    const f2 = fielders.find(f => f.n === '二');
    f2.cx = 40; f2.cy = 60; f2.v = 0; f2.stun = 0;
    ball = { x: f2.cx, y: f2.cy, z: 0, t: 0.9, vx: 0, vy: 0, vz: 0, landed: true, maxZ: 1.2 };

    const before = { p: r.p, goal: r.goal, autoGoal: r.autoGoal };
    beginThrowPhase(f2, 'infield', null, false);
    const after = { goal: r.goal, autoGoal: r.autoGoal, safeGoal: r.safeGoal };

    // 逆走＝行き先が元の塁（2）以下に落ちること。踏み切っているのに2へ戻されたらFAIL
    const wentBack = after.autoGoal <= 2;
    const ok = expectForward ? !wentBack : wentBack;
    log(label, ok,
      `p=${before.p} → autoGoal ${before.autoGoal}→${after.autoGoal}`
      + `（safeGoal=${after.safeGoal}）${expectForward ? '／踏み切り済みなので進むのが正' : '／未踏み切りなので戻るのが正'}`);
    return { before, after };
  }

  console.log('=== 走者の逆走（OI-140 / OI-238）===');

  // ① 踏み切った走者は戻さない（これが退行の本体）
  runCase({ label: '逆走-a 踏み切った二塁走者は捕球時に戻されない（p=2.5）',
    runnerP: 2.5, outs: 0, expectForward: true });

  // ② 0.35 のしきい値のすぐ上。境界で効くか
  runCase({ label: '逆走-b しきい値のすぐ上でも戻されない（p=2.40）',
    runnerP: 2.40, outs: 0, expectForward: true });

  // ③ ほとんど離れていない走者は戻す（元の設計どおり。行き過ぎた修理でないことの確認）
  runCase({ label: '逆走-c 塁にいる走者は戻る（p=2.05）',
    runnerP: 2.05, outs: 1, expectForward: false });

  // ④ 2アウトなら踏み切りに関係なく進む（既存仕様）
  runCase({ label: '逆走-d 2アウトなら未踏み切りでも進む（p=2.05）',
    runnerP: 2.05, outs: 2, expectForward: true });

  const pass = Object.values(out).filter(Boolean).length;
  const fail = Object.values(out).length - pass;
  console.log(`\n合計: ${pass} PASS / ${fail} FAIL`);
  console.log(fail
    ? '→ 退行が現存する。beginThrowPhase の committed 判定を確認すること'
    : '→ 逆走は起きない。Sol検査便の「退行」判定は修理前の版を見たものと考えられる');
  return out;
})();
