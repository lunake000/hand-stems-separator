const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
// Install @napi-rs/canvas locally, or set NODE_PATH to a directory containing it.
const {createCanvas}=require('@napi-rs/canvas');
const html=fs.readFileSync(__dirname+'/Stem_Flow_Intro.html','utf8');
function section(from,to){return html.slice(html.indexOf(from),html.indexOf(to,html.indexOf(from)));}
const layer=createCanvas(512,512),L=layer.getContext('2d');
const gradient=L.createRadialGradient(256,256,0,256,256,240);
gradient.addColorStop(0,'white');gradient.addColorStop(.3,'#ffac32');gradient.addColorStop(1,'transparent');
L.fillStyle=gradient;L.fillRect(0,0,512,512);
const output=createCanvas(512,512),dst=output.getContext('2d');
const slot={layer};
const ctx=vm.createContext({makeCanvas:size=>createCanvas(size,size),dst,slot});
vm.runInContext(section('    function drawReverbFog(', '    function ringStroke('),ctx);
for(const value of [0,.41,1]){
  ctx.f=value;dst.clearRect(0,0,512,512);vm.runInContext('drawReverbFog(slot,f)',ctx);
  assert.equal(slot.fogBlur.width,128);
  assert(dst.getImageData(256,256,1,1).data[3]>0,'Fog texture is not blank');
  assert.equal(dst.globalAlpha,1);
}
const cached=slot.fogBlur;
vm.runInContext('drawReverbFog(slot,.5)',ctx);assert.equal(slot.fogBlur,cached,'Reuse buffers');
const frames=80;
const old=()=>{dst.filter='blur(20px) brightness(1.25)';dst.drawImage(layer,-10.24,-10.24,532.48,532.48);dst.filter='none';};
const next=()=>vm.runInContext('drawReverbFog(slot,1)',ctx);
function bench(fn){const start=performance.now();for(let i=0;i<frames;i++){dst.clearRect(0,0,512,512);fn();}return (performance.now()-start)/frames;}
old();next();const before=bench(old),after=bench(next);
const filterSlot={key:'vocals',kind:'filter',clock:0,shown:0};
let activeReads=0;
const guard=vm.createContext({slots:[filterSlot],orbEls:[{getBoundingClientRect:()=>({width:200})}],
  stemMotion:new Proxy({}, {get(){activeReads++;throw new Error('active-render');}})});
vm.runInContext(section('    function renderZone(', '    let lastVisualTick='),guard);
for(let i=0;i<100;i++)vm.runInContext("renderZone(0,'vocals','filter',0,1/30,1)",guard);
assert.equal(activeReads,0,'Zero filter skips active rendering');
assert.throws(()=>vm.runInContext("renderZone(0,'vocals','filter',.5,1/30,1)",guard),/active-render/);
filterSlot.shown=.5;
assert.throws(()=>vm.runInContext("renderZone(0,'vocals','filter',0,1/30,1)",guard),/active-render/,'Fade-out remains visible');
console.log(`PASS: nonblank fog at 0/41/100%, buffer reuse, zero-filter skip, active filter and fade-out retained. Native canvas blur benchmark: ${before.toFixed(2)} -> ${after.toFixed(2)} ms/frame (not browser FPS).`);
