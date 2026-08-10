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
function makeCtx(helperSource){
  const ctx={console,Math,
    setTarget:(f,x,y)=>{f.tx=x;f.ty=y;},
    throwPoint:t=>t===1?[63.6,63.6]:[0,127.3]};
  vm.createContext(ctx); vm.runInContext(helperSource,ctx,{filename:'prepareThrowerFootwork.js'}); return ctx;
}
function replay(ctx,stage='transfer'){
  // 2026-08-10 17:40 recording: deflect後の二塁手は37.0,135.9で再捕球したのに、
  // stale intercept-replan 32.3,146.7へ向かって送球準備中も後退していた。
  const f={n:'二',cx:37.0,cy:135.9,tx:32.3,ty:146.7,v:15,face:0};
  const T={stage,thrower:f,target:1};
  const changed=ctx.prepareThrowerFootwork(T);
  // moveFielders相当の1刻み。古い目標が残っていれば座標が変わる。
  const dx=f.tx-f.cx,dy=f.ty-f.cy,d=Math.hypot(dx,dy);
  if(d>0.5&&f.v>0){const m=Math.min(d,f.v*0.1);f.cx+=dx/d*m;f.cy+=dy/d*m;}
  return {f,changed};
}
const original=extract('prepareThrowerFootwork');
let ctx=makeCtx(original), r=replay(ctx);
ok(r.changed,'transfer stage was not recognized');
ok(Math.abs(r.f.cx-37.0)<1e-9&&Math.abs(r.f.cy-135.9)<1e-9,'thrower still moved toward stale intercept after possession');
ok(r.f.tx===37.0&&r.f.ty===135.9&&r.f.v===0,'stale fielding target/velocity survived possession boundary');
const expected=Math.atan2(63.6-37.0,63.6-135.9);
ok(Math.abs(r.f.face-expected)<1e-9,'thrower did not turn toward actual throw target');
// step / approach は送球準備ではなく、自分で塁を踏む・走者へ詰める動作なので止めない。
for(const stage of ['step','approach']){
  const x=replay(ctx,stage);
  ok(!x.changed,stage+' was incorrectly frozen by transfer footwork');
}
const update=extract('updateThrowPhase');
const settlePos=update.indexOf("if(T.stage==='transfer') prepareThrowerFootwork(T);");
const movePos=update.indexOf('moveFielders(dt,true);');
ok(settlePos>=0&&movePos>=0&&settlePos<movePos,'thrower is settled only after moveFielders; one-frame backpedal remains');
ok(update.split('prepareThrowerFootwork(T);').length-1>=2,'retargeted transfer does not refresh body orientation');
// Mutation: possession resetを消すと、録画と同じく古いintercept点へ後退することを確認。
const mutated=original
  .replace('  setTarget(f,f.cx,f.cy);          // 打球追跡・中継位置などの古い移動目標を破棄\n','')
  .replace('  f.v=0;                           // 送球準備中に旧目標へ惰性移動しない\n','');
const mr=replay(makeCtx(mutated));
ok(Math.hypot(mr.f.cx-37.0,mr.f.cy-135.9)>0.1,'mutation failed to recreate recorded backpedal');
console.log(JSON.stringify({verdict:'PASS',recordedStart:[37.0,135.9],staleAim:[32.3,146.7],fixedPosition:[r.f.cx,r.f.cy],face:r.f.face},null,2));
