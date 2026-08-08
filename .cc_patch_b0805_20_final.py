from pathlib import Path

# Apply the refined lifecycle patch first.
exec(compile(Path('.cc_patch_b0805_20_retry.py').read_text(encoding='utf-8'),'.cc_patch_b0805_20_retry.py','exec'),{'__name__':'__main__'})

p=Path('baseball3d.html')
s=p.read_text(encoding='utf-8')
old="  if(T.target==='P' && T.stage!=='rundown' && !flyWait && !keyHeld && allSettled) return requestPlayConclusion('request');\n"
new="""  if(T.target==='P' && T.stage!=='rundown' && !flyWait && !keyHeld && allSettled){
    /* 終了要求がlive-ball等で拒否された時はreturnしない。ここは物理更新より前なので、
       returnすると同じ球位置・速度のまま毎フレーム再び拒否され、送球が永久に凍結する。 */
    if(requestPlayConclusion('settled-return')) return;
  }
"""
if s.count(old)!=1: raise SystemExit(f'pre-physics conclusion anchor={s.count(old)}')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

gp=Path('_architecture_guard_20260808.js')
g=gp.read_text(encoding='utf-8')
# Replace the brittle watchdog regexp with direct inclusion plus the single-call ownership metric.
import re
pat=r"check\('watchdog uses lifecycle gateway',[\s\S]*?'watchdog gateway'\);"
g2,n=re.subn(pat,"check('watchdog uses lifecycle gateway',clean.includes(\"requestPlayConclusion('watchdog')\")&&concludeCalls===1,'watchdog gateway');",g,count=1)
if n!=1: raise SystemExit(f'watchdog guard replacement={n}')
g=g2
anchor="check('watchdog uses lifecycle gateway',clean.includes(\"requestPlayConclusion('watchdog')\")&&concludeCalls===1,'watchdog gateway');\n"
extra=anchor+"check('rejected pre-physics conclusion falls through',!/allSettled\\)\\s*return requestPlayConclusion/.test(clean),'no frozen live throw');\n"
if g.count(anchor)!=1: raise SystemExit('fallthrough guard anchor')
g=g.replace(anchor,extra,1)
gp.write_text(g,encoding='utf-8')

# Add a direct regression: rejection must leave ball state available for the stage handler, not return a truthy close.
hp=Path('_test_harness_20260804.js')
h=hp.read_text(encoding='utf-8')
marker="  console.log(JSON.stringify(out,null,1));\n  return out;"
if h.count(marker)!=1: raise SystemExit('harness marker')
insert=r'''  // ===== test42: 終了拒否で空中送球の物理を凍結しない =====
  (function(){
    let res={};
    try{
      newGame(); S.outs=0; S.preOuts=0; runners=[]; S.phase='throwing';
      const f=fielders.find(x=>x.n==='遊');
      ball={x:0,y:0,z:8,vx:80,vy:20,vz:4,t:0,landed:false};
      throwPlay={stage:'fly',kind:'infield',target:'P',thrower:f,receiver:f,t:2,fieldT:1,award:1,relayed:false,dest:[0,60.5],acc:0};
      const before={x:ball.x,y:ball.y,z:ball.z};
      const closed=requestPlayConclusion('test-fallthrough');
      // request itself must reject; then one normal updateThrowPhase tick must move the live ball.
      updateThrowPhase(1/60);
      const moved=!!ball && Math.hypot(ball.x-before.x,ball.y-before.y,ball.z-before.z)>0.01;
      res={closed,moved,stage:throwPlay&&throwPlay.stage,verdict:(closed===false&&moved)?'PASS':'FAIL'};
      throwPlay=null;
    }catch(e){res={verdict:'FAIL',e:e.message};}
    out.test42_Lifecycle拒否後物理継続=res;
  })();

'''
h=h.replace(marker,insert+marker,1)
hp.write_text(h,encoding='utf-8')

# Update remediation note.
dp=Path('ARCHITECTURE_REMEDIATION_20260808.md')
d=dp.read_text(encoding='utf-8')
d += """\n- 追加検証で、終了gatewayを早期return位置へ機械置換すると拒否時にも呼出元がreturnし、ライブ送球が凍結することを検出。物理更新前の終了要求は「実際に閉じた時だけreturn」へ固定した。\n"""
dp.write_text(d,encoding='utf-8')
print('b0805-20 final fallthrough fix applied')
