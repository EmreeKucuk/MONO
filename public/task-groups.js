const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}
[c]));
function normalize(w){
  w.groups??=[];
  for(const task of w.tasks)if(!w.groups.some(g=>g.id===task.groupId))task.groupId=null;
}
function options(w,selected){
  return `<option value="">Genel</option>${w.groups.map(g=>`<option value="${g.id}" ${g.id===selected?'selected':''}>${escape(g.name)}</option>`).join('')}`;
}
export function renderTaskGroups(w){
  normalize(w);
  const done=w.tasks.filter(t=>t.done).length;
  const groups=[{
    id:'',name:'Genel',collapsed:w.generalCollapsed
  },...w.groups];
  return `<div class="task-summary"><span>${done} / ${w.tasks.length} tamamlandı</span><span>${w.tasks.length?Math.round(done/w.tasks.length*100):0}%</span></div><div class="progress"><i style="width:${w.tasks.length?done/w.tasks.length*100:0}%"></i></div>
  <div class="task-groups">${groups.map(g=>{const tasks=w.tasks.filter(t=>(t.groupId||'')===g.id);return `<section class="task-group" data-group="${g.id}"><div class="group-heading"><button class="group-toggle" data-group-toggle="${g.id}" aria-expanded="${!g.collapsed}" aria-label="${escape(g.name)} grubunu ${g.collapsed?'aç':'kapat'}"><span class="chevron">${g.collapsed?'›':'⌄'}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 7V5h6l2 2h10v13H3z"/></svg><span>${escape(g.name)}</span><small>${tasks.filter(t=>t.done).length}/${tasks.length}</small></button>${g.id?`<button class="icon group-action" data-group-rename="${g.id}" aria-label="${escape(g.name)} grubunu yeniden adlandır">✎</button><button class="icon group-action" data-group-remove="${g.id}" aria-label="${escape(g.name)} grubunu kaldır" title="Grubu kaldır; görevleri Genel'e taşı">×</button>`:''}</div><div ${g.collapsed?'hidden':''}>${tasks.map(t=>`<div class="task-row ${t.done?'done':''}"><input type="checkbox" data-task="${t.id}" ${t.done?'checked':''} aria-label="${escape(t.text)}"><span class="task-text">${escape(t.text)}</span><details class="task-menu"><summary aria-label="${escape(t.text)} görev seçenekleri">⋯</summary><div class="task-menu-panel"><label>Gruba taşı<select data-task-group="${t.id}" aria-label="${escape(t.text)} için grup">${options(w,t.groupId)}</select></label><button data-task-delete="${t.id}">Görevi sil</button></div></details></div>`).join('')||'<p class="group-empty">Henüz görev yok.</p>'}</div></section>`}).join('')}</div>
  <details class="new-group"><summary>＋ Yeni grup</summary><form class="add-group"><input name="group" maxlength="60" placeholder="Örn. İş, Kişisel" aria-label="Yeni grup adı" required><button aria-label="Grup oluştur">Ekle</button></form></details>
  <form class="add-task grouped-add"><label class="task-destination">Görev grubu<select name="groupId" aria-label="Yeni görevin grubu">${options(w,'')}</select></label><div class="task-input-row"><input name="task" maxlength="300" placeholder="Yeni bir görev ekle…" aria-label="Yeni görev" required><button aria-label="Görev ekle">＋</button></div></form>`;
}
export function bindTaskGroups(w,el,{
  changed,render,notify
}){
  normalize(w);
  const update=()=>{
    changed();
    render();
  };
  el.querySelector('.add-group')?.addEventListener('submit',e=>{
    e.preventDefault();
    const name=e.target.elements.group.value.trim();
    if(!name)return;
    if(w.groups.some(g=>g.name.toLocaleLowerCase('tr')===name.toLocaleLowerCase('tr'))){
      notify('Bu isimde bir grup zaten var.');
      return;
    }
    w.groups.push({
      id:crypto.randomUUID(),name,collapsed:false
    });
    update();
  });
  el.querySelectorAll('[data-group-toggle]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.groupToggle;
    if(id){
      const g=w.groups.find(g=>g.id===id);
      g.collapsed=!g.collapsed;
    }
    else w.generalCollapsed=!w.generalCollapsed;
    update();
    el=document.querySelector(`[data-id="${w.id}"]`);
    el.querySelector(`[data-group-toggle="${id}"]`).focus();
  });
  el.querySelectorAll('[data-group-rename]').forEach(b=>b.onclick=()=>{
    const g=w.groups.find(g=>g.id===b.dataset.groupRename);
    const name=prompt('Grup adı',g.name)?.trim().slice(0,60);
    if(!name)return;
    if(w.groups.some(x=>x.id!==g.id&&x.name.toLocaleLowerCase('tr')===name.toLocaleLowerCase('tr'))){
      notify('Bu isimde bir grup zaten var.');
      return;
    }
    g.name=name;
    update();
  });
  el.querySelectorAll('[data-group-remove]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.groupRemove;
    w.groups=w.groups.filter(g=>g.id!==id);
    for(const t of w.tasks)if(t.groupId===id)t.groupId=null;
    w.generalCollapsed=false;
    update();
    notify('Grup kaldırıldı. Görevlerin Genel grubunda.');
  });
  el.querySelectorAll('[data-task-group]').forEach(s=>s.onchange=()=>{
    const id=s.value||null;
    w.tasks.find(t=>t.id===s.dataset.taskGroup).groupId=id;
    const group=w.groups.find(g=>g.id===id);
    if(group)group.collapsed=false;
    else w.generalCollapsed=false;
    update();
  });
  el.querySelector('.add-task')?.addEventListener('submit',e=>{
    e.preventDefault();
    const text=e.target.elements.task.value.trim();
    if(!text)return;
    const groupId=e.target.elements.groupId.value||null;
    w.tasks.push({
      id:crypto.randomUUID(),text,done:false,groupId
    });
    const g=w.groups.find(g=>g.id===groupId);
    if(g)g.collapsed=false;
    else w.generalCollapsed=false;
    update();
    const form=document.querySelector(`[data-id="${w.id}"] .add-task`);
    form.elements.groupId.value=groupId||'';
    form.elements.task.focus();
  });
  el.querySelectorAll('[data-task]').forEach(c=>c.onchange=()=>{
    w.tasks.find(t=>t.id===c.dataset.task).done=c.checked;
    update();
    document.querySelector(`[data-task="${c.dataset.task}"]`)?.focus();
  });
  el.querySelectorAll('[data-task-delete]').forEach(b=>b.onclick=()=>{
    w.tasks=w.tasks.filter(t=>t.id!==b.dataset.taskDelete);
    update();
  });
}
