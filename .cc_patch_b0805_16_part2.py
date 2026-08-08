# Deflection handoff through API.
old="""  const plan = planPlay(ball, true);
  const freed = plan.f.coverBase;
  /* はじいた直後の計画は当てにしない（弾かれた球の転がりは予測とずれやすい）。
     計画時刻(planT)を先に置くと、その間は再照準が封じられ、外れた地点で野手が
     立ち尽くす（実測: エラー後に1.2秒棒立ち、録画172217）。すぐ再照準できるようにする。 */
  ball.primary = plan.f; ball.planT = ball.t + Math.min(plan.t, 0.25); plan.f.coverBase = null;
  fielders.forEach(x=>{ x.primary=(x===plan.f); });
  setTarget(plan.f, plan.x, plan.y);
  if(freed!=null) rundownCover(freed, plan.f);
"""
new="""  const plan = planPlay(ball, true);
  /* はじいた直後の計画は当てにしない（弾かれた球の転がりは予測とずれやすい）。
     計画時刻(planT)を先に置くと、その間は再照準が封じられ、外れた地点で野手が
     立ち尽くす（実測: エラー後に1.2秒棒立ち、録画172217）。すぐ再照準できるようにする。 */
  const handoff=setPrimaryFielder(plan.f,'deflect',[plan.x,plan.y]);
  ball.planT = ball.t + Math.min(plan.t, 0.25);
  if(handoff.freed!=null) rundownCover(handoff.freed,plan.f);
"""
html=swap(html,old,new,'deflection assignment')

# General relay can borrow a cover only if it is atomically replaced.
old="""        const pick = (freeOnly)=>{ let cut=null,cd=1e9;
          fielders.forEach(f=>{ if(f===T.thrower) return;
            if(freeOnly && f.coverBase!=null) return;
            const t=Math.hypot(p[0]-f.cx,p[1]-f.cy)+Math.hypot(f.cx-T.thrower.cx,f.cy-T.thrower.cy);
            if(t<cd && Math.hypot(f.cx-T.thrower.cx,f.cy-T.thrower.cy)<maxD){ cd=t; cut=f; } });
          return cut; };
        const cut = pick(true) || pick(false);
        if(cut){
          const freed = cut.coverBase;
          cut.coverBase=null;
          recv=cut; p=[cut.cx,cut.cy]; T.relayTo=T.target;
          if(freed!=null) rundownCover(freed, cut);      // 抜けた塁は別の野手が埋める
        }
"""
new="""        const pick = (freeOnly)=>{ let cut=null,cd=1e9;
          fielders.forEach(f=>{ if(f===T.thrower || f===recv || f.primary) return;
            if(freeOnly && f.coverBase!=null) return;
            if(!freeOnly && f.coverBase!=null &&
               !findCoverCandidate(f.coverBase,[f,T.thrower,recv])) return;
            const t=Math.hypot(p[0]-f.cx,p[1]-f.cy)+Math.hypot(f.cx-T.thrower.cx,f.cy-T.thrower.cy);
            if(t<cd && Math.hypot(f.cx-T.thrower.cx,f.cy-T.thrower.cy)<maxD){ cd=t; cut=f; } });
          return cut; };
        const cut = pick(true) || pick(false);
        if(cut && releaseCoverForTemporaryRole(cut,'relay',[T.thrower,recv])){
          recv=cut; p=[cut.cx,cut.cy]; T.relayTo=T.target;
        }
"""
html=swap(html,old,new,'atomic relay role')

# Long home cutoff no longer drops the old base cover.
old="""        if(cut && cut!==T.thrower && cut!==recv && !cut.primary){
          const cd = Math.max(1, Math.hypot(T.thrower.cx-p[0], T.thrower.cy-p[1]));
          cut.coverBase=null;
          setTarget(cut, p[0]+(T.thrower.cx-p[0])/cd*45, p[1]+(T.thrower.cy-p[1])/cd*45);
        }
"""
new="""        if(cut && cut!==T.thrower && cut!==recv && !cut.primary &&
           releaseCoverForTemporaryRole(cut,'home-cutoff',[T.thrower,recv])){
          const cd = Math.max(1, Math.hypot(T.thrower.cx-p[0], T.thrower.cy-p[1]));
          setTarget(cut, p[0]+(T.thrower.cx-p[0])/cd*45, p[1]+(T.thrower.cy-p[1])/cd*45);
        }
"""
html=swap(html,old,new,'atomic home cutoff role')

# Rundown cover only uses an idle fielder or the existing cover for that base.
old="""function rundownCover(base, exclude, exclude2){
  const p=throwPoint(base);
  let best=null,bd=1e9;
  fielders.forEach(f=>{ if(f===exclude || f===exclude2) return;
    const d=Math.hypot(p[0]-f.cx,p[1]-f.cy); if(d<bd){bd=d;best=f;} });
  if(best){ best.coverBase=base; setTarget(best,p[0],p[1]); }
  return best||fielders[0];
}
"""
new="""function rundownCover(base, exclude, exclude2){
  const best=findCoverCandidate(base,[exclude,exclude2]);
  if(!best) return null;
  if(best.coverBase!==base) assignCoverRole(best,base,'rundown-cover');
  else{ const p=throwPoint(base); setTarget(best,p[0],p[1]); }
  return best;
}
"""
html=swap(html,old,new,'safe rundown cover')
old="""  const assigned=fielders.find(f=>f!==exclude && f.coverBase===base);
  if(assigned) return assigned;
  const p=throwPoint(base);
  let best=null,bd=1e9;
  fielders.forEach(f=>{ if(f===exclude) return;
    const d=Math.hypot(p[0]-f.cx,p[1]-f.cy); if(d<bd){bd=d;best=f;} });
  return best||fielders[0];
"""
new="""  const assigned=fielders.find(f=>f!==exclude && f.coverBase===base);
  if(assigned) return assigned;
  const created=rundownCover(base,exclude);
  if(created) return created;
  return fielders.find(f=>f!==exclude&&!f.primary)||fielders[0];
"""
html=swap(html,old,new,'coverOf safe fallback')
old="""      const recv=rundownCover(chasing, R.holder);
      const p=throwPoint(chasing);
      /* 受け手が塁に入っていなければ投げない。投げると球が塁の上で止まり、
"""
new="""      const recv=rundownCover(chasing, R.holder);
      const p=throwPoint(chasing);
      if(!recv){
        setTarget(R.holder,p[0],p[1]);
        if(R.t>9) return timeoutRundown();
        return;
      }
      /* 受け手が塁に入っていなければ投げない。投げると球が塁の上で止まり、
"""
html=swap(html,old,new,'rundown no receiver guard')

# Start play assignments via the API.
old="""  const plan=planPlay(ball);
  ball.pred=plan.firstLand; ball.primary=plan.f; ball.canCatchAir=plan.air; ball.planT=plan.t;
"""
new="""  const plan=planPlay(ball);
  ball.pred=plan.firstLand; ball.canCatchAir=plan.air; ball.planT=plan.t;
  clearAllCoverRoles('batted-ball-reset');
  setPrimaryFielder(plan.f,'batted-ball',[plan.x,plan.y]);
"""
html=swap(html,old,new,'start primary assignment')
html=swap(html,"""  fielders.forEach(f=>{ f.primary=(f===plan.f); });
""","""  // primaryはsetPrimaryFielderで確定済み
""",'remove direct start primary flags')
html=swap(html,"""  fielders.forEach(f=>{ f.coverBase=null; });
  const put = (b, names) => { const f=take(names); if(f){ f.coverBase=b; const p=throwPoint(b); setTarget(f,p[0],p[1]); } };
""","""  const put = (b,names)=>{ const f=take(names); if(f) assignCoverRole(f,b,'batted-ball-cover'); };
""",'start cover API')
