from pathlib import Path
import re, subprocess, tempfile

HTML=Path('baseball3d.html')
HARNESS=Path('_test_harness_20260804.js')
html=HTML.read_text(encoding='utf-8')


def once(old,new,label):
    global html
    n=html.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 match, got {n}')
    html=html.replace(old,new,1)

once("const BUILD = 'b0805-12';","const BUILD = 'b0805-13';",'build')

old="""function catchDiveAmount(d2, grabR){
  return clamp((d2-CATCH_R)/Math.max(0.1, grabR-CATCH_R), 0, 1);
}
"""
new=old+"""/* ゴロの横っ跳び量。捕球可否は球の高さも見るが、身体を横へ投げ出す必要があるかは
   水平方向の不足だけで決める。バウンドが高いだけで足元へスライディングする OI-243 を防ぐ。 */
function groundDiveAmount(d2, gz, grabR){
  if(d2<=CATCH_R) return 0;                  // 普通にグラブが届く横距離なら倒れ込まない
  const stretch=d2/Math.max(0.1,grabR);
  return stretch>0.75 ? clamp((stretch-0.75)*3,0.3,1) : 0;
}
"""
once(old,new,'ground dive helper')

old="""  if(grounded && !prim.fumbled && ball.t<6.5){
    /* ゴロも捕球圏の外縁で捕った時は横っ跳びの見た目を付ける */
    const stretch = Math.hypot(d2,gz)/Math.max(0.1, CATCH_R+diveReach(prim)*0.5);
    if(stretch>0.75){ prim.diveT=0.7; prim.diveAmt=clamp((stretch-0.75)*3,0.3,1); }
"""
new="""  if(grounded && !prim.fumbled && ball.t<6.5){
    /* ゴロの飛び込みは横方向に本当に届かない時だけ。高さ(gz)を混ぜると、
       真正面の大きなバウンドでも「遠い」と誤認して不要なスライディングになる。 */
    const groundGrabR=CATCH_R+diveReach(prim)*0.5;
    const groundDive=groundDiveAmount(d2,gz,groundGrabR);
    if(groundDive>0){ prim.diveT=0.7; prim.diveAmt=groundDive; }
"""
once(old,new,'ground dive call')

# Replace pitcherPose with a timing-correct delivery: ball release happens at pitch phase transition.
pat=r"function pitcherPose\(\)\{.*?\n\}\n/\* 影は"
m=re.search(pat,html,re.S)
if not m: raise SystemExit('pitcherPose block not found')
new_pitch=r'''/* 投球フォームの基準ポーズ。k=0 は始動、0.35=最大膝上げ、0.62=踏み出し足接地、
   0.80=リリース、1=フォロースルー。投球の一般的な運動連鎖
   （膝上げ→ストライド/足接地→コッキング→加速/リリース→減速）を時間軸に合わせる。 */
function pitcherPoseK(k){
  k=clamp(k,0,1);
  if(k<0.35){
    const u=k/0.35;
    return {armL:0.5-1.5*u, armR:0.4-1.1*u, elbowL:0.4+0.5*u, elbowR:0.5+0.6*u,
            legL:-1.7*u, legR:0.15*u, kneeL:1.5*u, kneeR:0.15,
            lean:-0.12*u, crouch:0.12*u, turn:-0.55*u, stride:0};
  }
  if(k<0.62){
    const u=(k-0.35)/0.27;
    return {armL:-1.0+0.7*u, armR:-0.7-2.0*u, elbowL:0.9-0.4*u, elbowR:1.1+0.7*u,
            legL:-1.7+2.5*u, legR:0.15+0.40*u, kneeL:1.5-1.2*u, kneeR:0.15+0.25*u,
            lean:-0.12+0.42*u, crouch:0.12+0.30*u, turn:-0.55+0.45*u, stride:3.4*u};
  }
  const u=(k-0.62)/0.38;
  return {armL:-0.3+1.0*u, armR:-2.7+3.6*u, elbowL:0.5, elbowR:Math.max(0.1,1.8-3.2*u),
          legL:0.8+0.4*u, legR:0.55-1.0*u, kneeL:0.3, kneeR:0.4+0.5*u,
          lean:0.30+0.30*u, crouch:0.42-0.16*u, turn:-0.10+0.55*u, stride:3.4+2.0*u};
}
function blendPitchPose(a,b,t){
  const o={};
  const keys=new Set([...Object.keys(a),...Object.keys(b)]);
  keys.forEach(k=>o[k]=lerp(a[k]===undefined?0:a[k],b[k]===undefined?0:b[k],t));
  return o;
}
const PITCH_RELEASE_K=0.80;
function pitcherPose(){
  /* launchPitch() へ切り替わった瞬間、球はすでに手を離れて pitchPos(0) から飛び始める。
     旧実装はその時点の身体が k=0.55（まだストライド中）で、球だけ先に飛び、
     その後に腕を振っていた。OI-245 の「人間と全然違う」見え方の構造的原因。 */
  if(anim.wind>=0 && S.phase==='windup'){
    const u=clamp(anim.wind/0.85,0,1);
    return pitcherPoseK(PITCH_RELEASE_K*u);       // windup の終端をリリース姿勢へ合わせる
  }
  if(S.phase==='pitch' && pitch){
    const e=clamp(pitch.t,0,1);
    if(e<0.38){
      const u=e/0.38;
      return pitcherPoseK(PITCH_RELEASE_K+(1-PITCH_RELEASE_K)*u); // リリース直後の減速
    }
    /* ボールが飛んでいる間ずっと極端なフォロースルーで凍らず、上体を起こして守備へ備える。 */
    const u=clamp((e-0.38)/0.50,0,1);
    const follow=pitcherPoseK(1);
    const settle={armL:0.38,armR:0.58,elbowL:0.55,elbowR:0.45,
      legL:0.18,legR:-0.30,kneeL:0.20,kneeR:0.62,
      lean:0.24,crouch:0.10,turn:0.18,stride:5.0};
    return blendPitchPose(follow,settle,u);
  }
  return null;
}
/* 影は'''
html=html[:m.start()]+new_pitch+html[m.end():]

HTML.write_text(html,encoding='utf-8')

h=HARNESS.read_text(encoding='utf-8')
marker="  console.log(JSON.stringify(out,null,1));\n"
if h.count(marker)!=1: raise SystemExit('harness marker mismatch')
insert=r'''  // ===== test25: 二塁カバーは実際に割り当てられ塁へ到達する（OI-248精査） =====
  (function(){
    let res={};
    try{
      newGame(); S.outs=2; S.bases=[null,null,{id:1,sp:23}];
      startFlight({exit:82,la:12,spray:25,q:0.8},1,[0,2.5,1.4]);
      const c2=fielders.find(f=>f.coverBase===2), p=throwPoint(2);
      if(c2){ for(let i=0;i<240;i++) moveFielders(1/60,true); }
      const gap=c2?Math.hypot(c2.cx-p[0],c2.cy-p[1]):99;
      const rf=fielders.find(f=>f.n==='右');
      const recv=c2?coverOf(2,rf):null;
      res={cover:c2&&c2.n,gap:+gap.toFixed(2),receiver:recv&&recv.n,
        verdict:(c2&&gap<2&&recv===c2)?'PASS':'FAIL'};
    }catch(e){ res={verdict:'FAIL',e:e.message}; }
    out.test25_二塁カバー実体=res;
  })();

  // ===== test26: 高いバウンドだけで不要なスライディングをしない（OI-243） =====
  (function(){
    const chk=[];
    try{
      chk.push({n:'真正面の高バウンドは飛び込まない',ok:groundDiveAmount(4.0,2.0,5.75)===0});
      chk.push({n:'通常グラブ圏内は飛び込まない',ok:groundDiveAmount(4.4,0.0,6.5)===0});
      chk.push({n:'横に本当に遠い球は飛び込む',ok:groundDiveAmount(6.0,0.0,7.0)>0});
    }catch(e){ chk.push({n:'例外',ok:false,e:e.message}); }
    const bad=chk.filter(x=>!x.ok);
    out.test26_ゴロ不要ダイブ={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

  // ===== test27: 投球動作とボールリリースの時系列（OI-245） =====
  (function(){
    const chk=[];
    try{
      newGame();
      S.phase='windup'; anim.wind=0.85;
      const releaseBefore=pitcherPose();
      S.phase='pitch'; pitch={t:0};
      const releaseAfter=pitcherPose();
      chk.push({n:'投球開始時にはリリース姿勢',ok:releaseBefore.stride>4&&releaseBefore.elbowR<0.8});
      chk.push({n:'球が離れる境界で姿勢が連続',ok:Math.abs(releaseBefore.stride-releaseAfter.stride)<0.05&&Math.abs(releaseBefore.armR-releaseAfter.armR)<0.05});
      pitch.t=0.38; const follow=pitcherPose();
      chk.push({n:'リリース後にフォロースルー',ok:follow.armR>0.5&&follow.lean>0.5});
      pitch.t=0.88; const settle=pitcherPose();
      chk.push({n:'球の飛行中に守備姿勢へ復帰',ok:settle.crouch<0.18&&settle.lean<0.36});
    }catch(e){ chk.push({n:'例外',ok:false,e:e.message}); }
    const bad=chk.filter(x=>!x.ok);
    out.test27_投球モーション時系列={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

'''
h=h.replace(marker,insert+marker,1)
HARNESS.write_text(h,encoding='utf-8')

# Syntax checks: extract the game script and check both JS files.
src=HTML.read_text(encoding='utf-8')
mm=re.search(r'<script>\s*"use strict";(.*?)</script>',src,re.S)
if not mm: raise SystemExit('game script extraction failed')
with tempfile.NamedTemporaryFile('w',suffix='.js',delete=False,encoding='utf-8') as f:
    f.write('"use strict";'+mm.group(1)); name=f.name
for p in [name,str(HARNESS)]:
    r=subprocess.run(['node','--check',p],capture_output=True,text=True)
    if r.returncode: raise SystemExit(r.stderr)
print('b0805-13 patch syntax PASS')
