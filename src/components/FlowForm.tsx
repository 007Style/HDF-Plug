import React, { useState } from 'react';
import type { Session, SessionState } from '../state/session';
import type { CadenceOption, Channel, Eligibility, FlowChoice, TemplateOption } from '../bridge/types';
import type { Person } from '../office/people';
import { formatWhen, fromLocalParts } from '../state/when';
import { TEXTS } from '../texts';
import { Button } from './ui';
import { failureText } from './Connected';

const CHANNEL_WORD: Record<Channel, string> = { email: TEXTS.channelEmail, call: TEXTS.channelCall, linkedin: TEXTS.channelLinkedin };
const FIRST_WORD: Record<Channel, string> = { email: TEXTS.firstEmail, call: TEXTS.firstCall, linkedin: TEXTS.firstLinkedin };

const sameChoice = (a: FlowChoice | null, b: FlowChoice): boolean =>
  !!a && a.kind === b.kind && (a.kind === 'cadence' ? a.cadenceId === (b as typeof a).cadenceId : a.channel === (b as typeof a).channel && a.templateId === (b as typeof a).templateId);

export const FlowForm: React.FC<{ s: SessionState; session: Session; person: Person; eligible: Extract<Eligibility, { result: 'eligible' }> }> = ({ s, session, person, eligible }) => {
  const [query, setQuery] = useState('');
  const busy = s.submit.status === 'submitting';
  const goesElsewhere = eligible.contact.email.toLowerCase() !== person.email.toLowerCase();
  const when = fromLocalParts(s.date, s.time);

  return (
    <form className="space-y-3" onSubmit={(ev) => { ev.preventDefault(); void session.submit(); }}>
      <p className="text-sm">
        <span className="font-semibold">{eligible.contact.displayName}</span>
        {eligible.contact.company && <span className="text-gray-600">, {eligible.contact.company}</span>}
      </p>
      {goesElsewhere && <p className="text-sm text-gray-700">{TEXTS.emailsGoTo(eligible.contact.email)}</p>}

      <fieldset className="space-y-2" disabled={busy}>
        <legend className="text-sm font-semibold mb-1">{TEXTS.flowHeading}</legend>
        <FlowList s={s} session={session} query={query} setQuery={setQuery} />
      </fieldset>

      <fieldset className="space-y-2" disabled={busy}>
        <legend className="text-sm font-semibold mb-1">{TEXTS.startHeading}</legend>
        <div className="flex gap-2">
          <input aria-label={TEXTS.dateLabel} type="date" required value={s.date} onChange={(e) => session.setWhen(e.target.value, s.time)} className="border border-gray-300 rounded-md px-2 py-1 text-sm" />
          <input aria-label={TEXTS.timeLabel} type="time" required value={s.time} onChange={(e) => session.setWhen(s.date, e.target.value)} className="border border-gray-300 rounded-md px-2 py-1 text-sm" />
        </div>
        {!when && <p role="alert" className="text-sm text-red-700">{TEXTS.badTime}</p>}
        {s.schedule?.inPast && <p role="status" className="text-sm text-amber-800">{TEXTS.inPast}</p>}
        {s.schedule?.held && <p role="status" className="text-sm text-amber-800">{TEXTS.held(s.schedule.reason ?? '', s.schedule.nextAllowed ? formatWhen(s.schedule.nextAllowed) : '')}</p>}
      </fieldset>

      {s.submit.status === 'failed' && (
        <p role="alert" className="text-sm text-red-700">{failureText(s.submit.failure)}</p>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="submit" primary disabled={!session.canSubmit()}>{busy ? TEXTS.submitting : s.submit.status === 'failed' ? TEXTS.tryAgain : TEXTS.ok}</Button>
      </div>
      {!s.choice && s.options.status === 'ready' && <p className="text-xs text-gray-500 text-right">{TEXTS.pickFlow}</p>}
    </form>
  );
};

const FlowList: React.FC<{ s: SessionState; session: Session; query: string; setQuery: (q: string) => void }> = ({ s, session, query, setQuery }) => {
  const o = s.options;
  if (o.status === 'idle' || o.status === 'loading') return <p role="status" className="text-sm text-gray-600">{TEXTS.loadingFlows}</p>;
  if (o.status === 'error') {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-sm text-red-700">{TEXTS.flowsFailed} {failureText(o.failure)}</p>
        <Button onClick={() => session.retryOptions()}>{TEXTS.tryAgain}</Button>
      </div>
    );
  }
  const { cadences, templates, noScriptCall } = o.value;
  if (!cadences.length && !templates.length && !noScriptCall) return <p role="status" className="text-sm text-gray-700">{TEXTS.noFlows}</p>;

  const q = query.trim().toLowerCase();
  const hit = (...parts: string[]) => !q || parts.some((p) => p.toLowerCase().includes(q));
  const cads = cadences.filter((c) => hit(c.name));
  const tpls = templates.filter((t) => hit(t.name, CHANNEL_WORD[t.channel]));
  const showNoScript = noScriptCall && hit(TEXTS.noScriptCall);
  const none = !cads.length && !tpls.length && !showNoScript;

  return (
    <div className="space-y-2">
      <input
        type="search" aria-label={TEXTS.searchLabel} placeholder={TEXTS.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
      />
      <div role="radiogroup" aria-label={TEXTS.flowHeading} className="max-h-64 overflow-auto space-y-3">
        {none && <p className="text-sm text-gray-600">{TEXTS.noMatches}</p>}
        {cads.length > 0 && (
          <div className="space-y-1">
            <h2 className="text-xs font-semibold uppercase text-gray-500">{TEXTS.multiStep}</h2>
            {cads.map((c) => <CadenceRow key={c.id} c={c} s={s} session={session} />)}
          </div>
        )}
        {(tpls.length > 0 || showNoScript) && (
          <div className="space-y-1">
            <h2 className="text-xs font-semibold uppercase text-gray-500">{TEXTS.singleStep}</h2>
            {tpls.map((t) => <TemplateRow key={t.id} t={t} s={s} session={session} />)}
            {showNoScript && <Row name={TEXTS.noScriptCall} choice={{ kind: 'template', channel: 'call' }} s={s} session={session} />}
          </div>
        )}
      </div>
    </div>
  );
};

const Row: React.FC<{ name: string; detail?: string; choice: FlowChoice; s: SessionState; session: Session; off?: string }> = ({ name, detail, choice, s, session, off }) => {
  const selected = sameChoice(s.choice, choice);
  return (
    <label className={`flex items-start gap-2 text-sm rounded-md px-2 py-1 ${selected ? 'bg-blue-50' : ''} ${off ? 'text-gray-400' : ''}`} title={off}>
      <input type="radio" name="flow" className="mt-1" disabled={!!off} checked={selected} onChange={() => session.choose(choice)} />
      <span>
        <span className="block">{name}</span>
        {detail && <span className="block text-xs text-gray-500">{detail}</span>}
        {off && <span className="block text-xs text-gray-500">{TEXTS.switchedOffFlow}: {off}</span>}
      </span>
    </label>
  );
};

const CadenceRow: React.FC<{ c: CadenceOption; s: SessionState; session: Session }> = ({ c, s, session }) => (
  <Row name={c.name} detail={TEXTS.stepsOf(c.stepCount, FIRST_WORD[c.firstChannel])} choice={{ kind: 'cadence', cadenceId: c.id }} s={s} session={session} off={c.active ? undefined : c.inactiveReason || TEXTS.switchedOffFlow} />
);

const TemplateRow: React.FC<{ t: TemplateOption; s: SessionState; session: Session }> = ({ t, s, session }) => (
  <Row name={`${CHANNEL_WORD[t.channel]}: ${t.name}`} choice={{ kind: 'template', channel: t.channel, templateId: t.id }} s={s} session={session} />
);
