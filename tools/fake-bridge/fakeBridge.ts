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
  /** The address book and flows the data endpoints answer from. */
  people?: Record<string, FakePerson>;
  cadences?: Array<{ id: string; name: string; stepCount: number; firstChannel: string; active: boolean; inactiveReason?: string }>;
  templates?: Array<{ id: string; name: string; channel: string }>;
  /** Make one data endpoint fail: its name (`check`, `flowOptions`, `scheduleCheck`, `addFlow`) and the error. */
  dataError?: Partial<Record<'check' | 'flowOptions' | 'scheduleCheck' | 'addFlow', { status: number; code: string; extra?: object }>>;
  /** Hold the answer to `addFlow` for this long (ms), to test a double press. */
  addFlowDelayMs?: number;
  schedule?: { inPast: boolean; held: boolean; reason?: string; nextAllowed?: string };
}

export interface FakePerson {
  firstName?: string; lastName?: string; company?: string;
  /** Every address on the contact; the first is the one HoneyDue-Flow would use. */
  emails: string[];
  inFlow?: string;
}

export function startFakeBridge(opts: FakeOptions) {
  const origin = opts.origin ?? 'https://pages.example.com';
  const tokens = new Set<string>();
  const requests = new Map<string, { status: 'pending' | 'allowed' | 'denied' | 'expired'; token?: string }>();
  const calls: Array<{ name: string; body: any }> = [];
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

    // The data endpoints need a token, as in BRIDGE-API 2.3 to 2.6.
    const data = ['/v1/contacts/check', '/v1/flow-options', '/v1/schedule/check', '/v1/flows'];
    if (data.includes(url.pathname)) {
      if (!authed) return err(401, 'unauthorized');
      const NAMES = { '/v1/contacts/check': 'check', '/v1/flow-options': 'flowOptions', '/v1/schedule/check': 'scheduleCheck', '/v1/flows': 'addFlow' } as const;
      const name = NAMES[url.pathname as keyof typeof NAMES];
      let text = '';
      req.on('data', (c) => (text += c));
      req.on('end', () => {
        const forced = state.dataError?.[name];
        if (forced) return err(forced.status, forced.code, forced.extra);
        let body: any = {};
        try { body = text ? JSON.parse(text) : {}; } catch { return err(400, 'bad_request'); }
        calls.push({ name, body });
        const find = (email: unknown) => Object.values(state.people ?? {}).find((p) => p.emails.some((e) => e.toLowerCase() === String(email).toLowerCase()));
        if (name === 'check') {
          const p = find(body.email);
          if (!p) return reply(200, { ok: true, result: 'not_in_contacts' });
          const displayName = [p.firstName, p.lastName].filter(Boolean).join(' ');
          const missing = [!p.firstName && 'first name', !p.lastName && 'last name', !p.company && 'company'].filter(Boolean);
          if (missing.length) return reply(200, { ok: true, result: 'missing_fields', missing, contact: { displayName } });
          if (p.inFlow) return reply(200, { ok: true, result: 'already_in_flow', contact: { displayName }, flow: { cadenceName: p.inFlow } });
          return reply(200, { ok: true, result: 'eligible', contact: { displayName, email: p.emails[0], company: p.company } });
        }
        if (name === 'flowOptions') return reply(200, { ok: true, cadences: state.cadences ?? [], templates: state.templates ?? [], noScriptCall: true });
        if (name === 'scheduleCheck') return reply(200, { ok: true, ...(state.schedule ?? { inPast: false, held: false }) });
        const p = find(body.email);
        const finish = () => {
          if (!p) return err(409, 'not_eligible', { detail: { result: 'not_in_contacts' } });
          if (p.inFlow) return err(409, 'already_in_flow');
          p.inFlow = 'added';
          const flow = body.kind === 'cadence' ? (state.cadences ?? []).find((c) => c.id === body.cadenceId) : (state.templates ?? []).find((t) => t.id === body.templateId);
          reply(200, { ok: true, contact: { displayName: [p.firstName, p.lastName].join(' ') }, flow: { name: flow?.name ?? 'Phone call, no script', kind: body.kind }, firstStepAt: body.scheduledDatetime, calendarNote: '' });
        };
        if (state.addFlowDelayMs) setTimeout(finish, state.addFlowDelayMs); else finish();
      });
      return;
    }
    return err(404, 'not_found');
  });

  return new Promise<{
    port: number;
    state: FakeOptions;
    seen: typeof seen;
    calls: typeof calls;
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
        calls,
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
