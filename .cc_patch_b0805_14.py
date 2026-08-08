from pathlib import Path

HTML=Path('baseball3d.html')
HARNESS=Path('_test_harness_20260804.js')

def swap(text, old, new, label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    return text.replace(old,new,1)

html=HTML.read_text(encoding='utf-8')
html=swap(html,"const BUILD = 'b0805-13';","const BUILD = 'b0805-14';",'build')

# Recording: preserve the source/sequence of runner intent decisions and actual observed motion.
old="""    run: runners.filter(r=>!r.out||r.p<4).map(r=>
      `${r.origin}:${r2(r.p)}→${r2(r.goal)}${r.out?'X':''}${r.cmd||''}${r.mustReturn?'R':''}${r.tagUp?'T':''}`),
    fld: fielders.map(f=>`${f.n}${r2(f.cx)},${r2(f.cy)}${f.primary?'*':''}${f.coverBase!=null?('c'+f.coverBase):''}`)
"""
new="""    run: runners.filter(r=>!r.out||r.p<4).map(r=>
      `${r.origin}:${r2(r.p)}→${r2(r.goal)}${r.out?'X':''}${r.cmd||''}${r.mustReturn?'R':''}${r.tagUp?'T':''}`),
    intent: runners.filter(r=>!r.out||r.p<4).map(r=>
      `${r.origin}:${r.intentSource||'legacy'}#${r.intentSeq||0}:d${runnerObservedDir(r)}`),
    fld: fielders.map(f=>`${f.n}${r2(f.cx)},${r2(f.cy)}${f.primary?'*':''}${f.coverBase!=null?('c'+f.coverBase):''}`)
"""
html=swap(html,old,new,'record runner intent')
old="""    見方:'f=0.1秒ごとの状態 / run=\"元の塁:今位置→目標\" X=アウト S/X=操作 R=帰塁義務 T=タッチアップ / fld=\"位置x,y\" *=打球担当 c1=一塁カバー',
"""
new="""    見方:'f=0.1秒ごとの状態 / run=\"元の塁:今位置→目標\" X=アウト S/X=操作 R=帰塁義務 T=タッチアップ / intent=\"元の塁:決定元#更新番号:d実移動方向\" / fld=\"位置x,y\" *=打球担当 c1=一塁カバー',
"""
html=swap(html,old,new,'recording legend')

# Centralize runner construction and initialize observation/intent metadata.
old="""const RUN_SPEED = 1/90;                  // 1ft/秒あたりの塁進行。走力から出した速度を掛ける
function beginRunners(bases, mode){
"""
new="""const RUN_SPEED = 1/90;                  // 1ft/秒あたりの塁進行。走力から出した速度を掛ける
/* 走者の初期状態を一か所で作る。goal/autoGoal/観測方向の初期値が経路ごとにずれると、
   守備が存在しない移動を見たり、録画に決定元が残らない。 */
function makeRunner(p,goal,origin,sp){
  return {p,goal,autoGoal:goal,extra:0,origin,sp,obsDir:0,intentSource:'init',intentSeq:0};
}
/* 守備・判定が参照してよいのは、goalから推測した意図ではなく直前フレームの実移動方向だけ。
   goalを変えた瞬間に守備が走者の意図を先読みした OI-056 / Sol所見14 の構造を断つ。 */
function runnerObservedDir(r){
  return r.obsDir===1 ? 1 : (r.obsDir===-1 ? -1 : 0);
}
function beginRunners(bases, mode){
"""
html=swap(html,old,new,'runner helpers')
html=swap(html,
"""    runners.unshift({p:0, goal:1, autoGoal:1, extra:0, origin:0, sp:A.speed(bat.走)});
""",
"""    runners.unshift(makeRunner(0,1,0,A.speed(bat.走)));
""",'keep batter runner')
html=swap(html,
"""  runners = (mode==='noBatter') ? []
          : [{p:0, goal:1, autoGoal:1, extra:0, origin:0, sp:A.speed(bat.走)*rnd(0.94,1.0)}];   // 打者走者
""",
"""  runners = (mode==='noBatter') ? []
          : [makeRunner(0,1,0,A.speed(bat.走)*rnd(0.94,1.0))];   // 打者走者
""",'new batter runner')
html=swap(html,
"""  bases.forEach((b,i)=>{ const p=i+1+0.085;
    runners.push(b?{p, goal:p, autoGoal:p, extra:0, origin:i+1, sp:(b.sp||21)}:null); });
""",
"""  bases.forEach((b,i)=>{ const p=i+1+0.085;
    runners.push(b?makeRunner(p,p,i+1,(b.sp||21)):null); });
""",'base runners')

# Actual motion observation is updated only after p really changes.
old="""  runners.forEach(r=>{
    // 挟まれた走者は左右を見ながらなので全速では走れない
    const top=(r.sp||23)*(r===trapped?0.86:1), acc=top/ACC_T;
    r.dir = r.p<r.goal-1e-6 ? 1 : (r.p>r.goal+1e-6 ? -1 : 0);   // 守備が見て分かる「走っている向き」
    if(r.p < r.goal){
"""
new="""  runners.forEach(r=>{
    // 挟まれた走者は左右を見ながらなので全速では走れない
    const top=(r.sp||23)*(r===trapped?0.86:1), acc=top/ACC_T;
    const pBefore=r.p;
    r.dir = r.p<r.goal-1e-6 ? 1 : (r.p>r.goal+1e-6 ? -1 : 0);   // 走者を動かす内部方向（守備は読まない）
    if(r.p < r.goal){
"""
html=swap(html,old,new,'update runners start')
old="""      r.v=Math.max(0,(r.v||0) - (top/ACC_T)*2.2*dt);
    }
  });
}
"""
new="""      r.v=Math.max(0,(r.v||0) - (top/ACC_T)*2.2*dt);
    }
    const dp=r.p-pBefore;
    r.obsDir = dp>1e-8 ? 1 : (dp<-1e-8 ? -1 : 0);
  });
}
"""
html=swap(html,old,new,'update runners observed direction')

# Remove unused helper that still encoded defense decisions through goal.
old="""function leadForceTarget(){
  let best=null;
  runners.forEach(r=>{
    if(r.out || r.p>=r.goal) return;
    if(!isForced(r)) return;
    const nb=Math.min(4, r.origin+1);
    if(!best || nb>best.nb) best={nb, r};
  });
  return best;
}
"""
html=swap(html,old,'','remove unused goal-based defense helper')

# Defense must use observed motion and actual position, not internal goal/cmd.
html=swap(html,
"""  const trail=runners.filter(r=>!r.out && r.goal<3.99 && r.p<2.95)
""",
"""  const trail=runners.filter(r=>!r.out && r.p<2.95)
""",'containment no goal')
html=swap(html,
"""  const live=runners.filter(r=>!r.out && (
    r.dir>0 || (r.origin===0 && r.p<1) || (r.origin>0 && isForced(r) && r.p<r.origin+1)));
""",
"""  const live=runners.filter(r=>!r.out && (
    runnerObservedDir(r)>0 || (r.origin===0 && r.p<1) || (r.origin>0 && isForced(r) && r.p<r.origin+1)));
""",'choose target live direction')
html=swap(html,
"""  const back=runners.filter(r=>!r.out && r.dir<0 && Math.abs(r.p-Math.round(r.p))>0.06);
""",
"""  const back=runners.filter(r=>!r.out && runnerObservedDir(r)<0 && Math.abs(r.p-Math.round(r.p))>0.06);
""",'choose target back direction')
html=swap(html,
"""      const sprinting = r.dir>0 && (r.v||0) > 0.6*(r.sp||24);
""",
"""      const sprinting = runnerObservedDir(r)>0 && (r.v||0) > 0.6*(r.sp||24);
""",'choose target sprinting direction')
html=swap(html,
"""    const cand=runners.filter(r=>!r.out && r.p<b && r.p>b-1.001 && r.dir>0).sort((x,y)=>y.p-x.p)[0];
""",
"""    const cand=runners.filter(r=>!r.out && r.p<b && r.p>b-1.001 && runnerObservedDir(r)>0).sort((x,y)=>y.p-x.p)[0];
""",'steal observed direction')
html=swap(html,
"""      const goingOn = runners.find(r=>!r.out && r.p>b-0.02 && r.p<b+0.999 && r.goal>b+0.02);
""",
"""      const goingOn = runners.find(r=>!r.out && r.p>b-0.02 && r.p<b+0.999 && runnerObservedDir(r)>0);
""",'steal continuation observed direction')
html=swap(html,
"""      const tagger = runners.filter(r=>!r.out && !r.mustReturn && r.p<b && r.p>b-1.001 && r.dir>0)
""",
"""      const tagger = runners.filter(r=>!r.out && !r.mustReturn && r.p<b && r.p>b-1.001 && runnerObservedDir(r)>0)
""",'fly tag observed direction')
html=swap(html,
"""  const cand = runners.filter(r=>!r.out && r.p<b && r.p>b-1.001 &&
                 (r.dir>0 || (r.origin===0 && b===1) || (r.origin>0 && isForced(r) && b===r.origin+1)))
""",
"""  const cand = runners.filter(r=>!r.out && r.p<b && r.p>b-1.001 &&
                 (runnerObservedDir(r)>0 || (r.origin===0 && b===1) || (r.origin>0 && isForced(r) && b===r.origin+1)))
""",'ground observed direction')

# Early steal is a rule decision and goes through the intent API.
html=swap(html,
"""        r.goal=Math.min(4, r.origin+1); r.jumped=true;
""",
"""        setRunnerIntent(r,Math.min(4,r.origin+1),{source:'steal',force:true,updateAuto:true}); r.jumped=true;
""",'early steal goal')

# One selection predicate for all runner types, including the batter-runner.
old="""  const picked = pickBase ? live.find(r=>Math.floor(r.p+1e-9)===pickBase || r.origin===pickBase) : null;
  /* 高く上がって捕られそうな打球が飛んでいる間、Sは「タッチアップの構え」を意味する。
"""
new="""  const picked = pickBase ? live.find(r=>Math.floor(r.p+1e-9)===pickBase || r.origin===pickBase) : null;
  const selected = r => runnerSelectedForCommand(r,leadOnly,lead,picked);
  /* 高く上がって捕られそうな打球が飛んでいる間、Sは「タッチアップの構え」を意味する。
"""
html=swap(html,old,new,'selection predicate')
old="""    live.forEach(r=>{
      if(r.origin>=4) return;
      /* 打者走者にタッチアップは無い（アウトになるのは自分の捕球）。フライの間も
"""
new="""    live.forEach(r=>{
      if(r.origin>=4 || !selected(r)) return;
      /* 選択門番は打者走者の特別処理より先に通す。以前は打者走者だけ門番の前で
         goalを書き換え、Z・1〜3キーで別走者を選んでも巻き込んでいた（OI-088/152/165）。 */
      /* 打者走者にタッチアップは無い（アウトになるのは自分の捕球）。フライの間も
"""
html=swap(html,old,new,'tag phase selection before batter')
html=swap(html,
"""        r.goal=Math.max(here, Math.min(here+1, max, 4)); r.cmd='S';
""",
"""        setManualGoal(r,Math.max(here,Math.min(here+1,max,4)),'S');
""",'tag phase batter manual goal')
html=swap(html,
"""      if(leadOnly && r!==lead) return;            // Zは先頭の走者だけ
      if(picked && r!==picked) return;            // 塁を指定した時はその走者だけ
""",
"""      // 選択門番は上で全走者共通に適用済み
""",'remove late tag selection guards')
html=swap(html,
"""      r.goal = Math.max(here, Math.min(here+1, max, 4));
      r.cmd='S';
""",
"""      setManualGoal(r,Math.max(here,Math.min(here+1,max,4)),'S');
""",'normal advance manual goal')
html=swap(html,
"""      r.goal = Math.min(4, Math.max(here, min));
      r.cmd='X';
""",
"""      setManualGoal(r,Math.min(4,Math.max(here,min)),'X');
""",'normal retreat manual goal')

# Replace the legacy setter with the first single-writer API and shared selection helper.
old="""/* 自動の到達塁。ただし自分でS/Xを押した走者は、その指示のとおりに止まる
   （自動の追加進塁を上乗せしない）。1回押したら1つだけ、が分かりやすいため。
   指示は塁に着いた時点で消えるので、その後はまた自動に従う。 */
function setAutoGoal(r,g,force){
  r.autoGoal=g;
  // force=無条件に与えられる進塁（本塁打・四球・フライ後の帰塁）は手動指示より優先する
  if(!force && r.cmd) return;
  r.goal=g;
}
"""
new="""/* 走者の行き先を変更する最初の単一書き手API。
   Phase 1では自動・手動操作をここへ集約し、残る規則/結果経路は後続PRで順次移す。
   source/intentSeqを録画へ残すことで、後段の黙った上書きを一次証拠から特定できる。 */
function setRunnerIntent(r,g,opt){
  const o=opt||{}, goal=clamp(g,0,4), source=o.source||'auto';
  if(o.updateAuto!==false) r.autoGoal=goal;
  // 通常の自動判断は明示的なS/Xを上書きしない。規則・結果のforceだけが優先できる。
  if(source==='auto' && !o.force && r.cmd) return false;
  r.goal=goal;
  if(Object.prototype.hasOwnProperty.call(o,'cmd')) r.cmd=o.cmd;
  r.intentSource=source;
  r.intentSeq=(r.intentSeq||0)+1;
  return true;
}
function setAutoGoal(r,g,force){
  return setRunnerIntent(r,g,{source:'auto',force:!!force,updateAuto:true});
}
function setManualGoal(r,g,cmd){
  return setRunnerIntent(r,g,{source:'manual',force:true,updateAuto:false,cmd});
}
function runnerSelectedForCommand(r,leadOnly,lead,picked){
  if(leadOnly && r!==lead) return false;
  if(picked && r!==picked) return false;
  return true;
}
"""
html=swap(html,old,new,'runner intent API')

# Reuse the shared selection rule in normal advance/retreat too.
html=swap(html,
"""      if(leadOnly && r!==lead) continue;   // Zは先頭の走者だけ
      if(picked && r!==picked) continue;   // 1〜3キーで塁を指定した時はその走者だけ
""",
"""      if(!runnerSelectedForCommand(r,leadOnly,lead,picked)) continue;
""",'normal advance shared selection')
html=swap(html,
"""      if(picked && r!==picked) continue;   // 塁を指定した時はその走者だけ戻す
""",
"""      if(!runnerSelectedForCommand(r,false,lead,picked)) continue;
""",'normal retreat shared selection')

# A runner already settled on an integer base is not a live chase merely because it moved there this frame.
html=swap(html,
"""  const chase = runners.find(r=>!r.out && r.p < r.goal-0.15 && r.p < 3.98);
""",
"""  const chase = runners.find(r=>!r.out && runnerObservedDir(r)>0 && r.p < 3.98 &&
    Math.abs(r.p-Math.round(r.p))>0.02);
""",'judge chase observed motion')

HTML.write_text(html,encoding='utf-8')

# Harness tests 28-29.
h=HARNESS.read_text(encoding='utf-8')
# Legacy fixtures that intentionally model a moving runner now declare the observed direction explicitly.
h=h.replace("v:20,dir:1,cmd:'S'","v:20,dir:1,obsDir:1,cmd:'S'")
h=h.replace("autoGoal:4,dir:1,v:23","autoGoal:4,dir:1,obsDir:1,v:23")
h=h.replace("autoGoal:1,dir:0,v:0","autoGoal:1,dir:0,obsDir:0,v:0")
marker="  console.log(JSON.stringify(out,null,1));\n  return out;"
if h.count(marker)!=1:
    raise SystemExit(f'harness marker count {h.count(marker)}')
insert=r'''  // ===== test28: 高い飛球で個別選択が打者走者へ漏れない（OI-088 / OI-152 / OI-165） =====
  (function(){
    const chk=[];
    const keys=['s','z','x','1','2','3'];
    const clear=()=>keys.forEach(k=>held[k]=false);
    const rr=(origin,p,goal)=>({origin,p,goal,autoGoal:goal,extra:0,sp:23,v:0,obsDir:0,out:false,intentSource:'fixture',intentSeq:0});
    const setup=()=>{ newGame(); S.outs=0; S.preOuts=0; S.phase='flight';
      ball={landed:false,canCatchAir:true,maxZ:30,z:18,vz:-8,t:1}; clear(); };
    try{
      setup();
      const batter=rr(0,1.00,1), lead=rr(2,2.40,3); runners=[batter,lead]; held['z']=true;
      applyRunnerKeys();
      chk.push({n:'Zで先頭だけ・打者不変',ok:batter.goal===1&&lead.tagUp===true});

      setup();
      const b1=rr(0,0.20,1), first=rr(1,1.08,1), third=rr(3,3.08,3);
      runners=[b1,first,third]; held['1']=true; held['s']=true; applyRunnerKeys();
      chk.push({n:'1+Sで一塁走者だけ',ok:b1.goal===1&&Math.abs(first.goal-1.45)<1e-9&&third.goal===3});

      setup();
      const b2=rr(0,0.20,1), first2=rr(1,1.08,1), third2=rr(3,3.08,3);
      runners=[b2,first2,third2]; held['3']=true; held['s']=true; applyRunnerKeys();
      chk.push({n:'3+Sで三塁走者だけ',ok:b2.goal===1&&first2.goal===1&&third2.goal===3&&third2.tagUp===true});
    }catch(e){ chk.push({n:'例外',ok:false,e:e.message}); }
    finally{ clear(); }
    const bad=chk.filter(x=>!x.ok);
    out.test28_個別走者選択={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

  // ===== test29: 守備判断は走者の内部goalではなく実移動方向を見る（OI-056 / Sol所見14） =====
  (function(){
    const chk=[];
    try{
      function pick(goal,legacyDir){
        newGame(); S.outs=0; S.preOuts=0;
        const r={origin:2,p:2.42,goal,autoGoal:goal,obsDir:1,dir:legacyDir,v:18,sp:23,out:false};
        runners=[r];
        const f=fielders.find(x=>x.n==='中'); f.cx=0; f.cy=180;
        const oldTE=window.throwETAof, oldRE=window.runnerETA, oldRB=window.runnerBackETA;
        try{
          window.throwETAof=()=>0.40; window.runnerETA=()=>1.20; window.runnerBackETA=()=>0.10;
          const x=chooseThrowTarget(f); return x&&x.nb;
        }finally{ window.throwETAof=oldTE; window.runnerETA=oldRE; window.runnerBackETA=oldRB; }
      }
      const a=pick(3,1), b=pick(2,-1);
      chk.push({n:'goalだけ変えても送球先不変',ok:a===3&&b===3});

      newGame();
      const r={origin:2,p:2.20,goal:3,autoGoal:3,obsDir:0,dir:1,v:18,sp:23,out:false}; runners=[r];
      updateRunners(1/60); const forward=runnerObservedDir(r);
      setManualGoal(r,2,'X'); const beforeMove=runnerObservedDir(r);
      updateRunners(1/60); const afterMove=runnerObservedDir(r);
      chk.push({n:'goal変更だけでは観測方向が反転しない',ok:forward===1&&beforeMove===1&&afterMove===-1});
    }catch(e){ chk.push({n:'例外',ok:false,e:e.message}); }
    const bad=chk.filter(x=>!x.ok);
    out.test29_守備と走者意図の分離={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

'''
h=h.replace(marker,insert+marker,1)
HARNESS.write_text(h,encoding='utf-8')
print('patched b0805-14')
