import { describe, it, expect } from 'vitest';
import { peopleOf, composePeople, MAX_PEOPLE } from '../src/office/people';
import { defaultStart, formatWhen, fromLocalParts, toLocalParts } from '../src/state/when';

const addr = (emailAddress: string, displayName = '') => ({ emailAddress, displayName });
const ME = 'me@mine.com';

describe('PLG-P who is on the email', () => {
  it('PLG-P01 a received email gives its sender', () => {
    expect(peopleOf({ itemType: 'message', from: addr('Jane@Acme.com', 'Jane Doe'), to: [addr(ME)] }, ME)).toEqual({ kind: 'people', direction: 'received', people: [{ email: 'Jane@Acme.com', name: 'Jane Doe' }] });
  });

  it('PLG-P02 a sent email (the sender is the user) gives the recipients, To then Cc, without the user and without repeats', () => {
    const r = peopleOf({ itemType: 'message', from: addr(ME), to: [addr('a@x.com'), addr('ME@mine.com'), addr('b@x.com')], cc: [addr('A@X.com'), addr('c@x.com')] }, ME);
    expect(r).toEqual({ kind: 'people', direction: 'sent', people: [{ email: 'a@x.com', name: '' }, { email: 'b@x.com', name: '' }, { email: 'c@x.com', name: '' }] });
  });

  it('PLG-P03 an email from the user to the user alone has no one else on it', () => {
    expect(peopleOf({ itemType: 'message', from: addr(ME), to: [addr(ME)] }, ME)).toEqual({ kind: 'none' });
  });

  it('PLG-P04 no item, an appointment, and a message being written are each told apart', () => {
    expect(peopleOf(null, ME)).toEqual({ kind: 'none' });
    expect(peopleOf(undefined, ME)).toEqual({ kind: 'none' });
    expect(peopleOf({ itemType: 'appointment' }, ME)).toEqual({ kind: 'not-email' });
    expect(peopleOf({ itemType: 'message', from: { getAsync: () => {} }, to: { getAsync: () => {} } }, ME)).toEqual({ kind: 'compose' });
  });

  it('PLG-P05 an address that cannot be looked up (an Exchange path, two addresses, nothing) is left out', () => {
    const r = peopleOf({ itemType: 'message', from: addr(ME), to: [addr('/O=EXCH/CN=X'), addr('a@x.com, b@x.com'), addr(''), { displayName: 'No address' }, addr('ok@x.com')] }, ME);
    expect(r).toEqual({ kind: 'people', direction: 'sent', people: [{ email: 'ok@x.com', name: '' }] });
  });

  it('PLG-P06 a sent email to a crowd offers the first ten, not hundreds', () => {
    const to = Array.from({ length: 50 }, (_, i) => addr(`p${i}@x.com`));
    const r = peopleOf({ itemType: 'message', from: addr(ME), to }, ME);
    expect(r.kind === 'people' && r.people).toHaveLength(MAX_PEOPLE);
  });

  it('PLG-P07 the user\'s own address is matched without regard to case or spaces', () => {
    expect(peopleOf({ itemType: 'message', from: addr(' Me@Mine.com '), to: [addr('a@x.com')] }, 'ME@mine.com')).toMatchObject({ direction: 'sent' });
  });

  it('PLG-P08 a received email whose sender cannot be used and that has other recipients falls back to nobody else', () => {
    expect(peopleOf({ itemType: 'message', from: addr('/O=EXCH/CN=Z'), to: [addr(ME)] }, ME)).toEqual({ kind: 'none' });
  });
});

describe('PLG-L the To line of a message being written', () => {
  it('PLG-L01 one person on the To line is offered, marked as read from a message being written', () => {
    expect(composePeople([addr('Jane@Acme.com', 'Jane Doe')], ME)).toEqual({ kind: 'people', direction: 'composing', people: [{ email: 'Jane@Acme.com', name: 'Jane Doe' }] });
  });

  it('PLG-L02 an empty To line, no list at all, and a line holding only the user each say there is nobody yet', () => {
    expect(composePeople([], ME)).toEqual({ kind: 'compose-none' });
    expect(composePeople(null, ME)).toEqual({ kind: 'compose-none' });
    expect(composePeople(undefined, ME)).toEqual({ kind: 'compose-none' });
    expect(composePeople([addr(' ME@mine.com ')], ME)).toEqual({ kind: 'compose-none' });
  });

  it('PLG-L03 more than one different person is refused with the count; the user and repeats do not count', () => {
    expect(composePeople([addr('a@x.com'), addr('b@x.com'), addr('c@x.com')], ME)).toEqual({ kind: 'compose-many', count: 3 });
    expect(composePeople([addr('a@x.com'), addr('A@X.com'), addr(ME)], ME)).toMatchObject({ kind: 'people', direction: 'composing' });
  });

  it('PLG-L04 an address that cannot be looked up is not a person', () => {
    expect(composePeople([addr('/O=EXCH/CN=X'), addr('')], ME)).toEqual({ kind: 'compose-none' });
  });
});

describe('PLG-W the start date and time', () => {
  it('PLG-W01 a date and a time become a real local Date, and back', () => {
    const d = fromLocalParts('2026-11-20', '09:30')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 20, 9, 30]);
    expect(toLocalParts(d)).toEqual({ date: '2026-11-20', time: '09:30' });
  });

  it.each([['', '09:00'], ['2026-11-20', ''], ['2026-13-01', '09:00'], ['2026-02-30', '09:00'], ['2026-11-20', '25:00'], ['2026-11-20', '9:00'], ['20-11-2026', '09:00']])('PLG-W02 %j %j is not a time', (d, t) => {
    expect(fromLocalParts(d, t)).toBeNull();
  });

  it('PLG-W03 the default is thirty minutes from now, across midnight too', () => {
    expect(defaultStart(new Date(2026, 10, 20, 9, 0))).toEqual({ date: '2026-11-20', time: '09:30' });
    expect(defaultStart(new Date(2026, 10, 20, 23, 45))).toEqual({ date: '2026-11-21', time: '00:15' });
  });

  it('PLG-W04 a time is shown in words, and an unreadable one is shown as it came', () => {
    expect(formatWhen(new Date(2026, 10, 20, 9, 0).toISOString(), 'en-US')).toBe('Fri, Nov 20, 9:00 AM');
    expect(formatWhen('soon')).toBe('soon');
  });
});
