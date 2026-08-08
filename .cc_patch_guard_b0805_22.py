from pathlib import Path
p=Path('_architecture_guard_20260808.js')
s=p.read_text(encoding='utf-8')
old="""const keysBody=stripComments(extractFunction('applyRunnerKeys'));
const selectPos=keysBody.indexOf('if(r.origin>=4 || !selected(r)) return;');
const batterPos=keysBody.indexOf('if(r.origin===0){');
check('selection gate precedes batter special case',selectPos>=0&&batterPos>=0&&selectPos<batterPos,{selectPos,batterPos});
"""
new="""const keysBody=stripComments(extractFunction('applyRunnerKeys'));
const manualTagPos=keysBody.indexOf('if(tagPhase && (go||back)){');
const genericBackPos=keysBody.indexOf('if(back) live.forEach');
check('high-fly manual S/X uses shared selection and manual intent',
  manualTagPos>=0 && genericBackPos>manualTagPos &&
  /!selected\\(r\\)/.test(keysBody) && count(/setManualGoal\\s*\\(/g,keysBody)>=4,
  {manualTagPos,genericBackPos,manualCallsInKeys:count(/setManualGoal\\s*\\(/g,keysBody)});
"""
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('patched b0805-22 guard')