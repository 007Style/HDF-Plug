// A small server that behaves like HoneyDue-Flow's bridge (BRIDGE-API.md), for tests and for developing the panel without HoneyDue-Flow.
// It speaks real https on 127.0.0.1 with a throw-away certificate, so the client is tested the way it really runs.
import * as https from 'node:https';
import * as crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';

export interface FakeOptions {
  key: string;
  cert: string;
  port?: number;
  origin?: string;
  appVersion?: string;
  apiVersion?: number;
  bridgeEnabled?: boolean;
  connection?: 'connected' | 'disconnected' | 'error';
  /** What the user does with the Allow / Deny question: `allow`, `deny`, or `wait` (nobody answers). */
  answer?: 'allow' | 'deny' | 'wait';
  /** Make `connect` fail with this code, as a busy or locked HDF would. */
  connectError?: { status: number; code: string; retryAfterSeconds?: number };
}

export function startFakeBridge(opts: FakeOptions) {
  const origin = opts.origin ?? 'https://pages.example.com';
  const tokens = new Set<string>();
  const requests = new Map<string, { status: 'pending' | 'allowed' | 'denied' | 'expired'; token?: string }>();
  const seen: Array<{ method: string; path: string; auth: string | undefined }> = [];
  const state = { ...opts };

  const server = https.createServer({ key: opts.key, cert: opts.cert }, (req, res) => {
    const url = new URL(req.url ?? '/', 'https://localhost');
    seen.push({ method: req.method ?? '', path: url.pathname, auth: req.headers.authorization });
    const reply = (status: number, json: unknown) => {
      const body = JSON.stringify(json);
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Private-Network': 'true',
      });
      res.end(body);
    };
    const err = (status: number, code: string, extra: object = {}) => reply(status, { ok: false, error: { code, message: `fake ${code}`, ...extra } });
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Private-Network': 'true' }); return res.end(); }
    const auth = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.authorization ?? '')?.[1];
    const authed = !!auth && tokens.has(auth);

    if (req.method === 'GET' && url.pathname === '/v1/hello') {
      return reply(200, {
        ok: true, app: 'HoneyDue-Flow', appVersion: state.appVersion ?? '1.2.0', apiVersion: state.apiVersion ?? 1,
        bridgeEnabled: state.bridgeEnabled ?? true, connection: state.connection ?? 'connected', connected: authed,
      });
    }
    if (req.method === 'POST' && url.pathname === '/v1/connect') {
      let text = '';
      req.on('data', (c) => (text += c));
      req.on('end', () => {
        if (state.connectError) return err(state.connectError.status, state.connectError.code, state.connectError.retryAfterSeconds !== undefined ? { retryAfterSeconds: state.connectError.retryAfterSeconds } : {});
        const id = `r_${crypto.randomBytes(6).toString('hex')}`;
        const r: { status: 'pending' | 'allowed' | 'denied' | 'expired'; token?: string } = { status: 'pending' };
        requests.set(id, r);
        if (state.answer === 'allow') { r.token = crypto.randomBytes(32).toString('hex'); tokens.add(r.token); r.status = 'allowed'; }
        if (state.answer === 'deny') r.status = 'denied';
        reply(200, { ok: true, requestId: id, expiresInSeconds: 60 });
      });
      return;
    }
    const poll = /^\/v1\/connect\/(r_[0-9a-f]{12})$/.exec(url.pathname);
    if (req.method === 'GET' && poll) {
      const r = requests.get(poll[1]);
      if (!r) return err(404, 'not_found');
      if (r.status === 'allowed') { const token = r.token; r.token = undefined; r.status = 'expired'; return reply(200, { ok: true, status: 'allowed', token }); }
      return reply(200, { ok: true, status: r.status });
    }
    if (req.method === 'DELETE' && url.pathname === '/v1/connect') {
      if (!authed) return err(401, 'unauthorized');
      tokens.delete(auth!);
      return reply(200, { ok: true });
    }
    return err(404, 'not_found');
  });

  return new Promise<{
    port: number;
    state: FakeOptions;
    seen: typeof seen;
    revokeAll: () => void;
    answerLatest: (status: 'allowed' | 'denied' | 'expired') => void;
    close: () => Promise<void>;
  }>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port ?? 0, '127.0.0.1', () => {
      resolve({
        port: (server.address() as AddressInfo).port,
        state,
        seen,
        revokeAll: () => tokens.clear(),
        answerLatest: (status) => {
          const last = [...requests.values()].pop();
          if (!last) return;
          if (status === 'allowed') { last.token = crypto.randomBytes(32).toString('hex'); tokens.add(last.token); }
          last.status = status;
        },
        close: () => new Promise<void>((r) => { server.close(() => r()); (server as any).closeAllConnections?.(); }),
      });
    });
  });
}
