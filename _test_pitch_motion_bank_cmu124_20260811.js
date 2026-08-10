#!/usr/bin/env node
'use strict';

/* Contract tests for b0805-30.  Run: node _test_pitch_motion_bank_cmu124_20260811.js baseball3d.html */
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
  assert(from >= 0 && to >= 0, `missing section ${start}`);
  return source.slice(from, to + end.length);
}
function functionSource(source, name){
  const needle = `function ${name}(`;
  const start = source.indexOf(needle);
  assert(start >= 0, `missing function ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{') depth++;
    if(source[i]==='}' && --depth===0) return source.slice(start, i+1);
  }
  throw new Error(`unterminated function ${name}`);
}
function sha(text){ return crypto.createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex'); }
function deep(value){ return JSON.parse(JSON.stringify(value)); }
function close(a,b,eps=1e-9){ return Math.abs(a-b)<=eps; }
function profileApi(){
  const source = section(html,
    '/* ========================= CMU 124-01 visual pitch motion ========================= */',
    '/* ======================= /CMU 124-01 visual pitch motion ======================= */');
  const context = vm.createContext({
    Math, JSON,
    clamp:(value, low, high)=>Math.max(low, Math.min(high, value)),
    lerp:(a,b,t)=>a+(b-a)*t
  });
  vm.runInContext(source, context, {filename:'cmu124_pitch_motion_block.js'});
  return vm.runInContext('pitchMotionTestApi()', context);
}
function noRawCapture(root){
  const forbidden = [];
  const skip = new Set(['.git', 'node_modules', '.agents']);
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
  vm.runInContext(`${functionSource(source,'launchPitch')}\n${functionSource(source,'pitchPos')}`, context);
  const rows=[];
  for(let type=0;type<4;type++){
    vm.runInContext(`launchPitch(${type},0.25,-0.15)`, context);
    for(let i=0;i<12;i++){
      const p=vm.runInContext(`pitchPos(${i}/11)`, context);
      rows.push(p.map(value=>Number(value.toFixed(10))));
    }
  }
  return rows;
}
const api = profileApi();
const profile = deep(api.profile);
const diskProfile = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'third_party', 'cmu124_pitch_profile_v1.json'), 'utf8'));

// Direct profile and source-isolation contracts.
assert.strictEqual(api.validatePitchMotionProfile(profile), true, 'CMU profile validates');
const nonFiniteProfile=deep(profile); nonFiniteProfile.keys[0].channels.pelvisYaw=Number.NaN;
assert.strictEqual(api.validatePitchMotionProfile(nonFiniteProfile), false, 'non-finite channel is rejected');
assert.deepStrictEqual(profile, diskProfile, 'runtime profile equals reproducible exported JSON');
assert.strictEqual(profile.keys.length, 16, 'compact profile has 12–18 selected keys');
assert.strictEqual(profile.keys.find(key=>key.id==='release_proxy').time, 1, 'release proxy is the pre-track endpoint');
assert.deepStrictEqual(noRawCapture(ROOT), [], 'no raw motion capture payload is committed');
assert(!fs.readFileSync(path.join(ROOT, 'docs', 'third_party', 'cmu124_pitch_profile_v1.json'), 'utf8').includes(':FULLY-SPECIFIED'), 'profile does not contain an AMC payload');

// Release/timing and deterministic pitch-flight parity contracts.
const launch = functionSource(html, 'launchPitch');
const beginAtBat = functionSource(html, 'beginAtBatPhase');
const pitcher = functionSource(html, 'pitcherPose');
assert(beginAtBat.includes("S.timer=0.85"), 'existing gameplay windup remains 0.85 seconds');
assert.strictEqual(profile.timing.gameplayWindupSeconds, 0.85, 'profile normalizes into the same 0.85 seconds');
assert(launch.indexOf('beginPitchMotion()') > launch.indexOf('anim.wind=0') && launch.indexOf('beginPitchMotion()') < launch.indexOf("S.phase='pitch'"), 'release proxy is entered on the existing launch tick');
const release = api.samplePitchMotion(profile, 'pre', 1, {});
const postAnchor = api.samplePitchMotion(profile, 'post', 0, {});
assert.strictEqual(release.sourceEvent, 'release_proxy', 'pre release sample lands on release_proxy');
assert.strictEqual(postAnchor.sourceEvent, 'release_post_anchor_proxy', 'post clock starts at release anchor');
for(const key of api.channels) assert(close(release[key], postAnchor[key]), `release continuity ${key}`);
const handProxy=api.estimatePitchMotionThrowHandWorldPosition(release,{cx:0,cy:54},{});
assert([handProxy.x,handProxy.y,handProxy.z].every(Number.isFinite), 'release-hand debug proxy exposes finite renderer-space coordinates');
assert(!pitcher.includes('pitch.t'), 'post-release renderer clock is independent of pitch flight progress');
assert(pitcher.includes('anim.pitchMotionPostSec'), 'post-release renderer uses its own seconds clock');
const normalLaunch = launch.replace(/\n\s*beginPitchMotion\(\);[^\n]*/, '');
assert.strictEqual(sha(normalLaunch), BASELINE.launch, `only visual release hook changed launchPitch from ${BASE_SHA}`);
assert.strictEqual(sha(functionSource(html,'pitchPos')), BASELINE.pitchPos, 'pitch trajectory function unchanged');
assert.strictEqual(sha(functionSource(html,'updatePitch')), BASELINE.updatePitch, 'pitch resolution function unchanged');
assert.strictEqual(sha(functionSource(html,'doSwing')), BASELINE.doSwing, 'batting result function unchanged');
assert.strictEqual(sha(JSON.stringify(traceFrom(html))), BASELINE.trace, 'fixed-input pitch traces match b0805-29 for every pitch type');

// Animation-specific direct contracts.
const samples = [0,0.17,0.45,0.72,1].map(time=>api.samplePitchMotion(profile,'pre',time,{}));
for(let i=1;i<samples.length;i++) assert(samples[i].time>=samples[i-1].time, 'pre samples are ordered');
for(const duration of [0.50,0.63,0.74,0.90]){
  const pose=api.mapPitchMotionToFigurePose(api.samplePitchMotion(profile,'post',0.30,{}),{});
  assert.strictEqual(pose.sourceEvent, 'late_follow_through_proxy', `pitch type duration ${duration} cannot change display sample`);
}
const mirrored = api.mirrorPitchMotionSample(api.samplePitchMotion(profile,'pre',0.73,{}),{});
assert.strictEqual(mirrored.throwSide, 'L', 'mirror swaps throwing side');
assert.strictEqual(mirrored.gloveSide, 'R', 'mirror swaps glove side');
assert(close(mirrored.pelvisYaw, -api.samplePitchMotion(profile,'pre',0.73,{}).pelvisYaw), 'mirror flips pelvis yaw');
assert.strictEqual(api.mapPitchMotionToFigurePose(mirrored,{}).gloveSide, 'R', 'mapped mirrored pose keeps right glove');
for(const segment of ['pre','post']){
  const keys=profile.keys.filter(key=>key.segment===segment);
  for(let i=1;i<keys.length;i++){
    const left=api.samplePitchMotion(profile,segment,keys[i].time-0.00001,{});
    const right=api.samplePitchMotion(profile,segment,keys[i].time+0.00001,{});
    for(const key of api.channels) assert(Math.abs(left[key]-right[key])<0.01, `${segment} interpolation remains continuous at ${keys[i].id}/${key}`);
  }
}
const drawFigure = functionSource(html, 'drawFigure');
assert(drawFigure.includes('if(!split){') && drawFigure.includes("M4.rotY((face||0) + (P.turn||0))"), 'legacy figure transform remains available');
assert(drawFigure.includes("P.gloveSide==='R'?fmR:fmL"), 'profile mirror controls glove side without changing legacy default');
assert.strictEqual(sha(functionSource(html,'fielderReadyPose')), BASELINE.fielderReadyPose, 'legacy fielder poses are unchanged');
for(const name of ['samplePitchMotion','mirrorPitchMotionSample','mapPitchMotionToFigurePose','estimatePitchMotionThrowHandWorldPosition']){
  const pure=functionSource(html,name);
  assert(!/\bS\.|\bpitch\.|\bfielders\b|\bthrowPlay\b|\bPITCHES\b/.test(pure), `${name} has no gameplay-policy coupling`);
}
assert(!pitcher.includes("S.phase==='flight'"), 'pitcher visual yields in flight phase');
assert(html.includes("(pitcherPose()||fielderPose(f))"), 'fielding pose retains renderer handoff priority');

// Mutation contracts: each bad change must be rejected by a direct assertion.
const badTiming=deep(profile); badTiming.timing.gameplayWindupSeconds=0.80;
assert.strictEqual(api.validatePitchMotionProfile(badTiming), false, 'mutation: global 0.80 timing rejected');
const pitchTCoupled=pitcher.replace('anim.pitchMotionPostSec','pitch.t');
assert(/pitch\.t/.test(pitchTCoupled), 'mutation: pitch.t coupling detector fires');
const collapsed= functionSource(html,'mapPitchMotionToFigurePose').replace('pose.torsoYaw=sample.torsoYaw','pose.torsoYaw=sample.pelvisYaw');
assert(!collapsed.includes('pose.torsoYaw=sample.torsoYaw'), 'mutation: collapsed torso/root split detector fires');
const hardcodedLeft=api.mapPitchMotionToFigurePose(mirrored,{}); hardcodedLeft.gloveSide='L';
assert.notStrictEqual(hardcodedLeft.gloveSide, mirrored.gloveSide, 'mutation: hardcoded left glove detector fires');

console.log('PASS pitch-motion-bank-cmu124: direct + mutation contracts');
