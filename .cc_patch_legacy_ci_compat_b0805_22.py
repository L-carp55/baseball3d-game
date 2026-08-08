from pathlib import Path

html=Path('baseball3d.html')
s=html.read_text(encoding='utf-8')
old="""    if(go){
      for(let i=live.length-1;i>=0;i--){
        const r=live[i], ahead=live[i+1];
        if(r.origin>=4 || !selected(r)) continue;
        const here=Math.floor(r.p+1e-9);
        const floorMax=(r.origin===0?1:0);
        const max=(ahead && ahead.goal<4) ? Math.max(floorMax,Math.ceil(ahead.goal-1e-9)-1) : 4;
        setManualGoal(r,Math.max(here,Math.min(here+1,max,4)),'S');
        r.tagUp=false;
      }
    }else{
"""
new="""    if(go){
      live.slice().reverse().forEach((r,ri,rev)=>{
        const ahead=ri>0 ? rev[ri-1] : null;
        if(r.origin>=4 || !selected(r)) return;
        const here=Math.floor(r.p+1e-9);
        const floorMax=(r.origin===0?1:0);
        const max=(ahead && ahead.goal<4) ? Math.max(floorMax,Math.ceil(ahead.goal-1e-9)-1) : 4;
        setManualGoal(r,Math.max(here,Math.min(here+1,max,4)),'S');
        r.tagUp=false;
      });
    }else{
"""
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
html.write_text(s,encoding='utf-8')

hpath=Path('_test_harness_20260804.js')
h=hpath.read_text(encoding='utf-8')
needle="""      chk.push({n:'1+Sで一塁走者だけ',ok:b1.goal===1&&first.goal===2&&first.cmd==='S'&&first.intentSource==='manual'&&third.goal===3});
"""
repl=needle+"""      chk.push({n:'S手動意図を自動帰塁が上書きしない',ok:setAutoGoal(first,1)===false&&first.goal===2});
"""
assert h.count(needle)==1
h=h.replace(needle,repl,1)
needle2="""      chk.push({n:'1+Xで一塁走者だけ帰塁',ok:b3.goal===1&&first3.goal===1&&first3.cmd==='X'&&first3.intentSource==='manual'&&!first3.tagUp});
"""
repl2=needle2+"""      chk.push({n:'X手動意図を自動ハーフウェイが上書きしない',ok:setAutoGoal(first3,1.45)===false&&first3.goal===1});
"""
assert h.count(needle2)==1
h=h.replace(needle2,repl2,1)
start=h.index("  // ===== test44: 高フライ中もS=進塁 / X=帰塁をそのまま優先 =====")
end=h.index("  console.log(JSON.stringify(out,null,1));",start)
h=h[:start]+h[end:]
hpath.write_text(h,encoding='utf-8')
print('folded b0805-22 S/X regression into test28; canonical count restored to 45')