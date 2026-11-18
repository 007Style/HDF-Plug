import { composePeople, peopleOf, type ItemPeople, type RawAddress } from './people';

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

/** The person (or people) on the email now open. Reads Outlook each time, so it is never out of date. For a message being written it reads the To line. */
export async function readItemPeople(): Promise<ItemPeople> {
  const O: typeof Office | undefined = (globalThis as any).Office;
  const mailbox = O?.context?.mailbox;
  if (!mailbox) return { kind: 'none' };
  const own = mailbox.userProfile?.emailAddress ?? '';
  const item = mailbox.item as any;
  const first = peopleOf(item, own);
  if (first.kind !== 'compose') return first;
  const to = await new Promise<RawAddress[] | null>((resolve) => {
    try {
      item.to.getAsync((r: any) => resolve(r?.status === O!.AsyncResultStatus.Succeeded && Array.isArray(r.value) ? r.value : null));
    } catch { resolve(null); }
  });
  return composePeople(to, own);
}

/** Calls `handler` when the user opens another email while the panel is pinned, and (in a message being written) when the To line changes. Returns a function that stops listening. */
export function onItemChanged(handler: () => void): () => void {
  const O: typeof Office | undefined = (globalThis as any).Office;
  const mailbox = O?.context?.mailbox;
  if (!mailbox || typeof mailbox.addHandlerAsync !== 'function') return () => {};

  // The To line belongs to one item, so the listener moves to each new item the panel is shown for.
  let watched: any = null;
  const recipients = () => handler();
  const unwatch = () => {
    try { watched?.removeHandlerAsync(O!.EventType.RecipientsChanged, { handler: recipients }); } catch { /* the item is gone */ }
    watched = null;
  };
  const watch = () => {
    unwatch();
    const item = mailbox.item as any;
    if (item && typeof item.addHandlerAsync === 'function' && item.to && !Array.isArray(item.to)) {
      try { item.addHandlerAsync(O!.EventType.RecipientsChanged, recipients); watched = item; } catch { /* the Check again button still works */ }
    }
  };

  const changed = () => { watch(); handler(); };
  mailbox.addHandlerAsync(O!.EventType.ItemChanged, changed);
  watch();
  return () => {
    unwatch();
    try { (mailbox as any).removeHandlerAsync(O!.EventType.ItemChanged, { handler: changed }); } catch { /* the pane is closing */ }
  };
}
