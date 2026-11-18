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

  const onCopy = async () => {
    try { await copy(address); setCopied('yes'); } catch { setCopied('failed'); }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4" aria-label={TEXTS.installTitle}>
      <h1 className="text-lg font-semibold">{TEXTS.installTitle}</h1>
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
    </section>
  );
};
