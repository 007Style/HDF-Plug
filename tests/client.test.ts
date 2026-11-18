import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import https from 'node:https';
import { createBridgeClient } from '../src/bridge/client';
import { PORT_FIRST } from '../src/bridge/types';
import { startFakeBridge } from '../tools/fake-bridge/fakeBridge';

// The client talks to https://localhost:<port>; a test cannot use the real port range, so fetch is pointed at the fake's real port.
let key = ''; let cert = ''; let work = '';
beforeAll(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'hdfplug-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-keyout', path.join(work, 'k.pem'), '-out', path.join(work, 'c.pem'), '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-addext', 'basicConstraints=critical,CA:FALSE'], { stdio: 'ignore' });
  key = fs.readFileSync(path.join(work, 'k.pem'), 'utf8'); cert = fs.readFileSync(path.join(work, 'c.pem'), 'utf8');
});
afterAll(() => fs.rmSync(work, { recursive: true, force: true }));

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };

/** A fetch that sends `https://localhost:<range port>` to the fake's real port, so the client's own port logic is what is tested. */
function fetchTo(map: Record<number, number>): typeof fetch {
  return ((url: string, init: any = {}) => new Promise((resolve, reject) => {
    const u = new URL(url);
    const target = map[Number(u.port)];
    if (!target) return reject(new TypeError('Load failed'));
    const req = https.request({ host: '127.0.0.1', port: target, path: u.pathname, method: init.method ?? 'GET', headers: init.headers, rejectUnauthorized: false, agent: false }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => resolve({ status: res.statusCode, json: async () => JSON.parse(text) } as any));
    });
    req.on('error', reject);
    init.signal?.addEventListener('abort', () => { req.destroy(); reject(new DOMException('aborted', 'AbortError')); });
    if (init.body) req.write(init.body);
    req.end();
  })) as any;
}

const open: Array<{ close: () => Promise<void> }> = [];
afterEach(async () => { for (const s of open.splice(0)) await s.close(); });
const fake = async (o: Parameters<typeof startFakeBridge>[0] extends infer T ? Partial<T> : never = {}) => { const s = await startFakeBridge({ key, cert, ...o } as any); open.push(s); return s; };

describe('PLG-C the bridge client', () => {
  it('PLG-C01 finds HoneyDue-Flow on a port in the range, remembers it, and tries that port first next time', async () => {
    const s = await fake();
    const st = mem();
    const c = createBridgeClient({ storage: st, fetch: fetchTo({ [PORT_FIRST + 3]: s.port }), probeTimeoutMs: 500 });
    const d = await c.discover();
    expect(d).toMatchObject({ kind: 'found', port: PORT_FIRST + 3 });
    expect(st.m.get('hdf_port')).toBe(String(PORT_FIRST + 3));
    s.seen.length = 0;
    await createBridgeClient({ storage: st, fetch: fetchTo({ [PORT_FIRST + 3]: s.port }), probeTimeoutMs: 500 }).discover();
    expect(s.seen).toHaveLength(1); // straight to the remembered port
  });

  it('PLG-C02 nothing listening anywhere in the range is "not-found"', async () => {
    const c = createBridgeClient({ storage: mem(), fetch: fetchTo({}), probeTimeoutMs: 200 });
    expect(await c.discover()).toEqual({ kind: 'not-found' });
  });

  it('PLG-C03 something else on a port that does not say HoneyDue-Flow is skipped, and one that does is found after it', async () => {
    const other = await fake();
    other.state.apiVersion = 1;
    const real = await fake();
    const f = ((url: string, init: any) => {
      const p = Number(new URL(url).port);
      if (p === PORT_FIRST) return Promise.resolve({ status: 200, json: async () => ({ ok: true, app: 'SomethingElse', apiVersion: 1, bridgeEnabled: true }) } as any);
      return fetchTo({ [PORT_FIRST + 1]: real.port })(url, init);
    }) as typeof fetch;
    const d = await createBridgeClient({ storage: mem(), fetch: f, probeTimeoutMs: 500 }).discover();
    expect(d).toMatchObject({ kind: 'found', port: PORT_FIRST + 1 });
  });

  it('PLG-C04 a bridge whose version is older or newer than this add-in speaks is reported as such, not as missing', async () => {
    const old = await fake({ apiVersion: 0 });
    expect((await createBridgeClient({ storage: mem(), fetch: fetchTo({ [PORT_FIRST]: old.port }), probeTimeoutMs: 500 }).discover()).kind).toBe('too-old');
    const newer = await fake({ apiVersion: 2 });
    expect((await createBridgeClient({ storage: mem(), fetch: fetchTo({ [PORT_FIRST]: newer.port }), probeTimeoutMs: 500 }).discover()).kind).toBe('add-in-too-old');
  });

  it('PLG-C05 a request that hangs is given up after the time-out, and the next port is tried', async () => {
    const real = await fake();
    const f = ((url: string, init: any) => {
      if (Number(new URL(url).port) === PORT_FIRST) return new Promise((_r, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));
      return fetchTo({ [PORT_FIRST + 1]: real.port })(url, init);
    }) as typeof fetch;
    const t0 = Date.now();
    const d = await createBridgeClient({ storage: mem(), fetch: f, probeTimeoutMs: 150 }).discover();
    expect(d).toMatchObject({ kind: 'found', port: PORT_FIRST + 1 });
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('PLG-C06 connect: starts, polls until allowed, saves the token, and the next hello says connected', async () => {
    const s = await fake({ answer: 'allow' });
    const st = mem();
    const c = createBridgeClient({ storage: st, fetch: fetchTo({ [PORT_FIRST]: s.port }), probeTimeoutMs: 500 });
    await c.discover();
    const start = await c.startConnect('Outlook (Mac)');
    expect(start).toMatchObject({ kind: 'started', expiresInSeconds: 60 });
    const poll = await c.pollConnect((start as any).requestId);
    expect(poll).toMatchObject({ kind: 'allowed' });
    expect(st.m.get('hdf_token')).toMatch(/^[0-9a-f]{64}$/);
    expect(c.hasToken()).toBe(true);
    expect(await c.discover()).toMatchObject({ kind: 'found', hello: { connected: true } });
    expect((await c.pollConnect((start as any).requestId)).kind).toBe('expired'); // the token is handed out once
  });

  it('PLG-C07 denied and expired answers come through; pending stays pending', async () => {
    const s = await fake({ answer: 'wait' });
    const c = createBridgeClient({ storage: mem(), fetch: fetchTo({ [PORT_FIRST]: s.port }), probeTimeoutMs: 500 });
    await c.discover();
    const id = ((await c.startConnect('X')) as any).requestId;
    expect((await c.pollConnect(id)).kind).toBe('pending');
    s.answerLatest('denied');
    expect((await c.pollConnect(id)).kind).toBe('denied');
    s.answerLatest('expired');
    expect((await c.pollConnect(id)).kind).toBe('expired');
    expect(c.hasToken()).toBe(false);
  });

  it('PLG-C08 busy and locked answers carry their code and wait; an unknown request id is a failure', async () => {
    const s = await fake({ connectError: { status: 423, code: 'connect_locked', retryAfterSeconds: 600 } });
    const c = createBridgeClient({ storage: mem(), fetch: fetchTo({ [PORT_FIRST]: s.port }), probeTimeoutMs: 500 });
    await c.discover();
    expect(await c.startConnect('X')).toMatchObject({ kind: 'failed', failure: { code: 'connect_locked', retryAfterSeconds: 600, status: 423 } });
    s.state.connectError = { status: 409, code: 'connect_busy' };
    expect(await c.startConnect('X')).toMatchObject({ kind: 'failed', failure: { code: 'connect_busy' } });
    expect(await c.pollConnect('r_000000000000')).toMatchObject({ kind: 'failed', failure: { code: 'not_found' } });
  });

  it('PLG-C09 a token HoneyDue-Flow no longer knows (revoked there) is forgotten at the next look, so the panel asks to connect again', async () => {
    const s = await fake({ answer: 'allow' });
    const st = mem();
    const c = createBridgeClient({ storage: st, fetch: fetchTo({ [PORT_FIRST]: s.port }), probeTimeoutMs: 500 });
    await c.discover();
    await c.pollConnect(((await c.startConnect('X')) as any).requestId);
    expect(c.hasToken()).toBe(true);
    s.revokeAll();
    const d = await c.discover();
    expect(d).toMatchObject({ kind: 'found', hello: { connected: false } });
    expect(c.hasToken()).toBe(false);
  });

  it('PLG-C10 disconnect forgets the token here at once and tells HoneyDue-Flow, whose own hello then says not connected; with HoneyDue-Flow gone it still forgets', async () => {
    const s = await fake({ answer: 'allow' });
    const st = mem();
    const c = createBridgeClient({ storage: st, fetch: fetchTo({ [PORT_FIRST]: s.port }), probeTimeoutMs: 500 });
    await c.discover();
    await c.pollConnect(((await c.startConnect('X')) as any).requestId);
    const token = st.m.get('hdf_token')!;
    await c.disconnect();
    expect(c.hasToken()).toBe(false);
    expect(s.seen.some((r) => r.method === 'DELETE' && r.auth === `Bearer ${token}`)).toBe(true);

    st.m.set('hdf_token', 'a'.repeat(64));
    const gone = createBridgeClient({ storage: st, fetch: fetchTo({}), probeTimeoutMs: 100 });
    await gone.disconnect();
    expect(st.m.has('hdf_token')).toBe(false);
  });

  it('PLG-C11 a malformed token from the bridge is not stored; a reply that is not JSON counts as no answer', async () => {
    const f = (async (url: string) => {
      if (url.includes('/v1/connect/')) return { status: 200, json: async () => ({ ok: true, status: 'allowed', token: 'short' }) };
      return { status: 200, json: async () => { throw new SyntaxError('not json'); } };
    }) as any;
    const st = mem();
    const c = createBridgeClient({ storage: st, fetch: f, probeTimeoutMs: 100 });
    expect((await c.pollConnect('r_aaaaaaaaaaaa')).kind).toBe('failed');
    expect(st.m.has('hdf_token')).toBe(false);
    expect(await c.discover()).toEqual({ kind: 'not-found' });
  });

  it('PLG-C12 the token is sent only as an Authorization Bearer header, never in the address', async () => {
    const s = await fake({ answer: 'allow' });
    const urls: string[] = [];
    const inner = fetchTo({ [PORT_FIRST]: s.port });
    const spy = ((url: string, init: any) => { urls.push(url); return inner(url, init); }) as typeof fetch;
    const st = mem();
    const c = createBridgeClient({ storage: st, fetch: spy, probeTimeoutMs: 500 });
    await c.discover();
    await c.pollConnect(((await c.startConnect('X')) as any).requestId);
    await c.discover();
    await c.disconnect();
    const token = [...s.seen].find((r) => r.auth)!.auth!.replace('Bearer ', '');
    expect(urls.every((u) => !u.includes(token))).toBe(true);
    expect(urls.every((u) => u.startsWith('https://localhost:'))).toBe(true);
  });
});
