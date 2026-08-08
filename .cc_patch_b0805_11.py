from pathlib import Path
import os, re, subprocess, tempfile, textwrap

HTML = Path('baseball3d.html')
HARNESS = Path('_test_harness_20260804.js')

def swap(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    return text.replace(old, new, 1)

html = HTML.read_text(encoding='utf-8')
html = swap(html, "const BUILD = 'b0805-10';", "const BUILD = 'b0805-11';", 'build')

old = '''function stepFlight(dt){\n  stepBall(ball,dt); ball.t+=dt;'''
new = '''/* 捕球した打球の分類。resolveCatch はノーバウンド捕球の経路なので、\n   低い弾道を高さだけで「ゴロ」に落とさない。OI-251/253 の再発防止として、\n   接地の有無を最優先し、空中の低い強い打球はライナーとして扱う。 */\nfunction classifyCaughtBall(b){\n  if(b.landed) return 'ゴロ';\n  if((b.la||0)>45) return 'ポップフライ';\n  if((b.la||0)<=20 && (b.maxZ||b.z||0)<22) return 'ライナー';\n  return 'フライ';\n}\n/* 飛び込み量は横方向の不足だけで決める。高さは jump/reach が担当する。\n   3D距離をそのまま dive 判定に使うと、真上の球でも「横に届かない」と誤解して\n   下方向へ飛び込むポーズになっていた（OI-250）。 */\nfunction catchDiveAmount(d2, grabR){\n  return clamp((d2-CATCH_R)/Math.max(0.1, grabR-CATCH_R), 0, 1);\n}\n/* 落下点へ先着し、ほぼ静止して真下に入れている通常のフライは、\n   高い位置で毎回ジャンプせず胸～顔の高さまで待って捕る（OI-249）。\n   横へまだ追っている／上昇中／ぎりぎりの球には適用しない。 */\nfunction shouldWaitForChestCatch(f,b,d2){\n  const still=clamp(1-(f.v||0)/Math.max(1,f.sp||24),0,1);\n  return !b.landed && b.vz<0 && b.z>5.4 && d2<2.5 && still>0.75;\n}\nfunction stepFlight(dt){\n  stepBall(ball,dt); ball.t+=dt;'''
html = swap(html, old, new, 'catch helpers')

old = '''  const d3 = Math.hypot(d2, Math.max(0, ball.z-4.2));\n  if(inAir && d3<=grabR && (receding || d2<1.2)){\n    /* グラブが届く4.5ftより外は飛びつき。どれだけ余裕を持って追いついたか(routeProb)と、\n       その体勢で確実に掴めるか(catchProb)の両方を満たして初めて捕れる。\n       失敗した時は、体勢が崩れているほど「届かず後ろへ」、正面なら「落球＝エラー」。 */\n    const dive01 = clamp((d3-CATCH_R)/Math.max(0.1, grabR-CATCH_R), 0, 1);'''
new = '''  const d3 = Math.hypot(d2, Math.max(0, ball.z-4.2));\n  /* 余裕をもって落下点へ先着した普通のフライは、胸の高さまで待つ。\n     以前は捕球圏に入った最初の高い位置で捕ったため、外野手がほぼ毎回ジャンプしていた。 */\n  if(inAir && shouldWaitForChestCatch(prim,ball,d2)){\n    ball.dPrev=d2;\n    return false;\n  }\n  if(inAir && d3<=grabR && (receding || d2<1.2)){\n    /* 飛び込みは横方向にグラブが届かない時だけ。高さ不足は jump/reach で処理する。 */\n    const dive01 = catchDiveAmount(d2, grabR);'''
html = swap(html, old, new, 'catch wait/dive')

old = '''function resolveCatch(){\n  const dist=Math.hypot(ball.x,ball.y);\n  /* 打球の呼び方は「実際にどれだけ上がったか」で決める。打ち出し角度で決めると、\n     地を這うように飛んだ打球まで「ライナー」と呼んでしまう。 */\n  const kind = ball.maxZ<7 ? 'ゴロ'\n             : (ball.la>45 ? 'ポップフライ'\n             : (dist>150 ? 'フライ' : (ball.maxZ<18 ? 'ライナー' : 'フライ')));'''
new = '''function resolveCatch(){\n  const dist=Math.hypot(ball.x,ball.y);\n  /* 空中で捕った打球は、弾道が低くてもゴロではない。分類を一つの関数へ集約し、\n     後続の送球・挟殺表示でも ball.flyKind をそのまま使う。 */\n  const kind = classifyCaughtBall(ball);'''
html = swap(html, old, new, 'resolveCatch classification')

old = '''  const HITNAME = {1:'ヒット',2:'ツーベース',3:'スリーベース',4:'ランニングホームラン'};\n  let text, color;\n  if(throwPlay.rdText){                      // 挟殺プレーの結末を優先して見せる\n    /* 打球のプレーでなければ「◯◯ゴロ」と呼ばない。盗塁を刺した時に\n       「捕ゴロ → タッチアウト！」と出ていた。 */\n    const base = throwPlay.kind==='outfield' ? (HITNAME[brBase]||'ヒット')\n      : (throwPlay.kind==='steal' ? '盗塁'\n      : (throwPlay.kind==='pickoff' ? '牽制' : `${nm}ゴロ`));'''
new = '''  const HITNAME = {1:'ヒット',2:'ツーベース',3:'スリーベース',4:'ランニングホームラン'};\n  let text, color;\n  if(throwPlay.rdText){                      // 挟殺プレーの結末を優先して見せる\n    /* 元がフライなら、後続走者をタッチアウトにしても打球種別をゴロへ作り直さない。\n       OI-253 の「右フライ→投ゴロ」の真因は、この最終表示だけが flyKind を捨てていたこと。 */\n    const base = throwPlay.kind==='fly' ? flyOutLabel(throwPlay,nm)\n      : (throwPlay.kind==='outfield' ? (HITNAME[brBase]||'ヒット')\n      : (throwPlay.kind==='steal' ? '盗塁'\n      : (throwPlay.kind==='pickoff' ? '牽制' : `${nm}ゴロ`)));'''
html = swap(html, old, new, 'rundown fly label')

# Insert flyOutLabel before concludePlay so both production and harness can exercise one source of truth.
old = '''const baseOuts = ()=> S.outs-(S.preOuts||0);   // このプレーが始まる前のアウト数\nfunction concludePlay(force){'''
new = '''const baseOuts = ()=> S.outs-(S.preOuts||0);   // このプレーが始まる前のアウト数\n/* フライ捕球後に別のアウトが続いた時も、元の打球種別と捕球野手を保持する。 */\nfunction flyOutLabel(T,nm){\n  return `${T.flyBy||nm}${(ball&&ball.flyKind)||'フライ'} アウト`;\n}\nfunction concludePlay(force){'''
html = swap(html, old, new, 'flyOutLabel helper')

old = '''  buildThrow(res);\n  setMsg(res.text,\n    [res.sub||'', res.runs>0?`${res.runs}点が入りました`:''].filter(Boolean).join('  /  '),\n    res.color);\n  S.lastPlay=res.text;'''
new = '''  buildThrow(res);\n  presentFinalMessage(res);\n  S.lastPlay=res.text;'''
html = swap(html, old, new, 'finish message call')

old = '''/* ========================= プレー確定 ========================= */\nfunction finishPlay(res){'''
new = '''/* ========================= プレー確定 ========================= */\n/* 捕球時にすでに同じアウト表示を出しているなら、終了時に同文を再発行しない。\n   resolveCatch→finishPlay の二重 setMsg が OI-252（同時刻/数秒後の二重表示）の主因だった。\n   サブ表示だけ変わる場合は内容を更新するが、録画メッセージは増やさない。 */\nfunction presentFinalMessage(res){\n  const sub=[res.sub||'', res.runs>0?`${res.runs}点が入りました`:''].filter(Boolean).join('  /  ');\n  if(S.msg===res.text){\n    S.msgSub=sub; S.msgColor=res.color||'#e8eef5';\n    return false;\n  }\n  setMsg(res.text,sub,res.color);\n  return true;\n}\nfunction finishPlay(res){'''
html = swap(html, old, new, 'presentFinalMessage helper')

HTML.write_text(html, encoding='utf-8')

h = HARNESS.read_text(encoding='utf-8')
marker = "  console.log(JSON.stringify(out,null,1));\n"
if h.count(marker) != 1:
    raise SystemExit(f'harness marker count={h.count(marker)}')
insert = r'''  // ===== test19: 捕球打球の分類（OI-251 / OI-253） =====
  (function(){
    const chk=[];
    try{
      chk.push({n:'低いノーバウンドはライナー', ok:classifyCaughtBall({landed:false,la:12,maxZ:12,z:5})==='ライナー'});
      chk.push({n:'通常フライ', ok:classifyCaughtBall({landed:false,la:32,maxZ:42,z:5})==='フライ'});
      chk.push({n:'高角度はポップ', ok:classifyCaughtBall({landed:false,la:50,maxZ:55,z:5})==='ポップフライ'});
      chk.push({n:'接地球だけゴロ', ok:classifyCaughtBall({landed:true,la:-5,maxZ:6,z:0})==='ゴロ'});
    }catch(e){ chk.push({n:'例外',ok:false,e:e.message}); }
    const bad=chk.filter(x=>!x.ok);
    out.test19_捕球打球分類={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

  // ===== test20: フライ後続プレーの表示（OI-253） =====
  (function(){
    let res={};
    try{
      const save=ball;
      ball={flyKind:'フライ'};
      const a=flyOutLabel({kind:'fly',flyBy:'右'},'投');
      ball={flyKind:'ライナー'};
      const b=flyOutLabel({kind:'fly',flyBy:'三'},'投');
      ball=save;
      res={フライ:a,ライナー:b,verdict:(a==='右フライ アウト'&&b==='三ライナー アウト')?'PASS':'FAIL'};
    }catch(e){ res={verdict:'FAIL',e:e.message}; }
    out.test20_フライ後続表示=res;
  })();

  // ===== test21: フライ捕球モーション（OI-249 / OI-250） =====
  (function(){
    const chk=[];
    try{
      chk.push({n:'真上の球は飛び込み0',ok:catchDiveAmount(0.5,9)===0});
      chk.push({n:'横に遠い球は飛び込み',ok:catchDiveAmount(8,9)>0.5});
      chk.push({n:'先着した高い落下球は待つ',ok:shouldWaitForChestCatch({v:0,sp:25},{landed:false,vz:-10,z:7},1)===true});
      chk.push({n:'胸高まで来たら待たない',ok:shouldWaitForChestCatch({v:0,sp:25},{landed:false,vz:-10,z:5.2},1)===false});
      chk.push({n:'追走中は待たない',ok:shouldWaitForChestCatch({v:24,sp:25},{landed:false,vz:-10,z:7},1)===false});
    }catch(e){ chk.push({n:'例外',ok:false,e:e.message}); }
    const bad=chk.filter(x=>!x.ok);
    out.test21_フライ捕球モーション={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

  // ===== test22: 同一アウト表示の二重発行を防ぐ（OI-252） =====
  (function(){
    let res={};
    try{
      newGame();
      const oldSet=window.setMsg; let emits=0;
      window.setMsg=function(m,sub,c){ emits++; S.msg=m; S.msgSub=sub||''; S.msgColor=c||'#e8eef5'; };
      try{
        S.msg='右フライ アウト'; emits=0;
        const same=presentFinalMessage({text:'右フライ アウト',runs:0,color:'#95a3b4'});
        const sameOk=(same===false&&emits===0);
        S.msg='別の表示'; emits=0;
        const diff=presentFinalMessage({text:'右フライ アウト',runs:0,color:'#95a3b4'});
        const diffOk=(diff===true&&emits===1);
        res={同文再発行:emits,verdict:(sameOk&&diffOk)?'PASS':'FAIL'};
      }finally{ window.setMsg=oldSet; }
    }catch(e){ res={verdict:'FAIL',e:e.message}; }
    out.test22_重複アウト表示=res;
  })();

'''
h = h.replace(marker, insert + marker, 1)
HARNESS.write_text(h, encoding='utf-8')

# ---------- syntax + focused direct-production mutation verification ----------
js = re.search(r'<script>\s*(.*?)\s*</script>', html, re.S).group(1)
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
    f.write(js); game_js=f.name
subprocess.run(['node','--check',game_js], check=True)
subprocess.run(['node','--check',str(HARNESS)], check=True)

def extract_fn(src, name):
    start = src.index(f'function {name}(')
    brace = src.index('{', start)
    depth=0
    for i in range(brace, len(src)):
        if src[i]=='{': depth+=1
        elif src[i]=='}':
            depth-=1
            if depth==0:
                return src[start:i+1]
    raise RuntimeError(name)

names=['classifyCaughtBall','catchDiveAmount','shouldWaitForChestCatch','flyOutLabel','presentFinalMessage']
base='\n'.join(extract_fn(js,n) for n in names)

def unit_source(mut=None):
    funcs=base
    if mut=='classification':
        funcs=funcs.replace("if(b.landed) return 'ゴロ';", "if((b.maxZ||0)<7) return 'ゴロ';",1)
    elif mut=='flylabel':
        funcs=funcs.replace("return `${T.flyBy||nm}${(ball&&ball.flyKind)||'フライ'} アウト`;", "return `${nm}ゴロ アウト`;",1)
    elif mut=='dive':
        funcs=funcs.replace('(d2-CATCH_R)', '(6.8-CATCH_R)',1)
    elif mut=='wait':
        funcs=funcs.replace('return !b.landed && b.vz<0', 'return false && !b.landed && b.vz<0',1)
    elif mut=='dedupe':
        funcs=funcs.replace('if(S.msg===res.text){', 'if(false && S.msg===res.text){',1)
    return f'''const clamp=(v,a,b)=>v<a?a:v>b?b:v; const CATCH_R=4.5;\nlet ball={{flyKind:'フライ'}}; let S={{msg:'',msgSub:'',msgColor:''}}; let emitted=0;\nfunction setMsg(m,sub,c){{emitted++;S.msg=m;S.msgSub=sub||'';S.msgColor=c||'#e8eef5';}}\n{funcs}\nfunction ok(x,m){{if(!x)throw new Error(m)}}\nok(classifyCaughtBall({{landed:false,la:12,maxZ:12,z:5}})==='ライナー','liner');\nok(classifyCaughtBall({{landed:false,la:32,maxZ:42,z:5}})==='フライ','fly');\nok(classifyCaughtBall({{landed:false,la:50,maxZ:55,z:5}})==='ポップフライ','pop');\nok(classifyCaughtBall({{landed:true,la:-5,maxZ:6,z:0}})==='ゴロ','ground');\nok(flyOutLabel({{flyBy:'右'}},'投')==='右フライ アウト','flylabel');\nok(catchDiveAmount(0.5,9)===0,'overhead dive'); ok(catchDiveAmount(8,9)>0.5,'lateral dive');\nok(shouldWaitForChestCatch({{v:0,sp:25}},{{landed:false,vz:-10,z:7}},1),'wait');\nok(!shouldWaitForChestCatch({{v:0,sp:25}},{{landed:false,vz:-10,z:5.2}},1),'chest');\nS.msg='右フライ アウト'; emitted=0; ok(presentFinalMessage({{text:'右フライ アウト',runs:0,color:'#fff'}})===false&&emitted===0,'dedupe');\n'''

def run_unit(mut=None, expect_pass=True):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(unit_source(mut)); p=f.name
    r=subprocess.run(['node',p],capture_output=True,text=True)
    if expect_pass and r.returncode!=0:
        raise SystemExit(f'baseline unit failed: {r.stderr}')
    if not expect_pass and r.returncode==0:
        raise SystemExit(f'mutation escaped: {mut}')

run_unit()
for m in ['classification','flylabel','dive','wait','dedupe']:
    run_unit(m, expect_pass=False)
print('b0805-11 patch: syntax PASS / focused production helpers PASS / mutations 5/5 detected')
