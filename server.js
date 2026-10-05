// Zero-dependency server: one secret URL (/m/<TOKEN>) serves the app, /api/<TOKEN> stores its single JSON doc.
import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || '/data';
const TOKEN = process.env.TOKEN || '';
const FILE = `${DATA_DIR}/leave.json`;
const PUB = new URL('./public/', import.meta.url);
const ASSETS = { 'app.js': 'text/javascript', 'leave.js': 'text/javascript', 'style.css': 'text/css' };
const MAX_BODY = 256 * 1024;

const tokenOk = t => TOKEN.length >= 16 && t.length === TOKEN.length && timingSafeEqual(Buffer.from(t), Buffer.from(TOKEN));

function send(res, code, body, type = 'text/plain') {
  res.writeHead(code, {
    'content-type': `${type}; charset=utf-8`,
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer', // the token lives in the URL
    'x-robots-tag': 'noindex',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > MAX_BODY) throw new Error('too large'); chunks.push(c); }
  return Buffer.concat(chunks).toString('utf8');
}

const server = http.createServer(async (req, res) => {
  const [, a, b] = new URL(req.url, 'http://x').pathname.split('/');
  try {
    if (a === 'healthz') return send(res, 200, 'ok');
    if (a === 'assets' && ASSETS[b]) return send(res, 200, await readFile(new URL(b, PUB)), ASSETS[b]);
    if (a === 'm' && b && tokenOk(b)) return send(res, 200, await readFile(new URL('index.html', PUB)), 'text/html');
    if (a === 'api' && b && tokenOk(b)) {
      if (req.method === 'GET') {
        const doc = await readFile(FILE, 'utf8').catch(() => 'null');
        return send(res, 200, doc, 'application/json');
      }
      if (req.method === 'PUT') {
        const doc = JSON.parse(await readBody(req));
        if (!doc || typeof doc !== 'object' || !doc.settings || !doc.days) return send(res, 400, 'bad doc');
        // ponytail: last write wins; fine for one person on a couple of devices.
        await mkdir(DATA_DIR, { recursive: true });
        await writeFile(FILE + '.tmp', JSON.stringify(doc));
        await rename(FILE + '.tmp', FILE);
        return send(res, 204, '');
      }
    }
    send(res, 404, 'not found');
  } catch (e) {
    send(res, 400, String(e.message || e));
  }
});

server.listen(PORT, () => console.log(`annual-leave on :${PORT}${TOKEN ? '' : ' (TOKEN unset: app disabled)'}`));
