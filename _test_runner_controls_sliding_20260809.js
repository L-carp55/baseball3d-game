"use strict";
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(process.argv[2]||'baseball3d.html','utf8');
const js=html.split('<script>')[1].split('</script>')[0];
function extract(name){
  const start=js.indexOf(`function ${name}(`); if(start<0) throw new Error('missing '+name);
  const brace=js.indexOf('{',start); let d=0,q=null,esc=false,line=false,block=false;
  for(let i=brace;i<js.length;i++){
    const c=js[i],n=js[i+1];
    if(line){if(c==='\n')line=false;continue;}
    if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
    if(q){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===q)q=null;continue;}
    if(c==='/'&&n==='/'){line=true;i++;continue;}
    if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==='"'||c==="'"||c==='`'){q=c;continue;}
    if(c==='{')d++; else if(c==='}'&&--d===0)return js.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}
const ctx={
  console,Math,Number,
  clamp:(v,a,b)=>v<a?a:v>b?b:v,
  runners:[],held:{},ball:null,throwPlay:null,
  S:{phase:'throwing'},
  baseOuts:()=>0,
  isForced:()=>false,
  throwPoint:b=>({1:[63.6,63.6],2:[0,127.3],3:[-63.6,63.6],4:[0,0]})[b],
};
vm.createContext(ctx);
[
 'makeRunner','setRunnerIntent','setAutoGoal','setManualGoal','runnerSelectedForCommand',
 'applyRunnerKeys','runnerClosePlayAtBase','desiredRunnerSlide','updateRunnerSlide','runnerSlidePose'
].forEach(n=>vm.runInContext(extract(n),ctx));
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const clear=()=>{ctx.held={};ctx.ball=null;ctx.throwPlay=null;ctx.S.phase='throwing';};

// Uploaded-recording regression: manual one-base command consumed, then auto policy tries to extend rear runner.
clear();
let rear=ctx.makeRunner(1,1,0,24),lead=ctx.makeRunner(2.4,3,1,24);ctx.runners=[rear,lead];
ctx.setManualGoal(rear,1,'S');rear.cmd=null;ctx.setManualGoal(lead,3,'S');
assert(ctx.setAutoGoal(rear,2,false)===false,'auto extension was not blocked');
assert(rear.goal===1&&rear.autoGoal===2&&rear.manualIntentLocked,'manual play lock missing');
ctx.setRunnerIntent(rear,2,{source:'result',force:true,updateAuto:true,cmd:null});
assert(rear.goal===2&&!rear.manualIntentLocked,'forced result must override and clear manual lock');

// A = lead return only.
clear();
rear=ctx.makeRunner(1.00,1,0,24);lead=ctx.makeRunner(2.45,3,1,24);ctx.runners=[rear,lead];ctx.held={a:true};ctx.applyRunnerKeys();
assert(lead.goal===2&&lead.cmd==='X'&&rear.goal===1&&rear.intentSeq===0,'A did not return only lead runner');

// C = trail advance only.
clear();
rear=ctx.makeRunner(1.15,1,0,24);lead=ctx.makeRunner(2.45,3,1,24);ctx.runners=[rear,lead];ctx.held={c:true};ctx.applyRunnerKeys();
assert(rear.goal===2&&rear.cmd==='S'&&lead.goal===3&&lead.intentSeq===0,'C did not advance only trail runner');

// D = trail return only.
clear();
rear=ctx.makeRunner(1.45,2,0,24);lead=ctx.makeRunner(2.45,3,1,24);ctx.runners=[rear,lead];ctx.held={d:true};ctx.applyRunnerKeys();
assert(rear.goal===1&&rear.cmd==='X'&&lead.goal===3&&lead.intentSeq===0,'D did not return only trail runner');

// Z remains lead advance only.
clear();
rear=ctx.makeRunner(1.2,1,0,24);lead=ctx.makeRunner(2.2,2,1,24);ctx.runners=[rear,lead];ctx.held={z:true};ctx.applyRunnerKeys();
assert(rear.goal===1&&rear.intentSeq===0&&lead.goal===3&&lead.cmd==='S','Z contract regressed');

// Sliding policy.
clear();
let r=ctx.makeRunner(1.88,2,1,24);ctx.updateRunnerSlide(r,0);assert(r.slideMode==='feet'&&r.slideBase===2,'no feet-first slide at second');
r=ctx.makeRunner(2.88,3,2,24);ctx.updateRunnerSlide(r,0);assert(r.slideMode==='feet'&&r.slideBase===3,'no feet-first slide at third');
r=ctx.makeRunner(1.88,3,1,24);ctx.updateRunnerSlide(r,0);assert(r.slideT===0,'runner slid while rounding base');
ctx.throwPlay={target:1,stage:'fly',kind:'infield',decisionMargin:0.1};r=ctx.makeRunner(0.9,1,0,24);ctx.updateRunnerSlide(r,0);assert(r.slideMode==='head','no close headfirst at first');
ctx.throwPlay={target:4,stage:'catch',kind:'outfield',decisionMargin:0.2};r=ctx.makeRunner(3.9,4,3,24);ctx.updateRunnerSlide(r,0);assert(r.slideMode==='head','no close headfirst at home');
ctx.throwPlay={target:2,stage:'fly',kind:'pickoff',decisionMargin:0.1};r=ctx.makeRunner(2.12,2,2,24);r.mustReturn=true;ctx.updateRunnerSlide(r,0);assert(r.slideMode==='head','no headfirst return slide');
ctx.throwPlay={target:1,stage:'transfer',kind:'infield',decisionMargin:1.2};r=ctx.makeRunner(0.9,1,0,24);ctx.updateRunnerSlide(r,0);assert(r.slideT===0,'routine first-base arrival slid');

console.log('targeted b0805-26 runner controls/sliding PASS');
