import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeWorkspace,STATE_VERSION} from '../public/state-schema.js';
import {addDesk,switchDesk} from '../public/desks.js';

test('v1 layouts migrate, many desks preserve independent content and round-trip idempotently',()=>{
  let state=sanitizeWorkspace({schemaVersion:1,widgets:[{id:'old',type:'note',text:'Original',grid:{slot:3,cols:2,rows:2}}],events:[{id:'meeting',date:'2026-10-05',text:'Meeting'}],gridColumns:2,autoArrange:false});
  assert.equal(state.schemaVersion,STATE_VERSION);assert.equal(state.desks[0].name,'Kişisel alan');
  const personal=state.activeDeskId;
  const work=addDesk(state,'İş');assert.equal(state.widgets.length,0);assert.equal(state.events.length,0);
  state.widgets.push({id:'work-note',type:'note',text:'Work'});state.gridColumns=3;
  for(let i=0;i<25;i++)addDesk(state,'Desk '+i);
  switchDesk(state,work);assert.equal(state.widgets[0].text,'Work');assert.equal(state.gridColumns,3);
  switchDesk(state,personal);assert.equal(state.widgets[0].text,'Original');assert.equal(state.gridColumns,2);assert.equal(state.autoArrange,false);assert.equal(state.events[0].text,'Meeting');assert.equal(state.widgets[0].grid.cols,2);
  state=sanitizeWorkspace(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(sanitizeWorkspace(state),state);assert.equal(state.desks.length,27);
  switchDesk(state,work);assert.equal(state.widgets[0].text,'Work');assert.equal(state.events.length,0);
});

test('inactive desks validate hostile saved data and reject missing or ambiguous desk state',()=>{
  const input={widgets:[],events:[],activeDeskId:'a',desks:[{id:'a',name:'<img onerror=evil>'},{id:'b',name:'Work',workspace:{widgets:[{id:'links',type:'links',links:[{id:'bad',name:'Bad',url:'javascript:evil'}]},{id:'music',type:'spotify',spotifyUrl:'javascript:evil'}],events:[]}}]};
  const safe=sanitizeWorkspace(input);assert.equal(safe.desks[1].workspace.widgets[0].links.length,0);assert.equal(safe.desks[1].workspace.widgets[1].spotifyUrl,'');
  assert.throws(()=>sanitizeWorkspace({...input,activeDeskId:'unknown'}),/masa/);
  assert.throws(()=>sanitizeWorkspace({...input,desks:[{id:'a'},{id:'a'}]}),/benzersiz/);
  assert.throws(()=>sanitizeWorkspace({...input,desks:[{id:'a'},{id:'b'}]}),/eksik/);
});
