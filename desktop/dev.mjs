import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),electron=require('electron');
const server=spawn(process.execPath,['--env-file-if-exists=.env','server.mjs'],{stdio:'inherit',env:{...process.env,PORT:'4173',HOST:'127.0.0.1'},windowsHide:true});
for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4173')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
const desktop=spawn(electron,['desktop/main.mjs'],{stdio:'inherit',env:{...process.env,MONO_APP_URL:'http://127.0.0.1:4173'},windowsHide:true});
desktop.on('exit',code=>{server.kill();process.exitCode=code||0;});process.on('SIGINT',()=>{desktop.kill();server.kill();});
