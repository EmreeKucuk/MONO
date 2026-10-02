import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCapture} from '../public/capture-parser.js';
import {protectPage,unlockPage,openedPage,saveOpenedPage,lockPage,isPageOpen,flushEncryption,removePassword} from '../public/note-vault.js';
import {sanitizeWorkspace} from '../public/state-schema.js';
import {validPolicy,canNotify,appOrigin,validReminders} from '../desktop/policy.mjs';

test('Turkish capture resolves dates, weekdays, clock and relative reminders without substring collisions',()=>{
  const now=new Date(2026,9,2,12,0);
  assert.equal(parseCapture('yarın 14:30 toplantı',now).date,'2026-10-03');
  assert.equal(parseCapture('pazartesi kitap oku',now).date,'2026-10-05');
  assert.equal(parseCapture('cumartesi spor',now).date,'2026-10-03');
  assert.equal(parseCapture('haftaya pazartesi toplantı',now).date,'2026-10-05');
  assert.equal(parseCapture('05.10.2026 saat 14 toplantı',now).time,'14:00');
  assert.equal(parseCapture('5 ekim proje teslimi',now).date,'2026-10-05');
  const r=parseCapture('20 dakika sonra su iç hatırlat',now);assert.equal(r.at,now.getTime()+1200000);assert.equal(r.text,'su iç');assert.equal(r.kind,'reminder');
  assert.throws(()=>parseCapture('31.02.2026 hata',now));assert.throws(()=>parseCapture('bir gün yaparım',now));assert.throws(()=>parseCapture('20 dakika sonra',now));
});

test('encrypted pages round-trip through persisted schema, bind identities and preserve structured formatting',async()=>{
  const blocks=[{id:'heading',type:'title',text:'Confidential heading',indent:0,done:false},{id:'bullet',type:'bullet',text:'Secret detail',indent:1,done:false}];
  const page={id:'secret-page',name:'Private',blocks:structuredClone(blocks)};
  await protectPage(page,'note','a-strong-password',{kind:'password'});assert.deepEqual(page.blocks,[]);assert.equal(isPageOpen(page),false);
  let state=sanitizeWorkspace({widgets:[{id:'note',type:'note',title:'Aklımdakiler',text:'Secret detail',pages:[page],pageId:page.id}],events:[],zoneProfiles:[{id:'working',name:'Working',minutes:25,allowed:[]}],activeZone:{profileId:'working',endAt:0,startedAt:Date.now(),allowed:['reminder']}});
  assert.equal(state.widgets[0].title,'Notlar');assert.equal(state.widgets[0].text,'');assert.ok(!JSON.stringify(state).includes('Secret detail'));assert.deepEqual(state.activeZone.allowed,['reminder']);
  const saved=state.widgets[0].pages[0];await assert.rejects(unlockPage(saved,'note','wrong-password'));await assert.rejects(unlockPage(saved,'other-widget','a-strong-password'));await unlockPage(saved,'note','a-strong-password');assert.deepEqual(openedPage(saved).blocks,blocks);
  openedPage(saved).blocks[1].text='Changed secret';await saveOpenedPage(saved,'note');await flushEncryption();assert.deepEqual(saved.blocks,[]);assert.ok(!JSON.stringify(saved).includes('Changed secret'));await lockPage(saved);assert.equal(isPageOpen(saved),false);await unlockPage(saved,'note','a-strong-password');assert.equal(openedPage(saved).blocks[1].text,'Changed secret');await removePassword(saved);assert.equal(saved.encrypted,undefined);assert.equal(saved.blocks[1].text,'Changed secret');
  assert.throws(()=>sanitizeWorkspace({widgets:[{id:'note',type:'note',pages:[{id:'bad"',encrypted:page.encrypted}]}],events:[]}));
  assert.throws(()=>sanitizeWorkspace({widgets:[{id:'note',type:'note',pages:[{id:'page',encrypted:{...page.encrypted,iv:'bad'}}]}],events:[]}));
});

test('desktop origins, reminder payloads and timed or indefinite Zone policies are bounded',()=>{
  assert.equal(appOrigin('https://mono.example/path'),'https://mono.example');assert.equal(appOrigin('http://127.0.0.1:4173'),'http://127.0.0.1:4173');assert.throws(()=>appOrigin('http://example.com'));assert.throws(()=>appOrigin('https://user:pass@example.com'));
  const policy=validPolicy({active:true,until:0,allowed:['reminder','evil']});assert.equal(canNotify(policy,'focus'),false);assert.equal(canNotify(policy,'reminder'),true);assert.equal(canNotify({...policy,until:1},'focus'),true);assert.equal(canNotify({active:false,allowed:[]},'focus'),true);
  assert.deepEqual(validReminders([{id:'good',at:100,text:'Remember'},{id:'"bad',at:100,text:'Bad'}]),[{id:'good',at:100,text:'Remember'}]);assert.throws(()=>validReminders('bad'));
});

test('four-digit PIN preserves leading zero, rejects invalid codes and rotates an existing password without losing content',async()=>{
  const page={id:'pin-page',name:'Notes',blocks:[{id:'block',type:'title',text:'Keep this text',indent:0,done:false}]};
  for(const pin of ['123','12345','12a4','abcd'])await assert.rejects(protectPage(page,'note',pin),/4 rakam/);
  await protectPage(page,'note','legacy-password',{kind:'password'});await unlockPage(page,'note','legacy-password');
  await protectPage(page,'note','0042');assert.equal(page.encrypted.credential,'pin');assert.equal(isPageOpen(page),false);assert.deepEqual(page.blocks,[]);
  const safe=sanitizeWorkspace({widgets:[{id:'note',type:'note',pages:[page]}],events:[]}).widgets[0].pages[0];assert.equal(safe.encrypted.credential,'pin');
  await assert.rejects(unlockPage(safe,'note','42'),/4 rakam/);await unlockPage(safe,'note','0042');assert.equal(openedPage(safe).blocks[0].text,'Keep this text');
  openedPage(safe).blocks[0].text='Edited before rotating';await saveOpenedPage(safe,'note');await protectPage(safe,'note','9876');await assert.rejects(unlockPage(safe,'note','0042'));await unlockPage(safe,'note','9876');assert.equal(openedPage(safe).blocks[0].text,'Edited before rotating');
});

test('five wrong PIN attempts apply a wait without damaging the encrypted page',async()=>{
  const page={id:'throttle-page',name:'Private',blocks:[{id:'text',type:'text',text:'Protected',indent:0,done:false}]};await protectPage(page,'note','1234');const cipher=page.encrypted.ciphertext;
  for(let i=0;i<5;i++)await assert.rejects(unlockPage(page,'note','9999'),/PIN yanlış/);
  await assert.rejects(unlockPage(page,'note','1234'),/saniye bekle/);assert.equal(page.encrypted.ciphertext,cipher);assert.deepEqual(page.blocks,[]);
});
