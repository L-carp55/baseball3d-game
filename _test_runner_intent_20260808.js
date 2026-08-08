const fs=require('fs'), vm=require('vm');
const html=fs.readFileSync('baseball3d.html','utf8');
const js=html.split('<script>')[1].split('</script>')[0];
function extract(name){
  const start=js.indexOf(`function ${name}(`); if(start<0) throw new Error('missing '+name);
  const brace=js.indexOf('{',start); let d=0, q=null, esc=false, line=false, block=false;
  for(let i=brace;i<js.length;i++){
    const c=js[i], n=js[i+1];
    if(line){ if(c==='\n') line=false; continue; }
    if(block){ if(c==='*'&&n==='/'){block=false;i++;} continue; }
    if(q){ if(esc){esc=false;continue;} if(c==='\\'){esc=true;continue;} if(c===q)q=null; continue; }
    if(c==='"'||c==="'"||c==='`'){q=c;continue;}
    if(c==='/'&&n==='/'){line=true;i++;continue;} if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==='{') d++; else if(c==='}' && --d===0) return js.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}
const names=['runnerObservedDir','makeRunner','setRunnerIntent','setAutoGoal','setManualGoal','runnerSelectedForCommand','applyRunnerKeys','updateRunners','selectDefenseAction','visibleRunnerThreat','runnerThreatETA','throwThreatValue','throwActionForThreat','containmentBaseForTrailingRunner','chooseThrowTarget'];
const ctx={console,Math,held:{},runners:[],fielders:[],ball:null,throwPlay:null,S:{outs:0,preOuts:0,phase:'flight'},
  clamp:(v,a,b)=>v<a?a:v>b?b:v,baseOuts:()=>0,isForced:()=>false,RUN_SPEED:1/90,ACC_T:1.9,
  runnerETA:()=>1.2,runnerBackETA:()=>0.1,throwETAof:()=>0.4};
vm.createContext(ctx);
for(const n of names) vm.runInContext(extract(n),ctx,{filename:n+'.js'});
function rr(origin,p,goal){return {origin,p,goal,autoGoal:goal,extra:0,sp:23,v:0,obsDir:0,out:false,intentSource:'fixture',intentSeq:0};}
function clear(){for(const k of ['s','z','x','1','2','3'])ctx.held[k]=false;}
function assert(c,m){if(!c)throw new Error(m);}
// Human-play regression (b0805-21): on a high fly, S must advance immediately and X must return immediately; automatic halfway/tag-up logic must not reinterpret the explicit command.
ctx.ball={landed:false,canCatchAir:true,maxZ:30,z:18,vz:-8,t:1};
let batter=rr(0,1,1), lead=rr(2,2.4,3);ctx.runners=[batter,lead];clear();ctx.held.z=true;ctx.applyRunnerKeys();assert(batter.goal===1&&lead.goal===3&&lead.cmd==='S'&&lead.intentSource==='manual'&&!lead.tagUp,'Z leak');
ctx.ball={landed:false,canCatchAir:true,maxZ:30,z:18,vz:-8,t:1};
let b1=rr(0,.2,1), first=rr(1,1.08,1), third=rr(3,3.08,3);ctx.runners=[b1,first,third];clear();ctx.held['1']=ctx.held.s=true;ctx.applyRunnerKeys();assert(b1.goal===1&&first.goal===2&&first.cmd==='S'&&first.intentSource==='manual'&&third.goal===3,'1+S leak');
ctx.ball={landed:false,canCatchAir:true,maxZ:30,z:18,vz:-8,t:1};
let b2=rr(0,.2,1), first2=rr(1,1.08,1), third2=rr(3,3.08,3);ctx.runners=[b2,first2,third2];clear();ctx.held['3']=ctx.held.s=true;ctx.applyRunnerKeys();assert(b2.goal===1&&first2.goal===1&&third2.goal===4&&third2.cmd==='S'&&third2.intentSource==='manual','3+S leak');
ctx.ball={landed:false,canCatchAir:true,maxZ:30,z:18,vz:-8,t:1};
let b3=rr(0,.55,1), first3=rr(1,1.45,1.45);ctx.runners=[b3,first3];clear();ctx.held['1']=ctx.held.x=true;ctx.applyRunnerKeys();assert(b3.goal===1&&first3.goal===1&&first3.cmd==='X'&&first3.intentSource==='manual','1+X return leak');
function pick(goal,legacyDir){ctx.runners=[{origin:2,p:2.42,goal,autoGoal:goal,obsDir:1,dir:legacyDir,v:18,sp:23,out:false}];const f={cx:0,cy:180};return ctx.chooseThrowTarget(f)?.nb;}
assert(pick(3,1)===3&&pick(2,-1)===3,'defense goal leak');
ctx.runners=[{origin:2,p:2.2,goal:3,autoGoal:3,obsDir:0,dir:1,v:18,sp:23,out:false}];ctx.throwPlay=null;ctx.updateRunners(1/60);const r=ctx.runners[0];assert(ctx.runnerObservedDir(r)===1,'obs forward');ctx.setManualGoal(r,2,'X');assert(ctx.runnerObservedDir(r)===1,'goal leaked before motion');ctx.updateRunners(1/60);assert(ctx.runnerObservedDir(r)===-1,'obs back');
const api=rr(1,1.1,2);api.cmd='S';
const seq0=api.intentSeq, source0=api.intentSource;
assert(ctx.setAutoGoal(api,3,false)===false,'auto should respect manual command');
assert(api.autoGoal===3&&api.goal===2&&api.intentSeq===seq0&&api.intentSource===source0,'blocked auto mutated active intent');
ctx.setManualGoal(api,2.5,'S');
assert(api.goal===2.5&&api.autoGoal===3&&api.cmd==='S'&&api.intentSource==='manual'&&api.intentSeq===seq0+1,'manual API contract');
ctx.setRunnerIntent(api,1,{source:'result',force:true,updateAuto:true,cmd:null});
assert(api.goal===1&&api.autoGoal===1&&api.cmd===null&&api.intentSource==='result'&&api.intentSeq===seq0+2,'rule/result API contract');
console.log('targeted b0805-23 RunnerIntent PASS');
