#!/usr/bin/env node
'use strict';
/* R2-F5 detection-power check.
   Injects the exact regressions R2 must forbid into a TEMPORARY COPY of
   baseball3d.html and requires the contract test to FAIL for each one.

   The production file is never modified: every mutant is written to a temp
   copy and the contract test is pointed at that copy.  A test that cannot be
   made to fail proves nothing, so this runner is what makes R2-F5 real.

   Run: node _r2_mutation_check_20260811.js */
const assert = require('assert');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const SOURCE = path.join(ROOT, 'baseball3d.html');
const TEST = path.join(ROOT, '_test_pitch_motion_bank_cmu124_20260811.js');
const originalRaw = fs.readFileSync(SOURCE, 'utf8');
const originalSha = crypto.createHash('sha256').update(originalRaw).digest('hex');
/* 作業ツリーは CRLF なので、変異の当て先を探す前に LF へ正規化する。
   正規化するのは一時コピーだけで、production は読むだけ（最後に SHA-256 で不変を証明する）。 */
const original = originalRaw.replace(/\r\n/g, '\n');

const SHARED_CALL =
  '  const T = buildFigurePoseTransforms(fx, fz, face, runDist, scale, speed01, pose);\n' +
  '  const {P, s, sp, ph, sw, aw, bob, lean, hipY, shY, KNEE, ELB, split, base, pelvis, body} = T;';

/* The pre-R2 body of drawFigure: helper exists, renderer re-implements it.
   This is exactly the R1 state that browser red-team flagged as BLOCKED. */
const DUPLICATED_BODY = `  const P = pose||{};
  const s = (P.pitchMotion===true && Number.isFinite(P.figureScale)) ? P.figureScale : (scale||1);
  const sp = clamp(speed01===undefined?1:speed01, 0, 1);
  const ph = (runDist||0)*0.62;
  const sw = Math.sin(ph) * (0.55+0.65*sp);
  const aw = -Math.sin(ph) * (0.42+0.50*sp);
  const bob = (P.rise||0) + (P.crouch!==undefined ? -P.crouch : (sp>0.02 ? Math.abs(Math.cos(ph))*0.13*sp : 0));
  const lean = P.lean!==undefined ? P.lean : 0.16*sp;
  const hipY=2.08, shY=3.48, KNEE=-1.0, ELB=-0.74;
  const split = P.pitchMotion===true || P.pelvisYaw!==undefined || P.torsoYaw!==undefined;
  let base, pelvis, body;
  if(!split){
    base = M4.mul(M4.trans(fx,bob,fz), M4.rotY((face||0) + (P.turn||0)));
    if(s!==1) base = M4.mul(base, M4.scale(s));
    body = M4.mul(base, M4.rotX(lean));
    pelvis=body;
  }else{
    base = M4.mul(M4.trans(fx,bob,fz), M4.rotY((face||0) + (P.pelvisYaw||0)));
    if(s!==1) base = M4.mul(base, M4.scale(s));
    pelvis = M4.mul(base, M4.rotX(P.pelvisLean||0));
    let torso = M4.mul(pelvis, M4.trans(0,hipY,0));
    torso = M4.mul(torso, M4.rotY(P.torsoYaw||0));
    torso = M4.mul(torso, M4.rotZ(P.torsoTilt||0));
    torso = M4.mul(torso, M4.rotX(P.torsoLean!==undefined?P.torsoLean:lean));
    body = M4.mul(torso, M4.trans(0,-hipY,0));
  }`;

const MUTANTS = [
  {
    id: 'M-R2-1',
    why: 'renderer re-implements the body transform while the helper still exists (the R1 BLOCKED state)',
    apply(source){
      assert(source.includes(SHARED_CALL), 'anchor: shared call present');
      return source.replace(SHARED_CALL, DUPLICATED_BODY);
    }
  },
  {
    id: 'M-R2-2',
    why: 'QA keeps the helper but the renderer bypasses it (QA PASS / screen FAIL divergence)',
    apply(source){
      assert(source.includes(SHARED_CALL), 'anchor: shared call present');
      return source.replace(
        SHARED_CALL,
        '  const T = inlineFigurePoseTransforms(fx, fz, face, runDist, scale, speed01, pose);\n' +
        '  const {P, s, sp, ph, sw, aw, bob, lean, hipY, shY, KNEE, ELB, split, base, pelvis, body} = T;'
      );
    }
  },
  {
    id: 'M-R2-3',
    why: 'renderer shares composeFigureSegment only, and recomputes base/pelvis/body itself',
    apply(source){
      assert(source.includes(SHARED_CALL), 'anchor: shared call present');
      return source.replace(
        SHARED_CALL,
        DUPLICATED_BODY + '\n  const T = {P,s,sp,ph,sw,aw,bob,lean,hipY,shY,KNEE,ELB,split,base,pelvis,body};'
      );
    }
  },
  {
    id: 'M-R2-4',
    why: 'call is deleted but the explanatory comment still names the helper (comment-only compliance)',
    apply(source){
      assert(source.includes(SHARED_CALL), 'anchor: shared call present');
      return source.replace(
        SHARED_CALL,
        '  /* uses buildFigurePoseTransforms() */\n' + DUPLICATED_BODY
      );
    }
  },
  {
    id: 'M-R2-6',
    why: 'helper is still called, but a second body transform is recomputed alongside it (the subtle drift case: assertion (1) cannot see this, only the duplicate-signature detector can)',
    apply(source){
      assert(source.includes(SHARED_CALL), 'anchor: shared call present');
      return source.replace(
        SHARED_CALL,
        SHARED_CALL +
        '\n  let shadowBase = M4.mul(M4.trans(fx,bob,fz), M4.rotY((face||0) + (P.turn||0)));' +
        '\n  shadowBase = M4.mul(shadowBase, M4.rotX(P.pelvisLean||0));'
      );
    }
  },
  {
    id: 'M-R2-5',
    why: 'legacy one-piece (non-split) transform is dropped from the shared helper',
    apply(source){
      const anchor = '  let base,pelvis,body;\n  if(!split){';
      assert(source.includes(anchor), 'anchor: helper legacy branch present');
      return source.replace(anchor, '  let base,pelvis,body;\n  if(false){');
    }
  }
];

function runTest(htmlPath){
  try{
    execFileSync(process.execPath, [TEST, htmlPath], { encoding:'utf8', stdio:'pipe' });
    return { failed:false, message:'' };
  }catch(error){
    const text = String(error.stdout||'') + String(error.stderr||'');
    const line = text.split('\n').find(l=>l.includes('AssertionError')) || text.split('\n')[0] || '';
    return { failed:true, message:line.trim() };
  }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b0805-30-r2-mutants-'));
const results = [];
try{
  /* BASELINE も同じ正規化コピーで測る。正規化そのものがテストを落とさないことを先に示す
     （baseline が落ちる状態での kill は検出力を証明しないため）。 */
  const baselineFile = path.join(tmpDir, 'BASELINE.html');
  fs.writeFileSync(baselineFile, original, 'utf8');
  const baseline = runTest(baselineFile);
  assert(!baseline.failed, 'BASELINE must pass before mutants are meaningful: '+baseline.message);
  results.push({ id:'BASELINE', killed:null, verdict:'PASS (unmutated, LF-normalized copy)' });

  for(const mutant of MUTANTS){
    const mutated = mutant.apply(original);
    assert(mutated !== original, mutant.id+': mutation is a real change, not a no-op');
    const file = path.join(tmpDir, mutant.id+'.html');
    fs.writeFileSync(file, mutated, 'utf8');
    const outcome = runTest(file);
    results.push({
      id: mutant.id,
      why: mutant.why,
      killed: outcome.failed,
      detectedBy: outcome.message || null
    });
  }
}finally{
  fs.rmSync(tmpDir, { recursive:true, force:true });
}

const afterSha = crypto.createHash('sha256').update(fs.readFileSync(SOURCE,'utf8')).digest('hex');
assert.strictEqual(afterSha, originalSha, 'production baseball3d.html must be byte-identical after the run');

const survivors = results.filter(r=>r.killed === false);
console.log(JSON.stringify({
  status: survivors.length===0 ? 'PASS' : 'FAIL',
  productionShaUnchanged: true,
  productionSha256: originalSha,
  mutantsRun: MUTANTS.length,
  killed: results.filter(r=>r.killed===true).length,
  survived: survivors.map(r=>r.id),
  results
}, null, 1));
process.exit(survivors.length===0 ? 0 : 1);
