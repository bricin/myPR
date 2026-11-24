const CACHE = 'pr-pocket-v6';
const FILES = ['./','./index.html','./style.css','./app.js','./core.js','./storage.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    // Older pages have no update UI. Migrate them once without touching lift storage.
    const legacy=keys.some(key=>/^pr-pocket-v[1-5]$/.test(key));
    await Promise.all(keys.filter(key=>key.startsWith('pr-pocket-')&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
    if(legacy) {
      const windows=await self.clients.matchAll({type:'window'});
      for(const client of windows)if(client.url.startsWith(self.registration.scope))client.navigate(client.url).catch(()=>{});
    }
  })());
});
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
