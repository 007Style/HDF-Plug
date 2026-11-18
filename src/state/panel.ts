// The state machine of PLAN 5.3, for the states the walking skeleton has: 1 (not detected), 2 (too old), 3 (connect), 4 (switched off),
// 5 (not signed in) and connected. No React and no Office here, so it is tested on its own.
import type { BridgeClient, Discovery } from '../bridge/client';

export type PanelState =
  | { kind: 'checking' }
  | { kind: 'not-detected' }
  | { kind: 'hdf-too-old' }
  | { kind: 'add-in-too-old' }
  | { kind: 'switched-off' }
  | { kind: 'not-connected'; /** Why the last attempt did not work, in plain words, or empty. */ notice: string }
  | { kind: 'waiting-for-allow' }
  | { kind: 'not-signed-in' }
  | { kind: 'connected'; appVersion: string };

/** Order matters: not found, version, switched off, not connected, not signed in, connected. */
export function stateFromDiscovery(d: Discovery, hasToken: boolean): PanelState {
  if (d.kind === 'not-found') return { kind: 'not-detected' };
  if (d.kind === 'too-old') return { kind: 'hdf-too-old' };
  if (d.kind === 'add-in-too-old') return { kind: 'add-in-too-old' };
  if (!d.hello.bridgeEnabled) return { kind: 'switched-off' };
  if (!hasToken || !d.hello.connected) return { kind: 'not-connected', notice: '' };
  if (d.hello.connection !== 'connected') return { kind: 'not-signed-in' };
  return { kind: 'connected', appVersion: d.hello.appVersion };
}

/** "Outlook (Mac)", "Outlook (Windows)", "Outlook (web)": shown to the user in HoneyDue-Flow's question, so it says where the request is from. 40 characters at most. */
export function clientNameFor(platform: string | undefined): string {
  switch (platform) {
    case 'Mac': return 'Outlook (Mac)';
    case 'PC': return 'Outlook (Windows)';
    case 'OfficeOnline': return 'Outlook (web)';
    case 'Universal': return 'Outlook (mobile)';
    default: return 'Outlook';
  }
}

export interface PanelDeps {
  client: BridgeClient;
  clientName: string;
  /** Waits; replaced in tests. */
  sleep?: (ms: number) => Promise<void>;
  /** How long to wait for the user to press Allow, in seconds, at most. HoneyDue-Flow gives up after 60. */
  maxWaitSeconds?: number;
  texts: {
    connectDenied: string;
    connectExpired: string;
    connectBusy: string;
    connectLocked: (minutes: number) => string;
    somethingWrong: string;
  };
}

/** Holds the current state and moves it. Every change is announced to the listeners. */
export function createPanel(deps: PanelDeps) {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxWait = deps.maxWaitSeconds ?? 65;
  let state: PanelState = { kind: 'checking' };
  const listeners = new Set<(s: PanelState) => void>();
  let generation = 0; // a newer action makes an older one drop its answer

  const set = (s: PanelState) => {
    state = s;
    listeners.forEach((l) => l(s));
  };

  return {
    get: () => state,
    subscribe(fn: (s: PanelState) => void) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },

    /** Looks for HoneyDue-Flow again and settles on the state that follows. */
    async refresh(): Promise<void> {
      const mine = ++generation;
      set({ kind: 'checking' });
      const d = await deps.client.discover();
      if (mine !== generation) return;
      set(stateFromDiscovery(d, deps.client.hasToken()));
    },

    /** Asks HoneyDue-Flow to connect and waits for the user's answer there. */
    async connect(): Promise<void> {
      const mine = ++generation;
      const start = await deps.client.startConnect(deps.clientName);
      if (mine !== generation) return;
      if (start.kind === 'failed') {
        const f = start.failure;
        const notice =
          f.code === 'connect_busy' ? deps.texts.connectBusy
          : f.code === 'connect_locked' ? deps.texts.connectLocked(Math.max(1, Math.ceil((f.retryAfterSeconds ?? 60) / 60)))
          : f.code === 'unreachable' ? ''
          : f.message || deps.texts.somethingWrong;
        if (f.code === 'unreachable') return this.refresh();
        set({ kind: 'not-connected', notice });
        return;
      }
      set({ kind: 'waiting-for-allow' });
      for (let waited = 0; waited <= maxWait; waited += 1) {
        const r = await deps.client.pollConnect(start.requestId);
        if (mine !== generation) return;
        if (r.kind === 'allowed') return this.refresh();
        if (r.kind === 'denied') { set({ kind: 'not-connected', notice: deps.texts.connectDenied }); return; }
        if (r.kind === 'expired') { set({ kind: 'not-connected', notice: deps.texts.connectExpired }); return; }
        if (r.kind === 'failed') {
          if (r.failure.code === 'unreachable') return this.refresh();
          set({ kind: 'not-connected', notice: r.failure.message || deps.texts.somethingWrong });
          return;
        }
        await sleep(1000);
        if (mine !== generation) return;
      }
      set({ kind: 'not-connected', notice: deps.texts.connectExpired });
    },

    /** The user pressed Cancel while waiting. The request in HoneyDue-Flow expires by itself. */
    cancel(): void {
      generation++;
      set({ kind: 'not-connected', notice: '' });
    },

    async disconnect(): Promise<void> {
      const mine = ++generation;
      await deps.client.disconnect();
      if (mine !== generation) return;
      await this.refresh();
    },
  };
}
export type Panel = ReturnType<typeof createPanel>;
