import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

const root = resolve(import.meta.dirname, '../_site');
const prefix = '/branding-guideline';
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon', '.json':'application/json', '.webmanifest':'application/manifest+json', '.pdf':'application/pdf', '.mp4':'video/mp4', '.csv':'text/csv', '.md':'text/plain; charset=utf-8' };
const server = createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/') { res.writeHead(302, { Location: `${prefix}/` }); res.end(); return; }
    if (!pathname.startsWith(`${prefix}/`)) throw new Error('Outside project');
    pathname = pathname.slice(prefix.length);
    let file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root + sep) && file !== root) throw new Error('Outside root');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const size = (await stat(file)).size;
    const headers = { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Accept-Ranges':'bytes' };
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start > end) { res.writeHead(416, { 'Content-Range':`bytes */${size}` }); res.end(); return; }
      res.writeHead(206, { ...headers, 'Content-Range':`bytes ${start}-${end}/${size}`, 'Content-Length':end - start + 1 });
      createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { ...headers, 'Content-Length':size });
      if (req.method === 'HEAD') res.end();
      else createReadStream(file).pipe(res);
    }
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(4173, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:4173${prefix}/`));
