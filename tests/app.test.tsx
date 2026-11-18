import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/components/App';
import type { Panel, PanelState } from '../src/state/panel';
import { TEXTS } from '../src/texts';

/** A panel that sits in one state, and records what the buttons call. */
function fakePanel(state: PanelState) {
  const calls: string[] = [];
  const panel = {
    get: () => state,
    subscribe: () => () => {},
    refresh: vi.fn(async () => { calls.push('refresh'); }),
    connect: vi.fn(async () => { calls.push('connect'); }),
    cancel: vi.fn(() => { calls.push('cancel'); }),
    disconnect: vi.fn(async () => { calls.push('disconnect'); }),
  } as unknown as Panel;
  return { panel, calls };
}

describe('PLG-U: what the panel shows', () => {
  it('PLG-U01 not detected: says so, and Try again looks again', async () => {
    const { panel } = fakePanel({ kind: 'not-detected' });
    render(<App panel={panel} />);
    expect(screen.getByRole('alert', { name: TEXTS.notDetectedTitle })).toBeInTheDocument();
    expect(screen.getByText(TEXTS.notDetected)).toBeInTheDocument();
    (panel.refresh as any).mockClear();
    await userEvent.click(screen.getByRole('button', { name: TEXTS.tryAgain }));
    expect(panel.refresh).toHaveBeenCalledTimes(1);
  });

  it('PLG-U02 not detected: offers the download link, opening in a new tab', () => {
    render(<App panel={fakePanel({ kind: 'not-detected' }).panel} />);
    const a = screen.getByRole('link', { name: TEXTS.download });
    expect(a).toHaveAttribute('href', 'https://github.com/007Style/honeyDue-Flow/releases');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  it.each([
    ['hdf-too-old', TEXTS.hdfTooOld],
    ['add-in-too-old', TEXTS.addInTooOld],
    ['switched-off', TEXTS.switchedOff],
    ['not-signed-in', TEXTS.notSignedIn],
  ] as const)('PLG-U03 %s shows its words', (kind, words) => {
    render(<App panel={fakePanel({ kind } as PanelState).panel} />);
    expect(screen.getByText(words)).toBeInTheDocument();
  });

  it('PLG-U04 connect: the button asks to connect', async () => {
    const { panel } = fakePanel({ kind: 'not-connected', notice: '' });
    render(<App panel={panel} />);
    await userEvent.click(screen.getByRole('button', { name: TEXTS.connect }));
    expect(panel.connect).toHaveBeenCalledTimes(1);
  });

  it('PLG-U05 connect with a notice: the notice is announced and the button says Try again', () => {
    render(<App panel={fakePanel({ kind: 'not-connected', notice: TEXTS.connectDenied }).panel} />);
    expect(screen.getByRole('alert')).toHaveTextContent(TEXTS.connectDenied);
    expect(screen.getByRole('button', { name: TEXTS.tryAgain })).toBeInTheDocument();
  });

  it('PLG-U06 waiting: tells the user to click Allow in HoneyDue-Flow, and Cancel cancels', async () => {
    const { panel } = fakePanel({ kind: 'waiting-for-allow' });
    render(<App panel={panel} />);
    expect(screen.getByText(TEXTS.waitingForAllow)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TEXTS.cancel }));
    expect(panel.cancel).toHaveBeenCalledTimes(1);
  });

  it('PLG-U07 connected: shows the version and Disconnect disconnects', async () => {
    const { panel } = fakePanel({ kind: 'connected', appVersion: '1.2.0' });
    render(<App panel={panel} />);
    expect(screen.getByText('HoneyDue-Flow 1.2.0')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TEXTS.disconnect }));
    expect(panel.disconnect).toHaveBeenCalledTimes(1);
  });

  it('PLG-U08 checking: a short status message and no buttons', () => {
    render(<App panel={fakePanel({ kind: 'checking' }).panel} />);
    expect(screen.getByRole('status')).toHaveTextContent(TEXTS.checking);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('PLG-U09 the panel starts by looking for HoneyDue-Flow once', () => {
    const { panel } = fakePanel({ kind: 'checking' });
    render(<App panel={panel} />);
    expect(panel.refresh).toHaveBeenCalledTimes(1);
  });
});
