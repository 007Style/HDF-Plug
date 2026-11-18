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
