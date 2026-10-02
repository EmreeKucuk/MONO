import {app,BrowserWindow,ipcMain,clipboard,Notification,Tray,Menu,nativeImage,shell,safeStorage,session} from 'electron';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClipboardController} from './clipboard.mjs';
import {appOrigin,validPolicy,canNotify,validReminders} from './policy.mjs';
const folder=dirname(fileURLToPath(import.meta.url));
const origin=appOrigin(process.env.MONO_APP_URL||'https://mono-rho-eight.vercel.app');
if(process.env.MONO_DESKTOP_DATA_DIR)app.setPath('userData',resolve(process.env.MONO_DESKTOP_DATA_DIR));
app.setAppUserModelId('com.mono.dashboard');
const primary=app.requestSingleInstanceLock();if(!primary)app.quit();
app.on('second-instance',()=>{win?.show();win?.focus();});
let win,tray,quitting=false,history={enabled:true,items:[]},reminders=[],delivered=new Set(),policy={active:false,until:0,allowed:[]},saving=Promise.resolve(),storageError='',clipboardError='';
const historyState=()=>({...history,durable:!storageError&&safeStorage.isEncryptionAvailable(),error:clipboardError||storageError});
const historyPath=()=>resolve(app.getPath('userData'),'clipboard.encrypted');
function persistHistory(){
  saving=saving.catch(()=>{}).then(async()=>{
    if(!safeStorage.isEncryptionAvailable()){storageError='Windows şifrelemesi kullanılamıyor; geçmiş sadece bellekte tutuluyor.';return;}
    await mkdir(app.getPath('userData'),{recursive:true});
    await writeFile(historyPath()+'.tmp',safeStorage.encryptString(JSON.stringify({...history,delivered:[...delivered].slice(-2000)})),{flush:true});
    await rename(historyPath()+'.tmp',historyPath());storageError='';
  }).catch(error=>{
    storageError='Şifreli cihaz kaydı başarısız; geçmiş bellekte tutuluyor.';win?.webContents.send('mono:clipboard-changed');throw error;
  });
  win?.webContents.send('mono:clipboard-changed');return saving;
}
const clipboardController=createClipboardController({clipboard,getHistory:()=>history,persist:persistHistory});
function clipboardStatus(error){
  const message=error?'Pano okunamadı; otomatik yakalama yeniden deneyecek.':'';
  if(message!==clipboardError){clipboardError=message;win?.webContents.send('mono:clipboard-changed');}
}
async function capture(options){
  try{await clipboardController.capture(options);clipboardStatus(null);}
  catch(error){clipboardStatus(error);throw error;}
}
function authorize(event){
  if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame||new URL(event.senderFrame.url).origin!==origin)throw Error('Yetkisiz masaüstü isteği.');
}
const handle=(name,fn)=>ipcMain.handle('mono:'+name,(event,input)=>{authorize(event);return fn(input);});
function notify(input){
  if(!canNotify(policy,input?.category||'reminder'))return false;
  if(!Notification.isSupported())return false;
  const notification=new Notification({title:String(input?.title||'MONO').slice(0,100),body:String(input?.body||'').slice(0,300)});
  notification.on('click',()=>{win.show();win.focus();});notification.show();return true;
}
function spotifyAuth(url){
  const auth=new BrowserWindow({width:520,height:740,parent:win,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  auth.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  auth.webContents.on('will-navigate',(event,target)=>{if(![origin,'https://accounts.spotify.com'].includes(new URL(target).origin))event.preventDefault();});
  auth.webContents.on('did-navigate',(_,target)=>{if(new URL(target).origin===origin){win.loadURL(target);auth.close();}});
  auth.loadURL(url);
}
async function start(){
await app.whenReady();
try{history=JSON.parse(safeStorage.decryptString(await readFile(historyPath())));if(!Array.isArray(history.items))throw Error();delivered=new Set(Array.isArray(history.delivered)?history.delivered.filter(id=>typeof id==='string').slice(-2000):[]);history={enabled:true,items:history.items.filter(i=>typeof i?.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(i.id)&&typeof i.text==='string'&&Number.isFinite(i.at)).slice(0,100).map(i=>({id:i.id,text:i.text.slice(0,20000),at:i.at,pinned:i.pinned===true}))};}catch{history={enabled:true,items:[]};}
session.defaultSession.setPermissionRequestHandler((contents,permission,callback,details)=>callback(contents===win?.webContents&&new URL(details.requestingUrl||contents.getURL()).origin===origin&&['notifications','clipboard-sanitized-write'].includes(permission)));
win=new BrowserWindow({width:1320,height:900,minWidth:320,minHeight:450,title:'MONO '+app.getVersion(),icon:resolve(folder,'icon.png'),backgroundColor:'#111312',autoHideMenuBar:true,show:process.env.MONO_DESKTOP_TEST!=='1',webPreferences:{preload:resolve(folder,'preload.cjs'),additionalArguments:['--mono-origin='+origin,'--mono-version='+app.getVersion()],nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,backgroundThrottling:false}});
win.on('page-title-updated',event=>{event.preventDefault();win.setTitle('MONO '+app.getVersion());});
win.webContents.setWindowOpenHandler(({url})=>{if(/^https?:\/\//.test(url))shell.openExternal(url);return {action:'deny'};});
win.webContents.on('will-navigate',(event,url)=>{
  if(new URL(url).origin===origin)return;
  event.preventDefault();if(new URL(url).origin==='https://accounts.spotify.com')spotifyAuth(url);else if(/^https?:\/\//.test(url))shell.openExternal(url);
});
win.on('close',event=>{if(!quitting){event.preventDefault();win.hide();}});
win.webContents.on('did-fail-load',(_,code,message,url,isMain)=>{if(isMain&&code!==-3)win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<html lang="tr"><body style="background:#111312;color:#eee;font:16px system-ui;padding:40px"><h1>MONO yüklenemedi</h1><p>Bağlantını ve yayın adresini kontrol edip uygulamayı yeniden aç.</p></body></html>'));});
const image=nativeImage.createFromPath(resolve(folder,'icon.png')).resize({width:24,height:24});
tray=new Tray(image);tray.setToolTip('MONO '+app.getVersion());tray.setContextMenu(Menu.buildFromTemplate([{label:'MONO’yu aç',click:()=>{win.show();win.focus();}},{label:'Çıkış',click:()=>{quitting=true;app.quit();}}]));tray.on('double-click',()=>{win.show();win.focus();});
handle('clipboard-list',historyState);
handle('clipboard-watch',async enabled=>{if(typeof enabled!=='boolean')throw Error('Geçersiz pano ayarı.');history.enabled=true;await persistHistory();await capture();return historyState();});
handle('clipboard-capture',async()=>{await capture();return historyState();});
handle('clipboard-copy',id=>clipboardController.copy(id));
handle('clipboard-remove',id=>{history.items=history.items.filter(item=>item.id!==id);return persistHistory().then(historyState);});
handle('clipboard-pin',id=>{const item=history.items.find(item=>item.id===id);if(item)item.pinned=!item.pinned;return persistHistory().then(historyState);});
handle('clipboard-clear',async()=>{await clipboardController.clear();return historyState();});
handle('zone',input=>{policy=validPolicy(input);return policy;});
handle('reminders',input=>{reminders=validReminders(input);return true;});
handle('notify',notify);
handle('notification-settings',()=>process.platform==='win32'?shell.openExternal('ms-settings:notifications'):false);
setInterval(()=>{if(history.enabled)capture({automatic:true}).catch(()=>{});for(const item of reminders){if(item.at<=Date.now()&&!delivered.has(item.id)&&canNotify(policy,'reminder')){if(notify({title:'MONO · Hatırlatma',body:item.text,category:'reminder'})){delivered.add(item.id);persistHistory().catch(()=>{});}}}},750);
app.on('before-quit',()=>{quitting=true;});
await win.loadURL(origin);
}
if(primary)start().catch(error=>{console.error('MONO başlatılamadı:',error.message);app.exit(1);});
