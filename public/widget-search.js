const fold=s=>s.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
export function installWidgetSearch(types,addWidget,icon){
  const dialog=document.createElement('dialog');
  dialog.className='widget-search';
  dialog.setAttribute('aria-labelledby','widget-search-title');
  dialog.innerHTML=`<header><h2 id="widget-search-title">Widget ekle</h2><button class="icon" aria-label="Widget aramasını kapat">×</button></header><input id="widget-query" type="search" role="combobox" aria-label="Widget ara" aria-autocomplete="list" aria-controls="widget-results" aria-expanded="true" autocomplete="off" placeholder="Not, takvim, alışkanlık…"><div id="widget-results" role="listbox" aria-label="Widget'lar"></div><footer>↑ ↓ gezin · Enter ekle · Esc kapat <span>Shift + &lt; + Z</span></footer>`;
  document.body.append(dialog);
  const input=dialog.querySelector('input'),list=dialog.querySelector('[role=listbox]');
  let selected=0,results=[];
  const render=()=>{
    const query=fold(input.value.trim());
    results=Object.entries(types).filter(([type,values])=>fold(type+' '+values.join(' ')).includes(query));
    selected=Math.max(0,Math.min(selected,results.length-1));
    list.innerHTML='';
    results.forEach(([type,[name,description]],i)=>{
      const option=document.createElement('div');
      option.id=`widget-result-${type}`;
      option.setAttribute('role','option');
      option.setAttribute('aria-selected',i===selected);
      option.className='widget-result';
      option.innerHTML=icon(type);
      const text=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small');
      title.textContent=name;
      detail.textContent=description;
      text.append(title,detail);
      option.append(text);
      option.onpointerdown=e=>e.preventDefault();
      option.onclick=()=>choose(i);
      list.append(option);
    });
    if(!results.length){
      list.textContent='Eşleşen widget yok. Başka bir kelime dene.';
      input.removeAttribute('aria-activedescendant');
    }
    else input.setAttribute('aria-activedescendant',`widget-result-${results[selected][0]}`);
  };
  const choose=i=>{
    const result=results[i];
    if(!result)return;
    dialog.close();
    const w=addWidget(result[0]);
    document.querySelector(`[data-id="${w.id}"] .widget-head`)?.focus({
      preventScroll:true
    });
  };
  input.oninput=()=>{
    selected=0;
    render();
  };
  input.onkeydown=e=>{
    if(['ArrowDown','ArrowUp'].includes(e.key)){
      e.preventDefault();
      if(!results.length)return;
      selected=(selected+(e.key==='ArrowDown'?1:-1)+results.length)%results.length;
      render();
      list.querySelector('[aria-selected=true]')?.scrollIntoView({
        block:'nearest'
      });
    }
    else if(e.key==='Enter'){
      e.preventDefault();
      choose(selected);
    }
  };
  dialog.querySelector('header button').onclick=()=>dialog.close();
  dialog.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      e.preventDefault();
      e.stopPropagation();
      dialog.close();
    }
  },true);
  document.addEventListener('keydown',e=>{
    if(dialog.open&&e.key==='Escape'){
      e.preventDefault();
      e.stopImmediatePropagation();
      dialog.close();
      pressed.clear();
    }
  },true);
  const open=()=>{
    if(document.querySelector('dialog[open]'))return;
    input.value='';
    selected=0;
    render();
    dialog.showModal();
    input.focus();
  };
  const pressed=new Set();
  document.addEventListener('keydown',e=>{
    if(e.isComposing)return;
    pressed.add(e.code||e.key);
    const angle=e.code==='IntlBackslash'||e.key==='<'||e.key==='>';
    const z=e.code==='KeyZ'||e.key.toLowerCase()==='z';
    const angleHeld=[...pressed].some(k=>k==='IntlBackslash'||k==='Comma'||k==='<');
    if(e.shiftKey&&((z&&angleHeld)||(angle&&pressed.has('KeyZ')))){
      e.preventDefault();
      e.stopImmediatePropagation();
      open();
    }
  },true);
  document.addEventListener('keyup',e=>pressed.delete(e.code||e.key));
  window.addEventListener('blur',()=>pressed.clear());
  return open;
}
