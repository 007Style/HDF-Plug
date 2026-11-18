import React, { useState } from 'react';
import { TEXTS } from '../texts';
import { Button } from './ui';

const SIDELOAD_URL = 'https://aka.ms/olksideload';

/** Where the manifest is, next to this page. Worked out from the page's own address, so it is right wherever the page is hosted. */
export function manifestAddress(pageUrl: string): string {
  return new URL('manifest.xml', pageUrl).toString();
}

/** Shown when the page is opened in a browser instead of inside Outlook. */
export const Install: React.FC<{ pageUrl?: string; copy?: (text: string) => Promise<void> }> = ({
  pageUrl = window.location.href,
  copy = (t) => navigator.clipboard.writeText(t),
}) => {
  const address = manifestAddress(pageUrl);
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const [classic, setClassic] = useState(false);

  const onCopy = async () => {
    try { await copy(address); setCopied('yes'); } catch { setCopied('failed'); }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4" aria-label={TEXTS.installTitle}>
      <div className="flex items-center gap-3">
        <img src={new URL('assets/bee-80.png', pageUrl).toString()} alt="" width={40} height={40} className="rounded-lg" />
        <h1 className="text-lg font-semibold">{TEXTS.installTitle}</h1>
      </div>
      <p>{TEXTS.installIntro}</p>

      <div className="space-y-1">
        <label htmlFor="manifest-address" className="text-sm font-semibold">{TEXTS.installAddressLabel}</label>
        <div className="flex gap-2">
          <input id="manifest-address" readOnly value={address} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 border border-gray-300 rounded-md px-2 py-1 text-sm font-mono bg-white" />
          <Button primary onClick={() => void onCopy()}>{TEXTS.installCopy}</Button>
        </div>
        {copied === 'yes' && <p role="status" className="text-sm text-green-700">{TEXTS.installCopied}</p>}
        {copied === 'failed' && <p role="alert" className="text-sm text-red-700">{TEXTS.installCopyFailed}</p>}
      </div>

      <p>
        <a className="text-blue-700 underline" href={SIDELOAD_URL} target="_blank" rel="noreferrer">{TEXTS.installOpenOutlook}</a>
      </p>

      <ol className="list-decimal pl-5 space-y-1">
        {TEXTS.installSteps.map((step) => <li key={step}>{step}</li>)}
      </ol>

      <p className="text-sm text-gray-700">
        {TEXTS.installFallback}{' '}
        <a className="text-blue-700 underline" href={address} download="manifest.xml">{TEXTS.installFile}</a>
      </p>
      <p className="text-sm text-gray-700">{TEXTS.installNeeds}</p>

      <div className="space-y-2">
        <Button aria-expanded={classic} aria-controls="classic-steps" onClick={() => setClassic((v) => !v)}>{TEXTS.installClassicButton}</Button>
        {classic && (
          <div id="classic-steps" className="rounded-md border border-gray-200 bg-white p-3 space-y-2" role="region" aria-label={TEXTS.installClassicTitle}>
            <h2 className="text-sm font-semibold">{TEXTS.installClassicTitle}</h2>
            <p className="text-sm text-amber-800">{TEXTS.installClassicNote}</p>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              {TEXTS.installClassicSteps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
};
