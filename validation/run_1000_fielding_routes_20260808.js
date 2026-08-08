/* 1000-ball fielding route benchmark.
   Thresholds are declared BEFORE this run, based on the prior 300-ball b0805-17 check
   (p95≈1.24, >1.25 ratio 5%, mean≈1.044), with explicit safety margin. */
(function(){
  const LIMITS={minSamples:550,p95Max:1.35,over125ShareMax:0.08,meanMax:1.08,nonterminationMax:0};
  function rng(seed){let s=seed>>>0;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}
  const r=rng(0x6A17B20), ratios=[], failures=[];
  let fielded=0, nontermination=0, totalHandoffs=0, maxHandoffs=0;
  const oldRandom=Math.random;
  try{
    Math.random=r;
    for(let i=0;i<1000;i++){
      newGame(); S.outs=i%3; S.preOuts=0; S.bases=[null,null,null];
      const start=new Map(fielders.map(f=>[f.n,[f.cx,f.cy]]));
      const exit=55+r()*55, la=-30+r()*80, spray=-44+r()*88;
      startFlight({exit,la,spray,q:0.8},1,[0,2.5,1.4]);
      let t=0, last=ball&&ball.primary?ball.primary.n:null, handoffs=0;
      while(t<20&&S.phase==='flight'&&!S.over){
        update(1/60); t+=1/60;
        const now=ball&&ball.primary?ball.primary.n:null;
        if(now!==last){handoffs++;last=now;}
        if(fielders.some(f=>!Number.isFinite(f.cx)||!Number.isFinite(f.cy))){ failures.push({i,why:'NaN'}); break; }
      }
      totalHandoffs+=handoffs; maxHandoffs=Math.max(maxHandoffs,handoffs);
      if(S.phase==='flight'&&!S.over){nontermination++;failures.push({i,why:'flight-nontermination',exit:+exit.toFixed(1),la:+la.toFixed(1),spray:+spray.toFixed(1)});continue;}
      if(throwPlay&&throwPlay.thrower){
        fielded++;
        const f=throwPlay.thrower, p0=start.get(f.n);
        const direct=p0?Math.hypot(f.cx-p0[0],f.cy-p0[1]):0;
        if(direct>=10){
          const ratio=(f.run||0)/direct;
          if(Number.isFinite(ratio)) ratios.push(ratio);
        }
      }
    }
  } finally {Math.random=oldRandom;}
  ratios.sort((a,b)=>a-b);
  const mean=ratios.length?ratios.reduce((a,b)=>a+b,0)/ratios.length:99;
  const p95=ratios.length?ratios[Math.min(ratios.length-1,Math.floor(ratios.length*0.95))]:99;
  const over125=ratios.filter(x=>x>1.25).length, share=ratios.length?over125/ratios.length:1;
  const checks={
    samples:ratios.length>=LIMITS.minSamples,
    p95:p95<=LIMITS.p95Max,
    over125Share:share<=LIMITS.over125ShareMax,
    mean:mean<=LIMITS.meanMax,
    nontermination:nontermination<=LIMITS.nonterminationMax
  };
  const out={LIMITS,contacts:1000,fielded,routeSamples:ratios.length,
    mean:+mean.toFixed(4),p95:+p95.toFixed(4),over125,over125Share:+share.toFixed(4),
    nontermination,totalHandoffs,maxHandoffs,checks,failures:failures.slice(0,20),
    verdict:Object.values(checks).every(Boolean)?'PASS':'FAIL'};
  window.__ROUTE1000_RESULT=out;
  document.body.setAttribute('data-route1000',encodeURIComponent(JSON.stringify(out)));
  console.log('route1000',out);
})();
