const CACHE = 'pr-pocket-v2';
const FILES = ['./','./index.html','./style.css','./app.js','./core.js','./storage.js','./sheets.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pr-pocket-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  const allowed=new Set(FILES.map(path=>new URL(path,self.registration.scope).href));
  if(!allowed.has(url.href)&&event.request.mode!=='navigate')return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const key=event.request.mode==='navigate'?new URL('./index.html',self.registration.scope).href:event.request;
    return (await cache.match(key)) || fetch(event.request);
  }));
});
