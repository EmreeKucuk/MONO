import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {handleApi} from './server/api.mjs';
const root=resolve('public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const csp="default-src 'self'; script-src 'self' https://sdk.scdn.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.spotify.com wss://*.spotify.com https://*.scdn.co; img-src 'self' data:; frame-src https://open.spotify.com https://sdk.scdn.co; base-uri 'none'; object-src 'none'; frame-ancestors 'none'";
http.createServer(async(req,res)=>{if(await handleApi(req,res))return;try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+sep))throw Error();const content=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':csp});res.end(content);}catch{res.writeHead(404);res.end('Not found');}}).listen(Number(process.env.PORT)||4173,process.env.HOST||(process.env.PORT?'0.0.0.0':'127.0.0.1'),()=>console.log(`Local: http://127.0.0.1:${process.env.PORT||4173}`));



