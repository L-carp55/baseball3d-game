"use strict";
const fs=require('fs');
const path=require('path');
const file=process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname,'baseball3d.html');
const html=fs.readFileSync(file,'utf8');
const script=(html.split('<script>')[1]||'').split('</script>')[0];
if(!script) throw new Error('main script not found');

function stripComments(s){
  return s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
}
function extractFunction(name){
  const start=script.indexOf(`function ${name}(`);
  if(start<0) throw new Error(`function ${name} missing`);
  const brace=script.indexOf('{',start); let d=0,q=null,esc=false,line=false,block=false;
  for(let i=brace;i<script.length;i++){
    const c=script[i],n=script[i+1];
    if(line){if(c==='\n')line=false;continue;}
    if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
    if(q){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===q)q=null;continue;}
    if(c==='"'||c==="'"||c==='`'){q=c;continue;}
    if(c==='/'&&n==='/'){line=true;i++;continue;}
    if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==='{')d++; else if(c==='}'&&--d===0)return script.slice(start,i+1);
  }
  throw new Error(`function ${name} unterminated`);
}
function count(re,s){return (s.match(re)||[]).length;}
const clean=stripComments(script);
const checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});}

const build=(script.match(/const BUILD = '([^']+)'/)||[])[1];
check('BUILD stamp present',/^b\d{4}-\d+$/.test(build||''),build);

const directGoal=count(/\b[A-Za-z_$][\w$]*\.goal\s*=(?!=)/g,clean);
const directAutoGoal=count(/\b[A-Za-z_$][\w$]*\.autoGoal\s*=(?!=)/g,clean);
const directPrimary=count(/\b(?:ball|[A-Za-z_$][\w$]*)\.primary\s*=(?!=)/g,clean);
const directCover=count(/\b[A-Za-z_$][\w$]*\.coverBase\s*=(?!=)/g,clean);
const concludeCalls=Math.max(0,count(/\bconcludePlay\s*\(/g,clean)-1); // subtract definition
check('runner goal has exactly one writer',directGoal===1,directGoal);
check('runner autoGoal has exactly one writer',directAutoGoal===1,directAutoGoal);
const intentBody=stripComments(extractFunction('setRunnerIntent'));
check('goal writer lives inside setRunnerIntent',
  count(/\b[A-Za-z_$][\w$]*\.goal\s*=(?!=)/g,intentBody)===1,
  (intentBody.match(/\b[A-Za-z_$][\w$]*\.goal\s*=(?!=)/g)||[]).length);
check('autoGoal writer lives inside setRunnerIntent',
  count(/\b[A-Za-z_$][\w$]*\.autoGoal\s*=(?!=)/g,intentBody)===1,
  (intentBody.match(/\b[A-Za-z_$][\w$]*\.autoGoal\s*=(?!=)/g)||[]).length);
check('fielding primary has exactly two writes in setPrimaryFielder',directPrimary===2,directPrimary);
const primaryBody=stripComments(extractFunction('setPrimaryFielder'));
check('all primary writes live in setPrimaryFielder',
  count(/\b(?:ball|[A-Za-z_$][\w$]*)\.primary\s*=(?!=)/g,primaryBody)===2,
  (primaryBody.match(/\b(?:ball|[A-Za-z_$][\w$]*)\.primary\s*=(?!=)/g)||[]).length);
check('coverBase has exactly two writes in assignment API',directCover===2,directCover);
const clearCoverBody=stripComments(extractFunction('clearCoverRole'));
const assignCoverBody=stripComments(extractFunction('assignCoverRole'));
check('cover clear writer lives in clearCoverRole',
  count(/\b[A-Za-z_$][\w$]*\.coverBase\s*=(?!=)/g,clearCoverBody)===1,
  (clearCoverBody.match(/\b[A-Za-z_$][\w$]*\.coverBase\s*=(?!=)/g)||[]).length);
check('cover assign writer lives in assignCoverRole',
  count(/\b[A-Za-z_$][\w$]*\.coverBase\s*=(?!=)/g,assignCoverBody)===1,
  (assignCoverBody.match(/\b[A-Za-z_$][\w$]*\.coverBase\s*=(?!=)/g)||[]).length);
check('concludePlay is callable only from PlayLifecycle gateway',concludeCalls===1,concludeCalls);

for(const name of ['applyRunnerKeys','updateStealCommands']){
  const body=stripComments(extractFunction(name));
  check(`${name} has no direct goal write`,!/[A-Za-z_$][\w$]*\.goal\s*=(?!=)/.test(body),
    (body.match(/[A-Za-z_$][\w$]*\.goal\s*=(?!=)/g)||[]).length);
}
const manualCalls=count(/\bsetManualGoal\s*\(/g,clean)-1; // subtract definition
check('manual runner decisions use API',manualCalls>=3,manualCalls);
check('runner intent is recorded',/\bintent\s*:\s*runners\.filter/.test(script),'intent field');
check('manual runner intent survives one-base command consumption',
  /manualIntentLocked/.test(intentBody)&&/r\.cmd\|\|r\.manualIntentLocked/.test(intentBody),
  'play-scoped manual lock');

for(const name of ['runnerObservedDir','containmentBaseForTrailingRunner','chooseThrowTarget','judgeAtBase']){
  const body=stripComments(extractFunction(name));
  check(`${name} does not read runner goal/cmd`,!/\br\.goal\b|\br\.cmd\b/.test(body),
    (body.match(/\br\.(?:goal|cmd)\b/g)||[]));
  check(`${name} does not read legacy dir`,!/\br\.dir\b/.test(body),(body.match(/\br\.dir\b/g)||[]).length);
}
const dirUses=[];
clean.split('\n').forEach((line,i)=>{if(/\br\.dir\b/.test(line))dirUses.push({line:i+1,text:line.trim()});});
check('legacy dir is write-only inside updateRunners',dirUses.length===1&&/r\.dir\s*=/.test(dirUses[0].text),dirUses);

const keysBody=stripComments(extractFunction('applyRunnerKeys'));
const manualTagPos=keysBody.indexOf('if(tagPhase && (go||back)){');
const genericBackPos=keysBody.indexOf('if(back) live.forEach');
check('high-fly manual S/X uses shared selection and manual intent',
  manualTagPos>=0 && genericBackPos>manualTagPos &&
  /!selected\(r\)/.test(keysBody) && count(/setManualGoal\s*\(/g,keysBody)>=4,
  {manualTagPos,genericBackPos,manualCallsInKeys:count(/setManualGoal\s*\(/g,keysBody)});
check('runner controls expose all/lead/trail advance-return pairs',
  /held\['a'\]/.test(keysBody)&&/held\['c'\]/.test(keysBody)&&/held\['d'\]/.test(keysBody)&&
  /advanceTrail/.test(keysBody)&&/returnTrail/.test(keysBody),
  'S/X all, Z/A lead, C/D trail');
const slideBody=stripComments(extractFunction('updateRunnerSlide'));
check('runner sliding is centralized and rendered',
  /desiredRunnerSlide\s*\(/.test(slideBody)&&/runnerSlidePose\s*\(r\)/.test(script)&&
  /slideMode/.test(script)&&/slideBase/.test(script),
  'slide policy + pose + recording');

const runTimeUses=count(/\brunTime\s*\(/g,clean);
check('runTime is only defined and used inside reachTravelTime',runTimeUses===2,runTimeUses);
const travelBody=stripComments(extractFunction('reachTravelTime'));
check('reachTravelTime owns runTime usage',count(/\brunTime\s*\(/g,travelBody)===1,
  (travelBody.match(/\brunTime\s*\(/g)||[]).length);
for(const name of ['interceptPoint','routeProb','planPlay','coverArrival']){
  const body=stripComments(extractFunction(name));
  check(`${name} uses ReachModel`,/reachTimeToPoint\s*\(/.test(body),name);
  check(`${name} has no direct runTime`,!/\brunTime\s*\(/.test(body),name);
}
const rundownBody=stripComments(extractFunction('rundownCover'));
check('rundownCover uses constrained candidate API',/findCoverCandidate\(/.test(rundownBody)&&!/\.coverBase\s*=/.test(rundownBody),'candidate API');
const wallGuard=/if\(handoff\.changed\) return false;/.test(script);
check('wall handoff ends stale-primary tick',wallGuard,wallGuard);
const resetBody=stripComments(extractFunction('resetFielders'));
check('reset clears all fielding assignments',/clearFieldingAssignments\(/.test(resetBody),'reset boundary');
const retargetBody=stripComments(extractFunction('shouldAdoptFieldingTarget'));
check('retarget adoption uses ReachModel',/fieldingTargetETA\(/.test(retargetBody)&&/targetPassedByBall\(/.test(retargetBody),'ReachModel + passed-target');
const flightBody=stripComments(extractFunction('stepFlight'));
check('stepFlight routes dynamic aim through retarget gate',count(/retargetFielder\s*\(/g,flightBody)>=2,
  (flightBody.match(/retargetFielder\s*\(/g)||[]).length);
check('stepFlight has no legacy direct dynamic target writes',
  !/setTarget\(prim,\s*b2\.x/.test(flightBody)&&!/setTarget\(prim,\s*ip\[0\]/.test(flightBody),'retarget gate');
const throwWrites=count(/\b(?:T|throwPlay)\.target\s*=(?!=)/g,clean);
check('throw target has exactly one post-construction writer',throwWrites===1,throwWrites);
const setThrowBody=stripComments(extractFunction('setThrowTarget'));
check('throw target writer lives in setThrowTarget',count(/\bT\.target\s*=(?!=)/g,setThrowBody)===1,
  (setThrowBody.match(/\bT\.target\s*=(?!=)/g)||[]).length);
const chooseCalls=count(/\bchooseThrowTarget\s*\(/g,clean);
check('chooseThrowTarget is only definition plus ThrowDecision internals',chooseCalls===2,chooseCalls);
const decisionBody=stripComments(extractFunction('decideThrowTarget'));
check('ThrowDecision owns automatic target selection',/chooseThrowTarget\s*\(/.test(decisionBody),'decision boundary');
const selectorBody=stripComments(extractFunction('selectDefenseAction'));
check('defense actions use one comparison primitive',/utility/.test(selectorBody)&&/viable\.sort/.test(selectorBody),'shared action selector');
const chooseBody=stripComments(extractFunction('chooseThrowTarget'));
check('throw policy compares only current visible threats',/visibleRunnerThreat/.test(chooseBody)&&/selectDefenseAction/.test(chooseBody)&&!/for\s*\(let b=/.test(chooseBody),'current-threat comparison');
const threatActionBody=stripComments(extractFunction('throwActionForThreat'));
const forceChainBody=stripComments(extractFunction('doublePlayContinuation'));
check('throw action values double-play continuation',/doublePlayContinuation\s*\(/.test(threatActionBody),'force-chain call');
check('force-chain models relay expected outs',/relayProbability/.test(forceChainBody)&&/expectedOuts/.test(forceChainBody)&&/coverBase===2/.test(forceChainBody),'relay expected-outs model');
check('relay possession is re-evaluated',!/o\.relayed\s*\|\|/.test(decisionBody)&&!/relay-fixed/.test(decisionBody),'no stale relay lock');
const catchPolicyBody=stripComments(extractFunction('planCatchAction'));
check('catch policy compares wait/routine/jump/dive',/findRoutineCatchWindow/.test(catchPolicyBody)&&/selectDefenseAction/.test(catchPolicyBody),'catch alternatives');
check('stepFlight consumes catch policy',count(/planCatchAction\s*\(/g,flightBody)>=2,(flightBody.match(/planCatchAction\s*\(/g)||[]).length);
const rundownPolicyBody=stripComments(extractFunction('planRundownAction'));
const updateRundownBody=stripComments(extractFunction('updateRundown'));
check('rundown policy compares chase and throw',/selectDefenseAction/.test(rundownPolicyBody)&&/rundownOtherAdvanceRisk/.test(rundownPolicyBody),'rundown alternatives');
check('rundown no longer uses random distance trigger',/planRundownAction/.test(updateRundownBody)&&!/R\.trig/.test(updateRundownBody),'ETA policy');
check('defense decision diagnostics are recorded',/decisionReason/.test(script)&&/catchMode/.test(script)&&/actionReason/.test(script),'decision audit');
const manualBody=stripComments(extractFunction('setManualThrow'));
check('manual throw uses ThrowDecision writer',/setThrowTarget\s*\(/.test(manualBody)&&!/throwPlay\.target\s*=/.test(manualBody),'manual boundary');
check('throw decision is recorded',/decisionSource/.test(script)&&/decisionSeq/.test(script),'decision audit');
const lifecycleBody=stripComments(extractFunction('playLifecycleState'));
check('PlayLifecycle blocks live throws',/T\.stage==='fly'/.test(lifecycleBody)&&/liveBall/.test(lifecycleBody),'live throw gate');
check('PlayLifecycle has third-out override',/canClose=thirdOut\s*\|\|/.test(lifecycleBody),'third out');
const requestBody=stripComments(extractFunction('requestPlayConclusion'));
check('PlayLifecycle gateway owns final conclusion',/playLifecycleState\s*\(/.test(requestBody)&&/concludePlay\s*\(false\)/.test(requestBody),'gateway');
check('force conclusion bypass removed',!/concludePlay\s*\(\s*true\s*\)/.test(clean),'no force bypass');
const throwPhaseBody=stripComments(extractFunction('updateThrowPhase'));
check('watchdog uses lifecycle gateway',clean.includes("requestPlayConclusion('watchdog')")&&concludeCalls===1,'watchdog gateway');
check('rejected pre-physics conclusion falls through',!/allSettled\)\s*return requestPlayConclusion/.test(clean),'no frozen live throw');
check('play lifecycle is recorded',/lifecycleSource/.test(script)&&/lifecycleSeq/.test(script)&&/lifecycleReason/.test(script),'lifecycle audit');
const endRundownBody=stripComments(extractFunction('endRundown'));
check('endRundown settles temporary rundown intent',/settleRundownExitIntent\s*\(T\)/.test(endRundownBody),'rundown exit boundary');
const settleBody=stripComments(extractFunction('settleRundownExitIntent'));
check('rundown exit writes legal base through RunnerIntent',/setRunnerIntent\s*\(/.test(settleBody)&&/R\.lo/.test(settleBody)&&/R\.hi/.test(settleBody),'legal base intent');
const failed=checks.filter(x=>!x.ok);
console.log(JSON.stringify({file,build,metrics:{directGoal,directAutoGoal,directPrimary,directCover,concludeCalls},checks,verdict:failed.length?'FAIL':'PASS'},null,2));
if(failed.length) process.exit(1);
