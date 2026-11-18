import React, { useEffect, useState } from 'react';
import type { Panel } from '../state/panel';
import type { PersonCheck, Session, SessionState } from '../state/session';
import { keyOf } from '../state/session';
import type { DataFailure, Eligibility } from '../bridge/types';
import type { Person } from '../office/people';
import { formatWhen } from '../state/when';
import { TEXTS } from '../texts';
import { Button, Card } from './ui';
import { FlowForm } from './FlowForm';

/** The words for a failed call: HoneyDue-Flow's own plain words, except where this add-in has better ones. */
export function failureText(f: DataFailure): string {
  if (f.code === 'app_busy') return TEXTS.appBusy;
  if (f.code === 'rate_limited') return TEXTS.tooMany;
  if (f.code === 'contacts_unavailable') return TEXTS.contactsUnavailable;
  return f.message || TEXTS.somethingWrong;
}

/** Why a person cannot go into a flow, in words. */
export function reasonText(person: Person, e: Eligibility): string {
  switch (e.result) {
    case 'not_in_contacts': return TEXTS.notInContacts(person.email);
    case 'missing_fields': return TEXTS.missingFields(e.missing.join(', '));
    case 'already_in_flow': return e.flow?.cadenceName ? TEXTS.alreadyInFlowNamed(e.contact.displayName || person.name || person.email, e.flow.cadenceName) : TEXTS.alreadyInFlow(e.contact.displayName || person.name || person.email);
    case 'eligible': return '';
  }
}

const label = (p: Person) => (p.name ? `${p.name} <${p.email}>` : p.email);

function shortStatus(c: PersonCheck | undefined): string {
  if (!c || c.status === 'checking') return TEXTS.checkingPerson;
  if (c.status === 'error') return TEXTS.somethingWrong;
  return c.eligibility.result === 'eligible' ? TEXTS.personOk : TEXTS.personNotOk;
}

export const Connected: React.FC<{ session: Session; panel: Panel; appVersion: string }> = ({ session, panel, appVersion }) => {
  const [s, setS] = useState<SessionState>(session.get());
  useEffect(() => {
    const off = session.subscribe(setS);
    session.start();
    return () => { off(); session.stop(); };
  }, [session]);

  return (
    <div className="space-y-3">
      <Body s={s} session={session} />
      <footer className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
        <span>{TEXTS.connectedFooter(appVersion)}</span>
        <Button onClick={() => void panel.disconnect()}>{TEXTS.disconnect}</Button>
      </footer>
    </div>
  );
};

const Body: React.FC<{ s: SessionState; session: Session }> = ({ s, session }) => {
  const item = s.item;
  if (item.kind === 'loading') return <p role="status" className="text-gray-600">{TEXTS.loadingEmail}</p>;
  if (item.kind === 'none') return <p role="status" className="text-gray-700">{TEXTS.noPerson}</p>;
  if (item.kind === 'not-email') return <p role="status" className="text-gray-700">{TEXTS.notEmail}</p>;
  if (item.kind === 'compose-none' || item.kind === 'compose-many') {
    return (
      <div className="space-y-2" role="status">
        <p className="text-gray-700">{item.kind === 'compose-none' ? TEXTS.composeNone : TEXTS.composeMany(item.count)}</p>
        <Button onClick={() => void session.reload()}>{TEXTS.checkAgain}</Button>
      </div>
    );
  }

  const person = item.people.find((p) => keyOf(p.email) === keyOf(s.selected ?? '')) ?? item.people[0];
  const check = s.checks[keyOf(person.email)];

  return (
    <div className="space-y-3">
      {item.people.length > 1 && (
        <fieldset className="space-y-1" disabled={s.submit.status === 'submitting'}>
          <legend className="text-sm font-semibold mb-1">{TEXTS.personHeading}</legend>
          {item.people.map((p) => (
            <label key={p.email} className="flex items-start gap-2 text-sm">
              <input type="radio" name="person" className="mt-1" checked={keyOf(p.email) === keyOf(person.email)} onChange={() => session.select(p.email)} />
              <span>
                <span className="block">{label(p)}</span>
                <span className="block text-xs text-gray-500">{shortStatus(s.checks[keyOf(p.email)])}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <p className="text-xs text-gray-500" data-testid="read-from">
        {item.direction === 'composing' ? TEXTS.readFromTo(person.email) : item.direction === 'sent' ? TEXTS.readFromSent(person.email) : TEXTS.readFromReceived(person.email)}
      </p>
      <Person_ s={s} session={session} person={person} check={check} />
    </div>
  );
};

const Person_: React.FC<{ s: SessionState; session: Session; person: Person; check: PersonCheck | undefined }> = ({ s, session, person, check }) => {
  const who = person.name || person.email;
  if (!check || check.status === 'checking') return <p role="status" className="text-gray-600">{TEXTS.checkingPerson}</p>;

  if (check.status === 'error') {
    return (
      <Card title={TEXTS.failedTitle} role="alert">
        <p>{failureText(check.failure)}</p>
        <Button primary onClick={() => void session.reload()}>{TEXTS.tryAgain}</Button>
      </Card>
    );
  }

  const e = check.eligibility;
  if (e.result !== 'eligible') {
    const name = ('contact' in e && e.contact?.displayName) || who;
    return (
      <Card title={TEXTS.cannotTitle(name)} role="alert">
        <p>{reasonText(person, e)}</p>
        {s.submit.status === 'failed' && s.submit.failure.code === 'not_eligible' && <p className="text-red-700">{s.submit.failure.message}</p>}
        <Button onClick={() => void session.reload()}>{TEXTS.checkAgain}</Button>
      </Card>
    );
  }

  if (s.submit.status === 'done') {
    const r = s.submit.result;
    return (
      <Card title={TEXTS.successTitle} role="status">
        <p>{TEXTS.success(r.contact.displayName || who, r.flow.name, formatWhen(r.firstStepAt))}</p>
        {r.calendarNote && <p role="alert" className="text-amber-800">{TEXTS.calendarWarning(r.calendarNote)}</p>}
        <Button primary onClick={() => session.done()}>{TEXTS.done}</Button>
      </Card>
    );
  }

  return <FlowForm s={s} session={session} person={person} eligible={e} />;
};
