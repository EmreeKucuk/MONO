import test from 'node:test';
import assert from 'node:assert/strict';
import {createClipboardController} from '../desktop/clipboard.mjs';

function setup(overrides={}){
  const history={enabled:true,items:[]};let text='Copied text',writes=0,saves=0;
  const clipboard={readText:async()=>text,writeText:async value=>{text=value;writes++;},...overrides};
  const controller=createClipboardController({clipboard,getHistory:()=>history,persist:async()=>{saves++;}});
  return {controller,history,setText:value=>{text=value;},counts:()=>({writes,saves})};
}

test('Electron 44 async reads capture real text, deduplicate and bound history',async()=>{
  const {controller,history,setText,counts}=setup();
  await controller.capture();assert.equal(history.items[0].text,'Copied text');assert.equal(history.items.length,1);assert.equal(counts().saves,1);
  await controller.capture();assert.equal(history.items.length,1);assert.equal(counts().saves,1);
  setText('  ');await controller.capture();assert.equal(history.items.length,1);
  history.items[0].pinned=true;
  for(let i=0;i<110;i++){setText('Item '+i);await controller.capture();}
  assert.equal(history.items.length,100);assert.equal(history.items[0].text,'Copied text');
  setText('X'.repeat(21000));await controller.capture();assert.equal(history.items[1].text.length,20000);
});

test('slow async polls do not overlap, and clear waits then suppresses recapture of the same text',async()=>{
  let release,reads=0,slow=true;
  const {controller,history}=setup({readText:()=>{reads++;return slow?new Promise(resolve=>release=resolve):Promise.resolve('Slow text');}});
  const first=controller.capture({automatic:true});await Promise.resolve();await Promise.resolve();
  const second=controller.capture({automatic:true});assert.equal(first,second);assert.equal(reads,1);
  const clear=controller.clear();slow=false;release('Slow text');await Promise.all([first,second,clear]);
  assert.equal(history.items.length,0);await controller.capture();assert.equal(history.items.length,0);assert.equal(reads,3);
});

test('rejected or malformed reads propagate to callers and recover on the next poll',async()=>{
  let mode='reject';
  const {controller,history}=setup({readText:async()=>{if(mode==='reject')throw Error('Clipboard busy');return mode==='invalid'?{text:'Bad'}:'Recovered';}});
  await assert.rejects(controller.capture(),/Clipboard busy/);mode='invalid';await assert.rejects(controller.capture(),/geçerli bir metin/);assert.equal(history.items.length,0);
  mode='ok';await controller.capture();assert.equal(history.items[0].text,'Recovered');
});

test('copy awaits writes, reports write failures, and disabled capture never records a late read',async()=>{
  let release,finished=false;
  const {controller,history}=setup({writeText:()=>new Promise(resolve=>release=()=>{finished=true;resolve();})});
  await controller.capture();const id=history.items[0].id,copy=controller.copy(id);await Promise.resolve();await Promise.resolve();assert.equal(finished,false);release();assert.equal(await copy,true);assert.equal(finished,true);assert.equal(await controller.copy('missing'),false);
  const failing=setup({writeText:async()=>{throw Error('Write failed');}});await failing.controller.capture();await assert.rejects(failing.controller.copy(failing.history.items[0].id),/Write failed/);
  let resume;const disabled=setup({readText:()=>new Promise(resolve=>resume=resolve)});const poll=disabled.controller.capture({automatic:true});await Promise.resolve();await Promise.resolve();disabled.history.enabled=false;resume('Late copied text');await poll;assert.equal(disabled.history.items.length,0);
  await disabled.controller.capture({automatic:true});assert.equal(disabled.history.items.length,0);
});
