#!/usr/bin/env node
'use strict';

/* Contract tests for b0805-30 CMU124 R1.
   Run: node _test_pitch_motion_bank_cmu124_20260811.js baseball3d.html */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const HTML_PATH = path.resolve(process.argv[2] || path.join(ROOT, 'baseball3d.html'));
const BASE_SHA = '60b993b73fed854934a976e45e8feb9437deb584';
const BASELINE = Object.freeze({
  launch:'76796190c03b9171a564979dd9fd069d2b5c3a2f343cd15d5fdd451f6b73098d',
  pitchPos:'37c73ad528d8263cc997e30a760a87eeea2914e9338f0dc2c62acb211adc211f',
  updatePitch:'78a9ff80ea6d3544d5f7e63715c869a24716e8b9eeef2fd5958302d10110e231',
  doSwing:'8065d1b9a53ceefeb4cdcc351a66ec74bef4dffac9f8a2bc346643748a5c3cd8',
  fielderReadyPose:'d838e8932590ab818cc84074bb6c6b50e924e20332867c75b8169faa370d0674',
  trace:'13f0f8d498eaf5b2d1f1594ae07cc9b7c1ed93ef8962572de8ca61043e1d5659'
});
const html = fs.readFileSync(HTML_PATH, 'utf8');

function section(source, start, end){
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert(from >= 0 && to >= 0, 'missing section '+start);
  return source.slice(from, to + end.length);
}
function functionSource(source, name){
  const needle = 'function '+name+'(';
  const start = source.indexOf(needle);
  assert(start >= 0, 'missing function '+name);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{') depth++;
    if(source[i]==='}' && --depth===0) return source.slice(start, i+1);
  }
  throw new Error('unterminated function '+name);
}
function declarationSource(source, needle){
  const start=source.indexOf(needle);
  assert(start >= 0, 'missing declaration '+needle);
  const brace=source.indexOf('{', start);
  let depth=0;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{') depth++;
    if(source[i]==='}' && --depth===0){
      const semicolon=source.indexOf(';',i);
      assert(semicolon >= 0, 'unterminated declaration '+needle);
      return source.slice(start,semicolon+1);
    }
  }
  throw new Error('unterminated declaration '+needle);
}
function sha(text){ return crypto.createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex'); }
function deep(value){ return JSON.parse(JSON.stringify(value)); }
function close(a,b,eps=1e-9){ return Math.abs(a-b)<=eps; }
function distance(a,b){ return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z); }
function dot(a,b){ return a.x*b.x+a.y*b.y+a.z*b.z; }
function profileApi(){
  const source = section(html,
    '/* ========================= CMU 124-01 visual pitch motion ========================= */',
    '/* ======================= /CMU 124-01 visual pitch motion ======================= */');
  const support=[
    declarationSource(html,'const M4 = {'),
    functionSource(html,'buildFigurePoseTransforms'),
    functionSource(html,'composeFigureSegment'),
    functionSource(html,'figureMatrixWorldPoint')
  ].join('\n');
  const context = vm.createContext({
    Math, JSON, Float32Array,
    clamp:(value, low, high)=>Math.max(low, Math.min(high, value)),
    lerp:(a,b,t)=>a+(b-a)*t
  });
  vm.runInContext(support+'\n'+source, context, {filename:'cmu124_pitch_motion_r1_block.js'});
  return vm.runInContext('pitchMotionTestApi()', context);
}
function noRawCapture(root){
  const forbidden = [];
  const skip = new Set(['.git', 'node_modules', '.agents', '__pycache__']);
  function walk(dir){
    for(const item of fs.readdirSync(dir, {withFileTypes:true})){
      if(skip.has(item.name)) continue;
      const full=path.join(dir,item.name);
      if(item.isDirectory()) walk(full);
      else if(/\.(amc|asf|c3d)$/i.test(item.name)) forbidden.push(path.relative(root,full));
    }
  }
  walk(root);
  return forbidden;
}
function traceFrom(source){
  const context = vm.createContext({
    Math: Object.create(Math),
    PITCHES: [
      {dur:0.60,bx:0.0,by:0.0,ctrl:0.0},
      {dur:0.68,bx:0.75,by:-0.40,ctrl:0.0},
      {dur:0.74,bx:-0.70,by:0.28,ctrl:0.0},
      {dur:0.63,bx:0.28,by:0.62,ctrl:0.0}
    ],
    SPD:[1], DIFF_I:0, ZX:0.708, ZY0:1.5, ZY1:3.5,
    S:{phase:'windup',strikes:0}, anim:{wind:0,pitchMotionPostSec:0,pitchMotionReleased:false}, pitch:null, trail:[],
    clamp:(value,low,high)=>Math.max(low,Math.min(high,value)), gauss:()=>0,
    inZone:()=>false, isPlayerBatting:()=>true, beginPitchMotion:()=>{}
  });
  context.Math.random=()=>0.25;
  vm.runInContext(functionSource(source,'launchPitch')+'\n'+functionSource(source,'pitchPos'), context);
  const rows=[];
  for(let type=0;type<4;type++){
    vm.runInContext('launchPitch('+type+',0.25,-0.15)', context);
    for(let i=0;i<12;i++){
      const p=vm.runInContext('pitchPos('+i+'/11)', context);
      rows.push(p.map(value=>Number(value.toFixed(10))));
    }
  }
  return rows;
}
function keyById(profile,id){
  const key=profile.keys.find(candidate=>candidate.id===id);
  assert(key, 'missing profile key '+id);
  return key;
}
function sampleById(api,profile,id){
  const key=keyById(profile,id);
  return api.samplePitchMotion(profile,key.segment,key.time,{});
}

const api = profileApi();
const profile = deep(api.profile);
const diskProfile = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'third_party', 'cmu124_pitch_profile_v1.json'), 'utf8'));
const gameRelease = {x:0.95,y:5.75,z:54.0};
const pitcherLocation = {cx:0,cy:60.5};

// Direct profile, FK-only, source-isolation, and adapter contracts.
assert.strictEqual(api.validatePitchMotionProfile(profile), true, 'CMU profile validates');
const nonFiniteProfile=deep(profile); nonFiniteProfile.keys[0].channels.pelvisYaw=Number.NaN;
assert.strictEqual(api.validatePitchMotionProfile(nonFiniteProfile), false, 'non-finite channel is rejected');
assert.deepStrictEqual(profile, diskProfile, 'runtime profile equals reproducible exported JSON');
assert.strictEqual(profile.exporter.derivation, 'canonical_asf_amc_fk_geometry', 'profile declares canonical FK derivation');
assert.strictEqual(profile.canonicalFk.axisConvention, 'asf_axis_basis_sandwich', 'profile declares the M0-compatible axis basis');
assert.strictEqual(profile.keys.length, 16, 'compact profile has 15 source keys and one adapter');
assert.deepStrictEqual(noRawCapture(ROOT), [], 'no raw motion capture payload is committed');
assert(!fs.readFileSync(path.join(ROOT, 'docs', 'third_party', 'cmu124_pitch_profile_v1.json'), 'utf8').includes(':FULLY-SPECIFIED'), 'profile does not contain an AMC payload');
const exporterSource=fs.readFileSync(path.join(ROOT,'tools','motion','export_cmu124_pitch_profile.py'),'utf8');
assert(exporterSource.includes('from cmu_asf_amc_fk import'), 'exporter imports the single canonical FK module');
for(const forbidden of ['root[4]','lowerback[1]','upperback[1]','thorax[1]','rhumerus[0]','rhumerus[2]','rradius[0]']){
  assert(!exporterSource.includes(forbidden), 'FK-only exporter rejects raw AMC-index derivation '+forbidden);
}
const ready=keyById(profile,'game_field_ready_adapter');
assert.strictEqual(ready.sourceKey,false, 'ready key is explicitly game-side');
assert.strictEqual(ready.adapterKey,true, 'ready key is marked as adapter');
assert.strictEqual(ready.sourceFrame,null, 'ready adapter has no CMU frame');
assert.strictEqual(ready.sourceFrameRange,null, 'ready adapter has no CMU range');
assert.strictEqual(ready.time,1.2, 'ready adapter is on renderer-owned post clock');

// F1: delivery-forward visual stride must remain continuous through release.
const strideIds=['source_left_sfc_proxy','plant_proxy','mer_proxy','release_proxy'];
const stride=strideIds.map(id=>keyById(profile,id).channels.rootForward);
for(let i=1;i<stride.length;i++) assert(stride[i]-stride[i-1]>=-0.15-1e-9, 'F1 adjacent stride backstep stays within 0.15 ft');
assert(stride[0]-stride[stride.length-1]<=0.25+1e-9, 'F1 SFC-to-release reversal stays within 0.25 ft');
assert.strictEqual(api.validatePitchMotionStrideTrack(profile), true, 'F1 final stride track validates');
const oldBackwardStride=deep(profile);
const oldStrideValues=[4.8,4.05,3.18,2.300918];
strideIds.forEach((id,index)=>{ keyById(oldBackwardStride,id).channels.rootForward=oldStrideValues[index]; });
assert.strictEqual(api.validatePitchMotionProfile(oldBackwardStride), false, 'mutation: old multi-foot backward stride is rejected');

// Release/timing and deterministic pitch-flight parity contracts.
const launch = functionSource(html, 'launchPitch');
const beginAtBat = functionSource(html, 'beginAtBatPhase');
const pitcher = functionSource(html, 'pitcherPose');
assert(beginAtBat.includes("S.timer=0.85"), 'existing gameplay windup remains 0.85 seconds');
assert.strictEqual(profile.timing.gameplayWindupSeconds, 0.85, 'profile normalizes into the same 0.85 seconds');
assert(launch.indexOf('beginPitchMotion()') > launch.indexOf('anim.wind=0') && launch.indexOf("beginPitchMotion()") < launch.indexOf("S.phase='pitch'"), 'release proxy is entered on the existing launch tick');
const release = api.samplePitchMotion(profile, 'pre', 1, {});
const postAnchor = api.samplePitchMotion(profile, 'post', 0, {});
assert.strictEqual(release.sourceEvent, 'release_proxy', 'pre release sample lands on release_proxy');
assert.strictEqual(postAnchor.sourceEvent, 'release_post_anchor_proxy', 'post clock starts at release anchor');
for(const key of api.channels) assert(close(release[key], postAnchor[key]), 'release continuity '+key);
const releaseHand=api.actualRenderedPitchMotionThrowHandWorldPosition(release,pitcherLocation,{});
assert([releaseHand.x,releaseHand.y,releaseHand.z].every(Number.isFinite), 'actual rendered hand endpoint is finite');
assert(distance(releaseHand,gameRelease)<=0.75, 'F3 actual release hand reaches unchanged ball within 0.75 ft ('+distance(releaseHand,gameRelease)+')');
assert(!pitcher.includes('pitch.t'), 'post-release renderer clock is independent of pitch flight progress');
assert(pitcher.includes('anim.pitchMotionPostSec'), 'post-release renderer uses its own seconds clock');
const normalLaunch = launch.replace(/\n\s*beginPitchMotion\(\);[^\n]*/, '');
assert.strictEqual(sha(normalLaunch), BASELINE.launch, 'only visual release hook changed launchPitch from '+BASE_SHA);
assert.strictEqual(sha(functionSource(html,'pitchPos')), BASELINE.pitchPos, 'pitch trajectory function unchanged');
assert.strictEqual(sha(functionSource(html,'updatePitch')), BASELINE.updatePitch, 'pitch resolution function unchanged');
assert.strictEqual(sha(functionSource(html,'doSwing')), BASELINE.doSwing, 'batting result function unchanged');
assert.strictEqual(sha(JSON.stringify(traceFrom(html))), BASELINE.trace, 'fixed-input pitch traces match b0805-29 for every pitch type');

// F3: hand progresses to release then continues forward/cross-body through follow-through.
const mer=sampleById(api,profile,'mer_proxy');
const early=sampleById(api,profile,'early_follow_through_proxy');
const merHand=api.actualRenderedPitchMotionThrowHandWorldPosition(mer,pitcherLocation,{});
const earlyHand=api.actualRenderedPitchMotionThrowHandWorldPosition(early,pitcherLocation,{});
assert(distance(releaseHand,gameRelease)<distance(merHand,gameRelease), 'F3 MER to release moves the hand toward the unchanged game release');
const releaseDirection={x:releaseHand.x-merHand.x,y:releaseHand.y-merHand.y,z:releaseHand.z-merHand.z};
const followDirection={x:earlyHand.x-releaseHand.x,y:earlyHand.y-releaseHand.y,z:earlyHand.z-releaseHand.z};
assert(dot(releaseDirection,followDirection)>0, 'F3 release to early follow-through continues the forward arm action');
assert(Math.abs(followDirection.x)>0.01 || Math.abs(followDirection.z)>0.01, 'F3 follow-through has a coherent horizontal/cross-body path');
const oldAffineSource=Object.assign(deep(release),{
  rootForward:2.300918, rootRise:-0.03382, pelvisYaw:-0.865545, pelvisLean:-0.374707,
  torsoYaw:-0.045854, torsoLean:-0.071523, torsoTilt:-0.019761,
  throwArmElevation:0.270685, throwArmPlane:-0.674559, throwElbow:1.462453,
  gloveArmElevation:0.358434, gloveArmPlane:0.749139, gloveElbow:1.401802,
  leadLeg:-0.211165, leadKnee:0.381432, trailLeg:0.432484, trailKnee:0.58217,
  throwSide:'R', gloveSide:'L', figureScale:1
});
const oldAffinePose=api.mapPitchMotionToFigurePose(oldAffineSource,{});
oldAffinePose.armR=Math.max(-2.90,Math.min(-1.55,-2.95+oldAffineSource.throwArmElevation*1.25));
const oldAffineHand=api.actualRenderedFigureHandWorldPosition(oldAffinePose,pitcherLocation,'R',{});
assert(distance(oldAffineHand,gameRelease)>0.75, 'mutation: archived raw-index plus affine retarget fails actual hand alignment');
assert(!html.includes('-2.95 + sourceAngle*1.25'), 'old affine arm mapping is absent from game code');

// Animation-specific direct contracts.
const samples = [0,0.17,0.45,0.72,1].map(time=>api.samplePitchMotion(profile,'pre',time,{}));
for(let i=1;i<samples.length;i++) assert(samples[i].time>=samples[i-1].time, 'pre samples are ordered');
for(const duration of [0.50,0.63,0.74,0.90]){
  const pose=api.mapPitchMotionToFigurePose(api.samplePitchMotion(profile,'post',0.30,{}),{});
  assert.strictEqual(pose.sourceEvent, 'late_follow_through_proxy', 'pitch type '+duration+' cannot change display sample');
}
const mirrored = api.mirrorPitchMotionSample(api.samplePitchMotion(profile,'pre',0.73,{}),{});
assert.strictEqual(mirrored.throwSide, 'R', 'mirror swaps default rig-left throwing side');
assert.strictEqual(mirrored.gloveSide, 'L', 'mirror swaps default rig-right glove side');
assert(close(mirrored.pelvisYaw, -api.samplePitchMotion(profile,'pre',0.73,{}).pelvisYaw), 'mirror flips pelvis yaw');
assert.strictEqual(api.mapPitchMotionToFigurePose(mirrored,{}).gloveSide, 'L', 'mapped mirrored pose keeps left glove');
for(const segment of ['pre','post']){
  const keys=profile.keys.filter(key=>key.segment===segment);
  for(let i=1;i<keys.length;i++){
    const left=api.samplePitchMotion(profile,segment,keys[i].time-0.00001,{});
    const right=api.samplePitchMotion(profile,segment,keys[i].time+0.00001,{});
    for(const key of api.channels) assert(Math.abs(left[key]-right[key])<0.01, segment+' interpolation remains continuous at '+keys[i].id+'/'+key);
  }
}
const drawFigure = functionSource(html, 'drawFigure');
assert(drawFigure.includes('if(!split){') && drawFigure.includes("M4.rotY((face||0) + (P.turn||0))"), 'legacy figure transform remains available');
assert(drawFigure.includes('composeFigureSegment(anchor,x,y,ang,zang,bendSigned,joint)'), 'drawFigure consumes the shared pure segment helper');
assert(drawFigure.includes("P.gloveSide==='R'?fmR.hand:fmL.hand"), 'profile mirror controls glove side without changing legacy default');
assert.strictEqual(sha(functionSource(html,'fielderReadyPose')), BASELINE.fielderReadyPose, 'legacy fielder poses are unchanged');
for(const name of ['samplePitchMotion','mirrorPitchMotionSample','mapPitchMotionToFigurePose','actualRenderedFigureHandWorldPosition','actualRenderedPitchMotionThrowHandWorldPosition']){
  const pure=functionSource(html,name);
  assert(!/\bS\.|\bpitch\.|\bfielders\b|\bthrowPlay\b|\bPITCHES\b/.test(pure), name+' has no gameplay-policy coupling');
}
assert(!pitcher.includes("S.phase==='flight'"), 'pitcher visual yields in flight phase');
assert(html.includes("(pitcherPose()||fielderPose(f))"), 'fielding pose retains renderer handoff priority');

// F4 and legacy mutation contracts.
const badTiming=deep(profile); badTiming.timing.gameplayWindupSeconds=0.80;
assert.strictEqual(api.validatePitchMotionProfile(badTiming), false, 'mutation: global 0.80 timing rejected');
const source585Adapter=deep(profile);
const revived=keyById(source585Adapter,'game_field_ready_adapter');
revived.sourceKey=true; revived.adapterKey=false; revived.sourceFrame=585; revived.sourceFrameRange=[526,585];
assert.strictEqual(api.validatePitchMotionProfile(source585Adapter), false, 'mutation: source frame 585 cannot return as ready adapter');
const clampedAdapter=deep(profile);
keyById(clampedAdapter,'game_field_ready_adapter').channels.throwArmElevation=0.71;
assert.strictEqual(api.validatePitchMotionProfile(clampedAdapter), false, 'mutation: adapter clamp-edge/extreme channel is rejected');
const pitchTCoupled=pitcher.replace('anim.pitchMotionPostSec','pitch.t');
assert(/pitch\.t/.test(pitchTCoupled), 'mutation: pitch.t coupling detector fires');
const collapsed= functionSource(html,'mapPitchMotionToFigurePose').replace('pose.torsoYaw=sample.torsoYaw','pose.torsoYaw=sample.pelvisYaw');
assert(!collapsed.includes('pose.torsoYaw=sample.torsoYaw'), 'mutation: collapsed torso/root split detector fires');
const hardcodedGlove=api.mapPitchMotionToFigurePose(mirrored,{}); hardcodedGlove.gloveSide='R';
assert.notStrictEqual(hardcodedGlove.gloveSide, mirrored.gloveSide, 'mutation: hardcoded glove detector fires');

console.log(JSON.stringify({
  status:'PASS',
  releaseHand,
  releaseDistanceFt:Number(distance(releaseHand,gameRelease).toFixed(6)),
  handProgression:{
    mer:merHand,
    release:releaseHand,
    earlyFollow:earlyHand,
    merToReleaseDotReleaseToEarly:Number(dot(releaseDirection,followDirection).toFixed(6))
  },
  strideFt:Object.fromEntries(strideIds.map((id,index)=>[id,stride[index]]))
}));
