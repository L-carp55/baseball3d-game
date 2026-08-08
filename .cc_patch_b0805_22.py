from pathlib import Path

HTML=Path('baseball3d.html')
HARNESS=Path('_test_harness_20260804.js')
DOC=Path('ARCHITECTURE_REMEDIATION_20260808.md')

s=HTML.read_text(encoding='utf-8')
assert s.count("const BUILD = 'b0805-21';")==1
s=s.replace("const BUILD = 'b0805-21';","const BUILD = 'b0805-22';",1)

old='''  if(go && tagPhase){
    /* 打球が上がっている間のSの意味は、走者の塁で変わる（実際の走塁と同じ）。
       ・三塁走者＝タッチアップ。塁を踏んだまま待ち、捕られた瞬間に走る（犠牲フライ）
       ・一塁・二塁走者＝ハーフウェイ。塁間の半分まで出て打球を見る
         捕られたら戻り、落ちたらそこから走る
       全員を塁上で待たせていたため、左線に落ちる当たりでもSを押した走者が
       打球が落ちるまで動かず、1.5秒ぶん出遅れていた（録画で確認）。 */
    live.forEach(r=>{
      if(r.origin>=4 || !selected(r)) return;
      /* 選択門番は打者走者の特別処理より先に通す。以前は打者走者だけ門番の前で
         goalを書き換え、Z・1〜3キーで別走者を選んでも巻き込んでいた（OI-088/152/165）。 */
      /* 打者走者にタッチアップは無い（アウトになるのは自分の捕球）。フライの間も
         Sで普通に先の塁を狙える。ハーフウェイ処理が打者を無視して早期returnしていたため、
         フライ中はSを押しても一塁から先へ進めなかった（オーナー指摘）。 */
      if(r.origin===0){
        const i=live.indexOf(r), ahead=live[i+1];
        const here=Math.floor(r.p+1e-9);
        /* 上限は塁単位で数える。前走者がハーフウェイ(goal=2.45等)だと
           goal-1がそのまま1.45になり、打者が塁間の変な位置を目標にしてしまう。 */
        const max=(ahead && ahead.goal<4) ? Math.ceil(ahead.goal-1e-9)-1 : 4;
        setManualGoal(r,Math.max(here,Math.min(here+1,max,4)),'S');
        return;
      }
      // 選択門番は上で全走者共通に適用済み
      r.tagUp=true;
      if(r.origin<3) setAutoGoal(r, r.origin+0.45, true);   // ハーフウェイ
    });
    return;
  }
'''
new='''  if(tagPhase && (go||back)){
    /* 操作契約は打球種類で変えない。HUDどおり S=今すぐ進塁、X=今すぐ帰塁。
       b0805-21までは高フライ中だけSを「ハーフウェイ/タッチアップ準備」に読み替え、
       1塁走者がS押下中でもmanualにならずgoal=1.45付近で止まっていた（実プレー録画で確認）。
       Xも打者走者を後続の占有者として数える一般帰塁ロジックに流れ、一塁へ戻れなかった。
       高フライ中の明示入力は自動戦術より優先し、タッチアップは捕球後のSで行う。 */
    if(go){
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
      for(const r of live){
        if(r.origin>=4 || !runnerSelectedForCommand(r,false,lead,picked)) continue;
        r.tagUp=false;
        const backBase=r.origin>0 ? r.origin : Math.max(1,Math.floor(r.p+1e-9));
        setManualGoal(r,backBase,'X');
      }
    }
    return;
  }
'''
assert s.count(old)==1, s.count(old)
s=s.replace(old,new,1)
HTML.write_text(s,encoding='utf-8')

h=HARNESS.read_text(encoding='utf-8')
marker="  console.log(JSON.stringify(out,null,1));\n  return out;"
assert h.count(marker)==1
insert=r'''  // ===== test44: 高フライ中もS=進塁 / X=帰塁をそのまま優先 =====
  (function(){
    const chk=[];
    const clear=()=>['s','z','x','1','2','3'].forEach(k=>held[k]=false);
    try{
      newGame(); S.outs=1; S.preOuts=0; S.phase='flight';
      const br=makeRunner(0.15,1,0,25), r1=makeRunner(1.10,1,1,25);
      runners=[br,r1];
      ball={x:-70,y:80,z:45,vx:-40,vy:50,vz:8,t:0.7,landed:false,canCatchAir:true,maxZ:30};
      clear(); held.s=true; applyRunnerKeys(); clear();
      chk.push({n:'高フライSで一塁走者は即二塁へ',ok:r1.goal===2&&r1.cmd==='S'&&r1.intentSource==='manual'&&!r1.tagUp});
      const keptS=!setAutoGoal(r1,1)&&r1.goal===2;
      chk.push({n:'S手動意図を自動帰塁が上書きしない',ok:keptS});

      newGame(); S.outs=1; S.preOuts=0; S.phase='flight';
      const br2=makeRunner(0.55,1,0,25), r2=makeRunner(1.45,1.45,1,25);
      runners=[br2,r2];
      ball={x:-70,y:80,z:45,vx:-40,vy:50,vz:8,t:0.7,landed:false,canCatchAir:true,maxZ:30};
      clear(); held.x=true; applyRunnerKeys(); clear();
      chk.push({n:'高フライXで一塁走者は一塁へ戻る',ok:r2.goal===1&&r2.cmd==='X'&&r2.intentSource==='manual'&&!r2.tagUp});
      const keptX=!setAutoGoal(r2,1.45)&&r2.goal===1;
      chk.push({n:'X手動意図を自動ハーフウェイが上書きしない',ok:keptX});
    }catch(e){chk.push({n:'例外',ok:false,e:e.message});}
    finally{clear();}
    const bad=chk.filter(x=>!x.ok);
    out.test44_高フライ手動走塁優先={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

'''
h=h.replace(marker,insert+marker,1)
HARNESS.write_text(h,encoding='utf-8')

with DOC.open('a',encoding='utf-8') as f:
  f.write('''\n\n## Phase 6c — b0805-22 Manual runner priority\n\n- b0805-21の人間実プレーで、1死一塁・高フライ中にSを押しても一塁走者が`auto`のままハーフウェイで止まることを録画で確認。\n- 同じ実プレーでXを押しても帰塁しない報告。コード監査で、一般X処理が打者走者を後続占有者として扱い一塁帰塁を塞ぐことを確認。\n- 操作契約を打球種類によらず `S=今すぐ進塁 / X=今すぐ帰塁` に統一。高フライ中の明示入力は自動ハーフウェイ/帰塁戦術より優先する。\n- `test44_高フライ手動走塁優先`でS/X両方向と、自動判断による後段上書き防止を固定する。\n''')
print('patched b0805-22')