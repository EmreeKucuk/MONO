// A persisted workspace is untrusted input, even when it belongs to this account.
export const STATE_VERSION=1;
const types=new Set(['tasks','note','calendar','focus','habits','links','journal','goal','dates']);
const blockTypes=new Set(['text','title','subtitle','bullet','check','number','quote']);
const str=(value,max=10000)=>String(typeof value==='string'?value:'').slice(0,max);
const list=(value,max=500)=>Array.isArray(value)?value.slice(0,max):[];
const number=(value,fallback=0,min=0,max=1e7)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
const integer=(value,fallback=0,min=0,max=1e7)=>Math.trunc(number(value,fallback,min,max));
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value)?value:crypto.randomUUID();
const date=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const parsed=new Date(value+'T12:00:00');
  return !Number.isNaN(parsed.getTime())&&parsed.getFullYear()===Number(value.slice(0,4))&&parsed.getMonth()+1===Number(value.slice(5,7))&&parsed.getDate()===Number(value.slice(8,10))?value:null;
};
export function safeHttpUrl(value){
  try{
    const url=new URL(value);
    return url.protocol==='https:'||url.protocol==='http:'?url.href:null;
  }
  catch{
    return null;
  }
}
const block=value=>({
  id:id(value?.id),type:blockTypes.has(value?.type)?value.type:'text',text:str(value?.text,100000),indent:integer(value?.indent,0,0,3),done:value?.done===true
});
const task=value=>({
  id:id(value?.id),text:str(value?.text,300),done:value?.done===true,groupId:value?.groupId==null?null:id(value.groupId)
});
function widget(value){
  if(!value||!types.has(value.type))return null;
  const w={
    id:id(value.id),type:value.type,title:str(value.title,60)||value.type,x:number(value.x),y:number(value.y),width:number(value.width,320,100,3000)
  };
  if(value.grid&&typeof value.grid==='object')w.grid={
    slot:integer(value.grid.slot,0,0,10000),cols:integer(value.grid.cols,1,1,3),rows:integer(value.grid.rows,1,1,100)
  };
  w.text=str(value.text,200000);
  w.tasks=list(value.tasks,1000).map(task);
  w.groups=list(value.groups,100).map(g=>({
    id:id(g?.id),name:str(g?.name,60),collapsed:g?.collapsed===true
  }));
  const groupIds=new Set(w.groups.map(g=>g.id));
  for(const t of w.tasks)if(!groupIds.has(t.groupId))t.groupId=null;
  w.generalCollapsed=value.generalCollapsed===true;
  w.pages=list(value.pages,100).map(p=>({
    id:id(p?.id),name:str(p?.name,80)||'Sayfa',blocks:list(p?.blocks,2000).map(block)
  }));
  w.pageId=w.pages.some(p=>p.id===value.pageId)?value.pageId:w.pages[0]?.id;
  w.habits=list(value.habits,100).map(h=>({
    id:id(h?.id),name:str(h?.name,80),days:list(h?.days,2000).map(date).filter(Boolean)
  }));
  w.links=list(value.links,200).map(l=>({
    id:id(l?.id),name:str(l?.name,80),url:safeHttpUrl(l?.url)
  })).filter(l=>l.url);
  w.entries=Object.fromEntries(Object.entries(value.entries&&typeof value.entries==='object'&&!Array.isArray(value.entries)?value.entries:{
  }).filter(([day])=>date(day)).slice(0,1000).map(([day,text])=>[day,str(text,100000)]));
  w.entryDate=date(value.entryDate)||new Date().toISOString().slice(0,10);
  w.goal={
    name:str(value.goal?.name,80)||'Yeni hedef',current:number(value.goal?.current,0,0,1e9),target:number(value.goal?.target,10,1,1e9)
  };
  w.dates=list(value.dates,200).map(d=>({
    id:id(d?.id),name:str(d?.name,80),date:date(d?.date)
  })).filter(d=>d.date);
  w.duration=integer(value.duration,25,1,1440);
  w.remaining=integer(value.remaining,1500,0,86400);
  w.running=value.running===true;
  w.endAt=number(value.endAt,0,0,1e15)||null;
  return w;
}
export function sanitizeWorkspace(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Çalışma alanı verisi geçersiz.');
  if(!Array.isArray(input.widgets)||!Array.isArray(input.events))throw new Error('Çalışma alanının widget ve etkinlik listeleri geçersiz.');
  const version=input.schemaVersion??0;
  if(!Number.isInteger(version)||version>STATE_VERSION||version<0)throw new Error('Desteklenmeyen çalışma alanı sürümü.');
  const widgets=list(input.widgets,200).map(widget).filter(Boolean),ids=new Set();
  for(const w of widgets){
    if(ids.has(w.id))w.id=crypto.randomUUID();
    ids.add(w.id);
  }
  return {
    schemaVersion:STATE_VERSION,gridColumns:input.gridColumns===2?2:3,autoArrange:input.autoArrange!==false,widgets,events:list(input.events,2000).map(e=>({
      id:id(e?.id),date:date(e?.date),text:str(e?.text,180)
    })).filter(e=>e.date)
  };
}
