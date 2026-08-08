/* 50 full-game calibration run using the real pitch/contact/fielding/inning state machine.
   The player batting half gets the same swing-decision model used by CPU batters, so both
   halves can run unattended while preserving each roster's actual abilities.

   Acceptance anchors were declared before this run from REBUILD_CHARTER:
   CPU batter K≈22%, BB≈8%; strong lineup scoring historical 5.8–9.3 R/G;
   CPU lineup historical ~2.5 R/G. Windows are deliberately broad enough for variance. */
(function(){
  const LIMITS={games:50,nonterminationMax:0,
    team0RunsMin:4.5,team0RunsMax:10.0,team1RunsMin:1.5,team1RunsMax:4.5,
    strikeoutRateMin:0.15,strikeoutRateMax:0.30,walkRateMin:0.04,walkRateMax:0.13,
    team0HitsMin:5,team0HitsMax:18,team1HitsMin:3,team1HitsMax:13,
    errorsPerTeamGameMax:1.5};
  function rng(seed){let s=seed>>>0;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}
  function scheduleMirrorSwing(){
    if(S.phase!=='pitch'||!isPlayerBatting()||!pitch||pitch.swung||pitch._mirrorScheduled) return;
    pitch._mirrorScheduled=true;
    const strike=inZone(pitch.tx,pitch.ty), two=S.strikes>=2;
    const prob=strike?(two?0.94:0.70):(two?0.42:0.24);
    const sk=DIFF[DIFF_I].cpu;
    if(Math.random()<prob){
      const err=gauss(52/sk)+(pitch.P.dur<0.55?0:gauss(22/sk));
      pitch.cpuSwingT=1+err/(pitch.dur*1000);
      pitch.cpuOff={dx:gauss(30/sk),dy:gauss(30/sk)};
    }
  }
  const oldRandom=Math.random, oldNext=nextBatter;
  const aggregate={runs:[0,0],hits:[0,0],errors:[0,0],pa:[0,0],k:[0,0],bb:[0,0],games:[],nontermination:0};
  let pa=[0,0],k=[0,0],bb=[0,0];
  nextBatter=function(){
    const t=battingTeam(); pa[t]++;
    if(S.lastPlay==='三振'||S.msg==='三振！') k[t]++;
    if(/^フォアボール/.test(S.msg||'')) bb[t]++;
    return oldNext();
  };
  try{
    for(let g=0;g<LIMITS.games;g++){
      Math.random=rng((0x50A11CE+Math.imul(g+1,0x9E3779B1))>>>0);
      pa=[0,0];k=[0,0];bb=[0,0]; newGame();
      let steps=0;
      while(!S.over && steps++<220000){
        if(S.phase==='msg') S.timer=0;
        if(S.phase==='aimPitch'){
          const c=cpuChoosePitch(); launchPitch(c.type,c.nx,c.ny);
        }
        if(S.phase==='windup') S.timer=0;
        scheduleMirrorSwing();
        if(S.phase==='play') S.timer=Math.min(S.timer,0);
        update(1/60);
      }
      if(!S.over){aggregate.nontermination++; aggregate.games.push({g,why:'nontermination',phase:S.phase,inning:S.inning,half:S.half}); continue;}
      const gr=[total(0),total(1)], gh=[S.hits[0],S.hits[1]], ge=[(S.errors||[0,0])[0],(S.errors||[0,0])[1]];
      for(let t=0;t<2;t++){aggregate.runs[t]+=gr[t];aggregate.hits[t]+=gh[t];aggregate.errors[t]+=ge[t];aggregate.pa[t]+=pa[t];aggregate.k[t]+=k[t];aggregate.bb[t]+=bb[t];}
      aggregate.games.push({g,runs:gr,hits:gh,errors:ge,pa:pa.slice(),k:k.slice(),bb:bb.slice(),inning:S.inning});
    }
  } finally {nextBatter=oldNext;Math.random=oldRandom;}
  const n=LIMITS.games-aggregate.nontermination;
  const div=(x,d)=>d?x/d:99;
  const rg=aggregate.runs.map(x=>div(x,n)), hg=aggregate.hits.map(x=>div(x,n)), eg=aggregate.errors.map(x=>div(x,n));
  const paTotal=aggregate.pa[0]+aggregate.pa[1], kTotal=aggregate.k[0]+aggregate.k[1], bbTotal=aggregate.bb[0]+aggregate.bb[1];
  const kr=div(kTotal,paTotal), bbr=div(bbTotal,paTotal);
  const checks={
    nontermination:aggregate.nontermination<=LIMITS.nonterminationMax,
    team0Runs:rg[0]>=LIMITS.team0RunsMin&&rg[0]<=LIMITS.team0RunsMax,
    team1Runs:rg[1]>=LIMITS.team1RunsMin&&rg[1]<=LIMITS.team1RunsMax,
    strikeoutRate:kr>=LIMITS.strikeoutRateMin&&kr<=LIMITS.strikeoutRateMax,
    walkRate:bbr>=LIMITS.walkRateMin&&bbr<=LIMITS.walkRateMax,
    team0Hits:hg[0]>=LIMITS.team0HitsMin&&hg[0]<=LIMITS.team0HitsMax,
    team1Hits:hg[1]>=LIMITS.team1HitsMin&&hg[1]<=LIMITS.team1HitsMax,
    errors:eg[0]<=LIMITS.errorsPerTeamGameMax&&eg[1]<=LIMITS.errorsPerTeamGameMax
  };
  const out={LIMITS,games:LIMITS.games,completed:n,nontermination:aggregate.nontermination,
    runsPerGame:rg.map(x=>+x.toFixed(3)),hitsPerGame:hg.map(x=>+x.toFixed(3)),errorsPerGame:eg.map(x=>+x.toFixed(3)),
    pa:aggregate.pa,strikeouts:aggregate.k,walks:aggregate.bb,strikeoutRate:+kr.toFixed(4),walkRate:+bbr.toFixed(4),
    checks,sampleGames:aggregate.games.slice(0,10),verdict:Object.values(checks).every(Boolean)?'PASS':'FAIL'};
  window.__GAME50_RESULT=out;
  document.body.setAttribute('data-game50',encodeURIComponent(JSON.stringify(out)));
  console.log('game50',out);
})();
