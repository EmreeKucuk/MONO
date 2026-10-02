import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {_electron} from 'playwright';

test('Windows desktop captures clipboard only after opt-in, encrypts history, exposes bounded IPC and applies Zone policy',{skip:process.platform!=='win32',timeout:45000},async()=>{
  const port=await new Promise(done=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>done(port));});});
  const base=`http://127.0.0.1:${port}`,data=resolve('.test-temp','desktop-'+Date.now());await mkdir(data,{recursive:true});
  const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port)},windowsHide:true});let desktop,previous;
  try{
    for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(done=>setTimeout(done,100));}
    desktop=await _electron.launch({args:['desktop/main.mjs'],env:{...process.env,MONO_APP_URL:base,MONO_DESKTOP_TEST:'1',MONO_DESKTOP_DATA_DIR:data},timeout:20000});const page=await desktop.firstWindow();await page.waitForFunction(()=>!!window.monoDesktop&&!!document.querySelector('#tool-toggle'));
    previous=await desktop.evaluate(({clipboard})=>clipboard.readText());
    assert.equal(await page.evaluate(async()=> (await monoDesktop.clipboard.list()).enabled),false);
    const copied='MONO test private '+Date.now();await desktop.evaluate(({clipboard},text)=>clipboard.writeText(text),copied);await page.waitForTimeout(900);assert.equal(await page.evaluate(async()=> (await monoDesktop.clipboard.list()).items.some(i=>i.text.startsWith('MONO test private'))),false);
    await page.locator('#tool-toggle').click();await page.locator('[data-add=clipboard]').click();await page.locator('[data-clipboard-watch]').check();await page.locator('.clipboard-item p').filter({hasText:copied}).waitFor();
    await page.locator('.clipboard-item').filter({hasText:copied}).locator('[data-pin]').click();await page.waitForFunction(()=>document.querySelector('.clipboard-item small').textContent.includes('Sabitlendi'));
    const stored=await readFile(resolve(data,'clipboard.encrypted'));assert.ok(!stored.includes(Buffer.from(copied)));assert.equal(await desktop.evaluate(({safeStorage})=>safeStorage.isEncryptionAvailable()),true);
    await page.evaluate(()=>monoDesktop.zone({active:true,until:0,allowed:[]}));assert.equal(await page.evaluate(()=>monoDesktop.notify({title:'MONO test',body:'Suppressed',category:'reminder'})),false);
    await page.evaluate(()=>monoDesktop.zone({active:false,until:0,allowed:[]}));
    await page.keyboard.press(await page.locator('.widget').filter({has:page.locator('.clipboard-widget')}).getAttribute('aria-keyshortcuts'));assert.ok(await page.locator('[data-clipboard-search]').evaluate(el=>el===document.activeElement));
    await page.locator('[data-clipboard-watch]').uncheck();await page.locator('[data-clipboard-clear]').click();await page.waitForFunction(()=>document.querySelector('.clipboard-list').textContent.includes('Henüz'));assert.equal(await page.evaluate(async()=> (await monoDesktop.clipboard.list()).items.length),0);
    const security=await desktop.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0],p=w.webContents.getLastWebPreferences();return {node:p.nodeIntegration,context:p.contextIsolation,sandbox:p.sandbox};});assert.deepEqual(security,{node:false,context:true,sandbox:true});
  }finally{if(desktop){if(previous!==undefined)await desktop.evaluate(({clipboard},text)=>clipboard.writeText(text),previous).catch(()=>{});await desktop.close();}server.kill();}
});
