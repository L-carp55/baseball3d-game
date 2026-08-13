#!/usr/bin/env node
'use strict';
/* Owner Closure Recovery R1 — mutation detection power check.

   Injects each of the R1/R1a/R1b regressions (M-R1-BT-1..6, M-R1A-COMPAT-1,
   M-R1B-HEIGHT-1) into a
   TEMPORARY COPY of baseball3d.html and requires
   _test_batted_ball_identity_recovery_20260813.js to FAIL against that copy.

   The production file is never modified: every mutant is written to a temp copy and
   the focused test is pointed at that copy (the real focused contract, not a
   duplicated approximation of it). Production byte-identity is verified before and
   after the run.

   Run: node _r1_batted_ball_mutation_check_20260813.js
   Requires Chrome/Chromium reachable the same way the focused test finds it
   (CHROME_PATH / PUPPETEER_EXECUTABLE_PATH env var, or google-chrome/chromium on
   PATH, or the standard Windows install path). */
const assert = require('assert');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const SOURCE = path.join(ROOT, 'baseball3d.html');
const TEST = path.join(ROOT, '_test_batted_ball_identity_recovery_20260813.js');
const originalRaw = fs.readFileSync(SOURCE, 'utf8');
const originalSha = crypto.createHash('sha256').update(originalRaw).digest('hex');
/* 作業ツリーは CRLF なので、変異の当て先を探す前に LF へ正規化する。
   正規化するのは一時コピーだけで、production は読むだけ（最後に SHA-256 で不変を証明する）。 */
const original = originalRaw.replace(/\r\n/g, '\n');

function replaceOnce(source, oldStr, newStr, label) {
  const count = source.split(oldStr).length - 1;
  assert.strictEqual(count, 1, label + ': expected one anchor, found ' + count);
  return source.split(oldStr).join(newStr);
}

const MUTANTS = [
  {
    id: 'M-R1-BT-1',
    why: 'remove the production battedType assignment entirely',
    apply(source) {
      return replaceOnce(source,
        "    exit:c.exit, la:c.la, spray:c.spray, maxZ:from[1], landed:false,\n    battedType: classifyBattedBallPhysical(c, from[1]) };",
        "    exit:c.exit, la:c.la, spray:c.spray, maxZ:from[1], landed:false };",
        'M-R1-BT-1 anchor');
    }
  },
  {
    id: 'M-R1-BT-2',
    why: 'derive type from canCatchAir (false => ゴロ) -- the exact OF-17 coupling this recovery removes',
    apply(source) {
      return replaceOnce(source,
        "  ball.pred=plan.firstLand; ball.canCatchAir=plan.air; ball.planT=plan.t;",
        "  ball.pred=plan.firstLand; ball.canCatchAir=plan.air; ball.planT=plan.t;\n" +
        "  ball.battedType = ball.canCatchAir ? ball.battedType : 'ゴロ';  // mutation: re-couple to canCatchAir",
        'M-R1-BT-2 anchor');
    }
  },
  {
    id: 'M-R1-BT-3',
    why: 'overwrite physical type with ゴロ at first landing',
    apply(source) {
      return replaceOnce(source,
        "  if(ball.z<=0.02) ball.landed=true;\n",
        "  if(ball.z<=0.02){ ball.landed=true; ball.battedType='ゴロ'; }  // mutation: rewrite type on landing\n",
        'M-R1-BT-3 anchor');
    }
  },
  {
    id: 'M-R1-BT-4',
    why: 'restore a hard-coded ゴロ in a result path exercised by a low-line-drive fixture (concludePlay single-out text)',
    apply(source) {
      return replaceOnce(source,
        "else if(outs===1) text=`${nm}${(ball&&ball.battedType)||'ゴロ'} アウト`;",
        "else if(outs===1) text=`${nm}ゴロ アウト`;",
        'M-R1-BT-4 anchor');
    }
  },
  {
    id: 'M-R1-BT-5',
    why: 'stop recording bt (leave it empty for every batted ball)',
    apply(source) {
      return replaceOnce(source,
        "cm:ball.catchMode||'', bt:ball.battedType||''}:null,",
        "cm:ball.catchMode||'', bt:''}:null,",
        'M-R1-BT-5 anchor');
    }
  },
  {
    id: 'M-R1-BT-6',
    why: 'push the ground/liner boundary past 11°, making both owner examples ground balls',
    apply(source) {
      return replaceOnce(source,
        "  if(la<=5) return 'ゴロ';",
        "  if(la<=15) return 'ゴロ';  // mutation: 9°/11° owner examples become grounders",
        'M-R1-BT-6 anchor');
    }
  },
  {
    id: 'M-R1A-COMPAT-1',
    why: 'recreate the R1a-flagged defect: classify every la<=20 airborne contact as ライナー again, regardless of predicted physical apex (bypassing the shared categorizeAirborneByAngleApex/predictBattedBallApexFt contract)',
    apply(source) {
      return replaceOnce(source,
        "  return categorizeAirborneByAngleApex(la, predictBattedBallApexFt(c, launchZ));\n}",
        "  if(la<=20) return 'ライナー';  // mutation: angle-only again, ignores apex\n  return categorizeAirborneByAngleApex(la, predictBattedBallApexFt(c, launchZ));\n}",
        'M-R1A-COMPAT-1 anchor');
    }
  },
  {
    id: 'M-R1B-HEIGHT-1',
    why: 'recreate the R1a-F2 defect: ignore the supplied production launch height and force the apex predictor to use fixed z=1.4',
    apply(source) {
      return replaceOnce(source,
        "  const z0 = (launchZ==null ? 1.4 : +launchZ);\n",
        "  const z0 = 1.4;  // mutation: ignore supplied launch height\n",
        'M-R1B-HEIGHT-1 anchor');
    }
  }
];

function runTest(htmlPath) {
  try {
    execFileSync(process.execPath, [TEST, htmlPath], {
      encoding: 'utf8',
      stdio: 'pipe',
      env: Object.assign({}, process.env),
      timeout: 120000
    });
    return { failed: false, message: '' };
  } catch (error) {
    const text = String(error.stdout || '') + String(error.stderr || '');
    const lines = text.split('\n');
    const line = lines.find(l => l.includes('AssertionError [ERR_ASSERTION]:'))
      || lines.find(l => l.includes('AssertionError'))
      || lines[0] || '';
    return { failed: true, message: line.trim() };
  }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b0805-30-r1-bt-mutants-'));
const results = [];
try {
  /* BASELINE も同じ正規化コピーで測る。正規化そのものがテストを落とさないことを先に示す
     （baseline が落ちる状態での kill は検出力を証明しないため）。 */
  const baselineFile = path.join(tmpDir, 'BASELINE.html');
  fs.writeFileSync(baselineFile, original, 'utf8');
  const baseline = runTest(baselineFile);
  assert(!baseline.failed, 'BASELINE must pass before mutants are meaningful: ' + baseline.message);
  results.push({ id: 'BASELINE', killed: null, verdict: 'PASS (unmutated, LF-normalized copy)' });

  for (const mutant of MUTANTS) {
    const mutated = mutant.apply(original);
    assert.notStrictEqual(mutated, original, mutant.id + ': mutation is a real change, not a no-op');
    const file = path.join(tmpDir, mutant.id + '.html');
    fs.writeFileSync(file, mutated, 'utf8');
    const outcome = runTest(file);
    results.push({
      id: mutant.id,
      why: mutant.why,
      killed: outcome.failed,
      detectedBy: outcome.message || null
    });
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

const afterSha = crypto.createHash('sha256').update(fs.readFileSync(SOURCE, 'utf8')).digest('hex');
assert.strictEqual(afterSha, originalSha, 'production baseball3d.html must be byte-identical after the run');

const survivors = results.filter(r => r.killed === false);
console.log(JSON.stringify({
  status: survivors.length === 0 ? 'PASS' : 'FAIL',
  productionShaUnchanged: true,
  productionSha256: originalSha,
  mutantsRun: MUTANTS.length,
  killed: results.filter(r => r.killed === true).length,
  survived: survivors.map(r => r.id),
  results
}, null, 1));
process.exit(survivors.length === 0 ? 0 : 1);
