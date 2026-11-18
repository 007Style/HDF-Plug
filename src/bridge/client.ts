import {
  PORT_FIRST, PORT_LAST, SUPPORTED_API_VERSION,
  type AddResult, type ApiResult, type BridgeFailure, type ConnectStatus, type DataFailure, type Eligibility, type FlowChoice, type FlowOptions, type Hello, type ScheduleCheck,
} from './types';

export interface ClientDeps {
  fetch?: typeof fetch;
  /** Reads and writes small text values (the pane's localStorage in the real add-in). */
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Milliseconds to wait for each port when looking for HoneyDue-Flow. */
  probeTimeoutMs?: number;
  requestTimeoutMs?: number;
  /** Data calls can wait for HoneyDue-Flow's window (up to 25 seconds there), so they get longer than a probe. */
  dataTimeoutMs?: number;
}

export type Discovery =
  | { kind: 'found'; port: number; hello: Hello }
  | { kind: 'not-found' }
  | { kind: 'too-old'; hello: Hello }
  | { kind: 'add-in-too-old'; hello: Hello };

export type ConnectStart =
  | { kind: 'started'; requestId: string; expiresInSeconds: number }
  | { kind: 'failed'; failure: BridgeFailure };

export type ConnectPoll =
  | { kind: 'pending' }
  | { kind: 'allowed'; token: string }
  | { kind: 'denied' }
  | { kind: 'expired' }
  | { kind: 'failed'; failure: BridgeFailure };

const CHANNELS = ['email', 'call', 'linkedin'];
const PORT_KEY = 'hdf_port';
const TOKEN_KEY = 'hdf_token';

function isHello(x: any): x is Hello {
  return !!x && x.ok === true && x.app === 'HoneyDue-Flow' && typeof x.apiVersion === 'number' && typeof x.bridgeEnabled === 'boolean';
}

const isObj = (x: any): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const BAD_ANSWER: DataFailure = { code: 'internal', message: 'HoneyDue-Flow gave an answer this add-in does not understand.', status: 200 };

function parseEligibility(j: any): Eligibility | null {
  if (!isObj(j)) return null;
  const contact = isObj(j.contact) ? j.contact : null;
  switch (j.result) {
    case 'eligible':
      return contact && isStr(contact.displayName) && isStr(contact.email)
        ? { result: 'eligible', contact: { displayName: contact.displayName, email: contact.email, company: isStr(contact.company) ? contact.company : '' } }
        : null;
    case 'not_in_contacts': return { result: 'not_in_contacts' };
    case 'missing_fields':
      return Array.isArray(j.missing) && j.missing.every(isStr)
        ? { result: 'missing_fields', missing: j.missing, ...(contact && isStr(contact.displayName) ? { contact: { displayName: contact.displayName } } : {}) }
        : null;
    case 'already_in_flow':
      return { result: 'already_in_flow', contact: { displayName: contact && isStr(contact.displayName) ? contact.displayName : '' }, flow: isObj(j.flow) && isStr(j.flow.cadenceName) ? { cadenceName: j.flow.cadenceName } : {} };
    default: return null;
  }
}

function parseFlowOptions(j: any): FlowOptions | null {
  if (!isObj(j) || !Array.isArray(j.cadences) || !Array.isArray(j.templates)) return null;
  const cadences: FlowOptions['cadences'] = [];
  for (const c of j.cadences) {
    if (!isObj(c) || !isStr(c.id) || !isStr(c.name)) return null;
    cadences.push({
      id: c.id, name: c.name, stepCount: Number(c.stepCount) || 0,
      firstChannel: CHANNELS.includes(c.firstChannel) ? c.firstChannel : 'email',
      active: c.active !== false, ...(isStr(c.inactiveReason) ? { inactiveReason: c.inactiveReason } : {}),
    });
  }
  const templates: FlowOptions['templates'] = [];
  for (const t of j.templates) {
    if (!isObj(t) || !isStr(t.id) || !isStr(t.name) || !CHANNELS.includes(t.channel)) return null;
    templates.push({ id: t.id, name: t.name, channel: t.channel });
  }
  return { cadences, templates, noScriptCall: j.noScriptCall === true };
}

function parseSchedule(j: any): ScheduleCheck | null {
  if (!isObj(j) || typeof j.inPast !== 'boolean' || typeof j.held !== 'boolean') return null;
  return { inPast: j.inPast, held: j.held, ...(isStr(j.reason) ? { reason: j.reason } : {}), ...(isStr(j.nextAllowed) ? { nextAllowed: j.nextAllowed } : {}) };
}

function parseAdded(j: any): AddResult | null {
  if (!isObj(j) || !isObj(j.contact) || !isObj(j.flow) || !isStr(j.flow.name) || !isStr(j.firstStepAt)) return null;
  return {
    contact: { displayName: isStr(j.contact.displayName) ? j.contact.displayName : '' },
    flow: { name: j.flow.name, kind: j.flow.kind === 'template' ? 'template' : 'cadence' },
    firstStepAt: j.firstStepAt,
    calendarNote: isStr(j.calendarNote) ? j.calendarNote : '',
  };
}

/** A client for the bridge in BRIDGE-API.md. Plain objects in, plain objects out; it never throws for a network problem. */
export function createBridgeClient(deps: ClientDeps) {
  const doFetch = deps.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const probeTimeout = deps.probeTimeoutMs ?? 1500;
  const requestTimeout = deps.requestTimeoutMs ?? 10_000;
  const dataTimeout = deps.dataTimeoutMs ?? 35_000;
  let port = 0;

  const getToken = () => deps.storage.getItem(TOKEN_KEY);

  async function call(method: string, path: string, opts: { port?: number; token?: string | null; body?: unknown; timeoutMs?: number } = {}): Promise<{ status: number; json: any } | null> {
    const p = opts.port ?? port;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? requestTimeout);
    try {
      const headers: Record<string, string> = {};
      if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
      if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
      const res = await doFetch(`https://localhost:${p}${path}`, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: ctrl.signal,
        cache: 'no-store',
      });
      let json: any = null;
      try { json = await res.json(); } catch { /* an answer that is not JSON is treated as no answer */ }
      return json === null ? null : { status: res.status, json };
    } catch {
      return null; // refused, unreachable, certificate not trusted, or timed out: the same thing to the user
    } finally {
      clearTimeout(timer);
    }
  }

  function failure(r: { status: number; json: any }): BridgeFailure {
    const e = r.json && r.json.error ? r.json.error : {};
    return {
      code: typeof e.code === 'string' ? e.code : 'internal',
      message: typeof e.message === 'string' ? e.message : 'Something went wrong talking to HoneyDue-Flow.',
      status: r.status,
      retryAfterSeconds: typeof e.retryAfterSeconds === 'number' ? e.retryAfterSeconds : undefined,
    };
  }

  /** One authorized call. A token HoneyDue-Flow no longer accepts is forgotten here, so the panel goes to the Connect state. */
  async function data<T>(method: string, path: string, body: unknown, parse: (j: any) => T | null): Promise<ApiResult<T>> {
    if (!port) return { ok: false, failure: { code: 'unreachable', message: 'HoneyDue-Flow did not answer.', status: 0 } };
    const r = await call(method, path, { token: getToken(), body, timeoutMs: dataTimeout });
    if (!r) return { ok: false, failure: { code: 'unreachable', message: 'HoneyDue-Flow did not answer.', status: 0 } };
    if (r.status === 401) deps.storage.removeItem(TOKEN_KEY);
    if (r.status !== 200 || !r.json || r.json.ok !== true) {
      const f: DataFailure = failure(r);
      const d = r.json?.error?.detail;
      if (isObj(d)) f.detail = { ...(isStr(d.result) ? { result: d.result } : {}), ...(Array.isArray(d.missing) ? { missing: d.missing.filter(isStr) } : {}) };
      return { ok: false, failure: f };
    }
    const value = parse(r.json);
    return value === null ? { ok: false, failure: BAD_ANSWER } : { ok: true, value };
  }

  return {
    hasToken: () => !!getToken(),

    /** Looks for HoneyDue-Flow: the port that worked last time first, then the whole range, each with a short time-out. */
    async discover(): Promise<Discovery> {
      const remembered = Number(deps.storage.getItem(PORT_KEY));
      const order: number[] = [];
      if (remembered >= PORT_FIRST && remembered <= PORT_LAST) order.push(remembered);
      for (let p = PORT_FIRST; p <= PORT_LAST; p++) if (p !== remembered) order.push(p);
      for (const p of order) {
        const r = await call('GET', '/v1/hello', { port: p, token: getToken(), timeoutMs: probeTimeout });
        if (!r || !isHello(r.json)) continue;
        port = p;
        deps.storage.setItem(PORT_KEY, String(p));
        // An answer is an answer, even for a version we do not speak: tell the user which side to update.
        if (r.json.apiVersion > SUPPORTED_API_VERSION) return { kind: 'add-in-too-old', hello: r.json };
        if (r.json.apiVersion < SUPPORTED_API_VERSION) return { kind: 'too-old', hello: r.json };
        // A token HDF no longer knows is forgotten here, so the panel goes to the Connect state at once.
        if (getToken() && !r.json.connected) deps.storage.removeItem(TOKEN_KEY);
        return { kind: 'found', port: p, hello: r.json };
      }
      return { kind: 'not-found' };
    },

    async startConnect(clientName: string): Promise<ConnectStart> {
      const r = await call('POST', '/v1/connect', { body: { clientName } });
      if (!r) return { kind: 'failed', failure: { code: 'unreachable', message: 'HoneyDue-Flow did not answer.', status: 0 } };
      if (r.status === 200 && r.json.ok && typeof r.json.requestId === 'string') {
        return { kind: 'started', requestId: r.json.requestId, expiresInSeconds: Number(r.json.expiresInSeconds) || 60 };
      }
      return { kind: 'failed', failure: failure(r) };
    },

    /** Asks once. The token is saved here, so no caller can forget to keep it. */
    async pollConnect(requestId: string): Promise<ConnectPoll> {
      const r = await call('GET', `/v1/connect/${encodeURIComponent(requestId)}`);
      if (!r) return { kind: 'failed', failure: { code: 'unreachable', message: 'HoneyDue-Flow did not answer.', status: 0 } };
      if (r.status !== 200 || !r.json.ok) return { kind: 'failed', failure: failure(r) };
      const status = r.json.status as ConnectStatus;
      if (status === 'allowed' && typeof r.json.token === 'string' && /^[0-9a-f]{64}$/.test(r.json.token)) {
        deps.storage.setItem(TOKEN_KEY, r.json.token);
        return { kind: 'allowed', token: r.json.token };
      }
      if (status === 'pending' || status === 'denied' || status === 'expired') return { kind: status };
      return { kind: 'failed', failure: { code: 'internal', message: 'HoneyDue-Flow gave an answer this add-in does not understand.', status: r.status } };
    },

    check: (email: string) => data('POST', '/v1/contacts/check', { email }, parseEligibility),
    flowOptions: () => data('GET', '/v1/flow-options', undefined, parseFlowOptions),
    scheduleCheck: (choice: FlowChoice, scheduledDatetime: string) => data('POST', '/v1/schedule/check', { ...choice, scheduledDatetime }, parseSchedule),
    addFlow: (email: string, choice: FlowChoice, scheduledDatetime: string) => data('POST', '/v1/flows', { email, ...choice, scheduledDatetime }, parseAdded),

    /** Tells HDF to forget this add-in, and forgets the token here whatever HDF answers. */
    async disconnect(): Promise<void> {
      const token = getToken();
      deps.storage.removeItem(TOKEN_KEY);
      if (token) await call('DELETE', '/v1/connect', { token });
    },
  };
}
export type BridgeClient = ReturnType<typeof createBridgeClient>;
