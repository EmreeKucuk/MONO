import {escape} from './ui-utils.js';
let memory={enabled:false,items:[]},lastError='';
let refreshScheduled=false;
function refresh(){if(refreshScheduled)return;refreshScheduled=true;queueMicrotask(()=>{refreshScheduled=false;document.querySelectorAll('.clipboard-widget').forEach(root=>paint(root));});}
globalThis.window?.monoDesktop?.clipboard.onChange(value=>{memory=value;refresh();});
async function load(){if(window.monoDesktop)memory=await window.monoDesktop.clipboard.list();refresh();}
export function renderClipboard(){return `<section class="clipboard-widget"><div class="clipboard-controls"><label class="check-label"><input type="checkbox" data-clipboard-watch ${memory.enabled?'checked':''} ${window.monoDesktop?'':'disabled'}> Otomatik yakala</label><button type="button" data-clipboard-read>Panodan al</button><button type="button" data-clipboard-clear>Temizle</button></div><p class="help">${window.monoDesktop?'Geçmiş yalnızca bu cihazda şifreli saklanır; buluta gönderilmez. Şifreler gibi kopyaladığın hassas metinler de yakalanabilir.':'Otomatik yakalama masaüstü uygulamasında kullanılabilir. Buradaki geçmiş bu oturumda tutulur.'}</p><input type="search" data-clipboard-search aria-label="Clipboard geçmişinde ara" placeholder="Geçmişte ara"><p class="clipboard-message" role="status"></p><div class="clipboard-list"></div></section>`;}
function paint(root){
  if(!root.isConnected)return;const query=root.querySelector('[data-clipboard-search]').value.toLocaleLowerCase('tr');root.querySelector('[data-clipboard-watch]').checked=memory.enabled;root.querySelector('.clipboard-message').textContent=lastError||memory.error||(window.monoDesktop&&!memory.durable?'Şifreli kalıcı kayıt kullanılamıyor; geçmiş yalnızca bellekte.':'');
  const list=root.querySelector('.clipboard-list');list.innerHTML=memory.items.filter(i=>i.text.toLocaleLowerCase('tr').includes(query)).map(i=>`<article class="clipboard-item"><p>${escape(i.text)}</p><div><small>${i.pinned?'Sabitlendi · ':''}${escape(new Date(i.at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}))}</small><button type="button" data-copy="${i.id}" aria-label="Metni panoya kopyala">Kopyala</button><button type="button" data-pin="${i.id}" aria-pressed="${i.pinned===true}">${i.pinned?'Çöz':'Sabitle'}</button><button type="button" data-delete="${i.id}" aria-label="Clipboard kaydını sil">×</button></div></article>`).join('')||'<p class="widget-empty">Henüz kopyalanmış metin yok.</p>';
  list.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>run(async()=>{const item=memory.items.find(i=>i.id===b.dataset.copy);if(window.monoDesktop)await window.monoDesktop.clipboard.copy(item.id);else await navigator.clipboard.writeText(item.text);lastError='Panoya kopyalandı.';}));
  list.querySelectorAll('[data-pin]').forEach(b=>b.onclick=()=>run(async()=>{if(window.monoDesktop)memory=await window.monoDesktop.clipboard.pin(b.dataset.pin);else{const item=memory.items.find(i=>i.id===b.dataset.pin);item.pinned=!item.pinned;}}));
  list.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>run(async()=>{if(window.monoDesktop)memory=await window.monoDesktop.clipboard.remove(b.dataset.delete);else memory.items=memory.items.filter(i=>i.id!==b.dataset.delete);}));
}
async function run(action){try{lastError='';await action();}catch(e){lastError='Clipboard işlemi yapılamadı: '+e.message;}refresh();}
export function bindClipboard(container){
  const root=container.querySelector('.clipboard-widget');root.querySelector('[data-clipboard-search]').oninput=()=>paint(root);
  root.querySelector('[data-clipboard-watch]').onchange=e=>run(async()=>{memory=await window.monoDesktop.clipboard.watch(e.target.checked);});
  root.querySelector('[data-clipboard-clear]').onclick=()=>run(async()=>{if(window.monoDesktop)memory=await window.monoDesktop.clipboard.clear();else memory.items=[];});
  root.querySelector('[data-clipboard-read]').onclick=()=>run(async()=>{if(window.monoDesktop)memory=await window.monoDesktop.clipboard.capture();else{const text=(await navigator.clipboard.readText()).slice(0,20000);if(text&&!memory.items.some(i=>i.text===text))memory.items.unshift({id:crypto.randomUUID(),text,at:Date.now(),pinned:false});memory.items=memory.items.slice(0,100);}});
  paint(root);run(load);
}
