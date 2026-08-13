#!/usr/bin/env node
'use strict';

/* Owner Closure Recovery R1 — batted-ball physical identity, focused contract.
   Run: node _test_batted_ball_identity_recovery_20260813.js baseball3d.html

   OF-17/18/19 (docs/audits/owner_feedback_closure_matrix_20260813.md, agent/research-
   baseball-motion-ai): the historical b0805-24 immutable batted-ball identity contract
   was never inherited by the canonical b25->b26->b28->b29->b30 line (b25 is a direct
   child of b23, not b24 — independently re-verified below via a source/ancestry-shaped
   check, not by trusting the audit prose). Production coupled "can the current defense
   catch this in the air" (canCatchAir, a feasibility prediction from planPlay()) with
   the ball's own physical launch category, so a hard low liner that nobody could catch
   collapsed to "ゴロ" the instant canCatchAir went false — and the recorder's `bt`
   field, which reads ball.battedType, was always blank because nothing ever wrote it.

   This file executes the real production helper (classifyBattedBallPhysical) and the
   real production play flow (startFlight/update/concludePlay/resolveHit) via headless
   Chrome — not a duplicated re-implementation of the classification rule. */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const HTML_PATH = path.resolve(process.argv[2] || path.join(ROOT, 'baseball3d.html'));
const html = fs.readFileSync(HTML_PATH, 'utf8').replace(/\r\n/g, '\n');

function functionSource(source, name){
  const needle = 'function ' + name + '(';
  const start = source.indexOf(needle);
  assert(start >= 0, 'missing function ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('unterminated function ' + name);
}
function sha(text) { return crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex'); }

/* =====================================================================================
   Part 1 — classifyBattedBallPhysical: pure-function contract (assertions 2, 3, 4, 9)

   R1a (docs/audits/b0805_30_owner_closure_r1_browser_redteam_20260813.md, agent/
   research-baseball-motion-ai): independent red-team found that R1's angle-only
   classifyBattedBallPhysical disagreed with the existing airborne classifyCaughtBall()
   for any 6-20 degree contact whose real trajectory apex reaches >=22ft -- the same
   physical contact could be "ライナー" if it survived to the infield result path but
   "フライ" if a fielder caught it, which is not a stable single physical identity.
   classifyBattedBallPhysical now shares one angle/apex categorization table
   (categorizeAirborneByAngleApex) with classifyCaughtBall, fed by a contact-time apex
   prediction (predictBattedBallApexFt) that reuses the real stepBall() physics with no
   fielder/defender input at all -- not a defender-reach prediction, and not a duplicated
   re-implementation of the trajectory math. classifyBattedBallPhysical now needs more of
   the real source in scope than just its own function body, so the pure-function harness
   below bundles the real categorizeAirborneByAngleApex/predictBattedBallApexFt/stepBall
   sources plus their constant dependencies (RAD/DRAG/BACKSTOP_R/clamp), not
   re-implementations of them. */
function constSource(source, name){
  const re = new RegExp('const\\s+' + name + '\\s*=');
  const match = re.exec(source);
  assert(match, 'missing const ' + name);
  const start = match.index;
  const end = source.indexOf(';', start);
  assert(end >= 0, 'unterminated const ' + name);
  return source.slice(start, end + 1);
}

const classifySrc = functionSource(html, 'classifyBattedBallPhysical');
assert(!/canCatchAir/.test(classifySrc),
  'assertion 2 (§5.2): classifyBattedBallPhysical does not read canCatchAir anywhere in its own body');
assert(!/\bpitch\.|\bthrowPlay\b|\bfielders\b|\bupdatePitch\b|\bdoSwing\b/.test(classifySrc),
  'assertion 9 (§5.9): classifier has no pitch/throw/fielding coupling in its own body');

const apexSrc = functionSource(html, 'predictBattedBallApexFt');
assert(!/\bfielders\b|\bplanPlay\b|\bprim\b|\breachTimeToPoint\b|\bcanCatchAir\b/.test(apexSrc),
  'R1a requirement 6/design: predictBattedBallApexFt has no fielder/defender-reach input -- it is a trajectory prediction, not a catch-feasibility prediction');
assert(apexSrc.includes('stepBall('),
  'R1a requirement 7: apex prediction reuses the real stepBall() physics rather than re-deriving projectile motion');

const categorizeSrc = functionSource(html, 'categorizeAirborneByAngleApex');
const classifyCaughtSrcForShare = functionSource(html, 'classifyCaughtBall');
assert(classifyCaughtSrcForShare.includes('categorizeAirborneByAngleApex('),
  'R1a requirement 7: classifyCaughtBall shares the same angle/apex categorization table (categorizeAirborneByAngleApex) rather than keeping a second, independent copy of the boundaries');
assert(classifySrc.includes('categorizeAirborneByAngleApex(') && classifySrc.includes('predictBattedBallApexFt('),
  'R1a requirement 6/7: classifyBattedBallPhysical routes non-ground contacts through the shared categorization table fed by the contact-time apex prediction');

const SHARED_SUPPORT = [
  constSource(html, 'RAD'),
  constSource(html, 'DRAG'),
  constSource(html, 'BACKSTOP_R'),
  constSource(html, 'clamp'),
  functionSource(html, 'stepBall'),
  categorizeSrc,
  apexSrc,
  classifySrc
].join('\n');
const classifyContext = vm.createContext({ Math });
vm.runInContext(SHARED_SUPPORT, classifyContext);
const classify = (exit, la) => vm.runInContext('classifyBattedBallPhysical({exit:' + exit + ',la:' + la + '})', classifyContext);

/* Owner pins use realistic exit velocities for their angle so the apex prediction stays
   physically plausible (a "9° liner" at a token 1mph exit velocity is not a real contact
   and would trivially stay under any apex threshold regardless of what the categorization
   table does -- these are the same exit velocities used in the browser fixtures, §5). */
assert.strictEqual(classify(60, 9), 'ライナー', 'assertion 3 (§5.3): 9° owner example is ライナー');
assert.strictEqual(classify(50, 11), 'ライナー', 'assertion 3 (§5.3): 11° owner example is ライナー');
assert.strictEqual(classify(45, 1), 'ゴロ', 'assertion 4 (§5.4): ~1° owner-sample-style contact is ground category, not turned into a liner');
assert.strictEqual(classify(60, -8), 'ゴロ', '§3 minimum pin: a normal negative-angle grounder is ゴロ');
assert.strictEqual(classify(60, 0), 'ゴロ', 'boundary: la=0 is ground category');
assert.strictEqual(classify(60, 5), 'ゴロ', 'boundary: the chosen 5° ground/liner threshold is inclusive on the ground side');
assert.strictEqual(classify(60, 6), 'ライナー', 'boundary: 6° at a modest exit velocity (low apex) is a liner');
assert.strictEqual(classify(95, 30), 'フライ', '§3 minimum pin: a normal mid/high fly example is フライ');
assert.strictEqual(classify(95, 55), 'ポップフライ', '§3 minimum pin: a high popup example is ポップフライ');
assert.strictEqual(classify(95, 46), 'ポップフライ', 'boundary: la=46 crosses into popup, matching classifyCaughtBall\'s existing >45 boundary regardless of apex');

/* =====================================================================================
   Part 1b — cross-classifier compatibility (R1a requirement 5/8, assertion 8 extended):
   the exact incompatibility the red-team found. A 6-20° contact whose real predicted
   apex reaches >=22ft must be フライ under BOTH classifyBattedBallPhysical (contact-time)
   and classifyCaughtBall (if it had been caught with that same apex) -- not ライナー under
   one and フライ under the other for the identical physical trajectory.
   ===================================================================================== */
const apexContext = vm.createContext({ Math });
vm.runInContext([constSource(html,'RAD'), constSource(html,'DRAG'), constSource(html,'BACKSTOP_R'),
  constSource(html,'clamp'), functionSource(html,'stepBall'), apexSrc].join('\n'), apexContext);
const predictApex = (exit, la) => vm.runInContext('predictBattedBallApexFt({exit:' + exit + ',la:' + la + '})', apexContext);
const categorizeContext = vm.createContext({});
vm.runInContext(categorizeSrc, categorizeContext);
const categorize = (la, apexZ) => vm.runInContext('categorizeAirborneByAngleApex(' + la + ',' + apexZ + ')', categorizeContext);

const HIGH_APEX_CASE = { exit: 105, la: 18 };  // the red-team's flagged 15-20° high-apex case
const highApexPredicted = predictApex(HIGH_APEX_CASE.exit, HIGH_APEX_CASE.la);
assert(highApexPredicted >= 22, 'sanity: the 15-20° high-apex fixture case really does predict an apex >=22ft (predicted ' + highApexPredicted + 'ft) -- otherwise it is not exercising the overlap this repair targets');
const highApexPhysical = classify(HIGH_APEX_CASE.exit, HIGH_APEX_CASE.la);
const highApexIfCaught = categorize(HIGH_APEX_CASE.la, highApexPredicted);
assert.strictEqual(highApexPhysical, 'フライ', 'R1a requirement 5: 15-20° high-apex contact (predicted apex ' + highApexPredicted + 'ft) is フライ under classifyBattedBallPhysical, matching existing caught-air semantics for the same apex');
assert.strictEqual(highApexPhysical, highApexIfCaught, 'R1a requirement 8: contact-time physical type and the caught-air category computed from the same predicted apex agree for the overlap case');

for (const [exit, la] of [[60, 9], [50, 11], [95, 30], [95, 46]]) {
  const apex = predictApex(exit, la);
  assert.strictEqual(classify(exit, la), categorize(la, apex),
    'R1a requirement 8: contact-time physical type agrees with the shared category table for the same (angle, predicted apex) at exit=' + exit + 'mph la=' + la + 'deg (apex=' + apex + 'ft)');
}

/* =====================================================================================
   Part 2 — startFlight wiring and immutability (assertions 1, 5 — structural half)
   ===================================================================================== */
const startFlightSrc = functionSource(html, 'startFlight');
assert(/battedType\s*:\s*classifyBattedBallPhysical\(c\)/.test(startFlightSrc),
  'assertion 1 (§5.1): startFlight assigns ball.battedType via classifyBattedBallPhysical(c) in the object-literal constructor');
const planCallIndex = startFlightSrc.indexOf('planPlay(ball)');
const battedTypeIndex = startFlightSrc.indexOf('battedType');
assert(battedTypeIndex >= 0 && planCallIndex >= 0 && battedTypeIndex < planCallIndex,
  'physical type is assigned at ball construction, before planPlay()/canCatchAir are computed');

/* Immutability: ball.battedType must never be reassigned anywhere in production after
   its single object-literal initializer in startFlight. A regex over `ball.battedType=`
   (the only syntactic form a later overwrite could take) must find zero matches. */
const reassignments = (html.match(/ball\.battedType\s*=/g) || []).length;
assert.strictEqual(reassignments, 0,
  'assertion 5 (§5.5) structural half: no code path reassigns ball.battedType after construction (0 `ball.battedType=` occurrences; the constructor uses object-literal `battedType:`, not this form)');

/* =====================================================================================
   Part 3 — untouched-invariant pins (assertion 8, 9): canCatchAir feasibility computation
   and pitch/throw physics must be byte-identical to what R1 started from.
   updatePitch/doSwing/pitchPos baselines are the exact same SHA-256 constants already
   pinned in _test_pitch_motion_bank_cmu124_20260811.js (BASE_SHA 60b993b7...);
   flyOutLabel/planPlay/beginThrowPhase are pinned here, computed from this R1 branch's
   pre-R1a source. classifyCaughtBall is intentionally NOT byte-pinned here: R1a legitimately
   refactors its body to share categorizeAirborneByAngleApex() (its SOURCE changes), while
   its BEHAVIOR must stay identical -- that is checked below by re-running the exact test19
   input/output pairs against the real function, not by hashing its source text.
   ===================================================================================== */
const UNTOUCHED_BASELINE = Object.freeze({
  flyOutLabel: '15bf01b7d974b57c674b3f6e88830c4a681d28c766e8030867c9eab41f543c35',
  planPlay: 'a19b08773d3c0d48ec6e0c252311ab051dfdee5cc073160ddb95e49795ea9609',
  beginThrowPhase: 'b43e31d7672244cc897a0d832489bea876cf2905d763a32d1e90be82b8b4498f',
  updatePitch: '78a9ff80ea6d3544d5f7e63715c869a24716e8b9eeef2fd5958302d10110e231',
  doSwing: '8065d1b9a53ceefeb4cdcc351a66ec74bef4dffac9f8a2bc346643748a5c3cd8',
  pitchPos: '37c73ad528d8263cc997e30a760a87eeea2914e9338f0dc2c62acb211adc211f'
});
for (const [name, expected] of Object.entries(UNTOUCHED_BASELINE)) {
  assert.strictEqual(sha(functionSource(html, name)), expected,
    'assertion 8/9: ' + name + ' is byte-identical to its pre-R1a source (untouched by this recovery)');
}

const ccbContext = vm.createContext({});
vm.runInContext(categorizeSrc + '\n' + classifyCaughtSrcForShare, ccbContext);
const classifyCaught = b => vm.runInContext('classifyCaughtBall(' + JSON.stringify(b) + ')', ccbContext);
assert.strictEqual(classifyCaught({ landed: false, la: 12, maxZ: 6.5, z: 5 }), 'ライナー', 'assertion 8: classifyCaughtBall low no-bounce liner unchanged (test19 parity)');
assert.strictEqual(classifyCaught({ landed: false, la: 32, maxZ: 42, z: 5 }), 'フライ', 'assertion 8: classifyCaughtBall normal fly unchanged (test19 parity)');
assert.strictEqual(classifyCaught({ landed: false, la: 50, maxZ: 55, z: 5 }), 'ポップフライ', 'assertion 8: classifyCaughtBall high-angle popup unchanged (test19 parity)');
assert.strictEqual(classifyCaught({ landed: true, la: -5, maxZ: 6, z: 0 }), 'ゴロ', 'assertion 8: classifyCaughtBall landed-ball rule unchanged (test19 parity)');

/* =====================================================================================
   Part 4 — result-path integration (assertion 7): the two hard-coded ゴロ literals this
   recovery touched must now read ball.battedType, and must still fall back to ゴロ when
   there is no ball (defensive default, matches pre-R1 behavior for any caller without a
   batted ball in flight).
   ===================================================================================== */
const concludePlaySrc = functionSource(html, 'concludePlay');
assert(concludePlaySrc.includes("`${nm}${(ball&&ball.battedType)||'ゴロ'}`"),
  'assertion 7: concludePlay\'s rundown-result infield fallback reads ball.battedType (with ゴロ default)');
assert(concludePlaySrc.includes("`${nm}${(ball&&ball.battedType)||'ゴロ'} アウト`"),
  'assertion 7: concludePlay\'s single-out infield text reads ball.battedType (with ゴロ default)');
const resolveHitSrc = functionSource(html, 'resolveHit');
assert(/const bt = ball\.battedType\|\|'ゴロ';/.test(resolveHitSrc),
  'assertion 7: resolveHit\'s infield ground-out/force-and-run text reads ball.battedType (with ゴロ default)');
assert(!resolveHitSrc.includes('primary.n}ゴロ'),
  'assertion 7: resolveHit no longer hard-codes ゴロ directly in its result text');

/* =====================================================================================
   Part 5 — full-game browser fixtures (assertions 1, 3, 5, 6, 7 end-to-end).
   Real production functions only: newGame() -> startFlight(contact, powerMul, from) with
   a directly-supplied contact object (the same {exit,la,spray} shape doSwing() itself
   builds and passes to startFlight — this is the real production entry point, not a
   duplicated approximation of it) -> real update(1/60) ticks until the play resolves.
   Fixture parameters (exit mph / launch angle / spray) were found by probing this exact
   branch's real fielder positions/timings so the outcome is deterministic under the
   harness's seeded PRNG; they are not tuned to make one fixture pass while breaking
   adjacent cases — the 1°/-5° grounder fixtures below, run through the identical code
   path, are the adjacent-case check and still produce the original ゴロ wording. */
/* Each trial() call below must see the SAME random-number stream position, not just the
   same initial seed for the page as a whole -- Math.random is a single continuing
   generator for the page's lifetime, and newGame() does not reset it. Running several
   trials back-to-back in one page load (fast; avoids one Chromium launch per fixture)
   therefore requires an explicit reseed hook between trials, exposed on window. Without
   this, trial N's outcome silently depends on how many random draws trials 1..N-1
   happened to consume (found by this test itself: liner_11deg flipped from a clean
   put-out to a fielding error purely from being 3rd in sequence instead of 1st). */
const PRELUDE = (
  '<script>window.__seedRandom=()=>{let s=0x71D22228>>>0;Math.random=()=>{' +
  's^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};};' +
  'window.__seedRandom();' +
  'window.requestAnimationFrame=()=>0;</script>\n<script>\n"use strict";'
);
function replaceOnce(source, oldStr, newStr, label) {
  const count = source.split(oldStr).length - 1;
  assert.strictEqual(count, 1, label + ': expected one anchor, found ' + count);
  return source.split(oldStr).join(newStr);
}
function findChrome() {
  const envCandidates = [process.env.CHROME_PATH, process.env.PUPPETEER_EXECUTABLE_PATH].filter(Boolean);
  for (const c of envCandidates) if (fs.existsSync(c)) return c;
  const isWin = process.platform === 'win32';
  const finder = isWin ? 'where' : 'which';
  for (const name of ['google-chrome', 'chromium', 'chromium-browser', 'chrome']) {
    const res = spawnSync(finder, [name], { encoding: 'utf8' });
    if (res.status === 0 && res.stdout.trim()) return res.stdout.trim().split(/\r?\n/)[0];
  }
  const winFallbacks = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  if (isWin) for (const p of winFallbacks) if (fs.existsSync(p)) return p;
  return null;
}

const driver = `
function trial(exit, la, spray, label){
  window.__seedRandom();
  newGame();
  S.bases=[null,null,null];
  startFlight({exit, la, spray}, 1, [0, 2.5, 1.4]);
  const preType = ball.battedType;
  let landedType=null, canCatchAirAtLanding=null, recBtNonEmpty=null, sawInfieldKind=false;
  for(let i=0;i<600 && S.phase!=='msg'; i++){
    update(1/60);
    if(landedType===null && ball && ball.landed){ landedType = ball.battedType; canCatchAirAtLanding = ball.canCatchAir; }
    if(throwPlay && throwPlay.kind==='infield') sawInfieldKind=true;
    if(REC.cur && REC.cur.f.length && recBtNonEmpty===null){
      const last=REC.cur.f[REC.cur.f.length-1];
      if(last.ball) recBtNonEmpty = (last.ball.bt!=='');
    }
  }
  return {label, preType, landedType, canCatchAirAtLanding, recBtNonEmpty, sawInfieldKind,
    lastPlay: S.lastPlay, outs: S.outs};
}
function apexOnlyTrial(exit, la, label){
  window.__seedRandom();
  newGame();
  S.bases=[null,null,null];
  startFlight({exit, la, spray:0}, 1, [0, 2.5, 1.4]);
  return {label, preType: ball.battedType};
}
return JSON.stringify([
  trial(60, 9, 0, 'liner_9deg'),
  trial(60, 9, -10, 'liner_9deg_mirror'),
  trial(50, 11, 0, 'liner_11deg'),
  trial(50, 11, -5, 'liner_11deg_mirror'),
  trial(45, 1, 0, 'grounder_1deg'),
  trial(60, -5, 0, 'grounder_negative'),
  apexOnlyTrial(105, 18, 'highapex_18deg')
]);
`;

function runFixtures() {
  const chrome = findChrome();
  assert(chrome, 'Chromium/Chrome not found on PATH or via CHROME_PATH/PUPPETEER_EXECUTABLE_PATH env vars (see docs/audits/b0805_30_owner_closure_r1_batted_ball_identity.md for the PATH-shim workaround used on this Windows environment)');
  let source = replaceOnce(html, '<script>\n"use strict";', PRELUDE, 'script prelude');
  const runner = '<script>\ntry{const __r=(function(){' + driver + '})();' +
    "document.body.setAttribute('data-bt',encodeURIComponent(__r));}" +
    "catch(e){document.body.setAttribute('data-bt',encodeURIComponent(JSON.stringify({error:String(e&&e.stack||e.message||e)})));}\n</script>\n</body>";
  source = replaceOnce(source, '</body>', runner, 'body');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b3d-bt-'));
  const page = path.join(tmpDir, 'bt.html');
  fs.writeFileSync(page, source, 'utf8');
  const proc = spawnSync(chrome, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
    '--allow-file-access-from-files', '--dump-dom',
    'file:///' + page.replace(/\\/g, '/')
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 60000 });
  assert.strictEqual(proc.status, 0, 'Chromium exit ' + proc.status + '\n' + (proc.stderr || '').slice(-4000));
  const match = /data-bt="([^"]*)"/.exec(proc.stdout);
  assert(match, 'data-bt attribute missing from dumped DOM');
  const decoded = decodeURIComponent(match[1]);
  const parsed = JSON.parse(decoded);
  if (parsed && parsed.error) throw new Error('browser fixture driver threw: ' + parsed.error);
  return parsed;
}

const fixtures = runFixtures();
const byLabel = Object.fromEntries(fixtures.map(f => [f.label, f]));

for (const label of ['liner_9deg', 'liner_9deg_mirror', 'liner_11deg', 'liner_11deg_mirror']) {
  const f = byLabel[label];
  assert(f, 'fixture ' + label + ' ran');
  assert.strictEqual(f.preType, 'ライナー', 'assertion 3: ' + label + ' physical type at contact is ライナー');
  assert.strictEqual(f.landedType, 'ライナー', 'assertion 5: ' + label + ' physical type is unchanged after ball.landed becomes true');
  assert.strictEqual(f.canCatchAirAtLanding, false, 'assertion 3: ' + label + ' canCatchAir is false once the ball actually lands uncaught, while physical type stays ライナー (canCatchAir is a re-evaluated in-flight feasibility prediction, not a fixed contact-time value -- a ball that lands was, by definition, not caught)');
  assert.strictEqual(f.recBtNonEmpty, true, 'assertion 6: ' + label + ' recorder field bt is non-empty for this batted ball');
  assert(f.lastPlay && f.lastPlay.includes('ライナー'), 'assertion 7: ' + label + ' final result text preserves ライナー instead of ハードコードされたゴロ (lastPlay=' + f.lastPlay + ')');
  assert(f.lastPlay && !f.lastPlay.includes('ゴロ'), 'assertion 7: ' + label + ' final result text does not contain the literal ゴロ');
  assert.strictEqual(f.outs, 1, label + ' is genuinely an out (not miscounted as a hit)');
}
for (const label of ['grounder_1deg', 'grounder_negative']) {
  const f = byLabel[label];
  assert(f, 'fixture ' + label + ' ran');
  assert.strictEqual(f.preType, 'ゴロ', 'adjacent-case check: ' + label + ' physical type at contact is ゴロ (threshold not tuned to break this case)');
  assert.strictEqual(f.landedType, 'ゴロ', 'adjacent-case check: ' + label + ' type unchanged after landing');
  assert.strictEqual(f.recBtNonEmpty, true, 'adjacent-case check: ' + label + ' recorder bt is non-empty');
  assert(f.lastPlay && f.lastPlay.includes('ゴロ'), 'adjacent-case check: ' + label + ' genuine grounder still reads ゴロ through the same code path (lastPlay=' + f.lastPlay + ')');
  assert.strictEqual(f.outs, 1, label + ' is genuinely an out');
}

/* R1a requirement: at least one real startFlight/physics fixture for the high-apex
   overlap case, not only a synthetic classifier-argument check (Part 1b already covers
   the synthetic side; this ties it to the real, real-physics browser execution). */
const highApexFixture = byLabel['highapex_18deg'];
assert(highApexFixture, 'fixture highapex_18deg ran');
assert.strictEqual(highApexFixture.preType, 'フライ', 'R1a requirement 5 (real fixture): a real startFlight() 18°/105mph contact -- the red-team\'s flagged case -- is フライ, not ライナー');
assert.strictEqual(highApexFixture.preType, highApexPhysical, 'the real browser-executed startFlight() result agrees with Part 1b\'s isolated vm-sandbox prediction for the identical (exit, la)');

console.log(JSON.stringify({ status: 'PASS', fixtures }, null, 1));
