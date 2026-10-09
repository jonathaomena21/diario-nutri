/* Guarda o app no aparelho para abrir sem internet.
   O app (index.html) sempre tenta a versão nova da internet primeiro; só usa a guardada se estiver sem sinal.
   Os dados do usuário NÃO passam por aqui: eles ficam no localStorage. As chamadas da IA também não passam. */
const CACHE="diario-nutri-v1";
const CORE=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

// internet primeiro (espera até 5 s), se falhar usa a cópia guardada
async function netFirst(req){
  const c=await caches.open(CACHE);
  try{
    const res=await Promise.race([fetch(req),new Promise((_,no)=>setTimeout(()=>no(new Error("timeout")),5000))]);
    if(res.ok) c.put(req,res.clone());
    return res;
  }catch(e){
    return (await c.match(req,{ignoreSearch:true}))||(await c.match("index.html"))||Response.error();
  }
}
// cópia guardada primeiro (ícones e fontes, que quase nunca mudam)
async function cacheFirst(req){
  const c=await caches.open(CACHE);
  const hit=await c.match(req);if(hit) return hit;
  const res=await fetch(req);
  if(res.ok||res.type==="opaque") c.put(req,res.clone());
  return res;
}

self.addEventListener("fetch",e=>{
  const req=e.request;if(req.method!=="GET") return;
  const u=new URL(req.url);
  if(u.origin===location.origin){
    const page=req.mode==="navigate"||/(\/|\.html|\.webmanifest)$/.test(u.pathname);
    e.respondWith(page?netFirst(req):cacheFirst(req));
  }else if(u.hostname==="fonts.googleapis.com"||u.hostname==="fonts.gstatic.com"){
    e.respondWith(cacheFirst(req));
  }
});
