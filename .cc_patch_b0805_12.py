from pathlib import Path
import re, subprocess, tempfile
HTML=Path('baseball3d.html'); HARNESS=Path('_test_harness_20260804.js')

def swap(s,a,b,label):
    n=s.count(a)
    if n!=1: raise SystemExit(f'{label}: expected 1 match got {n}')
    return s.replace(a,b,1)

html=HTML.read_text(encoding='utf-8')
html=swap(html,"const BUILD = 'b0805-11';","const BUILD = 'b0805-12';",'build')

old='''function chooseThrowTarget(f){\n  const throwETA=b=>throwETAof(f,b);'''
new='''/* 失点がもう防げない時は、本塁へ遅れて投げるより後続走者の次塁を塞ぐ。\n   OI-247: 三塁走者が本塁まで0.4秒、右翼から本塁2.4秒の場面で、\n   一塁到達済みの打者は dir=0 なので通常の live から消え、本塁だけが候補に残った。\n   その場合は「今止まっている後続走者」も見て、一つ先の塁へ返して余計な進塁を防ぐ。 */\nfunction containmentBaseForTrailingRunner(){\n  const trail=runners.filter(r=>!r.out && r.goal<3.99 && r.p<2.95)\n    .sort((a,b)=>b.p-a.p)[0];\n  if(!trail) return null;\n  const occupied=clamp(Math.round(trail.p),0,2);\n  return Math.min(3, Math.max(1, occupied+1));\n}\nfunction chooseThrowTarget(f){\n  const throwETA=b=>throwETAof(f,b);'''
html=swap(html,old,new,'containment helper')

old='''  if(fallback){\n    /* どこにも勝負が無い時の送球先。走者が余裕で先に着く塁（0.6秒超の負け）へ後追いで\n       投げても意味がない（単打で打者到達済みの一塁へ207ft投げていた＝録画203729）。'''
new='''  if(fallback){\n    /* 本塁が完全に手遅れなら、その走者への後追い送球はしない。\n       後続走者が塁上で止まっていても、一つ先の塁へ返して追加進塁を防ぐ。\n       これにより OI-247 の「二塁へ返す判断→リリース時に本塁へ上書き」を防ぐ。 */\n    if(fallback.nb===4 && fallback.m < -0.60){\n      const contain=containmentBaseForTrailingRunner();\n      if(contain!=null) return {nb:contain};\n    }\n    /* どこにも勝負が無い時の送球先。走者が余裕で先に着く塁（0.6秒超の負け）へ後追いで\n       投げても意味がない（単打で打者到達済みの一塁へ207ft投げていた＝録画203729）。'''
html=swap(html,old,new,'containment fallback')

old='''function fielderPose(f){\n  /* 飛び込み・跳び上がりの見た目'''
new='''/* 守備位置ごとの通常の構え。外野手は内野手のように深く膝を割らず、\n   基本は立った姿勢で一歩目を待つ。捕手だけは低く、内野手は浅い前傾にする（OI-246）。 */\nfunction fielderReadyPose(f){\n  if('左右中'.includes(f.n))\n    return {armL:0.28,armR:0.24,elbowL:0.55,elbowR:0.55,lean:0.10,crouch:0.03,legL:0.08,legR:-0.08,kneeL:0.12,kneeR:0.12};\n  if(f.n==='捕')\n    return {armL:0.42,armR:0.38,elbowL:0.95,elbowR:0.95,lean:0.24,crouch:0.48,legL:0.32,legR:-0.32,kneeL:0.95,kneeR:0.95};\n  if('一二三遊'.includes(f.n))\n    return {armL:0.45,armR:0.40,elbowL:0.80,elbowR:0.80,lean:0.20,crouch:0.16,legL:0.20,legR:-0.20,kneeL:0.38,kneeR:0.38};\n  return {armL:0.30,armR:0.28,elbowL:0.65,elbowR:0.65,lean:0.12,crouch:0.07,legL:0.10,legR:-0.10,kneeL:0.18,kneeR:0.18};\n}\nfunction fielderPose(f){\n  /* 飛び込み・跳び上がりの見た目'''
html=swap(html,old,new,'ready pose helper')

old='''  if(S.phase==='pitch'||S.phase==='windup'||S.phase==='flight')\n    return {armL:0.55, armR:0.45, elbowL:0.95, elbowR:0.95,\n            lean:0.30, crouch:0.30, legL:0.28, legR:-0.28, kneeL:0.5, kneeR:0.5};   // 膝を割った構え\n  return null;'''
new='''  if(S.phase==='pitch'||S.phase==='windup'||S.phase==='flight')\n    return fielderReadyPose(f);\n  return null;'''
html=swap(html,old,new,'ready pose use')
HTML.write_text(html,encoding='utf-8')

h=HARNESS.read_text(encoding='utf-8')
marker="  console.log(JSON.stringify(out,null,1));\n"
if h.count(marker)!=1: raise SystemExit('harness marker mismatch')
insert=r'''  // ===== test23: 手遅れの本塁送球より後続走者を封じる（OI-247） =====
  (function(){
    let res={};
    try{
      newGame(); S.outs=2; S.preOuts=0;
      const home={origin:3,p:3.90,goal:4,autoGoal:4,dir:1,v:23,sp:23,out:false};
      const batter={origin:0,p:1.02,goal:1,autoGoal:1,dir:0,v:0,sp:23,out:false};
      runners=[home,batter];
      const rf=fielders.find(f=>f.n==='右'); rf.cx=170; rf.cy=170;
      const oldTE=window.throwETAof, oldRE=window.runnerETA;
      try{
        window.throwETAof=(f,b)=>b===4?2.40:1.20;
        window.runnerETA=(r,b)=>r===home&&b===4?0.40:99;
        const pick=chooseThrowTarget(rf);
        res={target:pick&&pick.nb,expected:2,verdict:(pick&&pick.nb===2)?'PASS':'FAIL'};
      }finally{ window.throwETAof=oldTE; window.runnerETA=oldRE; }
    }catch(e){ res={verdict:'FAIL',e:e.message}; }
    out.test23_手遅れ本塁送球=res;
  })();

  // ===== test24: 外野手は内野手のように深くしゃがまない（OI-246） =====
  (function(){
    const chk=[];
    try{
      const of=fielderReadyPose({n:'右'}), inf=fielderReadyPose({n:'遊'}), cat=fielderReadyPose({n:'捕'});
      chk.push({n:'外野はほぼ立位',ok:of.crouch<=0.06&&of.kneeL<=0.18});
      chk.push({n:'内野は浅い構え',ok:inf.crouch>=0.10&&inf.crouch<=0.22});
      chk.push({n:'捕手は低い',ok:cat.crouch>=0.40});
      chk.push({n:'外野は内野より明確に高い',ok:of.crouch<inf.crouch*0.5});
    }catch(e){ chk.push({n:'例外',ok:false,e:e.message}); }
    const bad=chk.filter(x=>!x.ok);
    out.test24_守備構え={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

'''
h=h.replace(marker,insert+marker,1)
HARNESS.write_text(h,encoding='utf-8')

# Syntax checks
js=re.search(r'<script>\s*(.*?)\s*</script>',html,re.S).group(1)
with tempfile.NamedTemporaryFile('w',suffix='.js',delete=False,encoding='utf-8') as f:
    f.write(js); p=f.name
subprocess.run(['node','--check',p],check=True)
subprocess.run(['node','--check',str(HARNESS)],check=True)
print('b0805-12 patch syntax PASS')
