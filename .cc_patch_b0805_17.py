from pathlib import Path

HTML=Path('baseball3d.html')
HARNESS=Path('_test_harness_20260804.js')
GUARD=Path('_architecture_guard_20260808.js')
DOC=Path('ARCHITECTURE_REMEDIATION_20260808.md')
WORKFLOW=Path('.github/workflows/baseball3d-regression.yml')

def swap(text,old,new,label):
    n=text.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 got {n}')
    return text.replace(old,new,1)

html=HTML.read_text(encoding='utf-8')
html=swap(html,"const BUILD = 'b0805-16';","const BUILD = 'b0805-17';",'build')
old="""function runTime(v,d){
  const dAcc = 0.5*v*ACC_F;
  return d<=dAcc ? Math.sqrt(2*d*ACC_F/v) : ACC_F/2 + d/v;
}

"""
new="""function runTime(v,d){
  const dAcc = 0.5*v*ACC_F;
  return d<=dAcc ? Math.sqrt(2*d*ACC_F/v) : ACC_F/2 + d/v;
}
/* ReachModel: 野手が地点へ着くまでの時間を一つの式で返す。
   以前はplanPlay/interceptPoint/coverArrival/自分で踏む判断が、それぞれ
   反応・加速・走行中クレジットを別々に実装していたため、同じ野手・同じ地点でも
   「間に合う/間に合わない」が層ごとに変わっていた。 */
const REACH_TURN_MAX=0.30;                 // 全速で180度反転する時の減速・再加速コスト
function fielderMotionFraction(f){
  return clamp((f.v||0)/Math.max(1,f.sp||24),0,1);
}
function reachTurnCost(f,x,y,opt){
  const o=opt||{};
  if(o.useCurrent===false || o.turn===false) return 0;
  const mov=fielderMotionFraction(f);
  if(mov<0.08) return 0;
  const hx=(f.tx==null?f.cx:f.tx)-f.cx, hy=(f.ty==null?f.cy:f.ty)-f.cy;
  const nx=x-f.cx, ny=y-f.cy;
  const hm=Math.hypot(hx,hy), nm=Math.hypot(nx,ny);
  if(hm<0.75 || nm<0.75) return 0;
  const cos=clamp((hx*nx+hy*ny)/(hm*nm),-1,1);
  return REACH_TURN_MAX*mov*(1-cos)*0.5;
}
function reachTravelTime(f,d,opt){
  const o=opt||{}, speed=Math.max(1,(f.sp||24)*(o.speedScale||1));
  const mov=o.useCurrent===false?0:fielderMotionFraction(f);
  const full=runTime(speed,Math.max(0,d));
  return Math.max(d/speed,full-(ACC_F/2)*mov);
}
function reachTimeToPoint(f,x,y,opt){
  const o=opt||{}, useCurrent=o.useCurrent!==false;
  const sx=useCurrent?f.cx:f.x, sy=useCurrent?f.cy:f.y;
  const raw=Math.hypot(x-sx,y-sy), reach=o.reach||0;
  if(o.zeroWithinReach && raw<reach) return 0;
  const d=Math.max(0,raw-reach);
  const mov=useCurrent?fielderMotionFraction(f):0;
  const reactionBase=o.reactionBase===undefined?reactOf(f):o.reactionBase;
  const reaction=o.reaction===false?0:reactionBase*(o.reactScale===undefined?1:o.reactScale)*(1-mov);
  return reaction+reachTravelTime(f,d,{useCurrent,speedScale:o.speedScale||1})+
    reachTurnCost(f,x,y,o);
}

"""
html=swap(html,old,new,'ReachModel helpers')

old="""  const mov=Math.min(1,(f.v||0)/Math.max(1,f.sp));
  const reactPay=reactOf(f)*0.4*(1-mov);
  const runPay=(d)=>{ const full=runTime(f.sp,d); return Math.max(d/f.sp, full-(ACC_F/2)*mov); };
"""
new="""  const reachAt=(x,y)=>reachTimeToPoint(f,x,y,
    {useCurrent:true,reach:CATCH_R,reactScale:0.4,turn:true});
"""
html=swap(html,old,new,'intercept ReachModel setup')
html=swap(html,"reactPay+runPay(d)+margin <= t","reachAt(b.x,b.y)+margin <= t",'intercept margin arrival')
html=swap(html,"reactPay+runPay(d) <= t","reachAt(b.x,b.y) <= t",'intercept base arrival')

old="""  const d0=Math.hypot(ball.x-f.x, ball.y-f.y);
  // 走らなければならないのは「手の届く範囲の外側」だけ。飛びつける分は走らなくてよい
  const need=reactOf(f)+runTime(f.sp, Math.max(0, d0-(reach===undefined?CATCH_R:reach)));
"""
new="""  // 走らなければならないのは「手の届く範囲の外側」だけ。飛びつける分は走らなくてよい
  const need=reachTimeToPoint(f,ball.x,ball.y,
    {useCurrent:false,reach:(reach===undefined?CATCH_R:reach),turn:false});
"""
html=swap(html,old,new,'routeProb ReachModel')

old="""    const fx = useCurrent ? f.cx : f.x, fy = useCurrent ? f.cy : f.y;
    const react = reactOf(f);
    const dOf = p => Math.max(0, Math.hypot(p.x-fx,p.y-fy) - CATCH_R);
"""
new="""    const arrivalAt=p=>reachTimeToPoint(f,p.x,p.y,{
      useCurrent:!!useCurrent,reach:CATCH_R,reactScale:useCurrent?0.4:1,turn:!!useCurrent});
    const dOf = p => Math.max(0, Math.hypot(p.x-(useCurrent?f.cx:f.x),p.y-(useCurrent?f.cy:f.y)) - CATCH_R);
"""
html=swap(html,old,new,'plan ReachModel setup')
html=swap(html,"const base=react+runTime(f.sp,dOf(p));","const base=arrivalAt(p);",'plan candidate arrival')
html=swap(html,"hit={t:react+runTime(f.sp,dOf(p)), p: layout?near:p};","hit={t:arrivalAt(p), p: layout?near:p};",'plan fallback arrival')

old="""    const mov=Math.min(1,(f.v||0)/Math.max(1,f.sp));
    const t = d<2 ? 0 : F_REACT*0.4*(1-mov) + Math.max(d/(f.sp*0.88), runTime(f.sp*0.88,d)-(ACC_F/2)*mov);
"""
new="""    const t=reachTimeToPoint(f,p[0],p[1],{
      useCurrent:true,reach:2,zeroWithinReach:true,speedScale:0.88,
      reactionBase:F_REACT,reactScale:0.4,turn:true});
"""
html=swap(html,old,new,'coverArrival ReachModel')

old="""      const mine=runTime(T.thrower.sp*0.88, my);
"""
new="""      const mine=reachTimeToPoint(T.thrower,tp0[0],tp0[1],{
        useCurrent:true,speedScale:0.88,reaction:false,turn:true});
"""
html=swap(html,old,new,'self-step ReachModel')

HTML.write_text(html,encoding='utf-8')

# Architecture guard: direct runTime use only inside ReachModel.
guard=GUARD.read_text(encoding='utf-8')
old="""const rundownBody=stripComments(extractFunction('rundownCover'));
"""
new="""const runTimeUses=count(/\\brunTime\\s*\\(/g,clean);
check('runTime is only defined and used inside reachTravelTime',runTimeUses===2,runTimeUses);
const travelBody=stripComments(extractFunction('reachTravelTime'));
check('reachTravelTime owns runTime usage',count(/\\brunTime\\s*\\(/g,travelBody)===1,
  (travelBody.match(/\\brunTime\\s*\\(/g)||[]).length);
for(const name of ['interceptPoint','routeProb','planPlay','coverArrival']){
  const body=stripComments(extractFunction(name));
  check(`${name} uses ReachModel`,/reachTimeToPoint\\s*\\(/.test(body),name);
  check(`${name} has no direct runTime`,!/\\brunTime\\s*\\(/.test(body),name);
}
const rundownBody=stripComments(extractFunction('rundownCover'));
"""
guard=swap(guard,old,new,'guard ReachModel')
GUARD.write_text(guard,encoding='utf-8')

# Design doc Phase4.
doc=DOC.read_text(encoding='utf-8')
old="""### Phase 4: ReachModel

- ETA計算の重複を一つにする。
- 方向転換コストを入れる。
- 追跡1000打球の余分距離分布を回帰基準にする。
"""
new="""### Phase 4: ReachModel基盤 — BUILD b0805-17

本PRで実施する。

- `reachTimeToPoint`を到達時刻の唯一の公開モデルとして追加する。
- 反応時間、加速、現在速度のクレジット、捕球半径、速度係数、方向転換コストを共通化する。
- `planPlay / interceptPoint / routeProb / coverArrival / 自分で踏む判断`を共通モデルへ移す。
- 動的再計画では、現在の走行方向から180度反転する場合に最大0.30秒の減速・再加速コストを課す。
- architecture guardで、`runTime`の直接利用をReachModel内部だけに限定する。

Phase 4基盤完了後のラチェット:

- production内の`runTime`利用: 7経路 → **1経路**（`reachTravelTime`内部）
- 到達判定を持つ主要4関数: 全て`reachTimeToPoint`を利用

後続:

- 追跡1000打球の余分距離分布をb0805-16と比較し、再照準の採用条件を統計的に詰める。
"""
doc=swap(doc,old,new,'doc Phase4')
DOC.write_text(doc,encoding='utf-8')

# Harness tests33-34.
h=HARNESS.read_text(encoding='utf-8')
marker="  console.log(JSON.stringify(out,null,1));\n  return out;"
if h.count(marker)!=1: raise SystemExit('harness marker')
insert=r'''  // ===== test33: ReachModelの反応・運動クレジット・方向転換契約 =====
  (function(){
    const chk=[];
    try{
      const f={x:0,y:0,cx:0,cy:0,tx:100,ty:0,sp:20,v:0,zone:0.0095};
      const staticT=reachTimeToPoint(f,60,0,{useCurrent:false,reach:0,turn:false});
      chk.push({n:'静止到達は反応+加速走行',ok:Math.abs(staticT-(reactOf(f)+runTime(20,60)))<1e-9});
      f.v=20; f.tx=100; f.ty=0;
      const forward=reachTimeToPoint(f,60,0,{useCurrent:true,reach:0,reactScale:0.4,turn:true});
      const reverse=reachTimeToPoint(f,-60,0,{useCurrent:true,reach:0,reactScale:0.4,turn:true});
      chk.push({n:'走行中は静止再計算より速い',ok:forward<staticT&&forward>=60/20-1e-9});
      chk.push({n:'180度反転には方向転換コスト',ok:reverse-forward>0.25});
      const stopped={...f,v:0,tx:-100,ty:0};
      chk.push({n:'停止中は向きで差を付けない',ok:Math.abs(
        reachTimeToPoint(stopped,60,0,{useCurrent:true,turn:true})-
        reachTimeToPoint(stopped,-60,0,{useCurrent:true,turn:true}))<1e-9});
    }catch(e){chk.push({n:'例外',ok:false,e:e.message});}
    const bad=chk.filter(x=>!x.ok);
    out.test33_ReachModel契約={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

  // ===== test34: 動的planPlayは近さだけでなく方向転換コストを見る =====
  (function(){
    let res={};
    const savedStep=window.stepBall, savedReact=window.reactOf;
    try{
      window.stepBall=(b,h)=>{b.x=30;b.y=0;b.z=1;b.vx=0;b.vy=0;b.vz=0;};
      window.reactOf=()=>0;
      const away={n:'away',x:0,y:0,cx:0,cy:0,tx:-100,ty:0,sp:20,v:20,fld:70,zone:0.0095};
      const aligned={n:'aligned',x:-2,y:0,cx:-2,cy:0,tx:100,ty:0,sp:20,v:20,fld:70,zone:0.0095};
      fielders=[away,aligned];
      const src={x:30,y:0,z:1,vx:0,vy:0,vz:0,bs:0,ss:0,landed:true,t:0,maxZ:1};
      const p=planPlay(src,true);
      res={selected:p.f&&p.f.n,verdict:p.f===aligned?'PASS':'FAIL'};
    }catch(e){res={verdict:'FAIL',e:e.message};}
    finally{window.stepBall=savedStep;window.reactOf=savedReact;}
    out.test34_動的到達方向=res;
  })();

'''
h=h.replace(marker,insert+marker,1)
HARNESS.write_text(h,encoding='utf-8')
print('patched b0805-17')
