import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './components/App';
import { Install } from './components/Install';
import { onItemChanged, readItemPeople, whenOfficeReady } from './office/host';
import { createBridgeClient } from './bridge/client';
import { clientNameFor, createPanel } from './state/panel';
import { createSession } from './state/session';
import { TEXTS } from './texts';

whenOfficeReady().then((platform) => {
  // Opened in a browser (not inside Outlook): show how to install it. "?panel" shows the panel anyway, for development.
  if (!platform && !new URLSearchParams(window.location.search).has('panel')) {
    createRoot(document.getElementById('root')!).render(<main className="p-3 max-w-xl mx-auto"><Install /></main>);
    return;
  }
  const client = createBridgeClient({ storage: window.localStorage });
  const panel = createPanel({ client, clientName: clientNameFor(platform), texts: TEXTS });
  const session = createSession({ client, readPeople: readItemPeople, watchItem: onItemChanged, onLost: () => void panel.refresh() });
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App panel={panel} session={session} />
    </React.StrictMode>
  );
});
