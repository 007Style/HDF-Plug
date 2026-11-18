import { peopleOf, type ItemPeople } from './people';

// The only file that touches Office.js. Everything else gets plain values, so it can be tested without Outlook.

/** Resolves when Office.js is ready, with the platform name ("Mac", "PC", "OfficeOnline", "Universal"). Outside Outlook it resolves with undefined, so the page can still be opened in a browser for development. */
export function whenOfficeReady(timeoutMs = 4000): Promise<string | undefined> {
  return new Promise((resolve) => {
    const O: typeof Office | undefined = (globalThis as any).Office;
    if (!O || typeof O.onReady !== 'function') return resolve(undefined);
    const timer = setTimeout(() => resolve(undefined), timeoutMs);
    O.onReady((info) => {
      clearTimeout(timer);
      resolve(info?.platform ? String(info.platform) : undefined);
    });
  });
}

/** The person (or people) on the email now open. Reads Outlook each time, so it is never out of date. */
export function readItemPeople(): ItemPeople {
  const O: typeof Office | undefined = (globalThis as any).Office;
  const mailbox = O?.context?.mailbox;
  if (!mailbox) return { kind: 'none' };
  const own = mailbox.userProfile?.emailAddress ?? '';
  return peopleOf(mailbox.item as any, own);
}

/** Calls `handler` when the user opens another email while the panel is pinned. Returns a function that stops listening. */
export function onItemChanged(handler: () => void): () => void {
  const O: typeof Office | undefined = (globalThis as any).Office;
  const mailbox = O?.context?.mailbox;
  if (!mailbox || typeof mailbox.addHandlerAsync !== 'function') return () => {};
  const wrapped = () => handler();
  mailbox.addHandlerAsync(O!.EventType.ItemChanged, wrapped);
  return () => {
    try { (mailbox as any).removeHandlerAsync(O!.EventType.ItemChanged, { handler: wrapped }); } catch { /* the pane is closing */ }
  };
}
