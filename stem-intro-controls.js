// Pure temporal tracking, shared by the single-file game and synthetic tests.
class StemGestureGate {
  constructor() { this.slots = [null, null]; this.presentSince = null; this.lastFrame = null; this.sequence=0; }
  reset() { this.slots = [null, null]; this.presentSince = null; this.lastFrame = null; }
  lockThumbs() {
    this.slots.forEach(s => { if(s) { s.thumbLatched=true;s.releaseSince=null;s.thumbSince=null;s.thumbFrames=0; } });
  }
  update(input, now) {
    if (this.lastFrame !== null && now - this.lastFrame > 900) this.reset();
    this.lastFrame = now;
    const valid = input.filter(g => [g.screenX,g.handY,g.palmX,g.palmY,g.pinchRatio].every(Number.isFinite));
    if (!valid.length) this.presentSince=null;
    else if (this.presentSince === null) this.presentSince = now;
    this.slots.forEach((s,j)=>{if(s?.missing && now-s.last>220)this.slots[j]=null;});
    const remaining = new Set([0,1]), matches = new Map();
    // Match all existing hands before assigning new slots; detection order may change.
    const pairs = [];
    valid.forEach((g,i) => this.slots.forEach((s,j) => {
      if (s) pairs.push({i,j,d:Math.hypot(g.palmX-s.palmX,g.palmY-s.palmY)});
    }));
    pairs.sort((a,b) => a.d-b.d).forEach(p => {
      if (p.d < .28 && !matches.has(p.i) && remaining.has(p.j)) { matches.set(p.i,p.j); remaining.delete(p.j); }
    });
    valid.forEach((g,i) => { if (!matches.has(i) && remaining.size) { const j=[...remaining].find(j=>!this.slots[j])??remaining.values().next().value; matches.set(i,j); remaining.delete(j); this.slots[j]=null; } });
    remaining.forEach(j => {
      const s=this.slots[j];
      if(!s || now-s.last>220){this.slots[j]=null;return;}
      // Retain an established drag briefly, but never carry a command hold across lost tracking.
      s.missing=true;s.pending=null;s.thumbSince=null;s.thumbFrames=0;s.thumbLatched=true;s.releaseSince=null;
    });
    return valid.slice(0,2).map((g,i) => {
      const id=matches.get(i), old=this.slots[id];
      const s=old || {trackingId:++this.sequence,pinch:false,pending:null,thumbSince:null,thumbLatched:true,releaseSince:null,thumbFrames:0,lastPinch:-Infinity,zone:null,last:now};
      const resumed=Boolean(s.missing);
      const dt=Math.max(0,now-s.last), alpha=old&&!resumed?1-Math.exp(-dt/35):1;
      s.x=old?s.x+(g.screenX-s.x)*alpha:g.screenX;
      s.y=old?s.y+(g.handY-s.y)*alpha:g.handY;
      const want=g.pinchRatio < (s.pinch?.43:.30);
      if(resumed && !want){s.pinch=false;s.pending=null;}
      if (want===s.pinch) s.pending=null;
      else if (s.pending===null) s.pending=now;
      else if (now-s.pending>=70) { s.pinch=want; s.pending=null; }
      if (s.pinch || want) s.lastPinch=now;
      let left=s.zone===null?s.x<.5:[0,1].includes(s.zone);
      let top=s.zone===null?s.y>.5:[0,2].includes(s.zone);
      if (s.x<.46) left=true; else if(s.x>.54) left=false;
      if (s.y<.46) top=false; else if(s.y>.54) top=true;
      s.zone=left?(top?0:1):(top?2:3);
      // A switch requires a fresh, stationary thumb pose well inside one quadrant.
      const neutral=!g.thumbUp && !s.pinch && !want;
      if(neutral){
        if(s.releaseSince===null)s.releaseSince=now;
        if(now-s.releaseSince>=200)s.thumbLatched=false;
      }else s.releaseSince=null;
      const inside=Math.abs(s.x-.5)>.08 && Math.abs(s.y-.5)>.08;
      const eligible=g.thumbUp && !s.pinch && !want && inside && now-s.lastPinch>=300 && !s.thumbLatched;
      let thumbFire=false;
      if(!eligible || dt>350){s.thumbSince=null;s.thumbFrames=0;}
      if(eligible){
        if(s.thumbSince===null || s.thumbZone!==s.zone || Math.hypot(g.palmX-s.thumbX,g.palmY-s.thumbY)>.08){
          s.thumbSince=now;s.thumbFrames=0;s.thumbZone=s.zone;s.thumbX=g.palmX;s.thumbY=g.palmY;
        }
        s.thumbFrames++;
        if(now-s.thumbSince>=700 && s.thumbFrames>=5){thumbFire=true;s.thumbLatched=true;}
      }
      Object.assign(s,{last:now,palmX:g.palmX,palmY:g.palmY,missing:false}); this.slots[id]=s;
      return {...g,id,trackingId:s.trackingId,resumed,screenX:s.x,handY:s.y,markerScreenX:s.x,markerScreenTop:1-s.y,pinch:s.pinch,thumbFire,zone:s.zone};
    });
  }
  ready(now) { return this.presentSince!==null && now-this.presentSince>=3000; }
}

const gestureGate = new StemGestureGate();
const introSteps = [
  ['Vocal volume','In the top-left Vocal area, pinch thumb and index finger. Keep pinching and move up or down. Release to keep the level.','Adjust the volume, then pinch Next.'],
  ['Open effects','Release your fingers. In the top-left Vocal area, give a thumbs-up and hold briefly.','Open Vocal FX, then pinch Next.'],
  ['Try Reverb','Pinch in the top-left Reverb area and move up or down. Listen to the space around the voice.','Change Reverb, then pinch Next.'],
  ['Try Delay','Pinch in the bottom-left Delay area and move up or down. Listen for repeated echoes.','Change Delay, then pinch Next.'],
  ['Try Filter','Pinch in the top-right Filter area and move up or down. Listen to the voice become brighter or softer.','Change Filter, then pinch Next.'],
  ['Leave effects','In the bottom-right Quit area, give a thumbs-up to return to tracks.','Return to tracks, then pinch Next.'],
  ['Ready to remix','All four tracks are yours. Pinch to mix volume. Thumbs-up opens FX. Space pauses. M clears effects.','Pinch Start remix when you are ready.']
];
const intro = {active:false,step:0,done:false,nextSince:null,nextOwner:null,nextArmed:false,min:.55,max:.55};
let selectedSession='intro', pausedFrom='mix';
let dragOwner=null, gestureModeAt=0, joinFrameAt=0;
const dragHands=[null,null];
const fadeHands=[null,null];
function resetGestureControls() { gestureGate.reset(); dragHands.fill(null); fadeHands.fill(null); dragOwner=null; intro.nextSince=null; intro.nextOwner=null; intro.nextArmed=false; }
function introRender() {
  const panel=document.getElementById('introPanel'), next=document.getElementById('introNext');
  panel.hidden=next.hidden=!intro.active || state.phase==='paused';
  document.body.classList.toggle('intro-active',intro.active);
  document.body.classList.toggle('intro-volume',intro.active && [0,1,6].includes(intro.step));
  if(!intro.active || state.phase==='paused')return;
  next.hidden=intro.step===5&&!intro.done;
  document.getElementById('introCount').textContent=`PRACTICE ${intro.step+1} / ${introSteps.length} · VOCAL ONLY`;
  document.getElementById('introTitle').textContent=introSteps[intro.step][0];
  document.getElementById('instruction').textContent=`Intro: ${introSteps[intro.step][0]} · Space pauses`;
  document.getElementById('introText').textContent=introSteps[intro.step][1];
  const practice=[0,2,3,4].includes(intro.step);
  document.getElementById('introStatus').textContent=intro.done?'Nice! Keep experimenting, or continue.':practice?`Practice ${Math.min(100,Math.round((intro.max-intro.min)/.08*100))}% · ${introSteps[intro.step][2]}`:introSteps[intro.step][2];
  const thumb=[1,5].includes(intro.step), image=document.getElementById('introGesture');
  image.textContent=thumb?'👍':'🤏';image.setAttribute('aria-label',thumb?'Thumb pointing up, other fingers curled':'Thumb and index finger pinched together');
  document.getElementById('introMotion').textContent=thumb?'Thumbs up':intro.step===6?'Pinch Start remix':'Pinch + move up / down';
  next.disabled=!intro.done; next.textContent=intro.step===6?'Start remix':'Next';
}
function beginIntro() {
  if (!audioContext || !state.cameraReady || !state.modelReady || !state.handReady) return;
  preflight.classList.add('hidden'); handPrompt.hidden=true;
  state.phase='intro'; intro.active=true; intro.step=0; intro.done=false;
  resetMixState(); tracks.forEach((_,i)=>setVolume(i,i===0?.55:0,false));
  resetGestureControls(); restartAll(); introRender();
  prepareIntroStep();
}
function armSelectedSession() {
  if(!['setup','ready','join'].includes(state.phase)||!audioContext||!state.cameraReady||!state.modelReady)return;
  selectedSession=document.getElementById('sessionIntro').checked?'intro':'mix';
  resetGestureControls(); state.phase='join'; preflight.classList.add('hidden');
  handPrompt.textContent='Show your hand for 3 seconds to start';handPrompt.hidden=false;
}
function prepareIntroStep() {
  clearEffects(false); setVolume(0,.55,false);
  state.mode=intro.step>=2&&intro.step<=5?'effects':'tracks';state.effectTrack=0;
  state.selectedEffect=Math.min(3,Math.max(0,intro.step-2));
  const key={2:'reverb',3:'delay',4:'filter'}[intro.step];
  if(key)applyEffect(0,key,.5,false);
  intro.min=intro.max=key ? .5 : .55;
  intro.done=intro.step===6;resetGestureControls();introRender();updateUI();
}
function finishIntro() {
  intro.active=false;hideOverlay(pauseOverlay);introRender();resetGestureControls();resetMixState();
  state.phase='join';startMixer();
}
function advanceIntro() {
  if (!intro.active || !intro.done) return;
  if(intro.step===6){
    finishIntro();return;
  }
  intro.step++; intro.done=intro.step===6;
  prepareIntroStep();
}
function skipIntroStep() {
  if(!intro.active||state.phase!=='paused')return;
  if(intro.step===6){finishIntro();return;}
  intro.step++;state.phase='intro';hideOverlay(pauseOverlay);prepareIntroStep();playAll();
}
function skipIntroAll() { if(intro.active&&state.phase==='paused')finishIntro(); }
function completeIntro() { if(intro.active&&!intro.done){intro.done=true;introRender();} }
function gestureNext(g,now) {
  if(!intro.active)return false;
  if(g.thumbUp)return false;
  const box=document.getElementById('introNext').getBoundingClientRect();
  const inside=g.screenX*innerWidth>=box.left && g.screenX*innerWidth<=box.right && (1-g.handY)*innerHeight>=box.top && (1-g.handY)*innerHeight<=box.bottom;
  if(inside && !g.pinch) intro.nextArmed=true;
  if(!inside || !g.pinch || !intro.done || !intro.nextArmed){
    if(intro.nextOwner===g.id){intro.nextOwner=null;intro.nextSince=null;}
    document.getElementById('introNext').style.setProperty('--hold','0%');
    return inside;
  }
  if(intro.nextOwner===null){intro.nextOwner=g.id;intro.nextSince=now;}
  if(intro.nextOwner===g.id){
    const p=Math.min(1,(now-intro.nextSince)/650);
    document.getElementById('introNext').style.setProperty('--hold',`${p*100}%`);
    if(p===1)advanceIntro();
  }
  return true;
}
function routeStableGesture(g,now) {
  if(dragHands[g.id] && dragHands[g.id].trackingId!==g.trackingId){
    dragHands[g.id]=null;if(dragOwner===g.id)dragOwner=null;
  }
  const dot=handDots[g.id];
  dot.style.opacity=1;dot.style.left=`${g.markerScreenX*100}%`;dot.style.top=`${g.markerScreenTop*100}%`;
  dot.classList.toggle('pinching',g.pinch);dot.classList.toggle('thumbup',g.thumbUp);
  if(gestureNext(g,now)){dragHands[g.id]=null;if(dragOwner===g.id)dragOwner=null;return;}
  if(state.playback)return;
  const fx=state.mode==='effects', zone=g.zone, key=fx?effectKeys[zone]:'volume';
  if(g.thumbFire && dragOwner===null && now-gestureModeAt>=1000){
    if(fx && key==='quit' && (!intro.active||intro.step===5)){
      exitEffectMode();gestureModeAt=now;gestureGate.lockThumbs();
      if(intro.active)completeIntro();return;
    }
    if(!fx && (!intro.active||(intro.step===1&&zone===0))){
      enterEffectMode(zone);gestureModeAt=now;gestureGate.lockThumbs();
      if(intro.active)completeIntro();return;
    }
  }
  if(!g.pinch){
    dragHands[g.id]=null;if(dragOwner===g.id)dragOwner=null;
    const target=g.handY>.88?1:g.handY<.12?0:null;
    if(!intro.active && !fx && g.open && target!==null){
      const f=fadeHands[g.id];
      if(!f||f.zone!==zone||f.target!==target)fadeHands[g.id]={zone,target,since:now,fired:false};
      else if(!f.fired&&now-f.since>=700){fadeTo(zone,target);f.fired=true;}
    }else fadeHands[g.id]=null;
    return;
  }
  fadeHands[g.id]=null;
  if(dragOwner!==null && dragOwner!==g.id)return;
  if(!dragHands[g.id]){
    if(key==='quit')return;
    if(intro.active){
      const expected=[0,-1,0,1,2,-1,-1][intro.step];
      if(zone!==expected)return;
    }
    const track=fx?state.effectTrack:zone;
    dragOwner=g.id;dragHands[g.id]={track,key,trackingId:g.trackingId,y:g.handY,value:key==='volume'?state.volumes[track]:state[key][track],distance:0};
  }
  const d=dragHands[g.id];
  if(g.resumed){d.y=g.handY;d.value=d.key==='volume'?state.volumes[d.track]:state[d.key][d.track];}
  const amount=Math.max(0,Math.min(1,d.value+(g.handY-d.y)*2.5));
  if(d.key==='volume'){setSelected(d.track,false);setVolume(d.track,amount,false);}
  else {
    state.selectedEffect=effectKeys.indexOf(d.key);
    applyEffect(d.track,d.key,amount,false);
  }
  if(intro.active){intro.min=Math.min(intro.min,amount);intro.max=Math.max(intro.max,amount);if(intro.max-intro.min>=.08)completeIntro();else introRender();}
}
function processStableResults(gestures,now) {
  joinFrameAt=now;
  if(!['join','mix','intro'].includes(state.phase)){resetGestureControls();return;}
  const stable=gestureGate.update(gestures,now);
  handDots.forEach(dot=>{dot.style.opacity=0;});
  const ids=new Set(stable.map(g=>g.id));
  dragHands.forEach((_,id)=>{if(!ids.has(id)){
    fadeHands[id]=null;
    if(!gestureGate.slots[id]){dragHands[id]=null;if(dragOwner===id)dragOwner=null;}
  }});
  if(intro.nextOwner!==null&&!ids.has(intro.nextOwner)){intro.nextOwner=null;intro.nextSince=null;intro.nextArmed=false;}
  if(!stable.length){intro.nextArmed=false;return;}
  if(state.phase==='join'){
    const seconds=Math.max(0,3-(now-gestureGate.presentSince)/1000);
    handPrompt.textContent=`Hand detected · starting in ${seconds.toFixed(1)}s`;
    if(gestureGate.ready(now)){
      if(selectedSession==='intro')beginIntro();
      else {resetGestureControls();resetMixState();startMixer();}
    }return;
  }
  if(state.phase!=='mix' && state.phase!=='intro')return;
  stable.forEach(g=>routeStableGesture(g,now));
}
