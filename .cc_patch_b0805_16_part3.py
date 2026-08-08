# Landing handoff and old-primary role via API.
old="""        const freed = plan2.f.coverBase;
        ball.primary = plan2.f; ball.planT = ball.t + plan2.t;
        ball.dPrev = undefined; ball.dMin = undefined;
        fielders.forEach(f=>{ f.primary=(f===plan2.f); });
        plan2.f.coverBase = null;
        setTarget(plan2.f, plan2.x, plan2.y);
"""
new="""        const handoff=setPrimaryFielder(plan2.f,'rolling-handoff',[plan2.x,plan2.y]);
        const freed=handoff.freed;
        ball.planT = ball.t + plan2.t;
        ball.dPrev = undefined; ball.dMin = undefined;
"""
html=swap(html,old,new,'rolling handoff API')
old="""            prim.coverBase=bb; const p=throwPoint(bb); setTarget(prim,p[0],p[1]);
"""
new="""            assignCoverRole(prim,bb,'old-primary-cover');
"""
html=swap(html,old,new,'old primary cover API')

# Wall handoff: if primary changes, end this physics tick and reacquire next tick.
old="""      const plan=planPlay(ball, true);       // 反射後は「今いる場所」から測り直す
      const freedW = plan.f.coverBase;
      ball.primary=plan.f; ball.planT=ball.t+plan.t;
      ball.dPrev=undefined; ball.dMin=undefined;   // 担当が変わったら最接近の記録もやり直す
      plan.f.coverBase=null;
      fielders.forEach(f=>{ f.primary=(f===plan.f); if(f.primary) setTarget(f, plan.x, plan.y); });
      if(freedW!=null) rundownCover(freedW, plan.f);   // カバーを外れた塁は別の野手が埋める
"""
new="""      const plan=planPlay(ball, true);       // 反射後は「今いる場所」から測り直す
      const handoff=setPrimaryFielder(plan.f,'wall-handoff',[plan.x,plan.y]);
      ball.planT=ball.t+plan.t;
      ball.dPrev=undefined; ball.dMin=undefined;   // 担当が変わったら最接近の記録もやり直す
      if(handoff.freed!=null) rundownCover(handoff.freed,plan.f);   // カバーを外れた塁は別の野手が埋める
      /* この刻みのprimは反射前の旧担当を指している。交代したならここで刻みを終え、
         次の物理刻みで新担当を再取得する（Sol Ultra所見4の旧担当捕球を防ぐ）。 */
      if(handoff.changed) return false;
"""
html=swap(html,old,new,'wall handoff API and stale guard')

# Reset all assignments, not just primary flags.
old="""function resetFielders(){
  /* 前進守備（セオリー準拠 2026-08-04導入）: 三塁走者あり・2死未満なら内野は前へ
"""
new="""function resetFielders(){
  clearFieldingAssignments('reset');
  /* 前進守備（セオリー準拠 2026-08-04導入）: 三塁走者あり・2死未満なら内野は前へ
"""
html=swap(html,old,new,'reset assignments')
html=swap(html,"""    f.primary=false; f.face=0; f.v=0; f.stun=0; f.fumbled=false; f.run=0;
""","""    f.face=0; f.v=0; f.stun=0; f.fumbled=false; f.run=0;
""",'remove reset direct primary')

# Pickoff and steal cover maps via API.
html=swap(html,"""  fielders.forEach(f=>{ f.coverBase=null; });
  const map={1:'一',2:'遊',3:'三',4:'捕'};
  [1,2,3,4].forEach(b=>{ const f=fielders.find(x=>x.n===map[b]);
    if(f){ f.coverBase=b; const p=throwPoint(b); setTarget(f,p[0],p[1]); } });
""","""  clearAllCoverRoles('pickoff-reset');
  const map={1:'一',2:'遊',3:'三',4:'捕'};
  [1,2,3,4].forEach(b=>{ const f=fielders.find(x=>x.n===map[b]);
    if(f) assignCoverRole(f,b,'pickoff-cover'); });
""",'pickoff cover API')
html=swap(html,"""    fielders.forEach(f=>{ f.coverBase=null; });
    const map={1:'一',2:'遊',3:'三',4:'投'};
    [1,2,3,4].forEach(b=>{ const f=fielders.find(x=>x.n===map[b]);
      if(f){ f.coverBase=b; const p=throwPoint(b); setTarget(f,p[0],p[1]);
        /* 内野手は投手が投げる動作の間に塁側へ寄っている。完全な静止から走り出すのではない。
""","""    clearAllCoverRoles('steal-reset');
    const map={1:'一',2:'遊',3:'三',4:'投'};
    [1,2,3,4].forEach(b=>{ const f=fielders.find(x=>x.n===map[b]);
      if(f && assignCoverRole(f,b,'steal-cover')){
        /* 内野手は投手が投げる動作の間に塁側へ寄っている。完全な静止から走り出すのではない。
""",'steal cover API start')
# Closing braces are same: old had `f.v... } });`, new has if block too, so no further change.

HTML.write_text(html,encoding='utf-8')
