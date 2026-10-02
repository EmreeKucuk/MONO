import {escape} from './ui-utils.js';
let memory={enabled:false,items:[]},lastError='';
let refreshScheduled=false;
function refresh(){if(refreshScheduled)return;refreshScheduled=true;queueMicrotask(()=>{refreshScheduled=false;document.querySelectorAll('.clipboard-widget').forEach(root=>paint(root));});}
globalThis.window?.monoDesktop?.clipboard.onChange(value=>{memory=value;refresh();});
async function load(){if(window.monoDesktop){memory=await window.monoDesktop.clipboard.list();if(!memory.enabled)memory=await window.monoDesktop.clipboard.watch(true);}refresh();}
export function renderClipboard(){return `<section class="clipboard-widget"><p class="clipboard-message" role="status" hidden></p><div class="clipboard-list" role="list" tabindex="0" aria-label="Clipboard geçmişi"></div></section>`;}
function paint(root){
  if(!root.isConnected)return;const message=root.querySelector('.clipboard-message');message.textContent=lastError||memory.error||(window.monoDesktop&&!memory.durable?'Şifreli kalıcı kayıt kullanılamıyor; geçmiş yalnızca bellekte.':'');message.hidden=!message.textContent;
  const list=root.querySelector('.clipboard-list');
  const active=document.activeElement;
  const focused=list.contains(active)?['copy','pin','delete'].map(key=>({key,id:active.dataset?.[key]})).find(value=>value.id):null;
  list.innerHTML=memory.items.map(i=>`<article class="clipboard-item" role="listitem"><p>${escape(i.text)}</p><div><small>${i.pinned?'Sabitlendi · ':''}${escape(new Date(i.at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}))}</small><button type="button" data-copy="${i.id}" aria-label="Metni panoya kopyala">Kopyala</button><button type="button" data-pin="${i.id}" aria-pressed="${i.pinned===true}">${i.pinned?'Çöz':'Sabitle'}</button><button type="button" data-delete="${i.id}" aria-label="Clipboard kaydını sil">×</button></div></article>`).join('')||`<p class="widget-empty">Henüz kopyalanmış metin yok.${window.monoDesktop?'':' Otomatik yakalama masaüstü uygulamasında çalışır.'}</p>`;
  list.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>run(async()=>{const item=memory.items.find(i=>i.id===b.dataset.copy);if(window.monoDesktop)await window.monoDesktop.clipboard.copy(item.id);else await navigator.clipboard.writeText(item.text);lastError='Panoya kopyalandı.';}));
  list.querySelectorAll('[data-pin]').forEach(b=>b.onclick=()=>run(async()=>{if(window.monoDesktop)memory=await window.monoDesktop.clipboard.pin(b.dataset.pin);else{const item=memory.items.find(i=>i.id===b.dataset.pin);item.pinned=!item.pinned;}}));
  list.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>run(async()=>{if(window.monoDesktop)memory=await window.monoDesktop.clipboard.remove(b.dataset.delete);else memory.items=memory.items.filter(i=>i.id!==b.dataset.delete);}));
  if(focused){const replacement=[...list.querySelectorAll(`[data-${focused.key}]`)].find(button=>button.dataset[focused.key]===focused.id);(replacement||list).focus({preventScroll:true});}
}
async function run(action){try{lastError='';await action();}catch(e){lastError='Clipboard işlemi yapılamadı: '+e.message;}refresh();}
export function bindClipboard(container){
  const root=container.querySelector('.clipboard-widget');
  paint(root);run(load);
}
