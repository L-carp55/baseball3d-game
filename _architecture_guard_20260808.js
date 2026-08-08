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
check('play lifecycle call ratchet <=10',concludeCalls<=10,concludeCalls);

for(const name of ['applyRunnerKeys','updateStealCommands']){
  const body=stripComments(extractFunction(name));
  check(`${name} has no direct goal write`,!/[A-Za-z_$][\w$]*\.goal\s*=(?!=)/.test(body),
    (body.match(/[A-Za-z_$][\w$]*\.goal\s*=(?!=)/g)||[]).length);
}
const manualCalls=count(/\bsetManualGoal\s*\(/g,clean)-1; // subtract definition
check('manual runner decisions use API',manualCalls>=3,manualCalls);
check('runner intent is recorded',/\bintent\s*:\s*runners\.filter/.test(script),'intent field');

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
const selectPos=keysBody.indexOf('if(r.origin>=4 || !selected(r)) return;');
const batterPos=keysBody.indexOf('if(r.origin===0){');
check('selection gate precedes batter special case',selectPos>=0&&batterPos>=0&&selectPos<batterPos,{selectPos,batterPos});

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
const failed=checks.filter(x=>!x.ok);
console.log(JSON.stringify({file,build,metrics:{directGoal,directAutoGoal,directPrimary,directCover,concludeCalls},checks,verdict:failed.length?'FAIL':'PASS'},null,2));
if(failed.length) process.exit(1);
