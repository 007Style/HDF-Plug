import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/components/App';
import { createSession } from '../src/state/session';
import type { Panel } from '../src/state/panel';
import type { ItemPeople } from '../src/office/people';
import type { ApiResult, Eligibility, FlowOptions } from '../src/bridge/types';
import { TEXTS } from '../src/texts';

const okv = <T,>(value: T): ApiResult<T> => ({ ok: true, value });
const bad = (code: string, message = code, status = 409, detail?: any): ApiResult<never> => ({ ok: false, failure: { code, message, status, ...(detail ? { detail } : {}) } });
const eligible = (email = 'jane@acme.com'): Eligibility => ({ result: 'eligible', contact: { displayName: 'Jane Doe', email, company: 'Acme' } });
const OPTIONS: FlowOptions = {
  cadences: [
    { id: 'c1', name: 'Intro', stepCount: 4, firstChannel: 'email', active: true },
    { id: 'c2', name: 'Re-engage', stepCount: 1, firstChannel: 'call', active: false, inactiveReason: "Step 2 needs the email template 'Follow up', which was deleted." },
  ],
  templates: [{ id: 't1', name: 'Quick check-in', channel: 'email' }, { id: 't2', name: 'Cold call script', channel: 'call' }],
  noScriptCall: true,
};
const NOW = new Date(2026, 10, 3, 9, 0);

function mount(over: any = {}, item: ItemPeople = { kind: 'people', direction: 'received', people: [{ email: 'jane@acme.com', name: 'Jane Doe' }] }) {
  const client = {
    check: vi.fn(async (e: string) => okv(eligible(e))),
    flowOptions: vi.fn(async () => okv(OPTIONS)),
    scheduleCheck: vi.fn(async () => okv({ inPast: false, held: false })),
    addFlow: vi.fn(async () => okv({ contact: { displayName: 'Jane Doe' }, flow: { name: 'Intro', kind: 'cadence' as const }, firstStepAt: new Date(2026, 10, 3, 9, 30).toISOString(), calendarNote: '' })),
    ...over,
  };
  let current = item;
  let fire = () => {};
  const session = createSession({ client, readPeople: () => current, watchItem: (h) => { fire = h; return () => {}; }, onLost: vi.fn(), now: () => NOW });
  const panel = {
    get: () => ({ kind: 'connected', appVersion: '1.2.0' }), subscribe: () => () => {}, refresh: vi.fn(async () => {}),
    connect: vi.fn(), cancel: vi.fn(), disconnect: vi.fn(async () => {}),
  } as unknown as Panel;
  render(<App panel={panel} session={session} />);
  return { client, panel, change: (i: ItemPeople) => { current = i; fire(); } };
}
const ready = () => screen.findByRole('radiogroup', { name: TEXTS.flowHeading });

describe('PLG-F the form', () => {
  it('PLG-F01 an eligible person: name and company, the two groups, and OK is off until a flow is chosen', async () => {
    mount();
    await ready();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
    expect(screen.getByText(TEXTS.multiStep)).toBeInTheDocument();
    expect(screen.getByText(TEXTS.singleStep)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Intro/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Email: Quick check-in/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Phone call: Cold call script/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: new RegExp(TEXTS.noScriptCall) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXTS.ok })).toBeDisabled();
    expect(screen.getByText(TEXTS.pickFlow)).toBeInTheDocument();
  });

  it('PLG-F02 each flow says how many steps it has and what it starts with', async () => {
    mount();
    await ready();
    expect(screen.getByText(TEXTS.stepsOf(4, TEXTS.firstEmail))).toBeInTheDocument();
    expect(screen.getByText(TEXTS.stepsOf(1, TEXTS.firstCall))).toBeInTheDocument();
  });

  it('PLG-F03 a switched-off flow cannot be chosen and shows its reason', async () => {
    mount();
    await ready();
    const off = screen.getByRole('radio', { name: /Re-engage/ });
    expect(off).toBeDisabled();
    expect(screen.getByText(/which was deleted/)).toBeInTheDocument();
  });

  it('PLG-F04 the search box narrows both groups, matches the channel word, and says when nothing matches', async () => {
    mount();
    await ready();
    const box = screen.getByRole('searchbox', { name: TEXTS.searchLabel });
    await userEvent.type(box, 'cold');
    expect(screen.queryByRole('radio', { name: /Intro/ })).toBeNull();
    expect(screen.getByRole('radio', { name: /Cold call script/ })).toBeInTheDocument();
    await userEvent.clear(box);
    await userEvent.type(box, 'no script');
    expect(screen.getByRole('radio', { name: new RegExp(TEXTS.noScriptCall) })).toBeInTheDocument();
    expect(screen.queryByText(TEXTS.multiStep)).toBeNull();
    await userEvent.clear(box);
    await userEvent.type(box, 'zzz');
    expect(screen.getByText(TEXTS.noMatches)).toBeInTheDocument();
  });

  it('PLG-F05 choose a flow, press OK: the person, flow and time go to HoneyDue-Flow and the success message names the flow', async () => {
    const { client } = mount();
    await ready();
    await userEvent.click(screen.getByRole('radio', { name: /Intro/ }));
    const ok = screen.getByRole('button', { name: TEXTS.ok });
    await waitFor(() => expect(ok).toBeEnabled());
    await userEvent.click(ok);
    expect(client.addFlow).toHaveBeenCalledWith('jane@acme.com', { kind: 'cadence', cadenceId: 'c1' }, new Date(2026, 10, 3, 9, 30).toISOString());
    const done = await screen.findByRole('status', { name: TEXTS.successTitle });
    expect(done).toHaveTextContent("Jane Doe is in 'Intro'.");
    expect(screen.getByRole('button', { name: TEXTS.done })).toBeInTheDocument();
  });

  it('PLG-F06 the date and time boxes start 30 minutes from now and can be changed', async () => {
    const { client } = mount();
    await ready();
    const date = screen.getByLabelText(TEXTS.dateLabel) as HTMLInputElement;
    const time = screen.getByLabelText(TEXTS.timeLabel) as HTMLInputElement;
    expect([date.value, time.value]).toEqual(['2026-11-03', '09:30']);
    await userEvent.click(screen.getByRole('radio', { name: /Phone call, no script/ }));
    await userEvent.clear(time);
    await userEvent.type(time, '14:15');
    await waitFor(() => expect(client.scheduleCheck).toHaveBeenLastCalledWith({ kind: 'template', channel: 'call' }, new Date(2026, 10, 3, 14, 15).toISOString()));
  });

  it('PLG-F07 HoneyDue-Flow\'s warnings for the time are shown: past, and held by a shield', async () => {
    mount({ scheduleCheck: vi.fn(async () => okv({ inPast: true, held: true, reason: 'Weekend Shield is on.', nextAllowed: new Date(2026, 10, 9, 8, 0).toISOString() })) });
    await ready();
    await userEvent.click(screen.getByRole('radio', { name: /Intro/ }));
    expect(await screen.findByText(TEXTS.inPast)).toBeInTheDocument();
    expect(await screen.findByText(/Weekend Shield is on\. It will go out/)).toBeInTheDocument();
  });

  it('PLG-F08 while it is adding, OK says so and is off, and the choices cannot be changed', async () => {
    let release!: (v: any) => void;
    const { client } = mount({ addFlow: vi.fn(() => new Promise((r) => { release = r; })) });
    await ready();
    await userEvent.click(screen.getByRole('radio', { name: /Intro/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: TEXTS.ok })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: TEXTS.ok }));
    const busy = screen.getByRole('button', { name: TEXTS.submitting });
    expect(busy).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Intro/ })).toBeDisabled();
    await userEvent.click(busy);
    expect(client.addFlow).toHaveBeenCalledTimes(1);
    release(okv({ contact: { displayName: 'Jane Doe' }, flow: { name: 'Intro', kind: 'cadence' }, firstStepAt: new Date().toISOString(), calendarNote: '' }));
    await screen.findByRole('status', { name: TEXTS.successTitle });
  });

  it('PLG-F09 a failed add shows HoneyDue-Flow\'s words, keeps the form, and Try again works', async () => {
    let n = 0;
    const { client } = mount({
      addFlow: vi.fn(async () => (n++ === 0 ? bad('app_busy', 'x', 504) : okv({ contact: { displayName: 'Jane Doe' }, flow: { name: 'Intro', kind: 'cadence' as const }, firstStepAt: new Date().toISOString(), calendarNote: '' }))),
    });
    await ready();
    await userEvent.click(screen.getByRole('radio', { name: /Intro/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: TEXTS.ok })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: TEXTS.ok }));
    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTS.appBusy);
    await userEvent.click(screen.getByRole('button', { name: TEXTS.tryAgain }));
    await screen.findByRole('status', { name: TEXTS.successTitle });
    expect(client.addFlow).toHaveBeenCalledTimes(2);
  });

  it('PLG-F10 a calendar problem is shown as a warning, and the person is still shown as added', async () => {
    mount({ addFlow: vi.fn(async () => okv({ contact: { displayName: 'Jane Doe' }, flow: { name: 'Intro', kind: 'cadence' as const }, firstStepAt: new Date().toISOString(), calendarNote: 'Problems: calendar offline' })) });
    await ready();
    await userEvent.click(screen.getByRole('radio', { name: /Intro/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: TEXTS.ok })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: TEXTS.ok }));
    expect(await screen.findByText(/calendar offline/)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: TEXTS.successTitle })).toBeInTheDocument();
  });

  it('PLG-F11 no flows or templates at all: says to create one in HoneyDue-Flow', async () => {
    mount({ flowOptions: vi.fn(async () => okv({ cadences: [], templates: [], noScriptCall: false })) });
    expect(await screen.findByText(TEXTS.noFlows)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXTS.ok })).toBeDisabled();
  });

  it('PLG-F12 the list failing to load says so and can be tried again', async () => {
    let n = 0;
    mount({ flowOptions: vi.fn(async () => (n++ === 0 ? bad('internal', 'boom', 500) : okv(OPTIONS))) });
    expect(await screen.findByText(new RegExp(TEXTS.flowsFailed))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TEXTS.tryAgain }));
    await ready();
  });

  it('PLG-F13 when emails will go to a different address on the contact, it says which', async () => {
    mount({ check: vi.fn(async () => okv(eligible('jane@acme.com'))) }, { kind: 'people', direction: 'received', people: [{ email: 'jane.home@gmail.com', name: 'Jane' }] });
    await ready();
    expect(screen.getByText(TEXTS.emailsGoTo('jane@acme.com'))).toBeInTheDocument();
  });

  it('PLG-F14 when the address is the same (any case), nothing is said about it', async () => {
    mount({ check: vi.fn(async () => okv(eligible('jane@acme.com'))) }, { kind: 'people', direction: 'received', people: [{ email: 'Jane@Acme.com', name: 'Jane' }] });
    await ready();
    expect(screen.queryByText(/Emails will go to/)).toBeNull();
  });
});

describe('PLG-N the person cannot be added', () => {
  it.each([
    ['not in contacts', { result: 'not_in_contacts' } as Eligibility, TEXTS.notInContacts('jane@acme.com')],
    ['missing fields', { result: 'missing_fields', missing: ['last name', 'company'], contact: { displayName: 'Jane' } } as Eligibility, TEXTS.missingFields('last name, company')],
    ['already in a flow', { result: 'already_in_flow', contact: { displayName: 'Jane Doe' }, flow: { cadenceName: 'Intro' } } as Eligibility, TEXTS.alreadyInFlowNamed('Jane Doe', 'Intro')],
    ['already in a flow, name unknown', { result: 'already_in_flow', contact: { displayName: 'Jane Doe' }, flow: {} } as Eligibility, TEXTS.alreadyInFlow('Jane Doe')],
  ])('PLG-N01 %s: the reason is shown in place of the form', async (_n, e, words) => {
    const { client } = mount({ check: vi.fn(async () => okv(e)) });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(words);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByRole('button', { name: TEXTS.ok })).toBeNull();
    expect(client.flowOptions).not.toHaveBeenCalled();
  });

  it('PLG-N02 Check again asks HoneyDue-Flow again, so a contact fixed in Outlook becomes usable', async () => {
    let n = 0;
    mount({ check: vi.fn(async () => okv(n++ === 0 ? ({ result: 'missing_fields', missing: ['company'] } as Eligibility) : eligible())) });
    await userEvent.click(await screen.findByRole('button', { name: TEXTS.checkAgain }));
    await ready();
  });

  it('PLG-N03 the title names the person', async () => {
    mount({ check: vi.fn(async () => okv<Eligibility>({ result: 'missing_fields', missing: ['company'], contact: { displayName: 'Jane' } })) });
    expect(await screen.findByRole('alert', { name: TEXTS.cannotTitle('Jane') })).toBeInTheDocument();
  });

  it('PLG-N04 a failed check shows the reason and Try again', async () => {
    let n = 0;
    mount({ check: vi.fn(async () => (n++ === 0 ? bad('contacts_unavailable', 'x', 502) : okv(eligible()))) });
    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTS.contactsUnavailable);
    await userEvent.click(screen.getByRole('button', { name: TEXTS.tryAgain }));
    await ready();
  });
});

describe('PLG-E what is on the email', () => {
  it.each([
    [{ kind: 'none' } as ItemPeople, TEXTS.noPerson],
    [{ kind: 'not-email' } as ItemPeople, TEXTS.notEmail],
    [{ kind: 'compose-none' } as ItemPeople, TEXTS.composeNone],
    [{ kind: 'compose-many', count: 3 } as ItemPeople, TEXTS.composeMany(3)],
  ])('PLG-E01 %j shows its words and asks nothing of HoneyDue-Flow', async (item, words) => {
    const { client } = mount({}, item);
    expect(await screen.findByText(words)).toBeInTheDocument();
    expect(client.check).not.toHaveBeenCalled();
  });

  it('PLG-E02 several recipients: a choice of person, each with its own state, and the form follows the choice', async () => {
    const many: ItemPeople = { kind: 'people', direction: 'sent', people: [{ email: 'a@x.com', name: 'Alice' }, { email: 'b@x.com', name: 'Bob' }] };
    const { client } = mount({
      check: vi.fn(async (e: string) => okv<Eligibility>(e === 'a@x.com' ? eligible('a@x.com') : { result: 'not_in_contacts' })),
    }, many);
    await ready();
    const people = screen.getByRole('group', { name: TEXTS.personHeading });
    expect(within(people).getByRole('radio', { name: /Alice/ })).toBeChecked();
    await waitFor(() => expect(within(people).getByText(TEXTS.personNotOk)).toBeInTheDocument());
    expect(within(people).getByText(TEXTS.personOk)).toBeInTheDocument();
    await userEvent.click(within(people).getByRole('radio', { name: /Bob/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTS.notInContacts('b@x.com'));
    expect(client.check).toHaveBeenCalledTimes(2);
  });

  it('PLG-E03 opening another email while pinned shows that email\'s person', async () => {
    const { change } = mount({ check: vi.fn(async (e: string) => okv<Eligibility>({ result: 'eligible', contact: { displayName: e === 'raj@x.com' ? 'Raj Patel' : 'Jane Doe', email: e, company: 'Acme' } })) });
    await ready();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    change({ kind: 'people', direction: 'received', people: [{ email: 'raj@x.com', name: 'Raj' }] });
    expect(await screen.findByText('Raj Patel')).toBeInTheDocument();
    expect(screen.queryByText('Jane Doe')).toBeNull();
  });

  it('PLG-E04 after success, Done looks at the email again, so the person now shows as already in the flow', async () => {
    let added = false;
    mount({
      check: vi.fn(async () => okv<Eligibility>(added ? { result: 'already_in_flow', contact: { displayName: 'Jane Doe' }, flow: { cadenceName: 'Intro' } } : eligible())),
      addFlow: vi.fn(async () => { added = true; return okv({ contact: { displayName: 'Jane Doe' }, flow: { name: 'Intro', kind: 'cadence' as const }, firstStepAt: new Date().toISOString(), calendarNote: '' }); }),
    });
    await ready();
    await userEvent.click(screen.getByRole('radio', { name: /Intro/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: TEXTS.ok })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: TEXTS.ok }));
    await userEvent.click(await screen.findByRole('button', { name: TEXTS.done }));
    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTS.alreadyInFlowNamed('Jane Doe', 'Intro'));
  });

  it('PLG-E06 the panel says which address it read and from what kind of email, and follows the next email', async () => {
    const { change } = mount({}, { kind: 'people', direction: 'received', people: [{ email: 'jane@acme.com', name: 'Jane' }] });
    await ready();
    expect(screen.getByTestId('read-from')).toHaveTextContent(TEXTS.readFromReceived('jane@acme.com'));
    change({ kind: 'people', direction: 'sent', people: [{ email: 'raj@x.com', name: 'Raj' }] });
    await waitFor(() => expect(screen.getByTestId('read-from')).toHaveTextContent(TEXTS.readFromSent('raj@x.com')));
  });

  it('PLG-E07 a message being written: one person on the To line gets the form and says where it was read', async () => {
    mount({}, { kind: 'people', direction: 'composing', people: [{ email: 'jane@acme.com', name: 'Jane' }] });
    await ready();
    expect(screen.getByTestId('read-from')).toHaveTextContent(TEXTS.readFromTo('jane@acme.com'));
  });

  it('PLG-E08 a message being written with nobody on the To line: Check again reads the line again and shows the person', async () => {
    const { change, client } = mount({}, { kind: 'compose-none' });
    expect(await screen.findByText(TEXTS.composeNone)).toBeInTheDocument();
    change({ kind: 'people', direction: 'composing', people: [{ email: 'jane@acme.com', name: 'Jane' }] });
    await userEvent.click(screen.getByRole('button', { name: TEXTS.checkAgain }));
    await ready();
    expect(client.check).toHaveBeenCalledTimes(1);
  });

  it('PLG-E05 Disconnect is always there once connected, and shows the version', async () => {
    const { panel } = mount();
    await ready();
    expect(screen.getByText(TEXTS.connectedFooter('1.2.0'))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TEXTS.disconnect }));
    expect(panel.disconnect).toHaveBeenCalledTimes(1);
  });
});
