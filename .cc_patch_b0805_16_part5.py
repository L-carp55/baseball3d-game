# Full harness tests31-32.
h=HARNESS.read_text(encoding='utf-8')
marker="  console.log(JSON.stringify(out,null,1));\n  return out;"
if h.count(marker)!=1: raise SystemExit('harness marker')
insert=r'''  // ===== test31: FieldingAssignmentは役割を奪わず原子的に再配置する =====
  (function(){
    const chk=[];
    try{
      newGame(); FIELD_ASSIGN_SEQ=0;
      const pri=fielders[0], occupied=fielders[1], free=fielders[2];
      fielders.forEach((f,i)=>{ f.primary=false; f.coverBase=null; f.cx=300+i*10; f.cy=300; f.tx=f.cx; f.ty=f.cy; });
      ball={primary:pri}; pri.primary=true;
      const p2=throwPoint(2); pri.cx=p2[0]; pri.cy=p2[1]; occupied.cx=p2[0]+1; occupied.cy=p2[1]; occupied.coverBase=1;
      free.cx=p2[0]+20; free.cy=p2[1];
      const chosen=rundownCover(2,null,null);
      chk.push({n:'挟殺カバーはprimary/別塁担当を奪わない',ok:chosen===free&&pri.primary&&occupied.coverBase===1&&free.coverBase===2});

      newGame(); FIELD_ASSIGN_SEQ=0;
      const cut=fielders[0], repl=fielders[1];
      fielders.forEach((f,i)=>{ f.primary=false; f.coverBase=i>1?i:null; f.cx=i*20; f.cy=0; });
      cut.coverBase=1; repl.coverBase=null;
      const released=releaseCoverForTemporaryRole(cut,'test',[null]);
      chk.push({n:'一時役割は元カバーを代役へ移す',ok:released&&cut.coverBase==null&&repl.coverBase===1});

      newGame(); FIELD_ASSIGN_SEQ=0;
      const blocked=fielders[0];
      fielders.forEach((f,i)=>{ f.primary=false; f.coverBase=i+1; });
      blocked.coverBase=1;
      const refused=releaseCoverForTemporaryRole(blocked,'test',fielders.slice(1));
      chk.push({n:'代役不在ならカバーを引き抜かない',ok:refused===false&&blocked.coverBase===1});

      newGame(); FIELD_ASSIGN_SEQ=0;
      const old=fielders[0], next=fielders[1]; ball={primary:old};
      fielders.forEach(f=>{f.primary=false;f.coverBase=null;}); old.primary=true; next.coverBase=3;
      const handoff=setPrimaryFielder(next,'test-primary',[12,34]);
      chk.push({n:'primary交代はcover解放とフラグ更新を同時に行う',ok:handoff.changed&&handoff.freed===3&&ball.primary===next&&next.primary&&!old.primary&&next.coverBase==null&&next.tx===12&&next.ty===34});
    }catch(e){chk.push({n:'例外',ok:false,e:e.message});}
    const bad=chk.filter(x=>!x.ok);
    out.test31_FieldingAssignment契約={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

  // ===== test32: 壁反射で担当交代した同じ刻みに旧担当を使わない =====
  (function(){
    let res={};
    const savedPlan=window.planPlay, savedRandom=Math.random;
    try{
      Math.random=()=>0.5;
      newGame(); S.half=0; S.phase='flight'; S.outs=0; S.preOuts=0; S.throwCount=0; runners=[];
      const oldPrim=fielders.find(f=>f.n==='左'), newPrim=fielders.find(f=>f.n==='中');
      fielders.forEach(f=>{f.primary=false;f.coverBase=null;f.v=0;f.stun=0;f.fumbled=false;f.run=0;f.tx=f.cx;f.ty=f.cy;});
      oldPrim.cx=0; oldPrim.cy=399.4; oldPrim.tx=0; oldPrim.ty=399.4; oldPrim.primary=true;
      newPrim.cx=100; newPrim.cy=100; newPrim.tx=100; newPrim.ty=100;
      ball={x:0,y:399.9,z:0.01,t:1,vx:0,vy:100,vz:-1,maxZ:10,landed:true,canCatchAir:false,
        primary:oldPrim,planT:999,aimT:999,replanT:999,acc:0,exit:70,la:0,spray:0};
      window.planPlay=()=>({f:newPrim,t:1,x:0,y:350,air:false,firstLand:{x:0,y:350,z:0,t:1}});
      stepFlight(PHYS_H);
      const stale=S.phase==='throwing'&&throwPlay&&throwPlay.thrower===oldPrim&&ball.primary===newPrim;
      res={assigned:ball.primary&&ball.primary.n,phase:S.phase,staleCaught:!!stale,
        verdict:(ball.primary===newPrim&&!stale)?'PASS':'FAIL'};
    }catch(e){res={verdict:'FAIL',e:e.message};}
    finally{window.planPlay=savedPlan;Math.random=savedRandom;}
    out.test32_壁反射担当交代=res;
  })();

'''
h=h.replace(marker,insert+marker,1)
HARNESS.write_text(h,encoding='utf-8')

print('patched b0805-16')
