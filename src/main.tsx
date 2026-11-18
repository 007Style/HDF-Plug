import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './components/App';
import { onItemChanged, readItemPeople, whenOfficeReady } from './office/host';
import { createBridgeClient } from './bridge/client';
import { clientNameFor, createPanel } from './state/panel';
import { createSession } from './state/session';
import { TEXTS } from './texts';

whenOfficeReady().then((platform) => {
  const client = createBridgeClient({ storage: window.localStorage });
  const panel = createPanel({ client, clientName: clientNameFor(platform), texts: TEXTS });
  const session = createSession({ client, readPeople: readItemPeople, watchItem: onItemChanged, onLost: () => void panel.refresh() });
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App panel={panel} session={session} />
    </React.StrictMode>
  );
});
