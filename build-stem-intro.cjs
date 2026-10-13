const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const file=path.join(__dirname,'Stem_Flow_Intro.html');
const begin='/* STEM_INTRO_CONTROLS */',end='/* END_STEM_INTRO_CONTROLS */';
let html=fs.readFileSync(file,'utf8');
const start=html.indexOf(begin),finish=html.indexOf(end,start);
if(start<0)throw Error('Missing intro marker');
html=html.slice(0,start)+begin+'\n'+fs.readFileSync(path.join(__dirname,'stem-intro-controls.js'),'utf8')+'\n'+end+html.slice(finish<0?start+begin.length:finish+end.length);
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|application\/json/.test(m[1]))new vm.Script(m[2]);
fs.writeFileSync(file,html);console.log('Built single-file Stem_Flow_Intro.html; syntax passed.');
