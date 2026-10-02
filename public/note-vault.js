import {sanitizeNoteBlocks} from './state-schema.js';
const opened=new WeakMap(),pending=new Set(),iterations=600000;
const bytes=text=>new TextEncoder().encode(text),decode=value=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
function encode(value){let text='';for(let offset=0;offset<value.length;offset+=8192)text+=String.fromCharCode(...value.subarray(offset,offset+8192));return btoa(text);}
async function keyFor(password,salt){const material=await crypto.subtle.importKey('raw',bytes(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
const aad=(widgetId,page)=>bytes('MONO/page/v1/'+widgetId+'/'+page.id);
export function isPageOpen(page){return !page.encrypted||opened.has(page);}
export function openedPage(page){const data=opened.get(page);if(data){data.page.name=page.name;return data.page;}return page;}
function track(work){pending.add(work);work.finally(()=>pending.delete(work)).catch(()=>{});return work;}
export function protectPage(page,widgetId,password){return track((async()=>{
  if(password.length<8)throw Error('En az 8 karakterlik bir şifre kullan.');
  const salt=crypto.getRandomValues(new Uint8Array(16)),key=await keyFor(password,salt);
  const virtual={id:page.id,name:page.name,blocks:structuredClone(page.blocks)};
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(widgetId,page)},key,bytes(JSON.stringify(virtual.blocks)));
  page.encrypted={version:1,iterations,salt:encode(salt),iv:encode(iv),ciphertext:encode(new Uint8Array(ciphertext))};page.blocks=[];
})());}
export async function unlockPage(page,widgetId,password){
  try{const key=await keyFor(password,decode(page.encrypted.salt));const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(page.encrypted.iv),additionalData:aad(widgetId,page)},key,decode(page.encrypted.ciphertext));const blocks=sanitizeNoteBlocks(JSON.parse(new TextDecoder().decode(plain)));opened.set(page,{key,page:{id:page.id,name:page.name,blocks:blocks.length?blocks:[{id:crypto.randomUUID(),type:'text',text:'',indent:0,done:false}]},queue:Promise.resolve()});}
  catch{throw Error('Şifre yanlış veya şifreli veri bozulmuş.');}
}
export function saveOpenedPage(page,widgetId){
  const data=opened.get(page);if(!data)return Promise.resolve();
  const snapshot=bytes(JSON.stringify(data.page.blocks));
  const job=data.queue.catch(()=>{}).then(async()=>{const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(widgetId,page)},data.key,snapshot);page.encrypted={...page.encrypted,iv:encode(iv),ciphertext:encode(new Uint8Array(cipher))};});
  data.queue=job;return track(job);
}
export async function lockPage(page){await opened.get(page)?.queue;opened.delete(page);}
export async function removePassword(page){const data=opened.get(page);if(!data)throw Error('Önce sayfayı aç.');await data.queue;page.blocks=structuredClone(data.page.blocks);delete page.encrypted;opened.delete(page);}
export const hasPendingEncryption=()=>pending.size>0;
export async function flushEncryption(){await Promise.all([...pending]);}
export function askPassword({title,confirm=false}){
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='name-dialog';dialog.setAttribute('aria-labelledby','password-title');
    dialog.innerHTML='<form><h2 id="password-title"></h2><p>Şifre unutulursa içeriği geri açamayız. Şifre yalnızca bu cihazın belleğinde kullanılır.</p><label>Şifre<input type="password" name="password" required autocomplete="current-password"></label>'+(confirm?'<label>Şifreyi tekrar gir<input type="password" name="confirm" required autocomplete="new-password"></label>':'')+'<p role="alert"></p><div class="actions"><button type="button" data-cancel>Vazgeç</button><button type="submit" class="primary">Devam</button></div></form>';
    dialog.querySelector('h2').textContent=title;const form=dialog.querySelector('form');
    form.onsubmit=event=>{event.preventDefault();if(confirm&&(form.elements.password.value.length<8||form.elements.password.value!==form.elements.confirm.value)){dialog.querySelector('[role=alert]').textContent='En az 8 karakter kullan ve iki şifreyi aynı gir.';return;}dialog.close('save');};dialog.querySelector('[data-cancel]').onclick=()=>dialog.close('cancel');
    dialog.onclose=()=>{const value=dialog.returnValue==='save'?form.elements.password.value:null;form.reset();dialog.remove();resolve(value);};document.body.append(dialog);dialog.showModal();form.elements.password.focus();
  });
}
