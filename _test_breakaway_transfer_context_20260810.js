"use strict";
const fs=require('fs'),vm=require('vm');
const path=process.argv[2]||'baseball3d.html';
const html=fs.readFileSync(path,'utf8');
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
function ok(c,m){if(!c)throw new Error(m);}
const ctx={console,Math,runners:[],manualThrow:null,
  clamp:(v,a,b)=>v<a?a:v>b?b:v,
  A:{transfer:(fld,cat)=>0.55+0.28*(1-fld/100)+0.26*(1-cat/100)},
  runnerObservedDir:r=>r.obsDir||0,
  isPlayerBatting:()=>true,
  decideThrowTarget:(f,o)=>({nb:o.manualTarget??4,source:'auto',reason:'home-live',margin:.2,utility:2})};
vm.createContext(ctx);
for(const n of ['transferTime','breakawayFallbackTarget','activeBreakawayRunner','decideBreakawayTarget'])
  vm.runInContext(extract(n),ctx,{filename:n+'.js'});
const all1={fld:1,cat:1,acc:1};
const ground=ctx.transferTime(all1,'batted-ground');
const pick=ctx.transferTime(all1,'pickoff-receive');
const relay=ctx.transferTime(all1,'relay-receive');
const recv=ctx.transferTime(all1,'throw-receive');
ok(ground>1.0,'G ground-ball processing should remain slow');
ok(pick<0.30,'pickoff reception incorrectly inherits ground-ball fielding delay');
ok(relay<0.40&&recv<0.40,'relay/throw reception incorrectly inherits ground-ball fielding delay');
ok(ground-pick>0.70,'catch-context separation is too small');
ctx.runners=[{origin:1,p:2,goal:2,jumped:true,obsDir:0,out:false}];
ok(ctx.activeBreakawayRunner()===null,'settled jumped runner keeps breakaway alive');
const first={origin:1,p:1.45,goal:2,jumped:true,obsDir:1,out:false};
const third={origin:3,p:3.45,goal:4,jumped:false,obsDir:1,out:false};
ctx.runners=[first,third];
ok(ctx.activeBreakawayRunner()===third,'home-advancing runner not prioritized');
const d=ctx.decideBreakawayTarget({n:'投'},1);
ok(d.nb===4&&!d.locked,'breakaway target stayed fixed to original base');
const begin=extract('beginBreakaway');
ok(begin.includes("kind:'breakaway'"),'early jump still uses pickoff kind');
ok(begin.includes("setMsg('飛び出した！'"),'display is not 飛び出した');
ok(!begin.includes('pickoff-return'),'early jump still forces automatic return');
const update=extract('updateThrowPhase');
ok(update.includes("if(T.kind==='breakaway')"),'breakaway is not re-evaluated while pitcher holds ball');
ok(update.includes('decideBreakawayTarget(T.thrower,T.target)'),'pitcher cannot retarget among bases');
console.log(JSON.stringify({verdict:'PASS',ground,pickoffReceive:pick,relayReceive:relay,throwReceive:recv},null,2));
