"use strict";
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('baseball3d.html','utf8');
const js=html.split('<script>')[1].split('</script>')[0];
function extract(name){
  const start=js.indexOf(`function ${name}(`); if(start<0)throw new Error('missing '+name);
  const brace=js.indexOf('{',start);let d=0,q=null,esc=false,line=false,block=false;
  for(let i=brace;i<js.length;i++){const c=js[i],n=js[i+1];
    if(line){if(c==='\n')line=false;continue} if(block){if(c==='*'&&n==='/'){block=false;i++}continue}
    if(q){if(esc){esc=false;continue}if(c==='\\'){esc=true;continue}if(c===q)q=null;continue}
    if(c==='/'&&n==='/'){line=true;i++;continue}if(c==='/'&&n==='*'){block=true;i++;continue}
    if(c==='"'||c==="'"||c==='`'){q=c;continue}if(c==='{')d++;if(c==='}'&&--d===0)return js.slice(start,i+1);
  } throw new Error('unterminated '+name);
}
const ctx={};vm.createContext(ctx);vm.runInContext(extract('classifyBattedBallAtContact'),ctx);
const c=ctx.classifyBattedBallAtContact;
function assert(x,m){if(!x)throw new Error(m)}
assert(c({la:9})==='ライナー','9 degree must stay liner');
assert(c({la:11})==='ライナー','11 degree must stay liner');
assert(c({la:-9})==='ゴロ','negative angle must be grounder');
assert(c({la:24})==='フライ','24 degree must be fly');
assert(c({la:49})==='ポップフライ','49 degree must be popup');
assert(js.includes('battedType:classifyBattedBallAtContact(c)'),'launch identity not stored');
assert(js.includes("battedType:(ball&&ball.battedType)"),'throw phase loses identity');
assert(js.includes('${battedBy}${battedType} アウト'),'infield result loses identity');
assert(js.includes("bt:ball.battedType||''"),'recorder omits identity');
console.log('targeted b0805-26 batted-ball identity PASS');
