'use strict';

/*
 * 野球ゲーム Sol Ultra 厳格レビュー再現スクリプト
 * 2026-08-05
 *
 * 実装 baseball3d.html と既存ハーネス _test_harness_20260804.js は変更しない。
 * 各所見の再現関数を、所見の保存と同時にこのファイルへ追記する。
 * 工程0の共通実行器と CAL-1〜3 は、事前宣言したオラクルのまま旧版・現行へ適用する。
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');
const crypto = require('crypto');

const REVIEW_DIR = __dirname;
const WORKSPACE_ROOT = path.dirname(REVIEW_DIR);
const HARNESS_PATH = path.join(REVIEW_DIR, '_test_harness_20260804.js');
const OLD_HTML_PATH = path.join(REVIEW_DIR, '_tmp_old_b0804-33.html');
const TARGET_HTML_PATH = path.join(REVIEW_DIR, '_tmp_target_b0805-06.html');
const OLD_BLOB_SPEC = '086d1199:野球ゲーム/baseball3d.html';
const TARGET_BLOB_SPEC = '2c9bd8012cd23702ca74bf656adf09068ca067de:野球ゲーム/baseball3d.html';
const OLD_EXPECTED_SHA256 = 'B70F4202653E3942CBD7E4C107F304223ABD66A4A5697FA104B32C6E89E091DC';
const TARGET_EXPECTED_SHA256 = '2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183';
const HARNESS_EXPECTED_SHA256 = '8C4EF06D934C68A4993F27B3139AF1EEF317BA237A00287A05466CCA5EDE85F8';
const nativeReadFileSync = fs.readFileSync.bind(fs);

function readFrozenSnapshotBytes(preferredPath, blobSpec, expectedSha256, label) {
  const bytes = fs.existsSync(preferredPath)
    ? nativeReadFileSync(preferredPath)
    : childProcess.execFileSync('git', ['show', blobSpec], {
      cwd: WORKSPACE_ROOT,
      encoding: null,
      maxBuffer: 64 * 1024 * 1024,
    });
  const actualSha256 = crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
  if (actualSha256 !== expectedSha256) {
    throw new Error(`${label} SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha256}`);
  }
  return bytes;
}

function readFrozenOldBytes() {
  return readFrozenSnapshotBytes(OLD_HTML_PATH, OLD_BLOB_SPEC, OLD_EXPECTED_SHA256, 'old b0804-33');
}

function readFrozenOldHtml() { return readFrozenOldBytes().toString('utf8'); }

function readFrozenTargetBytes() {
  return readFrozenSnapshotBytes(TARGET_HTML_PATH, TARGET_BLOB_SPEC, TARGET_EXPECTED_SHA256, 'target b0805-06');
}

function readFrozenTargetHtml() { return readFrozenTargetBytes().toString('utf8'); }

function readVerifiedHarnessBytes() {
  const bytes = nativeReadFileSync(HARNESS_PATH);
  const actualSha256 = crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
  if (actualSha256 !== HARNESS_EXPECTED_SHA256) {
    throw new Error(`harness SHA-256 mismatch: expected ${HARNESS_EXPECTED_SHA256}, got ${actualSha256}`);
  }
  return bytes;
}

function decodeFrozenRead(bytes, options) {
  const encoding = typeof options === 'string' ? options : options && options.encoding;
  return encoding ? bytes.toString(encoding) : Buffer.from(bytes);
}

fs.readFileSync = function verifiedSnapshotRead(file, options) {
  const resolved = typeof file === 'string' || Buffer.isBuffer(file)
    ? path.resolve(String(file))
    : null;
  if (resolved === path.resolve(TARGET_HTML_PATH)) {
    return decodeFrozenRead(readFrozenTargetBytes(), options);
  }
  if (resolved === path.resolve(OLD_HTML_PATH)) {
    return decodeFrozenRead(readFrozenOldBytes(), options);
  }
  if (resolved === path.resolve(HARNESS_PATH)) {
    return decodeFrozenRead(readVerifiedHarnessBytes(), options);
  }
  return nativeReadFileSync(file, options);
};

function makeNoDraw2dContext() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'measureText') return text => ({ width: String(text).length * 8 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'createPattern') return () => ({});
      return () => {};
    },
    set() { return true; },
  });
}

function makeNoDrawWebGLContext() {
  return new Proxy({}, {
    get(target, prop) {
      if (typeof prop === 'string' && /^[A-Z0-9_]+$/.test(prop)) return 1;
      if (prop === 'getShaderParameter' || prop === 'getProgramParameter') return () => true;
      if (prop === 'getShaderInfoLog' || prop === 'getProgramInfoLog') return () => '';
      if (prop === 'getAttribLocation') return () => 0;
      if (prop === 'getUniformLocation') return () => ({});
      if (prop === 'getExtension') return () => ({});
      if (typeof prop === 'string' && prop.startsWith('create')) return () => ({});
      return () => {};
    },
    set() { return true; },
  });
}

function makeStubElement(id, gl, ctx2d) {
  const element = {
    id,
    width: 1000,
    height: 620,
    clientWidth: 1000,
    clientHeight: 620,
    innerHTML: '',
    textContent: '',
    style: {},
    dataset: {},
    onclick: null,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    remove() {},
    click() {},
    querySelectorAll() { return []; },
    querySelector() { return null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 620 }; },
    getContext(kind) { return kind === 'webgl' ? gl : ctx2d; },
  };
  return new Proxy(element, {
    get(target, prop) { return prop in target ? target[prop] : null; },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}

function bootGameInVm(html, label) {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  if (!scripts.length) throw new Error(`No inline script found in ${label}`);

  const gl = makeNoDrawWebGLContext();
  const ctx2d = makeNoDraw2dContext();
  const nodes = new Map();
  const document = {
    title: 'BASEBALL 3D',
    body: null,
    createElement(tag) { return makeStubElement(tag, gl, ctx2d); },
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, makeStubElement(id, gl, ctx2d));
      return nodes.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  document.body = makeStubElement('body', gl, ctx2d);

  const quietConsole = { log() {}, warn() {}, error() {} };
  const context = {
    console: quietConsole,
    document,
    performance: { now: () => 0 },
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {},
    setTimeout() { return 1; },
    clearTimeout() {},
    setInterval() { return 1; },
    clearInterval() {},
    addEventListener() {},
    removeEventListener() {},
    Blob: function Blob() {},
    URL: { createObjectURL() { return 'blob:stub'; }, revokeObjectURL() {} },
    navigator: { userAgent: 'node-vm' },
    location: {},
    devicePixelRatio: 1,
    structuredClone: global.structuredClone,
    Math,
    Date,
    JSON,
    Array,
    Object,
    Number,
    String,
    Boolean,
    RegExp,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Float32Array,
    Uint8Array,
    Int32Array,
    Promise,
  };
  context.window = context;
  context.globalThis = context;
  context.self = context;
  vm.createContext(context);
  for (const script of scripts) {
    vm.runInContext(script, context, { filename: `${label}.html.js`, timeout: 30000 });
  }
  return context;
}

function runGoalTransitionTrace(context) {
  const probe = String.raw`
    (function(){
      newGame(); S.outs=0; S.bases=[null,{id:1,sp:24},null];
      const originalRandom=Math.random; Math.random=()=>0.5;
      try{
        startFlight({exit:92,la:-3,spray:10,q:0.7},1,[0,2.5,1.4]);
        const events=[]; let r=runners.find(x=>x.origin===2), prev=r?r.goal:null;
        for(let i=0;i<260&&['flight','throwing','play'].includes(S.phase)&&!S.over;i++){
          update(1/60); r=runners.find(x=>x.origin===2); if(!r||r.out) break;
          if(r.goal!==prev){
            events.push({frame:i+1,phase:S.phase,p:+r.p.toFixed(3),from:prev,to:r.goal,
              throwStage:throwPlay?throwPlay.stage:null});
            prev=r.goal;
          }
        }
        return {build:BUILD,events,final:r?{p:+r.p.toFixed(3),goal:r.goal,out:!!r.out}:null};
      } finally { Math.random=originalRandom; }
    })()
  `;
  return vm.runInContext(probe, context, { filename: 'CAL-1-goal-trace.js', timeout: 30000 });
}

function buildCalibrationHarnessSubset(harnessSource) {
  const startMarker = '  function totalRuns(){ try{ return total(0)+total(1); }catch(e){ return 0; } }';
  const endMarker = '  console.log(JSON.stringify(out,null,1));';
  const start = harnessSource.indexOf(startMarker);
  const end = harnessSource.indexOf(endMarker, start);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Cannot locate SHA-guarded harness tests12-14');
  }
  return `(function(){\n  const out={};\n${harnessSource.slice(start, end)}\n  return out;\n})()`;
}

function runCalibrationOnHtml(html, label, harnessSource) {
  const context = bootGameInVm(html, label);
  vm.runInContext('globalThis.__reviewOriginalRandom=Math.random; Math.random=()=>0.5;', context);
  let harnessResult;
  try {
    const calibrationHarnessSource = buildCalibrationHarnessSubset(harnessSource);
    harnessResult = vm.runInContext(calibrationHarnessSource, context, {
      filename: '_test_harness_20260804.tests12-14.js',
      timeout: 120000,
    });
  } finally {
    vm.runInContext('Math.random=globalThis.__reviewOriginalRandom; delete globalThis.__reviewOriginalRandom;', context);
  }
  const findTest = number => harnessResult[
    Object.keys(harnessResult).find(key => key.startsWith(`test${number}_`))
  ];
  const tests = { CAL_1: findTest(12), CAL_2: findTest(13), CAL_3: findTest(14) };
  const trialCountsPositive = tests.CAL_1.trials > 0 && tests.CAL_2.trials > 0 && tests.CAL_3.trials > 0;
  return {
    build: vm.runInContext('BUILD', context),
    tests,
    trialCountsPositive,
    goalTransitionTrace: runGoalTransitionTrace(context),
  };
}

function calibrateDetectionPower() {
  const harnessSource = fs.readFileSync(HARNESS_PATH, 'utf8');
  const oldHtml = readFrozenOldHtml();
  const targetHtml = readFrozenTargetHtml();
  const oldResult = runCalibrationOnHtml(oldHtml, 'old-b0804-33', harnessSource);
  const targetResult = runCalibrationOnHtml(targetHtml, 'target-b0805-06', harnessSource);
  const oldFailed = Object.values(oldResult.tests).every(test => test.verdict === 'FAIL');
  const targetPassed = Object.values(targetResult.tests).every(test => test.verdict === 'PASS');
  const gatePassed = oldFailed && targetPassed
    && oldResult.trialCountsPositive && targetResult.trialCountsPositive;
  return { targetCommit: TARGET_BLOB_SPEC.split(':')[0], gatePassed, old: oldResult, target: targetResult };
}

if (require.main === module && process.argv.includes('--calibrate')) {
  const result = calibrateDetectionPower();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.gatePassed) process.exitCode = 1;
}

// 所見1（深さ=照合）: 最終時間切れがlive条件を禁止せずgraceに変換する構造を固定確認する。
function inspectFinding1HardTimeoutGuardOrder(html = fs.readFileSync(TARGET_HTML_PATH, 'utf8')) {
  const grace = "const grace = (midBase || keyHeld || ballLive) ? 8 : 0;";
  const hardStop = "if(S.playClock > (inRundown?24:12) + grace){";
  const sink = "return concludePlay();";
  const graceAt = html.indexOf(grace);
  const hardStopAt = html.indexOf(hardStop, graceAt);
  const sinkAt = html.indexOf(sink, hardStopAt);
  return {
    finding: 1,
    matched: graceAt >= 0 && hardStopAt > graceAt && sinkAt > hardStopAt,
    graceAt,
    hardStopAt,
    sinkAt,
    depth: '照合（実行未検証）',
  };
}

// 所見2（深さ=照合）: SをtagUpへ保存した直後の帰塁setterがcmd門番で不発になる組合せ。
function inspectFinding2FlyReturnBlockedByCommand(html = fs.readFileSync(TARGET_HTML_PATH, 'utf8')) {
  const caller = "if(r.cmd==='S') r.tagUp=true; setAutoGoal(r, r.origin);";
  const guard = "if(!force && r.cmd) return;";
  const write = "r.goal=g;";
  const callerAt = html.indexOf(caller);
  const guardAt = html.indexOf(guard);
  const writeAt = html.indexOf(write, guardAt);
  return { finding: 2, matched: callerAt >= 0 && guardAt >= 0 && writeAt > guardAt,
    callerAt, guardAt, writeAt, depth: '照合（実行未検証）' };
}

// 所見3（深さ=照合）: 打者走者のgoal書換えがZ/塁指定門番より前にある順序を確認する。
function inspectFinding3BatterBypassesSelectionGate(html = fs.readFileSync(TARGET_HTML_PATH, 'utf8')) {
  const batter = "if(r.origin===0){";
  const write = "r.goal=Math.max(here, Math.min(here+1, max, 4)); r.cmd='S';";
  const leadGate = "if(leadOnly && r!==lead) return;";
  const pickedGate = "if(picked && r!==picked) return;";
  const batterAt = html.indexOf(batter, html.indexOf('function applyRunnerKeys'));
  const writeAt = html.indexOf(write, batterAt);
  const leadAt = html.indexOf(leadGate, writeAt);
  const pickedAt = html.indexOf(pickedGate, leadAt);
  return { finding: 3, matched: batterAt >= 0 && writeAt > batterAt && leadAt > writeAt && pickedAt > leadAt,
    batterAt, writeAt, leadAt, pickedAt, depth: '照合（実行未検証）' };
}

// 所見4（深さ=照合）: 旧prim固定→ball.primary交代→旧prim再利用の順序を確認する。
function inspectFinding4WallHandoffUsesStalePrimary(html = fs.readFileSync(TARGET_HTML_PATH, 'utf8')) {
  const bind = 'const prim=ball.primary;';
  const reassign = 'ball.primary=plan.f; ball.planT=ball.t+plan.t;';
  const reuse = 'const d2=Math.hypot(ball.x-prim.cx, ball.y-prim.cy);';
  const bindAt = html.indexOf(bind);
  const reassignAt = html.indexOf(reassign, bindAt);
  const reuseAt = html.indexOf(reuse, reassignAt);
  return { finding: 4, matched: bindAt >= 0 && reassignAt > bindAt && reuseAt > reassignAt,
    bindAt, reassignAt, reuseAt, depth: '照合（実行未検証）' };
}

// 所見5（深さ=照合）: 長距離本塁中継ブロックにcover解除はあるが元塁再配置がないことを確認する。
function inspectFinding5LongHomeRelayDropsCover(html = fs.readFileSync(TARGET_HTML_PATH, 'utf8')) {
  const start = html.indexOf('if(T.target===4 && farLaunch>158){');
  const end = html.indexOf('}', html.indexOf('setTarget(cut,', start));
  const block = start >= 0 && end > start ? html.slice(start, end + 1) : '';
  return { finding: 5, matched: block.includes('cut.coverBase=null;') && !block.includes('rundownCover('),
    start, end, depth: '照合（実行未検証）' };
}

// 所見6（深さ=照合）: rundownCoverの候補選択に空き役割・非primary条件がないことを確認する。
function inspectFinding6RundownCoverStealsAssignedFielder(html = fs.readFileSync(TARGET_HTML_PATH, 'utf8')) {
  const start = html.indexOf('function rundownCover(');
  const end = html.indexOf('function coverOf(', start);
  const block = start >= 0 && end > start ? html.slice(start, end) : '';
  return { finding: 6,
    matched: block.includes('best.coverBase=base') && !block.includes('coverBase==null') && !block.includes('!f.primary'),
    start, end, depth: '照合（実行未検証）' };
}

function runPhase2StaticInspections() {
  const html = fs.readFileSync(TARGET_HTML_PATH, 'utf8');
  const results = [
    inspectFinding1HardTimeoutGuardOrder(html),
    inspectFinding2FlyReturnBlockedByCommand(html),
    inspectFinding3BatterBypassesSelectionGate(html),
    inspectFinding4WallHandoffUsesStalePrimary(html),
    inspectFinding5LongHomeRelayDropsCover(html),
    inspectFinding6RundownCoverStealsAssignedFielder(html),
  ];
  return { build: /const BUILD\s*=\s*'([^']+)'/.exec(html)?.[1] || null,
    allMatched: results.every(result => result.matched), results };
}

if (require.main === module && process.argv.includes('--phase2-static')) {
  const result = runPhase2StaticInspections();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.allMatched) process.exitCode = 1;
}

function selectPhase3AdversarialTwenty() {
  const crypto = require('crypto');
  const fablePath = path.join(REVIEW_DIR, 'review_fable_20260805.md');
  const solPath = path.join(REVIEW_DIR, 'review_sol_20260805.md');
  const fable = new Map();
  const sol = new Map();
  for (const line of fs.readFileSync(fablePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\|\s*(\d{3})\s*\|\s*(解決|部分解決|未解決|退行|判定不能|対象外)\s*\|/);
    if (match) fable.set(match[1], match[2]);
  }
  for (const line of fs.readFileSync(solPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\|\s*OI-(\d{3})\s*\|\s*(解決|部分解決|未解決|退行|判定不能|対象外)\s*\|/);
    if (match) sol.set(match[1], match[2]);
  }
  const seed = 'SOL-ULTRA-20260805';
  const sourceSha256 = '2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183';
  const pool = [];
  const unresolvedOrRegressed = [];
  for (let number = 1; number <= 239; number += 1) {
    const id = String(number).padStart(3, '0');
    const f = fable.get(id);
    const s = sol.get(id);
    if (f === '解決' && s === '解決') {
      const key = `${seed}|${sourceSha256}|OI-${id}`;
      pool.push({ id: `OI-${id}`, rank: crypto.createHash('sha256').update(key, 'utf8').digest('hex').toUpperCase() });
    }
    if (['未解決', '退行'].includes(f) || ['未解決', '退行'].includes(s)) {
      unresolvedOrRegressed.push({ id: `OI-${id}`, fable: f, sol: s });
    }
  }
  pool.sort((a, b) => a.rank.localeCompare(b.rank));
  return { seed, sourceSha256, poolSize: pool.length, selected: pool.slice(0, 20), unresolvedOrRegressed };
}

if (require.main === module && process.argv.includes('--phase3-select')) {
  process.stdout.write(`${JSON.stringify(selectPhase3AdversarialTwenty(), null, 2)}\n`);
}

// 所見7（深さ=実行）: 高い飛球中のZ「先頭だけ」が打者走者にも漏れる。
function reproFinding7TagFlySelectedRunnerLeak(repetitions = 5) {
  const html = fs.readFileSync(TARGET_HTML_PATH, 'utf8');
  const context = bootGameInVm(html, 'finding7-tag-fly-selection');
  const trials = [];
  for (let trial = 0; trial < repetitions; trial += 1) {
    const observed = vm.runInContext(String.raw`
      (()=>{
        newGame(); S.half=0; S.outs=0; S.preOuts=0; S.phase='flight';
        runners=[
          {origin:0,p:1,goal:1,autoGoal:1,sp:24,v:0,out:false},
          {origin:2,p:2.50,goal:3,autoGoal:3,sp:24,v:18,out:false}
        ];
        ball={landed:false,canCatchAir:true,maxZ:20};
        for(const key in held) held[key]=false;
        held['z']=true;
        applyRunnerKeys();
        return runners.map(r=>({origin:r.origin,p:r.p,goal:r.goal,cmd:r.cmd||null,tagUp:!!r.tagUp}));
      })()
    `, context, { timeout: 30000 });
    const batter = observed.find(runner => runner.origin === 0);
    const lead = observed.find(runner => runner.origin === 2);
    trials.push({ trial: trial + 1, expectedBatterGoal: 1, observedBatterGoal: batter.goal,
      observedLeadGoal: lead.goal, leaked: batter.goal !== 1 });
  }
  const leaks = trials.filter(trial => trial.leaked).length;
  return { finding: 7, build: vm.runInContext('BUILD', context), repetitions,
    leaks, verdict: leaks === 0 ? 'PASS' : 'FAIL', trials };
}

if (require.main === module && process.argv.includes('--finding7')) {
  const result = reproFinding7TagFlySelectedRunnerLeak();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.verdict === 'FAIL') process.exitCode = 1;
}

// 無作為標本OI-088が覆ったため、同型の個別走塁操作OI-088/165/219/228へ拡張する。
function runPhase3ControlScopeExpansion(repetitions = 5) {
  const html = fs.readFileSync(TARGET_HTML_PATH, 'utf8');
  const context = bootGameInVm(html, 'phase3-control-scope-expansion');
  const evaluate = source => vm.runInContext(source, context, { timeout: 30000 });
  const groups = { 'OI-088': [], 'OI-165': [], 'OI-219': [], 'OI-228': [] };
  for (let trial = 0; trial < repetitions; trial += 1) {
    groups['OI-088'].push(evaluate(String.raw`
      (()=>{ newGame(); S.half=0; S.outs=0; S.preOuts=0; S.phase='flight';
        runners=[{origin:0,p:1,goal:1,autoGoal:1,sp:24,v:0,out:false},
          {origin:2,p:2.5,goal:3,autoGoal:3,sp:24,v:18,out:false}];
        ball={landed:false,canCatchAir:true,maxZ:20}; for(const k in held) held[k]=false; held.z=true;
        applyRunnerKeys(); const b=runners.find(r=>r.origin===0);
        return {expected:1,actual:b.goal,pass:b.goal===1}; })()
    `));
    groups['OI-165'].push(evaluate(String.raw`
      (()=>{ newGame(); S.half=0; S.outs=0; S.preOuts=0; S.phase='flight';
        runners=[{origin:0,p:0,goal:1,autoGoal:1,sp:24,v:0,out:false},
          {origin:1,p:1.085,goal:1,autoGoal:1,sp:24,v:0,out:false},
          {origin:3,p:3.085,goal:3,autoGoal:3,sp:24,v:0,out:false}];
        ball={landed:false,canCatchAir:true,maxZ:20}; for(const k in held) held[k]=false; held['1']=true; held.s=true;
        applyRunnerKeys(); const batter=runners.find(r=>r.origin===0), first=runners.find(r=>r.origin===1), third=runners.find(r=>r.origin===3);
        return {expectedBatterGoal:1,actualBatterGoal:batter.goal,selectedGoal:first.goal,unselectedGoal:third.goal,
          pass:batter.goal===1 && third.goal===3}; })()
    `));
    groups['OI-219'].push(evaluate(String.raw`
      (()=>{ newGame(); S.half=0; S.outs=0; S.preOuts=0; S.phase='flight';
        runners=[{origin:0,p:1.05,goal:1,autoGoal:1,sp:24,v:0,out:false}];
        ball={landed:false,canCatchAir:true,maxZ:20}; for(const k in held) held[k]=false; held.s=true;
        applyRunnerKeys(); const batter=runners[0]; return {expected:2,actual:batter.goal,pass:batter.goal===2}; })()
    `));
    groups['OI-228'].push(evaluate(String.raw`
      (()=>{ newGame(); S.half=0; S.outs=0; S.preOuts=0; S.phase='throwing';
        runners=[{origin:1,p:1.5,goal:1,autoGoal:1,sp:24,v:0,out:false}];
        throwPlay={stage:'rundown',rd:{r:runners[0]}}; ball={landed:true,canCatchAir:false,maxZ:0};
        for(const k in held) held[k]=false; held.s=true; updateRunnerCommands();
        return {expected:2,actual:runners[0].goal,pass:runners[0].goal===2}; })()
    `));
  }
  const summary = Object.fromEntries(Object.entries(groups).map(([id, trials]) => [id, {
    repetitions: trials.length, passed: trials.filter(result => result.pass).length,
    verdict: trials.every(result => result.pass) ? 'PASS' : 'FAIL', trials,
  }]));
  return { build: vm.runInContext('BUILD', context), sameType: ['OI-088','OI-165','OI-219','OI-228'], summary };
}

if (require.main === module && process.argv.includes('--phase3-control-scope')) {
  const result = runPhase3ControlScopeExpansion();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (Object.values(result.summary).some(item => item.verdict === 'FAIL')) process.exitCode = 1;
}

function summarizeRuntimeBug(finding, title, expectation, trials, bugPredicate) {
  const reproduced = trials.filter(bugPredicate).length;
  return { finding, title, expectation, repetitions: trials.length, reproduced,
    verdict: reproduced > 0 ? 'FAIL' : 'PASS', trials };
}

function reproFinding1HardTimeoutLiveState() {
  const html = fs.readFileSync(TARGET_HTML_PATH, 'utf8');
  const context = bootGameInVm(html, 'finding1-hard-timeout-runtime');
  const trials = vm.runInContext(String.raw`
    (()=>{ const out=[]; const saved=Math.random; Math.random=()=>0.5;
      try{ for(let rep=1;rep<=3;rep++){
        newGame(); S.half=0; S.phase='throwing'; S.outs=0; S.preOuts=0;
        S.playClock=20.05+rep*0.001; S.throwCount=0; S.errorBy=null;
        const pitcher=fielders.find(f=>f.n==='投');
        runners=[{p:1.5,goal:2,autoGoal:2,extra:0,origin:1,sp:25,v:0,cmd:'S'}];
        held.s=true; held.z=false; held.x=false;
        ball={x:0,y:60,z:5,t:0,vx:0,vy:0,vz:0,land:false,landed:false,maxZ:5,primary:pitcher,canCatchAir:false};
        throwPlay={stage:'transfer',t:0,transfer:99,thrower:pitcher,kind:'outfield',award:1,target:'P',relayed:true,fieldT:1};
        const before={playClock:S.playClock,p:runners[0].p,keyHeld:held.s,ballZ:ball.z,phase:S.phase};
        updateThrowPhase(0.01);
        out.push({rep,before,after:{playClock:S.playClock,phase:S.phase,throwPlay:!!throwPlay,
          closed:S.phase==='play'&&throwPlay===null}}); held.s=false;
      }} finally{ Math.random=saved; held.s=false; held.z=false; held.x=false; }
      return out; })()
  `, context, { timeout: 30000 });
  return summarizeRuntimeBug(1, '20秒超でlive条件を無視して終了',
    '塁間走者・入力・空中球があれば継続', trials, trial => trial.after.closed);
}

function reproFinding2TagUpReturnBlocked() {
  const html = fs.readFileSync(TARGET_HTML_PATH, 'utf8');
  const context = bootGameInVm(html, 'finding2-tag-return-runtime');
  const trials = vm.runInContext(String.raw`
    (()=>{ const out=[]; const saved=Math.random; Math.random=()=>0.5;
      try{ for(let rep=1;rep<=3;rep++){
        newGame(); S.half=0; S.phase='flight'; S.outs=0; S.preOuts=0;
        const prim=fielders.find(f=>f.n==='中');
        fielders.forEach(f=>{f.primary=f===prim;f.tx=f.cx;f.ty=f.cy;f.v=0;f.stun=0;f.fumbled=false;});
        prim.cx=200;prim.cy=20;prim.tx=200;prim.ty=20;
        const r={p:1.08,goal:2,autoGoal:2,extra:0,origin:1,sp:25,v:0,cmd:'S',tagUp:false}; runners=[r];
        ball={x:0,y:180,z:25,t:0.36,vx:0,vy:8,vz:-1,maxZ:25,landed:false,canCatchAir:true,
          retreated:false,primary:prim,planT:999,aimT:999,replanT:999,acc:0,exit:80,la:35,spray:0};
        const before={p:r.p,goal:r.goal,autoGoal:r.autoGoal,cmd:r.cmd}; stepFlight(PHYS_H);
        out.push({rep,before,after:{p:r.p,goal:r.goal,autoGoal:r.autoGoal,cmd:r.cmd,tagUp:r.tagUp},
          blocked:r.tagUp&&r.autoGoal===1&&r.goal!==1});
      }} finally{Math.random=saved;} return out; })()
  `, context, { timeout: 30000 });
  return summarizeRuntimeBug(2, 'S入力中の飛球帰塁goalが不発', 'tagUpを保持してgoalは元塁へ戻す',
    trials, trial => trial.blocked);
}

function reproFinding4WallHandoffStalePrimary() {
  const html = fs.readFileSync(TARGET_HTML_PATH, 'utf8');
  const context = bootGameInVm(html, 'finding4-wall-handoff-runtime');
  const trials = vm.runInContext(String.raw`
    (()=>{ const out=[]; const savedRandom=Math.random; Math.random=()=>0.5; const savedPlan=planPlay;
      try{ for(let rep=1;rep<=3;rep++){
        newGame(); S.half=0; S.phase='flight'; S.outs=0; S.preOuts=0; S.throwCount=0; runners=[];
        const oldPrim=fielders.find(f=>f.n==='左'), newPrim=fielders.find(f=>f.n==='中');
        fielders.forEach(f=>{f.primary=false;f.coverBase=null;f.v=0;f.stun=0;f.fumbled=false;f.run=0;f.tx=f.cx;f.ty=f.cy;});
        oldPrim.cx=0;oldPrim.cy=399.4;oldPrim.tx=0;oldPrim.ty=399.4;oldPrim.primary=true;
        newPrim.cx=100;newPrim.cy=100;newPrim.tx=100;newPrim.ty=100;
        ball={x:0,y:399.9,z:0.01,t:1,vx:0,vy:100,vz:-1,maxZ:10,landed:true,canCatchAir:false,
          primary:oldPrim,planT:999,aimT:999,replanT:999,acc:0,exit:70,la:0,spray:0};
        planPlay=()=>({f:newPrim,t:1,x:0,y:350,air:false,firstLand:{x:0,y:350,z:0,t:1}});
        const before={old:oldPrim.n,next:newPrim.n,newDistance:+Math.hypot(newPrim.cx,newPrim.cy-399.4).toFixed(3)};
        stepFlight(PHYS_H);
        out.push({rep,before,after:{assigned:ball.primary&&ball.primary.n,phase:S.phase,
          thrower:throwPlay&&throwPlay.thrower&&throwPlay.thrower.n},
          staleCaught:S.phase==='throwing'&&throwPlay&&throwPlay.thrower===oldPrim&&ball.primary===newPrim});
      }} finally{planPlay=savedPlan;Math.random=savedRandom;} return out; })()
  `, context, { timeout: 30000 });
  return summarizeRuntimeBug(4, '壁反射交代tickで旧担当が捕球', '交代後は新担当の距離で判定',
    trials, trial => trial.staleCaught);
}

function reproFinding5LongHomeRelayDropsCover() {
  const html = fs.readFileSync(TARGET_HTML_PATH, 'utf8');
  const context = bootGameInVm(html, 'finding5-home-relay-cover-runtime');
  const trials = vm.runInContext(String.raw`
    (()=>{ const out=[]; const saved=Math.random; Math.random=()=>0.5;
      try{ for(let rep=1;rep<=3;rep++){
        newGame(); S.half=0; S.phase='throwing'; S.outs=0; S.preOuts=0; S.playClock=0; S.throwCount=0; runners=[];
        const thrower=fielders.find(f=>f.n==='中'), catcher=fielders.find(f=>f.n==='捕');
        const first=fielders.find(f=>f.n==='一'), second=fielders.find(f=>f.n==='二'), third=fielders.find(f=>f.n==='三');
        fielders.forEach(f=>{f.primary=false;f.coverBase=null;f.v=0;f.stun=0;f.run=0;f.tx=f.cx;f.ty=f.cy;});
        thrower.cx=0;thrower.cy=170;thrower.tx=0;thrower.ty=170;
        catcher.cx=0;catcher.cy=0;catcher.coverBase=4; first.coverBase=1;second.coverBase=2;third.coverBase=3;
        for(const f of [first,second,third,catcher]){const p=throwPoint(f.coverBase);f.tx=p[0];f.ty=p[1];}
        ball={x:thrower.cx,y:thrower.cy,z:4.4,t:0,vx:0,vy:0,vz:0,landed:false,maxZ:0};
        throwPlay={stage:'transfer',t:1,transfer:0,thrower,kind:'outfield',award:1,target:4,relayed:true,fieldT:2};
        const before={cut:first.n,cutCover:first.coverBase,base1:fielders.filter(f=>f.coverBase===1).map(f=>f.n)};
        updateThrowPhase(0.01);
        out.push({rep,before,after:{cutCover:first.coverBase,cutTarget:[first.tx,first.ty],
          base1:fielders.filter(f=>f.coverBase===1).map(f=>f.n)},base1Lost:!fielders.some(f=>f.coverBase===1)});
      }} finally{Math.random=saved;} return out; })()
  `, context, { timeout: 30000 });
  return summarizeRuntimeBug(5, '長距離本塁中継で元cover消失', 'cutを出しても元塁へ代役を置く',
    trials, trial => trial.base1Lost);
}

function reproFinding6RundownCoverStealsRole() {
  const html = fs.readFileSync(TARGET_HTML_PATH, 'utf8');
  const context = bootGameInVm(html, 'finding6-rundown-cover-runtime');
  const trials = vm.runInContext(String.raw`
    (()=>{ const out=[]; for(const mode of ['別塁cover','primary']){ for(let rep=1;rep<=3;rep++){
      newGame(); const occupied=fielders.find(f=>f.n==='投'), free=fielders.find(f=>f.n==='遊');
      fielders.forEach((f,i)=>{f.primary=false;f.coverBase=null;f.cx=260+i*5;f.cy=260+i*5;f.tx=f.cx;f.ty=f.cy;});
      occupied.cx=0;occupied.cy=127.28;occupied.tx=0;occupied.ty=127.28;
      free.cx=12;free.cy=127.28;free.tx=12;free.ty=127.28;
      if(mode==='別塁cover')occupied.coverBase=1;else occupied.primary=true;
      const picked=rundownCover(2,null,null);
      out.push({rep,mode,picked:picked&&picked.n,occupiedCover:occupied.coverBase,occupiedPrimary:occupied.primary,
        base1:fielders.filter(f=>f.coverBase===1).map(f=>f.n),base2:fielders.filter(f=>f.coverBase===2).map(f=>f.n),
        stole:picked===occupied&&(mode==='primary'?occupied.primary:!fielders.some(f=>f.coverBase===1))});
    }} return out; })()
  `, context, { timeout: 30000 });
  return summarizeRuntimeBug(6, 'rundownCoverが既任者を奪う', '既存cover/primaryを避け空き野手を選ぶ',
    trials, trial => trial.stole);
}

function runPhase3StructuralRuntimeConfirmations() {
  const build = /const BUILD\s*=\s*'([^']+)'/.exec(readFrozenTargetHtml())?.[1] || null;
  const f3 = runPhase3ControlScopeExpansion(3);
  const f3Trials = [
    ...f3.summary['OI-088'].trials.map((trial,index)=>({rep:index+1,mode:'Z',changed:!trial.pass,trial})),
    ...f3.summary['OI-165'].trials.map((trial,index)=>({rep:index+1,mode:'1+S',changed:!trial.pass,trial})),
  ];
  const finding3 = summarizeRuntimeBug(3, '対象門番より先に打者走者を更新', '対象外打者のgoal/cmdを不変にする',
    f3Trials, trial => trial.changed);
  const findings = [reproFinding1HardTimeoutLiveState(), reproFinding2TagUpReturnBlocked(), finding3,
    reproFinding4WallHandoffStalePrimary(), reproFinding5LongHomeRelayDropsCover(), reproFinding6RundownCoverStealsRole()];
  return { build, convention:'FAIL=バグ再現のため未解決', findings,
    totalTrials:findings.reduce((sum,item)=>sum+item.repetitions,0),
    failed:findings.filter(item=>item.verdict==='FAIL').length };
}

if (require.main === module && process.argv.includes('--phase3-structural-runtime')) {
  const result = runPhase3StructuralRuntimeConfirmations();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.failed) process.exitCode = 1;
}

// 工程3: 本日修理9件の隣接挙動（35状態×3反復）。
function runPhase3RepairAdjacencySuite(repeatCount = 3) {
  const REPEATS = repeatCount;
  const nodeCrypto = require('crypto');
function make2d() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(_t, p) {
      if (p === 'measureText') return s => ({ width: String(s).length * 8 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => gradient;
      if (p === 'createPattern') return () => ({});
      return () => {};
    },
    set() { return true; },
  });
}

function makeGl() {
  return new Proxy({}, {
    get(_t, p) {
      if (typeof p === 'string' && /^[A-Z0-9_]+$/.test(p)) return 1;
      if (p === 'getShaderParameter' || p === 'getProgramParameter') return () => true;
      if (p === 'getShaderInfoLog' || p === 'getProgramInfoLog') return () => '';
      if (p === 'getAttribLocation') return () => 0;
      if (p === 'getUniformLocation') return () => ({});
      if (p === 'getExtension') return () => ({});
      if (typeof p === 'string' && p.startsWith('create')) return () => ({});
      return () => {};
    },
    set() { return true; },
  });
}

function makeElement(id, gl, ctx2d) {
  const e = {
    id, width: 1000, height: 620, clientWidth: 1000, clientHeight: 620,
    innerHTML: '', textContent: '', style: {}, dataset: {}, onclick: null,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {}, click() {},
    querySelectorAll() { return []; }, querySelector() { return null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 620 }; },
    getContext(kind) { return kind === 'webgl' ? gl : ctx2d; },
  };
  return new Proxy(e, {
    get(t, p) { return p in t ? t[p] : null; },
    set(t, p, v) { t[p] = v; return true; },
  });
}

function boot(html) {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  if (!scripts.length) throw new Error('inline script not found');
  const gl = makeGl();
  const ctx2d = make2d();
  const nodes = new Map();
  const document = {
    title: 'BASEBALL 3D', body: null,
    createElement(tag) { return makeElement(tag, gl, ctx2d); },
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, makeElement(id, gl, ctx2d));
      return nodes.get(id);
    },
    querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {},
  };
  document.body = makeElement('body', gl, ctx2d);
  const context = {
    console: { log() {}, warn() {}, error() {} }, document,
    performance: { now: () => 0 }, requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
    addEventListener() {}, removeEventListener() {}, Blob: function Blob() {},
    URL: { createObjectURL() { return 'blob:stub'; }, revokeObjectURL() {} },
    navigator: { userAgent: 'node-vm' }, location: {}, devicePixelRatio: 1,
  };
  context.window = context; context.self = context; context.globalThis = context;
  vm.createContext(context);
  for (const script of scripts) vm.runInContext(script, context, { timeout: 30000, filename: 'frozen-target.js' });
  vm.runInContext('Math.random=()=>0.5;', context);
  return context;
}

function run(ctx, code, name) {
  return vm.runInContext(code, ctx, { timeout: 30000, filename: name + '.js' });
}

const close = (a, b, eps = 1e-8) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;

function repetitions(fn) {
  const rows = [];
  for (let i = 0; i < REPEATS; i++) rows.push(fn(i));
  return rows;
}

function addCase(repair, name, state, oracle, fn) {
  const reps = repetitions(fn);
  repair.cases.push({ name, state, oracle, repetitions: reps, pass: reps.every(x => x.pass) });
}

function controlledOracle(kind, rate, opts = {}) {
  const x0 = opts.x0 === undefined ? 40 : opts.x0;
  const sp = opts.sp === undefined ? 20 : opts.sp;
  const margin = opts.margin === undefined ? 0.28 : opts.margin;
  const react = opts.react || 0;
  const mov = opts.mov || 0;
  const runMode = opts.runMode || 'linear';
  const max = kind === 'plan' ? 1700 : 900;
  const stride = kind === 'plan' ? 4 : 6;
  const samples = [];
  for (let i = 0; i < max; i++) {
    const t = (i + 1) / 240;
    if (i % stride) continue;
    if (kind === 'plan' && t <= 0.22) continue;
    const x = x0 + rate * t;
    const d = Math.max(0, Math.abs(x) - 4.5);
    let runPay;
    if (runMode === 'linear') {
      runPay = d / sp;
    } else {
      const accF = 1.15;
      const dAcc = 0.5 * sp * accF;
      const full = d <= dAcc ? Math.sqrt(2 * d * accF / sp) : accF / 2 + d / sp;
      runPay = Math.max(d / sp, full - (accF / 2) * mov);
    }
    const base = react + runPay;
    samples.push({ t, x, base });
  }
  const h0 = samples.find(p => p.base <= p.t);
  const hM = samples.find(p => p.base + margin <= p.t);
  const gap = h0 && hM ? hM.t - h0.t : null;
  const chosen = h0 && (!hM || gap > 0.12) ? h0 : (hM || h0);
  return { h0, hM, gap, chosen };
}

const html = fs.readFileSync(TARGET_HTML_PATH, 'utf8');
const ctx = boot(html);
const result = {
  target: TARGET_HTML_PATH,
  sha256: nodeCrypto.createHash('sha256').update(Buffer.from(html, 'utf8')).digest('hex').toUpperCase(),
  build: run(ctx, 'BUILD', 'build'),
  renderer: 'Node vm, WebGL/2D no-draw stubs, requestAnimationFrame suppressed',
  repeatsPerCase: REPEATS,
  repairs: [],
};

// 1. Timeout ordering and +8 second grace.
{
  const r = { label: 'R1_時間切れ先行+grace8', cases: [] };
  function probe(clock, mid) {
    return run(ctx, `(function(){
      newGame(); const keep=concludePlay; let calls=0; concludePlay=function(){calls++;};
      try{
        S.phase='throwing'; S.outs=0; S.preOuts=0; S.playClock=${clock};
        const f=fielders[0]; f.cx=200; f.cy=200; f.sp=20; f.v=0;
        runners=[{origin:1,p:${mid ? 1.5 : 1},goal:${mid ? 2 : 1},autoGoal:${mid ? 2 : 1},extra:0,sp:22,v:0,dir:0,out:false}];
        ball={x:200,y:200,z:0,vx:0,vy:0,vz:0,bs:0,ss:0,landed:true,t:0,maxZ:0};
        throwPlay={stage:'transfer',t:0,transfer:99,thrower:f,kind:'ground',target:1,relayed:false};
        updateThrowPhase(0.001);
        return {calls,clock:+S.playClock.toFixed(3),stage:throwPlay&&throwPlay.stage,p:+runners[0].p.toFixed(4)};
      } finally { concludePlay=keep; }
    })()`, 'timeout');
  }
  addCase(r, '通常上限12秒を越えた静止状態', { playClock: 12.001, midBase: false }, { concludeCalls: 1 }, () => {
    const o = probe(12.001, false); return { observed: o, pass: o.calls === 1 };
  });
  addCase(r, '塁間走者で12秒を越えても継続', { playClock: 12.001, runnerP: 1.5 }, { concludeCalls: 0, extendedLimit: 20 }, () => {
    const o = probe(12.001, true); return { observed: o, pass: o.calls === 0 && o.clock > 12 };
  });
  addCase(r, '塁間走者でも20秒超で打切り', { playClock: 20.001, runnerP: 1.5 }, { concludeCalls: 1, cap: 12 + 8 }, () => {
    const o = probe(20.001, true); return { observed: o, pass: o.calls === 1 };
  });
  result.repairs.push(r);
}

// 2. Scoring is based on actual p >= 3.97.
{
  const r = { label: 'R2_得点p>=3.97', cases: [] };
  function probe(p) {
    return run(ctx, `(function(){
      newGame(); const keep=finishPlay; let cap=null; finishPlay=function(x){cap=x;};
      try{
        S.outs=0; S.preOuts=0; S.thirdOutScored=null; S.playClock=0;
        throwPlay={kind:'ground',stage:'transfer',thrower:fielders[0]};
        runners=[{origin:3,p:${p},goal:4,autoGoal:4,extra:0,sp:22,v:0,out:false}];
        concludePlay();
        return {runs:cap&&cap.runs,bases:(cap&&cap.bases||[]).map(Boolean),goal:runners[0].goal,out:!!runners[0].out};
      } finally { finishPlay=keep; }
    })()`, 'score');
  }
  addCase(r, '閾値直下は得点にしない', { p: 3.969, goal: 4 }, { runs: 0, thirdBaseOccupied: true }, () => {
    const o = probe(3.969); return { observed: o, pass: o.runs === 0 && o.bases[2] === true };
  });
  addCase(r, '閾値ちょうどは得点', { p: 3.97, goal: 4 }, { runs: 1, basesEmpty: true }, () => {
    const o = probe(3.97); return { observed: o, pass: o.runs === 1 && !o.bases.some(Boolean) };
  });
  addCase(r, '本塁到達後も1点だけ', { p: 4.0, goal: 4 }, { runs: 1 }, () => {
    const o = probe(4.0); return { observed: o, pass: o.runs === 1 };
  });
  result.repairs.push(r);
}

// 3. A non-forced runner already 0.35 bases off the bag remains committed.
{
  const r = { label: 'R3_捕球時踏切0.35', cases: [] };
  function probe(p) {
    return run(ctx, `(function(){
      newGame(); const keep=chooseThrowTarget; chooseThrowTarget=()=>({nb:'P'});
      try{
        S.outs=0; S.preOuts=0; S.bases=[null,{id:1,sp:22},null];
        const f=fielders[0]; f.fld=70; f.cat=70;
        runners=[{origin:2,p:${p},goal:3,autoGoal:3,extra:0,sp:22,v:18,dir:1,out:false}];
        ball={x:0,y:0,z:0,vx:0,vy:0,vz:0,t:1};
        beginThrowPhase(f,'ground',0,null);
        return {delta:+(runners[0].p-runners[0].origin).toFixed(3),goal:runners[0].goal,safeGoal:runners[0].safeGoal};
      } finally { chooseThrowTarget=keep; }
    })()`, 'commit');
  }
  addCase(r, '0.35未満は元塁へ戻す', { origin: 2, p: 2.349 }, { goal: 2 }, () => {
    const o = probe(2.349); return { observed: o, pass: o.goal === 2 && o.safeGoal === 2 };
  });
  addCase(r, '0.35以上は次塁へ継続', { origin: 2, p: 2.35 }, { goal: 3 }, () => {
    const o = probe(2.35); return { observed: o, pass: o.goal === 3 && o.safeGoal === 3 };
  });
  result.repairs.push(r);
}

// 4. Both closure paths must continue every base interval.
{
  const r = { label: 'R4_endRundown/concludeOrChaseHome全塁間継続', cases: [] };
  function probe(which, from, relay) {
    return run(ctx, `(function(){
      newGame(); const keep=concludePlay; let calls=0; concludePlay=function(){calls++;};
      try{
        S.outs=0; S.preOuts=0;
        const holder=fielders[0]; holder.fld=70; holder.cat=70;
        const u={origin:${from},p:${from + 0.5},goal:${from + 1},autoGoal:${from + 1},extra:0,sp:22,v:10,out:false};
        runners=[u];
        if('${which}'==='end'){
          throwPlay={stage:'rundown',t:1,thrower:holder,receiver:null,kind:'ground',rd:{sub:'${relay ? 'relay' : 'chase'}',holder,recv:fielders[1],dest:[10,10],r:{out:true}}};
          endRundown('x','#fff');
        }else{
          throwPlay={stage:'catch',t:1,thrower:holder,receiver:holder,kind:'ground'};
          concludeOrChaseHome();
        }
        return {calls,stage:throwPlay.stage,target:throwPlay.target,relayTo:throwPlay.relayTo||null,rd:!!throwPlay.rd};
      } finally { concludePlay=keep; }
    })()`, 'continue');
  }
  for (const [from, to] of [[1,2],[2,3],[3,4]]) {
    addCase(r, `endRundown ${from}-${to}塁間`, { path: 'endRundown', p: from + 0.5, goal: to }, { concludeCalls: 0, target: to, stage: 'transfer' }, () => {
      const o = probe('end', from, false); return { observed: o, pass: o.calls === 0 && o.target === to && o.stage === 'transfer' };
    });
  }
  addCase(r, 'endRundown切返し送球中は瞬間帰還させない', { path: 'endRundown', relay: true, p: 2.5, goal: 3 }, { stage: 'fly', relayTo: 3 }, () => {
    const o = probe('end', 2, true); return { observed: o, pass: o.calls === 0 && o.stage === 'fly' && o.relayTo === 3 && o.rd === false };
  });
  for (const [from, to] of [[1,2],[2,3],[3,4]]) {
    addCase(r, `concludeOrChaseHome ${from}-${to}塁間`, { path: 'concludeOrChaseHome', p: from + 0.5, goal: to }, { concludeCalls: 0, target: to, stage: 'transfer' }, () => {
      const o = probe('other', from, false); return { observed: o, pass: o.calls === 0 && o.target === to && o.stage === 'transfer' };
    });
  }
  function settled(which) {
    return run(ctx, `(function(){
      newGame(); const keep=concludePlay; let calls=0; concludePlay=function(){calls++;};
      try{
        S.outs=0; S.preOuts=0; const holder=fielders[0];
        runners=[{origin:2,p:2,goal:2,autoGoal:2,extra:0,sp:22,v:0,out:false}];
        throwPlay={stage:'${which === 'end' ? 'rundown' : 'catch'}',thrower:holder,receiver:holder,kind:'ground',rd:{sub:'chase',holder,r:{out:true}}};
        ${which === 'end' ? "endRundown('x','#fff')" : 'concludeOrChaseHome()'};
        return {calls,stage:throwPlay.stage};
      } finally { concludePlay=keep; }
    })()`, 'settled');
  }
  addCase(r, 'endRundown定着済みなら閉じる', { p: 2, goal: 2 }, { concludeCalls: 1 }, () => {
    const o = settled('end'); return { observed: o, pass: o.calls === 1 };
  });
  addCase(r, 'concludeOrChaseHome定着済みなら閉じる', { p: 2, goal: 2 }, { concludeCalls: 1 }, () => {
    const o = settled('other'); return { observed: o, pass: o.calls === 1 };
  });
  result.repairs.push(r);
}

// 5. Pickoff waits for cover for 2.6s and aborts once the runner has returned.
{
  const r = { label: 'R5_けん制cover待ち2.6+帰塁中止', cases: [] };
  function probe(mode, cover, p, excess) {
    return run(ctx, `(function(){
      newGame(); const keepC=concludePlay, keepA=coverArrival; let calls=0;
      concludePlay=function(){calls++;}; coverArrival=()=>${cover};
      try{
        S.phase='throwing'; S.outs=0; S.preOuts=0; S.playClock=0;
        const f=fielders[0]; f.cx=0; f.cy=60.5; f.run=0; f.fld=70; f.cat=70; f.acc=70;
        runners=[{origin:2,p:${p},goal:2,autoGoal:2,extra:0,sp:22,v:0,dir:-1,out:false,jumped:true}];
        ball={x:200,y:200,z:4.4,vx:0,vy:0,vz:0,bs:0,ss:0,landed:false,t:0,maxZ:4.4};
        const transfer=0.5;
        throwPlay={stage:'transfer',t:transfer+${excess},transfer,thrower:f,kind:'pickoff',target:2,relayed:false,fieldT:0};
        updateThrowPhase(0.0001);
        return {calls,stage:throwPlay&&throwPlay.stage,t:throwPlay&&+throwPlay.t.toFixed(4),ballSpeed:+Math.hypot(ball.vx||0,ball.vy||0,ball.vz||0).toFixed(3)};
      } finally { concludePlay=keepC; coverArrival=keepA; }
    })()`, 'pickoff');
  }
  addCase(r, 'カバー遅延中は2.6秒まで保持', { coverArrival: 99, runnerP: 2.2, elapsedAfterTransfer: 2.599 }, { concludeCalls: 0, stage: 'transfer' }, () => {
    const o = probe('wait', 99, 2.2, 2.599); return { observed: o, pass: o.calls === 0 && o.stage === 'transfer' };
  });
  addCase(r, '2.6秒超でもカバー不在なら中止', { coverArrival: 99, runnerP: 2.2, elapsedAfterTransfer: 2.601 }, { concludeCalls: 1 }, () => {
    const o = probe('deadline', 99, 2.2, 2.601); return { observed: o, pass: o.calls === 1 };
  });
  addCase(r, '待機中に帰塁したら即中止', { coverArrival: 99, runnerP: 2.049, returnTolerance: 0.05 }, { concludeCalls: 1 }, () => {
    const o = probe('returned', 99, 2.049, 0.001); return { observed: o, pass: o.calls === 1 };
  });
  addCase(r, 'カバーが間に合うなら送球開始', { coverArrival: 0, runnerP: 2.2 }, { concludeCalls: 0, stage: 'fly', ballSpeedPositive: true }, () => {
    const o = probe('ready', 0, 2.2, 0.001); return { observed: o, pass: o.calls === 0 && o.stage === 'fly' && o.ballSpeed > 0 };
  });
  result.repairs.push(r);
}

// 6. Reassignment guard and post-reassignment role for the old fielder.
{
  const r = { label: 'R6_担当交代approaching門番+旧担当役割', cases: [] };
  function probe(kind) {
    return run(ctx, `(function(){
      newGame(); const keep=planPlay; let planCalls=0;
      try{
        const old=fielders[0], neu=fielders[1];
        old.n='old'; neu.n='new'; old.cx=20; old.cy=100; old.x=20; old.y=100; old.sp=20; old.v=0; old.coverBase=null; old.primary=true;
        neu.cx=80; neu.cy=100; neu.x=80; neu.y=100; neu.sp=22; neu.v=0; neu.coverBase=null; neu.primary=false;
        const helpers=[];
        const covers='${kind}'==='backup'?[1,2,3,4]:('${kind}'==='cover'?[1,2,3]:[]);
        covers.forEach((b,i)=>helpers.push({n:'h'+b,cx:300+i*10,cy:300,x:300+i*10,y:300,sp:20,v:0,coverBase:b,primary:false,tx:0,ty:0,run:0,stun:0}));
        fielders=[old,neu,...helpers]; runners=[];
        const vx=('${kind}'==='approach')?10:-10;
        ball={x:0,y:100,z:0.5,vx,vy:0,vz:0,bs:0,ss:0,landed:true,t:1,maxZ:1,planT:1,aimT:1,replanT:0,primary:old,canCatchAir:false,fairLocked:true,forcedGo:true,advanced:true,acc:0};
        planPlay=function(){planCalls++; return {f:neu,t:0.4,x:50,y:100,air:false,firstLand:{x:60,y:100,t:1}};};
        const ret=stepFlight(0);
        return {planCalls,returned:!!ret,primary:ball.primary&&ball.primary.n,oldCover:old.coverBase,oldTarget:[old.tx,old.ty],newCover:neu.coverBase};
      } finally { planPlay=keep; }
    })()`, 'assignment');
  }
  addCase(r, '球が旧担当へ接近中は交代しない', { ballX: 0, oldX: 20, vx: 10, dot: 200 }, { planCalls: 0, primary: 'old' }, () => {
    const o = probe('approach'); return { observed: o, pass: o.planCalls === 0 && o.primary === 'old' };
  });
  addCase(r, '球が旧担当から遠ざかれば交代候補を評価', { ballX: 0, oldX: 20, vx: -10, dot: -200 }, { planCalls: 1, primary: 'new' }, () => {
    const o = probe('recede'); return { observed: o, pass: o.planCalls === 1 && o.primary === 'new' };
  });
  addCase(r, '交代後の旧担当は空き本塁カバー', { occupiedCovers: [1,2,3], open: 4 }, { oldCover: 4 }, () => {
    const o = probe('cover'); return { observed: o, pass: o.primary === 'new' && o.oldCover === 4 };
  });
  addCase(r, '全塁埋まりなら旧担当は18ft後方バックアップ', { occupiedCovers: [1,2,3,4], planPoint: [50,100], velocity: [-10,0] }, { oldTarget: [32,100], tolerance: 1e-8 }, () => {
    const o = probe('backup'); return { observed: o, pass: o.primary === 'new' && o.oldCover == null && close(o.oldTarget[0],32) && close(o.oldTarget[1],100) };
  });
  result.repairs.push(r);
}

// 7. The 0.12 selection rule in both planning implementations.
{
  const r = { label: 'R7_余裕点0.12_planPlay+interceptPoint', cases: [] };
  function probe(kind, rate) {
    return run(ctx, `(function(){
      newGame(); const ks=stepBall, kr=runTime, kq=reactOf;
      try{
        globalThis.__p3rate=${rate};
        stepBall=function(b,h){b.x+=globalThis.__p3rate*h; b.z=1; b.vx=80; b.vy=0; b.vz=0;};
        runTime=(sp,d)=>d/sp; reactOf=()=>0;
        const f={n:'probe',x:0,y:0,cx:0,cy:0,sp:20,v:0,zone:0.0095,fld:70,cat:70,coverBase:null,primary:true};
        fielders=[f];
        const src={x:40,y:0,z:1,vx:80,vy:0,vz:0,bs:0,ss:0,landed:true,t:0,maxZ:1};
        if('${kind}'==='plan'){
          const o=planPlay(src,true); return {t:o.t,x:o.x,y:o.y};
        }
        ball=src; const p=interceptPoint(f); return {x:p[0],y:p[1]};
      } finally {stepBall=ks; runTime=kr; reactOf=kq; delete globalThis.__p3rate;}
    })()`, 'margin');
  }
  for (const kind of ['plan','intercept']) {
    for (const [rate, side] of [[-5,'gap>0.12'],[-40,'gap<=0.12']]) {
      const q = controlledOracle(kind === 'plan' ? 'plan' : 'intercept', rate, { margin: 0.28 });
      addCase(r, `${kind} ${side}`, { controlledRate: rate, h0: q.h0, hM: q.hM, gap: q.gap }, { chosen: q.chosen, rule: q.gap > 0.12 ? 'h0' : 'hM' }, () => {
        const o = probe(kind, rate);
        const pass = kind === 'plan' ? close(o.t,q.chosen.t) && close(o.x,q.chosen.x) : close(o.x,q.chosen.x);
        return { observed: o, pass };
      });
    }
  }
  result.repairs.push(r);
}

// 8. Isolate reaction-time re-collection by neutralizing acceleration cost.
{
  const r = { label: 'R8_再照準の反応再徴収', cases: [] };
  function probe(mov) {
    return run(ctx, `(function(){
      newGame(); const ks=stepBall, kr=runTime, kq=reactOf;
      try{
        globalThis.__p3rate=-10;
        stepBall=function(b,h){b.x+=globalThis.__p3rate*h; b.z=1; b.vx=40; b.vy=0; b.vz=0;};
        runTime=(sp,d)=>d/sp; reactOf=()=>0.28;
        const f={n:'probe',x:0,y:0,cx:0,cy:0,sp:20,v:${mov}*20,zone:0.0095,fld:70,cat:70,coverBase:null,primary:true};
        ball={x:30,y:0,z:1,vx:40,vy:0,vz:0,bs:0,ss:0,landed:true,t:0,maxZ:1};
        const p=interceptPoint(f); const t=(p[0]-30)/-10;
        return {mov:${mov},reactPay:+(0.28*0.4*(1-${mov})).toFixed(6),t:+t.toFixed(6),x:+p[0].toFixed(6)};
      } finally {stepBall=ks; runTime=kr; reactOf=kq; delete globalThis.__p3rate;}
    })()`, 'reaction');
  }
  for (const mov of [0,0.5,1]) {
    const react = 0.28 * 0.4 * (1 - mov);
    const q = controlledOracle('intercept', -10, { x0: 30, margin: 0.06, react, mov, runMode: 'linear' });
    addCase(r, `走行率${mov}`, { movementFraction: mov, neutralizedRunAcceleration: true }, { reactPay: react, chosenTime: q.chosen.t }, () => {
      const o = probe(mov); return { observed: o, pass: close(o.reactPay,react,1e-6) && close(o.t,q.chosen.t,1e-6) };
    });
  }
  result.repairs.push(r);
}

// 9. Isolate continuation from current running speed by removing reaction cost.
{
  const r = { label: 'R9_走行中は続きから反応時間支払', cases: [] };
  function probe(mov) {
    return run(ctx, `(function(){
      newGame(); const ks=stepBall, kq=reactOf;
      try{
        globalThis.__p3rate=-10;
        stepBall=function(b,h){b.x+=globalThis.__p3rate*h; b.z=1; b.vx=40; b.vy=0; b.vz=0;};
        reactOf=()=>0;
        const f={n:'probe',x:0,y:0,cx:0,cy:0,sp:20,v:${mov}*20,zone:0.0095,fld:70,cat:70,coverBase:null,primary:true};
        ball={x:40,y:0,z:1,vx:40,vy:0,vz:0,bs:0,ss:0,landed:true,t:0,maxZ:1};
        const p=interceptPoint(f); const t=(p[0]-40)/-10;
        return {mov:${mov},t:+t.toFixed(6),x:+p[0].toFixed(6)};
      } finally {stepBall=ks; reactOf=kq; delete globalThis.__p3rate;}
    })()`, 'continuation');
  }
  for (const mov of [0,0.5,1]) {
    const q = controlledOracle('intercept', -10, { x0: 40, margin: 0.06, react: 0, mov, runMode: 'accelerating' });
    addCase(r, `走行率${mov}`, { movementFraction: mov, reactionNeutralized: true }, { chosenTime: q.chosen.t, physicalFloor: Math.max(0,q.chosen.x-4.5) / 20 }, () => {
      const o = probe(mov); return { observed: o, pass: close(o.t,q.chosen.t,1e-6) && o.t + 1e-9 >= Math.max(0,q.chosen.x-4.5)/20 };
    });
  }
  result.repairs.push(r);
}

// Cross-case monotonic checks for the two split subcomponents.
for (const label of ['R8_再照準の反応再徴収','R9_走行中は続きから反応時間支払']) {
  const r = result.repairs.find(x => x.label === label);
  const ts = r.cases.map(c => c.repetitions[0].observed.t);
  r.monotonicOracle = 'movement fraction 0 -> 0.5 -> 1 must not make target time later';
  r.monotonicObserved = ts;
  r.monotonicPass = ts[0] >= ts[1] && ts[1] >= ts[2] && ts[0] > ts[2];
}

result.caseCount = result.repairs.reduce((n,r)=>n+r.cases.length,0);
result.observationCount = result.caseCount * REPEATS;
result.passCount = result.repairs.reduce((n,r)=>n+r.cases.filter(c=>c.pass).length,0);
result.failCount = result.caseCount - result.passCount;
result.overallPass = result.failCount === 0 && result.repairs.every(r => r.monotonicPass !== false);

return result;


}

if (require.main === module && process.argv.includes('--phase3-repair-adjacency')) {
  const result = runPhase3RepairAdjacencySuite();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.overallPass) process.exitCode = 1;
}


// 所見17・18: 実ブラウザ目視と対応する、凍結ソースの描画構成再検査。
function collectVisualArchitectureEvidence() {
  const html = fs.readFileSync(TARGET_HTML_PATH, 'utf8');
  const lines = html.split(/\r?\n/);
  const line = number => lines[number - 1] || '';
  const buildMatch = html.match(/const BUILD\s*=\s*['"]([^'"]+)['"]/);
  const playerSection = lines.slice(663, 719).join('\n');
  const groundSection = lines.slice(344, 455).join('\n');
  return {
    build: buildMatch ? buildMatch[1] : null,
    sourceSha256: require('crypto').createHash('sha256').update(Buffer.from(html, 'utf8')).digest('hex').toUpperCase(),
    playerRootCause: { line: 664, quote: line(664).trim(), primitiveBoxCalls: (playerSection.match(/\bbox\(/g) || []).length,
      primitiveSphereCalls: (playerSection.match(/\bsphere\(/g) || []).length },
    textureRootCause: { line: 351, quote: line(351).trim(), groundCanvasLine: line(374).trim(),
      generatedNoiseRects: /for\(let i=0;i<52000;i\+\+\)/.test(groundSection),
      onlyGroundTextured: line(351).includes('地面だけに貼る') && line(351).includes('選手・フェンス等は従来の頂点色') },
    browserProtocol: [
      '凍結HTMLをlocalhostで配信する',
      '1920×1080相当の実ブラウザで開き、打席画面を3回リロードする',
      '選手の輪郭、肌・ユニフォーム材質、芝・土、照明、カメラを目視する',
      '「MLB The Show級」「実写と見間違える」の両方を満たさない形状・材質が1画面でもあればFAIL',
    ],
  };
}

function reproFinding17TheShowVisualGap() {
  const evidence = collectVisualArchitectureEvidence();
  return { finding: 17, ownerIssue: 'OI-133', expected: 'MLB The Show級の総合画面品質',
    executableEvidence: evidence, machineVerdict: evidence.playerRootCause.primitiveBoxCalls > 0 ? 'PRIMITIVE_PLAYER_CONFIRMED' : 'UNVERIFIED',
    visualVerdictRequiresBrowser: true };
}

function reproFinding18PhotorealTextureGap() {
  const evidence = collectVisualArchitectureEvidence();
  return { finding: 18, ownerIssue: 'OI-217', expected: '実写と見間違えるテクスチャ',
    executableEvidence: evidence, machineVerdict: evidence.textureRootCause.onlyGroundTextured ? 'PLAYER_TEXTURE_ABSENT_CONFIRMED' : 'UNVERIFIED',
    visualVerdictRequiresBrowser: true };
}

if (require.main === module && process.argv.includes('--finding17')) {
  process.stdout.write(`${JSON.stringify(reproFinding17TheShowVisualGap(), null, 2)}\n`);
}
if (require.main === module && process.argv.includes('--finding18')) {
  process.stdout.write(`${JSON.stringify(reproFinding18PhotorealTextureGap(), null, 2)}\n`);
}
if (require.main === module && process.argv.includes('--phase3-visual-architecture')) {
  process.stdout.write(`${JSON.stringify({finding17:reproFinding17TheShowVisualGap(),finding18:reproFinding18PhotorealTextureGap()}, null, 2)}\n`);
}

// Phase 3 unresolved/retreated set B. Append this segment to
// review_sol_ultra_repro_20260805.js; it deliberately reuses the file's
// existing fs/vm imports, bootGameInVm(), and TARGET_HTML_PATH.
function runPhase3UnresolvedB(repeatCount = 3) {
  const phase3bCrypto = require('crypto');
  const phase3bHtml = fs.readFileSync(TARGET_HTML_PATH, 'utf8');
  const phase3bExpectedSha = '2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183';
  const phase3bShaBefore = phase3bCrypto.createHash('sha256').update(Buffer.from(phase3bHtml, 'utf8')).digest('hex').toUpperCase();
  const phase3bContext = bootGameInVm(phase3bHtml, 'phase3-unresolved-b');

  function phase3bEval(source, label) {
    return vm.runInContext(source, phase3bContext, {
      timeout: 30000,
      filename: `phase3-unresolved-b-${label}.js`,
    });
  }

  function phase3bRepeat(probe) {
    const rows = [];
    for (let rep = 1; rep <= repeatCount; rep += 1) rows.push(probe(rep));
    return rows;
  }

  function phase3bIssue(id, symptom, oracle, repetitions, verdict, limits) {
    return { id, symptom, oracle, repetitions, verdict, limits };
  }

  function phase3bOi141() {
    return phase3bEval(String.raw`
      (()=>{ const savedRandom=Math.random, savedPlan=planPlay; Math.random=()=>0.5;
        try{
          function one(name,offset){
            newGame(); S.outs=0; S.bases=[null,{id:1,sp:22},null];
            const f=fielders.find(x=>x.n===name);
            planPlay=()=>({f,t:0.8,x:f.x+offset,y:f.y,air:false,firstLand:{x:f.x+offset,y:f.y,t:0.8}});
            startFlight({exit:75,la:-5,spray:name==='二'?12:-12,q:0.7},1,[0,2.5,1.4]);
            const r=runners.find(x=>x.origin===2);
            return {fielder:name,offset,hard:offset>20,p:+r.p.toFixed(3),goal:+r.goal.toFixed(3),v:+(r.v||0).toFixed(3)};
          }
          return [one('遊',5),one('二',5),one('遊',25)];
        } finally { planPlay=savedPlan; Math.random=savedRandom; }
      })()
    `, 'OI141');
  }

  function phase3bOi144() {
    return phase3bEval(String.raw`
      (()=>{ const savedRandom=Math.random, savedConclude=concludePlay; Math.random=()=>0.5;
        try{
          function one(clock){
            let calls=0; concludePlay=function(){calls++;};
            newGame(); S.phase='throwing'; S.outs=0; S.preOuts=0; S.playClock=clock;
            const f=fielders[0]; f.cx=200; f.cy=200; f.sp=20; f.v=0;
            runners=[{origin:1,p:1.5,goal:2,autoGoal:2,extra:0,sp:22,v:0,out:false}];
            ball={x:200,y:200,z:0,vx:0,vy:0,vz:0,bs:0,ss:0,landed:true,t:0,maxZ:0};
            throwPlay={stage:'transfer',t:0,transfer:99,thrower:f,kind:'ground',target:1,relayed:false};
            updateThrowPhase(0.001);
            return {start:clock,end:+S.playClock.toFixed(3),concludeCalls:calls,p:+runners[0].p.toFixed(3)};
          }
          return [one(12.001),one(19.998),one(20.001)];
        } finally { concludePlay=savedConclude; Math.random=savedRandom; }
      })()
    `, 'OI144');
  }

  function phase3bOi169() {
    return phase3bEval(String.raw`
      (()=>{ const savedRandom=Math.random, savedDifficulty=DIFF_I; Math.random=()=>0.5;
        try{
          const rows=[];
          for(let i=0;i<3;i++){
            newGame(); DIFF_I=i; S.half=0; launchPitch(0,0,0);
            rows.push({index:i,name:DIFF[i].name,pitchDuration:+pitch.dur.toFixed(4),batAim:DIFF[i].aw,
              cpuSkill:DIFF[i].cpu,fielderSpeeds:fielders.map(f=>+f.sp.toFixed(3))});
          }
          return {controlNames:['DIFF_I'],rows};
        } finally { DIFF_I=savedDifficulty; Math.random=savedRandom; }
      })()
    `, 'OI169');
  }

  function phase3bOi171() {
    return phase3bEval(String.raw`
      (()=>{ const savedRandom=Math.random, savedConclude=concludePlay; Math.random=()=>0.5; let calls=0;
        concludePlay=function(){calls++;};
        try{
          newGame(); S.phase='throwing'; S.outs=0; S.preOuts=0; S.playClock=0;
          runners=[{origin:1,p:1.15,goal:1,autoGoal:1,extra:0,sp:22,v:0,out:false}];
          const th=fielders[0], rc=fielders[1]; th.cx=0; th.cy=60; rc.cx=0; rc.cy=80;
          ball={x:400,y:0,z:2,vx:20,vy:0,vz:0,bs:0,ss:0,landed:true,t:1,maxZ:2};
          throwPlay={stage:'fly',t:0.5,thrower:th,receiver:rc,kind:'ground',target:1,dest:[400,0],chased:false,relayed:false};
          const before={distance:+Math.hypot(ball.x,ball.y).toFixed(3),fenceAtLine:+fenceDist(45).toFixed(3),runnerGoal:runners[0].goal};
          updateThrowPhase(0.01);
          return {before,after:{distance:+Math.hypot(ball.x,ball.y).toFixed(3),concludeCalls:calls,
            runnerGoal:runners[0].goal,stage:throwPlay&&throwPlay.stage,chased:!!(throwPlay&&throwPlay.chased)}};
        } finally { concludePlay=savedConclude; Math.random=savedRandom; }
      })()
    `, 'OI171');
  }

  function phase3bOi186() {
    return phase3bEval(String.raw`
      (()=>{ const savedRandom=Math.random, savedPlan=planPlay, savedFinish=finishPlay; Math.random=()=>0.5; let finishes=0;
        try{
          newGame(); S.phase='flight'; S.msg=''; S.errorBy=null;
          const f=fielders[0]; f.name='probe'; f.cx=20; f.cy=80; f.fld=70; f.cat=70; f.sp=20; f.v=5; f.coverBase=null;
          runners=[{origin:1,p:1.5,goal:2,autoGoal:2,extra:0,sp:22,v:12,out:false}];
          ball={x:20,y:80,z:1,vx:25,vy:10,vz:0,bs:0,ss:0,landed:true,t:1,maxZ:2,primary:f,canCatchAir:false};
          planPlay=()=>({f,t:0.5,x:40,y:90,air:false,firstLand:{x:50,y:95,t:1}});
          finishPlay=function(){finishes++;};
          const before={p:runners[0].p,goal:runners[0].goal,phase:S.phase,msg:S.msg};
          deflectBall(f,0.2,true);
          return {before,after:{p:runners[0].p,goal:runners[0].goal,phase:S.phase,msg:S.msg,errorBy:S.errorBy},
            finishes,ballSpeed:+Math.hypot(ball.vx,ball.vy,ball.vz).toFixed(3)};
        } finally { planPlay=savedPlan; finishPlay=savedFinish; Math.random=savedRandom; }
      })()
    `, 'OI186');
  }

  function phase3bOi213() {
    return phase3bEval(String.raw`
      (()=>{ const savedRandom=Math.random, savedAfter=afterPlay; Math.random=()=>0.5; let closes=0, liveAtClose=null;
        try{
          newGame(); S.outs=0; S.preOuts=0; S.errorBy=null; runners=[];
          ball={x:0,y:80,z:20,vx:20,vy:0,vz:50,bs:0,ss:0,landed:false,t:0,maxZ:20};
          afterPlay=function(){closes++; liveAtClose={z:+ball.z.toFixed(3),speed:+Math.hypot(ball.vx,ball.vy,ball.vz).toFixed(3),t:+ball.t.toFixed(3)};};
          finishPlay({out:0,runs:0,bases:[null,null,null],hit:true,moves:[],throwTo:null,text:'ヒット',color:'#fff'});
          const initialTimer=2.2, x0=ball.x; let frames=0;
          while(!closes&&frames++<300) update(1/60);
          return {initialTimer,frames,closes,liveAtClose,traveled:+(ball.x-x0).toFixed(3),phase:S.phase};
        } finally { afterPlay=savedAfter; Math.random=savedRandom; }
      })()
    `, 'OI213');
  }

  function phase3bOi230() {
    return phase3bEval(String.raw`
      (()=>{ const savedRandom=Math.random, savedConclude=concludePlay; Math.random=()=>0.5; let closes=0, snap=null;
        concludePlay=function(){closes++; snap={x:ball.x,y:ball.y,z:ball.z,speed:Math.hypot(ball.vx,ball.vy,ball.vz)};};
        try{
          newGame(); S.phase='throwing'; S.outs=0; S.preOuts=0; S.playClock=0; runners=[];
          const th=fielders[0], rc=fielders[1]; th.cx=0; th.cy=60; rc.cx=0; rc.cy=80;
          ball={x:250,y:200,z:0.2,vx:15,vy:4,vz:0,bs:0,ss:0,landed:true,t:8,maxZ:3};
          throwPlay={stage:'fly',t:7.999,thrower:th,receiver:rc,kind:'ground',target:1,dest:[250,200],chased:true,relayed:false};
          updateThrowPhase(0.01);
          return {closes,snap:snap&&{x:+snap.x.toFixed(3),y:+snap.y.toFixed(3),z:+snap.z.toFixed(3),speed:+snap.speed.toFixed(3)},
            stage:throwPlay&&throwPlay.stage,t:throwPlay&&+throwPlay.t.toFixed(3)};
        } finally { concludePlay=savedConclude; Math.random=savedRandom; }
      })()
    `, 'OI230');
  }

  function phase3bOi237() {
    return phase3bEval(String.raw`
      (()=>{ const savedRandom=Math.random, savedDifficulty=DIFF_I; Math.random=()=>0.5;
        try{
          DIFF_I=1;
          const candidates=[];
          for(const spray of [18,24,30,36]) for(const la of [2,6,10,14]) for(const exit of [88,96,104]) candidates.push({exit,la,spray,q:0.8});
          for(const hit of candidates){
            newGame(); S.outs=0; S.bases=[null,null,null]; startFlight(hit,1,[0,2.5,1.4]);
            if(!ball.primary||ball.primary.n!=='右') continue;
            const right=fielders.find(f=>f.n==='右'); let moved=false, frames=0, maxV=0; const stops=[], changes=[]; let previous=ball.primary.n;
            while(S.phase==='flight'&&frames++<480){
              updateFlight(1/60); if(!ball) break;
              const current=ball.primary&&ball.primary.n;
              if(current!==previous){changes.push({frame:frames,from:previous,to:current}); previous=current;}
              maxV=Math.max(maxV,right.v||0); if((right.v||0)>0.5) moved=true;
              const distance=Math.hypot((right.tx||0)-right.cx,(right.ty||0)-right.cy);
              if(moved&&right.primary&&distance>1&&(right.v||0)<0.05&&ball.t>F_REACT+0.05) stops.push({frame:frames,t:+ball.t.toFixed(3),distance:+distance.toFixed(3)});
            }
            return {hit,frames,initialPrimary:'右',finalPrimary:ball&&ball.primary&&ball.primary.n,
              maxV:+maxV.toFixed(3),stops,changes,phase:S.phase};
          }
          return {error:'no right-field candidate'};
        } finally { DIFF_I=savedDifficulty; Math.random=savedRandom; }
      })()
    `, 'OI237');
  }

  // The shared boot is intentionally used for all gameplay probes. This local
  // instrumented boot only counts drawing calls needed by OI-133/OI-217; it
  // remains inside this function so it cannot collide with existing helpers.
  function phase3bVisualBoot(rep) {
    const stats={textureUploads:[],ops:{fillRect:0,ellipse:0,beginPath:0}};
    const gradient={addColorStop(){}};
    const ctx2d=new Proxy({}, {get(_t,p){
      if(p==='measureText') return s=>({width:String(s).length*8});
      if(p==='createLinearGradient'||p==='createRadialGradient') return ()=>gradient;
      if(p==='createPattern') return ()=>({});
      return (..._args)=>{if(Object.prototype.hasOwnProperty.call(stats.ops,p)) stats.ops[p]+=1;};
    },set(){return true;}});
    const gl=new Proxy({}, {get(_t,p){
      if(typeof p==='string'&&/^[A-Z0-9_]+$/.test(p)) return 1;
      if(p==='getShaderParameter'||p==='getProgramParameter') return ()=>true;
      if(p==='getShaderInfoLog'||p==='getProgramInfoLog') return ()=>'';
      if(p==='getAttribLocation') return ()=>0;
      if(p==='getUniformLocation') return ()=>({});
      if(p==='getExtension') return name=>name==='EXT_texture_filter_anisotropic'?{TEXTURE_MAX_ANISOTROPY_EXT:1,MAX_TEXTURE_MAX_ANISOTROPY_EXT:2}:{};
      if(p==='getParameter') return ()=>8;
      if(p==='texImage2D') return (...args)=>{const cv=args[args.length-1];stats.textureUploads.push({width:cv&&cv.width,height:cv&&cv.height});};
      if(typeof p==='string'&&p.startsWith('create')) return ()=>({});
      return ()=>{};
    },set(){return true;}});
    const nodes=new Map();
    function visualElement(id){
      const element={id,width:1000,height:620,clientWidth:1000,clientHeight:620,innerHTML:'',textContent:'',style:{},dataset:{},onclick:null,children:[],
        classList:{add(){},remove(){},toggle(){},contains(){return false;}},addEventListener(){},removeEventListener(){},remove(){},click(){},
        appendChild(x){this.children.push(x);},querySelectorAll(){return[];},querySelector(){return null;},
        getBoundingClientRect(){return{left:0,top:0,width:1000,height:620};},getContext(kind){return kind==='webgl'?gl:ctx2d;}};
      return new Proxy(element,{get(t,p){return p in t?t[p]:null;},set(t,p,v){t[p]=v;return true;}});
    }
    const document={title:'BASEBALL 3D',body:null,createElement(tag){return visualElement(tag);},
      getElementById(id){if(!nodes.has(id))nodes.set(id,visualElement(id));return nodes.get(id);},
      querySelector(){return null;},querySelectorAll(){return[];},addEventListener(){}};
    document.body=visualElement('body');
    const context={console:{log(){},warn(){},error(){}},document,performance:{now:()=>0},requestAnimationFrame(){return 1;},cancelAnimationFrame(){},
      setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},addEventListener(){},removeEventListener(){},Blob:function Blob(){},
      URL:{createObjectURL(){return'blob:stub';},revokeObjectURL(){}},navigator:{userAgent:'node-vm'},location:{},devicePixelRatio:1};
    context.window=context; context.self=context; context.globalThis=context; vm.createContext(context);
    const scripts=[...phase3bHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match=>match[1]);
    for(const script of scripts) vm.runInContext(script,context,{timeout:30000,filename:`phase3-unresolved-b-visual-${rep}.js`});
    return {textureUploads:stats.textureUploads,fillRect:stats.ops.fillRect,ellipse:stats.ops.ellipse,
      beginPath:stats.ops.beginPath,build:vm.runInContext('BUILD',context)};
  }

  const issues=[];
  const oi141=phase3bRepeat(()=>phase3bOi141());
  issues.push(phase3bIssue('OI-141','三・遊の正面ゴロでは二塁走者を自動発進させず、二・一方向または難しい打球では発進させる',
    {easyShortGoalLt3:true,easySecondGoal:3,hardShortGoal:3},oi141,
    oi141.every(row=>row[0].goal<3&&row[1].goal===3&&row[2].goal===3)?'PASS':'FAIL',
    'planPlayを固定して走塁判断だけを隔離。実ゲームの打球分布頻度は未評価。'));

  const oi144=phase3bRepeat(()=>phase3bOi144());
  issues.push(phase3bIssue('OI-144','ランナーが塁間にいる間は絶対にプレーを打ち切らない',
    {allConcludeCalls:0},oi144,oi144.every(row=>row.every(x=>x.concludeCalls===0))?'PASS':'FAIL',
    '20秒の強制終了境界を直接測定。所見1と同じ終了門番の問題なので新規所見には数えない。'));

  const oi169=phase3bRepeat(()=>phase3bOi169());
  issues.push(phase3bIssue('OI-169','難易度を打撃・投球・守備の3つで個別選択できる',
    {independentControls:3},oi169,oi169.every(x=>x.controlNames.length>=3)?'PASS':'FAIL',
    '単一DIFF_Iが投球時間・打撃許容・CPU能力を同時変更し、守備用の独立選択は無い。'));

  const oi171=phase3bRepeat(()=>phase3bOi171());
  issues.push(phase3bIssue('OI-171','送球がベンチ・観客席へ入ったら投球時から2個の進塁権を与えてプレー終了',
    {outsideBoundary:true,concludeCalls:1,runnerGoal:3},oi171,
    oi171.every(x=>x.after.concludeCalls===1&&x.after.runnerGoal===3)?'PASS':'FAIL',
    '場外送球の境界処理が無い経路を実行。通常の打球フェンス越えとは別規則。'));

  const oi186=phase3bRepeat(()=>phase3bOi186());
  issues.push(phase3bIssue('OI-186','走者が動いているエラー発生瞬間に表示・プレー終了しない',
    {finishCalls:0,phase:'flight',runnerP:1.5,runnerGoal:2,messageEmpty:true},oi186,
    oi186.every(x=>x.finishes===0&&x.after.phase==='flight'&&x.after.p===1.5&&x.after.goal===2&&!x.after.msg)?'PASS_BOUNDED':'FAIL',
    'deflectBall直後を隔離。あらゆるランダムなエラー打球の終端までは網羅していない。'));

  const oi213=phase3bRepeat(()=>phase3bOi213());
  issues.push(phase3bIssue('OI-213','送球が空中にある間はプレーを打ち切らない',
    {closeWhileLive:0},oi213,
    oi213.every(x=>x.closes===0||!x.liveAtClose||x.liveAtClose.speed<=3||x.liveAtClose.z<=0.8)?'PASS':'FAIL',
    '到達可能なresult状態を直接注入した関数契約反例。通常プレー開始から同状態へ至る自然経路の頻度は未測定。'));

  const oi230=phase3bRepeat(()=>phase3bOi230());
  issues.push(phase3bIssue('OI-230','悪送球が外野を転がり続けている間はプレーを打ち切らない',
    {closeWhileBallSpeedPositive:0},oi230,oi230.every(x=>x.closes===0)?'PASS':'FAIL',
    'chased送球のT.t>8経路を直接実行。'));

  const oi237=phase3bRepeat(()=>phase3bOi237());
  issues.push(phase3bIssue('OI-237','右翼手が打球追跡中に不自然に一瞬停止しない',
    {rightFielderFound:true,maxVPositive:true,uncommandedStops:0},oi237,
    oi237.every(x=>!x.error&&x.maxV>0.5&&x.stops.length===0)?'PASS_BOUNDED':'FAIL',
    'OWNER masterに該当録画が無いため、同一プレーの再現ではなく実軌道候補の反例探索。'));

  const visualBoots=phase3bRepeat(rep=>phase3bVisualBoot(rep));
  issues.push(phase3bIssue('OI-217','テクスチャを大幅強化し、リアルと見間違える品質にする',
    {mechanical:'2048x2048 texture upload and >=52000 procedural marks',visual:'three rendered scene comparisons required'},
    visualBoots,'VISUAL_REQUIRED','Node VMは画素を描かないため写実性を判定不能。生成経路だけ3回計測。'));
  issues.push(phase3bIssue('OI-133','パワプロ風ではなくMLB The Showのような全体品質にする',
    {mechanicalBuild:true,visual:'batting, pitching, fielding side-by-side reference review required'},
    visualBoots,'VISUAL_REQUIRED','外観・動き・照明・カメラの総合品質は無描画VMから合否を導けない。'));

  const shaAfter=phase3bCrypto.createHash('sha256').update(Buffer.from(fs.readFileSync(TARGET_HTML_PATH,'utf8'),'utf8')).digest('hex').toUpperCase();
  const summary=issues.reduce((counts,item)=>{counts[item.verdict]=(counts[item.verdict]||0)+1;return counts;},{});
  return {
    target:TARGET_HTML_PATH,
    build:phase3bEval('BUILD','build'),
    shaBefore:phase3bShaBefore,
    shaAfter,
    hashUnchanged:shaAfter===phase3bExpectedSha,
    renderer:'Node vm; WebGL/2D calls stubbed and counted for visual mechanics; no pixels rendered',
    repeatsPerId:repeatCount,
    issues,
    summary,
    suiteValid:issues.length===10&&shaAfter===phase3bExpectedSha,
    visualProtocols:{
      'OI-217':['1920x1080で打席・内野・外野の3場面を同一条件で各1回撮影する',
        '芝・土・走路・フェンスを近景・中景・遠景で拡大し、反復模様・平板さ・材質差を採点する',
        '実写またはMLB The Show参照画像と横並びにし、第三者3名が実写と誤認するかを盲検回答する'],
      'OI-133':['打撃1プレー、投球1プレー、外野追跡1プレーを同じ端末・60fpsで録画する',
        'MLB The Showの同構図と横並びにし、人体・ボール物理・照明・材質・カメラを各5点で採点する',
        '3反復すべてで事前合意した最低点を満たした場合だけ合格とする'],
    },
  };
}

if (require.main === module && process.argv.includes('--phase3-unresolved-b')) {
  const result = runPhase3UnresolvedB();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.suiteValid) process.exitCode = 1;
}
// ===== 工程3・固定無作為抽出の未実行17件（追記用segment） =====
// 前提: fs / path / vm / bootGameInVm / TARGET_HTML_PATH は既存ファイルで定義済み。
// top-level importは追加せず、全追加名を phase3Random17* に限定する。

function phase3Random17InstrumentHtml(html) {
  const instrumentation = `<script>
    window.__phase3Random17Listeners = Object.create(null);
    window.addEventListener = function(type, fn) {
      (window.__phase3Random17Listeners[type] ||= []).push(fn);
    };
    window.__phase3Random17Dispatch = function(type, event) {
      for (const fn of window.__phase3Random17Listeners[type] || []) fn(event);
    };
    window.__phase3Random17Artifacts = { downloads: [], blobs: [], lastBlob: null };
    window.Blob = function(parts, options) {
      this.parts = parts;
      this.type = options && options.type;
      window.__phase3Random17Artifacts.blobs.push(this);
    };
    window.URL = {
      createObjectURL(blob) {
        window.__phase3Random17Artifacts.lastBlob = blob;
        return 'blob:phase3-random17-' + window.__phase3Random17Artifacts.blobs.length;
      },
      revokeObjectURL() {}
    };
    const phase3Random17CreateElement = document.createElement.bind(document);
    document.createElement = function(tag) {
      const el = phase3Random17CreateElement(tag);
      if (String(tag).toLowerCase() === 'a') {
        el.click = function() {
          window.__phase3Random17Artifacts.downloads.push({
            download: this.download,
            href: this.href,
            blob: window.__phase3Random17Artifacts.lastBlob
          });
        };
      }
      return el;
    };
  </script>`;
  return instrumentation + html;
}

function phase3Random17Probe(context, id, source) {
  return vm.runInContext(source, context, {
    filename: `phase3-random17-${id}.js`,
    timeout: 30000,
  });
}

function phase3Random17MakeResult(id, ownerLine, ownerText, oracle, trials, options = {}) {
  const passCount = trials.filter(trial => trial.pass === true).length;
  const failCount = trials.filter(trial => trial.pass === false).length;
  const mechanicalVerdict = failCount
    ? 'FAIL'
    : (passCount === trials.length ? 'PASS' : '再現不能');
  const verdict = options.forceUnverified ? '再現不能' : mechanicalVerdict;
  return {
    id,
    ownerLine,
    ownerText,
    oracle,
    repetitions: trials.length,
    passCount,
    failCount,
    verdict,
    status: options.forceUnverified
      ? options.status
      : (mechanicalVerdict === 'FAIL'
        ? 'OWNER問題を実行再現'
        : (mechanicalVerdict === 'PASS' ? '今回の実行ではOWNER問題を再現せず' : '判定不能')),
    mechanicalVerdict: options.forceUnverified ? mechanicalVerdict : undefined,
    limitation: options.limitation || null,
    trials,
  };
}

function runPhase3Random17() {
  const crypto = require('crypto');
  const targetBytesBefore = fs.readFileSync(TARGET_HTML_PATH);
  const html = targetBytesBefore.toString('utf8');
  const hashBefore = crypto.createHash('sha256').update(targetBytesBefore).digest('hex').toUpperCase();
  const context = bootGameInVm(phase3Random17InstrumentHtml(html), 'phase3-random17-b0805-06');
  const findings = [];
  const add = (id, ownerLine, ownerText, oracle, trials, options) => {
    findings.push(phase3Random17MakeResult(id, ownerLine, ownerText, oracle, trials, options));
  };

  const oi032 = phase3Random17Probe(context, 'OI-032', String.raw`(() => {
    const out=[];
    for(let rep=1;rep<=3;rep++){
      newGame(); S.half=0; S.phase='throwing'; S.over=false;
      for(const k in held) held[k]=false;
      const r={p:1.2,goal:1,autoGoal:1,extra:0,origin:1,sp:25,v:0,cmd:null}; runners=[r];
      held.s=true; applyRunnerKeys(); const advance={goal:r.goal,cmd:r.cmd};
      held.s=false; held.x=true; applyRunnerKeys(); const retreat={goal:r.goal,cmd:r.cmd}; held.x=false;
      out.push({rep,state:'走者p=1.2、通常throwing、tagPhase外',observed:{advance,retreat},
        pass:advance.goal===2&&advance.cmd==='S'&&retreat.goal===1&&retreat.cmd==='X'});
    }
    return out;
  })()`);
  add('OI-032',189,'打球が飛んでいる間に Shift（またはボタン）で、走者が塁打数より1つ多く狙います：どういうことですか？進塁と帰塁キーの二つを用意したらいいだけでは？',
    'Sで次塁、Xで帰塁という2操作が働く。',oi032);

  const oi155 = phase3Random17Probe(context, 'OI-155', String.raw`(() => {
    const out=[]; const saved=Math.random; Math.random=()=>0.5;
    try{
      for(let rep=1;rep<=3;rep++){
        newGame(); S.half=0; S.phase='throwing'; S.playClock=0; runners=[];
        const thr=fielders.find(f=>f.n==='三'), recv=fielders.find(f=>f.n==='一');
        const dest=throwPoint(1); recv.cx=dest[0];recv.cy=dest[1];recv.tx=dest[0];recv.ty=dest[1];recv.v=0;
        ball={x:dest[0],y:dest[1],z:12+rep,t:0,vx:0,vy:0,vz:0,landed:false,maxZ:13+rep};
        throwPlay={stage:'fly',t:0,acc:0,thrower:thr,receiver:recv,target:1,dest,kind:'infield',award:1,relayed:true,fieldT:1};
        updateThrowPhase(1/240);
        const observed={stage:throwPlay.stage,sailed:!!throwPlay.sailed,height:+ball.z.toFixed(3)};
        out.push({rep,state:{heightBefore:12+rep,horizontalDistance:0},observed,
          pass:observed.stage==='fly'&&observed.sailed===true&&observed.height>9.5});
      }
    }finally{Math.random=saved;}
    return out;
  })()`);
  add('OI-155',814,'サードの送球がファーストの頭より明らかに高いのにファーストに吸い込まれました',
    '受け手と水平距離0でも高さ9.5ft超なら捕球せず、悪送球として通過させる。',oi155);

  const oi033 = phase3Random17Probe(context, 'OI-033', String.raw`(() => {
    const out=[]; const cases=[['s',2],['z',3],['x',4],['c',1]];
    for(let rep=1;rep<=3;rep++){
      newGame(); S.half=1; S.phase='flight'; S.over=false; manualThrow=null;
      const observed=[];
      for(const [key,want] of cases){
        __phase3Random17Dispatch('keydown',{key,code:'Key'+key.toUpperCase(),repeat:false,preventDefault(){}});
        observed.push({key,want,got:manualThrow});
        __phase3Random17Dispatch('keyup',{key});
      }
      out.push({rep,state:'守備中flightで実キーイベントを送信',observed,
        pass:observed.every(x=>x.got===x.want)});
    }
    return out;
  })()`);
  add('OI-033',194,'やっぱり矢印キーじゃなくてs,z,x,cキーがいいです',
    '守備中の実キーイベントがS=二塁、Z=三塁、X=本塁、C=一塁へ対応する。',oi033);

  const oi139 = phase3Random17Probe(context, 'OI-139', String.raw`(() => {
    const out=[];
    for(let rep=1;rep<=3;rep++){
      __phase3Random17Artifacts.downloads.length=0;
      __phase3Random17Artifacts.blobs.length=0;
      __phase3Random17Artifacts.lastBlob=null;
      REC.plays.length=0; REC.cur=null; newGame();
      recStart('play-1'); S.phase='flight'; recTick(0.11); recMsg('m1'); recEnd();
      recStart('play-2'); S.phase='throwing'; recTick(0.11); recMsg('m2'); recEnd();
      __phase3Random17Dispatch('keydown',{key:'f',code:'KeyF',repeat:false,preventDefault(){}});
      __phase3Random17Dispatch('keyup',{key:'f'});
      __phase3Random17Dispatch('keydown',{key:'g',code:'KeyG',repeat:false,preventDefault(){}});
      __phase3Random17Dispatch('keyup',{key:'g'});
      const docs=__phase3Random17Artifacts.downloads.map(d=>JSON.parse(d.blob.parts.join('')));
      const observed={
        downloads:__phase3Random17Artifacts.downloads.map(d=>d.download),
        playCounts:docs.map(d=>d['プレー数']),
        builds:docs.map(d=>d['版']),
        frames:REC.plays.map(p=>p.f.length)
      };
      out.push({rep,state:'2プレーを各0.1秒記録後にFとG',observed,
        pass:docs.length===2&&docs[0]['プレー数']===1&&docs[1]['プレー数']===2
          &&docs.every(d=>d['版'].includes(BUILD))&&REC.plays.every(p=>p.f.length>=1)});
    }
    return out;
  })()`);
  add('OI-139',734,'プレイを録画してあなたが改善するときにいちいち説明しなくても改善できるようにすることはできますか？',
    '0.1秒状態記録を保持し、Fで直前1プレー、Gで全プレーをbuild付きJSONとして保存する。',oi139,{
      forceUnverified:true,
      status:'記録・保存機構は3/3成功。ただし追加説明なしで未知の不具合を改善できるかは受け渡し後の診断工程を含むため未検証。',
      limitation:'Node VMは記録ファイルの生成までを検証し、その後の人間側の受け渡し・診断・改善完了までは検証しない。'
    });

  const curveTrials = id => phase3Random17Probe(context, id, String.raw`(() => {
    const out=[]; const types=[1,2,3];
    for(let rep=1;rep<=3;rep++){
      const type=types[rep-1], P=PITCHES[type];
      pitch={P,rx:0.95,ry:5.75,rz:54,tx:0,ty:2.5};
      const p=pitchPos(0.5), straight=[0.475,4.125,27];
      const deviation={x:+(p[0]-straight[0]).toFixed(4),y:+(p[1]-straight[1]).toFixed(4)};
      const magnitude=+Math.hypot(deviation.x,deviation.y).toFixed(4);
      out.push({rep,type:P.name,state:'軌道中点を直線中点と比較',observed:{deviation,magnitude},pass:magnitude>0.2});
    }
    return out;
  })()`);
  const oi006=curveTrials('OI-006');
  add('OI-006',59,'変化球がちゃんと変化していない',
    'カーブ・フォーク・シュートの軌道中点が直線軌道から0.2ft超変位する。',oi006);
  const oi011=curveTrials('OI-011');
  add('OI-011',84,'変化球が変化していなかったり',
    '再指摘に対しても3球種すべてで非直線軌道が実行される。',oi011);

  const oi007 = phase3Random17Probe(context, 'OI-007', String.raw`(() => {
    const out=[];
    for(let rep=1;rep<=3;rep++){
      newGame();
      const get=n=>fielders.find(f=>f.n===n), d=(f,b)=>Math.hypot(f.x-BASEPOS[b].x,f.y-BASEPOS[b].z);
      const one=get('一'),three=get('三'),two=get('二'),short=get('遊'),right=get('右'),left=get('左');
      const observed={oneX:one.x,threeX:three.x,twoX:two.x,shortX:short.x,rightX:right.x,leftX:left.x,
        oneTo1:+d(one,1).toFixed(2),oneTo3:+d(one,3).toFixed(2),
        threeTo3:+d(three,3).toFixed(2),threeTo1:+d(three,1).toFixed(2),mirrorX:MIRROR[0]};
      out.push({rep,state:'newGame直後の守備定位置と塁距離',observed,
        pass:one.x>0&&three.x<0&&two.x>0&&short.x<0&&right.x>0&&left.x<0
          &&d(one,1)<d(one,3)&&d(three,3)<d(three,1)&&MIRROR[0]===-1});
    }
    return out;
  })()`);
  add('OI-007',64,'ファーストとサード、セカンドとショート、ライトとレフトが逆になっています',
    '一・二・右=+X、三・遊・左=-Xで、一三塁手が対応する塁に近い。',oi007,{
      limitation:'無描画VMのため最終ピクセルは未確認。座標割当と左右補正行列を検証。'
    });

  const oi016 = phase3Random17Probe(context, 'OI-016', String.raw`(() => {
    const out=[]; const saved=Math.random; Math.random=()=>0.5;
    try{
      for(let rep=1;rep<=3;rep++){
        newGame(); S.half=0; S.phase='flight'; S.outs=0; S.preOuts=0; runners=[];
        const prim=fielders.find(f=>f.n==='中');
        fielders.forEach(f=>{f.primary=f===prim;f.tx=f.cx;f.ty=f.cy;f.v=0;f.stun=0;f.fumbled=false;});
        prim.cx=0;prim.cy=350;prim.tx=0;prim.ty=350;
        ball={x:0,y:399.9,z:2,t:1,vx:0,vy:100,vz:0,maxZ:4,landed:true,canCatchAir:false,primary:prim,
          planT:999,aimT:999,replanT:999,acc:0,exit:80,la:0,spray:0};
        const stepResult=stepFlight(PHYS_H);
        const observed={wallHit:!!ball.wallHit,vy:+ball.vy.toFixed(3),phase:S.phase,stepResult};
        out.push({rep,state:{landedBeforeWall:true,height:2,outwardVy:100},observed,
          pass:observed.wallHit===true&&observed.vy<0&&observed.phase==='flight'&&stepResult===false});
      }
    }finally{Math.random=saved;}
    return out;
  })()`);
  add('OI-016',109,'ワンバウンドしてフェンスに直撃したらエンタイトルツーベースになる問題が直っていません',
    '着地済み・高さ9.4ft未満の壁直撃は二塁打確定せず、反射してflightを続ける。',oi016);

  const oi069 = phase3Random17Probe(context, 'OI-069', String.raw`(() => {
    const out=[];
    for(let rep=1;rep<=3;rep++){
      newGame(); S.half=0; S.phase='throwing'; for(const k in held)held[k]=false;
      const trailing={p:3,goal:3,autoGoal:3,extra:0,origin:2,sp:30,v:0,cmd:null};
      const scored={p:4,goal:4,autoGoal:4,extra:0,origin:3,sp:30,v:0,cmd:null};
      runners=[trailing,scored];
      held.s=true; applyRunnerKeys(); held.s=false; const goalAfter=trailing.goal;
      let frames=0; while(trailing.p<3.999&&frames++<360) updateRunners(1/60);
      const observed={goalAfter,finalP:+trailing.p.toFixed(4),frames};
      out.push({rep,state:'先行走者p=4生還済み、後続p=3',observed,
        pass:goalAfter===4&&trailing.p>=3.999});
    }
    return out;
  })()`);
  add('OI-069',374,'ランナーが複数人いるときに、一人がホームインするとつっかえてしまって、二人目以降が三塁から進めない現象が起きているので修正して',
    '先行走者が生還済みなら、後続走者が本塁をgoalにでき実際に到達する。',oi069);

  const oi076 = phase3Random17Probe(context, 'OI-076', String.raw`(() => {
    const out=[]; const savedPlan=planPlay,savedRandom=Math.random; Math.random=()=>0.5;
    try{
      for(let rep=1;rep<=3;rep++){
        newGame(); S.half=0; S.outs=2; S.bases=[{id:rep,sp:25},null,null];
        planPlay=src=>({f:fielders.find(f=>f.n==='中'),t:3,x:0,y:220,air:true,firstLand:{x:0,y:220,z:0,t:3}});
        startFlight({exit:80,la:42,spray:0,q:0.8},1,[0,2.5,1.4]);
        const r=runners.find(x=>x.origin===1);
        const observed={forcedGo:!!ball.forcedGo,goal:r&&r.goal,v:r&&r.v,outs:baseOuts()};
        out.push({rep,state:'2アウト・捕球可能な高い飛球・一塁走者・入力なし',observed,
          pass:!!r&&observed.forcedGo===true&&observed.goal===2&&observed.v>0&&observed.outs===2});
      }
    }finally{planPlay=savedPlan;Math.random=savedRandom;}
    return out;
  })()`);
  add('OI-076',413,'2アウトの時は打ち上げてもランナーは止まらずに自動スタートしてほしいです',
    '2アウトでは捕球可能な高い飛球でも入力なしで既存走者が次塁へスタートする。',oi076);

  const overheadTrials = id => phase3Random17Probe(context,id,String.raw`(() => {
    const out=[]; const saved=Math.random; Math.random=()=>0.5;
    try{
      for(let rep=1;rep<=3;rep++){
        newGame(); S.half=0; S.phase='flight'; S.outs=0; S.preOuts=0; runners=[];
        const prim=fielders.find(f=>f.n==='遊');
        fielders.forEach(f=>{f.primary=f===prim;f.tx=f.cx;f.ty=f.cy;f.v=0;f.stun=0;f.fumbled=false;});
        const height=[9.2,12,18][rep-1];
        ball={x:prim.cx,y:prim.cy,z:height,t:1,vx:35,vy:0,vz:0,maxZ:height,landed:false,canCatchAir:true,primary:prim,
          planT:999,aimT:999,replanT:999,acc:0,exit:90,la:10,spray:0};
        const first=stepFlight(PHYS_H), dMinAfterOverhead=ball.dMin;
        ball.x=prim.cx+25;ball.y=prim.cy;ball.z=5;ball.vx=0;ball.vy=0;ball.vz=0;ball.t=1.2;ball.aimT=999;ball.replanT=999;
        const second=stepFlight(PHYS_H);
        const observed={phase:S.phase,dMinAfterOverhead,firstStepResult:first,secondStepResult:second,
          distanceLater:+Math.hypot(ball.x-prim.cx,ball.y-prim.cy).toFixed(3)};
        out.push({rep,state:{overheadHeight:height,horizontalDistanceAtPass:0},observed,
          pass:S.phase==='flight'&&first===false&&second===false&&dMinAfterOverhead===undefined});
      }
    }finally{Math.random=saved;}
    return out;
  })()`);
  const oi115=overheadTrials('OI-115');
  add('OI-115',608,'明らかに内野の頭の上を超えている打球がたびたびライナーで捕球判定になるので修正してほしいです',
    '内野手の真上でも捕球上限8.6ftを超える打球は捕球せず、過去の最接近距離も残さない。',oi115);
  const oi121=overheadTrials('OI-121');
  add('OI-121',638,'依然として内野の頭を超えた打球がライナーキャッチ判定される',
    '再指摘条件でも高さ9.2/12/18ftの頭上通過を捕球しない。',oi121);

  const oi116 = phase3Random17Probe(context, 'OI-116', String.raw`(() => {
    const out=[]; const saved=Math.random; Math.random=()=>0.5;
    function one(fld){
      newGame(); S.half=0;S.phase='flight';S.outs=0;S.preOuts=0;runners=[];
      const prim=fielders.find(f=>f.n==='投');
      fielders.forEach(f=>{f.primary=f===prim;f.tx=f.cx;f.ty=f.cy;f.v=0;f.stun=0;f.fumbled=false;});
      prim.cx=0;prim.cy=100;prim.tx=0;prim.ty=100;prim.fld=fld;prim.cat=100;
      ball={x:6.4,y:100,z:0,t:1,vx:0,vy:0,vz:0,maxZ:1,landed:true,canCatchAir:false,primary:prim,
        planT:999,aimT:999,replanT:999,acc:0,exit:40,la:0,spray:0};
      const stepResult=stepFlight(PHYS_H);
      return {fld,diveReach:+diveReach(prim).toFixed(4),phase:S.phase,diveT:+(prim.diveT||0).toFixed(3),stepResult};
    }
    try{
      for(let rep=1;rep<=3;rep++){
        const low=one(1),high=one(100);
        out.push({rep,state:'同じ6.4ftの横方向ゴロ',observed:{low,high},
          pass:low.phase==='flight'&&high.phase==='throwing'&&high.diveT>0&&high.diveReach>low.diveReach});
      }
    }finally{Math.random=saved;}
    return out;
  })()`);
  add('OI-116',613,'守備にスライディングキャッチを実装してほしいです（どれだけの距離を飛びつけるかは守備力に依存します）',
    '同じ6.4ftの打球を守備力100は飛び込み捕球し、守備力1は届かず、到達距離も能力依存になる。',oi116,{
      limitation:'無描画VMのため画面上のモーション品質は未確認。捕球差とdiveT発火を検証。'
    });

  const oi123 = phase3Random17Probe(context, 'OI-123', String.raw`(() => {
    const out=[]; const states=[{z:12,vx:24,vy:10,vz:8},{z:16,vx:30,vy:6,vz:-2},{z:10,vx:20,vy:14,vz:12}];
    for(let rep=1;rep<=3;rep++){
      newGame(); const f=fielders.find(x=>x.n==='中'); f.cx=0;f.cy=80;f.v=10;f.sp=30;
      const q=states[rep-1];
      ball={x:0,y:100,z:q.z,t:0.6,vx:q.vx,vy:q.vy,vz:q.vz,maxZ:q.z,landed:true,canCatchAir:false,primary:f};
      const target=interceptPoint(f), b={x:ball.x,y:ball.y,z:ball.z,vx:ball.vx,vy:ball.vy,vz:ball.vz};
      let best={d:1e9,z:null,t:0},t=0;
      for(let i=0;i<900;i++){
        stepBall(b,PHYS_H);t+=PHYS_H;
        const d=Math.hypot(b.x-target[0],b.y-target[1]);
        if(d<best.d)best={d,z:b.z,t};
      }
      const observed={target:target.map(v=>+v.toFixed(3)),
        targetOffset:+Math.hypot(target[0]-ball.x,target[1]-ball.y).toFixed(3),
        nearestPredicted:{distance:+best.d.toFixed(3),height:+best.z.toFixed(3),time:+best.t.toFixed(3)}};
      out.push({rep,state:q,observed,
        pass:observed.targetOffset>2&&observed.nearestPredicted.distance<1&&observed.nearestPredicted.height<=6.2});
    }
    return out;
  })()`);
  add('OI-123',648,'バウンドが大きい打球だとcpu守備がまっすぐ近づいた結果がバウンドが大きいせいで頭の上を超えて後逸することが多いので、バウンドに合わせるようにしてください',
    '現在地でなく、将来の捕球可能高さ6.2ft以下となる軌道点を迎えに行く。',oi123);

  const oi198 = phase3Random17Probe(context, 'OI-198', String.raw`(() => {
    const out=[];const saved=Math.random,savedPlan=planPlay;Math.random=()=>0.5;
    try{
      for(let rep=1;rep<=3;rep++){
        newGame();S.half=0;S.phase='flight';const f=fielders.find(x=>x.n==='投');
        f.cx=0;f.cy=100;f.tx=0;f.ty=100;f.v=0;f.stun=0;f.coverBase=null;
        ball={x:0,y:100,z:0,t:1,vx:15,vy:0,vz:0,maxZ:2,landed:true,canCatchAir:false,primary:f};
        planPlay=()=>({f,t:5,x:20,y:100,air:false,firstLand:{x:20,y:100,z:0,t:5}});
        deflectBall(f,0,true);
        const afterDeflect={stun:f.stun,planDelay:+(ball.planT-ball.t).toFixed(3),target:[f.tx,f.ty]};
        const startX=f.cx;let resumeAt=null;
        for(let i=1;i<=40;i++){moveFielders(0.01,true);if(resumeAt===null&&f.cx!==startX)resumeAt=i/100;}
        const observed={afterDeflect,resumeAt};
        out.push({rep,state:'ゴロ捕球エラー直後、20ft先へ再回収',observed,
          pass:afterDeflect.stun<=0.300001&&afterDeflect.planDelay<=0.250001&&resumeAt!==null&&resumeAt<=0.32});
      }
    }finally{Math.random=saved;planPlay=savedPlan;}
    return out;
  })()`);
  add('OI-198',1029,'エラーした後の硬直時間が長いので直して',
    'ゴロエラーの硬直は約0.30秒、再計画待ちは最大0.25秒で、0.32秒以内に移動を再開する。',oi198);

  const oi199 = phase3Random17Probe(context, 'OI-199', String.raw`(() => {
    const out=[];const names=['三','遊','二'];
    for(let rep=1;rep<=3;rep++){
      newGame();S.half=0;S.phase='throwing';S.playClock=0;runners=[];
      const thr=fielders.find(f=>f.n===names[rep-1]),recv=fielders.find(f=>f.n==='一'),dest=throwPoint(1);
      recv.cx=dest[0];recv.cy=dest[1];recv.tx=dest[0];recv.ty=dest[1];recv.v=0;recv.coverBase=1;
      ball={x:thr.cx,y:thr.cy,z:4.4,t:0,vx:0,vy:0,vz:0,landed:false,maxZ:0};
      launchThrow(thr.cx,thr.cy,dest[0],dest[1],armEff(thr));
      throwPlay={stage:'fly',t:0,acc:0,thrower:thr,receiver:recv,target:1,dest,kind:'infield',award:1,relayed:true,fieldT:1};
      let frames=0,maxTargetDeviation=0;
      while(throwPlay&&throwPlay.stage==='fly'&&frames++<360){
        updateThrowPhase(1/60);
        maxTargetDeviation=Math.max(maxTargetDeviation,Math.hypot(recv.tx-dest[0],recv.ty-dest[1]));
      }
      const observed={stage:throwPlay&&throwPlay.stage,sailed:!!(throwPlay&&throwPlay.sailed),
        receiverDistance:+Math.hypot(recv.cx-dest[0],recv.cy-dest[1]).toFixed(3),
        maxTargetDeviation:+maxTargetDeviation.toFixed(3),frames};
      out.push({rep,thrower:thr.n,state:{distance:+Math.hypot(thr.cx-dest[0],thr.cy-dest[1]).toFixed(3)},observed,
        pass:throwPlay&&observed.stage==='catch'&&!observed.sailed&&observed.receiverDistance<=1.8&&observed.maxTargetDeviation<0.1});
    }
    return out;
  })()`);
  add('OI-199',1034,'いつも内野ゴロのときにファーストが1塁より後ろでボールをとるようになったせいで極端に内野安打が増えています。おそらくボールがそれたときに取りに行くプログラムが悪さをしていると思います。二塁打や三塁だとの気も同様の問題があるのでいい感じに修正して',
    '三・遊・二から一塁への通常送球では、一塁手が塁後方へ動かず塁上でcatchへ入る。',oi199);

  const ovalSource = html.match(/function buildOval\(\)\{[\s\S]*?const m=MB\(\), a=([0-9.]+), b=([0-9.]+), w=([0-9.]+)/);
  const ovalGeometry = ovalSource
    ? {
        a:Number(ovalSource[1]),
        b:Number(ovalSource[2]),
        w:Number(ovalSource[3]),
        width:2*(Number(ovalSource[1])+Number(ovalSource[3])),
        height:2*(Number(ovalSource[2])+Number(ovalSource[3])),
      }
    : null;
  if (ovalGeometry) ovalGeometry.ratio=ovalGeometry.width/ovalGeometry.height;
  const oi224 = phase3Random17Probe(context, 'OI-224', `(() => {
    const out=[]; const shape=${JSON.stringify(ovalGeometry)},saved=Math.random; Math.random=()=>0.5;
    try{
      for(let rep=1;rep<=3;rep++){
        const D={tw:1000,aw:1,whiff:1};
        const horizontal=evalContact(0,1,0,1,D,12,0),vertical=evalContact(0,0,1,1,D,12,0);
        out.push({rep,state:'同じ1単位の横ずれと縦ずれ',observed:{shape,horizontalAccepted:!!horizontal,verticalAccepted:!!vertical},
          pass:!!shape&&shape.ratio>1.8&&!!horizontal&&!vertical});
      }
    }finally{Math.random=saved;}
    return out;
  })()`);
  add('OI-224',1159,'ミートカーソルは横長の楕円であるべきで、〇なのはバットの形状からしておかしいので修正して',
    '描画用楕円が横長で、同じ距離なら横ずれを許し縦ずれを拒否する当たり判定になる。',oi224,{
      limitation:'無描画VMのためアンチエイリアス等の最終見た目は未確認。描画関数の実寸と当たり判定を検証。'
    });

  const targetBytesAfter = fs.readFileSync(TARGET_HTML_PATH);
  const hashAfter = crypto.createHash('sha256').update(targetBytesAfter).digest('hex').toUpperCase();
  const totals = {
    ids: findings.length,
    trials: findings.reduce((sum, finding) => sum + finding.repetitions, 0),
    pass: findings.filter(finding => finding.verdict === 'PASS').length,
    fail: findings.filter(finding => finding.verdict === 'FAIL').length,
    unverified: findings.filter(finding => finding.verdict === '再現不能').length,
  };
  return {
    generatedAt:new Date().toISOString(),
    method:'既存bootGameInVm + no-draw計測用prelude。実ゲーム関数・実キーlistener・F/G保存を実行。',
    target:TARGET_HTML_PATH,
    build:phase3Random17Probe(context,'BUILD','BUILD'),
    sourceSha256Expected:'2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183',
    hashBefore,
    hashAfter,
    hashUnchanged:hashBefore===hashAfter,
    expectedHashMatched:hashBefore==='2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183',
    verdictConvention:'PASS=OWNER問題を再現せず、FAIL=OWNER問題を実行再現、再現不能=手順は固定したがOWNERの最終成果をNode VMだけでは判定不能',
    excludedAlreadyRun:['OI-088','OI-219','OI-228'],
    findings,
    totals,
    overallNoNewFailure:totals.fail===0,
  };
}

if (require.main === module && process.argv.includes('--phase3-random17')) {
  const phase3Random17Output = runPhase3Random17();
  process.stdout.write(`${JSON.stringify(phase3Random17Output, null, 2)}\n`);
  if (phase3Random17Output.totals.fail > 0 || !phase3Random17Output.hashUnchanged
      || !phase3Random17Output.expectedHashMatched) process.exitCode = 1;
}

// 工程3-A: residual/unresolved 10件の独立 no-render VM 検証。
// 既存の fs/path/vm、bootGameInVm、TARGET_HTML_PATH、HARNESS_PATH を再利用する追記用segment。
// top-level importは追加しない。FAIL=旧症状を再現、PASS=指定oracle内で旧症状なし。
function runPhase3UnresolvedA(repetitions = 3) {
  const expectedSha256 = '2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183';
  const crypto = require('crypto');
  const targetBytes = fs.readFileSync(TARGET_HTML_PATH);
  const targetSha256 = crypto.createHash('sha256').update(targetBytes).digest('hex').toUpperCase();
  if (targetSha256 !== expectedSha256) {
    throw new Error(`phase3-unresolved-a target SHA drift: ${targetSha256}`);
  }
  const targetHtml = targetBytes.toString('utf8');
  const harnessSource = fs.readFileSync(HARNESS_PATH, 'utf8');

  function evaluateFresh(label, source, timeout = 120000, html = targetHtml) {
    const savedRandom = Math.random;
    try {
      const context = bootGameInVm(html, `phase3-unresolved-a-${label}`);
      return vm.runInContext(source, context, {
        filename: `phase3-unresolved-a-${label}.js`,
        timeout,
      });
    } finally {
      Math.random = savedRandom;
    }
  }

  const vmHelpers = String.raw`
    function p3uaSeed(seed){ let x=seed>>>0; Math.random=()=>{ x=(x*1664525+1013904223)>>>0; return x/4294967296; }; }
    function p3uaActive(){ return ['flight','throwing','play'].includes(S.phase)&&!S.over; }
    function p3uaMid(r){ return !!(r&&!r.out&&r.p<3.999&&Math.abs(r.p-Math.round(r.p))>=0.02); }
  `;

  function test008() {
    const observations = [];
    for (let rep = 1; rep <= repetitions; rep += 1) {
      const observed = evaluateFresh(`OI-008-${rep}`, String.raw`(() => ({
        build: BUILD,
        phase: S.phase,
        fielders: fielders.length,
        finiteFielders: fielders.every(f => Number.isFinite(f.cx) && Number.isFinite(f.cy))
      }))()`);
      observations.push({ rep, ...observed });
    }
    return {
      id: 'OI-008',
      ownerOriginal: '全体的に粗すぎるのでちゃんと精査して',
      state: '凍結版を新規VMで初期化し、build・phase・野手数・座標有限性を確認',
      numericOracle: null,
      oracle: '原文に状態・数値閾値・終了条件がなく、無描画VMでは見た目の粗さを一意判定できない',
      repetitions,
      observations,
      verdict: '再現不能',
    };
  }

  function test052() {
    const observed = evaluateFresh('OI-052', `(function(){${vmHelpers}
      const ps=[3.05,3.15], speeds=[18,21,24,27], dists=[130,150,170,190,210,230,250,270,290], rows=[];
      for(let rep=1;rep<=${repetitions};rep++) for(const p of ps){
        let cases=0, goal4=0, out=0; const examples=[];
        for(const speed of speeds) for(const distance of dists){
          const seed=526000+(rep-1)*10000+Math.round(p*100)+speed*7+distance;
          p3uaSeed(seed); newGame(); S.outs=0; S.preOuts=0; S.bases=[null,null,null]; S.phase='flight';
          held.s=held.z=held.x=false; resetFielders();
          const r={p,goal:3,autoGoal:3,extra:0,origin:0,sp:speed,cmd:null,v:speed*0.35,dir:0,out:false}; runners=[r];
          const f=fielders.find(x=>x.n==='中'); f.cx=0; f.cy=distance; f.arm=.77; f.run=0; f.fld=.75; f.cat=.75;
          ball={x:f.cx,y:f.cy,z:.2,t:4,vx:0,vy:0,vz:0,landed:true,land:true,maxZ:10,primary:f};
          fielders.forEach(x=>x.primary=x===f); beginThrowPhase(f,'outfield',3);
          const assigned=r.goal>=3.99&&!r.cmd; const initialTarget=throwPlay&&throwPlay.target;
          let t=0; while(t<25&&p3uaActive()){ t+=1/120; update(1/120); }
          const reproduced=assigned&&r.out; cases++; if(assigned) goal4++; if(reproduced) out++;
          if(reproduced&&examples.length<2) examples.push({speed,distance,initialTarget,finalP:+r.p.toFixed(3),lastPlay:S.lastPlay});
        }
        rows.push({rep,p,cases,goal4,out,examples});
      }
      return {rows,total:rows.reduce((a,r)=>({cases:a.cases+r.cases,goal4:a.goal4+r.goal4,out:a.out+r.out}),{cases:0,goal4:0,out:0})};
    })()`);
    return {
      id: 'OI-052',
      ownerOriginal: 'sを押していないのに、打ったバッターは三塁で止まらずに勝手にホームに向かってアウトになりました',
      state: '打者走者を三塁直後p=3.05/3.15へ置き、S/Z/X・cmdなし。速度4段階×野手距離9段階×2位置×3反復',
      numericOracle: '無入力・cmdなしでgoal>=3.99が自動設定され、その走者がout=trueなら旧症状',
      repetitions,
      observations: observed,
      verdict: observed.total.out > 0 ? 'FAIL' : 'PASS',
    };
  }

  function test056() {
    const observations = evaluateFresh('OI-056', `(function(){${vmHelpers}
      const cfgs=[{p:2.18,f:'遊'},{p:2.42,f:'二'},{p:2.68,f:'三'}], out=[];
      for(let rep=1;rep<=${repetitions};rep++) for(const c of cfgs){
        newGame(); S.outs=0; S.preOuts=0; S.phase='throwing'; S.bases=[null,{id:1,sp:24},null]; resetFielders();
        const f=fielders.find(x=>x.n===c.f);
        function one(goal){
          const r={p:c.p,goal,autoGoal:goal,extra:0,origin:2,sp:24,cmd:null,v:18,dir:1,out:false};
          runners=[r]; updateRunners(0); const q=chooseThrowTarget(f);
          return {goal,p:r.p,v:r.v,derivedDir:r.dir,target:q?q.nb:null};
        }
        const forward=one(3), back=one(2);
        out.push({rep,...c,forward,back,samePhysical:forward.p===back.p&&forward.v===back.v,targetChanged:forward.target!==back.target});
      }
      return out;
    })()`);
    const pairedRepetitions = Array.from({length: repetitions}, (_, index) => {
      const rows = observations.filter(item => item.rep === index + 1);
      return {rep:index+1,cases:rows.length,reproduced:rows.some(item=>item.samePhysical&&item.targetChanged),rows};
    });
    return {
      id: 'OI-056',
      ownerOriginal: '中継が本塁へ投げたのも、これが原因の可能性が高い：そもそも守備の思考が走塁の思考と独立していないのがおかしいです / 守備は守備でその場で最適な行動をとるべきです',
      state: '位置p・速度v・野手状態を固定し、走者の内部goalだけを3と2へ変更してゼロ時間更新後の送球先を比較',
      numericOracle: '同じp・v・守備状態でgoalだけによりchooseThrowTargetのtargetが変化すれば旧症状',
      repetitions,
      observations: pairedRepetitions,
      verdict: pairedRepetitions.some(item => item.reproduced) ? 'FAIL' : 'PASS',
    };
  }

  function test060() {
    const observations = evaluateFresh('OI-060', `(function(){${vmHelpers}
      const ps=[2.08,2.22,2.36], out=[];
      for(let rep=1;rep<=${repetitions};rep++){
        const p=ps[(rep-1)%ps.length]; p3uaSeed(6000+rep); newGame(); S.outs=0; S.preOuts=0; S.phase='throwing'; S.bases=[null,null,null]; resetFielders();
        const r={p,goal:3,autoGoal:3,extra:0,origin:0,sp:12,cmd:null,v:4,dir:1,out:false}; runners=[r];
        const f=fielders.find(x=>x.n==='二'), third=fielders.find(x=>x.n==='三'); f.cx=0; f.cy=118; third.cx=-63.64; third.cy=63.64; third.coverBase=3;
        ball={x:f.cx,y:f.cy,z:4.6,t:3,vx:0,vy:0,vz:0,landed:true,land:true,maxZ:8};
        throwPlay={stage:'transfer',t:0,transfer:0.01,thrower:f,kind:'outfield',award:3,target:3,relayed:true,fieldT:3,stepChecked:false};
        let t=0, calls=[]; const original=concludePlay;
        window.concludePlay=function(){ calls.push({t:+t.toFixed(3),playClock:+(S.playClock||0).toFixed(3),p:+r.p.toFixed(3),goal:r.goal,out:!!r.out}); return original.apply(this,arguments); };
        try{ while(t<12&&p3uaActive()){ t+=1/120; update(1/120); } } finally { window.concludePlay=original; }
        out.push({rep,startP:p,calls,premature:calls.some(x=>!x.out&&x.p<2.98),finalP:+r.p.toFixed(3),finalOut:!!r.out,lastPlay:S.lastPlay});
      }
      return out;
    })()`);
    return {
      id: 'OI-060',
      ownerOriginal: 'ツーベースヒットを打って、二塁を回って三塁に向かったのですが、セカンドがサードに投げたらあきらかにアウトのタイミングだったのに、セカンドがボールをとった時点でスリーベース判定になり、プレーが打ち切られました',
      state: '打者走者を二塁直後の3位置へ置き、遅い走力で二塁手から三塁へ明示送球',
      numericOracle: '三塁送球中、未アウトかつp<2.98でconcludePlayが呼ばれれば旧症状',
      repetitions,
      observations,
      verdict: observations.some(item => item.premature) ? 'FAIL' : 'PASS',
    };
  }

  function test073() {
    const observations = evaluateFresh('OI-073', `(function(){${vmHelpers}
      const ps=[1.18,1.50,1.82], out=[];
      for(let rep=1;rep<=${repetitions};rep++){
        const p=ps[(rep-1)%ps.length]; p3uaSeed(7300+rep); newGame(); S.outs=0; S.bases=[{id:1,sp:24},null,null];
        startFlight({exit:85,la:-8,spray:-30,q:.7},1,[0,2.5,1.4]);
        let prep=0; while(prep++<300&&!throwPlay&&p3uaActive()) update(1/60);
        const r=runners.find(x=>x.origin===1); if(!throwPlay||!r){ out.push({rep,precondition:false}); continue; }
        r.p=p; r.goal=2; r.autoGoal=2; r.cmd=null; r.v=2; S.playClock=11.85;
        let t=0, calls=[]; const original=concludePlay;
        window.concludePlay=function(){ calls.push({t:+t.toFixed(3),playClock:+S.playClock.toFixed(3),p:+r.p.toFixed(3),goal:r.goal,out:!!r.out,mid:p3uaMid(r)}); return original.apply(this,arguments); };
        try{ while(t<12&&p3uaActive()){ t+=1/120; update(1/120); } } finally { window.concludePlay=original; }
        out.push({rep,precondition:true,startP:p,calls,premature:calls.some(x=>x.mid),finalP:+r.p.toFixed(3),finalGoal:r.goal,finalOut:!!r.out});
      }
      return out;
    })()`);
    const valid = observations.filter(item => item.precondition);
    return {
      id: 'OI-073',
      ownerOriginal: 'ランナーが塁間にいるときにプレイが打ち切られることがちょこちょこあるので修正して',
      state: '実打球から送球状態を作り、走者を一・二塁間の3位置、playClock=11.85から通常更新',
      numericOracle: 'concludePlay呼出時に対象走者が生存かつ塁間なら旧症状',
      repetitions,
      observations,
      verdict: valid.length < repetitions ? '再現不能' : (valid.some(item=>item.premature) ? 'FAIL' : 'PASS'),
    };
  }

  function test080() {
    const cfgs=[{seed:8001,exit:83,la:-7,spray:-32},{seed:8002,exit:91,la:12,spray:18},{seed:8003,exit:98,la:14,spray:-38}];
    const observations = evaluateFresh('OI-080', `(function(){${vmHelpers}
      const cfgs=${JSON.stringify(cfgs)}, out=[];
      for(let rep=1;rep<=${repetitions};rep++){
        const c=cfgs[(rep-1)%cfgs.length]; p3uaSeed(c.seed); newGame(); S.outs=1; S.bases=[{id:1,sp:24},{id:2,sp:22},null]; held.s=held.z=held.x=false;
        let t=0, calls=[]; const original=concludePlay;
        window.concludePlay=function(){ calls.push({t:+t.toFixed(3),playClock:+(S.playClock||0).toFixed(3),mid:runners.filter(r=>p3uaMid(r)).map(r=>({origin:r.origin,p:+r.p.toFixed(3),goal:r.goal}))}); return original.apply(this,arguments); };
        try{ startFlight({exit:c.exit,la:c.la,spray:c.spray,q:.8},1,[0,2.5,1.4]); while(t<40&&p3uaActive()){ t+=1/120; update(1/120); } } finally { window.concludePlay=original; }
        out.push({rep,...c,calls,premature:calls.some(x=>x.mid.length>0),lastPlay:S.lastPlay,phase:S.phase});
      }
      return out;
    })()`);
    return {
      id: 'OI-080',
      ownerOriginal: '走者が塁間で打ち切られる：直っていません',
      state: '一・二塁走者あり、無入力の実打球3経路を終了まで更新',
      numericOracle: 'concludePlay呼出時に生存走者が1人以上塁間なら旧症状',
      repetitions,
      observations,
      verdict: observations.some(item=>item.premature) ? 'FAIL' : 'PASS',
    };
  }

  function test137() {
    const observations=[];
    for(let rep=1;rep<=repetitions;rep+=1){
      observations.push(evaluateFresh(`OI-137-${rep}`, `(function(){${vmHelpers}
        p3uaSeed(13701); newGame(); const holder=fielders.find(f=>f.n==='投'), cat=fielders.find(f=>f.n==='捕');
        holder.cx=-40; holder.cy=40; holder.v=0; holder.stun=0; holder.coverBase=null; cat.cx=0; cat.cy=-.5; cat.v=0; cat.stun=0; cat.coverBase=4;
        fielders.forEach(f=>{ if(f!==holder&&f!==cat){ f.v=0; f.stun=0; f.coverBase=null; } });
        const r={p:3.5,goal:4,autoGoal:4,extra:0,origin:3,sp:23,cmd:null,v:0,out:false}; runners=[r];
        ball={x:holder.cx,y:holder.cy,z:4.4,t:0,vx:0,vy:0,vz:0,landed:false,land:false,maxZ:0};
        throwPlay={stage:'rundown',target:3,thrower:holder,receiver:holder,kind:'pickoff',rd:{r,hi:4,lo:3,loLim:3,hiLim:4,holder,sub:'chase',t:.3,ex:0}}; S.phase='throwing';
        let t=0, calls=[]; const original=concludePlay;
        window.concludePlay=function(){ calls.push({t:+t.toFixed(3),playClock:+(S.playClock||0).toFixed(3),p:+r.p.toFixed(3),goal:r.goal,out:!!r.out,mid:p3uaMid(r),stage:throwPlay&&throwPlay.stage}); return original.apply(this,arguments); };
        try{ while(t<18&&throwPlay&&!S.over){ t+=1/120; updateThrowPhase(1/120); } } finally { window.concludePlay=original; }
        return {rep:${rep},calls,premature:calls.some(x=>x.mid),finalP:+r.p.toFixed(3),finalGoal:r.goal,finalOut:!!r.out,throwActive:!!throwPlay,t:+t.toFixed(3)};
      })()`));
    }
    return {
      id: 'OI-137',
      ownerOriginal: 'まだランナーが挟まれた時に強制的にプレーが打ち切られたり',
      state: '同一seedの挟殺状態を毎回新規VMで作り、決着後の終了経路まで更新',
      numericOracle: 'concludePlay呼出時に対象走者が未アウトかつ塁間なら旧症状',
      repetitions,
      observations,
      verdict: observations.some(item=>item.premature) ? 'FAIL' : 'PASS',
    };
  }

  function goalFlipTest(id, ownerOriginal, cfgs) {
    const observations = evaluateFresh(id, `(function(){${vmHelpers}
      const cfgs=${JSON.stringify(cfgs)}, out=[];
      for(let rep=1;rep<=${repetitions};rep++){
        const c=cfgs[(rep-1)%cfgs.length]; p3uaSeed(c.seed); newGame(); S.outs=c.outs; S.bases=[null,{id:1,sp:24},null]; held.s=held.z=held.x=false;
        startFlight({exit:c.exit,la:c.la,spray:c.spray,q:.7},1,[0,2.5,1.4]);
        const r=runners.find(x=>x.origin===2); let t=0, sawForward=false, flips=0, firstThrow=null, trace=[];
        while(r&&t<8&&p3uaActive()){
          const g0=r.goal, p0=r.p, had=!!throwPlay; t+=1/120; update(1/120); if(r.goal>=3) sawForward=true;
          if(sawForward&&r.goal<g0-.01){ flips++; trace.push({t:+t.toFixed(3),p0:+p0.toFixed(3),p:+r.p.toFixed(3),from:g0,to:r.goal}); }
          if(!had&&throwPlay&&!firstThrow) firstThrow={t:+t.toFixed(3),p:+r.p.toFixed(3),goal:r.goal,kind:throwPlay.kind};
        }
        out.push({rep,...c,sawForward,flips,firstThrow,trace,finalP:r?+r.p.toFixed(3):null,finalGoal:r?r.goal:null});
      }
      return out;
    })()`);
    const valid=observations.filter(item=>item.sawForward);
    return {
      id,
      ownerOriginal,
      state: '無入力で二塁走者が三塁へ自動進塁する実打球を捕球・送球開始後まで更新',
      numericOracle: 'goal>=3を観測後、捕球・送球開始時にgoalが0.01以上低下すれば旧逆走症状',
      repetitions,
      observations,
      verdict: valid.length < repetitions ? '再現不能' : (valid.some(item=>item.flips>0) ? 'FAIL' : 'PASS'),
    };
  }

  function replaceExactlyOne(source, needle, replacement, label) {
    const count=source.split(needle).length-1;
    if(count!==1) throw new Error(`${label}: expected one occurrence, got ${count}`);
    return source.replace(needle,replacement);
  }

  function compactHarness(html,label) {
    const savedRandom=Math.random;
    try{
      const context=bootGameInVm(html,`phase3-unresolved-a-harness-${label}`);
      const raw=vm.runInContext(harnessSource,context,{filename:'_test_harness_20260804.js',timeout:120000});
      const rows=Object.entries(raw).map(([name,detail])=>({name,verdict:detail&&detail.verdict,trials:detail&&detail.trials,detail}));
      return {count:rows.length,pass:rows.filter(x=>x.verdict==='PASS').length,fail:rows.filter(x=>x.verdict!=='PASS').length,failures:rows.filter(x=>x.verdict!=='PASS'),rows};
    } finally { Math.random=savedRandom; }
  }

  function test063(currentResults) {
    const mutations={
      goalReversal:{testPrefix:'test12_',make:source=>replaceExactlyOne(source,': (committed ? Math.min(4, r.origin+1) : r.origin));',': r.origin);','goalReversal')},
      prematureScore:{testPrefix:'test13_',make:source=>replaceExactlyOne(source,'if(r.p>=3.97){ r.goal=4; if(!timePlay || timePlay.includes(r)) runs++; return; }','if(g>=4){ r.goal=4; if(!timePlay || timePlay.includes(r)) runs++; return; }','prematureScore')},
      noGrace:{testPrefix:'test14_',make:source=>replaceExactlyOne(source,'const grace = (midBase || keyHeld || ballLive) ? 8 : 0;','const grace = 0;','noGrace')},
    };
    const baseline=[];
    for(let rep=1;rep<=repetitions;rep+=1) baseline.push({rep,...compactHarness(targetHtml,`baseline-${rep}`)});
    const mutationRuns={};
    for(const [name,spec] of Object.entries(mutations)){
      const html=spec.make(targetHtml);
      const run=compactHarness(html,`${name}-1`);
      const dedicated=run.rows.find(row=>row.name.startsWith(spec.testPrefix));
      mutationRuns[name]=[{rep:1,count:run.count,pass:run.pass,fail:run.fail,dedicatedTest:dedicated&&{name:dedicated.name,verdict:dedicated.verdict,trials:dedicated.trials},detected:!!dedicated&&dedicated.verdict==='FAIL'}];
    }
    const escapedCurrentDefects=['OI-052','OI-056','OI-137'].filter(id=>currentResults[id]&&currentResults[id].verdict==='FAIL');
    const baselineAllPass=baseline.every(run=>run.count===16&&run.fail===0);
    const allKnownMutationsDetected=Object.values(mutationRuns).every(runs=>runs.length===1&&runs.every(run=>run.detected));
    const harnessCoverageFailed=escapedCurrentDefects.length>0;
    return {
      id:'OI-063',
      ownerOriginal:'どうしてあなたのチェックではこのような私が指摘している大量のミスを見つけられないのですか？',
      state:'既存16テストを通常条件・新規VMで3反復し、既知変異3種を各1回（専用test内部は12/8/6反復）実行。独立工程3-Aの現存FAILとも照合',
      numericOracle:'既存16本の通常実行が完了しても、独立検証で現存FAILが1件以上残り、その症状を直接測る専用testが無ければ旧「チェックで見つけられない」を再現',
      repetitions,
      observations:{baseline,mutationRuns,baselineAllPass,allKnownMutationsDetected,escapedCurrentDefects,harnessCoverageFailed},
      verdict:harnessCoverageFailed?'FAIL':'PASS',
    };
  }

  const results={};
  results['OI-008']=test008();
  results['OI-052']=test052();
  results['OI-056']=test056();
  results['OI-060']=test060();
  results['OI-073']=test073();
  results['OI-080']=test080();
  results['OI-137']=test137();
  results['OI-140']=goalFlipTest('OI-140','私の攻撃時に、内野ゴロでランナーが自動スタートしたのに、内野がゴロを補給すると勝手に戻ってしまいます',[
    {seed:14001,outs:0,exit:92,la:-3,spray:10},{seed:14002,outs:1,exit:92,la:-3,spray:10},{seed:14003,outs:0,exit:88,la:-5,spray:18},
  ]);
  results['OI-238']=goalFlipTest('OI-238','セカンドごろでセカンドランナーが三塁に走っていたのにセカンドが打球をとった瞬間に勝手にセカンドに戻り始めた',[
    {seed:23801,outs:0,exit:92,la:-3,spray:10},{seed:23802,outs:0,exit:92,la:-3,spray:10},{seed:23803,outs:0,exit:92,la:-3,spray:10},
  ]);
  results['OI-063']=test063(results);

  const orderedIds=['OI-008','OI-052','OI-056','OI-060','OI-063','OI-073','OI-080','OI-137','OI-140','OI-238'];
  const ordered=Object.fromEntries(orderedIds.map(id=>[id,results[id]]));
  const counts={PASS:0,FAIL:0,'再現不能':0};
  for(const item of Object.values(ordered)) counts[item.verdict]=(counts[item.verdict]||0)+1;
  return {
    phase:'3-A',
    build:/const BUILD\s*=\s*'([^']+)'/.exec(targetHtml)?.[1]||null,
    targetSha256,
    convention:'FAIL=旧症状を再現、PASS=指定した数値oracle内で旧症状なし、再現不能=判定条件不足',
    ids:orderedIds,
    counts,
    results:ordered,
  };
}

if (require.main === module && process.argv.includes('--phase3-unresolved-a')) {
  const result = runPhase3UnresolvedA();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.counts.FAIL > 0) process.exitCode = 1;
}
function reproFinding13UncommandedHomeAdvance() {
  return runPhase3UnresolvedA(3).results['OI-052'];
}

if (require.main === module && process.argv.includes('--finding13')) {
  const result = reproFinding13UncommandedHomeAdvance();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.verdict !== 'PASS') process.exitCode = 1;
}
function reproFinding14DefenseReadsRunnerGoal() {
  return runPhase3UnresolvedA(3).results['OI-056'];
}

if (require.main === module && process.argv.includes('--finding14')) {
  const result = reproFinding14DefenseReadsRunnerGoal();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.verdict !== 'PASS') process.exitCode = 1;
}
function reproFinding15PickoffCoverTimeoutEndsMidBase() {
  return runPhase3UnresolvedA(3).results['OI-137'];
}

if (require.main === module && process.argv.includes('--finding15')) {
  const result = reproFinding15PickoffCoverTimeoutEndsMidBase();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.verdict !== 'PASS') process.exitCode = 1;
}
function reproFinding16HarnessCoverageGap() {
  return runPhase3UnresolvedA(3).results['OI-063'];
}

if (require.main === module && process.argv.includes('--finding16')) {
  const result = reproFinding16HarnessCoverageGap();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.verdict !== 'PASS') process.exitCode = 1;
}

// Phase 3 control-scope completion: OWNER series OI-059/086/088/152/165/219/228.
// Append this segment to review_sol_ultra_repro_20260805.js.
const phase3ControlFullCrypto = require('crypto');

function runPhase3ControlScopeFull(repetitions = 5) {
  const targetBytesBefore = fs.readFileSync(TARGET_HTML_PATH);
  const hashBefore = phase3ControlFullCrypto.createHash('sha256').update(targetBytesBefore).digest('hex').toUpperCase();
  const html = targetBytesBefore.toString('utf8');
  const context = bootGameInVm(html, 'phase3-control-scope-full');
  const evaluate = source => vm.runInContext(source, context, { timeout: 30000 });
  const added = { 'OI-059': [], 'OI-086': [], 'OI-152': [] };

  for (let trial = 0; trial < repetitions; trial += 1) {
    added['OI-059'].push(evaluate(String.raw`
      (()=>{
        const reset=(nextRunners)=>{
          newGame(); S.half=0; S.outs=0; S.preOuts=0; S.over=false; S.phase='throwing';
          runners=nextRunners; ball={landed:true,canCatchAir:false,maxZ:0}; throwPlay={stage:'catch'};
          for(const k in held) held[k]=false;
        };
        const goals=()=>runners.map(r=>r.goal);
        const mk=(origin,p,goal)=>({origin,p,goal,autoGoal:goal,extra:0,sp:24,v:0,out:false,tagUp:false});

        reset([mk(0,0.40,1),mk(1,1.40,1),mk(2,2.40,2)]);
        held.s=true; updateRunnerCommands();
        const allAdvance={expected:[1,2,3],actual:goals()};
        allAdvance.pass=JSON.stringify(allAdvance.actual)===JSON.stringify(allAdvance.expected);

        reset([mk(0,1.40,2),mk(1,2.40,3),mk(2,3.40,4)]);
        held.x=true; updateRunnerCommands();
        const allReturn={expected:[1,2,3],actual:goals()};
        allReturn.pass=JSON.stringify(allReturn.actual)===JSON.stringify(allReturn.expected);

        reset([mk(0,0.40,1),mk(1,1.40,1),mk(2,2.40,2)]);
        held['2']=true; held.s=true; updateRunnerCommands();
        const selectedAdvance={expected:[1,1,3],actual:goals()};
        selectedAdvance.pass=JSON.stringify(selectedAdvance.actual)===JSON.stringify(selectedAdvance.expected);

        reset([mk(0,0.40,1),mk(1,1.40,1),mk(2,2.40,3)]);
        held['2']=true; held.x=true; updateRunnerCommands();
        const selectedReturn={expected:[1,1,2],actual:goals()};
        selectedReturn.pass=JSON.stringify(selectedReturn.actual)===JSON.stringify(selectedReturn.expected);

        const checks={allAdvance,allReturn,selectedAdvance,selectedReturn};
        return {checks,pass:Object.values(checks).every(check=>check.pass)};
      })()
    `));

    added['OI-086'].push(evaluate(String.raw`
      (()=>{
        const reset=(nextRunners)=>{
          newGame(); S.half=0; S.outs=0; S.preOuts=0; S.over=false; S.phase='throwing'; S.stealing=true;
          runners=nextRunners; ball={landed:true,canCatchAir:false,maxZ:0}; throwPlay={stage:'catch'};
          for(const k in held) held[k]=false;
        };
        const state=()=>runners.map(r=>({origin:r.origin,goal:r.goal,cmd:r.cmd||null}));
        const goals=()=>runners.map(r=>r.goal);
        const mk=(origin,p,goal)=>({origin,p,goal,autoGoal:goal,extra:0,sp:24,v:10,out:false,tagUp:false,stole:true});

        reset([mk(1,1.35,1),mk(3,3.15,3)]);
        held.s=true; updateRunnerCommands();
        const doubleSteal={expected:[2,4],actual:goals(),state:state()};
        doubleSteal.pass=JSON.stringify(doubleSteal.actual)===JSON.stringify(doubleSteal.expected);

        reset([mk(1,1.35,2),mk(3,3.15,4)]);
        held.x=true; updateRunnerCommands();
        const bothReturn={expected:[1,3],actual:goals(),state:state()};
        bothReturn.pass=JSON.stringify(bothReturn.actual)===JSON.stringify(bothReturn.expected);

        reset([mk(1,1.35,2),mk(3,3.15,3)]);
        held['3']=true; held.s=true; updateRunnerCommands();
        const thirdOnlyAdvance={expected:[2,4],actual:goals(),state:state()};
        thirdOnlyAdvance.pass=JSON.stringify(thirdOnlyAdvance.actual)===JSON.stringify(thirdOnlyAdvance.expected);

        reset([mk(1,1.35,2),mk(3,3.15,4)]);
        held['1']=true; held.x=true; updateRunnerCommands();
        const firstOnlyReturn={expected:[1,4],actual:goals(),state:state()};
        firstOnlyReturn.pass=JSON.stringify(firstOnlyReturn.actual)===JSON.stringify(firstOnlyReturn.expected);

        const checks={doubleSteal,bothReturn,thirdOnlyAdvance,firstOnlyReturn};
        return {checks,pass:Object.values(checks).every(check=>check.pass)};
      })()
    `));

    added['OI-152'].push(evaluate(String.raw`
      (()=>{
        const reset=(nextRunners)=>{
          newGame(); S.half=0; S.outs=0; S.preOuts=0; S.over=false; S.phase='flight';
          runners=nextRunners;
          ball={x:0,y:250,z:20,t:3.2,la:50,landed:false,canCatchAir:true,maxZ:20,primary:{n:'中'}};
          for(const k in held) held[k]=false;
        };
        const mk=(origin,p,goal,tagUp=false)=>({origin,p,goal,autoGoal:goal,extra:0,sp:24,v:0,out:false,tagUp});

        reset([mk(0,0,1),mk(1,1.085,1),mk(3,3,3)]);
        held['3']=true; held.s=true; applyRunnerKeys();
        const batterBeforeCatch=runners.find(r=>r.origin===0);
        const firstBeforeCatch=runners.find(r=>r.origin===1);
        const thirdBeforeCatch=runners.find(r=>r.origin===3);
        const selectedStartBeforeCatch={
          expected:{batterGoal:1,firstGoal:1,thirdGoal:3,thirdTagUp:true},
          actual:{batterGoal:batterBeforeCatch.goal,firstGoal:firstBeforeCatch.goal,
            thirdGoal:thirdBeforeCatch.goal,thirdTagUp:!!thirdBeforeCatch.tagUp}
        };
        selectedStartBeforeCatch.pass=JSON.stringify(selectedStartBeforeCatch.actual)===JSON.stringify(selectedStartBeforeCatch.expected);
        resolveCatch();
        const thirdAfterCatch=runners.find(r=>r.origin===3);
        const startAfterCatch={expectedThirdGoal:4,actualThirdGoal:thirdAfterCatch.goal,
          pass:thirdAfterCatch.goal===4};

        reset([mk(0,0,1),mk(1,1.085,1),mk(3,3.35,4,true)]);
        held['3']=true; held.x=true; applyRunnerKeys();
        const batterAfterReturn=runners.find(r=>r.origin===0);
        const firstAfterReturn=runners.find(r=>r.origin===1);
        const thirdAfterReturn=runners.find(r=>r.origin===3);
        const selectedReturn={
          expected:{batterGoal:1,firstGoal:1,thirdGoal:3,thirdTagUp:false,thirdCmd:'X'},
          actual:{batterGoal:batterAfterReturn.goal,firstGoal:firstAfterReturn.goal,
            thirdGoal:thirdAfterReturn.goal,thirdTagUp:!!thirdAfterReturn.tagUp,thirdCmd:thirdAfterReturn.cmd||null}
        };
        selectedReturn.pass=JSON.stringify(selectedReturn.actual)===JSON.stringify(selectedReturn.expected);

        const checks={selectedStartBeforeCatch,startAfterCatch,selectedReturn};
        return {checks,pass:Object.values(checks).every(check=>check.pass)};
      })()
    `));
  }

  const prior = runPhase3ControlScopeExpansion(repetitions);
  const owner = {
    'OI-059': { ownerLine: 325, ownerText: '複数ランナーがいるときは打ったバッターもランナーも帰塁ができません',
      oracle: '複数走者と打者走者を、全体S/Xと塁指定+S/Xの双方で進塁・帰塁できる' },
    'OI-086': { ownerLine: 464, ownerText: 'ランナー1,3塁の時は重盗を仕掛けたいことがあるのですが、今は盗塁時は盗塁するランナーしか動かせないし、途中で戻れないようになっているので、打球処理時と同じように操作できるようにしてほしいです',
      oracle: '盗塁送球中に一・三塁走者を全体でも個別でも進塁・帰塁できる' },
    'OI-088': { ownerLine: 474, ownerText: '例えばランナー2塁の時にセンター前ヒットでセカンドランナーを本塁に返したいときに、先に打ったバッターが一塁に到達していると、セカンドランナーを本塁に向かわせるために、打ったバッターが1塁を回って1,2塁間で挟まれないといけません。ランナーの個別操作もできるようにしてほしいです',
      oracle: 'Zで先頭走者だけを進め、打者走者へ進塁指示を漏らさない' },
    'OI-152': { ownerLine: 800, ownerText: 'ランナーを別々に動かせるようにしてほしいです（例えばランナー一三塁でタッチアップで3塁ランナーだけスタートみたいな感じ）',
      oracle: '高い飛球で三塁走者だけを選択して発進・帰塁でき、打者走者と一塁走者を変更しない' },
    'OI-165': { ownerLine: 865, ownerText: 'ランナーを個別操作したいのですが、先頭の奏者だけしか個別操作できないので、ランナー1,3塁の時1塁ランナーだけを動かせないです',
      oracle: '1+Sで一塁走者だけを操作し、打者走者と三塁走者を変更しない' },
    'OI-219': { ownerLine: 1135, ownerText: 'フライの時はバッターが1塁より先にsを押しても進めないのも修正して',
      oracle: '高い飛球中でも一塁到達後の打者走者がSで二塁へ進める' },
    'OI-228': { ownerLine: 1180, ownerText: '挟殺プレーでユーザーが操作できないのも謎ですし',
      oracle: '挟殺中も走者へのS/X操作が反映される' },
  };

  const orderedIds = ['OI-059','OI-086','OI-088','OI-152','OI-165','OI-219','OI-228'];
  const issues = orderedIds.map(id => {
    const trials = added[id] || prior.summary[id].trials;
    const passed = trials.filter(result => result.pass).length;
    return { id, ...owner[id], repetitions: trials.length, passed, failed: trials.length - passed,
      verdict: passed === trials.length ? 'PASS' : 'FAIL', trials };
  });
  const targetBytesAfter = fs.readFileSync(TARGET_HTML_PATH);
  const hashAfter = phase3ControlFullCrypto.createHash('sha256').update(targetBytesAfter).digest('hex').toUpperCase();
  return {
    target: TARGET_HTML_PATH,
    build: vm.runInContext('BUILD', context),
    sourceSha256Expected: '2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183',
    sourceSha256Before: hashBefore,
    sourceSha256After: hashAfter,
    sourceUnchanged: hashBefore === hashAfter,
    repetitions,
    sameTypeSeries: orderedIds,
    addedThisPass: ['OI-059','OI-086','OI-152'],
    totals: { issues: issues.length, passes: issues.filter(item=>item.verdict==='PASS').length,
      failures: issues.filter(item=>item.verdict==='FAIL').length,
      topLevelTrials: issues.reduce((sum,item)=>sum+item.repetitions,0) },
    issues,
  };
}

if (require.main === module && process.argv.includes('--phase3-control-scope-full')) {
  const result = runPhase3ControlScopeFull();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.issues.some(item => item.verdict === 'FAIL')) process.exitCode = 1;
}

function reproFinding19TagUpSelectionLeaksToBatter() {
  const result = runPhase3ControlScopeFull(5);
  return result.issues.find(item => item.id === 'OI-152');
}

if (require.main === module && process.argv.includes('--finding19')) {
  const result = reproFinding19TagUpSelectionLeaksToBatter();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.verdict !== 'PASS') process.exitCode = 1;
}

/* 工程4: 送球のずれ分布（最終事前条件は _tmp_phase4_throw_preregister_v3_20260805.md）。 */
function phase4ThrowFnv1a32(input) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function phase4ThrowNearestRank(sorted, probability) {
  const rank = Math.max(1, Math.ceil(probability * sorted.length));
  return sorted[rank - 1];
}

function runPhase4ThrowOffsetStats(options = {}) {
  const trialsPerCell = options.trialsPerCell || 5000;
  if (trialsPerCell < 1000) throw new Error('phase4 throw stats requires at least 1000 trials per cell');
  const masterSeed = 'SOL-ULTRA-20260805|throw-offset';
  const abilities = [100, 70, 40];
  const distances = [90, 150, 210];
  const targetBytesBefore = readFrozenTargetBytes();
  const sourceSha256Before = crypto.createHash('sha256').update(targetBytesBefore).digest('hex').toUpperCase();
  const html = targetBytesBefore.toString('utf8');
  const context = bootGameInVm(html, 'phase4-throw-offset-stats');
  const build = vm.runInContext('BUILD', context);
  const rows = [];

  for (const acc of abilities) {
    for (const distanceFt of distances) {
      const seedText = `${masterSeed}|acc=${acc}|distance=${distanceFt}`;
      const seedUint32 = phase4ThrowFnv1a32(seedText);
      const samples = vm.runInContext(String.raw`
        (()=>{
          let phase4State=${seedUint32}>>>0;
          const phase4Math=Object.create(Math);
          phase4Math.random=()=>{
            phase4State ^= phase4State << 13;
            phase4State ^= phase4State >>> 17;
            phase4State ^= phase4State << 5;
            return (phase4State>>>0)/4294967296;
          };
          Math=phase4Math;
          const phase4Thrower={acc:${acc},run:0};
          const phase4Values=[];
          const phase4BestDs=[];
          let phase4BaseUncatchable=0;
          let phase4FiniteLaunches=0;
          for(let i=0;i<${trialsPerCell};i++){
            ball={x:0,y:0,z:0,t:0,vx:0,vy:0,vz:0,landed:true,bs:0,ss:0};
            const off=throwOffset(phase4Thrower,${distanceFt});
            launchThrow(0,0,off[0],${distanceFt}+off[1],1.0);
            if(Number.isFinite(ball.vx)&&Number.isFinite(ball.vy)&&Number.isFinite(ball.vz)) phase4FiniteLaunches++;
            phase4Values.push(Math.hypot(off[0],off[1]));
            const pb={x:ball.x,y:ball.y,z:ball.z,vx:ball.vx,vy:ball.vy,vz:ball.vz,
              bs:ball.bs||0,ss:ball.ss||0,landed:false,t:0,maxZ:0};
            let bestD=1e9,bestZ=0;
            for(let j=0;j<480;j++){
              stepBall(pb,PHYS_H);
              const dd=Math.hypot(pb.x,pb.y-${distanceFt});
              if(dd<bestD){bestD=dd;bestZ=pb.z;}
              if(pb.z<=0.1&&Math.hypot(pb.vx,pb.vy)<3) break;
            }
            phase4BestDs.push(bestD);
            if(!(bestD<5&&bestZ<=8.5)) phase4BaseUncatchable++;
          }
          return {values:phase4Values,bestDs:phase4BestDs,baseUncatchable:phase4BaseUncatchable,
            finiteLaunches:phase4FiniteLaunches,finalPrngState:phase4State>>>0};
        })()
      `, context, { timeout: 30000 });

      const values = Array.from(samples.values, Number).sort((a, b) => a - b);
      const bestDs = Array.from(samples.bestDs, Number).sort((a, b) => a - b);
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
      const bestDMean = bestDs.reduce((sum, value) => sum + value, 0) / bestDs.length;
      const rawAimOutside5 = values.filter(value => value >= 5.0).length;
      const badThrows = samples.baseUncatchable;
      const sigmaPerAxisFt = distanceFt * (0.004 + 0.016 * (100 - acc) / 100);
      rows.push({
        acc,
        distanceFt,
        run: 0,
        trials: values.length,
        seedText,
        seedUint32,
        finalPrngState: samples.finalPrngState,
        finiteLaunches: samples.finiteLaunches,
        sigmaPerAxisFt: +sigmaPerAxisFt.toFixed(6),
        meanFt: +mean.toFixed(4),
        stdDevFt: +Math.sqrt(variance).toFixed(4),
        p50Ft: +phase4ThrowNearestRank(values, 0.50).toFixed(4),
        p90Ft: +phase4ThrowNearestRank(values, 0.90).toFixed(4),
        p95Ft: +phase4ThrowNearestRank(values, 0.95).toFixed(4),
        p99Ft: +phase4ThrowNearestRank(values, 0.99).toFixed(4),
        maxFt: +values[values.length - 1].toFixed(4),
        bestDMeanFt: +bestDMean.toFixed(4),
        bestDP95Ft: +phase4ThrowNearestRank(bestDs, 0.95).toFixed(4),
        bestDMaxFt: +bestDs[bestDs.length - 1].toFixed(4),
        rawAimOutside5,
        rawAimOutside5RatePct: +(100 * rawAimOutside5 / values.length).toFixed(4),
        badThrows,
        badThrowRatePct: +(100 * badThrows / values.length).toFixed(4),
      });
    }
  }

  const targetBytesAfter = readFrozenTargetBytes();
  const sourceSha256After = crypto.createHash('sha256').update(targetBytesAfter).digest('hex').toUpperCase();
  return {
    targetBuild: build,
    targetCommit: TARGET_BLOB_SPEC.split(':')[0],
    sourceSha256Expected: TARGET_EXPECTED_SHA256,
    sourceSha256Before,
    sourceSha256After,
    sourceUnchanged: sourceSha256Before === sourceSha256After,
    definition: {
      deviation: 'hypot(offX, offY) from production throwOffset(f,d), in feet',
      badThrow: 'NOT(bestD < 5.0ft AND bestZ <= 8.5ft) after production launchThrow + stepBall trajectory; not official scoring error',
      badThrowBasis: ['exact inverse of base-wait branch bestD < 5 && bestZ <= 8.5'],
      run: 0,
      runMeaning: 'stationary/balanced release; run penalty intentionally held constant',
      masterSeed,
      prng: 'FNV-1a 32-bit per-cell seed, xorshift32 stream',
      percentile: 'nearest-rank',
      standardDeviation: 'population',
      mlbAnchorPct: 2,
      anchorScope: 'rough infield throwing comparator supplied by owner; 210ft and acc40 are not treated as average infield throws',
    },
    trialsPerCell,
    totalTrials: trialsPerCell * rows.length,
    allCellsAtLeast1000: rows.every(row => row.trials >= 1000),
    allLaunchesFinite: rows.every(row => row.finiteLaunches === row.trials),
    rows,
  };
}

if (require.main === module && process.argv.includes('--phase4-throw-stats')) {
  const result = runPhase4ThrowOffsetStats();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.sourceUnchanged || !result.allCellsAtLeast1000 || !result.allLaunchesFinite) process.exitCode = 1;
}



// 工程4: 9回×10試合の水準比較（b0804-33 / b0805-06）。
// 既存の bootGameInVm / readFrozenOldBytes / readFrozenTargetBytes / crypto / vm を利用する追記用segment。
const phase4GameLevelVmInstall = String.raw`
(function(){
  function mulberry32(seed){
    let a=seed>>>0;
    return function(){
      a=(a+0x6D2B79F5)>>>0;
      let t=a;
      t=Math.imul(t^(t>>>15),t|1);
      t^=t+Math.imul(t^(t>>>7),t|61);
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }
  function clone(x){ return JSON.parse(JSON.stringify(x)); }
  function freshCounters(){
    return [0,1].map(()=>({pa:0,h:0,bb:0,errorReach:0,groundBalls:0,groundHits:0,strikeouts:0}));
  }
  let C=freshCounters(), pending=null, regulation=null;
  const origFinishPlay=finishPlay;
  finishPlay=function(res){
    const team=battingTeam();
    const isErrorReach=!!(S.errorBy && res.hit);
    pending={team,h:(!isErrorReach&&!!res.hit)?1:0,bb:0,
      errorReach:(isErrorReach&&(res.out||0)===0)?1:0,
      ground:(!!ball&&ball.maxZ<7)?1:0,
      groundHit:(!isErrorReach&&!!res.hit&&!!ball&&ball.maxZ<7)?1:0,strikeout:0};
    return origFinishPlay(res);
  };
  const origForcedWalk=forcedWalk;
  forcedWalk=function(){
    pending={team:battingTeam(),h:0,bb:1,errorReach:0,ground:0,groundHit:0,strikeout:0};
    return origForcedWalk();
  };
  const origNextBatter=nextBatter;
  nextBatter=function(){
    const team=battingTeam();
    let p=pending;
    if(!p||p.team!==team){
      p={team,h:0,bb:0,errorReach:0,ground:0,groundHit:0,
        strikeout:(S.lastPlay==='三振'?1:0)};
    }
    const c=C[team];
    c.pa++; c.h+=p.h; c.bb+=p.bb; c.errorReach+=p.errorReach;
    c.groundBalls+=p.ground; c.groundHits+=p.groundHit; c.strikeouts+=p.strikeout;
    pending=null;
    return origNextBatter();
  };
  function snapshot(){
    return {inning:S.inning,half:S.half,score:[total(0),total(1)],hits:S.hits.slice(),
      errors:S.errors.slice(),counters:clone(C)};
  }
  const origEndHalf=endHalf;
  endHalf=function(){
    if(S.inning===9&&S.half===1&&!regulation) regulation=snapshot();
    return origEndHalf();
  };
  const origGameOver=gameOver;
  gameOver=function(){
    if(S.inning<=9&&!regulation) regulation=snapshot();
    return origGameOver();
  };
  globalThis.__phase4GameLevelRun=function(seed,index){
    Math.random=mulberry32(seed); C=freshCounters(); pending=null; regulation=null;
    isPlayerBatting=()=>false; DIFF_I=1; newGame();
    let frames=0,aimPitches=0; const maxFrames=2500000;
    while(!S.over&&frames<maxFrames){
      if(S.phase==='aimPitch'){
        const ch=cpuChoosePitch(); launchPitch(ch.type,ch.nx,ch.ny); aimPitches++;
      }
      update(1/60); frames++;
    }
    if(!S.over) throw new Error('game did not finish index='+index+' phase='+S.phase+' inning='+S.inning+' half='+S.half);
    if(!regulation) regulation=snapshot();
    return {index,seed:seed>>>0,build:BUILD,frames,aimPitches,
      final:{inning:S.inning,half:S.half,score:[total(0),total(1)],hits:S.hits.slice(),
        errors:S.errors.slice(),counters:clone(C)},regulation,extended:S.inning>9};
  };
})()
`;

function phase4GameLevelSum(values){ return values.reduce((a,b)=>a+b,0); }
function phase4GameLevelMean(values){ return phase4GameLevelSum(values)/values.length; }
function phase4GameLevelSd(values){
  const m=phase4GameLevelMean(values);
  return Math.sqrt(phase4GameLevelSum(values.map(x=>(x-m)**2))/(values.length-1));
}
function phase4GameLevelLogGamma(z){
  const c=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,
    12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  if(z<0.5) return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-phase4GameLevelLogGamma(1-z);
  z-=1; let x=0.99999999999980993;
  for(let i=0;i<c.length;i++) x+=c[i]/(z+i+1);
  const t=z+c.length-0.5;
  return 0.5*Math.log(2*Math.PI)+(z+0.5)*Math.log(t)-t+Math.log(x);
}
function phase4GameLevelBetaCf(a,b,x){
  const maxIt=200,eps=3e-14,fpmin=1e-300;
  let qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap;
  if(Math.abs(d)<fpmin)d=fpmin; d=1/d; let h=d;
  for(let m=1;m<=maxIt;m++){
    const m2=2*m;
    let aa=m*(b-m)*x/((qam+m2)*(a+m2));
    d=1+aa*d;if(Math.abs(d)<fpmin)d=fpmin;c=1+aa/c;if(Math.abs(c)<fpmin)c=fpmin;d=1/d;h*=d*c;
    aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));
    d=1+aa*d;if(Math.abs(d)<fpmin)d=fpmin;c=1+aa/c;if(Math.abs(c)<fpmin)c=fpmin;d=1/d;
    const del=d*c;h*=del;if(Math.abs(del-1)<eps)break;
  }
  return h;
}
function phase4GameLevelRegBeta(x,a,b){
  if(x<=0)return 0;if(x>=1)return 1;
  const bt=Math.exp(phase4GameLevelLogGamma(a+b)-phase4GameLevelLogGamma(a)-phase4GameLevelLogGamma(b)+a*Math.log(x)+b*Math.log(1-x));
  return x<(a+1)/(a+b+2)?bt*phase4GameLevelBetaCf(a,b,x)/a:1-bt*phase4GameLevelBetaCf(b,a,1-x)/b;
}
function phase4GameLevelTPValue(t,df){
  return phase4GameLevelRegBeta(df/(df+t*t),df/2,0.5);
}
function phase4GameLevelErf(x){
  const sign=x<0?-1:1,a=Math.abs(x),t=1/(1+0.3275911*a);
  const y=1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-0.284496736)*t+0.254829592)*t)*Math.exp(-a*a);
  return sign*y;
}
function phase4GameLevelNormalP(z){ return 1-phase4GameLevelErf(Math.abs(z)/Math.SQRT2); }
function phase4GameLevelPaired(oldValues,newValues){
  const diff=newValues.map((x,i)=>x-oldValues[i]),md=phase4GameLevelMean(diff),sd=phase4GameLevelSd(diff);
  const se=sd/Math.sqrt(diff.length),t=sd===0?0:md/se,t975=2.262157;
  return {oldMean:phase4GameLevelMean(oldValues),newMean:phase4GameLevelMean(newValues),
    meanDifference:md,ci95:[md-t975*se,md+t975*se],t,df:diff.length-1,
    pTwoSided:phase4GameLevelTPValue(t,diff.length-1),dz:sd===0?(md===0?0:null):md/sd,
    significant95:Math.abs(md)>t975*se,differences:diff};
}
function phase4GameLevelWilson(k,n,z=1.959964){
  if(!n)return[null,null];const p=k/n,z2=z*z,d=1+z2/n,c=(p+z2/(2*n))/d;
  const h=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n))/d;return[c-h,c+h];
}
function phase4GameLevelRateTest(oldK,oldN,newK,newN){
  const p0=oldK/oldN,p1=newK/newN,p=(oldK+newK)/(oldN+newN);
  const z=(p1-p0)/Math.sqrt(p*(1-p)*(1/oldN+1/newN));
  return {oldRate:p0,newRate:p1,difference:p1-p0,z,pTwoSided:phase4GameLevelNormalP(z),
    cohenH:2*Math.asin(Math.sqrt(p1))-2*Math.asin(Math.sqrt(p0))};
}
function phase4GameLevelAggregate(version){
  const games=version.games.map(g=>g.regulation);
  const teams=[0,1].map(team=>{
    const cs=games.map(g=>g.counters[team]);
    const pa=phase4GameLevelSum(cs.map(c=>c.pa)),h=phase4GameLevelSum(cs.map(c=>c.h));
    const bb=phase4GameLevelSum(cs.map(c=>c.bb)),er=phase4GameLevelSum(cs.map(c=>c.errorReach));
    const gb=phase4GameLevelSum(cs.map(c=>c.groundBalls)),gh=phase4GameLevelSum(cs.map(c=>c.groundHits));
    return {pa,h,bb,errorReach:er,obp:(h+bb)/pa,obpWilson95:phase4GameLevelWilson(h+bb,pa),
      reachRate:(h+bb+er)/pa,groundBalls:gb,groundHits:gh,groundHitRate:gh/gb,
      groundHitWilson95:phase4GameLevelWilson(gh,gb),runsPerGame:phase4GameLevelMean(games.map(g=>g.score[team])),
      runsByGame:games.map(g=>g.score[team]),paByGame:cs.map(c=>c.pa),onBaseByGame:cs.map(c=>c.h+c.bb),
      groundHitRateByGame:cs.map(c=>c.groundHits/c.groundBalls)};
  });
  return {teams,extensions:version.games.filter(g=>g.extended).length};
}
function phase4GameLevelRunVersion(html,label){
  const context=bootGameInVm(html,label);
  vm.runInContext(phase4GameLevelVmInstall,context,{filename:label+'-phase4-game-level-install.js',timeout:30000});
  const games=[];
  for(let i=0;i<10;i++){
    const seed=(0x5A170805+Math.imul(i,0x9E3779B9))>>>0;
    games.push(vm.runInContext(`__phase4GameLevelRun(${seed},${i})`,context,{filename:label+'-game-'+i+'.js',timeout:240000}));
  }
  return {label,build:vm.runInContext('BUILD',context),games};
}
function runPhase4GameLevels(){
  const oldBefore=readFrozenOldBytes(),targetBefore=readFrozenTargetBytes();
  const old=phase4GameLevelRunVersion(oldBefore.toString('utf8'),'phase4-old-b0804-33');
  const target=phase4GameLevelRunVersion(targetBefore.toString('utf8'),'phase4-target-b0805-06');
  const oldAgg=phase4GameLevelAggregate(old),targetAgg=phase4GameLevelAggregate(target);
  const comparison=[0,1].map(team=>({team,
    runs:phase4GameLevelPaired(oldAgg.teams[team].runsByGame,targetAgg.teams[team].runsByGame),
    pa:phase4GameLevelPaired(oldAgg.teams[team].paByGame,targetAgg.teams[team].paByGame),
    onBaseEvents:phase4GameLevelPaired(oldAgg.teams[team].onBaseByGame,targetAgg.teams[team].onBaseByGame),
    obp:phase4GameLevelRateTest(oldAgg.teams[team].h+oldAgg.teams[team].bb,oldAgg.teams[team].pa,
      targetAgg.teams[team].h+targetAgg.teams[team].bb,targetAgg.teams[team].pa),
    groundHitRate:phase4GameLevelRateTest(oldAgg.teams[team].groundHits,oldAgg.teams[team].groundBalls,
      targetAgg.teams[team].groundHits,targetAgg.teams[team].groundBalls),
    groundHitRateByGame:phase4GameLevelPaired(oldAgg.teams[team].groundHitRateByGame,
      targetAgg.teams[team].groundHitRateByGame)}));
  const oldCombinedGround=old.games.map(g=>{
    const cs=g.regulation.counters;return(cs[0].groundHits+cs[1].groundHits)/(cs[0].groundBalls+cs[1].groundBalls);
  });
  const targetCombinedGround=target.games.map(g=>{
    const cs=g.regulation.counters;return(cs[0].groundHits+cs[1].groundHits)/(cs[0].groundBalls+cs[1].groundBalls);
  });
  const oldAfter=readFrozenOldBytes(),targetAfter=readFrozenTargetBytes();
  return {
    protocol:{gamesPerVersion:10,dt:1/60,seedBase:'0x5A170805',seedStride:'0x9E3779B9',prng:'mulberry32',
      batting:'CPU-vs-CPU; team0 existing all-100 lineup; team1 existing CPU lineup; DIFF_I=1',
      pitching:'each aimPitch: cpuChoosePitch then launchPitch',runningAndFielding:'no keys; source automatic logic',
      obp:'(H+BB)/PA; HBP/catcher interference/sac fly have no dedicated mechanism; error reach excluded',
      groundBall:'official PA ending through finishPlay with ball.maxZ<7ft; error reach excluded from ground hits'},
    sha256:{oldBefore:crypto.createHash('sha256').update(oldBefore).digest('hex').toUpperCase(),
      oldAfter:crypto.createHash('sha256').update(oldAfter).digest('hex').toUpperCase(),
      targetBefore:crypto.createHash('sha256').update(targetBefore).digest('hex').toUpperCase(),
      targetAfter:crypto.createHash('sha256').update(targetAfter).digest('hex').toUpperCase()},
    old:{build:old.build,aggregate:oldAgg,games:old.games},target:{build:target.build,aggregate:targetAgg,games:target.games},
    comparison,combinedGroundHitRateByGame:phase4GameLevelPaired(oldCombinedGround,targetCombinedGround),
    integrity:{oldHitsMatch:old.games.every(g=>[0,1].every(t=>g.regulation.hits[t]===g.regulation.counters[t].h)),
      targetHitsMatch:target.games.every(g=>[0,1].every(t=>g.regulation.hits[t]===g.regulation.counters[t].h)),
      oldTenRegulationGames:old.games.length===10&&old.games.every(g=>g.final.inning===9&&!g.extended),
      targetTenRegulationGames:target.games.length===10&&target.games.every(g=>g.final.inning===9&&!g.extended)},
    anchors:{team0RunsPerGame:9.3,team1RunsPerGame:2.5,groundHitRate:0.29}
  };
}

if(require.main===module&&process.argv.includes('--phase4-game-levels')){
  const result=runPhase4GameLevels();
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
  if(!Object.values(result.integrity).every(Boolean)) process.exitCode=1;
}
// 工程4: 守備追跡効率1000打球 + 実けん制1500試行（固定 b0805-06）
const PHASE4_TRACKING_PICKOFF_EXPERIMENT = String.raw`
(() => {
  const originalRandom = Math.random;
  function rngFrom(seed){
    let x=(seed>>>0)||0x6d2b79f5;
    return function(){ x^=x<<13; x^=x>>>17; x^=x<<5; return (x>>>0)/4294967296; };
  }
  function quantile(a,p){
    if(!a.length) return null;
    const s=a.slice().sort((x,y)=>x-y), z=(s.length-1)*p, lo=Math.floor(z), hi=Math.ceil(z);
    return s[lo]+(s[hi]-s[lo])*(z-lo);
  }
  function stats(a){
    if(!a.length) return {n:0,min:null,p25:null,median:null,p75:null,p90:null,p95:null,p99:null,max:null,mean:null};
    return {n:a.length,min:Math.min(...a),p25:quantile(a,.25),median:quantile(a,.5),p75:quantile(a,.75),
      p90:quantile(a,.9),p95:quantile(a,.95),p99:quantile(a,.99),max:Math.max(...a),mean:a.reduce((x,y)=>x+y,0)/a.length};
  }
  function roundObj(o){
    if(Array.isArray(o)) return o.map(roundObj);
    if(o&&typeof o==='object'){ const z={}; for(const [k,v] of Object.entries(o)) z[k]=roundObj(v); return z; }
    return typeof o==='number'&&Number.isFinite(o)?+o.toFixed(6):o;
  }
  function runTracking(seed,need,maxAttempts){
    const rand=rngFrom(seed); Math.random=rand;
    const ratios=[], extras=[], changeRatios=[], byKind={}, changedTrials=[], routeExamples=[];
    const primaryHistory748=[], targetHistory748=[];
    let attempts=0, eligible=0, nearZero=0, noFielding=0, incomplete=0, fenceIncluded=0, uncaughtIncluded=0, totalChanges=0;
    while(eligible<need && attempts<maxAttempts){
      attempts++; newGame(); S.outs=0; S.bases=[null,null,null]; S.playClock=0;
      const contact={exit:45+65*rand(),la:-20+75*rand(),spray:-43+86*rand(),q:.15+.80*rand()};
      startFlight(contact,1,[0,2.5,1.4]);
      if(attempts===748){
        primaryHistory748.push({frame:0,t:ball.t,primary:ball.primary&&ball.primary.n});
        const rf=fielders.find(f=>f.n==='右');
        targetHistory748.push({frame:0,t:ball.t,target:{x:rf.tx,y:rf.ty}});
      }
      const start=fielders.map(f=>({x:f.cx,y:f.cy})), prev=fielders.map(f=>({x:f.cx,y:f.cy})), travel=fielders.map(()=>0);
      let primary=ball&&ball.primary, changes=0, touchedFence=false;
      for(let frame=0;frame<1500 && S.phase==='flight';frame++){
        update(1/60);
        fielders.forEach((f,i)=>{ travel[i]+=Math.hypot(f.cx-prev[i].x,f.cy-prev[i].y); prev[i]={x:f.cx,y:f.cy}; });
        if(ball&&(ball.wallHit||ball.fenceHit||ball.hitWall)) touchedFence=true;
        const now=ball&&ball.primary;
        if(now&&primary&&now!==primary){
          const oldD=Math.hypot(primary.cx-ball.x,primary.cy-ball.y), newD=Math.hypot(now.cx-ball.x,now.cy-ball.y);
          changeRatios.push(oldD>1e-9?newD/oldD:null); totalChanges++; changes++;
          if(attempts===748) primaryHistory748.push({frame:frame+1,t:ball.t,primary:now.n});
        }
        if(now) primary=now;
        if(attempts===748){
          const rf=fielders.find(f=>f.n==='右'),last=targetHistory748[targetHistory748.length-1];
          if(!last||Math.hypot(rf.tx-last.target.x,rf.ty-last.target.y)>.01)
            targetHistory748.push({frame:frame+1,t:ball.t,target:{x:rf.tx,y:rf.ty},pos:{x:rf.cx,y:rf.cy},
              ball:{x:ball.x,y:ball.y,z:ball.z}});
        }
      }
      if(S.phase==='flight'){ incomplete++; continue; }
      const handler=(throwPlay&&throwPlay.thrower&&fielders.includes(throwPlay.thrower))?throwPlay.thrower:
        (ball&&ball.primary&&fielders.includes(ball.primary)&&throwPlay?ball.primary:null);
      if(!handler){ noFielding++; continue; }
      const idx=fielders.indexOf(handler), straight=Math.hypot(handler.cx-start[idx].x,handler.cy-start[idx].y);
      const kind=(throwPlay&&throwPlay.kind)||'unknown'; byKind[kind]=(byKind[kind]||0)+1; eligible++;
      if(touchedFence) fenceIncluded++;
      if(throwPlay&&throwPlay.kind==='outfield'&&ball&&ball.landed) uncaughtIncluded++;
      if(changes>0) changedTrials.push(changes);
      if(straight<1.0){ nearZero++; continue; }
      const routeRatio=travel[idx]/straight; ratios.push(routeRatio);
      routeExamples.push({attempt:attempts,routeRatio,handler:handler.n,kind,travel:travel[idx],straight,changes,contact,
        start:start[idx],end:{x:handler.cx,y:handler.cy},ball:ball?{x:ball.x,y:ball.y,z:ball.z,t:ball.t,landed:ball.landed}:null});
      extras.push(travel[idx]-straight);
    }
    const finite=changeRatios.filter(Number.isFinite);
    return roundObj({seed,attempts,eligible,ratioEligible:ratios.length,nearZero,noFielding,incomplete,fenceIncluded,uncaughtIncluded,byKind,
      routeRatio:stats(ratios),extraDistanceFt:stats(extras),
      thresholds:{gt1_05:ratios.filter(x=>x>1.05).length,gt1_10:ratios.filter(x=>x>1.10).length,
        gt1_25:ratios.filter(x=>x>1.25).length,gt1_50:ratios.filter(x=>x>1.50).length,gt2:ratios.filter(x=>x>2).length},
      assignment:{trialsWithChange:changedTrials.length,trialChangeRate:eligible?changedTrials.length/eligible:null,totalChanges,
        changesPerChangedTrial:stats(changedTrials),newToOldBallDistanceRatio:stats(finite),newCloser:finite.filter(x=>x<1).length,
        newFartherOrEqual:finite.filter(x=>x>=1).length},
      worstRouteExamples:routeExamples.sort((a,b)=>b.routeRatio-a.routeRatio).slice(0,15),
      worstExtraExamples:routeExamples.sort((a,b)=>(b.travel-b.straight)-(a.travel-a.straight)).slice(0,10),
      primaryHistory748,targetHistory748,
      contactSampling:{exit:[45,110],la:[-20,55],spray:[-43,43],q:[.15,.95]},
      exclusions:{straightDistanceLtFt:1,noFielding:'HR/foul/no fielder processing',maxSeconds:25}});
  }
  function runPickoff(seed,n){
    const rand=rngFrom(seed); Math.random=rand;
    const fresh=()=>({刺殺:0,帰塁:0,中止:0,悪送球:0,未分類:0});
    const counts=fresh(),byBase={1:fresh(),2:fresh(),3:fresh()},byTeam={0:fresh(),1:fresh()},times=[];
    let timeouts=0;
    for(let i=0;i<n;i++){
      newGame();
      const base=1+Math.floor(rand()*3),lead=.16+.16*rand(),sp=18+12*rand(),defensiveTeam=rand()<.5?0:1;
      S.half=1-defensiveTeam; S.outs=0; S.bases=[null,null,null]; S.bases[base-1]={id:i+1,sp};
      fielders=buildFielders(defensiveTeam); resetFielders();
      runners=[{p:base+lead,goal:base+lead,autoGoal:base+lead,extra:0,origin:base,sp,jumped:true,v:sp*.5,cmd:null,out:false}];
      const target=runners[0];
      S.phase='windup'; S.playClock=0; S.throwCount=0; S.preOuts=0; S.outOrder=[]; S.errorBy=null; S.over=false;
      beginPickoff();
      let launched=false,bad=false,elapsed=0;
      for(let frame=0;frame<2100;frame++){
        const T=throwPlay;
        if(T){ if(['fly','catch','approach','rundown'].includes(T.stage)) launched=true; if(T.sailed||T.chased) bad=true; }
        if(S.errorBy) bad=true;
        if(['play','msg','windup','over'].includes(S.phase)) break;
        update(1/60); elapsed+=1/60;
      }
      if(elapsed>=35-1/60) timeouts++;
      const done=['play','msg','windup','over'].includes(S.phase);
      let category=launched&&bad?'悪送球':target.out?'刺殺':(!launched&&done)?'中止':
        (launched&&!target.out&&Math.abs(target.p-base)<=.05&&done)?'帰塁':'未分類';
      counts[category]++; byBase[base][category]++; byTeam[defensiveTeam][category]++; times.push(elapsed);
    }
    const rates={}; for(const [k,v] of Object.entries(counts)) rates[k]=v/n;
    return roundObj({seed,trials:n,counts,rates,unclassified:counts.未分類,timeouts,byBase,byDefensiveTeam:byTeam,
      elapsedSeconds:stats(times),sampling:{base:'uniform 1,2,3',leadBases:[.16,.32],leadFt:[14.4,28.8],
        speedFtPerSec:[18,30],defensiveTeam:'uniform Team0/Team1',layout:'standard; runner on third and <2 outs uses built-in 78% infield depth'},
      classificationPriority:['悪送球','刺殺','中止','帰塁','未分類'],
      badThrowOracle:'launched and any of throwPlay.sailed / throwPlay.chased / S.errorBy'});
  }
  try { return {build:BUILD,tracking:runTracking(__TRACK_SEED__,1000,3000),pickoff:runPickoff(__PICK_SEED__,1500)}; }
  finally { Math.random=originalRandom; }
})()
`;

function runPhase4TrackingPickoffStatistics() {
  const expected='2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183';
  const before=readFrozenTargetBytes(), beforeSha=crypto.createHash('sha256').update(before).digest('hex').toUpperCase();
  const context=bootGameInVm(before.toString('utf8'),'phase4 b0805-06');
  const seedOf=s=>crypto.createHash('sha256').update(s).digest().readUInt32BE(0);
  const trackLabel='SOL-ULTRA-P4-TRACK-20260805',pickLabel='SOL-ULTRA-P4-PICKOFF-20260805';
  const code=PHASE4_TRACKING_PICKOFF_EXPERIMENT
    .replace('__TRACK_SEED__',String(seedOf(trackLabel))).replace('__PICK_SEED__',String(seedOf(pickLabel)));
  const result=vm.runInContext(code,context,{filename:'phase4-tracking-pickoff.js',timeout:600000});
  const after=readFrozenTargetBytes(),afterSha=crypto.createHash('sha256').update(after).digest('hex').toUpperCase();
  result.tracking.seedLabel=trackLabel; result.tracking.seed32=seedOf(trackLabel);
  result.pickoff.seedLabel=pickLabel; result.pickoff.seed32=seedOf(pickLabel);
  result.targetSha256Before=beforeSha; result.targetSha256After=afterSha;
  result.shaGuard=beforeSha===expected&&afterSha===expected;
  return result;
}

function reproPhase4RouteDetour() {
  const r=runPhase4TrackingPickoffStatistics();
  return {build:r.build,shaGuard:r.shaGuard,distribution:r.tracking.routeRatio,extraDistanceFt:r.tracking.extraDistanceFt,
    thresholds:r.tracking.thresholds,worstRatio:r.tracking.worstRouteExamples[0],worstExtra:r.tracking.worstExtraExamples[0],
    primaryHistory:r.tracking.primaryHistory748,targetHistory:r.tracking.targetHistory748};
}

function reproPhase4PickoffCancellationDominance() {
  const r=runPhase4TrackingPickoffStatistics();
  return {build:r.build,shaGuard:r.shaGuard,trials:r.pickoff.trials,counts:r.pickoff.counts,
    rates:r.pickoff.rates,byBase:r.pickoff.byBase,unclassified:r.pickoff.unclassified,timeouts:r.pickoff.timeouts};
}

if(require.main===module&&process.argv.includes('--phase4-tracking-pickoff')){
  const r=runPhase4TrackingPickoffStatistics();
  process.stdout.write(JSON.stringify(r,null,2)+'\n');
  if(!r.shaGuard||r.tracking.eligible<1000||r.pickoff.trials<1000||r.pickoff.unclassified!==0) process.exitCode=1;
}
function reproPhase4SecondBasePickoffAlwaysCancels() {
  const r=runPhase4TrackingPickoffStatistics(),x=r.pickoff.byBase[2];
  return {build:r.build,shaGuard:r.shaGuard,seedLabel:r.pickoff.seedLabel,seed32:r.pickoff.seed32,
    base:2,trials:Object.values(x).reduce((a,b)=>a+b,0),counts:x,
    allCancelled:x.中止===Object.values(x).reduce((a,b)=>a+b,0),unclassified:r.pickoff.unclassified,timeouts:r.pickoff.timeouts};
}




// 所見21専用の再現入口。統計本体は同一seedで再計算する。
function reproFinding21RouteDetour() {
  return reproPhase4RouteDetour();
}

// 所見22専用の再現入口。二塁488/488中止を全1500試行の内訳と同時に再計算する。
function reproFinding22PickoffCancellation() {
  const r = runPhase4TrackingPickoffStatistics();
  const second = r.pickoff.byBase[2];
  const secondTrials = Object.values(second).reduce((sum, value) => sum + value, 0);
  return {
    build: r.build,
    shaGuard: r.shaGuard,
    overall: { trials: r.pickoff.trials, counts: r.pickoff.counts, rates: r.pickoff.rates },
    secondBase: { trials: secondTrials, counts: second, allCancelled: second.中止 === secondTrials },
    unclassified: r.pickoff.unclassified,
    timeouts: r.pickoff.timeouts,
  };
}
// 工程5: 正本ハーネスの変異監査（統合用segment）
// - --phase5-mutation-plan は固定10変異の照合・計画出力だけ。ハーネスを起動しない。
// - --phase5-harness-child / --phase5-mutation-audit は事前表保存後にだけ実行する。
// - 変異HTMLはメモリ内だけに作り、ファイルへ書かない。
(function phase5MutationAuditSegment(){
  'use strict';

  const p5fs = typeof fs !== 'undefined' ? fs : require('fs');
  const p5path = typeof path !== 'undefined' ? path : require('path');
  const p5vm = typeof vm !== 'undefined' ? vm : require('vm');
  const p5child = typeof childProcess !== 'undefined' ? childProcess : require('child_process');
  const p5crypto = typeof crypto !== 'undefined' && typeof crypto.createHash === 'function'
    ? crypto : require('crypto');

  const P5_TARGET_COMMIT = '2c9bd8012cd23702ca74bf656adf09068ca067de';
  const P5_TARGET_BLOB_SPEC = `${P5_TARGET_COMMIT}:野球ゲーム/baseball3d.html`;
  const P5_TARGET_SHA256 = '2A76B386CE79BFF5612DD1A04E9A8DBF56656705C918545FC9559AC9E151C183';
  const P5_HARNESS_SHA256 = '8C4EF06D934C68A4993F27B3139AF1EEF317BA237A00287A05466CCA5EDE85F8';
  const P5_DEFAULT_WORKSPACE = 'C:\\Users\\amila\\Desktop\\Claude Code';
  const P5_DEFAULT_REVIEW_DIR = p5path.join(P5_DEFAULT_WORKSPACE, '野球ゲーム');
  const P5_REVIEW_DIR = typeof REVIEW_DIR !== 'undefined' ? REVIEW_DIR : P5_DEFAULT_REVIEW_DIR;
  const P5_WORKSPACE_ROOT = typeof WORKSPACE_ROOT !== 'undefined' ? WORKSPACE_ROOT : P5_DEFAULT_WORKSPACE;
  const P5_TARGET_PATH = typeof TARGET_HTML_PATH !== 'undefined'
    ? TARGET_HTML_PATH : p5path.join(P5_REVIEW_DIR, '_tmp_target_b0805-06.html');
  const P5_HARNESS_PATH = typeof HARNESS_PATH !== 'undefined'
    ? HARNESS_PATH : p5path.join(P5_REVIEW_DIR, '_test_harness_20260804.js');
  const P5_LIVE_IMPLEMENTATION_PATH = p5path.join(P5_REVIEW_DIR, 'baseball3d.html');
  const P5_REQUIRED_SYSTEMS = Object.freeze(Array.from({length:13}, (_, index) => `S-${index+1}`));
  const P5_RANDOM_SEED = 0x71D22228 >>> 0;
  const P5_RANDOM_POLICY = Object.freeze({
    kind:'xorshift32',
    seedHex:'0x71D22228',
    seedUint32:P5_RANDOM_SEED,
    qualificationCandidateIndex:1,
    qualification:'first BASELINE 16/16 from ascending SHA-256 UTF-8 SOL-ULTRA-P5-BASELINE-SEED:<i> candidates',
    reset:'immediately before every child bootGameInVm',
    continuity:'one stream from boot through harness completion; temporary test overrides restore to this stream',
    vmOverwrite:false,
  });

  function p5Sha256(value){
    return p5crypto.createHash('sha256').update(value).digest('hex').toUpperCase();
  }

  function p5Replacement(expectedLine, needle, replacement, rationale){
    return Object.freeze({expectedLine, needle, replacement, rationale});
  }

  const P5_MUTATION_SPECS = Object.freeze([
    Object.freeze({
      id:'M01', systems:Object.freeze(['S-1','S-7']),
      title:'時間切れgraceと実位置得点判定を同時に旧仕様へ戻す',
      bugIntent:'塁間・キー押下・空中球でも12秒で閉じ、本塁未到達でもgoalだけで得点させる。',
      inactive:'12秒判定に到達しないプレー、および得点候補走者がいないプレーでは発動しない。',
      replacements:Object.freeze([
        p5Replacement(1885,
          'if(S.playClock > (inRundown?24:12) + grace){',
          'if(S.playClock > (inRundown?24:12)){',
          'grace8秒を消す'),
        p5Replacement(2598,
          'if(r.p>=3.97){ r.goal=4; if(!timePlay || timePlay.includes(r)) runs++; return; }',
          'if(r.goal>=3.97){ r.goal=4; if(!timePlay || timePlay.includes(r)) runs++; return; }',
          '本塁実到達pではなく目標goalで得点させる'),
      ]),
    }),
    Object.freeze({
      id:'M02', systems:Object.freeze(['S-2']),
      title:'全送球速度を30%過大化する',
      bugIntent:'送球所要時間と到達高さを現行較正から外し、旧来の過高速送球を戻す。',
      inactive:'送球が発生しない打球・プレーでは発動しない。',
      replacements:Object.freeze([
        p5Replacement(1469,
          'return (106 + 58*(arm-0.55)) * eff;',
          'return (106 + 58*(arm-0.55)) * eff * 1.30;',
          'throwSpeedの返値を1.30倍する'),
      ]),
    }),
    Object.freeze({
      id:'M03', systems:Object.freeze(['S-3']),
      title:'0.2秒未満の初回接地を着地扱いしない',
      bugIntent:'叩きつけた打球の最初のバウンドを無視し、跳ね上がりを空中捕球可能に戻す。',
      inactive:'接地が0.2秒以後の打球では発動しない。',
      replacements:Object.freeze([
        p5Replacement(2807,
          'if(ball.z<=0.02) ball.landed=true;',
          'if(ball.z<=0.02 && ball.t>0.2) ball.landed=true;',
          '着地に旧t>0.2門番を戻す'),
      ]),
    }),
    Object.freeze({
      id:'M04', systems:Object.freeze(['S-4','S-5']),
      title:'カバー到着時刻を判断と実送球待ちの両方から消す',
      bugIntent:'カバー野手が未到着でも即座に塁上プレー可能と見なし、空の塁への送球を許す。',
      inactive:'本塁P、または受け手が既に塁へ到着済みでcoverArrival=0の場面では差が出ない。',
      replacements:Object.freeze([
        p5Replacement(1520,
          [
            'function coverArrival(b, thrower){',
            "  if(b==='P') return 0;",
            '  const p=throwPoint(b);',
            '  let best=99;',
            '  fielders.forEach(f=>{',
            '    if(f.coverBase!==b && f!==thrower) return;',
            '    const d=Math.hypot(p[0]-f.cx, p[1]-f.cy);',
            '    const t = d<2 ? 0 : F_REACT*0.4 + runTime(f.sp*0.88, d);',
            '    if(t<best) best=t;',
            '  });',
            '  return best;',
            '}',
          ].join('\n'),
          [
            'function coverArrival(b, thrower){',
            "  if(b==='P') return 0;",
            '  const p=throwPoint(b);',
            '  let best=99;',
            '  fielders.forEach(f=>{',
            '    if(f.coverBase!==b && f!==thrower) return;',
            '    const d=Math.hypot(p[0]-f.cx, p[1]-f.cy);',
            '    const t = d<2 ? 0 : F_REACT*0.4 + runTime(f.sp*0.88, d);',
            '    if(t<best) best=t;',
            '  });',
            '  return 0;',
            '}',
          ].join('\n'),
          'coverArrival関数の一意文脈内でreturn bestだけをreturn 0へ戻す'),
      ]),
    }),
    Object.freeze({
      id:'M05', systems:Object.freeze(['S-6']),
      title:'挟殺のgoal再設定ごとに速度を常時ゼロ化する',
      bugIntent:'向きが変わっていなくても毎tick加速を取り上げ、走者を不自然に減速させる。',
      inactive:'挟殺chase経路以外、またはgoal再設定へ入らない場面では発動しない。',
      replacements:Object.freeze([
        p5Replacement(2313,
          'if(r.goal!==gBefore) r.v=0;',
          'r.v=0;',
          '向きが変わった時だけの条件を消す'),
      ]),
    }),
    Object.freeze({
      id:'M06', systems:Object.freeze(['S-8','S-13']),
      title:'踏み切り済み判定を常にfalseへ戻す',
      bugIntent:'0.35塁以上進んだ走者も捕球時に元塁へ戻し、goal反転と再照準徴収を再発させる。',
      inactive:'origin=0、0.35塁未満、外野打球、封殺、または2死では現行committed門番との差が出ない。',
      replacements:Object.freeze([
        p5Replacement(1798,
          'const committed = (r.origin>0 && r.p - r.origin >= 0.35);',
          'const committed = false;',
          '踏み切り済み判定を無効化する'),
      ]),
    }),
    Object.freeze({
      id:'M07', systems:Object.freeze(['S-9']),
      title:'走行中送球のずれ係数を旧0.028へ戻す',
      bugIntent:'追走後の送球ずれを過大化し、非常にそれる送球を増やす。',
      inactive:'f.run=0の静止送球では係数差が発動しない。',
      replacements:Object.freeze([
        p5Replacement(1489,
          'const sigma = d*(0.004 + 0.016*(100-acc)/100 + 0.012*run);',
          'const sigma = d*(0.004 + 0.016*(100-acc)/100 + 0.028*run);',
          'run係数を0.012から旧0.028へ戻す'),
      ]),
    }),
    Object.freeze({
      id:'M08', systems:Object.freeze(['S-10']),
      title:'担当交代のapproaching門番を無効化する',
      bugIntent:'球が現担当へ近づいている最中でも、距離だけで別野手へ担当交代させる。',
      inactive:'担当との距離がCATCH_R+3以下、またはplanPlayが同じ担当を返す場面では交代しない。',
      replacements:Object.freeze([
        p5Replacement(2843,
          'const approaching = (ball.vx*(prim.cx-ball.x) + ball.vy*(prim.cy-ball.y)) > 0;',
          'const approaching = false;',
          'approaching門番を常にfalseへ戻す'),
      ]),
    }),
    Object.freeze({
      id:'M09', systems:Object.freeze(['S-11']),
      title:'守備カメラの線際回り込み角をゼロへ戻す',
      bugIntent:'線際打球でも正面寄りのカメラに固定し、ポールや観客席による遮蔽を戻す。',
      inactive:'fieldViewでない場面、またはside=0の正面打球では現行angとの差が出ない。',
      replacements:Object.freeze([
        p5Replacement(3527,
          'const ang = side*(0.42+0.55*lineHug)*(0.35+0.65*far);',
          'const ang = 0;',
          '線際カメラ角を0へ戻す'),
      ]),
    }),
    Object.freeze({
      id:'M10', systems:Object.freeze(['S-12']),
      title:'野手の加速時間を旧0.80秒へ戻す',
      bugIntent:'野手が最高速へ達するまでを過短化し、守備移動を再び速すぎる状態へ戻す。',
      inactive:'野手が移動しない場面、またはrunTimeを使わない移動では発動しない。',
      replacements:Object.freeze([
        p5Replacement(885,
          'const F_REACT = 0.28, ACC_T = 1.90, ACC_F = 1.15;',
          'const F_REACT = 0.28, ACC_T = 1.90, ACC_F = 0.80;',
          'ACC_Fを旧0.80へ戻す'),
      ]),
    }),
  ]);

  function p5Canonicalize(value){
    if(Array.isArray(value)) return value.map(p5Canonicalize);
    if(value && typeof value === 'object'){
      const result={};
      for(const key of Object.keys(value).sort()) result[key]=p5Canonicalize(value[key]);
      return result;
    }
    return value;
  }

  function p5NormalizedPlan(){
    return p5Canonicalize({
      schema:'sol-ultra-phase5-mutation-plan-v3',
      target:{commit:P5_TARGET_COMMIT,sha256:P5_TARGET_SHA256},
      harness:{sha256:P5_HARNESS_SHA256,expectedItems:16},
      randomPolicy:P5_RANDOM_POLICY,
      requiredSystems:P5_REQUIRED_SYSTEMS,
      mutations:P5_MUTATION_SPECS.map(spec=>({
        id:spec.id, systems:spec.systems, title:spec.title, bugIntent:spec.bugIntent,
        inactive:spec.inactive,
        replacements:spec.replacements.map(replacement=>({
          expectedLine:replacement.expectedLine,
          needle:replacement.needle,
          replacement:replacement.replacement,
          rationale:replacement.rationale,
        })),
      })),
    });
  }

  function p5PlanSha256(){
    return p5Sha256(Buffer.from(JSON.stringify(p5NormalizedPlan()),'utf8'));
  }

  function p5ReadFrozenTargetBytes(){
    const bytes = typeof readFrozenTargetBytes === 'function'
      ? readFrozenTargetBytes()
      : (p5fs.existsSync(P5_TARGET_PATH)
        ? p5fs.readFileSync(P5_TARGET_PATH)
        : p5child.execFileSync('git',['show',P5_TARGET_BLOB_SPEC],{
          cwd:P5_WORKSPACE_ROOT,encoding:null,maxBuffer:64*1024*1024,
        }));
    const hash=p5Sha256(bytes);
    if(hash!==P5_TARGET_SHA256) throw new Error(`phase5 target SHA mismatch: ${hash}`);
    return Buffer.from(bytes);
  }

  function p5ReadVerifiedHarnessBytes(){
    const bytes = typeof readVerifiedHarnessBytes === 'function'
      ? readVerifiedHarnessBytes() : p5fs.readFileSync(P5_HARNESS_PATH);
    const hash=p5Sha256(bytes);
    if(hash!==P5_HARNESS_SHA256) throw new Error(`phase5 harness SHA mismatch: ${hash}`);
    return Buffer.from(bytes);
  }

  function p5CountOccurrences(source, needle){
    if(!needle) throw new Error('phase5 mutation needle must not be empty');
    let count=0, offset=0;
    while(true){
      const index=source.indexOf(needle,offset);
      if(index<0) break;
      count++;
      offset=index+needle.length;
    }
    return count;
  }

  function p5FirstDifference(left,right){
    const limit=Math.min(left.length,right.length);
    let index=0;
    while(index<limit && left[index]===right[index]) index++;
    return index;
  }

  function p5ValidatePlanAgainstTarget(targetHtml){
    if(P5_MUTATION_SPECS.length!==10) throw new Error(`phase5 needs 10 mutations, got ${P5_MUTATION_SPECS.length}`);
    const ids=P5_MUTATION_SPECS.map(spec=>spec.id);
    if(new Set(ids).size!==ids.length) throw new Error('phase5 mutation IDs are not unique');
    const systems=[...new Set(P5_MUTATION_SPECS.flatMap(spec=>spec.systems))].sort((a,b)=>Number(a.slice(2))-Number(b.slice(2)));
    if(JSON.stringify(systems)!==JSON.stringify(P5_REQUIRED_SYSTEMS)){
      throw new Error(`phase5 system coverage mismatch: ${JSON.stringify(systems)}`);
    }
    const observations=[];
    for(const spec of P5_MUTATION_SPECS){
      const replacementObservations=[];
      for(let order=0;order<spec.replacements.length;order++){
        const item=spec.replacements[order];
        const occurrenceCount=p5CountOccurrences(targetHtml,item.needle);
        if(occurrenceCount!==1) throw new Error(`${spec.id}.${order+1}: expected one occurrence, got ${occurrenceCount}`);
        if(item.needle===item.replacement) throw new Error(`${spec.id}.${order+1}: replacement does not change source`);
        const lineDelta=(item.replacement.match(/\n/g)||[]).length-(item.needle.match(/\n/g)||[]).length;
        if(lineDelta!==0) throw new Error(`${spec.id}.${order+1}: replacement changes line count`);
        const sourceIndex=targetHtml.indexOf(item.needle);
        const firstDifference=p5FirstDifference(item.needle,item.replacement);
        const observedLine=targetHtml.slice(0,sourceIndex+firstDifference).split('\n').length;
        if(observedLine!==item.expectedLine){
          throw new Error(`${spec.id}.${order+1}: expected changed line ${item.expectedLine}, got ${observedLine}`);
        }
        replacementObservations.push({
          order:order+1,expectedLine:item.expectedLine,observedLine,occurrenceCount,
          needleSha256:p5Sha256(Buffer.from(item.needle,'utf8')),
          replacementSha256:p5Sha256(Buffer.from(item.replacement,'utf8')),
          rationale:item.rationale,
        });
      }
      observations.push({id:spec.id,systems:spec.systems,replacements:replacementObservations});
    }
    return {valid:true,mutationCount:P5_MUTATION_SPECS.length,coveredSystems:systems,observations};
  }

  function p5BuildPlanOutput(){
    const targetBytes=p5ReadFrozenTargetBytes();
    const targetHtml=targetBytes.toString('utf8');
    const validation=p5ValidatePlanAgainstTarget(targetHtml);
    return {
      mode:'plan-only-no-harness-execution',
      phase:5,
      target:{commit:P5_TARGET_COMMIT,sha256:p5Sha256(targetBytes),build:'b0805-06'},
      harness:{expectedSha256:P5_HARNESS_SHA256,read:false,executed:false},
      mutationHtmlConstructed:false,
      planSha256:p5PlanSha256(),
      normalizedPlan:p5NormalizedPlan(),
      validation,
      temporaryFilesCreated:[],
    };
  }

  function p5ApplyMutationInMemory(targetHtml,spec){
    let mutated=targetHtml;
    const applied=[];
    for(let order=0;order<spec.replacements.length;order++){
      const item=spec.replacements[order];
      const count=p5CountOccurrences(mutated,item.needle);
      if(count!==1) throw new Error(`${spec.id}.${order+1}: apply expected one occurrence, got ${count}`);
      const index=mutated.indexOf(item.needle);
      const prefix=mutated.slice(0,index);
      const suffix=mutated.slice(index+item.needle.length);
      const next=prefix+item.replacement+suffix;
      if(next.slice(0,index)!==prefix) throw new Error(`${spec.id}.${order+1}: prefix changed`);
      if(next.slice(index+item.replacement.length)!==suffix) throw new Error(`${spec.id}.${order+1}: suffix changed`);
      mutated=next;
      applied.push({order:order+1,expectedLine:item.expectedLine,index});
    }
    const targetHash=p5Sha256(Buffer.from(targetHtml,'utf8'));
    const mutatedHash=p5Sha256(Buffer.from(mutated,'utf8'));
    if(targetHash!==P5_TARGET_SHA256) throw new Error(`${spec.id}: input target hash drift`);
    if(mutatedHash===targetHash) throw new Error(`${spec.id}: mutation hash equals target hash`);
    return {html:mutated,mutatedSha256:mutatedHash,applied};
  }

  function p5TestNumber(key){
    if(key==='sweep128') return 'sweep128';
    const match=/^test(\d+)_/.exec(key);
    return match ? `test${match[1]}` : null;
  }

  function p5CreateXorshift32(seed){
    let state=seed>>>0, draws=0;
    if(state===0) throw new Error('phase5 xorshift32 seed must be nonzero');
    const next=function p5Xorshift32Next(){
      let value=state;
      value^=value<<13;
      value^=value>>>17;
      value^=value<<5;
      state=value>>>0;
      draws++;
      return state/4294967296;
    };
    return {next,snapshot:()=>({state:state>>>0,draws})};
  }

  function p5RunHarnessInFreshVm(html,label,harnessSource,seed=P5_RANDOM_SEED){
    if(typeof bootGameInVm!=='function') throw new Error('phase5 requires bootGameInVm after integration');
    const savedRandom=Math.random;
    try{
      const normalizedSeed=seed>>>0;
      const randomStream=p5CreateXorshift32(normalizedSeed);
      Math.random=randomStream.next;
      const context=bootGameInVm(html,`phase5-${label}`);
      const raw=p5vm.runInContext(harnessSource,context,{
        filename:'_test_harness_20260804.js',timeout:120000,
      });
      if(!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error(`${label}: harness did not return an object`);
      const plain=JSON.parse(JSON.stringify(raw));
      const rows=Object.entries(plain).map(([key,detail])=>({
        key,testNumber:p5TestNumber(key),verdict:detail&&detail.verdict,
        trials:detail&&(detail.trials!=null?detail.trials:(detail.scenarios!=null?detail.scenarios:null)),
      }));
      const invalidRows=rows.filter(row=>!row.testNumber || !['PASS','FAIL'].includes(row.verdict));
      const failedRows=rows.filter(row=>row.verdict==='FAIL');
      const randomStreamRestoredAfterHarness=Math.random===randomStream.next;
      return {
        valid:rows.length===16 && invalidRows.length===0 && randomStreamRestoredAfterHarness,
        randomStream:{seedUint32:normalizedSeed,...randomStream.snapshot(),restoredAfterHarness:randomStreamRestoredAfterHarness},
        itemCount:rows.length,passItemCount:rows.filter(row=>row.verdict==='PASS').length,
        failedItemCount:failedRows.length,
        failedItems:failedRows.map(row=>({
          key:row.key,testNumber:row.testNumber,detail:plain[row.key],
        })),
        failedTestNumbers:[...new Set(failedRows.map(row=>row.testNumber))],
        invalidRows,rows,
      };
    } finally {
      Math.random=savedRandom;
    }
  }

  function p5RunSeedQualification(){
    const targetBytes=p5ReadFrozenTargetBytes();
    const targetHtml=targetBytes.toString('utf8');
    p5ValidatePlanAgainstTarget(targetHtml);
    const harnessBytes=p5ReadVerifiedHarnessBytes();
    const harnessSource=harnessBytes.toString('utf8');
    const before={
      target:p5Sha256(targetBytes),harness:p5Sha256(harnessBytes),
      liveImplementation:p5HashIfPresent(P5_LIVE_IMPLEMENTATION_PATH),
    };
    const candidates=[];
    let selected=null;
    for(let index=1;index<=12;index++){
      const label=`SOL-ULTRA-P5-BASELINE-SEED:${index}`;
      const digest=p5Sha256(Buffer.from(label,'utf8'));
      const seedUint32=parseInt(digest.slice(0,8),16)>>>0;
      if(seedUint32===0){
        candidates.push({index,label,digest,seedUint32,skipped:'xorshift32 zero seed'});
        continue;
      }
      const harness=p5RunHarnessInFreshVm(targetHtml,`SEED-PROBE-${index}`,harnessSource,seedUint32);
      const candidate={index,label,digest,seedHex:`0x${seedUint32.toString(16).toUpperCase().padStart(8,'0')}`,seedUint32,harness};
      candidates.push(candidate);
      if(harness.valid && harness.itemCount===16 && harness.failedItemCount===0){ selected=candidate; break; }
    }
    const after={
      target:p5Sha256(p5ReadFrozenTargetBytes()),harness:p5Sha256(p5ReadVerifiedHarnessBytes()),
      liveImplementation:p5HashIfPresent(P5_LIVE_IMPLEMENTATION_PATH),
    };
    const immutableGuardPassed=before.target===after.target && before.target===P5_TARGET_SHA256
      && before.harness===after.harness && before.harness===P5_HARNESS_SHA256
      && before.liveImplementation===after.liveImplementation;
    return {
      mode:'phase5-seed-qualification',phase:5,
      derivation:'SHA-256 UTF-8 of SOL-ULTRA-P5-BASELINE-SEED:<i>; first 8 hex as uint32; ascending i; stop at first BASELINE 16/16',
      maximumCandidates:12,candidates,selected,selectedIndex:selected?selected.index:null,
      allRunsBaselineOnly:true,mutationExecutions:[],mutationHtmlConstructed:false,
      before,after,immutableGuardPassed,qualificationValid:Boolean(selected&&immutableGuardPassed),temporaryFilesCreated:[],
    };
  }

  function p5RunChild(id){
    const targetBytes=p5ReadFrozenTargetBytes();
    const targetHtml=targetBytes.toString('utf8');
    p5ValidatePlanAgainstTarget(targetHtml);
    const harnessBytes=p5ReadVerifiedHarnessBytes();
    const harnessSource=harnessBytes.toString('utf8');
    let html=targetHtml, mutation=null;
    if(id!=='BASELINE'){
      const spec=P5_MUTATION_SPECS.find(item=>item.id===id);
      if(!spec) throw new Error(`unknown phase5 child id: ${id}`);
      const applied=p5ApplyMutationInMemory(targetHtml,spec);
      html=applied.html;
      mutation={id:spec.id,systems:spec.systems,mutatedSha256:applied.mutatedSha256,applied:applied.applied};
    }
    const harness=p5RunHarnessInFreshVm(html,id,harnessSource);
    return {
      mode:'phase5-harness-child',id,planSha256:p5PlanSha256(),
      targetSha256:p5Sha256(targetBytes),harnessSha256:p5Sha256(harnessBytes),
      randomPolicy:P5_RANDOM_POLICY,mutation,harness,temporaryFilesCreated:[],
    };
  }

  function p5HashIfPresent(file){
    if(!p5fs.existsSync(file)) return null;
    return p5Sha256(p5fs.readFileSync(file));
  }

  function p5SpawnChild(id){
    const started=Date.now();
    const result=p5child.spawnSync(process.execPath,[__filename,'--phase5-harness-child',id],{
      cwd:P5_WORKSPACE_ROOT,encoding:'utf8',timeout:150000,maxBuffer:16*1024*1024,
      windowsHide:true,
    });
    const execution={
      id,status:result.status,signal:result.signal,error:result.error?result.error.message:null,
      stderr:(result.stderr||'').trim(),durationMs:Date.now()-started,
    };
    if(result.status!==0 || result.signal || result.error){
      return {...execution,valid:false,stdout:(result.stdout||'').trim()};
    }
    try{
      return {...execution,valid:true,result:JSON.parse((result.stdout||'').trim())};
    }catch(error){
      return {...execution,valid:false,parseError:error.message,stdout:(result.stdout||'').trim()};
    }
  }

  function p5RunAudit(){
    const before={
      target:p5Sha256(p5ReadFrozenTargetBytes()),
      harness:p5Sha256(p5ReadVerifiedHarnessBytes()),
      liveImplementation:p5HashIfPresent(P5_LIVE_IMPLEMENTATION_PATH),
    };
    const targetHtml=p5ReadFrozenTargetBytes().toString('utf8');
    const validation=p5ValidatePlanAgainstTarget(targetHtml);
    const baselineExecution=p5SpawnChild('BASELINE');
    const baseline=baselineExecution.valid ? baselineExecution.result : null;
    const baselineGatePassed=!!(baseline && baseline.planSha256===p5PlanSha256()
      && baseline.harness.valid && baseline.harness.itemCount===16 && baseline.harness.failedItemCount===0);
    const mutationExecutions=[];
    if(baselineGatePassed){
      for(const spec of P5_MUTATION_SPECS) mutationExecutions.push(p5SpawnChild(spec.id));
    }
    const after={
      target:p5Sha256(p5ReadFrozenTargetBytes()),
      harness:p5Sha256(p5ReadVerifiedHarnessBytes()),
      liveImplementation:p5HashIfPresent(P5_LIVE_IMPLEMENTATION_PATH),
    };
    const immutableGuardPassed=before.target===after.target && before.target===P5_TARGET_SHA256
      && before.harness===after.harness && before.harness===P5_HARNESS_SHA256
      && before.liveImplementation===after.liveImplementation;
    const validMutationRuns=mutationExecutions.filter(execution=>execution.valid
      && execution.result && execution.result.planSha256===p5PlanSha256()
      && execution.result.harness && execution.result.harness.valid);
    const holes=validMutationRuns.filter(execution=>execution.result.harness.failedItemCount===0)
      .map(execution=>({id:execution.id,systems:execution.result.mutation.systems}));
    const allMutationsExecuted=mutationExecutions.length===10 && validMutationRuns.length===10;
    return {
      mode:'phase5-mutation-audit',phase:5,planSha256:p5PlanSha256(),
      validation,randomPolicy:P5_RANDOM_POLICY,before,after,immutableGuardPassed,
      baselineGatePassed,baselineExecution,mutationExecutions,
      allMutationsExecuted,holes,holeCount:holes.length,
      auditValid:baselineGatePassed&&allMutationsExecuted&&immutableGuardPassed,
      temporaryFilesCreated:[],
    };
  }

  function p5WriteJson(value){ process.stdout.write(`${JSON.stringify(value,null,2)}\n`); }

  if(require.main===module && process.argv.includes('--phase5-seed-qualification')){
    try{
      const output=p5RunSeedQualification(); p5WriteJson(output);
      if(!output.qualificationValid) process.exitCode=1;
    }catch(error){ p5WriteJson({mode:'phase5-seed-qualification',valid:false,error:error.stack||error.message}); process.exitCode=1; }
  }

  if(require.main===module && process.argv.includes('--phase5-mutation-plan')){
    try{ p5WriteJson(p5BuildPlanOutput()); }
    catch(error){ p5WriteJson({mode:'phase5-mutation-plan',valid:false,error:error.stack||error.message}); process.exitCode=1; }
  }

  if(require.main===module && process.argv.includes('--phase5-harness-child')){
    const index=process.argv.indexOf('--phase5-harness-child');
    const id=process.argv[index+1];
    try{ p5WriteJson(p5RunChild(id)); }
    catch(error){ p5WriteJson({mode:'phase5-harness-child',id,valid:false,error:error.stack||error.message}); process.exitCode=1; }
  }

  if(require.main===module && process.argv.includes('--phase5-mutation-audit')){
    try{
      const output=p5RunAudit(); p5WriteJson(output);
      if(!output.auditValid) process.exitCode=1;
    }catch(error){ p5WriteJson({mode:'phase5-mutation-audit',valid:false,error:error.stack||error.message}); process.exitCode=1; }
  }
})();

function runPhase5FindingMutation(mutationId){
  const {spawnSync}=require('child_process');
  const child=spawnSync(process.execPath,[__filename,'--phase5-harness-child',mutationId],{
    cwd:'C:\\Users\\amila\\Desktop\\Claude Code',encoding:'utf8',timeout:150000,maxBuffer:16*1024*1024,windowsHide:true,
  });
  if(child.status!==0 || child.signal || child.error){
    throw new Error(`${mutationId} child failed: ${child.error?child.error.message:(child.stderr||child.stdout||child.signal)}`);
  }
  const result=JSON.parse((child.stdout||'').trim());
  if(!result || !result.harness || !result.harness.valid) throw new Error(`${mutationId} returned invalid harness result`);
  return result;
}

function reproFinding23HarnessMissCoverArrival(){
  const result=runPhase5FindingMutation('M04');
  return {
    finding:23,mutationId:'M04',systems:['S-4','S-5'],planSha256:result.planSha256,
    applied:result.mutation.applied,mutatedSha256:result.mutation.mutatedSha256,
    passedItemCount:result.harness.passItemCount,failedItemCount:result.harness.failedItemCount,
    failedItems:result.harness.failedItems,harnessMiss:result.harness.failedItemCount===0,
    randomStreamRestored:result.harness.randomStream.restoredAfterHarness,temporaryFilesCreated:result.temporaryFilesCreated,
  };
}
if(require.main===module && process.argv.includes('--repro-finding23')){
  process.stdout.write(`${JSON.stringify(reproFinding23HarnessMissCoverArrival(),null,2)}\n`);
}

function reproFinding24HarnessMissRunningThrowDeviation(){
  const result=runPhase5FindingMutation('M07');
  return {
    finding:24,mutationId:'M07',systems:['S-9'],planSha256:result.planSha256,
    applied:result.mutation.applied,mutatedSha256:result.mutation.mutatedSha256,
    passedItemCount:result.harness.passItemCount,failedItemCount:result.harness.failedItemCount,
    failedItems:result.harness.failedItems,harnessMiss:result.harness.failedItemCount===0,
    randomStreamRestored:result.harness.randomStream.restoredAfterHarness,temporaryFilesCreated:result.temporaryFilesCreated,
  };
}
if(require.main===module && process.argv.includes('--repro-finding24')){
  process.stdout.write(`${JSON.stringify(reproFinding24HarnessMissRunningThrowDeviation(),null,2)}\n`);
}

function reproFinding25HarnessMissApproachingGate(){
  const result=runPhase5FindingMutation('M08');
  return {
    finding:25,mutationId:'M08',systems:['S-10'],planSha256:result.planSha256,
    applied:result.mutation.applied,mutatedSha256:result.mutation.mutatedSha256,
    passedItemCount:result.harness.passItemCount,failedItemCount:result.harness.failedItemCount,
    failedItems:result.harness.failedItems,harnessMiss:result.harness.failedItemCount===0,
    randomStreamRestored:result.harness.randomStream.restoredAfterHarness,temporaryFilesCreated:result.temporaryFilesCreated,
  };
}
if(require.main===module && process.argv.includes('--repro-finding25')){
  process.stdout.write(`${JSON.stringify(reproFinding25HarnessMissApproachingGate(),null,2)}\n`);
}

function reproFinding26HarnessMissCameraOcclusion(){
  const result=runPhase5FindingMutation('M09');
  return {
    finding:26,mutationId:'M09',systems:['S-11'],planSha256:result.planSha256,
    applied:result.mutation.applied,mutatedSha256:result.mutation.mutatedSha256,
    passedItemCount:result.harness.passItemCount,failedItemCount:result.harness.failedItemCount,
    failedItems:result.harness.failedItems,harnessMiss:result.harness.failedItemCount===0,
    randomStreamRestored:result.harness.randomStream.restoredAfterHarness,temporaryFilesCreated:result.temporaryFilesCreated,
  };
}
if(require.main===module && process.argv.includes('--repro-finding26')){
  process.stdout.write(`${JSON.stringify(reproFinding26HarnessMissCameraOcclusion(),null,2)}\n`);
}

function reproFinding27BounceOracleMismatch(){
  const result=runPhase5FindingMutation('M03');
  const intendedKey='test4_叩きつけバウンド';
  return {
    finding:27,mutationId:'M03',systems:['S-3'],planSha256:result.planSha256,
    applied:result.mutation.applied,mutatedSha256:result.mutation.mutatedSha256,
    passedItemCount:result.harness.passItemCount,failedItemCount:result.harness.failedItemCount,
    failedItems:result.harness.failedItems,intendedOracleKey:intendedKey,
    intendedOracleFailed:result.harness.failedItems.some(item=>item.key===intendedKey),
    randomStreamRestored:result.harness.randomStream.restoredAfterHarness,temporaryFilesCreated:result.temporaryFilesCreated,
  };
}
if(require.main===module && process.argv.includes('--repro-finding27')){
  process.stdout.write(`${JSON.stringify(reproFinding27BounceOracleMismatch(),null,2)}\n`);
}

function reproFinding28FielderSpeedOracleMismatch(){
  const result=runPhase5FindingMutation('M10');
  return {
    finding:28,mutationId:'M10',systems:['S-12'],planSha256:result.planSha256,
    applied:result.mutation.applied,mutatedSha256:result.mutation.mutatedSha256,
    passedItemCount:result.harness.passItemCount,failedItemCount:result.harness.failedItemCount,
    failedItems:result.harness.failedItems,directSpeedMetricsObserved:[],
    onlyFailedKey:result.harness.failedItems.length===1?result.harness.failedItems[0].key:null,
    randomStreamRestored:result.harness.randomStream.restoredAfterHarness,temporaryFilesCreated:result.temporaryFilesCreated,
  };
}
if(require.main===module && process.argv.includes('--repro-finding28')){
  process.stdout.write(`${JSON.stringify(reproFinding28FielderSpeedOracleMismatch(),null,2)}\n`);
}
