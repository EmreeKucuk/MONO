import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeWorkspace,safeHttpUrl,STATE_VERSION } from '../public/state-schema.js';
import { renderExtra } from '../public/extra-widgets.js';

test('legacy workspace migrates without losing text or task groups',()=>{
  const source={widgets:[{id:'note-one',type:'note',title:'Not',text:'Eski metin',pages:[{id:'page-one',name:'Sayfa',blocks:[{id:'block-one',type:'title',text:'Başlık'}]}]},{id:'tasks-one',type:'tasks',title:'Plan',tasks:[{id:'task-one',text:'İş',groupId:'group-one'}],groups:[{id:'group-one',name:'İş'}]}],events:[]};
  const result=sanitizeWorkspace(source);
  assert.equal(result.schemaVersion,STATE_VERSION);
  assert.equal(result.widgets[0].pages[0].blocks[0].type,'title');
  assert.equal(result.widgets[0].text,'Eski metin');
  assert.equal(result.widgets[1].tasks[0].groupId,'group-one');
  assert.equal(source.schemaVersion,undefined);
});

test('malicious saved URL and attribute values are rejected at load and render',()=>{
  const state=sanitizeWorkspace({widgets:[{id:'x" onfocus="alert(1)',type:'links',title:'<img src=x onerror=alert(1)>',links:[{id:'bad',name:'Kötü',url:'javascript:alert(1)'},{id:'good',name:'Güvenli',url:'https://example.com'}]},{id:'date',type:'journal',entryDate:'2026-01-01" onfocus="alert(1)'}],events:[]});
  assert.match(state.widgets[0].id,/^[a-zA-Z0-9_-]+$/);
  assert.equal(state.widgets[0].links.length,1);
  assert.equal(state.widgets[1].entryDate.includes('"'),false);
  assert.equal(safeHttpUrl('javascript:alert(1)'),null);
  const html=renderExtra({type:'links',links:[{id:'bad',name:'Kötü',url:'javascript:alert(1)'}]});
  assert.equal(html.includes('javascript:alert(1)'),false);
  assert.throws(()=>sanitizeWorkspace({schemaVersion:99,widgets:[],events:[]}),/sürümü/);
});
