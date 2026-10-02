// Root layout fields remain the live desk, preserving all existing widget code.
const fields=['widgets','events','gridColumns','autoArrange'];
export function ensureDesks(state){
  if(!state.desks){state.activeDeskId='default';state.desks=[{id:'default',name:'Kişisel alan'}];}
}
export function switchDesk(state,id){
  ensureDesks(state);
  if(id===state.activeDeskId)return false;
  const target=state.desks.find(desk=>desk.id===id),current=state.desks.find(desk=>desk.id===state.activeDeskId);
  if(!target?.workspace)throw Error('Masa bulunamadı.');
  current.workspace=structuredClone(Object.fromEntries(fields.map(field=>[field,state[field]])));
  for(const field of fields)state[field]=target.workspace[field];
  delete target.workspace;state.activeDeskId=id;
  return true;
}
export function addDesk(state,name){
  ensureDesks(state);
  const desk={id:crypto.randomUUID(),name:name.trim().slice(0,80),workspace:{widgets:[],events:[],gridColumns:state.gridColumns||3,autoArrange:state.autoArrange!==false}};
  if(!desk.name)throw Error('Masa adı boş olamaz.');
  state.desks.push(desk);switchDesk(state,desk.id);return desk.id;
}
