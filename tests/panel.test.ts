import { describe, it, expect } from 'vitest';
import { clientNameFor, createPanel, stateFromDiscovery, type PanelState } from '../src/state/panel';
import type { BridgeClient, ConnectPoll, ConnectStart, Discovery } from '../src/bridge/client';
import type { Hello } from '../src/bridge/types';
import { TEXTS } from '../src/texts';

const hello = (o: Partial<Hello> = {}): Hello => ({ ok: true, app: 'HoneyDue-Flow', appVersion: '1.2.0', apiVersion: 1, bridgeEnabled: true, connected: true, connection: 'connected', ...o } as Hello);
const found = (o: Partial<Hello> = {}): Discovery => ({ kind: 'found', port: 47615, hello: hello(o) });

describe('PLG-P: which state the panel shows', () => {
  it('PLG-P01 nothing answered: not detected', () => {
    expect(stateFromDiscovery({ kind: 'not-found' }, true).kind).toBe('not-detected');
  });
  it('PLG-P02 HoneyDue-Flow speaks an older version: HoneyDue-Flow is too old', () => {
    expect(stateFromDiscovery({ kind: 'too-old', hello: hello({ apiVersion: 0 }) }, true).kind).toBe('hdf-too-old');
  });
  it('PLG-P03 HoneyDue-Flow speaks a newer version: the add-in is too old', () => {
    expect(stateFromDiscovery({ kind: 'add-in-too-old', hello: hello({ apiVersion: 2 }) }, true).kind).toBe('add-in-too-old');
  });
  it('PLG-P04 the bridge is switched off: switched off, even when a token is held', () => {
    expect(stateFromDiscovery(found({ bridgeEnabled: false }), true).kind).toBe('switched-off');
  });
  it('PLG-P05 no token held: connect', () => {
    expect(stateFromDiscovery(found(), false)).toEqual({ kind: 'not-connected', notice: '' });
  });
  it('PLG-P06 a token held that HoneyDue-Flow does not know: connect', () => {
    expect(stateFromDiscovery(found({ connected: false }), true)).toEqual({ kind: 'not-connected', notice: '' });
  });
  it('PLG-P07 connected but not signed in to Microsoft 365: not signed in', () => {
    expect(stateFromDiscovery(found({ connection: 'disconnected' as any }), true).kind).toBe('not-signed-in');
  });
  it('PLG-P08 connected and signed in: connected, with the version', () => {
    expect(stateFromDiscovery(found(), true)).toEqual({ kind: 'connected', appVersion: '1.2.0' });
  });
  it('PLG-P09 the check for "off" comes before the check for a token', () => {
    expect(stateFromDiscovery(found({ bridgeEnabled: false, connected: false }), false).kind).toBe('switched-off');
  });
});

describe('PLG-N: the name HoneyDue-Flow shows in its question', () => {
  it.each([
    ['Mac', 'Outlook (Mac)'],
    ['PC', 'Outlook (Windows)'],
    ['OfficeOnline', 'Outlook (web)'],
    ['Universal', 'Outlook (mobile)'],
    [undefined, 'Outlook'],
    ['SomethingNew', 'Outlook'],
  ])('PLG-N01 %s gives %s', (platform, name) => {
    expect(clientNameFor(platform)).toBe(name);
  });
  it('PLG-N02 no name is longer than 40 characters', () => {
    for (const p of ['Mac', 'PC', 'OfficeOnline', 'Universal', undefined]) expect(clientNameFor(p).length).toBeLessThanOrEqual(40);
  });
});

/** A client that answers from lists, so each test says exactly what HoneyDue-Flow does. */
function fakeClient(o: { discover?: Discovery[]; start?: ConnectStart; polls?: ConnectPoll[]; hasToken?: boolean } = {}) {
  const discovers = [...(o.discover ?? [{ kind: 'not-found' } as Discovery])];
  const polls = [...(o.polls ?? [])];
  const calls: string[] = [];
  let token = o.hasToken ?? false;
  const client = {
    hasToken: () => token,
    discover: async () => { calls.push('discover'); return discovers.length > 1 ? discovers.shift()! : discovers[0]; },
    startConnect: async (name: string) => { calls.push(`start:${name}`); return o.start ?? ({ kind: 'started', requestId: 'r1', expiresInSeconds: 60 } as ConnectStart); },
    pollConnect: async (id: string) => {
      calls.push(`poll:${id}`);
      const p = polls.length > 1 ? polls.shift()! : polls[0] ?? { kind: 'pending' as const };
      if (p.kind === 'allowed') token = true;
      return p;
    },
    disconnect: async () => { calls.push('disconnect'); token = false; },
  } as unknown as BridgeClient;
  return { client, calls };
}

const make = (c: ReturnType<typeof fakeClient>, extra: { maxWaitSeconds?: number } = {}) => {
  const slept: number[] = [];
  const panel = createPanel({ client: c.client, clientName: 'Outlook (Mac)', sleep: async (ms) => { slept.push(ms); }, texts: TEXTS, ...extra });
  const seen: PanelState['kind'][] = [];
  panel.subscribe((s) => seen.push(s.kind));
  return { panel, seen, slept };
};

describe('PLG-S: the panel moves between states', () => {
  it('PLG-S01 starts as checking', () => {
    expect(make(fakeClient()).panel.get().kind).toBe('checking');
  });

  it('PLG-S02 refresh goes checking, then the state that follows', async () => {
    const { panel, seen } = make(fakeClient());
    await panel.refresh();
    expect(seen).toEqual(['checking', 'not-detected']);
  });

  it('PLG-S03 connect with Allow: waits, then lands connected', async () => {
    const c = fakeClient({ discover: [found()], polls: [{ kind: 'pending' }, { kind: 'allowed', token: 'a'.repeat(64) }] });
    const { panel, seen, slept } = make(c);
    await panel.connect();
    expect(seen).toEqual(['waiting-for-allow', 'checking', 'connected']);
    expect(c.calls[0]).toBe('start:Outlook (Mac)');
    expect(slept).toEqual([1000]);
  });

  it('PLG-S04 connect with Deny: not connected, with the denied words', async () => {
    const { panel } = make(fakeClient({ polls: [{ kind: 'denied' }] }));
    await panel.connect();
    expect(panel.get()).toEqual({ kind: 'not-connected', notice: TEXTS.connectDenied });
  });

  it('PLG-S05 connect that expires in HoneyDue-Flow: not connected, with the timed-out words', async () => {
    const { panel } = make(fakeClient({ polls: [{ kind: 'expired' }] }));
    await panel.connect();
    expect(panel.get()).toEqual({ kind: 'not-connected', notice: TEXTS.connectExpired });
  });

  it('PLG-S06 nobody answers for longer than the limit: not connected, timed out', async () => {
    const c = fakeClient({ polls: [{ kind: 'pending' }] });
    const { panel, slept } = make(c, { maxWaitSeconds: 3 });
    await panel.connect();
    expect(panel.get()).toEqual({ kind: 'not-connected', notice: TEXTS.connectExpired });
    expect(slept.length).toBe(4);
  });

  it('PLG-S07 another request is waiting: the busy words', async () => {
    const { panel } = make(fakeClient({ start: { kind: 'failed', failure: { code: 'connect_busy', message: 'x', status: 409 } } }));
    await panel.connect();
    expect(panel.get()).toEqual({ kind: 'not-connected', notice: TEXTS.connectBusy });
  });

  it('PLG-S08 locked: the minutes are rounded up and are at least one', async () => {
    const lock = (s: number) => fakeClient({ start: { kind: 'failed', failure: { code: 'connect_locked', message: 'x', status: 429, retryAfterSeconds: s } } });
    const a = make(lock(61)); await a.panel.connect();
    expect(a.panel.get()).toEqual({ kind: 'not-connected', notice: TEXTS.connectLocked(2) });
    const b = make(lock(5)); await b.panel.connect();
    expect(b.panel.get()).toEqual({ kind: 'not-connected', notice: TEXTS.connectLocked(1) });
  });

  it('PLG-S09 another failure uses the message HoneyDue-Flow sent; with none, the general words', async () => {
    const withMsg = make(fakeClient({ start: { kind: 'failed', failure: { code: 'internal', message: 'Because.', status: 500 } } }));
    await withMsg.panel.connect();
    expect(withMsg.panel.get()).toEqual({ kind: 'not-connected', notice: 'Because.' });
    const noMsg = make(fakeClient({ start: { kind: 'failed', failure: { code: 'internal', message: '', status: 500 } } }));
    await noMsg.panel.connect();
    expect(noMsg.panel.get()).toEqual({ kind: 'not-connected', notice: TEXTS.somethingWrong });
  });

  it('PLG-S10 HoneyDue-Flow vanishes while connecting: look again, which finds it gone', async () => {
    const c = fakeClient({ discover: [{ kind: 'not-found' }], start: { kind: 'failed', failure: { code: 'unreachable', message: '', status: 0 } } });
    const { panel } = make(c);
    await panel.connect();
    expect(panel.get().kind).toBe('not-detected');
  });

  it('PLG-S11 HoneyDue-Flow vanishes while waiting: look again, which finds it gone', async () => {
    const c = fakeClient({ discover: [{ kind: 'not-found' }], polls: [{ kind: 'failed', failure: { code: 'unreachable', message: '', status: 0 } }] });
    const { panel } = make(c);
    await panel.connect();
    expect(panel.get().kind).toBe('not-detected');
  });

  it('PLG-S12 a failed poll with a message shows that message', async () => {
    const { panel } = make(fakeClient({ polls: [{ kind: 'failed', failure: { code: 'internal', message: 'Odd.', status: 500 } }] }));
    await panel.connect();
    expect(panel.get()).toEqual({ kind: 'not-connected', notice: 'Odd.' });
  });

  it('PLG-S13 Cancel while waiting stops the wait and a late answer is ignored', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const c = fakeClient({ polls: [{ kind: 'allowed', token: 'a'.repeat(64) }], discover: [found()] });
    const slow = c.client.pollConnect;
    (c.client as any).pollConnect = async (id: string) => { await gate; return slow(id); };
    const { panel } = make(c);
    const running = panel.connect();
    await Promise.resolve(); await Promise.resolve();
    panel.cancel();
    release();
    await running;
    expect(panel.get()).toEqual({ kind: 'not-connected', notice: '' });
  });

  it('PLG-S14 disconnect forgets the token and looks again', async () => {
    const c = fakeClient({ hasToken: true, discover: [found({ connected: false })] });
    const { panel } = make(c);
    await panel.disconnect();
    expect(c.calls).toContain('disconnect');
    expect(panel.get()).toEqual({ kind: 'not-connected', notice: '' });
  });

  it('PLG-S15 two refreshes at once: only the newer one sets the state', async () => {
    const first = new Promise<Discovery>((r) => setTimeout(() => r({ kind: 'not-found' }), 10));
    const answers: Promise<Discovery>[] = [first, Promise.resolve(found())];
    const c = fakeClient({ hasToken: true });
    (c.client as any).discover = async () => answers.shift()!;
    const { panel } = make(c);
    await Promise.all([panel.refresh(), panel.refresh()]);
    expect(panel.get().kind).toBe('connected');
  });

  it('PLG-S16 unsubscribing stops the calls', async () => {
    const { panel } = make(fakeClient());
    const got: string[] = [];
    const off = panel.subscribe((s) => got.push(s.kind));
    off();
    await panel.refresh();
    expect(got).toEqual([]);
  });
});

describe('PLG-T: the words', () => {
  it('PLG-T01 the not-detected words say "HoneyDue-Flow was not detected"', () => {
    expect(TEXTS.notDetectedTitle).toBe('HoneyDue-Flow was not detected');
  });
  it('PLG-T02 every message is non-empty', () => {
    for (const [k, v] of Object.entries(TEXTS)) {
      const s = typeof v === 'function' ? (v as (...a: any[]) => string)('a', 'b', 'c') : v;
      expect(s.length, k).toBeGreaterThan(0);
    }
  });
});
