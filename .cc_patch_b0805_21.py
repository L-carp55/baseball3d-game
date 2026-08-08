from pathlib import Path

HTML=Path('baseball3d.html'); H=Path('_test_harness_20260804.js'); G=Path('_architecture_guard_20260808.js'); D=Path('ARCHITECTURE_REMEDIATION_20260808.md')

def swap(s,a,b,label):
    n=s.count(a)
    if n!=1: raise SystemExit(f'{label}: expected 1 got {n}')
    return s.replace(a,b,1)

s=HTML.read_text(encoding='utf-8')
s=swap(s,"const BUILD = 'b0805-20';","const BUILD = 'b0805-21';",'build')

anchor="""function endRundown(text,color){
  const T=throwPlay;
  T.rdText=text; T.rdColor=color;
"""
new="""/* 挟殺中だけ使うloLim/hiLim（1.2,1.8等）は「逃げ幅」の仮目標であって塁ではない。
   挟殺が送球ミス等で終了する時、その仮goalを残して通常プレーへ戻すと、走者は塁間で
   p===goalのまま停止し、PlayLifecycleは正しく「未決着」と判定し続ける。
   終了時には、仮goalがどちら側の逃げ幅だったかから合法な塁(lo/hi)へ意図を清算する。 */
function settleRundownExitIntent(T){
  const R=T&&T.rd, r=R&&R.r;
  if(!R || !r || r.out) return null;
  if(Math.abs(r.goal-Math.round(r.goal))<0.01) return {runner:r,base:Math.round(r.goal),changed:false};
  const loGap=Math.abs(r.goal-R.loLim), hiGap=Math.abs(r.goal-R.hiLim);
  const base=clamp(loGap<=hiGap?R.lo:R.hi,0,4);
  setRunnerIntent(r,base,{source:'rundown-exit',force:true,updateAuto:true,cmd:null});
  r.extra=0;
  return {runner:r,base,changed:true};
}
function endRundown(text,color){
  const T=throwPlay;
  T.rdText=text; T.rdColor=color;
  const rundownExit=settleRundownExitIntent(T);
"""
s=swap(s,anchor,new,'insert settleRundownExitIntent')

old="""    const dir=runnerObservedDir(unsettled);
    const tgtBase = homing ? 4 : clamp(dir<0?Math.floor(unsettled.p):Math.ceil(unsettled.p),1,4);
"""
new2="""    const dir=runnerObservedDir(unsettled);
    const tgtBase = homing ? 4
      : (rundownExit && rundownExit.runner===unsettled ? rundownExit.base
      : clamp(dir<0?Math.floor(unsettled.p):Math.ceil(unsettled.p),1,4));
"""
s=swap(s,old,new2,'use resolved rundown exit base')
HTML.write_text(s,encoding='utf-8')

h=H.read_text(encoding='utf-8'); marker="  console.log(JSON.stringify(out,null,1));\n  return out;"
if h.count(marker)!=1: raise SystemExit('harness marker')
insert=r'''  // ===== test43: 挟殺終了時に仮の塁間goalを合法な塁へ清算 =====
  (function(){
    const chk=[];
    try{
      function runCase(p,g,loLim,hiLim,expected){
        newGame(); S.outs=0; S.preOuts=0; S.phase='throwing';
        const f=fielders.find(x=>x.n==='遊');
        const r=makeRunner(p,g,0,25); r.obsDir=0; r.v=0; runners=[r];
        ball={x:f.cx,y:f.cy,z:4.4,vx:0,vy:0,vz:0,landed:false};
        throwPlay={stage:'rundown',kind:'outfield',target:expected,thrower:f,receiver:f,t:0,
          transfer:0.2,fieldT:1,award:1,relayed:false,
          rd:{r,sub:'chase',holder:f,lo:1,hi:2,loLim,hiLim,t:1,rt:0,ex:2,fumble:true}};
        endRundown('送球がそれてセーフ！','#3fd66a');
        const out={goal:r.goal,source:r.intentSource,target:throwPlay&&throwPlay.target,stage:throwPlay&&throwPlay.stage};
        throwPlay=null; runners=[];
        return out;
      }
      const low=runCase(1.2,1.2,1.2,1.8,1);
      chk.push({n:'一塁側の仮goalは一塁へ',ok:low.goal===1&&low.source==='rundown-exit'&&low.target===1});
      const high=runCase(1.8,1.8,1.2,1.8,2);
      chk.push({n:'二塁側の仮goalは二塁へ',ok:high.goal===2&&high.source==='rundown-exit'&&high.target===2});
      newGame();
      const r=makeRunner(1.2,1.2,0,25); r.out=true;
      const keep=settleRundownExitIntent({rd:{r,lo:1,hi:2,loLim:1.2,hiLim:1.8}});
      chk.push({n:'アウト済み走者は変更しない',ok:keep===null&&r.goal===1.2});
    }catch(e){chk.push({n:'例外',ok:false,e:e.message});}
    const bad=chk.filter(x=>!x.ok);
    out.test43_挟殺終了goal清算={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

'''
h=h.replace(marker,insert+marker,1); H.write_text(h,encoding='utf-8')

g=G.read_text(encoding='utf-8')
anchor_g="""check('play lifecycle is recorded',/lifecycleSource/.test(script)&&/lifecycleSeq/.test(script)&&/lifecycleReason/.test(script),'lifecycle audit');
const failed=checks.filter(x=>!x.ok);
"""
extra="""check('play lifecycle is recorded',/lifecycleSource/.test(script)&&/lifecycleSeq/.test(script)&&/lifecycleReason/.test(script),'lifecycle audit');
const endRundownBody=stripComments(extractFunction('endRundown'));
check('endRundown settles temporary rundown intent',/settleRundownExitIntent\\s*\\(T\\)/.test(endRundownBody),'rundown exit boundary');
const settleBody=stripComments(extractFunction('settleRundownExitIntent'));
check('rundown exit writes legal base through RunnerIntent',/setRunnerIntent\\s*\\(/.test(settleBody)&&/R\\.lo/.test(settleBody)&&/R\\.hi/.test(settleBody),'legal base intent');
const failed=checks.filter(x=>!x.ok);
"""
if g.count(anchor_g)!=1: raise SystemExit('guard anchor')
g=g.replace(anchor_g,extra,1); G.write_text(g,encoding='utf-8')

d=D.read_text(encoding='utf-8')
d += """\n\n## Phase 6b — b0805-21 Rundown exit intent\n\n- 50試合固定seed検証で、挟殺中の仮`goal`（1.2/1.7等）が送球ミス後も残り、非アウト走者が塁間停止する4/50未終了を発見。\n- g2固定seed `0xdfb07ee1` で `goal 1 → 1.9 → 1.2`、最後の更新が`R.fumble=true / loLim=1.2 / hiLim=1.8`であることを実行追跡。\n- `settleRundownExitIntent`を追加し、挟殺終了時に仮の逃げ幅goalを対応する合法な塁`R.lo/R.hi`へRunnerIntent経由で清算する。\n- PlayLifecycleの「塁間では閉じない」契約は緩めない。走者自身を合法な塁へ動かして決着させる。\n"""
D.write_text(d,encoding='utf-8')
print('patched b0805-21')
