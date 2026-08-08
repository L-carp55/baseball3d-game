from pathlib import Path
import re

HTML=Path('baseball3d.html'); H=Path('_test_harness_20260804.js'); G=Path('_architecture_guard_20260808.js'); D=Path('ARCHITECTURE_REMEDIATION_20260808.md')

def swap(s,a,b,label):
    n=s.count(a)
    if n!=1: raise SystemExit(f'{label}: expected 1 got {n}')
    return s.replace(a,b,1)

def sub1(s,pat,repl,label):
    s2,n=re.subn(pat,repl,s,count=1,flags=re.S)
    if n!=1: raise SystemExit(f'{label}: expected 1 got {n}')
    return s2

s=HTML.read_text(encoding='utf-8')
s=swap(s,"const BUILD = 'b0805-18';","const BUILD = 'b0805-19';",'build')

old="""    thr: throwPlay?{st:throwPlay.stage, to:throwPlay.target,\n      by:throwPlay.thrower?throwPlay.thrower.n:null, kind:throwPlay.kind}:null,\n"""
new="""    thr: throwPlay?{st:throwPlay.stage, to:throwPlay.target,\n      by:throwPlay.thrower?throwPlay.thrower.n:null, kind:throwPlay.kind,\n      ds:throwPlay.decisionSource||'legacy', dq:throwPlay.decisionSeq||0}:null,\n"""
s=swap(s,old,new,'record throw decision')

old="""function setManualThrow(t){\n  if(isPlayerBatting() || S.over) return;\n  manualThrow = t;\n  if(throwPlay && throwPlay.stage==='transfer') throwPlay.target = (t==='P') ? 1 : t;\n  ui();\n}\n"""
new="""function setManualThrow(t){\n  if(isPlayerBatting() || S.over) return;\n  manualThrow = t;\n  if(throwPlay && throwPlay.stage==='transfer') setThrowTarget(throwPlay,t,'manual-live');\n  ui();\n}\n"""
s=swap(s,old,new,'manual throw')

anchor="""  return {nb:'P'};\n}\n/* その走者が「送球に勝てる」一番先の塁。塁打数を先に決めて配るのではなく、\n"""
insert="""  return {nb:'P'};\n}\n/* ThrowDecisionの唯一の入口。捕球時・リリース時・追加送球で別々に例外処理を\n   持つと、同じ可視状態でも送球先が後段で反転する。固定プレー・手動指定・通常自動判断を\n   ここで同じ優先順位にし、T.targetの変更元も記録する。 */\nfunction decideThrowTarget(f,ctx){\n  const o=ctx||{};\n  if(o.manualTarget!=null) return {nb:o.manualTarget,source:'manual',locked:true};\n  if(o.kind==='fly' && o.flyLead!==undefined){\n    const r=o.flyLead;\n    return {nb:r ? (r.mustReturn?r.origin:Math.min(4,r.origin+1)) : 'P',source:'fly-fixed',locked:true};\n  }\n  if(o.relayed || o.kind==='steal' || o.kind==='pickoff' || o.lockCurrent){\n    return {nb:o.currentTarget!=null?o.currentTarget:'P',source:o.kind==='steal'?'steal-fixed':(o.kind==='pickoff'?'pickoff-fixed':'relay-fixed'),locked:true};\n  }\n  let d=chooseThrowTarget(f)||{nb:'P'};\n  let nb=d.nb==null?'P':d.nb, source='auto';\n  if(o.homeIfAdvancing && nb==='P' && runners.some(r=>!r.out&&r.p>2&&r.p<3.97&&runnerObservedDir(r)>0)){\n    nb=4; source='auto-home-live';\n  }\n  if(nb==='P' && o.fallbackTarget!=null){ nb=o.fallbackTarget; source='auto-fallback'; }\n  return {nb,source,locked:false};\n}\nfunction setThrowTarget(T,nb,source){\n  if(!T) return false;\n  if(T.target===nb){ if(source) T.decisionSource=source; return false; }\n  T.target=nb;\n  T.decisionSource=source||'decision'; T.decisionSeq=(T.decisionSeq||0)+1;\n  return true;\n}\n/* その走者が「送球に勝てる」一番先の塁。塁打数を先に決めて配るのではなく、\n"""
s=swap(s,anchor,insert,'ThrowDecision insert')

old="""  let tgt = chooseThrowTarget(f);\n  /* フライ捕球後は「離塁していた走者の元の塁」へ投げて離塁アウトを狙う。\n     狙う走者がいなければ投手へ返球して終わり。 */\n  if(kind==='fly') tgt = flyLead ? {nb: flyLead.mustReturn ? flyLead.origin : Math.min(4,flyLead.origin+1)} : {nb:'P'};\n  // 守備側（あなた）が送球先を指定していればそれを優先する\n  if(!isPlayerBatting() && manualThrow!=null) tgt = {nb: manualThrow};   // 'P'は投手のまま渡す\n"""
new="""  const decision=decideThrowTarget(f,{kind,flyLead:kind==='fly'?flyLead:undefined,\n    manualTarget:(!isPlayerBatting()?manualThrow:null)});\n"""
s=swap(s,old,new,'initial decision')
s=swap(s,"""    target: tgt ? tgt.nb : 1,\n    relayed:false,\n    fieldT: ball.t\n""","""    target:decision.nb, decisionSource:decision.source, decisionSeq:1,\n    relayed:false,\n    fieldT: ball.t\n""",'initial target')

# post-tag continuation: remove internal goal leak and route through decision API
old="""      let nxt = (baseOuts()+countOuts()<3) ? chooseThrowTarget(holder) : null;\n      const homing = runners.find(r=>!r.out && r.goal>=3.99 && r.p<3.97 && r.p>2.0);\n      if(homing && baseOuts()+countOuts()<3 && (!nxt || nxt.nb==='P')) nxt={nb:4};\n      if(nxt && nxt.nb!=='P'){\n        T.thrower=holder; T.target=nxt.nb; T.stage='transfer'; T.t=0;\n"""
new="""      const nxt=(baseOuts()+countOuts()<3)\n        ? decideThrowTarget(holder,{kind:'live',homeIfAdvancing:true}) : null;\n      if(nxt && nxt.nb!=='P'){\n        T.thrower=holder; setThrowTarget(T,nxt.nb,'post-tag-'+nxt.source); T.stage='transfer'; T.t=0;\n"""
s=swap(s,old,new,'post tag')

old="""      if(T.kind!=='fly' && T.kind!=='steal' && T.kind!=='pickoff'\n         && !T.relayed && !(!isPlayerBatting() && manualThrow!=null)){\n        const t2=chooseThrowTarget(T.thrower); if(t2) T.target=t2.nb;\n      }\n"""
new="""      const releaseDecision=decideThrowTarget(T.thrower,{kind:T.kind,currentTarget:T.target,\n        relayed:T.relayed,manualTarget:(!isPlayerBatting()?manualThrow:null)});\n      setThrowTarget(T,releaseDecision.nb,releaseDecision.source+'-release');\n"""
s=swap(s,old,new,'release decision')

s=swap(s,"if(S.throwCount>6 && T.stage!=='rundown') T.target='P';","if(S.throwCount>6 && T.stage!=='rundown') setThrowTarget(T,'P','throw-limit');",'throw limit')
s=swap(s,"""        const nx=T.relayTo; T.relayTo=null; T.thrower=T.receiver||T.thrower;\n        T.target=nx; T.stage='transfer'; T.t=0;\n""","""        const nx=T.relayTo; T.relayTo=null; T.thrower=T.receiver||T.thrower;\n        setThrowTarget(T,nx,'relay-release'); T.stage='transfer'; T.t=0;\n""",'relay release')
s=swap(s,"""      T.receiver=T.rd.recv; T.dest=T.rd.dest; T.relayTo=tgtBase; T.target=tgtBase;\n""","""      T.receiver=T.rd.recv; T.dest=T.rd.dest; T.relayTo=tgtBase; setThrowTarget(T,tgtBase,'rundown-air-relay');\n""",'rundown air')
s=swap(s,"""    T.target=tgtBase;\n    return;\n""","""    setThrowTarget(T,tgtBase,'rundown-turn');\n    return;\n""",'rundown target')
s=swap(s,"""    T.transfer=A.transfer(T.thrower.fld,T.thrower.cat)*0.75+0.16; T.target=1;\n""","""    T.transfer=A.transfer(T.thrower.fld,T.thrower.cat)*0.75+0.16; setThrowTarget(T,1,'double-play');\n""",'double play')

old="""        const nx=chooseThrowTarget(holder);\n        T.target = nx ? nx.nb : Math.min(4, b+1);\n"""
new="""        const nx=decideThrowTarget(holder,{kind:'live',fallbackTarget:Math.min(4,b+1)});\n        setThrowTarget(T,nx.nb,'steal-continue-'+nx.source);\n"""
s=swap(s,old,new,'steal continuation')

old="""    const nxt = chooseThrowTarget(holder);\n    if(nxt && nxt.nb!=='P'){\n      T.thrower=holder; T.receiver=null; T.target=nxt.nb;\n"""
new="""    const nxt=decideThrowTarget(holder,{kind:'live'});\n    if(nxt && nxt.nb!=='P'){\n      T.thrower=holder; T.receiver=null; setThrowTarget(T,nxt.nb,'chase-'+nxt.source);\n"""
s=swap(s,old,new,'chase continuation')

old="""        const nxt = chooseThrowTarget(holder);\n        T.thrower=holder; T.receiver=null; T.relayed=true;\n        T.stage='transfer'; T.t=0; T.stepChecked=false;\n        T.transfer=A.transfer(holder.fld,holder.cat)*0.75+0.16;\n        T.target=(nxt && nxt.nb!=='P') ? nxt.nb\n               : Math.min(4, Math.max(1, Math.round(uns.goal)));\n"""
new="""        const fallback=Math.min(4,Math.max(1,Math.round(uns.p)));\n        const nxt=decideThrowTarget(holder,{kind:'live',fallbackTarget:fallback});\n        T.thrower=holder; T.receiver=null; T.relayed=true;\n        T.stage='transfer'; T.t=0; T.stepChecked=false;\n        T.transfer=A.transfer(holder.fld,holder.cat)*0.75+0.16;\n        setThrowTarget(T,nxt.nb,'conclude-continue-'+nxt.source);\n"""
s=swap(s,old,new,'conclude continuation')

# initialize fixed decisions constructed outside beginThrowPhase
s=swap(s,"""    thrower:cat, kind:'steal', award:0, target:tgt, relayed:false, fieldT:0 };\n""","""    thrower:cat, kind:'steal', award:0, target:tgt, decisionSource:'steal-fixed', decisionSeq:1, relayed:false, fieldT:0 };\n""",'steal init')
s=swap(s,"""    thrower:pit, kind:'pickoff', award:0, target:jump.origin, relayed:false, fieldT:0,\n""","""    thrower:pit, kind:'pickoff', award:0, target:jump.origin, decisionSource:'pickoff-fixed', decisionSeq:1, relayed:false, fieldT:0,\n""",'pickoff init')

# No post-construction target writer may remain outside setThrowTarget.
clean=re.sub(r'/\*[\s\S]*?\*/|//[^\n]*','',s)
writes=re.findall(r'\b(?:T|throwPlay)\.target\s*=(?!=)',clean)
if len(writes)!=1: raise SystemExit(f'target writers remain: {len(writes)} {writes}')
HTML.write_text(s,encoding='utf-8')

h=H.read_text(encoding='utf-8'); marker="  console.log(JSON.stringify(out,null,1));\n  return out;"
if h.count(marker)!=1: raise SystemExit('harness marker')
insert=r'''  // ===== test37: ThrowDecision固定規則 =====
  (function(){
    const chk=[];
    try{
      newGame(); const f=fielders.find(x=>x.n==='遊');
      const manual=decideThrowTarget(f,{kind:'ground',manualTarget:'P'});
      chk.push({n:'手動投手返球はPのまま',ok:manual.nb==='P'&&manual.locked});
      const fly=decideThrowTarget(f,{kind:'fly',flyLead:{origin:3,mustReturn:true}});
      chk.push({n:'フライ帰塁先固定',ok:fly.nb===3&&fly.locked});
      const pick=decideThrowTarget(f,{kind:'pickoff',currentTarget:2});
      chk.push({n:'牽制は現在塁固定',ok:pick.nb===2&&pick.locked});
      const relay=decideThrowTarget(f,{kind:'ground',currentTarget:4,relayed:true});
      chk.push({n:'中継後は元送球先固定',ok:relay.nb===4&&relay.locked});
    }catch(e){chk.push({n:'例外',ok:false,e:e.message});}
    const bad=chk.filter(x=>!x.ok);
    out.test37_ThrowDecision固定規則={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

  // ===== test38: 同一可視状態なら捕球時/リリース時で同じ自動判断 =====
  (function(){
    let res={};
    try{
      newGame(); S.outs=0; S.preOuts=0;
      const r=makeRunner(0.35,1,0,26); r.obsDir=1; r.v=22; runners=[r];
      const f=fielders.find(x=>x.n==='遊');
      const a=decideThrowTarget(f,{kind:'ground'});
      const b=decideThrowTarget(f,{kind:'ground'});
      res={catchTarget:a.nb,releaseTarget:b.nb,verdict:a.nb===b.nb?'PASS':'FAIL'};
    }catch(e){res={verdict:'FAIL',e:e.message};}
    out.test38_ThrowDecision一貫性=res;
  })();

  // ===== test39: 手動P指定をtransfer中に一塁へ変換しない =====
  (function(){
    let res={};
    try{
      newGame(); S.half=1; manualThrow=null;
      throwPlay={stage:'transfer',target:2,decisionSource:'test',decisionSeq:1};
      setManualThrow('P');
      res={target:throwPlay.target,source:throwPlay.decisionSource,verdict:throwPlay.target==='P'?'PASS':'FAIL'};
      throwPlay=null; manualThrow=null;
    }catch(e){res={verdict:'FAIL',e:e.message};}
    out.test39_手動投手返球=res;
  })();

'''
h=h.replace(marker,insert+marker,1); H.write_text(h,encoding='utf-8')

g=G.read_text(encoding='utf-8')
anchor="""const failed=checks.filter(x=>!x.ok);\n"""
extra="""const throwWrites=count(/\\b(?:T|throwPlay)\\.target\\s*=(?!=)/g,clean);\ncheck('throw target has exactly one post-construction writer',throwWrites===1,throwWrites);\nconst setThrowBody=stripComments(extractFunction('setThrowTarget'));\ncheck('throw target writer lives in setThrowTarget',count(/\\bT\\.target\\s*=(?!=)/g,setThrowBody)===1,\n  (setThrowBody.match(/\\bT\\.target\\s*=(?!=)/g)||[]).length);\nconst chooseCalls=count(/\\bchooseThrowTarget\\s*\\(/g,clean);\ncheck('chooseThrowTarget is only definition plus ThrowDecision internals',chooseCalls===2,chooseCalls);\nconst decisionBody=stripComments(extractFunction('decideThrowTarget'));\ncheck('ThrowDecision owns automatic target selection',/chooseThrowTarget\\s*\\(/.test(decisionBody),'decision boundary');\nconst manualBody=stripComments(extractFunction('setManualThrow'));\ncheck('manual throw uses ThrowDecision writer',/setThrowTarget\\s*\\(/.test(manualBody)&&!/throwPlay\\.target\\s*=/.test(manualBody),'manual boundary');\ncheck('throw decision is recorded',/decisionSource/.test(script)&&/decisionSeq/.test(script),'decision audit');\nconst failed=checks.filter(x=>!x.ok);\n"""
if g.count(anchor)!=1: raise SystemExit('guard anchor')
g=g.replace(anchor,extra,1); G.write_text(g,encoding='utf-8')

d=D.read_text(encoding='utf-8')
d += """\n\n## Phase 5 — b0805-19 ThrowDecision\n\n- 捕球時・リリース時・追加送球の自動送球先を`decideThrowTarget`へ集約する。\n- `T.target`の後書きは`setThrowTarget`だけが行い、`decisionSource / decisionSeq`を録画へ残す。\n- 手動指定、フライ、盗塁、牽制、中継の固定ルールを同じ優先順位表へ置く。\n- 守備側の手動`P`指定が一塁へ変換される旧経路を廃止する。\n- architecture guardで`chooseThrowTarget`の直接呼び出しと第二の`T.target`書き手を禁止する。\n"""
D.write_text(d,encoding='utf-8')
print('patched b0805-19')
