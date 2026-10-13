const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const js=fs.readFileSync(__dirname+'/stem-intro-controls.js','utf8');
const ctx=vm.createContext({});
vm.runInContext(js.slice(0,js.indexOf('const gestureGate')),ctx);
const Gate=vm.runInContext('StemGestureGate',ctx);
const sample=(extra={})=>({screenX:.25,handY:.75,palmX:.25,palmY:.75,pinchRatio:.8,thumbUp:false,...extra});
let gate,time,fires;
function reset(){gate=new Gate();time=0;fires=0;}
function frames(n,extra={},dt=20){let out;for(let i=0;i<n;i++){time+=dt;out=gate.update([sample(extra)],time)[0];fires+=Number(out.thumbFire);}return out;}
function arm(){frames(12);}
reset();frames(80,{thumbUp:true});assert.equal(fires,0,'Entering camera with raised thumb cannot switch');
reset();arm();frames(20,{thumbUp:true});frames(12);assert.equal(fires,0,'Brief false positive cannot switch');
frames(40,{thumbUp:true});assert.equal(fires,1,'Deliberate steady thumb switches');
frames(1);frames(60,{thumbUp:true});assert.equal(fires,1,'One-frame thumb dropout does not rearm');
frames(12);frames(40,{thumbUp:true});assert.equal(fires,2,'Sustained release rearms');
reset();arm();frames(100,{thumbUp:true,screenX:.5});assert.equal(fires,0,'Center boundary cannot switch');
reset();arm();
for(let i=0;i<80;i++)frames(1,{thumbUp:true,palmX:.25+i*.004});
assert.equal(fires,0,'Moving hand cannot switch');
reset();arm();frames(25,{thumbUp:true});frames(25,{thumbUp:true,screenX:.75,palmX:.75});
assert.equal(fires,0,'Hold cannot transfer between quadrants');
reset();arm();frames(10,{pinchRatio:.18});frames(40,{thumbUp:true});assert.equal(fires,0,'Pinch release does not immediately become FX command');
frames(20,{thumbUp:true});assert.equal(fires,1);
gate.lockThumbs();frames(80,{thumbUp:true});assert.equal(fires,1,'Mode lock blocks held thumb');
reset();arm();frames(10,{thumbUp:true},400);assert.equal(fires,0,'Sparse detections cannot establish stable hold');
reset();arm();frames(25,{thumbUp:true});gate.update([],time+20);frames(50,{thumbUp:true});assert.equal(fires,0,'Lost hand must release before switching');
reset();arm();frames(1,{pinchRatio:.18});const pinched=frames(4,{pinchRatio:.18});assert(pinched.pinch,'Pinch engages within 80ms at 50fps');
const moved=frames(1,{screenX:.35,pinchRatio:.18});assert(moved.screenX>.29,'Position responds on the next sample');

// Exercise the actual landmark classifier, including sideways fists and pinches.
const html=fs.readFileSync(__dirname+'/Stem_Flow_Intro.html','utf8');
vm.runInContext(html.slice(html.indexOf('    function fingerExtended('),html.indexOf('    function getZoneTrackIndex(')),ctx);
const points=Array.from({length:21},()=>({x:.5,y:.55}));
points[0]={x:.5,y:.85};points[5]={x:.4,y:.6};points[17]={x:.6,y:.6};
points[2]={x:.38,y:.6};points[3]={x:.38,y:.45};points[4]={x:.38,y:.3};
for(const tip of [8,12,16,20]){points[tip-2]={x:.5,y:.5};points[tip]={x:.5,y:.65};}
function classify(p){ctx.points=p;return vm.runInContext('readGesture(points)',ctx).thumbUp;}
assert(classify(points),'Clear upright thumb is accepted');
const sideways=structuredClone(points);sideways[3]={x:.3,y:.56};sideways[4]={x:.18,y:.52};
assert(!classify(sideways),'Sideways thumb is rejected');
const pointing=structuredClone(points);pointing[8]={x:.5,y:.25};assert(!classify(pointing),'Extended index is rejected');
const pinch=structuredClone(points);pinch[8]={x:.39,y:.31};assert(!classify(pinch),'Pinch is not a thumb command');
console.log('PASS: deliberate thumb, brief false positives, release jitter, boundary/motion, quadrant changes, pinch transitions, mode lock, sparse/lost tracking, responsive pinch, landmark pose checks.');
