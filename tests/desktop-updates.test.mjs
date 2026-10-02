import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createUpdateController} from '../desktop/updates.mjs';

function setup(enabled=true){
  const updater=new EventEmitter(),events=[];let checks=0,installs=0,gate=async()=>{};
  updater.checkForUpdates=async()=>{checks++;updater.emit('checking-for-update');updater.emit('update-not-available');};
  const controller=createUpdateController({updater,enabled,version:'1.2.4',publish:value=>events.push(value),prepareQuit:()=>gate(),install:()=>installs++});
  return {updater,controller,events,checks:()=>checks,installs:()=>installs,gate:fn=>{gate=fn;}};
}
test('update checks deduplicate, download progress is bounded and only explicit restart installs',async()=>{
  const s=setup();await Promise.all([s.controller.check(),s.controller.check()]);assert.equal(s.checks(),1);
  assert.equal(s.updater.autoInstallOnAppQuit,false);assert.equal(s.updater.autoDownload,true);assert.equal(s.updater.allowDowngrade,false);assert.equal(s.updater.allowPrerelease,false);
  await assert.rejects(s.controller.restart());s.updater.emit('update-available',{version:'1.2.5'});
  s.updater.emit('download-progress',{percent:150});assert.equal(s.controller.status().percent,100);await s.controller.check();assert.equal(s.checks(),1);
  s.updater.emit('update-downloaded',{version:'1.2.5'});assert.equal(s.installs(),0);
  let finish;s.gate(()=>new Promise(resolve=>{finish=resolve;}));const job=s.controller.restart();assert.equal(s.installs(),0);await assert.rejects(s.controller.restart());finish();await job;assert.equal(s.installs(),1);
});
test('update failures recover without closing app and failed storage blocks restart',async()=>{
  const s=setup();s.updater.checkForUpdates=async()=>{throw Error('offline token secret');};await s.controller.check();assert.equal(s.controller.status().phase,'error');assert.ok(!JSON.stringify(s.controller.status()).includes('secret'));
  s.updater.checkForUpdates=async()=>s.updater.emit('update-downloaded',{version:'1.2.5'});await s.controller.check();
  s.gate(async()=>{throw Error('disk failed');});await assert.rejects(s.controller.restart(),/disk failed/);assert.equal(s.installs(),0);assert.equal(s.controller.status().phase,'ready');
  s.gate(async()=>{});await s.controller.restart();assert.equal(s.installs(),1);
});
test('development builds do not query releases',async()=>{const s=setup(false);await s.controller.check();assert.equal(s.checks(),0);assert.equal(s.controller.status().phase,'disabled');await assert.rejects(s.controller.restart());});
