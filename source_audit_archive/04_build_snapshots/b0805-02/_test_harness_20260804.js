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
  /* ★未完成（2026-08-05）。この試験はまだ検出力が無い。
     修正前コードに対しても打ち切りを再現できなかった（8試行すべて 12秒台に到達せず）。
     理由: 差し込んだ直後に throwPlay が消えると updateThrowPhase が呼ばれなくなり
     S.playClock が止まるため、12秒の閾値を跨げない。
     したがって PASS を出さない（INCOMPLETE 固定）。合格条件は
     「修正前で FAIL・修正後で PASS」の両方を示すこと。作り直し = tasks.db BB-TEST-DETECT。
     ※ 参考値は残すが、これを根拠に「直った」と言わないこと。 */
  (function(){
    let reached=0, trials=0, det=[];
    for(let k=0;k<8;k++){
      newGame(); S.outs=0; S.bases=[{id:1,sp:24},null,null];
      startFlight({exit:85, la:-8, spray:-30, q:0.7}, 1, [0,2.5,1.4]);
      let ok=false;
      for(let i=0;i<240;i++){ update(1/60); if(throwPlay){ ok=true; break; }
        if(!['flight','throwing','play'].includes(S.phase)||S.over) break; }
      if(!ok) continue;
      const r=runners.find(x=>x.origin===1); if(!r||r.out) continue;
      trials++;
      r.p=1.5; r.goal=2; r.autoGoal=2;
      S.playClock=11.85;
      let endPc=null, n=0;
      while(n<120 && endPc===null){
        update(1/60); n++;
        const rr=runners.find(x=>x.origin===1); if(rr&&!rr.out) rr.p=Math.min(Math.max(rr.p,1.45),1.55);
        if(!['flight','throwing','play'].includes(S.phase)||S.over) endPc=+(S.playClock||0).toFixed(2);
      }
      if(endPc!==null) reached++;
      det.push(endPc);
    }
    out.test14_塁間での時間切れ={verdict:'INCOMPLETE（検出力なし・作り直し要）',
      trials, 打ち切りに至った回数:reached, 内訳:det.slice(0,4),
      note:'修正前コードでもFAILにできていないため、この結果を根拠にしない'};
  })();

  console.log(JSON.stringify(out,null,1));
  return out;
})();
