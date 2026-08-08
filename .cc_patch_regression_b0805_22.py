from pathlib import Path
p=Path('.github/workflows/baseball3d-regression.yml')
s=p.read_text(encoding='utf-8')
old="""          rundown_call=\"  const rundownExit=settleRundownExitIntent(T);\\n\"
          assert base.count(rundown_call)==1
          rundown_mutated=base.replace(rundown_call,\"  const rundownExit=null;\\n\",1)
          build(rundown_mutated,'mut43')

          # Architecture mutations.
"""
new="""          rundown_call=\"  const rundownExit=settleRundownExitIntent(T);\\n\"
          assert base.count(rundown_call)==1
          rundown_mutated=base.replace(rundown_call,\"  const rundownExit=null;\\n\",1)
          build(rundown_mutated,'mut43')

          manual_s=\"        setManualGoal(r,Math.max(here,Math.min(here+1,max,4)),'S');\\n        r.tagUp=false;\\n\"
          assert base.count(manual_s)==1
          build(base.replace(manual_s,\"        setAutoGoal(r,r.origin<3?r.origin+0.45:r.origin,true);\\n        r.tagUp=true;\\n\",1),'mut44s')

          manual_x=\"        const backBase=r.origin>0 ? r.origin : Math.max(1,Math.floor(r.p+1e-9));\\n        setManualGoal(r,backBase,'X');\\n\"
          assert base.count(manual_x)==1
          build(base.replace(manual_x,\"        const backBase=r.origin>0 ? Math.min(4,r.origin+1) : Math.max(1,Math.floor(r.p+1e-9));\\n        setManualGoal(r,backBase,'X');\\n\",1),'mut44x')

          # Architecture mutations.
"""
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
s=s.replace("for name in baseline mut28 mut29 mut30 mut31 mut32 mut33 mut35 mut36 mut37 mut38 mut39 mut40 mut41 mut42 mut43; do",
            "for name in baseline mut28 mut29 mut30 mut31 mut32 mut33 mut35 mut36 mut37 mut38 mut39 mut40 mut41 mut42 mut43 mut44s mut44x; do",1)
s=s.replace("if len(baseline)!=45 or bad: raise SystemExit('baseline failed')","if len(baseline)!=46 or bad: raise SystemExit('baseline failed')",1)
needle="""          m={n:load('mut'+str(n)) for n in [28,29,30,31,32,33,35,36,37,38,39,40,41,42,43]}
          checks=[
"""
repl="""          m={n:load('mut'+str(n)) for n in [28,29,30,31,32,33,35,36,37,38,39,40,41,42,43]}
          manualS=load('mut44s'); manualX=load('mut44x')
          checks=[
"""
assert s.count(needle)==1
s=s.replace(needle,repl,1)
needle2="""            (m[43]['test43_挟殺終了goal清算'],'rundown exit'),
          ]
"""
repl2="""            (m[43]['test43_挟殺終了goal清算'],'rundown exit'),
            (manualS['test44_高フライ手動走塁優先'],'manual S high fly'),
            (manualX['test44_高フライ手動走塁優先'],'manual X high fly'),
          ]
"""
assert s.count(needle2)==1
s=s.replace(needle2,repl2,1)
p.write_text(s,encoding='utf-8')
print('patched permanent regression for b0805-22')