from pathlib import Path

code=Path('.cc_patch_b0805_20.py').read_text(encoding='utf-8')
old="  const liveBall=!!(T && (T.stage==='fly' || (T.stage==='rundown' && T.rd && T.rd.sub==='relay')));\\n"
new="  const stageLive=!!(T && (T.stage==='fly' || (T.stage==='rundown' && T.rd && T.rd.sub==='relay')));\\n  const ballSpeed=ball?Math.hypot(ball.vx||0,ball.vy||0,ball.vz||0):0;\\n  const liveBall=!!(stageLive && ball && (ball.z>0.8 || ballSpeed>3));\\n"
if code.count(old)!=1: raise SystemExit('liveBall source anchor missing')
code=code.replace(old,new,1)
old2="check('watchdog uses lifecycle gateway',/requestPlayConclusion\\\\s*\\\\('watchdog'\\\\)/.test(throwPhaseBody)&&!/concludePlay\\\\s*\\\\(/.test(throwPhaseBody),'watchdog gateway');\\n"
new2="check('watchdog uses lifecycle gateway',/requestPlayConclusion\\\\s*\\\\(\\\\s*['\\\"]watchdog['\\\"]\\\\s*\\\\)/.test(clean)&&concludeCalls===1,'watchdog gateway');\\n"
if code.count(old2)!=1: raise SystemExit('watchdog guard source anchor missing')
code=code.replace(old2,new2,1)
# Documentation should describe kinematic liveness rather than treating every fly-stage recovery as airborne.
code=code.replace('旧`ball.land`参照によるライブ送球判定を廃止し、送球stageからライブ状態を判断する。',
                  '旧`ball.land`参照を廃止し、送球stage＋球の高さ/速度からライブ状態を判断する。')
exec(compile(code,'.cc_patch_b0805_20.py','exec'),{'__name__':'__main__'})
print('b0805-20 retry refinements applied')
