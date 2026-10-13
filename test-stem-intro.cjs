const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(process.argv[2]||__dirname+'/stem-intro-controls.js','utf8');
const nodes=new Map();function node(){return {hidden:true,disabled:false,textContent:'',setAttribute(){},classList:{add(){},toggle(){}},style:{setProperty(){}},getBoundingClientRect:()=>({left:800,right:980,top:800,bottom:980})};}
let starts=0,plays=0;
const state={phase:'join',mode:'tracks',cameraReady:true,modelReady:true,handReady:true,volumes:[.8,.8,.8,.8],reverb:[0,0,0,0],delay:[0,0,0,0],filter:[0,0,0,0],effectTrack:0};
const ctx=vm.createContext({console,innerWidth:1000,innerHeight:1000,state,audioContext:{},tracks:[0,1,2,3],effectKeys:['reverb','delay','filter','quit'],handDots:[node(),node()],preflight:node(),handPrompt:node(),pauseOverlay:node(),restartButton:node(),endButton:node(),hideOverlay(){},showOverlay(){},updateUI(){},playAll(){},pauseAll(){},pausePerformanceRecording(){},resumePerformanceRecording(){},document:{getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},body:node()},
 resetMixState(){state.mode='tracks';state.volumes.fill(.8);},setVolume(i,v){state.volumes[i]=v;},setSelected(){},applyEffect(i,k,v){state[k][i]=v;},clearEffects(){for(const k of ['reverb','delay','filter'])state[k].fill(0);},restartAll(){plays++;},startMixer(){starts++;state.phase='mix';},enterEffectMode(i){state.mode='effects';state.effectTrack=i;},exitEffectMode(){state.mode='tracks';}});
vm.runInContext(source,ctx);const run=s=>vm.runInContext(s,ctx);
const g=(x=.25,y=.75,ratio=.7)=>({screenX:x,handY:y,palmX:x,palmY:y,pinchRatio:ratio,thumbUp:false});
ctx.sample=g();run('var gate=new StemGestureGate()');
for(let t=0;t<3000;t+=50){ctx.t=t;run('gate.update([sample],t)');assert(!run('gate.ready(t)'));}
run('gate.update([sample],3000)');assert(run('gate.ready(3000)'));
run('gate.update([],3010)');assert(!run('gate.ready(9000)'),'Loss resets auto-start');
run('gate.update([sample],10000);gate.update([sample],14000)');assert(!run('gate.ready(14000)'),'Frozen camera cannot finish countdown');
run('gate.reset()');let last;
// 10,000 noisy frames around an unpinched boundary must not create a pinch.
for(let i=0;i<10000;i++){ctx.sample=g(.49+(i%2)*.02,.75,.32+(i%5)*.015);ctx.t=i*16;last=run('gate.update([sample],t)[0]');assert(!last.pinch);assert.equal(last.zone,0);}
ctx.sample=g(.25,.75,.2);for(let i=0;i<10;i++){ctx.t=160000+i*16;last=run('gate.update([sample],t)[0]');}assert(last.pinch);
ctx.sample=g(.25,.75,.36);ctx.t+=16;assert(run('gate.update([sample],t)[0].pinch'),'Hysteresis holds pinch');
ctx.sample=g(.25,.75,.8);for(let i=0;i<10;i++){ctx.t+=16;last=run('gate.update([sample],t)[0]');}assert(!last.pinch);
run('gate.reset()');ctx.a=g(.2,.7);ctx.b=g(.8,.7);const first=run('gate.update([a,b],0)');const swap=run('gate.update([b,a],16)');assert.equal(first[0].id,swap[1].id);assert.equal(first[1].id,swap[0].id);
run('gate.reset()');ctx.sample=g();run('gate.update([sample],0);gate.update([sample],220)');ctx.sample.thumbUp=true;let fires=0;
for(let t=240;t<=2200;t+=20){ctx.t=t;if(run('gate.update([sample],t)[0].thumbFire'))fires++;}assert.equal(fires,1,'Held thumb fires once');
// Full tutorial exercises real routing and audio state mutations.
run('beginIntro()');assert.equal(state.phase,'intro');assert.deepEqual(state.volumes,[.55,0,0,0]);assert.equal(starts,0);assert.equal(plays,1);
function route(overrides,now){ctx.g={...g(),id:0,zone:0,pinch:false,thumbFire:false,markerScreenX:.25,markerScreenTop:.25,...overrides};ctx.now=now;run('routeStableGesture(g,now)');}
route({pinch:true},1000);route({pinch:true,handY:.85},1100);assert(run('intro.done'));assert(state.volumes[0]>.55);
// The second hand cannot hijack an active drag.
route({id:1,zone:1,pinch:true},1120);assert.equal(state.volumes[1],0);
run('advanceIntro()');assert.equal(run('intro.step'),1);route({thumbFire:true,thumbUp:true},2000);assert.equal(state.mode,'effects');assert(run('intro.done'));
for(const [step,zone,key] of [[2,0,'reverb'],[3,1,'delay'],[4,2,'filter']]){
 run('advanceIntro()');assert.equal(run('intro.step'),step);state.selectedEffect=3;route({zone,pinch:true},step*2000);route({zone,pinch:true,handY:.85},step*2000+100);assert(state[key][0]>.1);assert.equal(state.selectedEffect,zone,'Active effect readout follows the drag');assert(run('intro.done'));
}
run('advanceIntro()');route({zone:3,pinch:true,screenX:.9,handY:.1},11000);assert.equal(state.mode,'effects','Pinch cannot quit');
route({zone:3,thumbFire:true,thumbUp:true,screenX:.9,handY:.1},12000);assert.equal(state.mode,'tracks');assert(run('intro.done'),'Thumb quits even over Next');
run('advanceIntro()');assert.equal(run('intro.step'),6);
route({screenX:.9,handY:.1},13000);route({screenX:.9,handY:.1,pinch:true},13100);route({screenX:.9,handY:.1,pinch:true},13760);
assert.equal(starts,1);assert.equal(state.phase,'mix');assert(!run('intro.active'));assert.deepEqual(state.volumes,[.8,.8,.8,.8]);
// The real pause/resume functions must preserve the tutorial, not enter the song.
const html=fs.readFileSync(__dirname+'/Stem_Flow_Intro.html','utf8');
vm.runInContext(html.slice(html.indexOf('    function pauseGame()'),html.indexOf('    function restartGame()')),ctx);
run('beginIntro();intro.step=4;prepareIntroStep()');assert.equal(state.filter[0],.5);
// 2.5 fps previously reset every frame. Downward motion now succeeds from midrange.
for(let i=0;i<10;i++){ctx.raw=g(.75,i<3?.75:.75-(i-2)*.014,.18);ctx.time=20000+i*400;run('processStableResults([raw],time)');}
assert(state.filter[0]<.5);assert(run('intro.done'),'Slow-camera downward Filter movement completes');
run('prepareIntroStep()');
// Small movements across several grips accumulate; no 10% single-drag requirement.
for(let i=0;i<4;i++){route({zone:2,pinch:true},25000+i*200);route({zone:2,pinch:true,handY:.74},25030+i*200);route({zone:2,pinch:false},25060+i*200);}
assert(run('intro.done'),'Repeated short pinches complete the filter exercise');
run('pauseGame()');assert.equal(state.phase,'paused');assert(nodes.get('introPanel').hidden);assert.equal(nodes.get('skipStepButton').hidden,false);
const step=run('intro.step');run('resumeGame()');assert.equal(state.phase,'intro');assert.equal(run('intro.step'),step);
run('pauseGame();skipIntroStep()');assert.equal(run('intro.step'),5);assert.equal(state.mode,'effects');assert.equal(state.phase,'intro');
run('pauseGame();skipIntroAll()');assert.equal(state.phase,'mix');assert(!run('intro.active'));
run('pauseGame()');assert(nodes.get('skipStepButton').hidden,'Normal pause has no intro skipping');run('resumeGame()');assert.equal(state.phase,'mix');
// No automatic entry before Start, even with hands already visible in the menu.
state.phase='ready';const before=starts;ctx.raw=g();
for(let t=30000;t<=34500;t+=100){ctx.time=t;run('processStableResults([raw],time)');}assert.equal(starts,before);
run("document.getElementById('sessionIntro').checked=false;armSelectedSession()");assert.equal(state.phase,'join');
for(let t=35000;t<38000;t+=100){ctx.time=t;run('processStableResults([raw],time)');assert.equal(starts,before);}
run('processStableResults([raw],38000)');assert.equal(starts,before+1);assert.equal(state.phase,'mix');assert(!run('intro.active'));
state.phase='ready';run("document.getElementById('sessionIntro').checked=true;armSelectedSession()");
for(let t=40000;t<=43000;t+=100){ctx.time=t;run('processStableResults([raw],time)');}assert.equal(state.phase,'intro');
run('intro.step=1;prepareIntroStep();pauseGame();skipIntroStep()');assert.equal(state.mode,'effects','Skipping enter-FX still prepares effects');assert.equal(run('intro.step'),2);
// A detector dropout must not repeatedly destroy a continuous Reverb drag.
run('intro.step=2;prepareIntroStep()');
let frameTime=50000;
function cameraFrame(raw){ctx.raw=raw;ctx.time=frameTime;run('processStableResults(raw,time)');frameTime+=33;}
for(let i=0;i<6;i++)cameraFrame([g(.25,.7,.18)]);
cameraFrame([g(.25,.664,.18)]);
const beforeDrop=state.reverb[0];
cameraFrame([]);
cameraFrame([g(.25,.65,.18)]);
assert.equal(state.reverb[0],beforeDrop,'Reacquisition rebases the drag without a value jump');
for(let i=0;i<12;i++){
  cameraFrame([g(.25,.65-i*.01,.18)]);
  cameraFrame([g(.25,.644-i*.01,.18)]);
  cameraFrame([]);
}
assert(state.reverb[0]<beforeDrop-.05,'Reverb keeps responding despite intermittent empty detections');
assert(run('intro.done'),'Tutorial completion does not freeze adjustment');
cameraFrame([g(.25,.52,.18)]);
cameraFrame([]);
const heldValue=state.reverb[0];
cameraFrame([g(.25,.48,.8)]);
assert.equal(state.reverb[0],heldValue,'An open hand after reacquisition does not continue dragging');
assert.equal(run('dragOwner'),null);
// Loss longer than the grace window releases ownership and cannot carry stale movement.
run('prepareIntroStep()');
for(let i=0;i<6;i++)cameraFrame([g(.25,.7,.18)]);
assert.notEqual(run('dragOwner'),null);
for(let i=0;i<9;i++)cameraFrame([]);
assert.equal(run('dragOwner'),null,'Long loss ends the drag');
cameraFrame([g(.25,.6,.18)]);
assert.equal(state.reverb[0],.5,'New tracking cannot apply old drag displacement');
// A new hand using the same slot must not inherit the old hand's anchor.
run('prepareIntroStep()');
for(let i=0;i<6;i++)cameraFrame([g(.2,.65,.18)]);
cameraFrame([g(.2,.95,.18)]);
assert.equal(state.reverb[0],.5,'Reassigned tracking ID releases the old drag');
console.log('PASS: jitter, tracking loss, intermittent Reverb tracking, slow-camera Filter, cumulative practice, seven tutorial stages, pause/resume, skip-step/skip-all, menu selection, Start-gated countdown, direct song entry.');
