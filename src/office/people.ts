// Who is "the person on this email" (PLAN 5.2). Plain values in, plain values out: no Office.js here, so it is tested on its own.

export interface Person { email: string; name: string }

export type ItemPeople =
  | { kind: 'people'; direction: 'received' | 'sent'; people: Person[] }
  | { kind: 'none' }
  | { kind: 'not-email' }
  | { kind: 'compose' };

/** The parts of an Outlook item this file reads. Office.js's own types are wider; these are the only fields used. */
export interface RawAddress { emailAddress?: string; displayName?: string }
export interface RawItem {
  itemType?: string;
  from?: RawAddress | { getAsync?: unknown } | null;
  to?: RawAddress[] | { getAsync?: unknown } | null;
  cc?: RawAddress[] | { getAsync?: unknown } | null;
}

/** The most people one sent email can offer. More than this is a mass mailing, not a conversation. */
export const MAX_PEOPLE = 10;

const asAddresses = (v: unknown): RawAddress[] | null => (Array.isArray(v) ? (v as RawAddress[]) : null);

function toPerson(a: RawAddress | null | undefined): Person | null {
  const email = typeof a?.emailAddress === 'string' ? a.emailAddress.trim() : '';
  // An internal Exchange address ("/O=...") or anything that is not one plain address cannot be looked up.
  if (!/^[^\s@,;/]+@[^\s@,;]+$/.test(email)) return null;
  return { email, name: typeof a?.displayName === 'string' ? a.displayName.trim() : '' };
}

/** A received email gives its sender. A sent email gives its recipients (To, then Cc), without the user and without repeats. */
export function peopleOf(item: RawItem | null | undefined, ownEmail: string): ItemPeople {
  if (!item) return { kind: 'none' };
  if (item.itemType !== undefined && item.itemType !== 'message') return { kind: 'not-email' };
  const to = asAddresses(item.to);
  const from = item.from && !('getAsync' in item.from) ? (item.from as RawAddress) : null;
  // A message being written has recipient boxes that are read with a call, not a list.
  if (!to && !from) return { kind: 'compose' };

  const own = ownEmail.trim().toLowerCase();
  const sender = toPerson(from);
  if (sender && sender.email.toLowerCase() !== own) return { kind: 'people', direction: 'received', people: [sender] };

  const seen = new Set<string>();
  const people: Person[] = [];
  for (const a of [...(to ?? []), ...(asAddresses(item.cc) ?? [])]) {
    const p = toPerson(a);
    if (!p) continue;
    const key = p.email.toLowerCase();
    if (key === own || seen.has(key)) continue;
    seen.add(key);
    people.push(p);
    if (people.length === MAX_PEOPLE) break;
  }
  return people.length ? { kind: 'people', direction: 'sent', people } : { kind: 'none' };
}
