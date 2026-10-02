// Isolated from Electron so download failures and restart gates can be tested.
export function createUpdateController({updater,enabled,version,publish,prepareQuit,install}) {
  let state={phase:enabled?'idle':'disabled',currentVersion:version,version:null,percent:0,message:''};
  let checking=null,installing=false;
  const emit=patch=>{state={...state,...patch};publish({...state});};
  updater.autoDownload=true;
  // Closing MONO must never silently launch an installer.
  updater.autoInstallOnAppQuit=false;
  updater.allowPrerelease=false;
  updater.allowDowngrade=false;
  updater.disableWebInstaller=true;
  updater.on('checking-for-update',()=>emit({phase:'checking',message:''}));
  updater.on('update-available',info=>emit({phase:'downloading',version:info.version,percent:0,message:''}));
  updater.on('download-progress',progress=>emit({phase:'downloading',percent:Math.max(0,Math.min(100,Number(progress.percent)||0))}));
  updater.on('update-not-available',()=>emit({phase:'current',message:''}));
  updater.on('update-downloaded',info=>emit({phase:'ready',version:info.version,percent:100,message:''}));
  updater.on('error',()=>emit({phase:'error',message:'Güncelleme alınamadı. Bağlantıyı kontrol edip yeniden dene.'}));
  return {
    status:()=>({...state}),
    check(){
      if(!enabled||installing||['downloading','ready'].includes(state.phase))return Promise.resolve({...state});
      if(checking)return checking;
      checking=Promise.resolve().then(()=>updater.checkForUpdates()).catch(()=>{
        emit({phase:'error',message:'Güncelleme alınamadı. Bağlantıyı kontrol edip yeniden dene.'});
      }).finally(()=>{checking=null;});
      return checking.then(()=>({...state}));
    },
    async restart(){
      if(!enabled||state.phase!=='ready'||installing)throw Error('Önce güncellemenin indirilmesini bekle.');
      installing=true;
      try{await prepareQuit();install();}
      catch(error){installing=false;emit({phase:'ready',message:'Yeniden başlatılamadı. Kaydı kontrol edip tekrar dene.'});throw error;}
    }
  };
}
