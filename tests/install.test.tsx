import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Install, manifestAddress } from '../src/components/Install';
import { TEXTS } from '../src/texts';

const PAGE = 'https://007style.github.io/HDF-Plug/';

describe('PLG-I installing from the page', () => {
  it('PLG-I01 the manifest address is worked out from the page address, wherever the page is', () => {
    expect(manifestAddress(PAGE)).toBe('https://007style.github.io/HDF-Plug/manifest.xml');
    expect(manifestAddress('https://007style.github.io/HDF-Plug/index.html?x=1#y')).toBe('https://007style.github.io/HDF-Plug/manifest.xml');
    expect(manifestAddress('https://example.com/addin/')).toBe('https://example.com/addin/manifest.xml');
  });

  it('PLG-I02 shows the address, the Outlook add-in link and every step, with no download needed', () => {
    render(<Install pageUrl={PAGE} />);
    expect(screen.getByLabelText(TEXTS.installAddressLabel)).toHaveValue('https://007style.github.io/HDF-Plug/manifest.xml');
    expect(screen.getByRole('link', { name: TEXTS.installOpenOutlook })).toHaveAttribute('href', 'https://aka.ms/olksideload');
    for (const step of TEXTS.installSteps) expect(screen.getByText(step)).toBeInTheDocument();
    expect(screen.getByText(TEXTS.installNeeds)).toBeInTheDocument();
    expect(document.querySelector('section img')).toHaveAttribute('src', 'https://007style.github.io/HDF-Plug/assets/bee-80.png');
  });

  it('PLG-I03 Copy address copies exactly the address and says so', async () => {
    const copy = vi.fn(async () => {});
    render(<Install pageUrl={PAGE} copy={copy} />);
    await userEvent.click(screen.getByRole('button', { name: TEXTS.installCopy }));
    expect(copy).toHaveBeenCalledWith('https://007style.github.io/HDF-Plug/manifest.xml');
    expect(await screen.findByRole('status')).toHaveTextContent(TEXTS.installCopied);
  });

  it('PLG-I04 a copy that is refused says so and leaves the address selectable', async () => {
    render(<Install pageUrl={PAGE} copy={async () => { throw new Error('denied'); }} />);
    await userEvent.click(screen.getByRole('button', { name: TEXTS.installCopy }));
    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTS.installCopyFailed);
    expect(screen.getByLabelText(TEXTS.installAddressLabel)).toHaveValue('https://007style.github.io/HDF-Plug/manifest.xml');
  });

  it('PLG-I06 the classic Outlook steps are behind a button, shown when pressed, hidden when pressed again, and say they are untried', async () => {
    render(<Install pageUrl={PAGE} />);
    const button = screen.getByRole('button', { name: TEXTS.installClassicButton });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(TEXTS.installClassicSteps[0])).toBeNull();
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    for (const step of TEXTS.installClassicSteps) expect(screen.getByText(step)).toBeInTheDocument();
    expect(screen.getByText(TEXTS.installClassicNote)).toBeInTheDocument();
    await userEvent.click(button);
    expect(screen.queryByText(TEXTS.installClassicSteps[0])).toBeNull();
  });

  it('PLG-I05 the file is still offered, for an Outlook that has no Add from URL', () => {
    render(<Install pageUrl={PAGE} />);
    const a = screen.getByRole('link', { name: TEXTS.installFile });
    expect(a).toHaveAttribute('href', 'https://007style.github.io/HDF-Plug/manifest.xml');
    expect(a).toHaveAttribute('download', 'manifest.xml');
  });
});
