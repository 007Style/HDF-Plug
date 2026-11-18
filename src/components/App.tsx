import React, { useEffect, useState } from 'react';
import type { Panel, PanelState } from '../state/panel';
import type { Session } from '../state/session';
import { TEXTS } from '../texts';
import { Button, Card } from './ui';
import { Connected } from './Connected';

const DOWNLOAD_URL = 'https://github.com/007Style/honeyDue-Flow/releases';

export const App: React.FC<{ panel: Panel; session?: Session }> = ({ panel, session }) => {
  const [state, setState] = useState<PanelState>(panel.get());

  useEffect(() => {
    const off = panel.subscribe(setState);
    void panel.refresh();
    return off;
  }, [panel]);

  return (
    <main className="p-3 max-w-xl mx-auto space-y-3">
      <header className="flex items-center gap-2" data-testid="panel-header">
        <img src={`${import.meta.env.BASE_URL}assets/bee-80.png`} alt="" width={28} height={28} className="rounded-md" />
        <span className="text-sm font-semibold text-gray-700">{TEXTS.title}</span>
      </header>
      <View state={state} panel={panel} session={session} />
    </main>
  );
};

const View: React.FC<{ state: PanelState; panel: Panel; session?: Session }> = ({ state, panel, session }) => {
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
      return session ? <Connected session={session} panel={panel} appVersion={state.appVersion} /> : null;
  }
};
