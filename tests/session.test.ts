import { describe, it, expect, vi } from 'vitest';
import { createSession, type SessionDeps } from '../src/state/session';
import type { ItemPeople } from '../src/office/people';
import type { AddResult, ApiResult, Eligibility, FlowOptions, ScheduleCheck } from '../src/bridge/types';

const NOW = new Date(2026, 10, 3, 9, 0); // Tue 3 Nov 2026 09:00 local
const eligible = (name: string, email: string): Eligibility => ({ result: 'eligible', contact: { displayName: name, email, company: 'Acme' } });
const OPTIONS: FlowOptions = {
  cadences: [{ id: 'c1', name: 'Intro', stepCount: 3, firstChannel: 'email', active: true }, { id: 'c2', name: 'Off', stepCount: 2, firstChannel: 'call', active: false, inactiveReason: 'x' }],
  templates: [{ id: 't1', name: 'Hi', channel: 'email' }],
  noScriptCall: true,
};
const ADDED: AddResult = { contact: { displayName: 'Jane Doe' }, flow: { name: 'Intro', kind: 'cadence' }, firstStepAt: '2026-11-03T09:30:00.000Z', calendarNote: '' };
const okv = <T,>(value: T): ApiResult<T> => ({ ok: true, value });
const bad = (code: string, status = 409): ApiResult<never> => ({ ok: false, failure: { code, message: code, status } });
const one = (email: string, name = ''): ItemPeople => ({ kind: 'people', direction: 'received', people: [{ email, name }] });

/** A deferred answer, so a test decides the order in which answers arrive. */
function later<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

function setup(over: Partial<SessionDeps['client']> = {}, item: ItemPeople = one('jane@acme.com', 'Jane')) {
  let current = item;
  let fire = () => {};
  const client = {
    check: vi.fn(async (e: string) => okv(eligible('Jane Doe', e))),
    flowOptions: vi.fn(async () => okv(OPTIONS)),
    scheduleCheck: vi.fn(async (): Promise<ApiResult<ScheduleCheck>> => okv({ inPast: false, held: false })),
    addFlow: vi.fn(async () => okv(ADDED)),
    ...over,
  };
  const onLost = vi.fn();
  const session = createSession({ client: client as any, readPeople: () => current, watchItem: (h) => { fire = h; return () => { fire = () => {}; }; }, onLost, now: () => NOW });
  return { session, client, onLost, change: (i: ItemPeople) => { current = i; fire(); } };
}

describe('PLG-S the panel once connected', () => {
  it('PLG-S01 an eligible sender: the person is checked, the flows are loaded, and the start is 30 minutes from now', async () => {
    const { session, client } = setup();
    session.start();
    await tick();
    const s = session.get();
    expect(client.check).toHaveBeenCalledWith('jane@acme.com');
    expect(s.checks['jane@acme.com']).toMatchObject({ status: 'done', eligibility: { result: 'eligible' } });
    expect(s.options).toEqual({ status: 'ready', value: OPTIONS });
    expect([s.date, s.time]).toEqual(['2026-11-03', '09:30']);
    expect(session.canSubmit()).toBe(false); // no flow chosen yet
  });

  it('PLG-S02 a person who cannot be added never loads the list of flows', async () => {
    const { session, client } = setup({ check: vi.fn(async () => okv<Eligibility>({ result: 'not_in_contacts' })) });
    session.start();
    await tick();
    expect(client.flowOptions).not.toHaveBeenCalled();
    expect(session.get().options.status).toBe('idle');
  });

  it('PLG-S03 choosing a flow asks HoneyDue-Flow about the time, and OK becomes possible', async () => {
    const { session, client } = setup();
    session.start(); await tick();
    session.choose({ kind: 'cadence', cadenceId: 'c1' });
    await tick();
    expect(client.scheduleCheck).toHaveBeenLastCalledWith({ kind: 'cadence', cadenceId: 'c1' }, new Date(2026, 10, 3, 9, 30).toISOString());
    expect(session.canSubmit()).toBe(true);
  });

  it('PLG-S04 changing the time asks again, and a warning that arrives late for an older time is dropped', async () => {
    const first = later<ApiResult<ScheduleCheck>>();
    const calls: Array<ReturnType<typeof later<ApiResult<ScheduleCheck>>>> = [first];
    const second = later<ApiResult<ScheduleCheck>>(); calls.push(second);
    let n = 0;
    const { session } = setup({ scheduleCheck: vi.fn(() => calls[n++].promise) as any });
    session.start(); await tick();
    // options load triggers no schedule call yet (no choice), so the first call is the choice
    session.choose({ kind: 'template', channel: 'call' });
    session.setWhen('2026-11-04', '10:00');
    second.resolve(okv({ inPast: false, held: true, reason: 'Weekend', nextAllowed: '2026-11-09T13:00:00.000Z' }));
    await tick();
    first.resolve(okv({ inPast: true, held: false }));
    await tick();
    expect(session.get().schedule).toMatchObject({ held: true });
  });

  it('PLG-S05 pressing OK sends the person, the choice and the time once; a second press while it works does nothing', async () => {
    const gate = later<ApiResult<AddResult>>();
    const { session, client } = setup({ addFlow: vi.fn(() => gate.promise) as any });
    session.start(); await tick();
    session.choose({ kind: 'cadence', cadenceId: 'c1' });
    await tick();
    const p1 = session.submit();
    const p2 = session.submit();
    expect(session.get().submit.status).toBe('submitting');
    expect(session.canSubmit()).toBe(false);
    gate.resolve(okv(ADDED));
    await Promise.all([p1, p2]);
    expect(client.addFlow).toHaveBeenCalledTimes(1);
    expect(client.addFlow).toHaveBeenCalledWith('jane@acme.com', { kind: 'cadence', cadenceId: 'c1' }, new Date(2026, 10, 3, 9, 30).toISOString());
    expect(session.get().submit).toEqual({ status: 'done', result: ADDED });
    expect(session.canSubmit()).toBe(false); // nothing more to add for this person
  });

  it('PLG-S06 a person who needs the address on the contact (second address on the email) is sent with the address of the email, for HoneyDue-Flow to match', async () => {
    const { session, client } = setup({ check: vi.fn(async () => okv(eligible('Jane Doe', 'jane@acme.com'))) }, one('jane.home@gmail.com'));
    session.start(); await tick();
    session.choose({ kind: 'template', channel: 'call' }); await tick();
    await session.submit();
    expect((client.addFlow as any).mock.calls[0][0]).toBe('jane.home@gmail.com');
  });

  it('PLG-S07 moving to another email while the first is being checked drops the first answer', async () => {
    const slow = later<ApiResult<Eligibility>>();
    const { session, change } = setup({
      check: vi.fn(async (e: string) => (e === 'old@x.com' ? slow.promise : okv(eligible('New Person', e)))) as any,
    }, one('old@x.com'));
    session.start(); await tick();
    change(one('new@x.com'));
    await tick();
    slow.resolve(okv({ result: 'not_in_contacts' }));
    await tick();
    const s = session.get();
    expect(s.selected).toBe('new@x.com');
    expect(Object.keys(s.checks)).toEqual(['new@x.com']);
    expect(s.checks['new@x.com']).toMatchObject({ status: 'done', eligibility: { result: 'eligible' } });
  });

  it('PLG-S08 moving to another email while the add is under way: the old answer does not change the new email\'s panel', async () => {
    const gate = later<ApiResult<AddResult>>();
    const { session, change } = setup({ addFlow: vi.fn(() => gate.promise) as any }, one('jane@acme.com'));
    session.start(); await tick();
    session.choose({ kind: 'cadence', cadenceId: 'c1' }); await tick();
    const p = session.submit();
    change(one('raj@acme.com'));
    await tick();
    gate.resolve(okv(ADDED));
    await p;
    expect(session.get().submit.status).toBe('idle');
    expect(session.get().selected).toBe('raj@acme.com');
  });

  it('PLG-S09 a sent email with several people checks each, selects the first, and switching person keeps the flow and time chosen', async () => {
    const many: ItemPeople = { kind: 'people', direction: 'sent', people: [{ email: 'a@x.com', name: 'A' }, { email: 'b@x.com', name: 'B' }] };
    const { session, client } = setup({}, many);
    session.start(); await tick();
    expect(client.check).toHaveBeenCalledTimes(2);
    expect(session.get().selected).toBe('a@x.com');
    session.choose({ kind: 'cadence', cadenceId: 'c1' });
    session.setWhen('2026-11-05', '11:15');
    session.select('B@X.com');
    expect(session.get().selected).toBe('B@X.com');
    expect(session.get().choice).toEqual({ kind: 'cadence', cadenceId: 'c1' });
    expect([session.get().date, session.get().time]).toEqual(['2026-11-05', '11:15']);
    session.select('stranger@x.com'); // not on the email: ignored
    expect(session.get().selected).toBe('B@X.com');
  });

  it('PLG-S10 a refusal because the person is no longer eligible reloads and shows the new reason, not the form', async () => {
    let n = 0;
    const { session } = setup({
      check: vi.fn(async () => (n++ === 0 ? okv(eligible('Jane Doe', 'jane@acme.com')) : okv<Eligibility>({ result: 'already_in_flow', contact: { displayName: 'Jane Doe' }, flow: { cadenceName: 'Intro' } }))) as any,
      addFlow: vi.fn(async () => bad('already_in_flow')) as any,
    });
    session.start(); await tick();
    session.choose({ kind: 'cadence', cadenceId: 'c1' }); await tick();
    await session.submit(); await tick();
    expect(session.get().checks['jane@acme.com']).toMatchObject({ status: 'done', eligibility: { result: 'already_in_flow' } });
  });

  it('PLG-S11 a flow switched off meanwhile: the list is asked for again and the choice is cleared', async () => {
    const { session, client } = setup({ addFlow: vi.fn(async () => bad('cadence_off')) as any });
    session.start(); await tick();
    session.choose({ kind: 'cadence', cadenceId: 'c1' }); await tick();
    await session.submit(); await tick();
    expect(client.flowOptions).toHaveBeenCalledTimes(2);
    expect(session.get().choice).toBeNull();
    expect(session.get().submit).toMatchObject({ status: 'failed', failure: { code: 'cadence_off' } });
  });

  it('PLG-S12 any other failure keeps the form, says why, and Try again sends the same thing again', async () => {
    let n = 0;
    const { session, client } = setup({ addFlow: vi.fn(async () => (n++ === 0 ? bad('app_busy', 504) : okv(ADDED))) as any });
    session.start(); await tick();
    session.choose({ kind: 'template', channel: 'call' }); await tick();
    await session.submit();
    expect(session.get().submit).toMatchObject({ status: 'failed', failure: { code: 'app_busy' } });
    expect(session.get().choice).toEqual({ kind: 'template', channel: 'call' });
    await session.retry();
    expect(client.addFlow).toHaveBeenCalledTimes(2);
    expect(session.get().submit.status).toBe('done');
  });

  it.each(['unauthorized', 'unreachable', 'bridge_off'])('PLG-S13 %s during a check tells the panel the connection is lost, once', async (code) => {
    const { session, onLost } = setup({ check: vi.fn(async () => bad(code, 401)) as any });
    session.start(); await tick();
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('PLG-S14 not_connected and contacts_unavailable are shown on the person, and do not send the user back to Connect', async () => {
    const { session, onLost } = setup({ check: vi.fn(async () => bad('contacts_unavailable', 502)) as any });
    session.start(); await tick();
    expect(onLost).not.toHaveBeenCalled();
    expect(session.get().checks['jane@acme.com']).toMatchObject({ status: 'error', failure: { code: 'contacts_unavailable' } });
  });

  it('PLG-S15 the list of flows failing can be tried again', async () => {
    let n = 0;
    const { session, client } = setup({ flowOptions: vi.fn(async () => (n++ === 0 ? bad('internal', 500) : okv(OPTIONS))) as any });
    session.start(); await tick();
    expect(session.get().options.status).toBe('error');
    session.retryOptions(); await tick();
    expect(client.flowOptions).toHaveBeenCalledTimes(2);
    expect(session.get().options.status).toBe('ready');
  });

  it('PLG-S16 a flow chosen on one email that was switched off by the time the next email loads is dropped', async () => {
    let n = 0;
    const off: FlowOptions = { ...OPTIONS, cadences: [{ ...OPTIONS.cadences[0], active: false }] };
    const { session, change } = setup({ flowOptions: vi.fn(async () => okv(n++ === 0 ? OPTIONS : off)) as any });
    session.start(); await tick();
    session.choose({ kind: 'cadence', cadenceId: 'c1' }); await tick();
    change(one('raj@acme.com')); await tick();
    expect(session.get().choice).toBeNull();
  });

  it('PLG-S17 a start time that has already passed when the next email opens is moved to 30 minutes from now', async () => {
    const { session, change } = setup();
    session.start(); await tick();
    session.setWhen('2026-11-03', '08:00');
    change(one('raj@acme.com')); await tick();
    expect([session.get().date, session.get().time]).toEqual(['2026-11-03', '09:30']);
  });

  it('PLG-S18 an unreadable time cannot be submitted', async () => {
    const { session } = setup();
    session.start(); await tick();
    session.choose({ kind: 'template', channel: 'call' }); await tick();
    session.setWhen('', '09:30');
    expect(session.canSubmit()).toBe(false);
  });

  it('PLG-S19 an email with nobody on it, or one that is not an email, asks nothing of HoneyDue-Flow', async () => {
    const { session, client, change } = setup({}, { kind: 'none' });
    session.start(); await tick();
    expect(session.get().item).toEqual({ kind: 'none' });
    change({ kind: 'not-email' }); await tick();
    expect(client.check).not.toHaveBeenCalled();
    expect(client.flowOptions).not.toHaveBeenCalled();
  });

  it('PLG-S20 after stop, an answer that arrives later changes nothing and the watcher is gone', async () => {
    const slow = later<ApiResult<Eligibility>>();
    const { session, change } = setup({ check: vi.fn(() => slow.promise) as any });
    session.start();
    const before = session.get();
    session.stop();
    slow.resolve(okv(eligible('X', 'x@x.com')));
    await tick();
    expect(session.get()).toBe(before);
    change(one('other@x.com')); await tick();
    expect(session.get()).toBe(before);
  });
});

describe('PLG-S21 a message being written is read with a call that answers later', () => {
  it('PLG-S21a the session waits for the answer, then checks the person', async () => {
    const client = { check: vi.fn(async () => ({ ok: true, value: { result: 'not_in_contacts' } })), flowOptions: vi.fn(), scheduleCheck: vi.fn(), addFlow: vi.fn() };
    const people: ItemPeople = { kind: 'people', direction: 'composing', people: [{ email: 'a@x.com', name: 'A' }] };
    const s = createSession({ client: client as any, readPeople: () => new Promise<ItemPeople>((r) => setTimeout(() => r(people), 5)), watchItem: () => () => {}, onLost: vi.fn(), now: () => NOW });
    s.start();
    expect(s.get().item.kind).toBe('loading');
    await new Promise((r) => setTimeout(r, 30));
    expect(s.get().item).toEqual(people);
    expect(client.check).toHaveBeenCalledWith('a@x.com');
  });

  it('PLG-S21b a slow answer about an earlier To line is dropped when a newer look has finished', async () => {
    const client = { check: vi.fn(async () => ({ ok: true, value: { result: 'not_in_contacts' } })), flowOptions: vi.fn(), scheduleCheck: vi.fn(), addFlow: vi.fn() };
    const mk = (e: string): ItemPeople => ({ kind: 'people', direction: 'composing', people: [{ email: e, name: '' }] });
    const delays = [40, 1];
    let i = 0;
    const s = createSession({ client: client as any, readPeople: () => { const n = i++; return new Promise<ItemPeople>((r) => setTimeout(() => r(mk(n === 0 ? 'old@x.com' : 'new@x.com')), delays[n])); }, watchItem: () => () => {}, onLost: vi.fn(), now: () => NOW });
    s.start();
    void s.reload();
    await new Promise((r) => setTimeout(r, 80));
    expect(s.get().item).toEqual(mk('new@x.com'));
    expect(client.check).toHaveBeenCalledTimes(1);
    expect(client.check).toHaveBeenCalledWith('new@x.com');
  });
});
