import { safeHttpUrl } from './state-schema.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}
[c]));
const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dates=()=>Array.from({
  length:7
},(_,i)=>{
  const d=new Date();
  d.setDate(d.getDate()-6+i);
  return d;
});
export const extraTypes={
  habits:['Alışkanlıklar','Küçük adımlar, düzenli ilerleme'],links:['Hızlı bağlantılar','Sık açtığın yerlere tek tık'],journal:['Günlük kayıt','Her güne ayrı bir sayfa'],goal:['Hedef sayacı','Sayılabilir bir hedefin ilerlemesi'],dates:['Önemli tarihler','Yaklaşan günlere geri sayım']
};
export function renderExtra(w){
  if(w.type==='habits'){
    w.habits??=[];
    const days=dates();
    return `<div class="mini-eyebrow">SON 7 GÜN <span>BUGÜN</span></div>${w.habits.map(h=>`<div class="habit"><div class="habit-name"><strong>${esc(h.name)}</strong><button class="icon" data-habit-remove="${h.id}" aria-label="${esc(h.name)} alışkanlığını kaldır">×</button></div><div class="habit-week">${days.map(d=>`<button data-habit="${h.id}" data-day="${key(d)}" class="${h.days.includes(key(d))?'marked':''}" aria-pressed="${h.days.includes(key(d))}" aria-label="${esc(h.name)} ${key(d)}"><small>${new Intl.DateTimeFormat('tr',{weekday:'narrow'}).format(d)}</small><span>${h.days.includes(key(d))?'✓':d.getDate()}</span></button>`).join('')}</div></div>`).join('')||'<p class="widget-empty">Okumak, yürümek, bir şey üretmek…<br>Takip etmek istediğin bir alışkanlık ekle.</p>'}<form class="compact-form habit-form"><input name="name" maxlength="80" placeholder="Yeni alışkanlık" aria-label="Yeni alışkanlık" required><button aria-label="Alışkanlık ekle">＋</button></form>`;
  }
  if(w.type==='links'){
    w.links??=[];
    return `<div class="quick-links">${w.links.filter(l=>safeHttpUrl(l.url)).map(l=>`<div class="quick-link"><a href="${esc(safeHttpUrl(l.url))}" target="_blank" rel="noopener noreferrer"><span class="link-symbol">↗</span><span><strong>${esc(l.name)}</strong><small>${esc(new URL(l.url).hostname)}</small></span></a><button class="icon" data-link-remove="${l.id}" aria-label="${esc(l.name)} bağlantısını kaldır">×</button></div>`).join('')||'<p class="widget-empty">Projelerin, belgelerin, sık kullandıkların.<br>Hepsi aynı yerde.</p>'}</div><form class="link-form"><input name="name" maxlength="80" placeholder="Bağlantı adı" aria-label="Bağlantı adı" required><div class="compact-form"><input name="url" type="url" placeholder="https://…" aria-label="Bağlantı adresi" required><button aria-label="Bağlantı ekle">＋</button></div></form>`;
  }
  if(w.type==='journal'){
    w.entries??={
    };
    if(!/^\d{4}-\d{2}-\d{2}$/.test(w.entryDate||''))w.entryDate=key(new Date());
    return `<div class="journal-date"><label>Günün kaydı<input type="date" data-journal-date aria-label="Günlük tarihi" value="${esc(w.entryDate)}"></label></div><textarea class="journal-input" aria-label="Günlük notu" placeholder="Bugün nasıl geçti? Aklında ne kaldı?">${esc(w.entries[w.entryDate]||'')}</textarea><div class="note-bottom"><span>HER GÜNE AYRI BİR KAYIT</span><span data-entry-count>${Object.values(w.entries).filter(Boolean).length} gün</span></div>`;
  }
  if(w.type==='goal'){
    w.goal??={
      name:'Yeni hedef',current:0,target:10
    };
    const g=w.goal,pct=Math.min(100,Math.round(g.current/g.target*100));
    return `<form class="goal-form"><label>Hedef adı<input name="name" maxlength="80" value="${esc(g.name)}" required></label><label>Hedef miktarı<input name="target" type="number" min="1" max="1000000" value="${g.target}" required></label><button>Güncelle</button></form><div class="goal-stat"><strong>${g.current}<span> / ${g.target}</span></strong><span>${pct}%</span></div><div class="progress"><i style="width:${pct}%"></i></div><div class="goal-actions"><button data-goal-step="-1" aria-label="Hedefi bir azalt" ${g.current===0?'disabled':''}>− 1</button><button data-goal-step="1" aria-label="Hedefi bir artır">＋ 1</button></div>`;
  }
  if(w.type==='dates'){
    w.dates??=[];
    const today=key(new Date());
    return `<div class="date-list">${[...w.dates].sort((a,b)=>a.date.localeCompare(b.date)).map(d=>{const diff=Math.round((new Date(d.date+'T12:00:00')-new Date(today+'T12:00:00'))/86400000);return `<div class="date-item"><span><strong>${esc(d.name)}</strong><small>${esc(d.date)}</small></span><b>${diff===0?'Bugün':diff>0?diff+' gün':'Geçti'}</b><button class="icon" data-date-remove="${d.id}" aria-label="${esc(d.name)} tarihini kaldır">×</button></div>`;}).join('')||'<p class="widget-empty">Önemli bir günü ekle; kaç gün kaldığını burada gör.</p>'}</div><form class="dates-form"><input name="name" maxlength="80" placeholder="Etkinlik adı" aria-label="Önemli tarih adı" required><div class="compact-form"><input name="date" type="date" aria-label="Önemli tarih günü" required><button aria-label="Önemli tarih ekle">＋</button></div></form>`;
  }
}
export function bindExtra(w,root,{
  changed,render,notify
}){
  const update=()=>{
    changed();
    render();
  };
  root.querySelector('.habit-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    const name=e.target.elements.name.value.trim();
    if(name){
      w.habits.push({
        id:crypto.randomUUID(),name,days:[]
      });
      update();
    }
  });
  root.querySelectorAll('[data-habit]').forEach(b=>b.onclick=()=>{
    const h=w.habits.find(h=>h.id===b.dataset.habit),day=b.dataset.day;
    h.days=h.days.includes(day)?h.days.filter(d=>d!==day):[...h.days,day];
    update();
  });
  root.querySelectorAll('[data-habit-remove]').forEach(b=>b.onclick=()=>{
    if(confirm('Alışkanlık ve işaretli günler kaldırılsın mı?')){
      w.habits=w.habits.filter(h=>h.id!==b.dataset.habitRemove);
      update();
    }
  });
  root.querySelector('.link-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    const name=e.target.elements.name.value.trim();
    let url;
    try{
      url=new URL(e.target.elements.url.value);
      if(!['http:','https:'].includes(url.protocol))throw Error();
    }
    catch{
      notify('http:// veya https:// ile başlayan bir adres gir.');
      return;
    }
    if(name){
      w.links.push({
        id:crypto.randomUUID(),name,url:url.href
      });
      update();
    }
  });
  root.querySelectorAll('[data-link-remove]').forEach(b=>b.onclick=()=>{
    w.links=w.links.filter(l=>l.id!==b.dataset.linkRemove);
    update();
  });
  root.querySelector('[data-journal-date]')?.addEventListener('change',e=>{
    if(!e.target.value)return;
    w.entryDate=e.target.value;
    update();
  });
  root.querySelector('.journal-input')?.addEventListener('input',e=>{
    w.entries[w.entryDate]=e.target.value;
    changed();
    root.querySelector('[data-entry-count]').textContent=Object.values(w.entries).filter(Boolean).length+' gün';
  });
  root.querySelector('.goal-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    const name=e.target.elements.name.value.trim(),target=Number(e.target.elements.target.value);
    if(!name||!Number.isInteger(target)||target<1||target>1000000){
      notify('Hedef miktarı 1 ile 1.000.000 arasında olmalı.');
      return;
    }
    w.goal.name=name;
    w.goal.target=target;
    update();
  });
  root.querySelectorAll('[data-goal-step]').forEach(b=>b.onclick=()=>{
    w.goal.current=Math.max(0,w.goal.current+Number(b.dataset.goalStep));
    update();
  });
  root.querySelector('.dates-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    const name=e.target.elements.name.value.trim(),date=e.target.elements.date.value;
    if(!name||!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
    w.dates.push({
      id:crypto.randomUUID(),name,date
    });
    update();
  });
  root.querySelectorAll('[data-date-remove]').forEach(b=>b.onclick=()=>{
    w.dates=w.dates.filter(d=>d.id!==b.dataset.dateRemove);
    update();
  });
}
