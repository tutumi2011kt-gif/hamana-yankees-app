const CACHE='hamana-gear-check-pop-v2';
const PREFIX='hamana-gear-check-';
const FILES=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./icon.svg','./assets/hero.svg','./data/items.json','./data/lists.json','./assets/items/ballbasket.svg','./assets/items/tballbasket.svg','./assets/items/foldbasket.svg','./assets/items/helmet.svg','./assets/items/bluesheet.svg','./assets/items/knockbat.svg','./assets/items/bso.svg','./assets/items/smallcones.svg','./assets/items/bases.svg','./assets/items/homebase.svg','./assets/items/linecar.svg','./assets/items/catcher.svg','./assets/items/umpire.svg','./assets/items/measure.svg','./assets/items/tent.svg','./assets/items/toolbox.svg','./assets/items/teabag.svg','./assets/items/bench.svg','./assets/items/coachchair.svg','./assets/items/scoretable.svg','./assets/items/scorechair.svg','./assets/items/shovel.svg','./assets/items/tballstand.svg','./assets/items/flagpole.svg','./assets/items/flagpole_support.svg'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const u=new URL(event.request.url);
 if(u.origin!==self.location.origin)return;
 event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
   if(response.ok){const c=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,c)).catch(()=>{})}
   return response;
 }).catch(async()=>{
   const cache=await caches.open(CACHE);
   return await cache.match(event.request) || (event.request.mode==='navigate'?await cache.match('./index.html'):Response.error());
 }));
});