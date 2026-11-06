// Pip's Learning Island: offline support. Bump VERSION when you upload new files.
const VERSION="pip-2026-11-06";
const FILES=["./", "index.html", "manifest.webmanifest", "firebase-config.js", "sync.js", "vendor/firebase-app-compat.js", "vendor/firebase-firestore-compat.js", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "fonts/andika-latin-400-normal.woff2", "fonts/andika-latin-700-normal.woff2", "fonts/fredoka-latin-500-normal.woff2", "fonts/fredoka-latin-600-normal.woff2", "fonts/fredoka-latin-700-normal.woff2", "voice/add.json", "voice/add20.json", "voice/blends.json", "voice/build.json", "voice/buildsent.json", "voice/capitals.json", "voice/common.json", "voice/compare.json", "voice/count.json", "voice/digraphs.json", "voice/letters.json", "voice/magice.json", "voice/manifest.json", "voice/missing.json", "voice/neat.json", "voice/numbers.json", "voice/readq.json", "voice/readword.json", "voice/readword2.json", "voice/shapefacts.json", "voice/shapelike.json", "voice/shapename.json", "voice/shapeparts.json", "voice/shaperiddle.json", "voice/sightfind.json", "voice/sightfind2.json", "voice/sightfind3.json", "voice/sightfind4.json", "voice/sightfind5.json", "voice/sounds.json", "voice/spacefix.json", "voice/spacepick.json", "voice/stories.json", "voice/sub.json", "voice/sub20.json", "voice/tensones.json", "voice/truesilly.json"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const url=new URL(e.request.url);if(url.origin!==location.origin)return;
  if(e.request.mode==="navigate"){ // the page itself: try for updates first, fall back to the saved copy offline
    e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(VERSION).then(c=>c.put("index.html",cp));return r}).catch(()=>caches.match("index.html")));return}
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(VERSION).then(c=>c.put(e.request,cp))}return r})));
});
