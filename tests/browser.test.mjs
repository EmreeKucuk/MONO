import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require=createRequire(import.meta.url);
let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(process.env.CODEX_PLAYWRIGHT_PATH||'C:/Users/emre.kucuk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
let processHandle,base,browser;
const freePort=()=>new Promise(resolve=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
before(async()=>{const port=await freePort();base=`http://127.0.0.1:${port}`;processHandle=spawn(process.execPath,['server.mjs'],{cwd:project,env:{...process.env,PORT:String(port)}});for(let attempt=0;attempt<60;attempt++){try{const response=await fetch(base);if(response.ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}browser=await chromium.launch({channel:process.env.MONO_BROWSER_CHANNEL||'msedge',headless:true});});
after(async()=>{await browser?.close();processHandle?.kill();});

test('document-wide selection, slash commands, partial edit and undo',async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await page.goto(base);
  const area=page.locator('.notebook .note-document').first();
  await area.click();await page.keyboard.press('Control+a');assert.match(await page.evaluate(()=>getSelection().toString()),/Bir düşünceyi/);
  await page.keyboard.type('/title ');assert.equal(await area.locator('.block-title').count(),1);
  await page.keyboard.type('Ana başlık');await page.keyboard.press('Enter');await page.keyboard.type('Birinci satır');await page.keyboard.press('Enter');await page.keyboard.type('İkinci satır');
  await page.keyboard.press('Control+Shift+ArrowUp');await page.keyboard.press('Control+Shift+ArrowUp');
  assert.match(await page.evaluate(()=>getSelection().toString()),/Birinci satır/);
  await page.keyboard.press('Backspace');assert.equal(await area.locator('.block-title').count(),1);
  await page.keyboard.press('Control+z');assert.match(await area.innerText(),/Birinci satır/);
  assert.deepEqual(errors,[]);await page.close();
});

test('heading soft break, lists, pages and paste preserve block types',async()=>{
  const page=await browser.newPage({serviceWorkers:'block'});await page.goto(base);const note=page.locator('.notebook').first(),area=note.locator('.note-document');await area.click();await page.keyboard.press('Control+a');await page.keyboard.type('/title ');await page.keyboard.type('Başlık');await page.keyboard.press('Shift+Enter');await page.keyboard.type('Devam');
  assert.equal(await area.locator('.block-title').count(),1);assert.match(await area.locator('.block-title .block-input').textContent(),/Başlık\nDevam/);
  await page.keyboard.press('Enter');await page.keyboard.type('/bullet ');await page.keyboard.type('Birinci');await page.keyboard.press('Enter');await page.keyboard.type('İkinci');await page.keyboard.press('Tab');assert.match(await area.locator('.block-bullet').last().getAttribute('style'),/--indent:1/);
  await page.keyboard.press('Control+z');assert.match(await area.innerText(),/Birinci/);
  const firstPage=await note.locator('[data-page]').inputValue();await note.locator('[data-page-add]').click();await note.locator('.note-document').click();await page.keyboard.type('Diğer sayfa');await note.locator('[data-page]').selectOption(firstPage);assert.match(await area.innerText(),/Başlık/);
  await area.click();await area.evaluate(element=>{const data=new DataTransfer();data.setData('text/plain',' Yapıştırıldı');element.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});assert.match(await area.innerText(),/Yapıştırıldı/);assert.equal(await area.locator('.block-title').count(),1);
  await page.close();
});

test('offline draft survives reload and mobile reflows to 320 pixels',async()=>{
  const context=await browser.newContext({viewport:{width:320,height:750}});
  await context.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;if(path==='/api/session')return route.fulfill({json:{configured:true,user:{id:'test-user',email:'test@example.com'}}});if(path==='/api/workspace'&&route.request().method()==='GET')return route.fulfill({json:{state:null,revision:0}});return route.abort('internetdisconnected');});
  const page=await context.newPage();await page.goto(base);await page.waitForFunction(()=>document.querySelector('.profile')?.textContent.includes('test@example.com'));
  await page.evaluate(()=>navigator.serviceWorker.ready);
  const area=page.locator('.notebook .note-document').first();await area.click();await page.keyboard.type('Çevrimdışı taslak');
  await page.waitForTimeout(150);
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>document.querySelector('.note-document')?.textContent.includes('Çevrimdışı taslak'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.match(await page.locator('#save-status').innerText(),/Çevrimdışı|taslak/i);
  await context.close();
});

test('two tabs show a conflict instead of overwriting',async()=>{
  let remote=null,revision=0;
  const sharedContext=await browser.newContext({serviceWorkers:'block'});
  const contexts=[sharedContext];
  for(const context of contexts)await context.route('**/api/**',async route=>{const request=route.request(),path=new URL(request.url()).pathname;if(path==='/api/session')return route.fulfill({json:{configured:true,user:{id:'same-user',email:'same@example.com'}}});if(path==='/api/workspace'&&request.method()==='GET')return route.fulfill({json:{state:remote,revision}});if(path==='/api/workspace'&&request.method()==='PUT'){const value=request.postDataJSON();if(value.revision!==revision)return route.fulfill({status:409,json:{error:'Başka sekmede değişti.'}});remote=value.state;revision++;return route.fulfill({json:{revision}});}return route.fulfill({status:404,json:{error:'Unknown'}});});
  const pages=await Promise.all([sharedContext.newPage(),sharedContext.newPage()]);await Promise.all(pages.map(page=>page.goto(base)));await Promise.all(pages.map(page=>page.waitForFunction(()=>document.querySelector('.profile')?.textContent.includes('same@example.com'))));
  await pages[0].locator('.notebook .note-document').first().click();await pages[0].keyboard.type('İlk sekme');await pages[0].waitForFunction(()=>document.querySelector('#save-status')?.textContent.includes('Kaydedildi'));
  await pages[1].locator('.notebook .note-document').first().click();await pages[1].keyboard.type('İkinci sekme');await pages[1].locator('#conflict').waitFor({state:'visible'});
  assert.match(await pages[1].locator('#save-status').innerText(),/çakışması/i);
  assert.ok(remote.widgets.some(widget=>widget.type==='note'&&widget.text.includes('İlk sekme')));
  await pages[1].reload();await pages[1].locator('#conflict').waitFor({state:'visible'});
  assert.match(await pages[1].locator('.note-document').first().textContent(),/İkinci sekme/);
  assert.doesNotMatch(await pages[1].locator('.note-document').first().textContent(),/İlk sekme/);
  await Promise.all(contexts.map(context=>context.close()));
});

test('grid can be moved by keyboard',async()=>{const page=await browser.newPage({serviceWorkers:'block'});await page.goto(base);const widget=page.locator('.grid-surface>.widget').first(),id=await widget.getAttribute('data-id');await widget.locator('.widget-head').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator(`[data-id="${id}"]`).evaluate(element=>getComputedStyle(element).gridColumnStart),'2');await page.close();});

test('Alt digits focus widget actions, preserve note caret and respect modal boundaries and grid order',async()=>{
  const page=await browser.newPage({serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(base);
  await page.keyboard.press('Alt+3');assert.ok(await page.evaluate(()=>document.activeElement.matches('.note-document')));
  await page.keyboard.press('Control+a');await page.keyboard.type('abcdef');await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Alt+1');assert.ok(await page.evaluate(()=>document.activeElement.matches('.add-task input[name="task"]')));
  await page.keyboard.press('Alt+3');await page.keyboard.type('X');assert.equal(await page.locator('.note-document .block-input').first().textContent(),'abcdXef');
  await page.keyboard.press('End');await page.keyboard.press('Enter');await page.keyboard.type('ikinci');
  await page.keyboard.press('Control+a');await page.keyboard.press('Alt+1');await page.keyboard.press('Alt+3');
  assert.match(await page.evaluate(()=>getSelection().toString()),/abcdXef[\s\S]*ikinci/);
  for(const selector of ['.event-form input','[data-start]','.habit-form input','.link-form input[name="name"]']){
    const shortcut=await page.locator(selector).evaluate(element=>element.closest('.widget').getAttribute('aria-keyshortcuts'));
    await page.keyboard.press(shortcut);assert.ok(await page.evaluate(selector=>document.activeElement.matches(selector),selector));
  }
  for(const type of ['journal','goal','dates','note']){await page.locator('#tool-toggle').click();await page.locator(`[data-add="${type}"]`).click();}
  await page.keyboard.press('Alt+7');assert.ok(await page.evaluate(()=>document.activeElement.matches('.journal-input')));
  await page.keyboard.press('Alt+8');assert.ok(await page.evaluate(()=>document.activeElement.matches('[data-goal-step="1"]')));
  await page.keyboard.press('Alt+9');assert.ok(await page.evaluate(()=>document.activeElement.matches('.dates-form input[name="name"]')));
  await page.keyboard.press('Alt+0');assert.ok(await page.evaluate(()=>document.activeElement.closest('.widget')?.getAttribute('aria-keyshortcuts')==='Alt+0'&&document.activeElement.matches('.note-document')));
  await page.locator('#widget-search-open').click();await page.locator('#widget-query').fill('not');await page.keyboard.press('Alt+1');assert.equal(await page.locator('#widget-query').inputValue(),'not');assert.ok(await page.evaluate(()=>document.activeElement.id==='widget-query'));await page.keyboard.press('Escape');
  const first=page.locator('.widget').first();await first.locator('.widget-head').focus();await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Alt+1');assert.equal(await page.evaluate(()=>document.activeElement.closest('.widget').dataset.id),await page.locator('.widget').first().getAttribute('data-id'));
  await page.keyboard.press('Control+Alt+2');assert.equal(await page.evaluate(()=>document.activeElement.closest('.widget').dataset.id),await page.locator('.widget').first().getAttribute('data-id'));
  assert.deepEqual(errors,[]);await page.close();
});

test('clipboard keeps block formatting, cut undo restores selection and word deletion uses the model',async()=>{
  const page=await browser.newPage({serviceWorkers:'block'});await page.goto(base);
  const area=page.locator('.notebook .note-document').first();
  await area.click();await page.keyboard.press('Control+a');await page.keyboard.type('/title ');await page.keyboard.type('Başlık');
  await page.keyboard.press('Enter');await page.keyboard.type('/bullet ');await page.keyboard.type('ilk ikinci');
  await page.keyboard.press('Control+Backspace');assert.equal(await area.locator('.block-bullet .block-input').textContent(),'ilk ');
  await page.keyboard.press('Control+a');
  const copied=await area.evaluate(element=>{const data=new DataTransfer();element.dispatchEvent(new ClipboardEvent('cut',{bubbles:true,cancelable:true,clipboardData:data}));return {text:data.getData('text/plain'),blocks:data.getData('application/x-mono-note-blocks')};});
  assert.equal(copied.text,'Başlık\nilk ');assert.equal(await area.locator('.block-input').textContent(),'');
  await page.keyboard.press('Control+z');assert.match(await page.evaluate(()=>getSelection().toString()),/Başlık/);
  await page.keyboard.press('Control+y');assert.equal(await area.locator('.block-input').textContent(),'');
  await page.keyboard.press('Control+z');assert.match(await page.evaluate(()=>getSelection().toString()),/Başlık/);
  await page.keyboard.press('Backspace');
  await area.evaluate((element,data)=>{const transfer=new DataTransfer();transfer.setData('text/plain',data.text);transfer.setData('application/x-mono-note-blocks',data.blocks);element.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}));},copied);
  assert.equal(await area.locator('.block-title').count(),1);assert.equal(await area.locator('.block-bullet').count(),1);
  await page.keyboard.type('😀');await page.keyboard.press('Backspace');assert.equal(await area.locator('.block-bullet .block-input').textContent(),'ilk ');
  await page.keyboard.press('Enter');await page.keyboard.type('Ön söz /');await page.locator('#slash-menu').waitFor({state:'visible'});
  await page.keyboard.press('Escape');assert.equal(await page.locator('#slash-menu').isVisible(),false);
  await page.keyboard.type('subtitle ');await page.keyboard.type('Alt başlık');assert.equal(await area.locator('.block-subtitle').count(),1);
  await page.close();
});

test('widget updates and grid moves retain unrelated editor DOM and restore control focus',async()=>{
  const page=await browser.newPage({serviceWorkers:'block'});await page.goto(base);
  await page.evaluate(()=>window.savedNote=document.querySelector('.note-document'));
  const task=page.locator('[data-task]').first();await task.focus();await page.keyboard.press('Space');
  assert.ok(await page.evaluate(()=>document.activeElement.matches('[data-task]')&&window.savedNote===document.querySelector('.note-document')));
  await page.locator('.widget-head').first().focus();await page.keyboard.press('ArrowRight');
  assert.ok(await page.evaluate(()=>window.savedNote===document.querySelector('.note-document')));
  await page.locator('.resize-handle').first().focus();await page.keyboard.press('ArrowDown');assert.ok(await page.evaluate(()=>document.activeElement.matches('.resize-handle')));
  await page.close();
});

test('edits during a save remain queued and a saved workspace opens offline',async()=>{
  const context=await browser.newContext();let remote=null,revision=0,held,hold=true;
  await context.route('**/api/**',route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(path==='/api/session')return route.fulfill({json:{configured:true,user:{id:'race-user',email:'race@example.com'}}});
    if(request.method()==='GET')return route.fulfill({json:{state:remote,revision}});
    const save=()=>{const input=request.postDataJSON();remote=input.state;revision++;return route.fulfill({json:{revision}});};
    if(hold){held=save;return;}return save();
  });
  const page=await context.newPage();await page.goto(base);await page.waitForFunction(()=>document.querySelector('.profile')?.textContent.includes('race@example.com'));await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.evaluate(async()=>{const cloud=await import('/cloud.js');window.cloud=cloud;window.firstState={widgets:[{id:'race-note',type:'note',title:'Taslak',text:'ilk'}],events:[]};await cloud.stageWorkspace(firstState);window.saveJob=cloud.saveWorkspace(firstState);});
  for(let n=0;!held&&n<50;n++)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(held);
  await page.evaluate(async()=>{window.secondState={...firstState,widgets:[{...firstState.widgets[0],text:'ikinci'}]};await cloud.stageWorkspace(secondState);});
  await held();hold=false;await page.evaluate(()=>window.saveJob);
  assert.equal(await page.evaluate(async()=>(await cloud.localDraft()).widgets[0].text),'ikinci');
  await page.evaluate(()=>cloud.saveWorkspace(secondState));assert.equal(await page.evaluate(()=>cloud.hasPendingDraft()),false);
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>document.querySelector('.note-document')?.textContent.includes('ikinci'));
  await context.close();
});

test('malicious cloud records render as text without attributes, URLs or CSS injection',async()=>{
  const context=await browser.newContext({serviceWorkers:'block'});
  const payload={widgets:[{id:'bad" autofocus onfocus="window.pwned=1',type:'note',title:'<img src=x onerror="window.pwned=1">',pages:[{id:'page" onclick="window.pwned=1',name:'" autofocus',blocks:[{id:'block" onclick="window.pwned=1',type:'title" onmouseover="window.pwned=1',text:'<svg onload="window.pwned=1">',indent:'1);background:url(javascript:alert(1))'}]}],grid:{slot:'1;background:red',cols:1,rows:1}},{id:'links',type:'links',title:'Bağlantılar',links:[{id:'evil',name:'Kötü',url:'javascript:window.pwned=1'},{id:'safe',name:'" onclick="window.pwned=1',url:'https://example.com/" onmouseover="window.pwned=1'}]}],events:[]};
  await context.route('**/api/**',route=>route.fulfill({json:new URL(route.request().url()).pathname==='/api/session'?{configured:true,user:{id:'safe-user',email:'safe@example.com'}}:{state:payload,revision:1}}));
  const page=await context.newPage();await page.goto(base);await page.waitForFunction(()=>document.querySelector('.profile')?.textContent.includes('safe@example.com'));
  assert.equal(await page.locator('[onerror],[onload],[onfocus],[onclick],[onmouseover]').count(),0);
  assert.equal(await page.locator('a[href^="javascript:"]').count(),0);
  assert.match(await page.locator('.note-document').textContent(),/<svg onload=/);
  assert.equal(await page.evaluate(()=>window.pwned),undefined);
  await context.close();
});

test('existing task, habit, link, focus and widget search flows remain usable',async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(base);
  await page.locator('.add-task input[name="task"]').first().fill('Yeni görev');await page.locator('.add-task button').first().click();assert.match(await page.locator('.task-groups').first().innerText(),/Yeni görev/);
  await page.locator('.habit-form input').fill('Oku');await page.locator('.habit-form button').click();await page.locator('[data-habit]').last().click();assert.equal(await page.locator('[data-habit]').last().getAttribute('aria-pressed'),'true');
  await page.getByLabel('Bağlantı adı',{exact:true}).fill('Belgeler');await page.getByLabel('Bağlantı adresi',{exact:true}).fill('https://example.com/docs');await page.getByRole('button',{name:'Bağlantı ekle'}).click();assert.match(await page.locator('.quick-link a').getAttribute('href'),/^https:\/\/example.com/);
  await page.locator('.focus-duration input').fill('15');await page.locator('.focus-duration button').click();assert.equal(await page.locator('.focus-duration input').inputValue(),'15');
  await page.locator('#widget-search-open').click();await page.locator('#widget-query').fill('günlük');assert.ok(await page.locator('#widget-results [role="option"]').count()>0);await page.keyboard.press('Escape');assert.equal(await page.locator('.widget-search').isVisible(),false);
  assert.deepEqual(errors,[]);await page.close();
});

test('IME composition keeps text and caret; completed text meets contrast in both themes',async()=>{
  const page=await browser.newPage({serviceWorkers:'block'});await page.goto(base);
  const area=page.locator('.notebook .note-document').first();await area.click();await page.keyboard.press('Control+a');await page.keyboard.type('ilk');
  const result=await area.evaluate(element=>{const content=element.querySelector('.block-input');element.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));content.textContent='日本語';const range=document.createRange(),selection=getSelection();range.setStart(content.firstChild,3);range.collapse(true);selection.removeAllRanges();selection.addRange(range);element.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));return {text:element.querySelector('.block-input').textContent,offset:getSelection().getRangeAt(0).startOffset};});
  assert.deepEqual(result,{text:'日本語',offset:3});
  const contrast=async()=>page.evaluate(()=>{const text=document.querySelector('.task-row.done .task-text'),panel=text.closest('.widget');const toRgb=value=>value.match(/[\d.]+/g).slice(0,3).map(Number),linear=value=>{const channels=toRgb(value).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;};const a=linear(getComputedStyle(text).color),b=linear(getComputedStyle(panel).backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
  assert.ok(await contrast()>=4.5);await page.locator('#theme-select').selectOption('navy');assert.ok(await contrast()>=4.5);await page.close();
});
