from pathlib import Path
import re

# Run the staged patch, but allow the one known legacy writer to survive until this wrapper migrates it.
code=Path('.cc_patch_b0805_19.py').read_text(encoding='utf-8')
old="if len(writes)!=1: raise SystemExit(f'target writers remain: {len(writes)} {writes}')"
new="if len(writes)>2: raise SystemExit(f'target writers remain before final migration: {len(writes)} {writes}')"
if code.count(old)!=1: raise SystemExit('writer gate anchor missing')
exec(compile(code.replace(old,new,1),'.cc_patch_b0805_19.py','exec'),{'__name__':'__main__'})

p=Path('baseball3d.html')
s=p.read_text(encoding='utf-8')

# endRundown: choose continuation base from visible position/direction, not private goal.
old1="""  const homing = runners.find(r=>!r.out && r.goal>=3.99 && r.p<3.97 && r.p>2.0);\n  const unsettled = homing || runners.find(r=>!r.out && r.p<3.97 &&\n    (Math.abs(r.p-Math.round(r.p))>=0.02 || r.p < r.goal-0.02));\n  if(unsettled && baseOuts()+countOuts()<3){\n    const tgtBase = homing ? 4 : Math.min(4, Math.max(1, Math.round(unsettled.goal)));\n"""
new1="""  const homing = runners.find(r=>!r.out && r.p<3.97 && r.p>2.0 && runnerObservedDir(r)>0);\n  const unsettled = homing || runners.find(r=>!r.out && r.p<3.97 &&\n    (Math.abs(r.p-Math.round(r.p))>=0.02 || runnerObservedDir(r)!==0));\n  if(unsettled && baseOuts()+countOuts()<3){\n    const dir=runnerObservedDir(unsettled);\n    const tgtBase = homing ? 4 : clamp(dir<0?Math.floor(unsettled.p):Math.ceil(unsettled.p),1,4);\n"""
if s.count(old1)!=1: raise SystemExit(f'endRundown visible-state anchor {s.count(old1)}')
s=s.replace(old1,new1,1)

# concludeOrChaseHome: route the final legacy writer through ThrowDecision/setThrowTarget.
old2="""  const homing = runners.find(r=>!r.out && r.goal>=3.99 && r.p<3.97 && r.p>2.0);\n  const unsettled = homing || runners.find(r=>!r.out && r.p<3.97 &&\n    (Math.abs(r.p-Math.round(r.p))>=0.02 || r.p < r.goal-0.02));\n  if(unsettled && baseOuts()+countOuts()<3){\n    const holder = T.receiver || T.thrower;\n    T.thrower=holder; T.receiver=null; T.relayed=true;\n    T.stage='transfer'; T.t=0; T.stepChecked=false;\n    T.transfer=A.transfer(holder.fld,holder.cat)*0.75+0.16;\n    T.target = homing ? 4 : Math.min(4, Math.max(1, Math.round(unsettled.goal)));\n    return;\n  }\n"""
new2="""  const homing = runners.find(r=>!r.out && r.p<3.97 && r.p>2.0 && runnerObservedDir(r)>0);\n  const unsettled = homing || runners.find(r=>!r.out && r.p<3.97 &&\n    (Math.abs(r.p-Math.round(r.p))>=0.02 || runnerObservedDir(r)!==0));\n  if(unsettled && baseOuts()+countOuts()<3){\n    const holder = T.receiver || T.thrower;\n    const dir=runnerObservedDir(unsettled);\n    const fallback=homing?4:clamp(dir<0?Math.floor(unsettled.p):Math.ceil(unsettled.p),1,4);\n    const decision=decideThrowTarget(holder,{kind:'live',homeIfAdvancing:true,fallbackTarget:fallback});\n    T.thrower=holder; T.receiver=null; T.relayed=true;\n    T.stage='transfer'; T.t=0; T.stepChecked=false;\n    T.transfer=A.transfer(holder.fld,holder.cat)*0.75+0.16;\n    setThrowTarget(T,decision.nb,'return-continue-'+decision.source);\n    return;\n  }\n"""
if s.count(old2)!=1: raise SystemExit(f'concludeOrChaseHome anchor {s.count(old2)}')
s=s.replace(old2,new2,1)

clean=re.sub(r'/\*[\s\S]*?\*/|//[^\n]*','',s)
writes=re.findall(r'\b(?:T|throwPlay)\.target\s*=(?!=)',clean)
if len(writes)!=1: raise SystemExit(f'final throw target writers={len(writes)} {writes}')
choose=re.findall(r'\bchooseThrowTarget\s*\(',clean)
if len(choose)!=2: raise SystemExit(f'chooseThrowTarget calls={len(choose)}')
p.write_text(s,encoding='utf-8')
print('b0805-19 final migration applied')
