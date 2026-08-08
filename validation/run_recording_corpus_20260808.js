/* Derived owner-recording regression corpus runner.
   Exact historical outcomes are intentionally NOT asserted: old recordings do not contain
   RNG state, player identity/speed, or exact contact origin. We replay the recorded contact,
   outs, base occupancy, and S/Z/X timing and assert architecture-level invariants. */
(function(){
  const corpus=window.__OWNER_RECORDING_CORPUS;
  if(!corpus||!Array.isArray(corpus.plays)) throw new Error('owner recording corpus missing');
  const fields=corpus.fields;
  const ix=Object.fromEntries(fields.map((n,i)=>[n,i]));
  const active=()=>['flight','throwing','play'].includes(S.phase)&&!S.over;
  const clearKeys=()=>['s','z','x'].forEach(k=>held[k]=false);
  const applyKeyString=k=>{ clearKeys(); if(k&&k!=='-') for(const c of k) if(c==='s'||c==='z'||c==='x') held[c]=true; };
  function seedOf(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0;} return h||1; }
  function seeded(seed){ let s=seed>>>0; return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;}; }
  function finiteState(){
    const nums=[];
    if(ball) nums.push(ball.x,ball.y,ball.z,ball.vx,ball.vy,ball.vz);
    runners.forEach(r=>nums.push(r.p,r.goal,r.sp||0,r.v||0));
    fielders.forEach(f=>nums.push(f.cx,f.cy,f.tx,f.ty,f.v||0));
    return nums.every(Number.isFinite);
  }
  const failures=[], samples=[];
  const originalRandom=Math.random;
  for(let si=0;si<corpus.plays.length;si++){
    const row=corpus.plays[si], id=row[ix.id], ois=row[ix.ois], keys=row[ix.keys]||[];
    let closureViolation=null, nonFinite=false, roleCollision=false, invalidTarget=false, maxClock=0;
    try{
      Math.random=seeded(seedOf(id));
      newGame();
      S.outs=row[ix.outs]; S.preOuts=0;
      S.bases=String(row[ix.bases]).split('').map((b,i)=>b==='1'?{id:i+1,sp:23}:null);
      clearKeys();
      const oldRequest=requestPlayConclusion;
      requestPlayConclusion=function(source){
        const st=playLifecycleState();
        const result=oldRequest(source);
        if(result && !st.thirdOut && (st.liveBall||st.keyHeld||st.activeRundown||st.flyDecision||st.unsettled))
          closureViolation={source,state:st};
        return result;
      };
      startFlight({exit:row[ix.exit],la:row[ix.la],spray:row[ix.spray],q:0.8},1,[0,2.5,1.4]);
      let t=0,ki=0,current='-';
      while(t<35&&active()){
        while(ki<keys.length&&keys[ki][0]<=t+1e-9){current=keys[ki][1];ki++;}
        applyKeyString(current);
        update(1/60); t+=1/60; maxClock=Math.max(maxClock,S.playClock||0);
        if(!finiteState()){nonFinite=true;break;}
        if(fielders.some(f=>f.primary&&f.coverBase!=null)){roleCollision=true;break;}
        if(throwPlay && !([1,2,3,4,'P'].includes(throwPlay.target))){invalidTarget=true;break;}
        if(runners.some(r=>r.goal<0||r.goal>4)){nonFinite=true;break;}
      }
      requestPlayConclusion=oldRequest;
      clearKeys();
      const nontermination=active();
      const bad=!!closureViolation||nonFinite||roleCollision||invalidTarget||nontermination||S.outs<0||S.outs>3;
      if(bad) failures.push({id,ois,nontermination,nonFinite,roleCollision,invalidTarget,closureViolation,phase:S.phase,outs:S.outs,playClock:+maxClock.toFixed(2)});
      if(si<8||bad) samples.push({id,ois,phase:S.phase,outs:S.outs,clock:+maxClock.toFixed(2)});
    }catch(e){ failures.push({id,ois,error:e.message}); }
    finally{ clearKeys(); Math.random=originalRandom; }
  }
  const out={schema:corpus.schema,plays:corpus.plays.length,failures,samples,verdict:failures.length?'FAIL':'PASS'};
  window.__RECORDING_CORPUS_RESULT=out;
  document.body.setAttribute('data-recording-corpus',encodeURIComponent(JSON.stringify(out)));
  console.log('recording corpus',out);
})();
