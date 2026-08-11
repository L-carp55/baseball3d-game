"use strict";
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(process.argv[2]||'baseball3d.html','utf8');
const js=html.split('<script>')[1].split('</script>')[0];

function extract(name){
  const start=js.indexOf(`function ${name}(`); if(start<0) throw new Error('missing '+name);
  const brace=js.indexOf('{',start); let d=0,q=null,esc=false,line=false,block=false;
  for(let i=brace;i<js.length;i++){
    const c=js[i],n=js[i+1];
    if(line){if(c==='\n')line=false;continue;}
    if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
    if(q){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===q)q=null;continue;}
    if(c==='/'&&n==='/'){line=true;i++;continue;}
    if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==='"'||c==="'"||c==='`'){q=c;continue;}
    if(c==='{')d++; else if(c==='}'&&--d===0)return js.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const ctx={console,Math,Number};vm.createContext(ctx);
vm.runInContext(extract('bounceVerticalSpeed'),ctx);
const apex=v=>v*v/(2*32.2);

assert(html.includes("const BUILD = 'b0805-29a';"),'wrong build label');
assert(html.includes('const reboundVz=bounceVerticalSpeed(b,b.vz)') &&
       html.includes('b.landed=true; b.vz=reboundVz'),
  'production impact path bypasses bounce helper or does not persist impact state');
assert(!html.includes('b.vz=-b.vz*0.55'),'universal 0.55 rebound still present');
assert((html.match(/landed:ball\.landed,maxZ:ball\.maxZ,la:ball\.la/g)||[]).length>=2,
  'prediction clones do not carry impact metadata');

const oldHigh=50*0.55;
assert(apex(oldHigh)>9.4,'fixture no longer proves old high-fly fence-clearing bounce');
const high=ctx.bounceVerticalSpeed({landed:false,maxZ:45,la:28},-50);
assert(high<=14.000001,'high fly rebound cap exceeded');
assert(apex(high)<9.4,'high fly first bounce can still clear 9.4 ft fence');

const medium=ctx.bounceVerticalSpeed({landed:false,maxZ:13,la:12},-38);
assert(medium<=16.000001&&apex(medium)<9.4,'medium air first bounce remains fence-clearing');
const ground=ctx.bounceVerticalSpeed({landed:false,maxZ:4,la:-6},-18);
assert(ground>=9.8&&apex(ground)>1.4,'visible low-angle ground-ball hop was removed');

assert(html.includes("if(dir<0) return {mode:'head',base,dir};"),'ordinary return slide contract missing');
assert(html.includes("return {lean:1.18,crouch:0,rise:0.34,glove:false"),'head-first pose still uses underground offset');
assert(html.includes("return {lean:-0.72,crouch:0,rise:0.18,glove:false"),'feet-first pose still uses underground offset');

console.log('b0805-29a entitlement bounce / slide owner contracts PASS');
