let latest={phase:'idle'},api,running=false,restarting=false;
function paint(){
  const button=document.querySelector('#desktop-update');if(!button)return;
  button.hidden=!api;
  button.disabled=running||['disabled','checking','downloading'].includes(latest.phase);
  const labels={disabled:'Geliştirme sürümü',checking:'Güncelleme kontrol ediliyor…',downloading:`Güncelleme · %${Math.round(latest.percent||0)}`,ready:'Güncelle ve yeniden başlat',error:'Güncellemeyi yeniden dene',current:'MONO güncel',idle:'Güncellemeleri kontrol et'};
  button.textContent=labels[latest.phase]||labels.idle;
  button.title=latest.message||`MONO ${latest.currentVersion||''}${latest.version?' → '+latest.version:''}`;
  button.onclick=async()=>{
    if(running)return;
    running=true;paint();
    const app=document.querySelector('#app');
    try{
      if(latest.phase==='ready'){
        document.activeElement?.blur();if(app)app.inert=true;
        await api.prepare();await window.monoDesktop.updates.install();restarting=true;
      }else latest=await window.monoDesktop.updates.check();
    }catch(error){api.cancel();api.notify(error.message);}
    finally{if(!restarting){if(app)app.inert=false;running=false;}paint();}
  };
}
export function bindDesktopUpdates(){paint();}
export function installDesktopUpdates(options){
  const bridge=window.monoDesktop?.updates;if(!bridge)return;
  api=options;
  bridge.onChange(value=>{latest=value;if(value.phase==='error'&&restarting){restarting=false;running=false;api.cancel();const app=document.querySelector('#app');if(app)app.inert=false;api.notify(value.message);}paint();});
  bridge.status().then(value=>{latest=value;paint();}).catch(error=>api.notify(error.message));
}
