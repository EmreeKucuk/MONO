export function askName({
  title,value,maxLength=80
}){
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');
    dialog.className='name-dialog';
    dialog.setAttribute('aria-labelledby','name-dialog-title');
    dialog.innerHTML=`<form><h2 id="name-dialog-title"></h2><label>Ad<input name="name" required autofocus></label><div class="actions"><button type="button" data-cancel>Vazgeç</button><button class="primary" type="submit">Kaydet</button></div></form>`;
    dialog.querySelector('h2').textContent=title;
    const input=dialog.querySelector('input');
    input.value=value||'';
    input.maxLength=maxLength;
    document.body.append(dialog);
    dialog.querySelector('form').onsubmit=e=>{
      e.preventDefault();
      dialog.close('save');
    };
    dialog.querySelector('[data-cancel]').onclick=()=>dialog.close('cancel');
    dialog.addEventListener('close',()=>{
      const name=dialog.returnValue==='save'?input.value.trim():null;
      dialog.remove();
      resolve(name||null);
    },{
      once:true
    });
    dialog.showModal();
    input.focus();
    input.select();
  });
}
