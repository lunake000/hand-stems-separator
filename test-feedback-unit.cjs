const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(__dirname + '/Stem_Flow_Intro.html', 'utf8');
const source = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));
const nodes = new Map();
function node() {
  return { textContent: '', hidden: false, style: { setProperty() {} },
    classList: { toggle() {}, remove() {} },
    querySelector(key) { if (!this[key]) this[key] = node(); return this[key]; } };
}
const tracks = ['vocals','bass','drums','other'].map(key => ({ key, label: key, hue: 50 }));
const state = { phase: 'mix', mode: 'tracks', selected: 0, effectTrack: 0, selectedEffect: 0,
  volumes: [.8,.8,.8,.8], reverb: [0,0,0,0], delay: [0,0,0,0], filter: [0,0,0,0],
  fadeActive: [false,false,false,false], fadeTargets: [1,1,1,1], events: [] };
let renders = 0, scheduled = [];
const ctx = vm.createContext({ state, tracks, effectKeys: ['reverb','delay','filter','quit'],
  effectNames: ['Reverb','Delay','Filter','Quit'],
  document: { hidden: false, body: node(), getElementById(id) {
    if (!nodes.has(id)) nodes.set(id,node()); return nodes.get(id);
  } },
  handPrompt: node(), helpButton: node(), core: node(), trackName: node(), trackMeta: node(),
  recordLine: node(), saveButton: node(),
  graph: Object.fromEntries(tracks.map(({ key }) => [key, { gain: { gain: { setTargetAtTime() {} } } }])),
  audioContext: { currentTime: 0 }, performance: { now: () => 0 },
  motionPreference: { matches: false }, materialTime: 0, lastVisualTick: 0,
  updateStemMotion() {}, renderMaterials() { renders++; }, updatePlayback() {},
  devicePixelRatio: 1, innerWidth: 800, innerHeight: 600, stemCanvas: { width: 800,height: 600 },
  sctx: { setTransform() {}, clearRect() {} }, renderZone() {},
  requestAnimationFrame(fn) { scheduled.push(fn); }
});
vm.runInContext(source("    let lastUISignature = '';", '    function distance('), ctx);
vm.runInContext(source('    function updateFades(', '    function applyEffect('), ctx);
vm.runInContext(source('    let lastControlTick = null', '    // ===== Main page v11'), ctx);
vm.runInContext('updateUI()', ctx);
assert.match(ctx.trackMeta.textContent, /Volume 80%/);
state.volumes[0] = .35;
vm.runInContext('updateUI()', ctx);
assert.equal(nodes.get('orb-vocals').querySelector('p').textContent, '35%');
for (const [i,key] of ['reverb','delay','filter'].entries()) {
  state.mode = 'effects'; state.selectedEffect = i; state[key][0] = .63;
  vm.runInContext('updateUI()', ctx);
  assert.match(ctx.trackMeta.textContent.toLowerCase(), new RegExp(key + '.*63%'));
}
assert.equal(renders, 0, 'UI updates do not draw canvases');
state.mode = 'tracks';
// Simulate one second of display ticks with no camera inference callbacks.
for (const fps of [20,30,60,120]) {
  state.volumes[0] = 0; state.fadeActive[0] = true;
  vm.runInContext('lastControlTick=null;nextVisualAt=0;', ctx);
  for (let i=0; i<=fps; i++) {
    ctx.tickTime = i*1000/fps;
    vm.runInContext('visualTick(tickTime)', ctx);
    scheduled = [];
  }
  assert(Math.abs(state.volumes[0]-.75)<1e-8, `Fade rate at ${fps} fps`);
  assert.match(ctx.trackMeta.textContent, /Volume 75%/);
}
assert(renders > 0);
console.log('PASS: actual UI functions update volume and all FX; no canvas work in UI updates; camera-independent fades remain 75%/second at 20/30/60/120 fps.');
