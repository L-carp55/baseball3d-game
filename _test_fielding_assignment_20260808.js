"use strict";
const fs=require('fs'), vm=require('vm');
const html=fs.readFileSync('baseball3d.html','utf8');
const js=html.split('<script>')[1].split('</script>')[0];
function extract(name){
  const start=js.indexOf(`function ${name}(`); if(start<0) throw new Error('missing '+name);
  const brace=js.indexOf('{',start); let d=0,q=null,esc=false,line=false,block=false;
  for(let i=brace;i<js.length;i++){
    const c=js[i],n=js[i+1];
    if(line){if(c==='\n')line=false;continue;}
    if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
    if(q){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===q)q=null;continue;}
    if(c==='"'||c==="'"||c==='`'){q=c;continue;}
    if(c==='/'&&n==='/'){line=true;i++;continue;} if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==='{')d++; else if(c==='}'&&--d===0)return js.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}
const names=['markFieldRole','clearCoverRole','assignCoverRole','clearAllCoverRoles','setPrimaryFielder','clearFieldingAssignments','findCoverCandidate','releaseCoverForTemporaryRole','rundownCover','coverOf'];
const ctx={console,Math,fielders:[],ball:null,FIELD_ASSIGN_SEQ:0,
  throwPoint:b=>({1:[90,0],2:[0,127],3:[-90,0],4:[0,0]})[b]||[0,60],
  setTarget:(f,x,y)=>{f.tx=x;f.ty=y;}};
vm.createContext(ctx); names.forEach(n=>vm.runInContext(extract(n),ctx,{filename:n+'.js'}));
const f=(n,cx,cy)=>({n,cx,cy,tx:cx,ty:cy,primary:false,coverBase:null,roleSource:'fixture',roleSeq:0});
function assert(c,m){if(!c)throw new Error(m);}
ctx.fielders=[f('pri',0,127),f('occupied',1,127),f('free',20,127),f('other',80,80)];
ctx.ball={primary:ctx.fielders[0]};ctx.fielders[0].primary=true;ctx.fielders[1].coverBase=1;
let chosen=ctx.rundownCover(2,null,null);
assert(chosen===ctx.fielders[2],'rundown stole occupied role');
assert(ctx.fielders[0].primary&&ctx.fielders[1].coverBase===1&&ctx.fielders[2].coverBase===2,'role preservation failed');
ctx.fielders=[f('cut',0,0),f('replacement',90,0),f('busy',50,50)];ctx.ball={primary:null};ctx.fielders[0].coverBase=1;ctx.fielders[2].coverBase=3;
assert(ctx.releaseCoverForTemporaryRole(ctx.fielders[0],'relay',[]),'release should succeed');
assert(ctx.fielders[0].coverBase==null&&ctx.fielders[1].coverBase===1,'atomic replacement failed');
ctx.fielders=[f('cut',0,0),f('p',10,0),f('b',20,0)];ctx.ball={primary:ctx.fielders[1]};ctx.fielders[1].primary=true;ctx.fielders[0].coverBase=1;ctx.fielders[2].coverBase=3;
assert(ctx.releaseCoverForTemporaryRole(ctx.fielders[0],'relay',[ctx.fielders[2]])===false,'release without replacement should fail');
assert(ctx.fielders[0].coverBase===1,'failed release dropped cover');
ctx.fielders=[f('old',0,0),f('next',20,20),f('idle',30,30)];ctx.ball={primary:ctx.fielders[0]};ctx.fielders[0].primary=true;ctx.fielders[1].coverBase=3;
const handoff=ctx.setPrimaryFielder(ctx.fielders[1],'handoff',[12,34]);
assert(handoff.changed&&handoff.freed===3,'handoff metadata');
assert(ctx.ball.primary===ctx.fielders[1]&&ctx.fielders[1].primary&&!ctx.fielders[0].primary,'primary flags');
assert(ctx.fielders[1].coverBase==null&&ctx.fielders[1].tx===12&&ctx.fielders[1].ty===34,'primary target/cover');
ctx.clearFieldingAssignments('reset');
assert(ctx.ball.primary===null&&ctx.fielders.every(x=>!x.primary&&x.coverBase==null),'reset assignments');
console.log('targeted b0805-16 FieldingAssignment PASS');
