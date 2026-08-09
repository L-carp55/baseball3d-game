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
const ctx={console,Math,Number,CATCH_R:4.5,STANDING_CATCH_Z:6.8,runners:[],fielders:[],S:{outs:0},ball:null,
  A:{transfer:()=>0.25},coverArrival:()=>0,
  clamp:(v,a,b)=>v<a?a:v>b?b:v,runnerObservedDir:r=>r.obsDir||0,isForced:r=>!!r.forced,
  throwETAof:()=>1,runnerETA:()=>1,runnerBackETA:()=>1,
  stepBall:(q,dt)=>{q.x+=(q.vx||0)*dt;q.y+=(q.vy||0)*dt;q.z+=(q.vz||0)*dt;},
  reachTimeToPoint:()=>0,throwPoint:b=>b===2?[63.6,63.6]:[0,0],throwFlightTime:()=>0.4,
  armEff:()=>0.8,runnerPos:r=>({x:(r.p||0)*10,z:0})};
vm.createContext(ctx);
for(const n of ['selectDefenseAction','visibleRunnerThreat','runnerThreatETA','throwThreatValue','doublePlayContinuation','throwActionForThreat',
  'containmentBaseForTrailingRunner','chooseThrowTarget','decideThrowTarget','catchDiveAmount','groundDiveAmount',
  'findRoutineCatchWindow','planCatchAction','rundownOtherAdvanceRisk','planRundownAction'])
  vm.runInContext(extract(n),ctx,{filename:n+'.js'});
function ok(c,m){if(!c)throw new Error(m);}
ok(ctx.selectDefenseAction([{kind:'first',utility:1},{kind:'best',utility:2}]).kind==='best','selector stayed first-feasible');
const of={cx:0,cy:180};
let batter={origin:0,p:1.4,obsDir:1,v:23,sp:23,out:false};ctx.runners=[batter];
ctx.throwETAof=(f,b)=>b===2?.7:.9;ctx.runnerETA=(r,b)=>b===2?1:2;ctx.runnerBackETA=()=>.1;
ok(ctx.chooseThrowTarget(of).nb===2,'speculative third-base throw');
let tag={origin:2,p:2.08,obsDir:1,v:2,sp:23,out:false};ctx.runners=[tag];
ctx.throwETAof=(f,b)=>b===3?.8:2;ctx.runnerETA=(r,b)=>b===3?1:9;ctx.runnerBackETA=()=>.05;
ok(ctx.chooseThrowTarget(of).nb===3,'tag-up start ignored');
const home={origin:2,p:3.4,obsDir:1,v:23,sp:23,out:false},trail={origin:0,p:1.1,obsDir:1,v:23,sp:23,out:false};ctx.runners=[home,trail];
ctx.throwETAof=(f,b)=>b===4?1.1:(b===2?.6:2);ctx.runnerETA=(r,b)=>r===home&&b===4?1.15:(r===trail&&b===2?1.8:9);
ok(ctx.chooseThrowTarget(of).nb===4,'plausible home out lost to next-base throw');
const oldChoose=ctx.chooseThrowTarget;ctx.chooseThrowTarget=()=>({nb:2,reason:'current',margin:.4,utility:1.2});
const relay=ctx.decideThrowTarget(of,{kind:'ground',currentTarget:4,relayed:true});
ok(relay.nb===2&&!relay.locked,'relay target stayed stale');ctx.chooseThrowTarget=oldChoose;
const f={cx:0,cy:0,sp:24,v:0,tx:0,ty:0};
let b={x:0,y:0,z:6.7,vx:0,vy:0,vz:-1,landed:false,canCatchAir:true};
ok(ctx.planCatchAction(f,b,.4,7,{ground:false}).mode==='routine','standing catch jumped');
b={x:0,y:0,z:7.2,vx:0,vy:0,vz:-8,landed:false,canCatchAir:true};
ok(ctx.planCatchAction(f,b,.4,7.5,{ground:false}).mode==='wait','routine window ignored');
b={x:0,y:0,z:7.2,vx:0,vy:0,vz:5,landed:false,canCatchAir:true};
ok(ctx.planCatchAction(f,b,.4,7.5,{ground:false}).mode==='jump','necessary jump suppressed');
b={x:6,y:0,z:0,vx:-10,vy:0,vz:0,landed:true,canCatchAir:false};
ok(ctx.planCatchAction(f,b,6,7,{ground:true,gz:0}).mode==='wait','avoidable ground slide');
const holder={cx:0,cy:0,sp:24,v:10,tx:10,ty:0,arm:.8,fld:70,cat:70,run:0},recv={cx:63.6,cy:63.6};
const r={origin:1,p:1.7,obsDir:1,v:18,sp:23,out:false},R={r,holder,lo:1,hi:2,loLim:1,hiLim:2};ctx.runners=[r];
ctx.throwFlightTime=()=>.4;ctx.runnerETA=()=>1;ctx.runnerBackETA=()=>1;ctx.reachTimeToPoint=()=>.5;ctx.rundownOtherAdvanceRisk=()=>0;
ok(ctx.planRundownAction(R,recv,2).kind==='chase','rundown threw instead of tag chase');
ctx.runnerETA=()=>.7;ctx.reachTimeToPoint=()=>1.2;ok(ctx.planRundownAction(R,recv,2).kind==='throw','valid rundown throw suppressed');
ctx.runnerETA=()=>2;ctx.reachTimeToPoint=()=>2.4;ok(ctx.planRundownAction(R,recv,2).kind==='chase','rundown threw far too early');
ctx.runnerETA=()=>.65;ctx.reachTimeToPoint=()=>.9;ctx.rundownOtherAdvanceRisk=()=>1.15;
ok(ctx.planRundownAction(R,recv,2).kind==='chase','other-runner advance risk ignored');
console.log('targeted b0805-23 DefenseActionPolicy PASS');
