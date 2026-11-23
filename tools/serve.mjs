import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {watch} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};
const clients=new Set();
const devClient=`const stream = new EventSource('/__dev/events');
stream.addEventListener('reload', () => location.reload());
// Offline caches belong to the deployed PWA, not the development preview.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(async registrations => {
    await Promise.all(registrations.map(registration => registration.unregister()));
    if (navigator.serviceWorker.controller) location.reload();
  });
}`;
let timer;
watch(root,{recursive:true},(_event,filename)=>{
  if(!filename||filename.startsWith('.')||filename.startsWith('node_modules')||filename.startsWith('tests/')||filename.endsWith('.md'))return;
  clearTimeout(timer);timer=setTimeout(()=>{for(const client of clients)client.write('event: reload\ndata: changed\n\n');},100);
});
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/__dev/events'){
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});
      res.write(': connected\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;
    }
    if(url.pathname==='/__dev/client.js'){
      res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'}).end(devClient);return;
    }
    const filename=decodeURIComponent(url.pathname),target=path.resolve(root,'.'+(filename.endsWith('/')?filename+'index.html':filename));
    if(!target.startsWith(root)||filename.split('/').some(part=>part.startsWith('.'))){res.writeHead(403).end();return;}
    let data=await readFile(target);
    if(path.extname(target)==='.html')data=Buffer.from(data.toString().replace('</head>','<script src="/__dev/client.js" defer></script></head>'));
    res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'text/plain','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}).end(data);
  }catch{res.writeHead(404).end('Not found');}
}).listen(5173,'127.0.0.1',()=>console.log('myPR live preview: http://localhost:5173'));
