import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import https from 'node:https';
import { createBridgeClient } from '../src/bridge/client';
import { PORT_FIRST } from '../src/bridge/types';
import { startFakeBridge, type FakeOptions } from '../tools/fake-bridge/fakeBridge';

let key = ''; let cert = ''; let work = '';
beforeAll(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'hdfplug-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '2', '-keyout', path.join(work, 'k.pem'), '-out', path.join(work, 'c.pem'), '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-addext', 'basicConstraints=critical,CA:FALSE'], { stdio: 'ignore' });
  key = fs.readFileSync(path.join(work, 'k.pem'), 'utf8'); cert = fs.readFileSync(path.join(work, 'c.pem'), 'utf8');
});
afterAll(() => fs.rmSync(work, { recursive: true, force: true }));

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }; };
function fetchTo(target: number): typeof fetch {
  return ((url: string, init: any = {}) => new Promise((resolve, reject) => {
    const u = new URL(url);
    if (Number(u.port) !== PORT_FIRST) return reject(new TypeError('Load failed'));
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

const PEOPLE: FakeOptions['people'] = {
  jane: { firstName: 'Jane', lastName: 'Doe', company: 'Acme', emails: ['jane@acme.com', 'jane.d@home.com'] },
  half: { firstName: 'Half', emails: ['half@x.com'] },
  busy: { firstName: 'Bo', lastName: 'Busy', company: 'Y', emails: ['bo@y.com'], inFlow: 'Intro' },
};
const CADENCES = [{ id: 'cad_1', name: 'Intro', stepCount: 4, firstChannel: 'email', active: true }, { id: 'cad_2', name: 'Off', stepCount: 2, firstChannel: 'call', active: false, inactiveReason: 'A template was deleted.' }];
const TEMPLATES = [{ id: 'tpl_1', name: 'Quick check-in', channel: 'email' }];

/** A connected client and its fake. */
async function connected(over: Partial<FakeOptions> = {}) {
  const s = await startFakeBridge({ key, cert, answer: 'allow', people: PEOPLE, cadences: CADENCES, templates: TEMPLATES, ...over } as any);
  open.push(s);
  const st = mem();
  const c = createBridgeClient({ storage: st, fetch: fetchTo(s.port), probeTimeoutMs: 500, dataTimeoutMs: 2000 });
  await c.discover();
  await c.pollConnect(((await c.startConnect('X')) as any).requestId);
  await c.discover();
  return { s, c, st };
}

describe('PLG-D the data calls', () => {
  it('PLG-D01 check: an eligible person comes back with the name, the address HoneyDue-Flow will use and the company', async () => {
    const { c } = await connected();
    expect(await c.check('JANE.D@home.com')).toEqual({ ok: true, value: { result: 'eligible', contact: { displayName: 'Jane Doe', email: 'jane@acme.com', company: 'Acme' } } });
  });

  it('PLG-D02 check: the other three outcomes are values, not failures', async () => {
    const { c } = await connected();
    expect(await c.check('nobody@x.com')).toEqual({ ok: true, value: { result: 'not_in_contacts' } });
    expect(await c.check('half@x.com')).toEqual({ ok: true, value: { result: 'missing_fields', missing: ['last name', 'company'], contact: { displayName: 'Half' } } });
    expect(await c.check('bo@y.com')).toEqual({ ok: true, value: { result: 'already_in_flow', contact: { displayName: 'Bo Busy' }, flow: { cadenceName: 'Intro' } } });
  });

  it('PLG-D03 flowOptions: both groups arrive, and the switched-off flow carries its reason', async () => {
    const { c } = await connected();
    const r = await c.flowOptions();
    expect(r).toEqual({ ok: true, value: { cadences: CADENCES, templates: TEMPLATES, noScriptCall: true } });
  });

  it('PLG-D04 scheduleCheck and addFlow send the choice and the time, with the token, to the right place', async () => {
    const { c, s } = await connected({ schedule: { inPast: false, held: true, reason: 'Weekend Shield is on.', nextAllowed: '2026-11-23T13:00:00.000Z' } });
    const when = '2026-11-20T14:00:00.000Z';
    expect(await c.scheduleCheck({ kind: 'cadence', cadenceId: 'cad_1' }, when)).toEqual({ ok: true, value: { inPast: false, held: true, reason: 'Weekend Shield is on.', nextAllowed: '2026-11-23T13:00:00.000Z' } });
    const r = await c.addFlow('jane@acme.com', { kind: 'cadence', cadenceId: 'cad_1' }, when);
    expect(r).toEqual({ ok: true, value: { contact: { displayName: 'Jane Doe' }, flow: { name: 'Intro', kind: 'cadence' }, firstStepAt: when, calendarNote: '' } });
    expect(s.calls.map((x) => x.name)).toEqual(['scheduleCheck', 'addFlow']);
    expect(s.calls[1].body).toEqual({ email: 'jane@acme.com', kind: 'cadence', cadenceId: 'cad_1', scheduledDatetime: when });
    expect(s.seen.filter((x) => x.path !== '/v1/hello' && !x.path.startsWith('/v1/connect')).every((x) => /^Bearer [0-9a-f]{64}$/.test(x.auth ?? ''))).toBe(true);
  });

  it('PLG-D05 a single step carries its channel and template; the no-script call carries only the channel', async () => {
    const { c, s } = await connected();
    await c.addFlow('jane@acme.com', { kind: 'template', channel: 'call' }, '2026-11-20T14:00:00.000Z');
    expect(s.calls[0].body).toEqual({ email: 'jane@acme.com', kind: 'template', channel: 'call', scheduledDatetime: '2026-11-20T14:00:00.000Z' });
    expect((await c.addFlow('jane@acme.com', { kind: 'template', channel: 'email', templateId: 'tpl_1' }, 'x')).ok).toBe(false); // already added above
  });

  it('PLG-D06 a refused add keeps HoneyDue-Flow\'s words, the code and the detail', async () => {
    const { c } = await connected();
    const r = await c.addFlow('nobody@x.com', { kind: 'cadence', cadenceId: 'cad_1' }, '2026-11-20T14:00:00.000Z');
    expect(r).toMatchObject({ ok: false, failure: { code: 'not_eligible', status: 409, detail: { result: 'not_in_contacts' } } });
  });

  it('PLG-D07 a token HoneyDue-Flow no longer accepts is forgotten, and the failure says unauthorized', async () => {
    const { c, s, st } = await connected();
    s.revokeAll();
    const r = await c.check('jane@acme.com');
    expect(r).toMatchObject({ ok: false, failure: { code: 'unauthorized' } });
    expect(st.m.has('hdf_token')).toBe(false);
    expect(c.hasToken()).toBe(false);
  });

  it.each([
    [424, 'not_connected'], [502, 'contacts_unavailable'], [504, 'app_busy'], [429, 'rate_limited'], [403, 'bridge_off'],
  ])('PLG-D08 a %s %s answer is a failure with that code', async (status, code) => {
    const { c } = await connected({ dataError: { check: { status, code } } });
    expect(await c.check('jane@acme.com')).toMatchObject({ ok: false, failure: { code, status } });
  });

  it('PLG-D09 HoneyDue-Flow closing mid-way is "unreachable", never an exception', async () => {
    const { c, s } = await connected();
    await s.close();
    expect(await c.flowOptions()).toMatchObject({ ok: false, failure: { code: 'unreachable' } });
  });

  it('PLG-D10 an answer of the wrong shape is a failure, not a crash', async () => {
    const { c } = await connected({ cadences: [{ id: 5 } as any] });
    expect(await c.flowOptions()).toMatchObject({ ok: false, failure: { code: 'internal' } });
  });

  it('PLG-D11 a data call before HoneyDue-Flow was found says unreachable and sends nothing', async () => {
    const c = createBridgeClient({ storage: mem(), fetch: (() => { throw new Error('no call expected'); }) as any });
    expect(await c.check('a@b.com')).toMatchObject({ ok: false, failure: { code: 'unreachable' } });
  });
});
