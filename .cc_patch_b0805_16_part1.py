from pathlib import Path

ROOT=Path('.')
HTML=ROOT/'baseball3d.html'
HARNESS=ROOT/'_test_harness_20260804.js'
GUARD=ROOT/'_architecture_guard_20260808.js'
WORKFLOW=ROOT/'.github/workflows/baseball3d-regression.yml'
DOC=ROOT/'ARCHITECTURE_REMEDIATION_20260808.md'

def swap(text, old, new, label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1, got {n}')
    return text.replace(old,new,1)

html=HTML.read_text(encoding='utf-8')
html=swap(html,"const BUILD = 'b0805-15';","const BUILD = 'b0805-16';",'build')

# Recording: preserve role assignment provenance.
old="""    intent: runners.filter(r=>!r.out||r.p<4).map(r=>
      `${r.origin}:${r.intentSource||'legacy'}#${r.intentSeq||0}:d${runnerObservedDir(r)}`),
    fld: fielders.map(f=>`${f.n}${r2(f.cx)},${r2(f.cy)}${f.primary?'*':''}${f.coverBase!=null?('c'+f.coverBase):''}`)
"""
new="""    intent: runners.filter(r=>!r.out||r.p<4).map(r=>
      `${r.origin}:${r.intentSource||'legacy'}#${r.intentSeq||0}:d${runnerObservedDir(r)}`),
    fld: fielders.map(f=>`${f.n}${r2(f.cx)},${r2(f.cy)}${f.primary?'*':''}${f.coverBase!=null?('c'+f.coverBase):''}`),
    role: fielders.map(f=>`${f.n}:${f.roleSource||'legacy'}#${f.roleSeq||0}`)
"""
html=swap(html,old,new,'record fielding roles')
old="""    見方:'f=0.1秒ごとの状態 / run=\"元の塁:今位置→目標\" X=アウト S/X=操作 R=帰塁義務 T=タッチアップ / intent=\"元の塁:決定元#更新番号:d実移動方向\" / fld=\"位置x,y\" *=打球担当 c1=一塁カバー',
"""
new="""    見方:'f=0.1秒ごとの状態 / run=\"元の塁:今位置→目標\" X=アウト S/X=操作 R=帰塁義務 T=タッチアップ / intent=\"元の塁:決定元#更新番号:d実移動方向\" / fld=\"位置x,y\" *=打球担当 c1=一塁カバー / role=\"野手:役割変更元#更新番号\"',
"""
html=swap(html,old,new,'record role legend')

# Fielders carry one assignment record from construction onward.
old="""      cx:h.x, cy:h.y, tx:h.x, ty:h.y, primary:false, run:0, face:0, v:0};
"""
new="""      cx:h.x, cy:h.y, tx:h.x, ty:h.y, primary:false, coverBase:null,
      roleSource:'init', roleSeq:0, run:0, face:0, v:0};
"""
html=swap(html,old,new,'fielder role metadata')
old="""let S, ball=null, fielders=[], runners=[], pitch=null, throwAnim=null;
"""
new="""let S, ball=null, fielders=[], runners=[], pitch=null, throwAnim=null;
let FIELD_ASSIGN_SEQ=0;
"""
html=swap(html,old,new,'assignment sequence')

# Insert the single assignment API after setTarget.
old="""function setTarget(f,x,y){ const p=clampField(x,y); f.tx=p[0]; f.ty=p[1]; }
function moveFielders(dt, running){
"""
new="""function setTarget(f,x,y){ const p=clampField(x,y); f.tx=p[0]; f.ty=p[1]; }
/* 守備役割の唯一の書き手群。primaryとcoverBaseを別々の場面コードから変更すると、
   旧役割が消えたり、一人が二役になったり、担当表示と捕球判定が食い違う。
   roleSource/roleSeqを録画へ残し、役割変更を原子的に追跡できるようにする。 */
function markFieldRole(f,source){
  if(!f) return;
  f.roleSource=source||'assignment';
  f.roleSeq=++FIELD_ASSIGN_SEQ;
}
function clearCoverRole(f,source){
  if(!f) return null;
  const old=f.coverBase==null?null:f.coverBase;
  if(old!=null){
    f.coverBase=null;
    markFieldRole(f,source||'cover-clear');
  }
  return old;
}
function assignCoverRole(f,base,source){
  if(!f || f.primary) return false;
  if(f.coverBase!=null && f.coverBase!==base) return false;
  f.coverBase=base;
  markFieldRole(f,source||'cover');
  const p=throwPoint(base); setTarget(f,p[0],p[1]);
  return true;
}
function clearAllCoverRoles(source){
  fielders.forEach(f=>clearCoverRole(f,source||'cover-reset'));
}
function setPrimaryFielder(next,source,target){
  const previous=ball?ball.primary:null;
  const freed=next?clearCoverRole(next,(source||'primary')+'-leave-cover'):null;
  if(ball) ball.primary=next||null;
  fielders.forEach(f=>{ f.primary=(f===next); });
  if(next){
    markFieldRole(next,source||'primary');
    if(target) setTarget(next,target[0],target[1]);
  }
  return {previous,changed:previous!==next,freed};
}
function clearFieldingAssignments(source){
  setPrimaryFielder(null,source||'assignment-reset');
  clearAllCoverRoles(source||'assignment-reset');
}
function findCoverCandidate(base,excluded){
  const ex=new Set((excluded||[]).filter(Boolean)), p=throwPoint(base);
  let same=null,free=null,sd=1e9,fd=1e9;
  fielders.forEach(f=>{
    if(ex.has(f) || f.primary) return;
    if(f.coverBase!=null && f.coverBase!==base) return;
    const d=Math.hypot(p[0]-f.cx,p[1]-f.cy);
    if(f.coverBase===base){ if(d<sd){sd=d;same=f;} }
    else if(d<fd){fd=d;free=f;}
  });
  return same||free;
}
/* 中継などの一時役割へ野手を出す時、元のカバーを先に別野手へ移す。
   代役がいなければ元担当を維持し、塁を無人にしてまで引き抜かない。 */
function releaseCoverForTemporaryRole(f,source,excluded){
  if(!f || f.primary) return false;
  const old=f.coverBase==null?null:f.coverBase;
  if(old==null) return true;
  const replacement=findCoverCandidate(old,[f,...(excluded||[])]);
  if(!replacement) return false;
  clearCoverRole(f,(source||'temporary')+'-release');
  if(replacement.coverBase!==old)
    assignCoverRole(replacement,old,(source||'temporary')+'-replacement');
  return true;
}
function moveFielders(dt, running){
"""
html=swap(html,old,new,'fielding assignment API')
