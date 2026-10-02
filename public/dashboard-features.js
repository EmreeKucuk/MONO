import {parseCapture} from './capture-parser.js';
import {escape} from './ui-utils.js';

const categoryNames={reminder:'Hatırlatmalar',focus:'Odak sayacı',zone:'Zone tamamlandı'};
let api,delivered=new Set();
try{delivered=new Set(JSON.parse(localStorage.getItem('mono-delivered-reminders')||'[]'));}catch{/* Optional device history. */}
const uid=()=>crypto.randomUUID();
const currentPolicy=()=>{const zone=api.state().activeZone;return {active:!!zone,until:zone?.endAt||0,allowed:zone?.allowed||[]};};
const permitted=category=>{const p=currentPolicy();return !p.active||(p.until>0&&p.until<=Date.now())||p.allowed.includes(category);};
function defaults(){const s=api.state();s.reminders??=[];s.zoneProfiles??=[{id:uid(),name:'Working Zone',minutes:25,allowed:[]},{id:uid(),name:'Study Zone',minutes:50,allowed:[]}];if(!s.zoneProfiles.length)s.zoneProfiles=[{id:uid(),name:'Working Zone',minutes:25,allowed:[]},{id:uid(),name:'Study Zone',minutes:50,allowed:[]}];}
function modal(title,body){
  const dialog=document.createElement('dialog');dialog.className='dashboard-dialog';const id='dialog-'+uid();
  dialog.setAttribute('aria-labelledby',id);dialog.innerHTML=`<header><h2 id="${id}">${escape(title)}</h2><button type="button" data-close aria-label="Paneli kapat">×</button></header>${body}`;
  document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.showModal();return dialog;
}
function error(dialog,message){dialog.querySelector('[role=alert]').textContent=message;}
export async function requestNotifications(){
  if(window.monoDesktop){api.notify('Masaüstü bildirimleri kullanılabilir. Windows ayarlarından MONO bildirimlerine izin ver.');return;}
  if(!('Notification' in window)){api.notify('Bu tarayıcı bildirimleri desteklemiyor.');return;}
  const permission=await Notification.requestPermission();api.notify(permission==='granted'?'Bildirimler açıldı. MONO açıkken hatırlatmalar gösterilecek.':'Bildirim izni verilmedi. Hatırlatmalar MONO içinde gösterilir.');
}
export async function dashboardNotification(title,body,category='reminder'){
  if(!permitted(category))return false;
  if(window.monoDesktop){try{return await window.monoDesktop.notify({title,body,category});}catch{api.notify(body);return true;}}
  if('Notification' in window&&Notification.permission==='granted')try{const notification=new Notification(title,{body,icon:'/favicon.svg'});notification.onclick=()=>{window.focus();notification.close();};}catch{/* Still show the in-app reminder. */}
  api.notify(body);return true;
}
export function syncDashboard(){
  if(!api)return;defaults();paintZone();
  if(window.monoDesktop){window.monoDesktop.zone(currentPolicy()).catch(()=>{});window.monoDesktop.reminders.sync(api.state().reminders.filter(r=>!r.done)).catch(error=>api.notify(error.message));}
}
function paintZone(){
  const el=document.querySelector('#zone-open');if(!el)return;
  const s=api.state(),z=s.activeZone,p=s.zoneProfiles.find(p=>p.id===z?.profileId);
  el.textContent=z?`${p?.name||'Zone'} · ${z.endAt?Math.max(0,Math.ceil((z.endAt-Date.now())/60000))+' dk':'Süresiz'}`:'Zone';el.classList.toggle('zone-active',!!z);
  const count=document.querySelector('#reminders-open');if(count)count.textContent=`Hatırlatmalar${s.reminders.filter(r=>!r.done).length?' · '+s.reminders.filter(r=>!r.done).length:''}`;
}
export function openQuickCapture(){
  const d=modal('Hızlı yakalama',`<form class="capture-form"><label>Ne zaman, ne yapacaksın?<textarea name="capture" maxlength="400" rows="3" placeholder="Yarın 14:30 proje toplantısı\n20 dakika sonra su iç hatırlat" required></textarea></label><p class="help">Gün adı, tam tarih veya “20 dakika sonra” yaz. Kaydetmeden önce tarihi kontrol et.</p><button type="button" data-parse>Tarihi çözümle</button><div class="capture-preview" hidden><label>Kaydetme türü<select name="kind"><option value="event">Takvim etkinliği</option><option value="reminder">Hatırlatma</option></select></label><label>Açıklama<input name="text" maxlength="180"></label><label>Tarih ve saat<input type="datetime-local" name="when"></label><p class="help">Saat belirtilmezse 09:00 önerilir.</p><button type="submit" class="primary">Kaydet</button></div><p role="alert"></p></form>`);
  const f=d.querySelector('form'),preview=d.querySelector('.capture-preview');let parsed=null;
  f.elements.capture.oninput=()=>{parsed=null;preview.hidden=true;};
  d.querySelector('[data-parse]').onclick=()=>{try{parsed=parseCapture(f.elements.capture.value);f.elements.kind.value=parsed.kind;f.elements.text.value=parsed.text;f.elements.when.value=parsed.date+'T'+(parsed.time||'09:00');preview.hidden=false;error(d,'');f.elements.text.focus();}catch(e){error(d,e.message);preview.hidden=true;}};
  f.onsubmit=e=>{e.preventDefault();if(!parsed)return;const at=new Date(f.elements.when.value).getTime(),text=f.elements.text.value.trim();if(!text||!Number.isFinite(at))return error(d,'Açıklama ve geçerli bir tarih gir.');const s=api.state();if(f.elements.kind.value==='reminder'){if(at<=Date.now())return error(d,'Hatırlatma için gelecekte bir saat seç.');s.reminders.push({id:uid(),text,at,deskId:s.activeDeskId,done:false});}else s.events.push({id:uid(),text,date:f.elements.when.value.slice(0,10),time:f.elements.when.value.slice(11,16)});api.changed();api.calendar();syncDashboard();d.close();api.notify('Kaydedildi.');};
  f.elements.capture.focus();
}
export function openReminders(){
  defaults();const d=modal('Hatırlatmalar',`<button type="button" data-permission>Bildirimleri etkinleştir</button><p class="help">Masaüstünde MONO sistem tepsisinde çalışırken de hatırlatır. Tamamen kapatıldığında bildirim veremez.</p><form class="reminder-form"><label>Açıklama<input name="text" maxlength="300" required></label><label>Tarih ve saat<input name="when" type="datetime-local" required></label><button class="primary">Hatırlatma ekle</button><p role="alert"></p></form><div class="reminder-list"></div>`);
  const paint=()=>{const list=d.querySelector('.reminder-list'),items=[...api.state().reminders].sort((a,b)=>a.at-b.at);list.innerHTML=items.map(r=>`<div class="reminder-item ${r.done?'done':''}"><div><strong>${escape(r.text)}</strong><time>${escape(new Date(r.at).toLocaleString('tr-TR'))}</time><small>${r.done?'Tamamlandı':r.at<=Date.now()?'Zamanı geldi':'Planlandı'}</small></div><button data-done="${r.id}" aria-label="${escape(r.text)} ${r.done?'yeniden aç':'tamamla'}">${r.done?'↶':'✓'}</button><button data-delete="${r.id}" aria-label="${escape(r.text)} sil">×</button></div>`).join('')||'<p class="widget-empty">Henüz hatırlatma yok.</p>';list.querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>{const r=api.state().reminders.find(r=>r.id===b.dataset.done);r.done=!r.done;api.changed();syncDashboard();paint();});list.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{api.state().reminders=api.state().reminders.filter(r=>r.id!==b.dataset.delete);api.changed();syncDashboard();paint();});};
  d.querySelector('[data-permission]').onclick=requestNotifications;const f=d.querySelector('form');f.onsubmit=e=>{e.preventDefault();const at=new Date(f.elements.when.value).getTime();if(!Number.isFinite(at)||at<=Date.now())return error(d,'Gelecekte bir tarih ve saat seç.');const text=f.elements.text.value.trim();if(!text)return;api.state().reminders.push({id:uid(),text,at,deskId:api.state().activeDeskId,done:false});api.changed();syncDashboard();f.reset();error(d,'');paint();};paint();
}
export function openZone(){
  defaults();const s=api.state(),d=modal('Odak alanı · Zone',`<form><label>Alan<select name="profile">${s.zoneProfiles.map(p=>`<option value="${p.id}">${escape(p.name)}</option>`).join('')}</select></label><label>Süre (dakika)<input name="minutes" type="number" min="0" max="1440" required></label><p class="help">0: süresiz. Zone sırasında izin verilen MONO bildirimleri:</p><fieldset><legend>Bildirim istisnaları</legend>${Object.entries(categoryNames).map(([key,name])=>`<label class="check-label"><input type="checkbox" name="${key}">${name}</label>`).join('')}</fieldset><div class="actions"><button type="button" data-new>Yeni Zone</button><button type="button" data-stop>Zone'dan çık</button><button class="primary">Zone'a gir</button></div><p role="alert"></p></form><p class="help">Diğer uygulamaların bildirimlerini okumak ve uygulamaya göre otomatik susturmak bu sürümde desteklenmiyor. Windows'un Rahatsız Etmeyin ayarını kullanabilirsin.</p>${window.monoDesktop?'<button type="button" data-settings>Windows bildirim ayarlarını aç</button>':''}`);
  const f=d.querySelector('form');if(s.activeZone)f.elements.profile.value=s.activeZone.profileId;
  const fill=()=>{const p=s.zoneProfiles.find(p=>p.id===f.elements.profile.value)||s.zoneProfiles[0];f.elements.minutes.value=p.minutes;for(const key of Object.keys(categoryNames))f.elements[key].checked=p.allowed.includes(key);};f.elements.profile.onchange=fill;fill();
  d.querySelector('[data-new]').onclick=async()=>{const name=await api.askName({title:'Yeni Zone adı',value:'',maxLength:60});if(name){const p={id:uid(),name,minutes:25,allowed:[]};s.zoneProfiles.push(p);const option=new Option(name,p.id);f.elements.profile.add(option);f.elements.profile.value=p.id;fill();api.changed();}};
  d.querySelector('[data-stop]').onclick=()=>{s.activeZone=null;api.changed();syncDashboard();d.close();};
  d.querySelector('[data-settings]')?.addEventListener('click',()=>window.monoDesktop.notificationSettings().catch(e=>error(d,e.message)));
  f.onsubmit=e=>{e.preventDefault();const minutes=Number(f.elements.minutes.value);if(!Number.isInteger(minutes)||minutes<0||minutes>1440)return error(d,'0 ile 1440 dakika arasında bir süre seç.');const p=s.zoneProfiles.find(p=>p.id===f.elements.profile.value);p.minutes=minutes;p.allowed=Object.keys(categoryNames).filter(k=>f.elements[k].checked);s.activeZone={profileId:p.id,startedAt:Date.now(),endAt:minutes?Date.now()+minutes*60000:0,allowed:[...p.allowed]};api.changed();syncDashboard();d.close();};
}
export function installDashboard(options){
  api=options;
  setInterval(async()=>{defaults();const s=api.state(),zone=s.activeZone;if(zone?.endAt&&zone.endAt<=Date.now()){s.activeZone=null;api.changed();syncDashboard();await dashboardNotification('Zone tamamlandı','Odak alanından çıktın.','zone');}paintZone();if(window.monoDesktop)return;for(const r of s.reminders){if(r.done||r.at>Date.now()||delivered.has(r.id))continue;if(await dashboardNotification('MONO · Hatırlatma',r.text)){delivered.add(r.id);try{localStorage.setItem('mono-delivered-reminders',JSON.stringify([...delivered].slice(-2000)));}catch{}}}},1000);
  document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.shiftKey&&e.code==='Space'&&!e.isComposing&&!document.querySelector('dialog[open]')){e.preventDefault();openQuickCapture();}});
}
export function bindDashboard(){
  document.querySelector('#quick-capture-open').onclick=openQuickCapture;document.querySelector('#reminders-open').onclick=openReminders;document.querySelector('#zone-open').onclick=openZone;syncDashboard();
}
