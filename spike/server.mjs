// THROWAWAY spike code for HDF-Plug Phase 0. Not production.
// Starts two listeners:
//   1. https://localhost:47630  - serves public/ (the test pane) and /ping  (stands in for the hosted page)
//   2. port 47615               - fake HDF listener that answers BOTH http:// and https:// on the SAME port,
//                                 with the SAME handler, so a test can change only the scheme.
//                                 (It looks at the first byte of each connection: 0x16 = TLS handshake.)
// Run: node server.mjs        (needs certs/localhost.pem + certs/localhost-key.pem, see README.md)
import https from 'node:https';
import http from 'node:http';
import net from 'node:net';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./public', import.meta.url));
const certDir = fileURLToPath(new URL('./certs', import.meta.url));
const PAGE_PORT = 47630;
const BRIDGE_PORT = 47615;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css' };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---- fake HDF listener: same handler for http and https, same port ----
const bridgeHandler = (req, res) => {
  const origin = req.headers.origin || '';
  const scheme = req.socket.encrypted ? 'https' : 'http ';
  log('BRIDGE', scheme, req.method, req.url, 'origin=' + (origin || '-'), 'host=' + req.headers.host,
      'auth=' + (req.headers.authorization ? 'yes' : 'no'),
      'pna=' + (req.headers['access-control-request-private-network'] || '-'));
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ app: 'honeyDue-Flow-SPIKE', apiVersion: 1, scheme: req.socket.encrypted ? 'https' : 'http' }));
};

const keyFile = join(certDir, 'localhost-key.pem');
const certFile = join(certDir, 'localhost.pem');
if (!existsSync(keyFile) || !existsSync(certFile)) {
  console.error('Missing certs/. See README.md step 2.');
  process.exit(1);
}
const tlsOpts = { key: readFileSync(keyFile), cert: readFileSync(certFile) };
// A TLS server takes over the socket handle, so peeked bytes cannot be pushed back into it.
// So: two private servers on random loopback ports, and a front door on 47615 that looks at the
// first byte (0x16 = TLS handshake) and pipes the connection to the right one.
const bridgeHttp = http.createServer(bridgeHandler);
const bridgeHttps = https.createServer(tlsOpts, bridgeHandler);
await new Promise((r) => bridgeHttp.listen(0, '127.0.0.1', r));
await new Promise((r) => bridgeHttps.listen(0, '127.0.0.1', r));
net.createServer((sock) => {
  sock.on('error', () => {});
  sock.once('data', (buf) => {
    const target = buf[0] === 0x16 ? bridgeHttps : bridgeHttp;
    const up = net.connect(target.address().port, '127.0.0.1', () => { up.write(buf); sock.pipe(up); up.pipe(sock); });
    up.on('error', () => sock.destroy());
    sock.on('close', () => up.destroy());
    up.on('close', () => sock.destroy());
  });
}).listen(BRIDGE_PORT, '127.0.0.1', () => log(`fake HDF     http:// AND https:// on port ${BRIDGE_PORT}`));

// ---- page server (https) ----
const pages = https.createServer(tlsOpts, (req, res) => {
  const url = new URL(req.url, 'https://localhost');
  const origin = req.headers.origin || '';
  log('PAGES ', req.method, url.pathname, 'origin=' + (origin || '-'), 'host=' + req.headers.host);
  if (origin && url.pathname === '/ping') {
    // cross-origin test: a page on another address (127.0.0.1 vs localhost) calling this https listener
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (url.pathname === '/ping') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ app: 'honeyDue-Flow-SPIKE-planB', apiVersion: 1 }));
    return;
  }
  let rel = normalize(url.pathname === '/' ? '/pane.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
  const file = join(root, rel);
  if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.end(readFileSync(file));
});
pages.listen(PAGE_PORT, '127.0.0.1', () => log(`pane pages   https://localhost:${PAGE_PORT}`));
