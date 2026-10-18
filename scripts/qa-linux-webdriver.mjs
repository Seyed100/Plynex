import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const base=process.env.WEBDRIVER_URL || 'http://127.0.0.1:4444';
let session;
async function request(method,path,data) {
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
  const json=await response.json();
  if(json.value?.error)throw Error(JSON.stringify(json.value));
  return json.value;
}
const endpoint=()=>'/session/'+session;
const script=(source,args=[])=>request('POST',endpoint()+'/execute/sync',{script:source,args});
async function invoke(command,args={}) {
  const value=await request('POST',endpoint()+'/execute/async',{script:`const done=arguments[arguments.length-1];window.__TAURI_INTERNALS__.invoke(arguments[0],arguments[1]).then(v=>done({ok:true,value:v}),e=>done({ok:false,error:String(e)}));`,args:[command,args]});
  if(!value.ok)throw Error(value.error);return value.value;
}
const property=name=>invoke('player_command',{command:['get_property',name]});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn,description) {let last;for(let i=0;i<200;i++){try{if(await fn())return;}catch(e){last=e;}await sleep(100);}throw Error('Timed out: '+description+' '+(last || ''));}
async function click(selector) {await script('document.querySelector(arguments[0]).click()', [selector]);}
try {
  const created=await request('POST','/session',{capabilities:{alwaysMatch:{'tauri:options':{application:process.env.PLYNEX_BINARY || '/root/plynex-target/release/plynex'}}}});
  session=created.sessionId;
  await request('POST',endpoint()+'/timeouts',{script:30000});
  await waitFor(()=>script("return document.body.textContent.includes('Native playback')"),'engine ready');
  await click('.welcome-options button:last-child');
  await waitFor(async()=>await property('duration')>29,'sample load');
  await invoke('player_command',{command:['set_property','pause',true]});
  assert.equal((await property('chapter-list')).length,6);
  assert((await property('track-list')).some(t=>t.lang==='fas'));
  for(const fraction of [.8,.2,.65]) {
    await request('POST',endpoint()+'/actions',{actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:0,x:Math.round(await script("const r=document.querySelector('.seek-range').getBoundingClientRect();return r.left+6+(r.width-12)*arguments[0]",[fraction])),y:Math.round(await script("const r=document.querySelector('.seek-range').getBoundingClientRect();return r.top+r.height/2"))},{type:'pointerDown',button:0},{type:'pointerUp',button:0}]}]});
    await waitFor(async()=>Math.abs((await property('time-pos'))-30*fraction)<.4,`seek ${fraction}`);
  }
  await invoke('player_command',{command:['set_property','volume',150]});assert.equal(await property('volume'),150);
  await invoke('player_command',{command:['set_property','speed',1.5]});assert.equal(await property('speed'),1.5);
  await invoke('player_command',{command:['seek',3,'absolute+exact']});
  const frame=await invoke('screenshot');assert((await fs.stat(frame)).size>1000);
  await fs.mkdir('output/playwright',{recursive:true});
  await sleep(300);
  execFileSync('python3',['-c',`from PIL import ImageGrab,ImageStat
im=ImageGrab.grab(xdisplay='${process.env.DISPLAY || ':99'}')
im.save('output/playwright/linux-desktop.png')
w,h=im.size
assert max(ImageStat.Stat(im.crop((w//3,h//3,w*2//3,h*2//3))).stddev)>15, 'Native video must be visible through the WebView'
`]);
  await click('[aria-label="Switch to light theme"]');
  assert.equal(await script('return document.documentElement.dataset.theme'),'light');
  await click('[aria-label="Switch to dark theme"]');
  await click('[aria-label="Fullscreen (F)"]');
  assert(await script("return document.querySelector('.app').classList.contains('fullscreen')"));
  await click('[aria-label="Fullscreen (F)"]');
  await fs.mkdir('output/playwright',{recursive:true});
  const screenshot=await request('GET',endpoint()+'/screenshot');
  await fs.writeFile('output/playwright/linux-webview.png',Buffer.from(screenshot,'base64'));
  await invoke('stop_media');
  await invoke('load_media',{path:await invoke('sample_media'),start:12});
  await waitFor(async()=>await property('time-pos')>=11.8,'resume');
  await assert.rejects(invoke('load_media',{path:'/missing-film.mkv',start:0}));
  console.log('PASS Linux native: engine, sample, chapters, Persian track, pointer seek at 20/65/80%, 150% volume, speed, screenshot, themes, fullscreen, reload/resume, missing-file error.');
  if(process.env.KEEP_APP_OPEN)await sleep(15000);
} catch(error) {
  if(session)console.error('Linux UI state:',await script('return document.body.innerText'));
  throw error;
} finally {if(session)await request('DELETE',endpoint());}

