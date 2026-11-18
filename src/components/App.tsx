import React, { useEffect, useState } from 'react';
import type { Panel, PanelState } from '../state/panel';
import { TEXTS } from '../texts';

const DOWNLOAD_URL = 'https://github.com/007Style/honeyDue-Flow/releases';

const Card: React.FC<{ title: string; children: React.ReactNode; role?: 'status' | 'alert' }> = ({ title, children, role }) => (
  <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3" role={role} aria-label={title}>
    <h1 className="text-base font-semibold">{title}</h1>
    {children}
  </section>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }> = ({ primary, className, ...rest }) => (
  <button
    {...rest}
    className={`rounded-md px-3 py-1.5 text-sm font-medium border ${
      primary ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'
    } disabled:opacity-60 ${className ?? ''}`}
  />
);

export const App: React.FC<{ panel: Panel }> = ({ panel }) => {
  const [state, setState] = useState<PanelState>(panel.get());

  useEffect(() => {
    const off = panel.subscribe(setState);
    void panel.refresh();
    return off;
  }, [panel]);

  return (
    <main className="p-3 max-w-xl mx-auto">
      <View state={state} panel={panel} />
    </main>
  );
};

const View: React.FC<{ state: PanelState; panel: Panel }> = ({ state, panel }) => {
  switch (state.kind) {
    case 'checking':
      return <p role="status" className="text-gray-600">{TEXTS.checking}</p>;

    case 'not-detected':
      return (
        <Card title={TEXTS.notDetectedTitle} role="alert">
          <p>{TEXTS.notDetected}</p>
          <p className="text-gray-600">{TEXTS.notDetectedSetup}</p>
          <div className="flex gap-2">
            <Button primary onClick={() => void panel.refresh()}>{TEXTS.tryAgain}</Button>
            <a className="rounded-md px-3 py-1.5 text-sm font-medium border bg-white border-gray-300 text-gray-800 hover:bg-gray-100" href={DOWNLOAD_URL} target="_blank" rel="noreferrer">
              {TEXTS.download}
            </a>
          </div>
        </Card>
      );

    case 'hdf-too-old':
      return <Card title={TEXTS.title} role="alert"><p>{TEXTS.hdfTooOld}</p><Button onClick={() => void panel.refresh()}>{TEXTS.tryAgain}</Button></Card>;

    case 'add-in-too-old':
      return <Card title={TEXTS.title} role="alert"><p>{TEXTS.addInTooOld}</p></Card>;

    case 'switched-off':
      return <Card title={TEXTS.title} role="alert"><p>{TEXTS.switchedOff}</p><Button onClick={() => void panel.refresh()}>{TEXTS.tryAgain}</Button></Card>;

    case 'not-signed-in':
      return <Card title={TEXTS.title} role="alert"><p>{TEXTS.notSignedIn}</p><Button onClick={() => void panel.refresh()}>{TEXTS.tryAgain}</Button></Card>;

    case 'not-connected':
      return (
        <Card title={TEXTS.notConnectedTitle}>
          <p>{TEXTS.notConnected}</p>
          {state.notice && <p role="alert" className="text-red-700">{state.notice}</p>}
          <Button primary onClick={() => void panel.connect()}>{state.notice ? TEXTS.tryAgain : TEXTS.connect}</Button>
        </Card>
      );

    case 'waiting-for-allow':
      return (
        <Card title={TEXTS.notConnectedTitle} role="status">
          <p>{TEXTS.waitingForAllow}</p>
          <Button onClick={() => panel.cancel()}>{TEXTS.cancel}</Button>
        </Card>
      );

    case 'connected':
      return (
        <Card title={TEXTS.connectedTitle} role="status">
          <p>{TEXTS.connected}</p>
          <p className="text-xs text-gray-500">HoneyDue-Flow {state.appVersion}</p>
          <Button onClick={() => void panel.disconnect()}>{TEXTS.disconnect}</Button>
        </Card>
      );
  }
};
