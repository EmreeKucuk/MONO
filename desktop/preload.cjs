const {contextBridge,ipcRenderer}=require('electron');
const origin=process.argv.find(value=>value.startsWith('--mono-origin='))?.slice(14);
if(window.location.origin===origin){
  const invoke=(action,value)=>ipcRenderer.invoke('mono:'+action,value);
  contextBridge.exposeInMainWorld('monoDesktop',Object.freeze({
    platform:process.platform,version:1,appVersion:process.argv.find(value=>value.startsWith('--mono-version='))?.slice(15)||'Bilinmiyor',
    clipboard:{list:()=>invoke('clipboard-list'),watch:enabled=>invoke('clipboard-watch',enabled),copy:id=>invoke('clipboard-copy',id),remove:id=>invoke('clipboard-remove',id),pin:id=>invoke('clipboard-pin',id),clear:()=>invoke('clipboard-clear'),capture:()=>invoke('clipboard-capture'),onChange:callback=>{const listener=()=>invoke('clipboard-list').then(callback).catch(()=>{});ipcRenderer.on('mono:clipboard-changed',listener);return ()=>ipcRenderer.removeListener('mono:clipboard-changed',listener);}},
    reminders:{sync:items=>invoke('reminders',items)},
    zone:policy=>invoke('zone',policy),
    notify:message=>invoke('notify',message),
    notificationSettings:()=>invoke('notification-settings')
  }));
}
