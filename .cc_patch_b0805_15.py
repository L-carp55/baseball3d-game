from pathlib import Path

HTML = Path('baseball3d.html')
HARNESS = Path('_test_harness_20260804.js')
GUARD = Path('_architecture_guard_20260808.js')
FOCUSED = Path('_test_runner_intent_20260808.js')
WORKFLOW = Path('.github/workflows/baseball3d-regression.yml')
DOC = Path('ARCHITECTURE_REMEDIATION_20260808.md')


def swap(text: str, old: str, new: str, label: str) -> str:
    n = text.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    return text.replace(old, new, 1)


html = HTML.read_text(encoding='utf-8')
html = swap(html, "const BUILD = 'b0805-14';", "const BUILD = 'b0805-15';", 'build')

# Phase 2: migrate every remaining runner goal writer into setRunnerIntent.
html = swap(
    html,
    """    r.goal=back; r.autoGoal=back; r.cmd=null;
""",
    """    setRunnerIntent(r,back,{source:'rundown-timeout',force:true,updateAuto:true,cmd:null});
""",
    'rundown timeout intent',
)
html = swap(
    html,
    """  r.out=true; r.outKind=kind; r.goal=r.p;
""",
    """  r.out=true; r.outKind=kind;
  setRunnerIntent(r,r.p,{source:'out',force:true,updateAuto:false});
""",
    'markOut intent',
)
html = swap(
    html,
    """  if(throwPlay.kind==='fly') runners.forEach(r=>{
    if(!r.out && r.mustReturn) r.goal=Math.min(r.goal, r.origin);
  });
""",
    """  if(throwPlay.kind==='fly') runners.forEach(r=>{
    if(!r.out && r.mustReturn)
      setRunnerIntent(r,Math.min(r.goal,r.origin),{source:'retouch',force:true,updateAuto:false});
  });
""",
    'conclude fly retouch intent',
)
html = swap(
    html,
    """      if(r.p>=3.97){ r.goal=4; if(!timePlay || timePlay.includes(r)) runs++; return; }
""",
    """      if(r.p>=3.97){
        setRunnerIntent(r,4,{source:'result',force:true,updateAuto:false});
        if(!timePlay || timePlay.includes(r)) runs++;
        return;
      }
""",
    'conclude score intent',
)
html = swap(
    html,
    """      r.goal=g;
""",
    """      setRunnerIntent(r,g,{source:'result',force:true,updateAuto:false});
""",
    'conclude placement intent',
)
html = swap(
    html,
    """      r.goal=Math.max(0, Math.floor(r.p+1e-9));
""",
    """      setRunnerIntent(r,Math.max(0,Math.floor(r.p+1e-9)),
        {source:'result',force:true,updateAuto:false});
""",
    'conclude third out placement intent',
)
html = swap(
    html,
    """      r.out=true; r.outKind='tag'; r.goal=r.p;      // 戻る塁が無い＝アウト
""",
    """      r.out=true; r.outKind='tag';                  // 戻る塁が無い＝アウト
      setRunnerIntent(r,r.p,{source:'out',force:true,updateAuto:false});
""",
    'conclude no-base out intent',
)
html = swap(
    html,
    """      runners.forEach(r=>{ if(r.out||r.origin===0) return;
        r.goal=r.origin; r.autoGoal=r.origin; r.cmd=null;
        const g=Math.round(r.origin); if(g>=1&&g<=3) nb[g-1]={id:Math.random(),sp:r.sp}; });
""",
    """      runners.forEach(r=>{ if(r.out||r.origin===0) return;
        setRunnerIntent(r,r.origin,{source:'catch-third',force:true,updateAuto:true,cmd:null});
        const g=Math.round(r.origin); if(g>=1&&g<=3) nb[g-1]={id:Math.random(),sp:r.sp}; });
""",
    'third-out catch intent',
)
html = swap(
    html,
    """    if(r.p > r.origin+0.12){                 // 離塁していた → 戻る
      r.mustReturn=true; r.cmd=null; r.goal=r.origin;
      if(!lead || r.origin<lead.origin) lead=r;
""",
    """    if(r.p > r.origin+0.12){                 // 離塁していた → 戻る
      r.mustReturn=true;
      setRunnerIntent(r,r.origin,{source:'retouch',force:true,updateAuto:false,cmd:null});
      if(!lead || r.origin<lead.origin) lead=r;
""",
    'resolveCatch retouch intent',
)
html = swap(
    html,
    """      r.goal = wants ? Math.min(4, r.origin+1) : r.origin;
""",
    """      setRunnerIntent(r,wants?Math.min(4,r.origin+1):r.origin,
        {source:'tag-up',force:true,updateAuto:false});
""",
    'resolveCatch tag-up intent',
)
html = swap(
    html,
    """  runners.forEach(r=>{ r.p=r.origin; r.goal=r.origin; r.autoGoal=r.origin; r.cmd=null; r.v=0; r.mustReturn=false; r.tagUp=false; });
""",
    """  runners.forEach(r=>{ r.p=r.origin;
    setRunnerIntent(r,r.origin,{source:'foul-reset',force:true,updateAuto:true,cmd:null});
    r.v=0; r.mustReturn=false; r.tagUp=false; });
""",
    'foul reset intent',
)
html = swap(
    html,
    """    if(Math.abs(r.goal-Math.round(r.goal))>0.02) r.goal=Math.max(0,Math.floor(r.goal+1e-9));
""",
    """    if(Math.abs(r.goal-Math.round(r.goal))>0.02)
      setRunnerIntent(r,Math.max(0,Math.floor(r.goal+1e-9)),
        {source:'finish-normalize',force:true,updateAuto:false});
""",
    'finish normalization intent',
)
html = swap(
    html,
    """  runners.forEach(r=>{ if(r.jumped){ r.goal=r.origin; r.cmd=null; } });   // 戻るしかない
""",
    """  runners.forEach(r=>{ if(r.jumped)
    setRunnerIntent(r,r.origin,{source:'pickoff-return',force:true,updateAuto:false,cmd:null}); });   // 戻るしかない
""",
    'pickoff return intent',
)
html = swap(
    html,
    """    if(g>=1){ nb[g-1]={id:Math.random(), sp:r.sp}; r.goal=g; }   // 位置は走って合わせる
""",
    """    if(g>=1){
      nb[g-1]={id:Math.random(),sp:r.sp};
      setRunnerIntent(r,g,{source:'steal-result',force:true,updateAuto:false});
    }   // 位置は走って合わせる
""",
    'steal result intent',
)

# Phase 2 API contract and documentation.
html = swap(
    html,
    """/* 走者の行き先を変更する最初の単一書き手API。
   Phase 1では自動・手動操作をここへ集約し、残る規則/結果経路は後続PRで順次移す。
   source/intentSeqを録画へ残すことで、後段の黙った上書きを一次証拠から特定できる。 */
""",
    """/* 走者の行き先を変更できる唯一の書き手API。
   Phase 2で自動・手動・捕球・挟殺・牽制・結果確定・ファウルの全経路をここへ集約した。
   source/intentSeqを録画へ残すことで、後段の上書きも一次証拠から特定できる。 */
""",
    'intent api comment',
)
HTML.write_text(html, encoding='utf-8')

# Guard: exactly one direct writer for goal/autoGoal, both inside setRunnerIntent.
guard = GUARD.read_text(encoding='utf-8')
guard = swap(
    guard,
    """const file=path.join(__dirname,'baseball3d.html');
""",
    """const file=process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname,'baseball3d.html');
""",
    'guard accepts target file',
)
guard = swap(
    guard,
    """const directGoal=count(/\\b[A-Za-z_$][\\w$]*\\.goal\\s*=(?!=)/g,clean);
const directPrimary=count(/\\b(?:ball|[A-Za-z_$][\\w$]*)\\.primary\\s*=(?!=)/g,clean);
""",
    """const directGoal=count(/\\b[A-Za-z_$][\\w$]*\\.goal\\s*=(?!=)/g,clean);
const directAutoGoal=count(/\\b[A-Za-z_$][\\w$]*\\.autoGoal\\s*=(?!=)/g,clean);
const directPrimary=count(/\\b(?:ball|[A-Za-z_$][\\w$]*)\\.primary\\s*=(?!=)/g,clean);
""",
    'guard autoGoal metric',
)
guard = swap(
    guard,
    """check('runner goal direct-write ratchet <=15',directGoal<=15,directGoal);
check('fielding primary direct-write ratchet <=9',directPrimary<=9,directPrimary);
""",
    """check('runner goal has exactly one writer',directGoal===1,directGoal);
check('runner autoGoal has exactly one writer',directAutoGoal===1,directAutoGoal);
const intentBody=stripComments(extractFunction('setRunnerIntent'));
check('goal writer lives inside setRunnerIntent',
  count(/\\b[A-Za-z_$][\\w$]*\\.goal\\s*=(?!=)/g,intentBody)===1,
  (intentBody.match(/\\b[A-Za-z_$][\\w$]*\\.goal\\s*=(?!=)/g)||[]).length);
check('autoGoal writer lives inside setRunnerIntent',
  count(/\\b[A-Za-z_$][\\w$]*\\.autoGoal\\s*=(?!=)/g,intentBody)===1,
  (intentBody.match(/\\b[A-Za-z_$][\\w$]*\\.autoGoal\\s*=(?!=)/g)||[]).length);
check('fielding primary direct-write ratchet <=9',directPrimary<=9,directPrimary);
""",
    'guard single writer checks',
)
guard = swap(
    guard,
    """console.log(JSON.stringify({build,metrics:{directGoal,directPrimary,directCover,concludeCalls},checks,verdict:failed.length?'FAIL':'PASS'},null,2));
""",
    """console.log(JSON.stringify({file,build,metrics:{directGoal,directAutoGoal,directPrimary,directCover,concludeCalls},checks,verdict:failed.length?'FAIL':'PASS'},null,2));
""",
    'guard output metrics',
)
GUARD.write_text(guard, encoding='utf-8')

# Focused API contract tests.
focused = FOCUSED.read_text(encoding='utf-8')
focused = swap(
    focused,
    """ctx.runners=[{origin:2,p:2.2,goal:3,autoGoal:3,obsDir:0,dir:1,v:18,sp:23,out:false}];ctx.throwPlay=null;ctx.updateRunners(1/60);const r=ctx.runners[0];assert(ctx.runnerObservedDir(r)===1,'obs forward');ctx.setManualGoal(r,2,'X');assert(ctx.runnerObservedDir(r)===1,'goal leaked before motion');ctx.updateRunners(1/60);assert(ctx.runnerObservedDir(r)===-1,'obs back');
console.log('targeted b0805-14 PASS');
""",
    """ctx.runners=[{origin:2,p:2.2,goal:3,autoGoal:3,obsDir:0,dir:1,v:18,sp:23,out:false}];ctx.throwPlay=null;ctx.updateRunners(1/60);const r=ctx.runners[0];assert(ctx.runnerObservedDir(r)===1,'obs forward');ctx.setManualGoal(r,2,'X');assert(ctx.runnerObservedDir(r)===1,'goal leaked before motion');ctx.updateRunners(1/60);assert(ctx.runnerObservedDir(r)===-1,'obs back');
const api=rr(1,1.1,2);api.cmd='S';
const seq0=api.intentSeq, source0=api.intentSource;
assert(ctx.setAutoGoal(api,3,false)===false,'auto should respect manual command');
assert(api.autoGoal===3&&api.goal===2&&api.intentSeq===seq0&&api.intentSource===source0,'blocked auto mutated active intent');
ctx.setManualGoal(api,2.5,'S');
assert(api.goal===2.5&&api.autoGoal===3&&api.cmd==='S'&&api.intentSource==='manual'&&api.intentSeq===seq0+1,'manual API contract');
ctx.setRunnerIntent(api,1,{source:'result',force:true,updateAuto:true,cmd:null});
assert(api.goal===1&&api.autoGoal===1&&api.cmd===null&&api.intentSource==='result'&&api.intentSeq===seq0+2,'rule/result API contract');
console.log('targeted b0805-15 PASS');
""",
    'focused API contract',
)
FOCUSED.write_text(focused, encoding='utf-8')

# Full harness test30.
harness = HARNESS.read_text(encoding='utf-8')
marker = "  console.log(JSON.stringify(out,null,1));\n  return out;"
if harness.count(marker) != 1:
    raise SystemExit(f'harness marker count={harness.count(marker)}')
insert = r'''  // ===== test30: RunnerIntent単一書き手APIの優先順位・記録契約（Phase 2） =====
  (function(){
    const chk=[];
    try{
      const r={origin:1,p:1.1,goal:2,autoGoal:2,extra:0,sp:23,v:0,obsDir:0,out:false,
        cmd:'S',intentSource:'fixture',intentSeq:4};
      const blocked=setAutoGoal(r,3,false);
      chk.push({n:'自動判断は手動Sを上書きしない',ok:blocked===false&&r.goal===2&&r.autoGoal===3&&r.intentSeq===4&&r.intentSource==='fixture'});

      setManualGoal(r,2.5,'S');
      chk.push({n:'手動判断はactive goalだけ更新',ok:r.goal===2.5&&r.autoGoal===3&&r.cmd==='S'&&r.intentSource==='manual'&&r.intentSeq===5});

      setRunnerIntent(r,1,{source:'result',force:true,updateAuto:true,cmd:null});
      chk.push({n:'規則・結果はgoal/auto/cmdを原子的に更新',ok:r.goal===1&&r.autoGoal===1&&r.cmd===null&&r.intentSource==='result'&&r.intentSeq===6});

      setRunnerIntent(r,9,{source:'result',force:true,updateAuto:false});
      chk.push({n:'行き先は0〜4へ正規化',ok:r.goal===4&&r.autoGoal===1&&r.intentSeq===7});
    }catch(e){ chk.push({n:'例外',ok:false,e:e.message}); }
    const bad=chk.filter(x=>!x.ok);
    out.test30_RunnerIntent契約={検査:chk.length,不合格:bad.map(x=>x.n),verdict:bad.length?'FAIL':'PASS'};
  })();

'''
harness = harness.replace(marker, insert + marker, 1)
HARNESS.write_text(harness, encoding='utf-8')

# Permanent CI: baseline now has 32 tests; add API mutation and guard mutation.
workflow = WORKFLOW.read_text(encoding='utf-8')
workflow = swap(
    workflow,
    """          build(base.replace(old2,new2,1),'mut29')
          PY
""",
    """          build(base.replace(old2,new2,1),'mut29')

          old3="  if(o.updateAuto!==false) r.autoGoal=goal;\\n"
          new3="  r.autoGoal=goal;\\n"
          assert base.count(old3)==1
          build(base.replace(old3,new3,1),'mut30')

          # Structural mutation: reintroduce a second direct goal writer.
          guard_old="    setRunnerIntent(r,back,{source:'rundown-timeout',force:true,updateAuto:true,cmd:null});\\n"
          guard_new="    r.goal=back; setRunnerIntent(r,back,{source:'rundown-timeout',force:true,updateAuto:true,cmd:null});\\n"
          assert base.count(guard_old)==1
          Path('/tmp/guard-mutated.html').write_text(base.replace(guard_old,guard_new,1),encoding='utf-8')
          PY

      - name: Assert architecture mutation is rejected
        run: |
          if node _architecture_guard_20260808.js /tmp/guard-mutated.html; then
            echo 'architecture mutation escaped'
            exit 1
          fi
""",
    'workflow add phase2 mutations',
)
workflow = swap(
    workflow,
    """          for name in baseline mut28 mut29; do
""",
    """          for name in baseline mut28 mut29 mut30; do
""",
    'workflow browser mutation list',
)
workflow = swap(
    workflow,
    """          if len(baseline)!=31 or bad:
""",
    """          if len(baseline)!=32 or bad:
""",
    'workflow baseline count',
)
workflow = swap(
    workflow,
    """          m28=load('mut28')
          m29=load('mut29')
          print('mut28',m28['test28_個別走者選択'])
          print('mut29',m29['test29_守備と走者意図の分離'])
""",
    """          m28=load('mut28')
          m29=load('mut29')
          m30=load('mut30')
          print('mut28',m28['test28_個別走者選択'])
          print('mut29',m29['test29_守備と走者意図の分離'])
          print('mut30',m30['test30_RunnerIntent契約'])
""",
    'workflow load test30 mutation',
)
workflow = swap(
    workflow,
    """          if m29['test29_守備と走者意図の分離'].get('verdict')!='FAIL':
              raise SystemExit('intent-leak mutation escaped')
""",
    """          if m29['test29_守備と走者意図の分離'].get('verdict')!='FAIL':
              raise SystemExit('intent-leak mutation escaped')
          if m30['test30_RunnerIntent契約'].get('verdict')!='FAIL':
              raise SystemExit('RunnerIntent API mutation escaped')
""",
    'workflow assert test30 mutation',
)
WORKFLOW.write_text(workflow, encoding='utf-8')

# Design status: mark Phase 2 as implemented in b0805-15.
doc = DOC.read_text(encoding='utf-8')
doc = swap(
    doc,
    """### Phase 2: RunnerIntent完全移行

- 捕球、挟殺、牽制、結果確定、ファウルの残る直接代入をAPIへ移す。
- `goal`を外部から直接書けない構造へ近づける。
- 走者ごとの意図状態をenum化する。
- 50録画から走者指示コーパスを作る。
""",
    """### Phase 2: RunnerIntent書き手の完全移行 — BUILD b0805-15

本PRで実施する。

- 捕球、挟殺、牽制、結果確定、ファウルの残る直接代入をAPIへ移す。
- `goal`と`autoGoal`の直接書き手を`setRunnerIntent`内の各1か所へ限定する。
- 自動・手動・規則・結果の優先順位と、決定元/更新番号の記録契約を固定する。
- architecture guardに意図的な第2書き手を注入し、CIが拒否することを確認する。

Phase 2完了後のラチェット:

- 直接`goal`書き込み: 15 → **1**
- 直接`autoGoal`書き込み: 4 → **1**
- 唯一の書き手: `setRunnerIntent`

残る課題:

- `goal`を数値だけでなく意図enumへ分離する作業は、50録画のコーパス化と合わせて後続RunnerIntent高度化で行う。
""",
    'design Phase2 status',
)
DOC.write_text(doc, encoding='utf-8')

print('patched b0805-15')
