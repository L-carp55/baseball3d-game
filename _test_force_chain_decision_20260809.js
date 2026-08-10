"use strict";
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('baseball3d.html','utf8');
const js=html.split('<script>')[1].split('</script>')[0];
function extract(name){
  const start=js.indexOf(`function ${name}(`); if(start<0)throw new Error('missing '+name);
  const brace=js.indexOf('{',start);let d=0,q=null,esc=false,line=false,block=false;
  for(let i=brace;i<js.length;i++){const c=js[i],n=js[i+1];
    if(line){if(c==='\n')line=false;continue;} if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
    if(q){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===q)q=null;continue;}
    if(c==='"'||c==="'"||c==='`'){q=c;continue;} if(c==='/'&&n==='/'){line=true;i++;continue;} if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==='{')d++;else if(c==='}'&&--d===0)return js.slice(start,i+1);}
  throw new Error('unterminated '+name);
}
const batter={origin:0,p:.1,obsDir:1,v:26,sp:30.5,out:false};
const lead={origin:1,p:1.3,obsDir:1,v:26,sp:30.5,out:false};
const cover2={n:'二',coverBase:2,fld:80,cat:80,arm:.7,run:0,cx:25.5,cy:139};
const cover1={n:'一',coverBase:1,fld:50,cat:75,arm:.5,run:0,cx:63.6,cy:63.6};
const third={n:'三',cx:-49.1,cy:77.4};
const ctx={console,Math,Number,S:{outs:0},ball:{t:1},runners:[batter,lead],fielders:[third,cover2,cover1],
  A:{transfer:()=>.20},clamp:(v,a,b)=>v<a?a:v>b?b:v,
  runnerObservedDir:r=>r.obsDir||0,isForced:r=>r.origin===1,
  throwETAof:(f,b)=>b===1?1.25:(b===2?1.55:9),
  runnerETA:(r,b)=>r===batter&&b===1?2.00:(r===lead&&b===2?1.90:9),runnerBackETA:()=>9,
  throwPoint:b=>b===2?[0,127.3]:(b===1?[63.6,63.6]:[0,0]),
  throwFlightTime:()=>.40,armEff:()=>.8,coverArrival:()=>0};
vm.createContext(ctx);
for(const n of ['transferTime','selectDefenseAction','visibleRunnerThreat','runnerThreatETA','throwThreatValue','doublePlayContinuation','throwActionForThreat','containmentBaseForTrailingRunner','chooseThrowTarget'])
  vm.runInContext(extract(n),ctx,{filename:n+'.js'});
function ok(c,m){if(!c)throw new Error(m);}
let d=ctx.chooseThrowTarget(third);
ok(d.nb===2,'recording 213741 still chose first base');
ok(d.reason==='double-play-force-chain','force chain reason not recorded');
const immediateOnly=ctx.clamp(0.50+0.45*d.margin,0.02,0.98);
ok(d.expectedOuts>immediateOnly&&d.continuationProbability>0,'expected second out not valued');
ctx.S.outs=2; ok(ctx.chooseThrowTarget(third).nb===1,'two-out sure out was displaced');
ctx.S.outs=0; cover2.coverBase=null; ok(ctx.chooseThrowTarget(third).nb===1,'uncovered second base was selected');
cover2.coverBase=2;
ctx.doublePlayContinuation=()=>({eligible:false,bonus:0,relayProbability:0,expectedOuts:0});
ok(ctx.chooseThrowTarget(third).nb===1,'mutation did not recreate old first-base choice');
console.log('b0805-28 force-chain decision PASS');
