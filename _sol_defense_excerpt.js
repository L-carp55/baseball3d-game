// baseball3d.html から守備判断に関わる部分だけを抜粋（2026-08-01）
const BASEPOS = [ {x:0,z:0}, {x:63.64,z:63.64}, {x:0,z:127.28}, {x:-63.64,z:63.64} ];
const A = {
const F_REACT = 0.22, ACC_T = 1.90, ACC_F = 0.80;
const CATCH_R = 4.5;      // グラブが届く距離。先読みと実判定で同じ値を使う
const PHYS_H  = 1/240;    // 物理の刻み。画面更新率に関係なくこの幅で進める
const RUN_SPEED = 1/90;                  // 1ft/秒あたりの塁進行。走力から出した速度を掛ける

// 距離dを走るのにかかる時間（加速込み）。守備の移動に使う
function runTime(v,d){
  const dAcc = 0.5*v*ACC_F;
  return d<=dAcc ? Math.sqrt(2*d*ACC_F/v) : ACC_F/2 + d/v;
}

// 守備側チームの9人から守備陣を作る
function buildFielders(team){
  return ROSTER[team].map(p=>{
    const h=POS_HOME[p.pos]||POS_HOME['投'];
    return {n:p.pos, name:p.n, x:h.x, y:h.y,
      sp:A.speed(p.走), zone:A.zone(p.守), arm:A.arm(p.肩), fld:p.守, cat:p.捕,
      cx:h.x, cy:h.y, tx:h.x, ty:h.y, primary:false, run:0, face:0, v:0};
  });
}

/* 守備力による守備範囲の差。反応の速さとして効かせる（平均50でちょうど F_REACT）。
   以前は zone を計算だけして使っておらず、守備力を変えても打球への到達が変わらなかった。 */
function reactOf(f){ return Math.max(0.10, F_REACT + ((f.zone||0.0095)-0.0095)*20); }

function planPlay(src, useCurrent){
  /* 実際の飛行と同じ刻み(1/240秒)で先読みする。
     以前は0.02秒刻みで予測しており、予測した通り道と実際の打球が数ft ずれていたため、
     野手が球の脇に走り込んで「横を抜けたのに◯◯ゴロ」になっていた。 */
  const b={...src}; let t=0; const path=[]; const h=1/240;
  for(let i=0;i<1700;i++){
    stepBall(b,h); t+=h;
    if(i%4===0) path.push({x:b.x,y:b.y,z:b.z,t,vz:b.vz});
    const dist=Math.hypot(b.x,b.y), ang=clamp(Math.atan2(b.x,b.y)/RAD,-45,45);
    if(dist>fenceDist(ang)+12) break;
    if(t>7 || (b.z<=0.03 && Math.hypot(b.vx,b.vy)<5)) break;
  }
  if(!path.length) path.push({x:b.x,y:b.y,z:b.z,t});
  const firstLand = path.find(p=>p.z<=0.06 && p.t>0.15) || path[path.length-1];
  /* 捕れる高さ。立って手を伸ばして届くのは約7ft。落ちてくる打球なら跳んで9.5ftまで。
     上昇中・水平のまま頭上を越えていく打球（ライナー）は捕れない。 */
  const cands = path.filter(p=>p.t>0.22 && p.z <= (p.vz<0 ? 9.5 : 7.0));
  const pool = cands.length?cands:[firstLand];
  let best={f:fielders[0], t:1e9, x:firstLand.x, y:firstLand.y, air:false};
  fielders.forEach(f=>{
    let hit=null;
    /* 壁に当たった後の再計算では、定位置ではなく「今いる場所」から測る。
       定位置基準のままだと、既に近くまで来ている野手を遅いと判定する。
       距離からグラブの届く分を引くのは、実際の捕球判定が4.5ft以内だから（同じ物差しにする）。 */
    const fx = useCurrent ? f.cx : f.x, fy = useCurrent ? f.cy : f.y;
    const react = reactOf(f);
    const dOf = p => Math.max(0, Math.hypot(p.x-fx,p.y-fy) - CATCH_R);
    for(const p of pool){
      if(react+runTime(f.sp,dOf(p)) <= p.t){ hit={t:p.t,p}; break; }
    }
    if(!hit){ const p=pool[pool.length-1];
      hit={t:react+runTime(f.sp,dOf(p)), p}; }
    if(hit.t<best.t) best={f, t:hit.t, x:hit.p.x, y:hit.p.y,
      air: hit.p.z>1.2 && hit.p.t<=firstLand.t+0.02};
  });
  return {...best, firstLand};
}

/* ===== 野手の移動 ===== */
// フェンスの外へは出られないよう位置を球場内に丸める（本塁打を追いかけて場外へ走る不具合の対策）
function clampField(x,y){
  const d=Math.hypot(x,y);
  if(d<1) return [x,y];
  const max=fenceDist(clamp(Math.atan2(x,y)/RAD,-45,45))-2;
  return d>max ? [x/d*max, y/d*max] : [x,y];
}

function setTarget(f,x,y){ const p=clampField(x,y); f.tx=p[0]; f.ty=p[1]; }

function moveFielders(dt, running){
  fielders.forEach(f=>{
    const dx=f.tx-f.cx, dy=f.ty-f.cy, d=Math.hypot(dx,dy);
    /* ベースカバーは打球の行方を見てから動く必要がない（打った瞬間に決まっている動き）。
       反応待ちを入れると、一塁手が捕りに出た時の投手のカバーが間に合わず、
       まともな一塁ゴロがほとんど内野安打になる。カバーは全力で入る。 */
    const cover = f.coverBase!=null && !f.primary;
    if(d>0.5 && (running || cover)){
      f.v = Math.min(f.sp, (f.v||0) + (f.sp/ACC_F)*dt);   // 走り出しは加速する（守備は打者より速い）
      const m=Math.min(d, f.v*dt*(f.primary?1:0.88));   // カバーも能力どおりの速さで走る
      f.cx+=dx/d*m; f.cy+=dy/d*m; f.run+=m; f.face=Math.atan2(dx,dy);
      const p=clampField(f.cx,f.cy); f.cx=p[0]; f.cy=p[1];
    } else if(d<=0.5){ f.v=0; }
  });
}

   マウンドに転がって止まってしまう。 */
function throwPoint(t){
  if(t==='P'){
    const p=fielders.find(f=>f.n==='投');
    return p ? [p.cx, p.cy] : [0,60.5];
  }
  return [BASEPOS[t%4].x, BASEPOS[t%4].z];
}

   捕手は座った姿勢から、投手は投球動作の直後から投げるので、そのぶん弱い。 */
function armEff(f){
  const run = Math.min(1, (f.run||0)/70);            // 追いかけた距離ぶん体勢が苦しい
  const pos = (f.n==='捕') ? 0.88 : (f.n==='投' ? 0.86 : 1.0);
  return Math.max(0.30, (f.arm||0.8) * (1 - 0.24*run) * pos);
}

/* 送球のそれ。体勢が苦しいほど、また捕球が下手なほど大きくそれる。
   「送球が乱れてセーフ」と出るのに球がまっすぐ飛んでいたのを、実際にそらせる。 */
function throwOffset(f, d){
  const run=Math.min(1,(f.run||0)/70);
  const bad=(100-(f.cat||60))/100;
  const amt = d*(0.03 + 0.10*run + 0.07*bad);
  const ang = rnd(0,Math.PI*2);
  return [Math.cos(ang)*amt, Math.sin(ang)*amt];
}

   最短角＋助走なしで計算していたため、外野からの返球が弾丸のように速かった。 */
function throwArc(d){ return d>150 ? 1.45 : (d>90 ? 1.20 : 1.0); }

function throwHopTime(d){ return d>150 ? 0.35 : (d>90 ? 0.15 : 0); }

function throwFlightTime(d, arm){
  const v0=110 + 60*(arm-0.55);
  const s=Math.min(0.95, 32.2*d/(v0*v0));
  const th=Math.min(0.78, 0.5*Math.asin(s)*throwArc(d));
  return d/Math.max(1, v0*Math.cos(th)) + throwHopTime(d);
}

   これを見ないと「三塁手が捕って、誰もいない三塁へ投げ、遊撃手が後から着いてセーフ」になる。 */
function coverArrival(b, thrower){
  if(b==='P') return 0;
  const p=throwPoint(b);
  let best=99;
  fielders.forEach(f=>{
    if(f.coverBase!==b && f!==thrower) return;
    const d=Math.hypot(p[0]-f.cx, p[1]-f.cy);
    const t = d<2 ? 0 : F_REACT*0.4 + runTime(f.sp*0.88, d);
    if(t<best) best=t;
  });
  return best;
}

function throwETAof(f, b){
  const p=throwPoint(b);
  const d=Math.hypot(p[0]-f.cx, p[1]-f.cy);
  const reach=110 + 60*(armEff(f)-0.55), maxD=reach*reach/32.2*0.92;
  const transfer=A.transfer(f.fld,f.cat);
  let t;
  if(d>maxD){                                  // 肩が届かない＝中継が入る
    const d1=maxD*0.62;
    t = transfer + throwFlightTime(d1,armEff(f)) + transfer*0.7 + throwFlightTime(d-d1,armEff(f)) + 0.28;
  }else{
    t = transfer + throwFlightTime(d,armEff(f)) + 0.28;
  }
  // 送球が着いても、塁に人がいなければアウトにはできない。遅い方が成立時刻
  return Math.max(t, coverArrival(b, f)) + 0.12;   // 受けてからタッチするまでの時間
}

function launchThrow(fx,fy,tx,ty,arm){
  const d=Math.max(1,Math.hypot(tx-fx,ty-fy));
  /* 送球の初速。肩力1で約75mph、肩力100で約95mph（1ft/s≒0.682mph）。
     実際のプロは捕手の最大努力で平均81mph、外野手で平均89mphなので、その範囲に合わせている。 */
  const v0=110 + 60*(arm-0.55);
  const s=Math.min(0.95, 32.2*d/(v0*v0));
  const th=Math.min(0.78, 0.5*Math.asin(s)*throwArc(d));   // 遠いほど山なりに投げる
  const vh=v0*Math.cos(th), vz=v0*Math.sin(th);
  ball.x=fx; ball.y=fy; ball.z=5.4; ball.landed=false; ball.t=0;
  ball.vx=(tx-fx)/d*vh; ball.vy=(ty-fy)/d*vh; ball.vz=vz;
}

// 走者が塁bに到達するまでの残り秒数（すでに達していれば0）
// 走者が塁bに着くまでの残り秒数（今の速度から加速することを織り込む）
function runnerETA(r,b){
  if(r.p>=b) return 0;
  const d=(b-r.p)/RUN_SPEED, top=r.sp||23, acc=top/ACC_T, v=r.v||0;
  const tAcc=Math.max(0,(top-v)/acc), dAcc=v*tAcc+0.5*acc*tAcc*tAcc;
  return d<=dAcc ? (Math.sqrt(v*v+2*acc*d)-v)/acc : tAcc+(d-dAcc)/top;
}

   待ち時間が足りず、最後に走者が塁へ瞬間移動する。 */
function runnerBackETA(r){
  const d=(r.p-r.goal)/RUN_SPEED; if(d<=0) return 0;
  const top=(r.sp||23)*0.8, acc=(r.sp||23)/ACC_T, v=r.v||0;
  const tAcc=Math.max(0,(top-v)/acc), dAcc=v*tAcc+0.5*acc*tAcc*tAcc;
  return d<=dAcc ? (Math.sqrt(v*v+2*acc*d)-v)/acc : tAcc+(d-dAcc)/top;
}

   打者走者がアウトになれば後ろが空くので強制は消える（b=0から見る理由）。 */
function isForced(r){
  for(let b=0;b<r.origin;b++) if(!runners.some(x=>x.origin===b && !x.out)) return false;
  return true;
}

   誰も走っていなければ投手へ返球する。 */
function chooseThrowTarget(f){
  const throwETA=b=>throwETAof(f,b);
  /* 「今動いている走者」だけでなく「押し出されて必ず進む走者」も対象にする。
     押し出しは守備からも見えている事実であり、走り出す一瞬前でも塁は狙える。
     これが無いと、満塁で打った直後の一瞬に「誰も走っていない」と見えて、
     本塁封殺を捨てて一塁や二塁へ投げてしまう。 */
  const live=runners.filter(r=>!r.out && (
    r.dir>0 || (r.origin===0 && r.p<1) || (r.origin>0 && isForced(r) && r.p<r.origin+1)));
  let best=null, fallback=null;
  for(const r of live){
    /* その走者が今向かっている塁から先へ、順に「間に合うか」を見る。
       走者が今どこにいるかではなく、送球が着く頃にどこにいるかで決めるのが要点。
       外野から、まだ一塁に達していない打者走者を見て一塁へ投げると、
       送球が着く頃には二塁を回っている＝完全な無駄になる。 */
    /* 内野からは「その走者が今向かっている塁」だけを狙う。
       その先まで見ると、一塁へ走っているだけの打者走者を二塁で刺そうとしたり、
       三塁へ向かう走者を見て本塁へ投げたりする（実際にそうなっていた）。
       外野からは送球に時間がかかるので、着く頃の位置＝1つ先まで見る。 */
    const nextB = Math.min(4, Math.floor(r.p+1e-9)+1);
    const bMax = (Math.hypot(f.cx,f.cy) < 158) ? nextB : 4;
    for(let b=nextB; b<=bMax; b++){
      const te=throwETA(b), re=runnerETA(r,b);
      const m = re - te - ((b===4)?0.35:0.05);
      if(m>0){                                    // ここなら刺せる
        if(!best || b>best.nb) best={nb:b};
        break;
      }
      /* 刺せない塁の中では「一番惜しい塁」を控えにする。
         先頭走者の行き先を機械的に選ぶと、満塁で明らかに間に合わない本塁へ投げてしまう。 */
      if(!fallback || m>fallback.m) fallback={nb:b, m};
      if(re > te-0.7) break;                      // これ以上先は論外
    }
  }
  if(best) return {nb:best.nb};
  return {nb: fallback ? fallback.nb : 'P'};
}

   プレーが打ち切られる」という見え方になっていた。 */
function safeReach(r, f){
  /* 守備は一度に1か所へしか投げられない。前を走る走者への送球で手一杯なら、
     後ろの走者はその分だけ余裕がある。先頭以外の走者はこの猶予を見込んで走る。 */
  const lead=runners.filter(x=>!x.out && x.p<4-1e-9).sort((a,b)=>b.p-a.p)[0];
  /* 先頭の走者にも少しだけ余裕を見る。実際の走塁でも、間一髪なら回す（送球が逸れる・
     捕り損ねる可能性があるため）。ここを0にすると確実な時しか走らず、単打で誰も還れない。 */
  const slack=(r===lead)?0.55:1.35;
  let best=Math.max(r.origin, Math.floor(r.p+1e-9));
  for(let b=best+1; b<=4; b++){
    if(runnerETA(r,b) < throwETAof(f,b)+slack) best=b; else break;
  }
  return best;
}

   ボールを持ったまま詰め寄り、どちらへ投げても間に合う距離にしてから勝負する。 */
function trappedRunner(f){
  const live=runners.filter(r=>!r.out && r.origin>0 && r.p>0.12 && r.p<3.95);
  for(const r of live){
    const lo=Math.floor(r.p+1e-9), hi=Math.min(4, lo+1);
    const frac=r.p-lo;
    /* 塁の間の真ん中あたりで迷っている走者だけが対象。
       塁に寄っている走者や、すでに全速で片方へ向かっている走者は「詰まって」いないので、
       歩いて近づくのではなく普通に投げる。 */
    if(frac < 0.30 || frac > 0.70) continue;
    if((r.v||0) > 0.55*(r.sp||23)) continue;           // 全速で走っている＝行き先は決まっている
    const rp=runnerPos(r);
    if(Math.hypot(rp.x-f.cx, rp.z-f.cy) > 80) continue; // 遠すぎる。歩いて詰める距離ではない
    const back={...r, goal:lo}, fwd={...r, goal:hi};
    const canLo = runnerBackETA(back) > throwETAof(f,lo);
    const canHi = runnerETA(fwd,hi)   > throwETAof(f,hi);
    if(!canLo && !canHi) return r;                     // どちらへ投げても逃げられる
  }
  return null;
}

function beginThrowPhase(f, kind, award, flyLead){
  // 走者の行き先を決める（外野なら送球に勝てる塁まで、内野なら詰まっている走者が1つ）
  if(kind!=='fly') runners.forEach(r=>{
    const auto = (kind==='outfield')
      ? safeReach(r, f)
      : ((r.origin===0 || isForced(r)) ? Math.min(4, r.origin+1) : r.origin);
    r.safeGoal = auto;                   // 自動で狙う塁（無条件セーフの意味ではない）
    setAutoGoal(r, auto);                // 手動の指示はこの上に足される
  });
  /* 送球先は「間に合う見込みのある一番先の塁」。
     見込みが無いのに本塁へ投げると走者が必ず刺されてしまい、単打で誰も還れなくなる
     （実際にそうなっていた）。届かないと分かっている塁には投げない。 */
  let tgt = chooseThrowTarget(f);
  /* フライ捕球後は「離塁していた走者の元の塁」へ投げて離塁アウトを狙う。
     狙う走者がいなければ投手へ返球して終わり。 */
  if(kind==='fly') tgt = flyLead ? {nb: flyLead.mustReturn ? flyLead.origin : Math.min(4,flyLead.origin+1)} : {nb:'P'};
  // 守備側（あなた）が送球先を指定していればそれを優先する
  if(!isPlayerBatting() && manualThrow!=null) tgt = {nb: manualThrow};   // 'P'は投手のまま渡す
  throwPlay = {
    stage:'transfer', t:0,
    /* 持ち替え時間 = 守備力（捕ってから投げるまでの動作の速さ）＋捕球（握り直しの確実さ）。
       捕球が低いと一定確率で捕り損ね、さらに時間がかかる。 */
    transfer: A.transfer(f.fld,f.cat) + rnd(0,0.10)
              + (Math.random()<A.fumble(f.cat) ? rnd(0.55,1.15) : 0),
    thrower:f, kind, award,
    target: tgt ? tgt.nb : 1,
    relayed:false,
    fieldT: ball.t
  };
  ball.vx=0; ball.vy=0; ball.vz=0; ball.z=4.6;
  ball.x=f.cx; ball.y=f.cy;
  S.phase='throwing';
  if(kind!=='fly') setMsg('','');   // フライは捕球時に出したアウト表示を消さない
}

   ボールを持った野手のすぐ横を走者が通り抜けても何も起きなかった。 */
function tagNearbyRunner(holder){
  if(!holder) return null;
  for(const r of runners){
    if(r.out) continue;
    if(Math.abs(r.p-Math.round(r.p))<0.035) continue;   // 塁の上にいる走者は触れてもセーフ
    if(r.p>=4-1e-6) continue;                            // 生還済み
    const q=runnerPos(r);
    if(Math.hypot(holder.cx-q.x, holder.cy-q.z) < 3.0){ markOut(r,'tag'); return r; }
  }
  return null;
}

function updateThrowPhase(dt){
  const T=throwPlay;
  T.t+=dt;
  updateRunners(dt);
  moveFielders(dt,true);
  /* ボールを持っている野手は誰か。持っている間はいつでもタッチが成立する。 */
  const holder = (T.stage==='transfer'||T.stage==='step'||T.stage==='approach') ? T.thrower
               : (T.stage==='catch') ? T.receiver
               : (T.stage==='rundown' && T.rd && T.rd.sub==='chase') ? T.rd.holder : null;
  if(holder && T.kind!=='fly'){
    const tagged = tagNearbyRunner(holder);
    if(tagged){
      if(T.stage==='rundown') return endRundown('タッチアウト！','#95a3b4');
      T.rdText='タッチアウト！'; T.rdColor='#95a3b4';
      return concludePlay();
    }
  }

  if(T.stage==='transfer'){
    ball.x=T.thrower.cx; ball.y=T.thrower.cy; ball.z=4.6;
    /* 自分で塁を踏むなら持ち替えは要らない（握り直さず、そのまま踏みに行く）。
       持ち替えを待ってから歩き出していたため、投げるより遅くなってセーフになっていた。
       カバーがすでに塁に入っているなら、自分で行かずに投げる。 */
    if(!T.stepChecked && T.target!=='P' && T.kind!=='fly' && T.kind!=='steal'){
      T.stepChecked=true;
      const tp0=throwPoint(T.target);
      const my=Math.hypot(tp0[0]-T.thrower.cx, tp0[1]-T.thrower.cy);
      const mine=runTime(T.thrower.sp*0.88, my);
      const cov=coverArrival(T.target, null);
      if(my<30 && mine < cov + T.transfer){
        setTarget(T.thrower, tp0[0], tp0[1]);
        T.receiver=T.thrower; T.dest=tp0;
        T.stage='step'; T.t=0;
        return;
      }
    }
    if(T.t>=T.transfer){
      /* 投げる瞬間に、その時点の走者の位置で投げ先を決め直す。
         捕った時の判断のまま投げると、中継が受け取ってから投げ直す時に
         1〜2秒前の状況へ投げてしまう（二塁を狙う走者がいるのに一塁へ投げる、等）。 */
      if(T.kind!=='fly' && T.kind!=='steal' && !T.relayed && !(!isPlayerBatting() && manualThrow!=null)){
        const t2=chooseThrowTarget(T.thrower); if(t2) T.target=t2.nb;
      }
      /* 自分が送球先の塁のすぐそばにいるなら投げない（自分で塁を踏む）。
         一塁手が誰もいない一塁へ投げる、といった不自然な動きを防ぐ。 */
      const tp=throwPoint(T.target);
      /* 自分がカバーより早く塁に着けるなら投げずに自分で踏む。
         固定距離で決めると、三塁手が三塁のすぐ近くにいても投げてしまう。 */
      const myStep = Math.hypot(tp[0]-T.thrower.cx, tp[1]-T.thrower.cy);
      if(T.target!=='P' && myStep < 6){          // 目の前の塁は自分で踏む
        setTarget(T.thrower, tp[0], tp[1]);
        T.receiver=T.thrower; T.dest=tp;
        T.stage='step'; T.t=0;
        return;
      }
      /* 塁間の走者を、どちらの塁へ投げても刺せない時は投げない。
         ボールを持ったまま走者へ詰め、どちらへ投げても間に合う距離にしてから動く。
         いきなり投げると、投げた反対側の塁へ楽に進まれてしまう。 */
      const trap = trappedRunner(T.thrower);
      if(trap && T.kind!=='fly' && !T.relayed){
        T.stage='approach'; T.trap=trap; T.t=0; return;
      }
      // 投手への返球は投手本人が受ける。それ以外はカバーに入っている野手が受ける
      let recv = (T.target==='P') ? fielders.find(f=>f.n==='投') : coverOf(T.target, T.thrower);
      let p = (T.target==='P' && recv) ? [recv.cx, recv.cy] : throwPoint(T.target);
      /* 肩が届かない距離は中継に入れる。届かない送球をそのまま投げると、
         手前で落ちて誰も取りに行かないまま止まってしまう。 */
      const far=Math.hypot(p[0]-T.thrower.cx, p[1]-T.thrower.cy);
      const reachable=110 + 60*(armEff(T.thrower)-0.55);
      const maxD=reachable*reachable/32.2*0.92;          // その初速で届く最大距離
      if(far>maxD){
        let cut=null,cd=1e9;
        fielders.forEach(f=>{ if(f===T.thrower) return;
          const t=Math.hypot(p[0]-f.cx,p[1]-f.cy)+Math.hypot(f.cx-T.thrower.cx,f.cy-T.thrower.cy);
          if(t<cd && Math.hypot(f.cx-T.thrower.cx,f.cy-T.thrower.cy)<maxD){ cd=t; cut=f; } });
        if(cut){ recv=cut; p=[cut.cx,cut.cy]; T.relayTo=T.target; }
      }
      launchThrow(T.thrower.cx,T.thrower.cy,p[0],p[1],armEff(T.thrower));
      if(recv) setTarget(recv,p[0],p[1]);   // 受け手は送球先で待つ（投手も同じ）
      T.receiver=recv;
      T.stage='fly'; T.t=0; T.dest=p;
    }
    return;
  }
  if(T.stage==='fly'){
    let acc=Math.min(0.30,(T.acc||0)+dt), g=0;
    while(acc>=PHYS_H && g++<900){ acc-=PHYS_H; stepBall(ball,PHYS_H); ball.t+=PHYS_H; }
    T.acc=acc;
    trail.push([ball.x,ball.z,ball.y]); if(trail.length>18) trail.shift();
    /* 届かないまま時間だけ過ぎた送球を「捕った」ことにしない。
       受け手を実際のボールの位置へ向かわせて拾わせる。 */
    let d=Math.hypot(ball.x-T.dest[0], ball.y-T.dest[1]);
    if(!T.chased && d>=5 && T.t>2.6) T.chased=true;
    if(T.chased && T.receiver){
      setTarget(T.receiver, ball.x, ball.y);
      d=Math.hypot(ball.x-T.receiver.cx, ball.y-T.receiver.cy);
      T.dest=[ball.x,ball.y];
    }
    if(T.chased && T.t>8) return concludePlay();   // 収拾できなければプレーを閉じる
    if(d<5){
      // 受け手が捕って塁に触れるまでの間。送球がずれるほど手間取る
      T.stage='catch'; T.t=0;
      T.catchDur = rnd(0.04,0.30)*(1.30-armEff(T.thrower))*2.0;
    }
    return;
  }
  /* ボールを持ったまま走者へ詰め寄る段階。どちらの塁へ投げても間に合う距離まで近づいたら
     挟殺プレーに入る。走者が塁へ逃げ切れる状況で先に投げると、必ず反対側へ進まれる。 */
  if(T.stage==='approach'){
    const r=T.trap;
    ball.x=T.thrower.cx; ball.y=T.thrower.cy; ball.z=4.4; ball.vx=ball.vy=ball.vz=0;
    updateRunners(dt); moveFielders(dt,true);
    if(r.out || Math.abs(r.p-Math.round(r.p))<0.03){    // 走者が塁に着いてしまった
      T.stage='transfer'; T.t=0; T.stepChecked=false; return;
    }
    const rp=runnerPos(r);
    setTarget(T.thrower, rp.x, rp.z);
    const lo=Math.floor(r.p+1e-9), hi=Math.min(4, lo+1);
    const back={...r, goal:lo}, fwd={...r, goal:hi};
    const canLo = runnerBackETA(back) > throwETAof(T.thrower,lo);
    const canHi = runnerETA(fwd,hi)   > throwETAof(T.thrower,hi);
    const near = Math.hypot(rp.x-T.thrower.cx, rp.z-T.thrower.cy);
    if((canLo && canHi) || near<26 || T.t>4.5){
      T.receiver=T.thrower;
      return beginRundown(r, hi);
    }
    return;
  }
  /* ボールを持った野手が自分で塁を踏みに行く段階。
     踏む前にアウトを宣告してはいけない（遊撃手が二塁を踏む前に併殺が成立していた）。 */
  if(T.stage==='step'){
    ball.x=T.thrower.cx; ball.y=T.thrower.cy; ball.z=4.4; ball.vx=ball.vy=ball.vz=0;
    if(Math.hypot(T.dest[0]-T.thrower.cx, T.dest[1]-T.thrower.cy) < 1.6 || T.t>2.2)
      return judgeAtBase(T.target);
    return;
  }
  if(T.stage==='catch'){
    // 受け取ったボールは野手の手の中にある（宙に浮いたまま止まって見えないように）
    if(T.receiver){ ball.x=T.receiver.cx; ball.y=T.receiver.cy; ball.z=4.4; ball.vx=ball.vy=ball.vz=0; }
    if(T.t>=T.catchDur){
      if(T.relayTo!=null){                 // 中継を受けた野手が本来の塁へ投げ直す
        const nx=T.relayTo; T.relayTo=null; T.thrower=T.receiver||T.thrower;
        T.target=nx; T.stage='transfer'; T.t=0;
        T.transfer=A.transfer(T.thrower.fld,T.thrower.cat)*0.7+0.12;
        return;
      }
      /* 受け手がまだ塁に着いていなければ、着くまでアウトにしない。
         送球が塁の上空を通っただけでアウトになるのを防ぐ。 */
      if(T.target!=='P' && T.receiver && T.dest && T.t<3.6 &&
         Math.hypot(T.dest[0]-T.receiver.cx, T.dest[1]-T.receiver.cy) > 1.8) return;
      return judgeAtBase(T.target);
    }
    return;
  }
  if(T.stage==='rundown') return updateRundown(dt);
}

   反対側にいることが普通にある。割り当て固定だと誰もいない塁へ投げてしまう。 */
function rundownCover(base, exclude){
  const p=throwPoint(base);
  let best=null,bd=1e9;
  fielders.forEach(f=>{ if(f===exclude) return;
    const d=Math.hypot(p[0]-f.cx,p[1]-f.cy); if(d<bd){bd=d;best=f;} });
  if(best){ best.coverBase=base; setTarget(best,p[0],p[1]); }
  return best||fielders[0];
}

function coverOf(base, exclude){
  /* その塁のカバーに入っている野手が受け手。打った瞬間に割り当ててある。
     「今その塁に一番近い人」で選ぶと、たまたま近くにいただけの投手が受け手になり、
     実際には50ft離れているのに塁上でアウトが宣告される。 */
  const assigned=fielders.find(f=>f!==exclude && f.coverBase===base);
  if(assigned) return assigned;
  const p=throwPoint(base);
  let best=null,bd=1e9;
  fielders.forEach(f=>{ if(f===exclude) return;
    const d=Math.hypot(p[0]-f.cx,p[1]-f.cy); if(d<bd){bd=d;best=f;} });
  return best||fielders[0];
}

function beginRundown(r, hi){
  const T=throwPlay;
  const lo=Math.max(1,hi-1);
  T.stage='rundown';
  // loLim/hiLim = 走者が使える範囲。切り返しのたびに両側の野手が詰めてきて狭くなる
  // 保持者は実際に送球を受けた野手。塁に近いだけの別人にするとボールが瞬間移動する
  T.rd={ r, hi, lo, loLim:lo, hiLim:hi, holder:(T.receiver||T.thrower), sub:'chase', t:0, ex:0 };
  // 挟殺が始まったら、両側の塁にそれぞれ別の野手が入る（遊撃手・三塁手も加わる）
  rundownCover(hi, T.rd.holder);
  rundownCover(lo, T.rd.holder);
  r.extra=0; setAutoGoal(r, lo);            // まず戻ろうとする
  setMsg('挟まれた！','', '#ffc23d');
}

function updateRundown(dt){
  /* 走者と野手の移動は呼び出し元(updateThrowPhase)が既に1回行っている。
     ここで再度呼ぶと1フレームに2回動いてしまう（速度が2倍になる）ので呼ばない。 */
  const T=throwPlay, R=T.rd, r=R.r;
  R.t+=dt;
  const rp=runnerPos(r);

  if(R.sub==='chase'){
    ball.x=R.holder.cx; ball.y=R.holder.cy; ball.z=4.4;
    /* 走者の背中を追うだけでは同じ足の速さなら永久に追いつけない。
       実際の野手と同じく、走者の進路の少し先（8ft先）を目がけて塞ぎに行く。 */
    const ahead={...r, p: clamp(r.p + (r.goal>r.p?0.09:-0.09), 0, 4)};
    const ap=runnerPos(ahead);
    setTarget(R.holder, ap.x, ap.z);
    /* 塁に到達したかを先に見る。タッチ判定を先に行うと、同じフレームで塁に着いていても
       野手が近いというだけでアウトになってしまう（到達が先ならセーフが正しい）。 */
    if(R.t>0.25 && Math.abs(r.p-r.goal)<0.02 && Math.abs(r.goal-Math.round(r.goal))<0.01)
      return endRundown('セーフ！','#3fd66a');
    if(Math.hypot(R.holder.cx-rp.x, R.holder.cy-rp.z) < 3.0){
      markOut(r,'tag'); return endRundown('タッチアウト！','#95a3b4');
    }
    // 逃げ場が無くなったらタッチアウト
    if(R.hiLim-R.loLim < 0.13){ markOut(r,'tag'); return endRundown('タッチアウト！','#95a3b4'); }
    // 逃げ込み先に近づいたら、その方向の塁へ送球して切り返させる
    if(Math.abs(r.p-r.goal) < 0.20){
      const goingHi = r.goal > (R.loLim+R.hiLim)/2;
      const chasing = goingHi ? R.hi : R.lo;       // 走者が向かっている側
      const recv=rundownCover(chasing, R.holder);
      const p=throwPoint(chasing);
      /* 受け手が塁に入っていなければ投げない。投げると球が塁の上で止まり、
         受け手が着くまで判定が出ない（見た目も結果もおかしくなる）。
         受け手が着くまでは自分がその塁へ詰める。自分の方が先に着くならそのまま踏む。 */
      const recvGap = Math.hypot(p[0]-recv.cx, p[1]-recv.cy);
      const myGap   = Math.hypot(p[0]-R.holder.cx, p[1]-R.holder.cy);
      if(recvGap > 12){          // 受け手が塁に入りかけていれば投げてよい
        if(myGap <= recvGap) setTarget(R.holder, p[0], p[1]);   // 自分の方が近い＝踏みに行く
        if(R.t>9){ markOut(r,'tag'); return endRundown('タッチアウト！','#95a3b4'); }
        return;                                                  // まだ投げない
      }
      R.ex++;
      // 両側の野手が詰めてきて、走者の使える範囲が狭まる
      R.loLim=Math.min(R.loLim+0.10, R.hiLim-0.05);
      R.hiLim=Math.max(R.hiLim-0.10, R.loLim+0.05);
      const away = clamp(goingHi ? R.loLim : R.hiLim, R.loLim, R.hiLim);
      R.fumble = Math.random() < A.fumble(recv.cat)*2.2;
      /* 乱れる時は実際にそれた所へ投げる。以前は「送球が乱れてセーフ」と出るのに
         球はまっすぐ塁へ飛んでいたので、バグにしか見えなかった。 */
      let dest=p;
      if(R.fumble){
        const o=throwOffset(R.holder, Math.hypot(p[0]-R.holder.cx,p[1]-R.holder.cy));
        dest=[p[0]+o[0]*2.4, p[1]+o[1]*2.4];
      }
      launchThrow(R.holder.cx,R.holder.cy,dest[0],dest[1],armEff(R.holder));
      setTarget(recv, p[0], p[1]);          // 切り返しの受け手はその塁へ入る
      R.sub='relay'; R.recv=recv; R.dest=dest; R.rt=0;
      /* 走者は急停止して逆走する。切り返しのたびに止まって加速し直すので、
         そのぶん詰められる（挟殺で走者が追い込まれていくのはこのため）。 */
      r.extra=0; setAutoGoal(r, away); r.v=0;
    }
    if(R.t>9){ markOut(r,'tag'); return endRundown('タッチアウト！','#95a3b4'); }
    return;
  }
  if(R.sub==='relay'){
    R.rt+=dt;
    let acc=Math.min(0.30,(R.acc||0)+dt), g=0;
    while(acc>=PHYS_H && g++<900){ acc-=PHYS_H; stepBall(ball,PHYS_H); }
    R.acc=acc;
    /* 受け手が塁に着くまではボールを受け手の手へ移さない（塁の上で球が止まって見える）。 */
    const recvHere = !R.recv || Math.hypot(R.dest[0]-R.recv.cx, R.dest[1]-R.recv.cy) < 6;
    if((Math.hypot(ball.x-R.dest[0], ball.y-R.dest[1])<5 && recvHere) || R.rt>3.2){
      if(R.fumble) return endRundown('送球がそれてセーフ！','#3fd66a');
      // 受け手のすぐそばに走者がいればその場でタッチ
      const q=runnerPos(r);
      if(Math.hypot(R.recv.cx-q.x, R.recv.cy-q.z) < 3.0){
        markOut(r,'tag'); return endRundown('タッチアウト！','#95a3b4');
      }
      R.holder=R.recv; R.sub='chase';
    }
  }
}

function judgeAtBase(b){
  const T=throwPlay;
  if(T.kind==='pickoff'){
    // 飛び出した走者が塁へ戻れていなければアウト。塁間で捕まったら挟殺へ
    const cand=runners.filter(r=>!r.out && r.jumped && Math.abs(r.p-b)>0.02)
                      .sort((x,y)=>Math.abs(y.p-y.origin)-Math.abs(x.p-x.origin))[0];
    if(cand){
      if(cand.p>b+0.12){ T.stealText='牽制で挟まれた！'; return beginRundown(cand, b+1); }
      markOut(cand,'tag'); T.stealText='牽制アウト！';
    }else T.stealText='戻ってセーフ';
    return concludeSteal();
  }
  if(T.kind==='steal'){
    // 盗塁はタッチプレー。送球が着いた時に走者が塁に達していなければアウト
    const cand=runners.filter(r=>!r.out && r.p<b && r.goal>=b).sort((x,y)=>y.p-x.p)[0];
    if(cand && runnerETA(cand,b)>0.02){ markOut(cand,'tag'); T.stealText='盗塁失敗！'; }
    else T.stealText='盗塁成功！';
    return concludeSteal();
  }
  if(b==='P') return concludePlay();      // 投手への返球はアウト判定を伴わない
  /* 外野への安打では判定しない。塁打数（award）は「回収の早さから安全に取れる塁」を
     すでに表しているので、そこへ向かう走者を送球で刺すと二重に不利になる。
     実際、これが原因で三塁打を打った打者が三塁で刺され、単打の一塁走者も二塁で刺されて
     ホームラン以外で1点も入らない状態になっていた。送球の演出だけ行って結果に進む。 */
  if(T.kind==='fly'){
    if(b==='P') return concludePlay();
    // 離塁していて戻り切れていない走者は離塁アウト。タッチアップ組は間に合えばセーフ
    /* 離塁アウトにできるのは、投げた塁を元の塁とする走者だけ。
       送球先と無関係に「一番離れている走者」を選ぶと、一塁へ投げて三塁走者がアウトになる。 */
    const back = runners.filter(r=>!r.out && r.mustReturn && r.origin===b && Math.abs(r.p-r.origin)>0.02)
                        .sort((x,y)=>Math.abs(y.p-y.origin)-Math.abs(x.p-x.origin))[0];
    if(back && Math.abs(back.p-back.origin)>0.02){
      markOut(back,'force');
      T.flyText='離塁アウト！';
    }else{
      const tagger = runners.filter(r=>!r.out && !r.mustReturn && r.p<b && r.goal>=b)
                            .sort((x,y)=>y.p-x.p)[0];
      if(tagger && runnerETA(tagger,b)>0.02) return beginRundown(tagger, b);
    }
    return concludePlay();
  }
  /* 外野への安打でも内野ゴロと同じように判定する。
     以前は「塁打数ぶんは無条件セーフ」にしていたので、間に合っていない走者も刺せなかった。 */
  // 封殺・タッチの判定
  const cand = runners.filter(r=>!r.out && r.p<b && r.goal>=b).sort((x,y)=>y.p-x.p)[0];
  let outMade=false;
  /* 塁を踏むだけでアウトにできるのは封殺だけ。強制されていない走者は
     タッチが必要なので、間に合わなくても即アウトにせず挟殺プレーへ回す。
     （守備側が自分で送球先を指定した時に、この場面が起きる） */
  if(cand && runnerETA(cand,b)>0.02){
    /* 塁を踏むだけでアウトにできる（封殺）のは、押し出されている走者が
       すぐ次の塁へ向かっている時だけ。打者走者なら一塁だけ。
       それ以外はタッチが要るので、間に合っていなくても挟殺プレーへ回す。 */
    const forceable = (cand.origin===0) ? (b===1) : (isForced(cand) && b===cand.origin+1);
    if(!forceable) return beginRundown(cand, b);
    markOut(cand,'force'); outMade=true;
  }
  else if(cand){ cand.p=Math.max(cand.p,b); }

  // 併殺を狙えるか（一塁がまだ空いていて、打者走者が残っている）
  const br = runners.find(r=>r.origin===0 && !r.out);
  // 併殺は「速く捕れた打球」でだけ狙える。中継のひねりぶん持ち替えも遅くなる
  if(outMade && b>=2 && !T.relayed && baseOuts()+countOuts()<3 && br && br.p<1 && T.fieldT<2.2){
    T.relayed=true; T.stage='transfer'; T.t=0;
    T.transfer=A.transfer(T.thrower.fld,T.thrower.cat)*0.75+0.16; T.target=1;
    // 一塁へ投げるのは「今ボールを持っている野手」。塁の近くにいるだけの別人が投げない
    T.thrower = T.receiver || T.thrower;
    ball.x=T.thrower.cx; ball.y=T.thrower.cy;
    return;
  }
  concludePlay();
}

function startFlight(c, powerMul, from){
  const v=c.exit*1.467, la=c.la*RAD, sp=c.spray*RAD;
  ball={ x:from[0], y:from[2], z:from[1], t:0,
    vx:v*Math.cos(la)*Math.sin(sp), vy:v*Math.cos(la)*Math.cos(sp), vz:v*Math.sin(la),
    exit:c.exit, la:c.la, spray:c.spray, maxZ:from[1], landed:false };
  const plan=planPlay(ball);
  ball.pred=plan.firstLand; ball.primary=plan.f; ball.canCatchAir=plan.air; ball.planT=plan.t;
  window.__contactGo=!plan.air;      // 空中で捕られない打球＝押し出される走者は打った瞬間に走る
  /* 打った瞬間に、捕る人以外は自分の受け持つ塁のカバーへ走る。
     これをしないと送球が届いた時にベースに誰もいない（受け手不在になる）。
     二塁は二塁手と遊撃手のうち、打球を捕りに行っていない方が入る。 */
  /* どの塁を誰が守るかを先に決める。本来の担当者が打球を追っている時は代役を立てる。
     一塁手がゴロを捕りに出たら投手が一塁に入る（実際の野球と同じ）。
     これが無いと、一塁へ送球しても受け手が50ft離れた所にいて、
     誰も塁を踏んでいないのにアウトになる。 */
  fielders.forEach(f=>{ f.primary=(f===plan.f); });
  const byName = n => fielders.find(f=>f.n===n);
  const assigned = new Set(fielders.filter(f=>f.primary));
  // 1人が2つの塁を掛け持ちしないよう、埋まった順に外して割り当てる
  const take = names => { for(const n of names){ const f=byName(n);
    if(f && !assigned.has(f)){ assigned.add(f); return f; } } return null; };
  fielders.forEach(f=>{ f.coverBase=null; });
  const put = (b, names) => { const f=take(names); if(f){ f.coverBase=b; const p=throwPoint(b); setTarget(f,p[0],p[1]); } };
  put(1, ['一','投','二']);          // 一塁手が捕りに出たら投手が入る
  put(3, ['三','遊','投']);          // 三塁手が捕りに出たら遊撃手が入る
  put(2, ['二','遊','投','一']);     // 二塁は残った内野手
  put(4, ['捕','投']);     // 本塁は送球先の番号(4)で持つ。throwPoint(4)は本塁を指す
  fielders.forEach(f=>{
    if(f.primary){ setTarget(f, plan.x, plan.y); return; }
    if(assigned.has(f)) return;
    setTarget(f, f.x+(plan.x-f.x)*0.25, f.y+(plan.y-f.y)*0.25);   // 残りは打球方向へ
  });
  beginRunners(S.bases, S.stealing ? 'keep' : null);   // 盗塁中ならその走者をそのまま使う
  /* 捕られようのない打球（ゴロ・抜けた当たり）では、押し出される走者は打った瞬間に走り出す。
     着地を待ってから走らせると、線ドライブで2秒近く出遅れ、単打で誰も進めなくなっていた。 */
  /* 2アウトなら、打ち上げても走者は止まらずスタートする（捕られたらどのみち攻撃終了）。 */
  if(window.__contactGo || S.outs>=2){ ball.forcedGo=true;
    /* リードから戻らずそのまま走り出すので、静止状態ではなく助走がついている。 */
    /* 捕られようのない打球なら、押し出されていない走者も次の塁へ走り出す。
       実際の走塁も、ゴロを見たらまず走り出して、行けなければ戻る。
       行けるかどうかは野手が捕った時点で safeReach が決め直す（無理なら戻る）。 */
    runners.forEach(r=>{ if(r.origin>0){ setAutoGoal(r, Math.min(4, r.origin+1)); r.v=(r.sp||23)*0.5; } }); }
  S.preOuts=0; S.outOrder=[]; S.playWait=0;   // このプレーで先に加算したアウト数／アウトの成立順
  throwAnim=null;
  S.phase='flight'; S.fieldView=true; trail=[];
  setMsg('','');
  ui();                       // 自操作のボタンを有効にする
}

function stepFlight(dt){
  stepBall(ball,dt); ball.t+=dt;
  ball.maxZ=Math.max(ball.maxZ,ball.z);
  if(ball.z<=0.02 && ball.t>0.2) ball.landed=true;
  const prim=ball.primary;
  /* 担当野手は「先回り地点」へ走って待つ。ボールの現在地を追いかけると、球の方が速い場合に
     永久に追いつけず、脇を通過するだけになる。先回りに間に合わなかった時（予定時刻を過ぎても
     取れていない時）だけ、実際のボールを追いかけるように切り替える。 */
  if(ball.t > (ball.planT||0) + 0.15){ setTarget(prim, ball.x, ball.y); }
  /* 担当が捕り損ねて球が脇を抜けた時は、その場から一番早く追いつける野手へ引き継ぐ。
     引き継ぎが無いと、投手の横を抜けた球を投手だけが延々と追いかけ、
     二塁手は塁上に立ったまま、遊撃手は棒立ちのまま、という場面になる。 */
  if(ball.landed && ball.t > (ball.replanT||0) + 0.35){
    ball.replanT = ball.t;
    if(Math.hypot(ball.x-prim.cx, ball.y-prim.cy) > CATCH_R + 3){
      const plan2 = planPlay(ball, true);          // 今いる場所から測り直す
      if(plan2.f !== prim){
        const freed = plan2.f.coverBase;
        ball.primary = plan2.f; ball.planT = ball.t + plan2.t;
        ball.dPrev = undefined; ball.dMin = undefined;
        fielders.forEach(f=>{ f.primary=(f===plan2.f); });
        plan2.f.coverBase = null;
        setTarget(plan2.f, plan2.x, plan2.y);
        if(freed!=null) rundownCover(freed, plan2.f);   // 空いた塁は別の野手が埋める
        return false;
      }
    }
  }
  moveFielders(dt, ball.t>F_REACT);
  updateRunners(dt);
  const dist=Math.hypot(ball.x,ball.y), ang=Math.atan2(ball.x,ball.y)/RAD;
  /* 外野に落ちた（＝捕られない）と分かった時点で、塁上の走者は次の塁へ走り出す。
     捕球されるまで小さなリードで待たせていたため、単打で二塁走者が三塁に刺されていた。 */
  /* 押し出される走者は、打球が地面に着いた（＝捕られないと分かった）時点で走り出す。
     捕球後に走り出す作りだと、守備が捕った瞬間には誰も走っておらず、
     二塁の封殺を狙えない（実際の野球では打った瞬間に走っている）。 */
  if(ball.landed && !ball.forcedGo){
    ball.forcedGo=true;
    runners.forEach(r=>{ if(r.origin>0 && isForced(r)) setAutoGoal(r, Math.min(4, r.origin+1)); });
  }
  /* 内野を抜けたと分かった時点で走り出す。着地を待つ必要はない（空中でも
     捕られないと分かっていれば走り出すのが実際の走塁）。着地待ちにしていたため、
     押し出されない走者の反応が0.5〜1秒遅れていた。 */
  if(!ball.advanced && dist>145 && (ball.landed || !ball.canCatchAir)){
    ball.advanced=true;
    runners.forEach(r=>{ if(r.origin>0){ setAutoGoal(r, Math.max(r.autoGoal||0, r.origin+1));
      r.v=Math.max(r.v||0,(r.sp||23)*0.5); } });     // リードから助走がついている
  }
  /* 高く上がって捕られそうな打球では、走者はいったん塁に戻って捕球を待つ（タッチアップの準備）。
     これが無いと、リードを取っているだけで離塁扱いになり必ず離塁アウトになってしまう。
     自分でSを押して飛び出した走者はそのまま＝戻れなければ離塁アウトになる。 */
  if(!ball.landed && !ball.retreated && ball.canCatchAir && ball.t>0.35 && ball.maxZ>15 && baseOuts()<2){
    ball.retreated=true;
    runners.forEach(r=>{ if(r.origin>0 && r.cmd!=='S') setAutoGoal(r, r.origin); });
  }
  if(Math.abs(ang)>45.5 && (ball.landed||dist>90)){ foulBall(); return true; }
  const fd=fenceDist(clamp(ang,-45,45));
  if(dist>fd && Math.abs(ang)<=45.5){
    /* フェンスの高さは9.4ft。判定は「柵の上を越えたか否か」だけで決める。
       ・越えた かつ ノーバウンド → 本塁打
       ・越えた かつ 一度でも地面に触れている → エンタイトルツーベース
       ・越えていない（高さ9.4ft以下）→ 壁に当たって跳ね返る。転がって到達した打球も同じ
       以前は「地面に触れたか」で先に分岐していたため、ワンバウンドで壁に直撃した打球まで
       エンタイトルツーベースになっていた。 */
    if(ball.z>9.4){
      finishPlay(ball.landed ? resolveHit(4.6,{x:ball.x,y:ball.y},true) : resolveHomer());
      return true;
    }
    const nx=ball.x/dist, ny=ball.y/dist;            // 外向きの法線
    const vr=ball.vx*nx + ball.vy*ny;                // 壁へ向かう速度成分
    if(vr>0){
      ball.wallHit=true;
      ball.vx -= 1.35*vr*nx; ball.vy -= 1.35*vr*ny;  // 反発係数0.35で内側へ返す
      ball.vz *= 0.55;
      ball.x = nx*(fd-0.6); ball.y = ny*(fd-0.6);
      ball.canCatchAir = false;                      // 壁に当たった球はもう捕球できない
      const plan=planPlay(ball, true);       // 反射後は「今いる場所」から測り直す
      ball.primary=plan.f; ball.planT=ball.t+plan.t;
      ball.dPrev=undefined; ball.dMin=undefined;   // 担当が変わったら最接近の記録もやり直す
      fielders.forEach(f=>{ f.primary=(f===plan.f); if(f.primary) setTarget(f, plan.x, plan.y); });
    }
  }
  /* 捕れる範囲＝グラブが届く距離だけ。広くすると「追いつけていないのに横を通過した球」まで
     処理されてしまう（実際に指摘のあった不具合）。届かなければ野手は追い続け、安打になる。 */
  const d2=Math.hypot(ball.x-prim.cx, ball.y-prim.cy);
  /* 「範囲に入った瞬間」ではなく「最も近づいた瞬間」に捕る。入った瞬間に判定すると
     常に範囲の外縁（体から4ft横）で捕ることになり、脇を通り抜けたのにアウトに見える。
     最接近したか(dMin)と、遠ざかり始めたか(receding)で判断する。
     以前は「近づいている間は1.2ft以内」という別の条件が混ざっていて、
     グラブの届く範囲を通った打球が安打になっていた。 */
  const receding = d2 > (ball.dPrev===undefined ? 1e9 : ball.dPrev);
  ball.dPrev = d2;
  ball.dMin = Math.min(ball.dMin===undefined ? 1e9 : ball.dMin, d2);
  // 捕れる高さは planPlay と同じ基準（頭上を越える打球を捕ったことにしない）
  const reach = (ball.vz<0) ? 9.5 : 7.0;
  if(!ball.landed && ball.canCatchAir && ball.t>0.45 && ball.z>1.0 && ball.z<reach && ball.dMin<CATCH_R && (receding || d2<1.2)){
    const c=resolveCatch();
    /* 捕球が3アウト目なら、その瞬間にイニング終了。走者の攻防は起きない
       （2アウトからのフライで併殺表示が出ていた不具合の対策）。 */
    if(baseOuts()+1>=3){
      const nb=[null,null,null];
      /* 走らせた走者の行き先も元の塁へ戻す。戻さないと記録は元の塁なのに
         画面では次の塁へ走り、最後にそこへ瞬間移動してから消える。 */
      runners.forEach(r=>{ if(r.out||r.origin===0) return;
        r.goal=r.origin; r.autoGoal=r.origin; r.cmd=null;
        const g=Math.round(r.origin); if(g>=1&&g<=3) nb[g-1]={id:Math.random(),sp:r.sp}; });
      finishPlay({out:1, runs:0, bases:nb, hit:false, moves:null, throwTo:null,
        text:`${prim.n}${ball.flyKind||'フライ'} アウト`, color:'#95a3b4'});
      return true;
    }
    /* 塁上に走者がいなければ、捕った瞬間に終わり。
       返球が投手に返るまで待つと、ただの外野フライで数秒間なにも起きない。 */
    if(!runners.some(r=>r.origin>0 && !r.out)){
      finishPlay({out:1, runs:0, bases:[null,null,null], hit:false, moves:null, throwTo:null, quick:1.3,
        text:`${prim.n}${ball.flyKind||'フライ'} アウト`, color:'#95a3b4'});
      return true;
    }
    beginThrowPhase(prim, 'fly', 0, c.lead); return true;  // 捕球後の走者の攻防へ
  }
  if(ball.landed && ((d2<CATCH_R && ball.z<6.0) || ball.t>7) || ball.t>9){
    const fd=Math.hypot(prim.cx,prim.cy);
    if(fd<158 && ball.maxZ<26){ beginThrowPhase(prim,'infield',1); return true; }
    beginThrowPhase(prim,'outfield',1); return true;   // 塁打数は走者の到達で決まる
  }
  return false;
}