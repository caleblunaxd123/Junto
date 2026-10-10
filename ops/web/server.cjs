// Read-only SPA host: /app is isolated from API and public/legal pages. No credentials or API cache.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.env.WEB_ROOT || path.join(__dirname, '../../apps/mobile/dist-beta'));
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.ico':'image/x-icon', '.svg':'image/svg+xml', '.ttf':'font/ttf', '.woff2':'font/woff2' };
function createServer() {
  return http.createServer((req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Cache-Control','no-store');
    // RN web needs inline styles, but scripts come only from the same-origin export.
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://junto.lunalav.pe; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{Allow:'GET, HEAD'}); res.end(); return; }
    let pathname;
    try { pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch {res.writeHead(400);res.end();return;}
    if(pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(req.method==='HEAD'?undefined:'{"status":"ok"}');return;}
    if(pathname==='/app'){res.writeHead(308,{Location:'/app/'});res.end();return;}
    if(!pathname.startsWith('/app/') || pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(p=>p==='..'||p.startsWith('.'))){res.writeHead(404);res.end();return;}
    const file = path.resolve(root,pathname.slice('/app/'.length) || 'index.html');
    if(file!==root && !file.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
    // Deep navigation reloads get the SPA. Missing assets never get HTML masquerading as JS.
    let selected=file;
    try {if(!fs.statSync(selected).isFile())throw new Error();} catch {
      if(path.extname(file) || /\/(assets|_expo)\//.test(pathname)){res.writeHead(404);res.end();return;}
      selected=path.join(root,'index.html');
    }
    try {
      const stat=fs.statSync(selected);res.setHeader('Content-Type',types[path.extname(selected)]||'application/octet-stream');
      if(/\/(assets|_expo)\//.test(pathname))res.setHeader('Cache-Control','public, max-age=31536000, immutable');
      res.setHeader('Content-Length',stat.size);res.writeHead(200);
      if(req.method==='HEAD')res.end();else fs.createReadStream(selected).pipe(res);
    } catch {res.writeHead(503);res.end('La beta está preparándose. Vuelve en unos minutos.');}
  });
}
if(require.main===module)createServer().listen(Number(process.env.PORT||8090),process.env.HOST||'127.0.0.1',()=>console.info('JUNTO beta web ready'));
module.exports={createServer};
