// Case Study Builder — Node HTTP server for local use and Render (zero runtime dependencies).
// On Vercel the same API runs as a function (api/index.js) and static files are served by Vercel.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { handleApi, send, authorized } from './app.js';

const PORT = Number(process.env.PORT || 4400);
const PUBLIC_DIR = path.resolve('public');
const SHARED_DIR = path.resolve('shared');
const brandLocal = fs.existsSync(path.join(PUBLIC_DIR, 'brand', 'techstalwarts-logo-dark.svg'));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json' };
function serveFile(res, base, rel, spaFallback) {
  const file = path.resolve(base, '.' + path.posix.normalize('/' + decodeURIComponent(rel)));
  if (!file.startsWith(base)) return send(res, 404, { error: 'Not found' });
  fs.readFile(file, (err, buf) => {
    if (err) {
      if (!spaFallback) return send(res, 404, { error: 'Not found' });
      return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e, html) => (e ? send(res, 500, { error: 'index.html missing' }) : send(res, 200, html, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' })));
    }
    send(res, 200, buf, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') return send(res, 200, { ok: true });
  if (!authorized(req.headers.authorization)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Case Study Builder", charset="UTF-8"', 'Content-Type': 'text/plain' });
    return res.end('Password required');
  }
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, { brandLocal });
  if (url.pathname.startsWith('/shared/')) return serveFile(res, SHARED_DIR, url.pathname.slice(7), false);
  const isAsset = /\.[a-z0-9]+$/i.test(url.pathname);
  return serveFile(res, PUBLIC_DIR, url.pathname === '/' ? '/index.html' : url.pathname, !isAsset);
}).listen(PORT, () => console.log(`Case Study Builder running at http://localhost:${PORT}`));
