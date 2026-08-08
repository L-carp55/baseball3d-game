/* Temporary diagnostic for the deterministic g2 full-game stall. */
(function(){
  function rng(seed){let s=seed>>>0;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}
  function scheduleMirrorSwing(){
    if(S.phase!=='pitch'||!isPlayerBatting()||!pitch||pitch.swung||pitch._mirrorScheduled) return;
    pitch._mirrorScheduled=true;
    const strike=inZone(pitch.tx,pitch.ty), two=S.strikes>=2;
    const prob=strike?(two?0.94:0.70):(two?0.42:0.24), sk=DIFF[DIFF_I].cpu;
    if(Math.random()<prob){ const err=gauss(52/sk)+(pitch.P.dur<0.55?0:gauss(22/sk));
      pitch.cpuSwingT=1+err/(pitch.dur*1000); pitch.cpuOff={dx:gauss(30/sk),dy:gauss(30/sk)}; }
  }
  const oldRandom=Math.random, oldSet=setRunnerIntent;
  const events=[]; let step=0,lastStage='',stable=0,detected=null;
  setRunnerIntent=function(r,g,opt){
    const before={p:r.p,goal:r.goal,src:r.intentSource||'',seq:r.intentSeq||0};
    const ret=oldSet(r,g,opt); const after={p:r.p,goal:r.goal,src:r.intentSource||'',seq:r.intentSeq||0};
    if(Math.abs(after.goal-Math.round(after.goal))>0.015 || before.goal!==after.goal){
      events.push({step,phase:S.phase,pc:+(S.playClock||0).toFixed(3),origin:r.origin,
        before:{p:+before.p.toFixed(3),goal:+before.goal.toFixed(3),src:before.src,seq:before.seq},
        requested:+Number(g).toFixed(3),opt:opt||{},
        after:{p:+after.p.toFixed(3),goal:+after.goal.toFixed(3),src:after.src,seq:after.seq},
        tp:throwPlay?{stage:throwPlay.stage,kind:throwPlay.kind,rd:throwPlay.rd?{sub:throwPlay.rd.sub,lo:throwPlay.rd.lo,hi:throwPlay.rd.hi,loLim:+throwPlay.rd.loLim.toFixed(2),hiLim:+throwPlay.rd.hiLim.toFixed(2),fumble:!!throwPlay.rd.fumble}:null}:null});
      if(events.length>400) events.shift();
    }
    return ret;
  };
  try{
    Math.random=rng(0xdfb07ee1); newGame();
    while(!S.over && step++<220000){
      if(S.phase==='msg') S.timer=0;
      if(S.phase==='aimPitch'){const c=cpuChoosePitch();launchPitch(c.type,c.nx,c.ny);}
      if(S.phase==='windup') S.timer=0;
      scheduleMirrorSwing(); if(S.phase==='play') S.timer=Math.min(S.timer,0);
      update(1/60);
      const live=runners.find(r=>!r.out&&Math.abs(r.p-r.goal)<0.001&&Math.abs(r.p-Math.round(r.p))>0.02&&Math.abs(r.v||0)<0.01);
      const sig=throwPlay?`${throwPlay.stage}:${throwPlay.target}:${live?live.origin+'@'+live.p.toFixed(2):'-'}`:'';
      stable=(sig&&sig===lastStage)?stable+1:0; lastStage=sig;
      if(live&&stable>600){
        detected={step,phase:S.phase,inning:S.inning,half:S.half,outs:S.outs,pc:+(S.playClock||0).toFixed(2),
          runner:{origin:live.origin,p:+live.p.toFixed(3),goal:+live.goal.toFixed(3),src:live.intentSource||'',seq:live.intentSeq||0},
          tp:throwPlay?{stage:throwPlay.stage,target:throwPlay.target,kind:throwPlay.kind,t:+(throwPlay.t||0).toFixed(3),rd:throwPlay.rd}:null};
        break;
      }
    }
  } finally {setRunnerIntent=oldSet;Math.random=oldRandom;}
  const out={seed:'0xdfb07ee1',detected,lastEvents:events.slice(-80)};
  document.body.setAttribute('data-game2diag',encodeURIComponent(JSON.stringify(out)));
  console.log(out);
})();
