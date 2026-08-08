from pathlib import Path
p=Path('_test_harness_20260804.js')
s=p.read_text(encoding='utf-8')
old="""      chk.push({n:'Zで先頭だけ・打者不変',ok:batter.goal===1&&lead.tagUp===true});

      setup();
      const b1=rr(0,0.20,1), first=rr(1,1.08,1), third=rr(3,3.08,3);
      runners=[b1,first,third]; held['1']=true; held['s']=true; applyRunnerKeys();
      chk.push({n:'1+Sで一塁走者だけ',ok:b1.goal===1&&Math.abs(first.goal-1.45)<1e-9&&third.goal===3});

      setup();
      const b2=rr(0,0.20,1), first2=rr(1,1.08,1), third2=rr(3,3.08,3);
      runners=[b2,first2,third2]; held['3']=true; held['s']=true; applyRunnerKeys();
      chk.push({n:'3+Sで三塁走者だけ',ok:b2.goal===1&&first2.goal===1&&third2.goal===3&&third2.tagUp===true});
"""
new="""      chk.push({n:'Zで先頭だけ・打者不変',ok:batter.goal===1&&lead.goal===3&&lead.cmd==='S'&&lead.intentSource==='manual'&&!lead.tagUp});

      setup();
      const b1=rr(0,0.20,1), first=rr(1,1.08,1), third=rr(3,3.08,3);
      runners=[b1,first,third]; held['1']=true; held['s']=true; applyRunnerKeys();
      chk.push({n:'1+Sで一塁走者だけ',ok:b1.goal===1&&first.goal===2&&first.cmd==='S'&&first.intentSource==='manual'&&third.goal===3});

      setup();
      const b2=rr(0,0.20,1), first2=rr(1,1.08,1), third2=rr(3,3.08,3);
      runners=[b2,first2,third2]; held['3']=true; held['s']=true; applyRunnerKeys();
      chk.push({n:'3+Sで三塁走者だけ',ok:b2.goal===1&&first2.goal===1&&third2.goal===4&&third2.cmd==='S'&&third2.intentSource==='manual'});

      setup();
      const b3=rr(0,0.55,1), first3=rr(1,1.45,1.45);
      runners=[b3,first3]; held['1']=true; held['x']=true; applyRunnerKeys();
      chk.push({n:'1+Xで一塁走者だけ帰塁',ok:b3.goal===1&&first3.goal===1&&first3.cmd==='X'&&first3.intentSource==='manual'&&!first3.tagUp});
"""
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('patched canonical test28 for b0805-22')