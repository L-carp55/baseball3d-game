"use strict";
const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||'baseball3d.html','utf8');
const js=html.split('<script>')[1].split('</script>')[0];
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

assert(js.includes('const reboundVz=bounceVerticalSpeed(b,b.vz);'),
  'first-impact rebound is not calculated before landed state is written');
assert(js.includes('b.landed=true; b.vz=reboundVz;'),
  'shared physics does not persist a hard-impact landing');
assert(js.includes('b.landed=true; b.vz=0;'),
  'shared physics does not persist a soft-impact landing');
assert((js.match(/landed:ball\.landed,maxZ:ball\.maxZ,la:ball\.la/g)||[]).length>=2,
  'prediction clones do not inherit trajectory/impact metadata');

console.log('b0805-29a shared bounce landed-state PASS');
