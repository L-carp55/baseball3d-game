from pathlib import Path

HTML=Path('baseball3d.html')
HARNESS=Path('_test_harness_20260804.js')
GUARD=Path('_architecture_guard_20260808.js')
DOC=Path('ARCHITECTURE_REMEDIATION_20260808.md')


def swap(text,old,new,label):
    n=text.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 match, got {n}')
    return text.replace(old,new,1)

html=HTML.read_text(encoding='utf-8')
html=swap(html,"const BUILD = 'b0805-17';","const BUILD = 'b0805-18';",'build')

old="""function setTarget(f,x,y){ const p=clampField(x,y); f.tx=p[0]; f.ty=p[1]; }\n"""
new="""function setTarget(f,x,y){ const p=clampField(x,y); f.tx=p[0]; f.ty=p[1]; }\n/* 再照準は「新しい予測が出た」だけでは採用しない。0.2秒ごとに無条件で\n   setTargetしていたため、野手が既に走っている目標を捨てて小さな予測差へ何度も\n   方向転換し、実走距離が伸びた。ReachModelで現在目標と候補目標の残り時間を\n   同じ物差しで比べ、0.12秒以上の改善か、球が旧目標を通過した時だけ切り替える。 */\nconst RETARGET_GAIN=0.12;\nfunction targetPassedByBall(x,y){\n  if(!ball) return false;\n  const vx=ball.vx||0, vy=ball.vy||0;\n  if(Math.hypot(vx,vy)<1) return false;\n  return vx*(x-ball.x)+vy*(y-ball.y) < 0;\n}\nfunction fieldingTargetETA(f,x,y){\n  return reachTimeToPoint(f,x,y,{useCurrent:true,reach:CATCH_R,reactScale:0.4,turn:true});\n}\nfunction shouldAdoptFieldingTarget(f,x,y,minGain=RETARGET_GAIN){\n  if(f.tx==null || f.ty==null) return true;\n  if(Math.hypot(x-f.tx,y-f.ty)<0.75) return false;\n  if(targetPassedByBall(f.tx,f.ty)) return true;\n  const keep=fieldingTargetETA(f,f.tx,f.ty);\n  const next=fieldingTargetETA(f,x,y);\n  return keep-next >= minGain;\n}\nfunction retargetFielder(f,x,y,source){\n  if(!shouldAdoptFieldingTarget(f,x,y)) return false;\n  setTarget(f,x,y);\n  f.aimSource=source||'replan'; f.aimSeq=(f.aimSeq||0)+1;\n  return true;\n}\n"""
html=swap(html,old,new,'retarget helpers')

old="""    if(ball.landed && bspg<10){\n      const b2={x:ball.x,y:ball.y,z:ball.z,vx:ball.vx,vy:ball.vy,vz:ball.vz};\n      for(let i=0;i<480 && Math.hypot(b2.vx,b2.vy)>1; i++) stepBall(b2,PHYS_H);\n      setTarget(prim, b2.x, b2.y);\n    }else{\n      const ip=interceptPoint(prim); setTarget(prim, ip[0], ip[1]);\n    }\n"""
new="""    if(ball.landed && bspg<10){\n      const b2={x:ball.x,y:ball.y,z:ball.z,vx:ball.vx,vy:ball.vy,vz:ball.vz};\n      for(let i=0;i<480 && Math.hypot(b2.vx,b2.vy)>1; i++) stepBall(b2,PHYS_H);\n      retargetFielder(prim,b2.x,b2.y,'slow-roll-replan');\n    }else{\n      const ip=interceptPoint(prim);\n      retargetFielder(prim,ip[0],ip[1],'intercept-replan');\n    }\n"""
html=swap(html,old,new,'aim adoption')

old="""    role: fielders.map(f=>`${f.n}:${f.roleSource||'legacy'}#${f.roleSeq||0}`)\n"""
new="""    role: fielders.map(f=>`${f.n}:${f.roleSource||'legacy'}#${f.roleSeq||0}`),\n    aim: fielders.map(f=>`${f.n}:${f.aimSource||'legacy'}#${f.aimSeq||0}:${r2(f.tx)},${r2(f.ty)}`)\n"""
html=swap(html,old,new,'record aim')
HTML.write_text(html,encoding='utf-8')

h=HARNESS.read_text(encoding='utf-8')
marker="  console.log(JSON.stringify(out,null,1));\n  return out;"
if h.count(marker)!=1: raise SystemExit('harness marker')
insert=r'''  // ===== test35: 再照準の採用条件（ReachModel / OI-241系） =====
  (function(){
    const chk=[];
    try{
      newGame();
      const f=fielders.find(x=>x.n==='遊');
      f.cx=0; f.cy=0; f.sp=25; f.v=20; f.tx=40; f.ty=0; f.aimSeq=0;
      ball={x:0,y:0,z:0,vx:50,vy:0,vz:0,landed:true};
      chk.push({n:'小改善は現在目標を維持',ok:shouldAdoptFieldingTarget(f,38,0)===false});
      const before=f.tx, seq=f.aimSeq||0;
      chk.push({n:'却下時は目標も履歴も不変',ok:retargetFielder(f,38,0,'test-small')===false&&f.tx===before&&(f.aimSeq||0)===seq});
      chk.push({n:'十分な改善は採用',ok:retargetFielder(f,30,0,'test-big')===true&&Math.abs(f.tx-30)<1e-9&&f.aimSource==='test-big'});
    }catch(e){chk.push({n:'例外',ok:false,e:e.message});}
    const bad=chk.filter(x=>!x.ok);
    out.test35_再照準採用={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

  // ===== test36: 旧目標を球が通過した時は切替を許可 =====
  (function(){
    let res={};
    try{
      newGame();
      const f=fielders.find(x=>x.n==='遊');
      f.cx=0; f.cy=0; f.sp=25; f.v=20; f.tx=40; f.ty=0;
      ball={x:50,y:0,z:0,vx:50,vy:0,vz:0,landed:true};
      const passed=targetPassedByBall(40,0);
      const adopt=shouldAdoptFieldingTarget(f,65,0);
      res={passed,adopt,verdict:(passed===true&&adopt===true)?'PASS':'FAIL'};
    }catch(e){res={verdict:'FAIL',e:e.message};}
    out.test36_通過済み目標=res;
  })();

'''
h=h.replace(marker,insert+marker,1)
HARNESS.write_text(h,encoding='utf-8')

g=GUARD.read_text(encoding='utf-8')
anchor="""const resetBody=stripComments(extractFunction('resetFielders'));\ncheck('reset clears all fielding assignments',/clearFieldingAssignments\\(/.test(resetBody),'reset boundary');\n"""
extra="""const resetBody=stripComments(extractFunction('resetFielders'));\ncheck('reset clears all fielding assignments',/clearFieldingAssignments\\(/.test(resetBody),'reset boundary');\nconst retargetBody=stripComments(extractFunction('shouldAdoptFieldingTarget'));\ncheck('retarget adoption uses ReachModel',/fieldingTargetETA\\(/.test(retargetBody)&&/targetPassedByBall\\(/.test(retargetBody),'ReachModel + passed-target');\nconst flightBody=stripComments(extractFunction('stepFlight'));\ncheck('stepFlight routes dynamic aim through retarget gate',count(/retargetFielder\\s*\\(/g,flightBody)>=2,\n  (flightBody.match(/retargetFielder\\s*\\(/g)||[]).length);\ncheck('stepFlight has no legacy direct dynamic target writes',\n  !/setTarget\\(prim,\\s*b2\\.x/.test(flightBody)&&!/setTarget\\(prim,\\s*ip\\[0\\]/.test(flightBody),'retarget gate');\n"""
if g.count(anchor)!=1: raise SystemExit('guard anchor')
g=g.replace(anchor,extra,1)
GUARD.write_text(g,encoding='utf-8')

d=DOC.read_text(encoding='utf-8')
d += """\n\n## Phase 4b — b0805-18 Retarget adoption gate\n\n- 0.20秒ごとの再照準は無条件採用しない。\n- 現在目標を続けるETAと候補目標ETAを共通ReachModelで比較する。\n- 候補が0.12秒以上有利、または球が旧目標を通過済みの場合のみ切り替える。\n- `aimSource / aimSeq` を録画へ追加し、目標変更の出所を追跡する。\n- architecture guardで`stepFlight`の動的再照準が`retargetFielder`を経由することを固定する。\n"""
DOC.write_text(d,encoding='utf-8')
print('patched b0805-18')
