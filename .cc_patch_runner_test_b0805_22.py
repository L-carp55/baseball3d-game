from pathlib import Path
p=Path('_test_runner_intent_20260808.js')
s=p.read_text(encoding='utf-8')
old="""ctx.ball={landed:false,canCatchAir:true,maxZ:30,z:18,vz:-8,t:1};
let batter=rr(0,1,1), lead=rr(2,2.4,3);ctx.runners=[batter,lead];clear();ctx.held.z=true;ctx.applyRunnerKeys();assert(batter.goal===1&&lead.tagUp,'Z leak');
ctx.ball={landed:false,canCatchAir:true,maxZ:30,z:18,vz:-8,t:1};
let b1=rr(0,.2,1), first=rr(1,1.08,1), third=rr(3,3.08,3);ctx.runners=[b1,first,third];clear();ctx.held['1']=ctx.held.s=true;ctx.applyRunnerKeys();assert(b1.goal===1&&Math.abs(first.goal-1.45)<1e-9&&third.goal===3,'1+S leak');
ctx.ball={landed:false,canCatchAir:true,maxZ:30,z:18,vz:-8,t:1};
let b2=rr(0,.2,1), first2=rr(1,1.08,1), third2=rr(3,3.08,3);ctx.runners=[b2,first2,third2];clear();ctx.held['3']=ctx.held.s=true;ctx.applyRunnerKeys();assert(b2.goal===1&&first2.goal===1&&third2.tagUp,'3+S leak');
"""
new="""ctx.ball={landed:false,canCatchAir:true,maxZ:30,z:18,vz:-8,t:1};
let batter=rr(0,1,1), lead=rr(2,2.4,3);ctx.runners=[batter,lead];clear();ctx.held.z=true;ctx.applyRunnerKeys();assert(batter.goal===1&&lead.goal===3&&lead.cmd==='S'&&lead.intentSource==='manual'&&!lead.tagUp,'Z leak');
ctx.ball={landed:false,canCatchAir:true,maxZ:30,z:18,vz:-8,t:1};
let b1=rr(0,.2,1), first=rr(1,1.08,1), third=rr(3,3.08,3);ctx.runners=[b1,first,third];clear();ctx.held['1']=ctx.held.s=true;ctx.applyRunnerKeys();assert(b1.goal===1&&first.goal===2&&first.cmd==='S'&&first.intentSource==='manual'&&third.goal===3,'1+S leak');
ctx.ball={landed:false,canCatchAir:true,maxZ:30,z:18,vz:-8,t:1};
let b2=rr(0,.2,1), first2=rr(1,1.08,1), third2=rr(3,3.08,3);ctx.runners=[b2,first2,third2];clear();ctx.held['3']=ctx.held.s=true;ctx.applyRunnerKeys();assert(b2.goal===1&&first2.goal===1&&third2.goal===4&&third2.cmd==='S'&&third2.intentSource==='manual','3+S leak');
ctx.ball={landed:false,canCatchAir:true,maxZ:30,z:18,vz:-8,t:1};
let b3=rr(0,.55,1), first3=rr(1,1.45,1.45);ctx.runners=[b3,first3];clear();ctx.held['1']=ctx.held.x=true;ctx.applyRunnerKeys();assert(b3.goal===1&&first3.goal===1&&first3.cmd==='X'&&first3.intentSource==='manual','1+X return leak');
"""
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
s=s.replace("console.log('targeted b0805-15 PASS');","console.log('targeted b0805-22 RunnerIntent PASS');",1)
p.write_text(s,encoding='utf-8')
print('patched b0805-22 focused runner test')