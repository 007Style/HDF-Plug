// The date and time boxes work in the user's own time. Plain strings "2026-11-20" and "09:30" in, a Date or an ISO string out.

const two = (n: number) => String(n).padStart(2, '0');

export function toLocalParts(d: Date): { date: string; time: string } {
  return { date: `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`, time: `${two(d.getHours())}:${two(d.getMinutes())}` };
}

/** Both boxes filled and a real day and time, or null. Built from numbers, so it is local time in every browser. */
export function fromLocalParts(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const [y, mo, da, h, mi] = [+d[1], +d[2], +d[3], +t[1], +t[2]];
  const out = new Date(y, mo - 1, da, h, mi, 0, 0);
  const same = out.getFullYear() === y && out.getMonth() === mo - 1 && out.getDate() === da && out.getHours() === h && out.getMinutes() === mi;
  return same ? out : null;
}

/** HoneyDue-Flow's own default for a new flow: 30 minutes from now. */
export function defaultStart(now: Date): { date: string; time: string } {
  return toLocalParts(new Date(now.getTime() + 30 * 60_000));
}

/** "Fri, Nov 20, 9:00 AM", in the user's own time and language. */
export function formatWhen(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
