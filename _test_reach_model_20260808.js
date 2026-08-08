"use strict";
const fs=require('fs'),vm=require('vm');
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
    if(c==='/'&&n==='/'){line=true;i++;continue;}if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==='{')d++;else if(c==='}'&&--d===0)return js.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}
const decl=[
  js.match(/const F_REACT\s*=\s*[^;]+;/)[0],
  js.match(/const ROUND_OFF\s*=\s*[^;]+;/)[0],
  js.match(/const REACH_TURN_MAX\s*=\s*[^;]+;/)[0],
  js.match(/const CATCH_R\s*=\s*[^;]+;/)[0],
  js.match(/const PHYS_H\s*=\s*[^;]+;/)[0]
].join('\n');
const names=['runTime','fielderMotionFraction','reachTurnCost','reachTravelTime','reachTimeToPoint','reactOf','diveReach','planPlay'];
const ctx={console,Math,RAD:Math.PI/180,fielders:[],clamp:(v,a,b)=>v<a?a:v>b?b:v,
  stepBall(){},fenceDist:()=>400};
vm.createContext(ctx);vm.runInContext(decl,ctx);names.forEach(n=>vm.runInContext(extract(n),ctx,{filename:n+'.js'}));
function assert(c,m){if(!c)throw new Error(m);}
let f={x:0,y:0,cx:0,cy:0,tx:100,ty:0,sp:20,v:0,zone:0.0095};
const staticT=ctx.reachTimeToPoint(f,60,0,{useCurrent:false,reach:0,turn:false});
assert(Math.abs(staticT-(ctx.reactOf(f)+ctx.runTime(20,60)))<1e-9,'static model mismatch');
f.v=20;
const forward=ctx.reachTimeToPoint(f,60,0,{useCurrent:true,reactScale:0.4,turn:true});
const reverse=ctx.reachTimeToPoint(f,-60,0,{useCurrent:true,reactScale:0.4,turn:true});
assert(forward<staticT&&forward>=3-1e-9,'motion credit invalid');
assert(reverse-forward>0.25,'turn cost missing');
ctx.stepBall=(b,h)=>{b.x=30;b.y=0;b.z=1;b.vx=0;b.vy=0;b.vz=0;};
ctx.reactOf=()=>0;
const away={n:'away',x:0,y:0,cx:0,cy:0,tx:-100,ty:0,sp:20,v:20,fld:70,zone:0.0095};
const aligned={n:'aligned',x:-2,y:0,cx:-2,cy:0,tx:100,ty:0,sp:20,v:20,fld:70,zone:0.0095};
ctx.fielders=[away,aligned];
const src={x:30,y:0,z:1,vx:0,vy:0,vz:0,bs:0,ss:0,landed:true,t:0,maxZ:1};
assert(ctx.planPlay(src,true).f===aligned,'dynamic plan ignored heading');
console.log('targeted b0805-17 ReachModel PASS');
