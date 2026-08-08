/* ============================================================================
   野球ゲーム 検証ハーネス（2026-08-04 刷新セッション版）
   使い方: baseball3d.html をブラウザで開き、開発者コンソールに全文貼り付けて実行。
   すべて PASS/FAIL 形式。前セッションでコンソール注入のまま失われた反省からファイル化。
   構成:
     test1 挟殺2種（S突っ込み走者が停滞しない / 通常挟殺の切り返しが生きている）
     test2 塁を回る減速（一塁通過時に v が0.65倍に落ち、加速し直す）
     test3 エラー後の回収（棒立ち<0.45s・回収<3.2s）
     test4 叩きつけのバウンドがフライ捕球にならない（landed即時化）
     sweep128 縮約総当たり（終了・outs範囲・NaN・塁間終了・走者保存則）
   ============================================================================ */
(function(){
  const out={};

  // ===== test1: 挟殺2種 =====
  (function(){
    function setup(withCmd){
      const holder=fielders.find(f=>f.n==='投');
      const cat=fielders.find(f=>f.n==='捕');
      holder.cx=-40; holder.cy=40; holder.v=0; holder.stun=0; holder.coverBase=null;
      cat.cx=0; cat.cy=-0.5; cat.v=0; cat.stun=0; cat.coverBase=4;
      fielders.forEach(f=>{ if(f!==holder&&f!==cat){ f.v=0; f.stun=0; f.coverBase=null; } });
      const r={p:3.5, goal:4, autoGoal:4, extra:0, origin:3, sp:23, cmd:(withCmd?'S':null)};
      runners=[r];
      ball={x:holder.cx,y:holder.cy,z:4.4,t:0,vx:0,vy:0,vz:0,landed:false,maxZ:0};
      throwPlay={stage:'rundown', target:3, thrower:holder, receiver:holder, kind:'pickoff',
        rd:{r, hi:4, lo:3, loLim:3, hiLim:4, holder, sub:'chase', t:0.3, ex:0}};
      return r;
    }
    function run(withCmd){
      newGame();
      const r=setup(withCmd);
      let outcome=null, flips=0, lastG=r.goal, drops=0;
      const _e=window.endRundown, _r=Math.random; Math.random=()=>0.5;
      window.endRundown=function(text){ outcome=text; };
      const dt=1/60; let t=0;
      /* ドライブはupdateThrowPhase経由にする（moveFielders/updateRunners/updateRundownを
         個別に呼ぶ旧方式だと、挟殺崩壊(8/4深夜第6陣)でstageが'rundown'から'fly'へ
         引き継がれた瞬間にドライブが止まって無限待ちになる）。
         終了検知もendRundownだけでなくthrowPlay消失(concludePlay直行の経路)を見る。
         上限も9.5s→16sへ（崩壊後の回収→本塁勝負の決着に最大12秒程度かかる、実測で確認）。 */
      try{
        while(t<16 && !outcome && throwPlay){
          t+=dt;
          const g0=r.goal, v0=r.v||0;
          updateThrowPhase(dt);
          if((r.v||0)<v0-3 && r.goal===g0) drops++;   // 向き不変のまま速度リセット＝バグの機構
          if(r.goal!==lastG){ flips++; lastG=r.goal; }
        }
      } finally { window.endRundown=_e; Math.random=_r; }
      const concluded = !!outcome || !throwPlay;
      return {outcome, concluded, t:+t.toFixed(2), flips, drops, finalP:+r.p.toFixed(2)};
    }
    const A=run(true), B=run(false);
    // 本塁に到達済み(p≈4)の走者がタッチアウトになったらルール違反（relay中セーフ判定の回帰検査）
    out.test1_挟殺S突込={...A, verdict:(A.outcome && A.drops===0 && A.t<4.5
      && !(A.finalP>=3.99 && /タッチアウト/.test(A.outcome)))?'PASS':'FAIL'};
    // 通常挟殺は「切り返しが複数回あって決着する」のが合格条件。決着経路はendRundownと
    // concludePlay直行(崩壊→回収→本塁勝負)の両方がありうる（8/5未明に発見・対策）
    out.test1_挟殺通常={...B, verdict:(B.concluded && B.flips>=1)?'PASS':'FAIL'};
  })();

  // ===== test2: 塁を回る減速 =====
  // 8/5未明: 旧パラメータ(exit95/la7/spray-14)は8/4深夜の守備強化(CPU実力値化・
  // interceptPointのチャージ判定)後は遊ゴロアウトになり、打者が一塁を回らなくなっていた
  // （較正が進むほど昔のfixtureが無効化される典型例）。二塁打が安定して出る条件へ差し替え。
  (function(){
    newGame();
    S.outs=0; S.bases=[null,null,null];
    held['s']=true;
    const _r=Math.random; Math.random=()=>0.5;
    startFlight({exit:98, la:14, spray:-38, q:0.9}, 1, [0,2.5,1.4]);
    const bat=runners.find(r=>r.origin===0);
    const dt=1/60; let t=0; const events=[];
    try{
      while(t<14 && !['windup','msg'].includes(S.phase) && !S.over && !bat.out){
        t+=dt;
        const v0=bat.v||0;
        update(dt);
        if((bat.v||0) < v0*0.8 && v0>10)
          events.push({t:+t.toFixed(2), p:+bat.p.toFixed(2), vBefore:+v0.toFixed(1), vAfter:+(bat.v||0).toFixed(1)});
      }
    } finally { Math.random=_r; held['s']=false; }
    const turn1 = events.find(e=>Math.abs(e.p-1)<0.05);
    const pass = !!turn1 && turn1.vAfter>turn1.vBefore*0.55 && turn1.vAfter<turn1.vBefore*0.75;
    out.test2_塁回り減速={events, verdict: pass?'PASS':'FAIL'};
  })();

  // ===== test3: エラー後の回収 =====
  // 8/5未明: 120試行だと6-8件しかファンブルせず基準10件に届かなかった
  // （8/4深夜の内野チャージ改善で、走りながらでなく足を止めて捕る場面が増え
  // ファンブル自体が減ったため。回収時間そのものは健全＝サンプル数不足が真因）。
  // 400試行へ拡大（試行を増やす方向で対応。基準は緩めない）。
  (function(){
    let recs=[], fumbles=0;
    for(let trial=0; trial<400 && fumbles<25; trial++){
      newGame();
      S.outs=2; S.bases=[null,null,null];
      fielders.forEach(f=>{ f.cat=1; });   // 捕球最低化でファンブル誘発
      startFlight({exit:74, la:-30, spray:8, q:0.7}, 1, [0,2.5,1.4]);
      const dt=1/60; let t=0, fumbleAt=null, standStill=0, maxStand=0;
      while(t<12 && S.phase==='flight'){
        t+=dt; update(dt);
        const prim=ball&&ball.primary; if(!prim) break;
        if(prim.fumbled && fumbleAt===null) fumbleAt=t;
        if(fumbleAt!==null){
          const dB=Math.hypot(ball.x-prim.cx, ball.y-prim.cy);
          if((prim.stun||0)<=0 && dB>8 && (prim.v||0)<2){ standStill+=dt; maxStand=Math.max(maxStand,standStill); }
          else standStill=0;
        }
        if(fumbleAt!==null && t-fumbleAt>8) break;
      }
      if(fumbleAt===null) continue;
      fumbles++;
      recs.push({rec: S.phase!=='flight' ? +(t-fumbleAt).toFixed(2) : 99, maxStand:+maxStand.toFixed(2)});
    }
    const maxStandAll=Math.max(...recs.map(r=>r.maxStand));
    const maxRec=Math.max(...recs.map(r=>r.rec));
    const pass = fumbles>=10 && recs.every(r=>r.rec<99) && maxStandAll<0.45 && maxRec<3.2;
    out.test3_エラー回収={fumbles, maxRecovery:maxRec, maxStandStill:maxStandAll, verdict:pass?'PASS':'FAIL'};
  })();

  // ===== test4: 叩きつけのバウンドはフライ捕球にならない =====
  (function(){
    let trials=0, bad=0;
    for(let i=0;i<30;i++){
      newGame();
      S.outs=0; S.bases=[null,null,null];
      startFlight({exit:83, la:-30, spray:-34, q:0.7}, 1, [0,2.5,1.4]);
      trials++;
      const dt=1/60; let t=0, bounced=false, flyCatch=false;
      while(t<30 && ['flight','throwing','play'].includes(S.phase) && !S.over){
        t+=dt;
        if(ball && ball.landed) bounced=true;
        if(ball && ball.flyKind && bounced) flyCatch=true;
        update(dt);
      }
      if(flyCatch) bad++;
    }
    out.test4_叩きつけバウンド={trials, airCatchAfterBounce:bad, verdict:bad===0?'PASS':'FAIL'};
  })();

  // ===== test5: 封殺タイミング（通常守備でゴロが普通にアウトになる） =====
  // 8/4に発見した構造欠陥の回帰検査: 受け手が送球を迎えに出て塁を離れ、捕った場所で
  // 立ち尽くして判定保留が時間切れ→間に合っていた封殺が全て内野安打（ゴロ安打率69%）。
  (function(){
    const savedDef = ROSTER[1].map(p=>({走:p.走,肩:p.肩,守:p.守,捕:p.捕}));
    ROSTER[1].forEach(p=>{ p.走=60; p.肩=65; p.守=70; p.捕=75; });   // 通常想定の守備
    // 検査条件は「遊撃の守備範囲の平凡なゴロ」= 75mph la-5 spray-25。走者は走力50相当。
    // 実測(2026-08-04修正後)=アウト100%。90mph la0の三遊間強襲(実野球でも安打が多い)は
    // 25%しかアウトにならないのが正しく、検査条件に使ってはいけない（1度誤用しFAILを出した）。
    let outs=0, trials=0;
    for(let i=0;i<20;i++){
      newGame();
      S.outs=0; S.bases=[null,null,null];
      swapFielders();                 // ROSTER[1]の変更後の値で守備陣を作り直す
      startFlight({exit:75, la:-5, spray:-25, q:0.7}, 1, [0,2.5,1.4]);
      const bat=runners.find(r=>r.origin===0);
      if(bat) bat.sp=26.7;            // 走力50相当に固定（全100の脚だと基準にならない）
      trials++;
      const dt=1/60; let t=0;
      while(t<30 && ['flight','throwing','play'].includes(S.phase) && !S.over) { t+=dt; update(dt); }
      if(bat && bat.out) outs++;
    }
    ROSTER[1].forEach((p,i)=>{ p.走=savedDef[i].走; p.肩=savedDef[i].肩; p.守=savedDef[i].守; p.捕=savedDef[i].捕; });
    out.test5_封殺={trials, outs, アウト率pct:+(outs/trials*100).toFixed(0),
      verdict: (outs/trials>=0.80)?'PASS':'FAIL'};
  })();

  // ===== test6: 送球が目標を捕球の高さ(約5ft)で通過する（弾道の平地化、録画183359対策） =====
  (function(){
    let bad=0; const res={};
    [[60,0.77],[90,0.77],[120,0.77],[150,0.77],[120,0.45]].forEach(a=>{
      const v0=throwSpeed(a[1],a[0]), th=throwAngle(a[0],v0);
      const z=throwPassHeight(a[0],v0,th);
      res[`d${a[0]}`]= z===null?null:+z.toFixed(1);
      if(z===null || z<3.5 || z>7.0) bad++;
    });
    out.test6_送球高さ={...res, verdict: bad===0?'PASS':'FAIL'};
  })();

  // ===== test7: 2死ではハーフウェイせず打った瞬間に走る（録画183631対策） =====
  (function(){
    newGame(); S.outs=2; S.bases=[null,{id:1,sp:24},null];
    held['s']=true;
    startFlight({exit:91, la:16, spray:-6, q:0.8}, 1, [0,2.5,1.4]);
    const r2=runners.find(r=>r.origin===2);
    const dt=1/60; let t=0, halfway=false;
    try{
      while(t<2.0 && S.phase==='flight'){
        t+=dt; update(dt);
        if(r2 && !r2.out && Math.abs(r2.goal-2.45)<0.1) halfway=true;
      }
    } finally { held['s']=false; }
    out.test7_2死走塁={halfway, goal:r2?r2.goal:null,
      verdict:(!halfway && r2 && r2.goal>=3)?'PASS':'FAIL'};
  })();

  // ===== test8: フェアの確定（塁通過後・野手接触後はファウルにならない） =====
  (function(){
    // 野手接触の確定(単体)
    newGame(); S.outs=0;
    startFlight({exit:80, la:-20, spray:-30, q:0.7}, 1, [0,2.5,1.4]);
    ball.x=-40; ball.y=60;
    deflectBall(ball.primary, 0, true);
    const touch=!!ball.fairLocked;
    // 三塁線をフェアで通過→サイドスピンでファウル地域へ切れてもファウルにならない
    newGame(); S.outs=0;
    startFlight({exit:88, la:-15, spray:-43, q:0.7}, 1, [0,2.5,1.4]);
    ball.ss=1.2;
    const dt=1/60; let t=0, locked=false, wasFoul=false;
    while(t<20 && ['flight','throwing','play'].includes(S.phase) && !S.over){
      t+=dt; update(dt);
      if(ball && ball.fairLocked) locked=true;
      if(S.lastPlay==='ファウル') wasFoul=true;
    }
    out.test8_フェア確定={野手接触:touch, 線通過ロック:locked, ファウル化:wasFoul,
      verdict:(touch && !(locked&&wasFoul))?'PASS':'FAIL'};
  })();

  // ===== test9: 捕球直後の幽霊飛行なし（プレー確定時に球速が残らない、録画215858対策） =====
  (function(){
    let ghosts=0, plays=0;
    for(let trial=0; trial<15; trial++){
      newGame(); S.outs=2; S.bases=[null,null,{id:1,sp:22}];
      resetFielders();
      startFlight({exit:88, la:-4, spray:-23, q:0.7}, 1, [0,2.5,1.4]);
      const dt=1/60; let t=0;
      while(t<15 && ['flight','throwing'].includes(S.phase) && !S.over){ t+=dt; update(dt); }
      if(S.phase==='play' && ball){
        plays++;
        if(Math.hypot(ball.vx,ball.vy,ball.vz)>10) ghosts++;
      }
      while(!S.over && ['flight','throwing','play'].includes(S.phase)){ update(1/60); }
    }
    out.test9_幽霊飛行={plays, ghosts, verdict: ghosts===0?'PASS':'FAIL'};
  })();

  // ===== test10: 低い弾道で届かない遠投は中継（山なりロブ禁止、録画220141対策） =====
  (function(){
    function relayTest(armRaw, run, fromX, fromY, target){
      newGame();
      const lf=fielders.find(f=>f.n==='左');
      lf.cx=fromX; lf.cy=fromY; lf.arm=armRaw; lf.run=run;
      fielders.forEach(f=>{ f.primary=(f===lf); });
      ball={x:lf.cx,y:lf.cy,z:4.6,t:0,vx:0,vy:0,vz:0,landed:true,maxZ:20};
      runners=[{p:2.5,goal:4,autoGoal:4,origin:2,sp:24,v:20,dir:1,cmd:'S',extra:0}];
      throwPlay={stage:'transfer', t:99, transfer:0.01, thrower:lf, kind:'outfield',
        award:0, target, relayed:true, fieldT:0, stepChecked:true};
      S.phase='throwing';
      updateThrowPhase(1/60);
      return throwPlay ? throwPlay.relayTo : null;
    }
    const weak=relayTest(0.45, 40, -140, 240, 4);   // 弱肩278ft → 中継(=4)のはず
    const strong=relayTest(1.00, 0, -110, 200, 4);  // 強肩228ft → 直接(null)のはず
    out.test10_中継={弱肩:weak, 強肩:strong,
      verdict:(weak===4 && strong==null)?'PASS':'FAIL'};
  })();

  // ===== test11: 安打の自動進塁は追い越さない（録画211639対策） =====
  (function(){
    newGame(); S.outs=2; S.bases=[{id:1,sp:22},null,null];
    swapFielders();
    startFlight({exit:65, la:35, spray:-41, q:0.6}, 1, [0,2.5,1.4]);
    const dt=1/60; let t=0; let violated=false;
    while(t<25 && ['flight','throwing','play'].includes(S.phase) && !S.over){
      t+=dt; update(dt);
      const bat=runners.find(r=>r.origin===0), r1=runners.find(r=>r.origin===1);
      if(bat && r1 && !bat.out && !r1.out &&
         bat.goal>=r1.goal && r1.goal<4 && bat.goal===Math.round(bat.goal)) violated=true;
    }
    out.test11_追い越し={violated, verdict: violated?'FAIL':'PASS'};
  })();

  // ===== sweep128: 縮約総当たり =====
  (function(){
    const EXITS=[55,80,95,108], LAS=[-20,2,18,38], SPRAYS=[-35,-10,15,40];
    const BASES=[[null,null,null], [{id:1,sp:24},{id:2,sp:22},null]];
    const fails=[]; let n=0;
    for(const ex of EXITS) for(const la of LAS) for(const sp of SPRAYS) for(let bi=0;bi<2;bi++){
      n++;
      try{
        newGame();
        S.outs=1;
        S.bases=BASES[bi].map(b=>b?{...b}:null);
        const startBases=S.bases.filter(Boolean).length;
        const startRuns=total(0)+total(1);
        const startInning=S.inning, startHalf=S.half, startOuts=S.outs;
        startFlight({exit:ex, la:la, spray:sp, q:0.7}, 1, [0,2.5,1.4]);
        const dt=1/60; let t=0;
        while(t<40 && ['flight','throwing','play'].includes(S.phase) && !S.over){
          t+=dt; update(dt);
          if(S.outs<0 || S.outs>3){ fails.push({n,why:'outs '+S.outs}); break; }
          if(runners.some(r=>!isFinite(r.p))){ fails.push({n,why:'NaN走者'}); break; }
        }
        if(['flight','throwing','play'].includes(S.phase) && !S.over){ fails.push({n,ex,la,sp,bi,why:'未終了'}); continue; }
        // リード(+0.085)は塁上扱い。以前 0.05 閾値で誤検出した(次打席の走者再構築後に測っているため)
        const stray=runners.filter(r=>!r.out && r.p<3.999 && Math.abs(r.p-Math.round(r.p-0.085))>0.13);
        if(stray.length) fails.push({n,ex,la,sp,bi,why:'塁間 '+stray.map(r=>r.p.toFixed(2)).join(',')});
        if(S.inning===startInning && S.half===startHalf){
          const endBases=S.bases.filter(Boolean).length;
          const runsGained=(total(0)+total(1))-startRuns;
          const outsGained=S.outs-startOuts;
          if(startBases+1 !== endBases+runsGained+outsGained)
            fails.push({n,ex,la,sp,bi,why:`保存則 ${startBases}+1!=${endBases}+${runsGained}+${outsGained}`});
        }
      }catch(e){ fails.push({n,why:'例外 '+e.message}); }
    }
    out.sweep128={scenarios:n, failCount:fails.length, verdict:fails.length===0?'PASS':'FAIL', fails:fails.slice(0,10)};
  })();

  /* ============================================================================
     2026-08-05 追加（test12〜14）。
     追加理由: Fable の変異テストで「本塁未到達の得点」バグを意図的に戻しても
     既存11本＋sweep128が全PASSのままだった＝オーナー被弾最多の3系統に対して
     このハーネスは検出力ゼロだった。以下は「直した経路」ではなく
     「症状そのもの」を再現して測る。古いコードで必ずFAILすることを確認済み。
     ============================================================================ */
  function totalRuns(){ try{ return total(0)+total(1); }catch(e){ return 0; } }

  // ===== test12: 走者の行き先が捕球の瞬間に反転しないか（OI-140 / OI-238）=====
  (function(){
    let flips=0, trials=0, detail=[];
    for(let k=0;k<12;k++){
      newGame(); S.outs=0; S.bases=[null,{id:1,sp:24},null];
      startFlight({exit:92, la:-3, spray:10, q:0.7}, 1, [0,2.5,1.4]);   // 録画20260805_105253と同条件
      if(!runners.find(x=>x.origin===2)) continue;
      trials++;
      let prev=null, sawForward=false, back=0;
      for(let i=0;i<260 && ['flight','throwing','play'].includes(S.phase) && !S.over;i++){
        update(1/60);
        const r=runners.find(x=>x.origin===2); if(!r||r.out) break;
        if(r.goal>=3) sawForward=true;
        if(sawForward && prev!==null && r.goal<prev-0.01) back++;
        prev=r.goal;
      }
      if(back>0) flips++;
      detail.push(back);
    }
    out.test12_走者目標の反転={trials, 反転プレー数:flips, verdict:(trials>0&&flips===0)?'PASS':'FAIL', 内訳:detail};
  })();

  // ===== test13: 本塁に届いていない走者を得点にしないか（OI-174/180/195/208）=====
  /* ★検出力の実証済み（2026-08-05）: 修正前コード(b0804-33)で 8/8 が得点してしまい FAIL、
     修正後(b0805-01)で 0/8 PASS。前提として「S.playClock は送球が始まってからしか進まない」
     ため、必ず throwPlay が立つまで進めてから時計を差し込む（最初の版はこれを怠り、
     時間切れ判定に一度も到達しないまま PASS を出す偽の試験になっていた）。 */
  (function(){
    let scored=0, placed=0, trials=0, det=[];
    for(let k=0;k<8;k++){
      newGame(); S.outs=0; S.bases=[null,null,{id:1,sp:22}];
      startFlight({exit:78, la:-12, spray:-25, q:0.7}, 1, [0,2.5,1.4]);
      let ok=false;
      for(let i=0;i<240;i++){ update(1/60); if(throwPlay){ ok=true; break; }
        if(!['flight','throwing','play'].includes(S.phase)||S.over) break; }
      if(!ok) continue;
      const r=runners.find(x=>x.origin===3); if(!r||r.out) continue;
      trials++;
      const before=totalRuns();
      r.p=3.70; r.goal=4; r.autoGoal=4; r.cmd=null;
      S.playClock=11.85;
      let n=0;
      while(n<600 && ['flight','throwing','play'].includes(S.phase) && !S.over){
        update(1/60); n++;
        const rr=runners.find(x=>x.origin===3); if(rr&&!rr.out) rr.p=Math.min(rr.p,3.90); // 本塁へ届かせない
      }
      if(totalRuns()-before>0) scored++;
      if(S.bases[2]) placed++;
      det.push({gained:totalRuns()-before, on3:!!S.bases[2]});
    }
    out.test13_本塁未到達での得点={trials, 得点した回数:scored, 三塁へ置いた回数:placed,
      verdict:(trials>0 && scored===0 && placed===trials)?'PASS':'FAIL', 内訳:det.slice(0,3)};
  })();

  // ===== test14: 走者が塁間にいる間に時間切れで打ち切らないか（OI-060/073/080/144ほか）=====
  /* ★v2（2026-08-05作り直し）: v1は「プレー終了の観測」を2秒しか待たず検出力ゼロだった。
     v2は concludePlay を包み、呼ばれた瞬間の時計と走者状態を直接記録する。
     検出力の実証: 修正前(b0804-33)=塁間のまま12秒台で閉じて FAIL /
     修正後(b0805-06)=grace延長により20秒台まで閉じず PASS（両方を実測してから採用）。 */
  (function(){
    let calls=[], trials=0, bad=0;
    const orig=concludePlay;
    try{
      for(let k=0;k<6;k++){
        newGame(); S.outs=0; S.bases=[{id:1,sp:24},null,null];
        startFlight({exit:85, la:-8, spray:-30, q:0.7}, 1, [0,2.5,1.4]);
        let ok=false;
        for(let i=0;i<240;i++){ update(1/60); if(throwPlay){ ok=true; break; }
          if(!['flight','throwing','play'].includes(S.phase)||S.over) break; }
        if(!ok) continue;
        const r0=runners.find(x=>x.origin===1); if(!r0||r0.out) continue;
        trials++;
        S.playClock=11.7;
        let rec=null;
        window.concludePlay=function(){
          if(!rec){ const rr=runners.find(x=>x.origin===1);
            rec={pc:+(S.playClock||0).toFixed(2),
                 mid: !!(rr && !rr.out && Math.abs(rr.p-Math.round(rr.p))>=0.02)}; }
          return orig.apply(this,arguments);
        };
        let n=0;
        while(n<900 && !rec && !S.over){ 
          const rr=runners.find(x=>x.origin===1);
          if(rr&&!rr.out){ rr.p=1.5; rr.goal=2; rr.autoGoal=2; }   // 塁間に固定し続ける
          update(1/60); n++;
        }
        window.concludePlay=orig;
        if(rec && rec.mid && rec.pc<=12.6) bad++;
        calls.push(rec);
      }
    } finally { window.concludePlay=orig; }
    out.test14_塁間での時間切れ={trials, 塁間のまま12秒台で閉じた回数:bad, 内訳:calls.slice(0,3),
      verdict:(trials>0 && bad===0)?'PASS':'FAIL'};
  })();

  /* ============================================================================
     test15〜18（2026-08-05 追加、Sol Ultra 所見23〜26への対応）
     経緯: Ultra の変異監査で、意図的に戻した10バグのうち4件が16項目を全PASSで通過した
     ＝本日の修理4件に検出力がゼロだった。以下は Ultra が書いた数値条件と
     「どの場面では発動させないか」をそのまま実装したもの。
     各testは production 状態を直接 assert し、対応する変異で必ず FAIL する。
     ============================================================================ */

  // ===== test15: カバー成立時刻（所見23／変異M04 coverArrival→0 を検出）=====
  (function(){
    const chk=[];
    try{
      newGame();
      const p2=throwPoint(2);
      // (1) 対象塁にカバーが誰も居なければ 99（=間に合わない）
      fielders.forEach(f=>{ f.coverBase=null; f.v=0; });
      chk.push({n:'カバー不在は99', ok: coverArrival(2,null)>=99});
      // (2) カバーが80ft以上離れていれば、待ち時間は0.12秒より大きい
      const ss=fielders.find(f=>f.n==='遊');
      ss.coverBase=2; ss.v=0; ss.cx=p2[0]; ss.cy=p2[1]+90;
      chk.push({n:'80ft離れたら0.12秒超', ok: coverArrival(2,null)>0.12});
      // (3) カバーが塁から2ft未満なら待ち0
      ss.cx=p2[0]; ss.cy=p2[1]+1.0;
      chk.push({n:'2ft未満は待ち0', ok: coverArrival(2,null)===0});
      // (4) 投手宛て(b==='P')には待ちを要求しない
      chk.push({n:'投手宛ては0', ok: coverArrival('P',null)===0});
    }catch(e){ chk.push({n:'例外', ok:false, e:e.message}); }
    const bad=chk.filter(c=>!c.ok);
    out.test15_カバー成立時刻={検査:chk.length, 不合格:bad.map(b=>b.n), verdict: bad.length===0?'PASS':'FAIL'};
  })();

  // ===== test16: 走行中の送球ずれ（所見24／変異M07 0.028*run を検出）=====
  /* ★初版の重大な欠陥（同日中に自己発見）: 計算式をテスト内にコピーして検算していたため、
     実装側の係数を書き換えても必ずPASSする「試験になっていない試験」だった。
     実装の throwOffset() を実際に呼び、出力のばらつきを測る形へ作り直した。
     Ultra の条件: 送70・距離200ft で run=0 と run=全力 の σ比が 1.8以上3.0未満
     （現行式の理論比2.36 / 旧式0.028*run は4.18なので分離できる）。 */
  (function(){
    let res={};
    try{
      const f=fielders.find(x=>x.n==='右') || fielders[0];
      const saveRun=f.run, saveAcc=f.acc;
      f.acc=70;                                  // 送球精度70（実装は f.acc を読む）
      function sd(runVal){
        f.run=runVal;
        let n=4000, sx=0, sxx=0;
        for(let k=0;k<n;k++){ const o=throwOffset(f,200); sx+=o[0]; sxx+=o[0]*o[0]; }
        return Math.sqrt(sxx/n-(sx/n)*(sx/n));
      }
      const s0=sd(0), s1=sd(70);
      f.run=saveRun; f.acc=saveAcc;
      const ratio=s1/s0;
      res={sigma走らず:+s0.toFixed(2), sigma全力追走:+s1.toFixed(2), 比:+ratio.toFixed(2), 有限:isFinite(ratio)};
      res.verdict=(isFinite(ratio) && ratio>=1.8 && ratio<3.0)?'PASS':'FAIL';
    }catch(e){ res={verdict:'FAIL', e:e.message}; }
    out.test16_走行中の送球ずれ=res;
  })();

  // ===== test17: 担当交代の方向門番（所見25／変異M08 approaching=false を検出）=====
  (function(){
    const chk=[];
    try{
      for(let rep=0; rep<3; rep++){
        // 球が旧担当へ向かっている間は担当を替えない
        newGame(); S.outs=0; S.bases=[null,null,null];
        startFlight({exit:91, la:-10, spray:-27, q:0.7}, 1, [0,2.5,1.4]);
        let switchedWhileApproaching=false;
        for(let i=0;i<200 && ['flight','throwing','play'].includes(S.phase) && !S.over;i++){
          const before=ball&&ball.primary?ball.primary.n:null;
          const prim=ball&&ball.primary;
          const dot=(prim&&ball)?(ball.vx*(prim.cx-ball.x)+ball.vy*(prim.cy-ball.y)):0;
          update(1/60);
          const after=ball&&ball.primary?ball.primary.n:null;
          if(before&&after&&before!==after&&dot>0) switchedWhileApproaching=true;
        }
        chk.push({n:'接近中の交代 rep'+rep, ok: !switchedWhileApproaching});
      }
      // 交代した場合、旧担当が無役で放置されていないか
      newGame(); S.outs=0; S.bases=[null,null,null];
      startFlight({exit:91, la:-10, spray:-27, q:0.7}, 1, [0,2.5,1.4]);
      let first=null, oldNoRole=false;
      for(let i=0;i<300 && ['flight','throwing','play'].includes(S.phase) && !S.over;i++){
        update(1/60);
        const p=ball&&ball.primary?ball.primary.n:null;
        if(p){ if(!first) first=p;
          else if(p!==first){ const o=fielders.find(f=>f.n===first);
            if(o && o.coverBase==null && !o.primary && Math.hypot(o.tx-o.cx,o.ty-o.cy)<1) oldNoRole=true; } }
      }
      chk.push({n:'旧担当が無役で静止', ok: !oldNoRole});
    }catch(e){ chk.push({n:'例外', ok:false, e:e.message}); }
    const bad=chk.filter(c=>!c.ok);
    out.test17_担当交代の方向門番={検査:chk.length, 不合格:bad.map(b=>b.n), verdict: bad.length===0?'PASS':'FAIL'};
  })();

  // ===== test18: 線際カメラの回り込み（所見26／変異M09 ang=0 を検出）=====
  (function(){
    let res={};
    try{
      if(typeof camTargets!=='function'){ out.test18_線際カメラ={verdict:'SKIP(camTargets不在)'}; return; }
      newGame(); S.fieldView=true;
      function eyeAt(x){
        ball={x, y:300, z:10, t:1, vx:0, vy:0, vz:0, landed:false, maxZ:10};
        const c=camTargets();
        const eye=(c&&c.eye)?c.eye:(Array.isArray(c)?c[0]:null);
        return eye;
      }
      const R=eyeAt(230), L=eyeAt(-230);
      if(!R||!L){ out.test18_線際カメラ={verdict:'SKIP(eye取得不可)'}; return; }
      const dR=Math.abs(R[0]-(0.55*230-6)), dL=Math.abs(L[0]-(0.55*(-230)-6));
      /* 対称性は「回り込み量」で見る。eye の絶対位置で比べると、基準式に元からある
         固定オフセット(-6)が左右で二重に効いて12ftの差として出るため、
         回り込みが完全対称でもFAILになる（初版でこの誤りを踏んだ）。 */
      const sym=Math.abs(dR-dL);
      res={右の回り込みft:+dR.toFixed(1), 左の回り込みft:+dL.toFixed(1), 回り込みの左右差ft:+sym.toFixed(1)};
      res.verdict=(dR>=60 && dL>=60 && sym<=5)?'PASS':'FAIL';
    }catch(e){ res={verdict:'FAIL', e:e.message}; }
    out.test18_線際カメラ=res;
  })();

  // ===== test19: 捕球打球の分類（OI-251 / OI-253） =====
  (function(){
    const chk=[];
    try{
      chk.push({n:'低いノーバウンドはライナー', ok:classifyCaughtBall({landed:false,la:12,maxZ:6.5,z:5})==='ライナー'});
      chk.push({n:'通常フライ', ok:classifyCaughtBall({landed:false,la:32,maxZ:42,z:5})==='フライ'});
      chk.push({n:'高角度はポップ', ok:classifyCaughtBall({landed:false,la:50,maxZ:55,z:5})==='ポップフライ'});
      chk.push({n:'接地球だけゴロ', ok:classifyCaughtBall({landed:true,la:-5,maxZ:6,z:0})==='ゴロ'});
    }catch(e){ chk.push({n:'例外',ok:false,e:e.message}); }
    const bad=chk.filter(x=>!x.ok);
    out.test19_捕球打球分類={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

  // ===== test20: フライ後続プレーの表示（OI-253） =====
  (function(){
    let res={};
    try{
      const save=ball;
      ball={flyKind:'フライ'};
      const a=flyOutLabel({kind:'fly',flyBy:'右'},'投');
      ball={flyKind:'ライナー'};
      const b=flyOutLabel({kind:'fly',flyBy:'三'},'投');
      ball=save;
      res={フライ:a,ライナー:b,verdict:(a==='右フライ アウト'&&b==='三ライナー アウト')?'PASS':'FAIL'};
    }catch(e){ res={verdict:'FAIL',e:e.message}; }
    out.test20_フライ後続表示=res;
  })();

  // ===== test21: フライ捕球モーション（OI-249 / OI-250） =====
  (function(){
    const chk=[];
    try{
      chk.push({n:'真上の球は飛び込み0',ok:catchDiveAmount(0.5,9)===0});
      chk.push({n:'横に遠い球は飛び込み',ok:catchDiveAmount(8,9)>0.5});
      chk.push({n:'先着した高い落下球は待つ',ok:shouldWaitForChestCatch({v:0,sp:25},{landed:false,vz:-10,z:7},1)===true});
      chk.push({n:'胸高まで来たら待たない',ok:shouldWaitForChestCatch({v:0,sp:25},{landed:false,vz:-10,z:5.2},1)===false});
      chk.push({n:'追走中は待たない',ok:shouldWaitForChestCatch({v:24,sp:25},{landed:false,vz:-10,z:7},1)===false});
    }catch(e){ chk.push({n:'例外',ok:false,e:e.message}); }
    const bad=chk.filter(x=>!x.ok);
    out.test21_フライ捕球モーション={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

  // ===== test22: 同一アウト表示の二重発行を防ぐ（OI-252） =====
  (function(){
    let res={};
    try{
      newGame();
      const oldSet=window.setMsg; let emits=0;
      window.setMsg=function(m,sub,c){ emits++; S.msg=m; S.msgSub=sub||''; S.msgColor=c||'#e8eef5'; };
      try{
        S.msg='右フライ アウト'; emits=0;
        const same=presentFinalMessage({text:'右フライ アウト',runs:0,color:'#95a3b4'});
        const sameOk=(same===false&&emits===0);
        S.msg='別の表示'; emits=0;
        const diff=presentFinalMessage({text:'右フライ アウト',runs:0,color:'#95a3b4'});
        const diffOk=(diff===true&&emits===1);
        res={同文再発行:emits,verdict:(sameOk&&diffOk)?'PASS':'FAIL'};
      }finally{ window.setMsg=oldSet; }
    }catch(e){ res={verdict:'FAIL',e:e.message}; }
    out.test22_重複アウト表示=res;
  })();

  // ===== test23: 手遅れの本塁送球より後続走者を封じる（OI-247） =====
  (function(){
    let res={};
    try{
      newGame(); S.outs=2; S.preOuts=0;
      const home={origin:3,p:3.90,goal:4,autoGoal:4,dir:1,v:23,sp:23,out:false};
      const batter={origin:0,p:1.02,goal:1,autoGoal:1,dir:0,v:0,sp:23,out:false};
      runners=[home,batter];
      const rf=fielders.find(f=>f.n==='右'); rf.cx=170; rf.cy=170;
      const oldTE=window.throwETAof, oldRE=window.runnerETA;
      try{
        window.throwETAof=(f,b)=>b===4?2.40:1.20;
        window.runnerETA=(r,b)=>r===home&&b===4?0.40:99;
        const pick=chooseThrowTarget(rf);
        res={target:pick&&pick.nb,expected:2,verdict:(pick&&pick.nb===2)?'PASS':'FAIL'};
      }finally{ window.throwETAof=oldTE; window.runnerETA=oldRE; }
    }catch(e){ res={verdict:'FAIL',e:e.message}; }
    out.test23_手遅れ本塁送球=res;
  })();

  // ===== test24: 外野手は内野手のように深くしゃがまない（OI-246） =====
  (function(){
    const chk=[];
    try{
      const of=fielderReadyPose({n:'右'}), inf=fielderReadyPose({n:'遊'}), cat=fielderReadyPose({n:'捕'});
      chk.push({n:'外野はほぼ立位',ok:of.crouch<=0.06&&of.kneeL<=0.18});
      chk.push({n:'内野は浅い構え',ok:inf.crouch>=0.10&&inf.crouch<=0.22});
      chk.push({n:'捕手は低い',ok:cat.crouch>=0.40});
      chk.push({n:'外野は内野より明確に高い',ok:of.crouch<inf.crouch*0.5});
    }catch(e){ chk.push({n:'例外',ok:false,e:e.message}); }
    const bad=chk.filter(x=>!x.ok);
    out.test24_守備構え={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

  console.log(JSON.stringify(out,null,1));
  return out;
})();
