// What the panel does once it is connected: find the person on the email, ask whether they can go into a flow, offer the flows, and put them in.
// No React and no Office here. Every answer from HoneyDue-Flow is dropped if the user has moved on since the question was asked.
import type { BridgeClient } from '../bridge/client';
import type { AddResult, ApiResult, DataFailure, Eligibility, FlowChoice, FlowOptions, ScheduleCheck } from '../bridge/types';
import type { ItemPeople, Person } from '../office/people';
import { defaultStart, fromLocalParts } from './when';

export type PersonCheck = { status: 'checking' } | { status: 'done'; eligibility: Eligibility } | { status: 'error'; failure: DataFailure };
export type OptionsState = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; value: FlowOptions } | { status: 'error'; failure: DataFailure };
export type SubmitState = { status: 'idle' } | { status: 'submitting' } | { status: 'done'; result: AddResult } | { status: 'failed'; failure: DataFailure };

export interface SessionState {
  item: ItemPeople | { kind: 'loading' };
  /** Keyed by the lower-case address. */
  checks: Record<string, PersonCheck>;
  /** The address (as on the email) of the person chosen. */
  selected: string | null;
  options: OptionsState;
  choice: FlowChoice | null;
  date: string;
  time: string;
  schedule: ScheduleCheck | null;
  submit: SubmitState;
}

export interface SessionDeps {
  client: Pick<BridgeClient, 'check' | 'flowOptions' | 'scheduleCheck' | 'addFlow'>;
  readPeople: () => ItemPeople | Promise<ItemPeople>;
  /** Calls the handler when the user opens another email; returns a function that stops. */
  watchItem: (handler: () => void) => () => void;
  /** The connection is gone (no longer allowed, or HoneyDue-Flow closed): the panel looks again and shows the right state. */
  onLost: () => void;
  now?: () => Date;
}

/** Codes after which the connection itself needs looking at again. */
const LOST = new Set(['unauthorized', 'unreachable', 'bridge_off']);

export const keyOf = (email: string) => email.trim().toLowerCase();

export function createSession(deps: SessionDeps) {
  const now = deps.now ?? (() => new Date());
  const start = defaultStart(now());
  let state: SessionState = {
    item: { kind: 'loading' }, checks: {}, selected: null, options: { status: 'idle' }, choice: null,
    date: start.date, time: start.time, schedule: null, submit: { status: 'idle' },
  };
  const listeners = new Set<(s: SessionState) => void>();
  let loadGen = 0;     // a newer email makes older answers about the old one drop
  let optionsGen = 0;
  let scheduleGen = 0;
  let stopWatching: (() => void) | null = null;

  const set = (patch: Partial<SessionState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l(state));
  };

  /** Returns true if the connection was lost (the panel has been told) so the caller stops. */
  const lost = (r: ApiResult<unknown>): boolean => {
    if (r.ok || !LOST.has(r.failure.code)) return false;
    deps.onLost();
    return true;
  };

  const selectedPerson = (): Person | null => {
    const item = state.item;
    return item.kind === 'people' ? item.people.find((p) => keyOf(p.email) === keyOf(state.selected ?? '')) ?? null : null;
  };
  const selectedEligible = (): Extract<Eligibility, { result: 'eligible' }> | null => {
    const c = state.selected ? state.checks[keyOf(state.selected)] : undefined;
    return c?.status === 'done' && c.eligibility.result === 'eligible' ? c.eligibility : null;
  };
  const when = (): Date | null => fromLocalParts(state.date, state.time);

  /** `fresh` asks again even when a list is already shown (a new email), keeping the old list on screen until the new one arrives. */
  async function loadOptions(fresh = false): Promise<void> {
    if (state.options.status === 'loading' || (state.options.status === 'ready' && !fresh)) return;
    const mine = ++optionsGen;
    if (state.options.status !== 'ready') set({ options: { status: 'loading' } });
    const r = await deps.client.flowOptions();
    if (mine !== optionsGen) return;
    if (lost(r)) return;
    set({ options: r.ok ? { status: 'ready', value: r.value } : { status: 'error', failure: r.failure } });
    if (r.ok) {
      // A flow chosen on the last email may have been deleted or switched off since.
      const c = state.choice;
      const gone =
        c?.kind === 'cadence' ? !r.value.cadences.some((x) => x.id === c.cadenceId && x.active)
        : c?.kind === 'template' && c.templateId ? !r.value.templates.some((x) => x.id === c.templateId)
        : c?.kind === 'template' ? !r.value.noScriptCall
        : false;
      if (gone) set({ choice: null, schedule: null });
      void refreshSchedule();
    }
  }

  async function refreshSchedule(): Promise<void> {
    const mine = ++scheduleGen;
    const choice = state.choice;
    const at = when();
    if (!choice || !at || !selectedEligible()) { set({ schedule: null }); return; }
    const r = await deps.client.scheduleCheck(choice, at.toISOString());
    if (mine !== scheduleGen) return;
    if (lost(r)) return;
    set({ schedule: r.ok ? r.value : null }); // a failed warning check is not worth blocking the user for; HoneyDue-Flow still applies its rules
  }

  async function checkOne(person: Person, mine: number): Promise<void> {
    const r = await deps.client.check(person.email);
    if (mine !== loadGen) return;
    if (lost(r)) return;
    set({ checks: { ...state.checks, [keyOf(person.email)]: r.ok ? { status: 'done', eligibility: r.value } : { status: 'error', failure: r.failure } } });
  }

  async function load(): Promise<void> {
    const mine = ++loadGen;
    ++scheduleGen;
    const read = deps.readPeople();
    // A message being written is read with a call to Outlook, so the answer may come later; a newer look makes this one drop.
    const item = read instanceof Promise ? await read : read;
    if (mine !== loadGen) return;
    const past = (when()?.getTime() ?? 0) < now().getTime();
    const fresh = past ? defaultStart(now()) : { date: state.date, time: state.time };
    if (item.kind !== 'people') {
      set({ item, checks: {}, selected: null, schedule: null, submit: { status: 'idle' }, ...fresh });
      return;
    }
    const checks: Record<string, PersonCheck> = {};
    for (const p of item.people) checks[keyOf(p.email)] = { status: 'checking' };
    set({ item, checks, selected: item.people[0].email, schedule: null, submit: { status: 'idle' }, ...fresh });

    // The chosen person first, so the form can appear; the others fill in after.
    for (const p of item.people) {
      await checkOne(p, mine);
      if (mine !== loadGen) return;
      if (keyOf(p.email) === keyOf(state.selected ?? '') && selectedEligible()) void loadOptions(true);
    }
  }

  return {
    get: () => state,
    subscribe(fn: (s: SessionState) => void) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },

    /** Reads the open email and starts listening for the next one. */
    start(): void {
      stopWatching?.();
      stopWatching = deps.watchItem(() => { void load(); });
      void load();
    },
    stop(): void {
      stopWatching?.();
      stopWatching = null;
      loadGen++; optionsGen++; scheduleGen++;
    },
    /** Asks again about the open email (after Try again, or after the user fixed the contact in Outlook). */
    reload: load,

    select(email: string): void {
      if (state.submit.status === 'submitting') return;
      const item = state.item;
      if (item.kind !== 'people' || !item.people.some((p) => keyOf(p.email) === keyOf(email))) return;
      set({ selected: email, submit: { status: 'idle' }, schedule: null });
      if (selectedEligible()) { void loadOptions(); void refreshSchedule(); }
    },

    retryOptions(): void {
      if (state.options.status === 'error') { set({ options: { status: 'idle' } }); void loadOptions(); }
    },

    choose(choice: FlowChoice | null): void {
      if (state.submit.status === 'submitting') return;
      set({ choice, schedule: null, submit: state.submit.status === 'failed' ? { status: 'idle' } : state.submit });
      void refreshSchedule();
    },

    setWhen(date: string, time: string): void {
      if (state.submit.status === 'submitting') return;
      set({ date, time, schedule: null, submit: state.submit.status === 'failed' ? { status: 'idle' } : state.submit });
      void refreshSchedule();
    },

    /** Everything needed is chosen and valid. */
    canSubmit(): boolean {
      return state.submit.status !== 'submitting' && state.submit.status !== 'done' && !!state.choice && !!when() && !!selectedPerson() && !!selectedEligible() && state.options.status === 'ready';
    },

    async submit(): Promise<void> {
      if (!this.canSubmit()) return; // a second press while the first is working does nothing
      const person = selectedPerson()!;
      const choice = state.choice!;
      const at = when()!;
      const mine = loadGen;
      set({ submit: { status: 'submitting' } });
      const r = await deps.client.addFlow(person.email, choice, at.toISOString());
      if (mine !== loadGen) return; // the user moved to another email; HoneyDue-Flow has the answer, the panel shows the new email
      if (lost(r)) return;
      if (r.ok) { set({ submit: { status: 'done', result: r.value } }); return; }
      // The person changed under the form: look at the email again, and the panel shows the real reason in place of the form.
      if (r.failure.code === 'not_eligible' || r.failure.code === 'already_in_flow') { void load(); return; }
      set({ submit: { status: 'failed', failure: r.failure } });
      // The flow changed under the form: ask for the list again and let the user choose another.
      if (r.failure.code === 'cadence_off' || r.failure.code === 'not_found') { set({ options: { status: 'idle' }, choice: null, schedule: null }); void loadOptions(); }
    },

    /** After a failure the user may try the same thing again. */
    retry(): Promise<void> {
      if (state.submit.status !== 'failed') return Promise.resolve();
      set({ submit: { status: 'idle' } });
      return this.submit();
    },

    /** After success: look at the email again, so the person shows as already in the flow. */
    done(): void { void load(); },
  };
}
export type Session = ReturnType<typeof createSession>;
