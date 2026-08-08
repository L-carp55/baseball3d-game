from pathlib import Path
import re

HTML=Path('baseball3d.html'); H=Path('_test_harness_20260804.js'); G=Path('_architecture_guard_20260808.js'); D=Path('ARCHITECTURE_REMEDIATION_20260808.md')

def swap(s,a,b,label,expected=1):
    n=s.count(a)
    if n!=expected: raise SystemExit(f'{label}: expected {expected}, got {n}')
    return s.replace(a,b) if expected!=1 else s.replace(a,b,1)

s=HTML.read_text(encoding='utf-8')
s=swap(s,"const BUILD = 'b0805-19';","const BUILD = 'b0805-20';",'build')

old="""    thr: throwPlay?{st:throwPlay.stage, to:throwPlay.target,\n      by:throwPlay.thrower?throwPlay.thrower.n:null, kind:throwPlay.kind,\n      ds:throwPlay.decisionSource||'legacy', dq:throwPlay.decisionSeq||0}:null,\n"""
new="""    thr: throwPlay?{st:throwPlay.stage, to:throwPlay.target,\n      by:throwPlay.thrower?throwPlay.thrower.n:null, kind:throwPlay.kind,\n      ds:throwPlay.decisionSource||'legacy', dq:throwPlay.decisionSeq||0,\n      ls:throwPlay.lifecycleSource||'legacy', lq:throwPlay.lifecycleSeq||0, lr:throwPlay.lifecycleReason||''}:null,\n"""
s=swap(s,old,new,'record lifecycle')

old="""  const flyWait = (T.kind==='fly' && runners.some(r=>!r.out && r.origin>0 && r.origin<4) && T.t<1.5);\n  const keyHeld = isPlayerBatting() && (held['s']||held['z']||held['x']);\n  const allSettled = runners.every(r=> r.out ||\n    (Math.abs(r.p-r.goal)<0.02 && Math.abs(r.p-Math.round(r.p))<0.02));\n  const midBase  = runners.some(r=>!r.out && Math.abs(r.p-Math.round(r.p))>=0.02);\n  const ballLive = !!(ball && !ball.land && ball.z>0.8);          // 送球がまだ空中\n  /* 歯止めが立っている間は打ち切りを延ばす。ただし無限には延ばさない（+8秒が上限）。 */\n  const grace = (midBase || keyHeld || ballLive) ? 8 : 0;\n  if(S.playClock > (inRundown?24:12) + grace){\n    if(inRundown) return endRundown('セーフ！','#3fd66a');\n    return concludePlay(true);   // 時間切れは門番を通さず強制確定（無限継続の歯止め）\n  }\n"""
new="""  const lifecycle=playLifecycleState();\n  const flyWait=lifecycle.flyDecision, keyHeld=lifecycle.keyHeld;\n  const allSettled=!lifecycle.unsettled, midBase=lifecycle.unsettled, ballLive=lifecycle.liveBall;\n  /* watchdogは終了を「要求」するだけで、ライブ送球・塁間走者・操作中の門番を迂回しない。\n     閉じられない時はreturnせず、そのフレームの捕球・回収・走塁処理を続ける。 */\n  const grace = (midBase || keyHeld || ballLive) ? 8 : 0;\n  if(S.playClock > (inRundown?24:12) + grace){\n    if(inRundown) return endRundown('セーフ！','#3fd66a');\n    if(requestPlayConclusion('watchdog')) return;\n  }\n"""
s=swap(s,old,new,'watchdog lifecycle')

# The local 8s chase watchdog must not stop catch/recovery work when closure is rejected.
old="    if(T.chased && T.t>8) return concludePlay();   // 収拾できなければプレーを閉じる\n"
new="    if(T.chased && T.t>8 && requestPlayConclusion('chase-watchdog')) return;\n"
s=swap(s,old,new,'chase watchdog')

# Route all remaining no-argument conclusion calls through the lifecycle gateway.
# At this point the force=true caller has already been removed above.
return_calls=s.count('return concludePlay();')
plain_calls=s.count('concludePlay();')-return_calls
if return_calls<1: raise SystemExit('no return conclude calls found')
s=s.replace('return concludePlay();',"return requestPlayConclusion('request');")
s=s.replace('concludePlay();',"requestPlayConclusion('request');")
if 'concludePlay(true)' in s: raise SystemExit('force conclude call remains')

anchor="""function flyOutLabel(T,nm){\n  return `${T.flyBy||nm}${(ball&&ball.flyKind)||'フライ'} アウト`;\n}\nfunction concludePlay(force){\n"""
insert="""function flyOutLabel(T,nm){\n  return `${T.flyBy||nm}${(ball&&ball.flyKind)||'フライ'} アウト`;\n}\n/* プレー終了の正本。終了要求側がそれぞれ独自に「もう終わった」と判断すると、\n   塁間・送球中・操作中・挟殺中を別々の経路が見落とす。ここでは見えているプレー状態を\n   一度だけ分類し、第三アウト以外は未解決条件が1つでもあれば終了させない。 */\nfunction playLifecycleState(){\n  const T=throwPlay;\n  const thirdOut=baseOuts()+countOuts()>=3;\n  const liveBall=!!(T && (T.stage==='fly' || (T.stage==='rundown' && T.rd && T.rd.sub==='relay')));\n  const goHeld=isPlayerBatting() && (held['s']||held['z']) && runners.some(r=>!r.out&&r.p<3.98);\n  const backHeld=isPlayerBatting() && held['x'] && runners.some(r=>!r.out &&\n    ((r.origin===0&&r.p>1.02)||(r.origin>0&&r.p>r.origin+0.02)));\n  const keyHeld=!!(goHeld||backHeld);\n  const unsettled=runners.some(r=>!r.out&&r.p<3.97&&\n    (Math.abs(r.p-Math.round(r.p))>=0.02 || Math.abs(r.p-r.goal)>=0.02));\n  const activeRundown=!!(T&&T.stage==='rundown'&&T.rd&&!T.rdText);\n  const flyDecision=!!(T&&T.kind==='fly'&&T.t<1.5&&runners.some(r=>!r.out&&r.origin>0&&r.origin<4));\n  const canClose=thirdOut || !(liveBall||keyHeld||unsettled||activeRundown||flyDecision);\n  return {thirdOut,liveBall,keyHeld,unsettled,activeRundown,flyDecision,canClose};\n}\nfunction requestPlayConclusion(source){\n  const T=throwPlay;\n  if(!T) return false;\n  const st=playLifecycleState();\n  T.lifecycleSource=source||'request';\n  T.lifecycleSeq=(T.lifecycleSeq||0)+1;\n  T.lifecycleReason=st.thirdOut?'third-out':(st.liveBall?'live-ball':(st.activeRundown?'rundown':\n    (st.keyHeld?'input':(st.flyDecision?'fly-window':(st.unsettled?'runner-unsettled':'settled')))));\n  if(!st.thirdOut && (st.liveBall||st.activeRundown||st.keyHeld||st.flyDecision)){\n    if(st.keyHeld) T.holdOpen=true;\n    return false;\n  }\n  const before=throwPlay;\n  concludePlay(false);\n  return !!before && !throwPlay;\n}\nfunction concludePlay(force){\n"""
s=swap(s,anchor,insert,'lifecycle insert')

# Ensure only gateway may call low-level concludePlay.
clean=re.sub(r'/\*[\s\S]*?\*/|//[^\n]*','',s)
uses=len(re.findall(r'\bconcludePlay\s*\(',clean))-1
if uses!=1: raise SystemExit(f'concludePlay external uses={uses}, expected 1')
if 'concludePlay(true)' in clean: raise SystemExit('force=true conclusion remains')
HTML.write_text(s,encoding='utf-8')

h=H.read_text(encoding='utf-8'); marker="  console.log(JSON.stringify(out,null,1));\n  return out;"
if h.count(marker)!=1: raise SystemExit('harness marker')
insert_tests=r'''  // ===== test40: ライブ送球中は終了しない（OI-213系） =====
  (function(){
    let res={};
    try{
      newGame(); S.outs=0; S.preOuts=0; runners=[]; S.phase='throwing';
      const f=fielders.find(x=>x.n==='遊');
      ball={x:0,y:0,z:8,vx:80,vy:20,vz:4,landed:false};
      throwPlay={stage:'fly',kind:'infield',target:1,thrower:f,receiver:f,t:3,fieldT:1,award:1,relayed:false};
      const st=playLifecycleState();
      const closed=requestPlayConclusion('test-live-ball');
      res={liveBall:st.liveBall,canClose:st.canClose,closed,stillLive:!!throwPlay,
        reason:throwPlay&&throwPlay.lifecycleReason,
        verdict:(st.liveBall===true&&st.canClose===false&&closed===false&&!!throwPlay&&throwPlay.lifecycleReason==='live-ball')?'PASS':'FAIL'};
      throwPlay=null;
    }catch(e){res={verdict:'FAIL',e:e.message};}
    out.test40_ライブ送球終了禁止=res;
  })();

  // ===== test41: 塁間は終了禁止、第三アウトだけ例外 =====
  (function(){
    const chk=[];
    try{
      newGame(); S.outs=0; S.preOuts=0;
      const f=fielders.find(x=>x.n==='遊');
      const r=makeRunner(1.5,2,1,25); r.obsDir=1; runners=[r];
      ball={x:f.cx,y:f.cy,z:4.4,vx:0,vy:0,vz:0,landed:false};
      throwPlay={stage:'transfer',kind:'infield',target:2,thrower:f,receiver:null,t:0,transfer:0.2,fieldT:1,award:1,relayed:false};
      const mid=playLifecycleState();
      chk.push({n:'塁間走者は終了不可',ok:mid.unsettled===true&&mid.canClose===false});
      S.outs=3; S.preOuts=0;
      const third=playLifecycleState();
      chk.push({n:'第三アウトは終了可',ok:third.thirdOut===true&&third.canClose===true});
      throwPlay=null; runners=[];
    }catch(e){chk.push({n:'例外',ok:false,e:e.message});}
    const bad=chk.filter(x=>!x.ok);
    out.test41_PlayLifecycle門番={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

'''
h=h.replace(marker,insert_tests+marker,1); H.write_text(h,encoding='utf-8')

g=G.read_text(encoding='utf-8')
old_guard="check('play lifecycle call ratchet <=10',concludeCalls<=10,concludeCalls);"
new_guard="check('concludePlay is callable only from PlayLifecycle gateway',concludeCalls===1,concludeCalls);"
if g.count(old_guard)!=1: raise SystemExit('old lifecycle guard')
g=g.replace(old_guard,new_guard,1)
anchor_guard="""check('throw decision is recorded',/decisionSource/.test(script)&&/decisionSeq/.test(script),'decision audit');\nconst failed=checks.filter(x=>!x.ok);\n"""
extra_guard="""check('throw decision is recorded',/decisionSource/.test(script)&&/decisionSeq/.test(script),'decision audit');\nconst lifecycleBody=stripComments(extractFunction('playLifecycleState'));\ncheck('PlayLifecycle blocks live throws',/T\\.stage==='fly'/.test(lifecycleBody)&&/liveBall/.test(lifecycleBody),'live throw gate');\ncheck('PlayLifecycle has third-out override',/canClose=thirdOut\\s*\\|\\|/.test(lifecycleBody),'third out');\nconst requestBody=stripComments(extractFunction('requestPlayConclusion'));\ncheck('PlayLifecycle gateway owns final conclusion',/playLifecycleState\\s*\\(/.test(requestBody)&&/concludePlay\\s*\\(false\\)/.test(requestBody),'gateway');\ncheck('force conclusion bypass removed',!/concludePlay\\s*\\(\\s*true\\s*\\)/.test(clean),'no force bypass');\nconst throwPhaseBody=stripComments(extractFunction('updateThrowPhase'));\ncheck('watchdog uses lifecycle gateway',/requestPlayConclusion\\s*\\('watchdog'\\)/.test(throwPhaseBody)&&!/concludePlay\\s*\\(/.test(throwPhaseBody),'watchdog gateway');\ncheck('play lifecycle is recorded',/lifecycleSource/.test(script)&&/lifecycleSeq/.test(script)&&/lifecycleReason/.test(script),'lifecycle audit');\nconst failed=checks.filter(x=>!x.ok);\n"""
if g.count(anchor_guard)!=1: raise SystemExit('guard insertion anchor')
g=g.replace(anchor_guard,extra_guard,1); G.write_text(g,encoding='utf-8')

d=D.read_text(encoding='utf-8')
d += """\n\n## Phase 6 — b0805-20 PlayLifecycle\n\n- 全てのプレー終了要求を`requestPlayConclusion`へ集約する。\n- `playLifecycleState`がライブ送球・塁間走者・有効な走塁入力・未決着挟殺・フライ判断猶予を一括判定する。\n- 第三アウトのみ未解決条件を上書きして即終了可能。\n- watchdogは`force=true`で門番を迂回せず、終了拒否時は同じフレームの回収・捕球・走塁処理を継続する。\n- 旧`ball.land`参照によるライブ送球判定を廃止し、送球stageからライブ状態を判断する。\n- `lifecycleSource / lifecycleSeq / lifecycleReason`を録画へ残す。\n"""
D.write_text(d,encoding='utf-8')
print(f'patched b0805-20; migrated return={return_calls}, plain={plain_calls}')
