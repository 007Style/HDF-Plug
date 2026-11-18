import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

// The generator runs as a real process, writing to a temporary file, so the real manifest is never touched.
let work = '';
let xml = '';
const BASE = 'https://example.github.io/Thing';
beforeAll(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'hdfplug-man-'));
  const out = path.join(work, 'm.xml');
  execFileSync('node', ['tools/make-manifest.mjs', `${BASE}/`, out], { stdio: 'ignore' });
  xml = fs.readFileSync(out, 'utf8');
});
afterAll(() => fs.rmSync(work, { recursive: true, force: true }));

describe('PLG-M: the manifest', () => {
  it('PLG-M01 is well-formed XML (every tag closes)', () => {
    const stack: string[] = [];
    for (const m of xml.matchAll(/<(\/?)([A-Za-z:]+)([^>]*?)(\/?)>/g)) {
      if (m[0].startsWith('<?')) continue;
      if (m[4] === '/') continue;
      if (m[1] === '/') expect(stack.pop()).toBe(m[2]);
      else stack.push(m[2]);
    }
    expect(stack).toEqual([]);
  });

  it('PLG-M02 keeps the fixed add-in id', () => {
    expect(xml).toContain('<Id>e8de068a-410a-4cf7-8080-08ff73e4f3f4</Id>');
  });

  it('PLG-M03 uses the version 1.0.0.0', () => {
    expect(xml).toContain('<Version>1.0.0.0</Version>');
  });

  it('PLG-M04 asks only to read the item', () => {
    expect(xml).toContain('<Permissions>ReadItem</Permissions>');
    expect(xml).not.toMatch(/ReadWriteItem|ReadWriteMailbox/);
  });

  it('PLG-M05 every address starts with the base address given, and the trailing slash is dropped', () => {
    const urls = [...xml.matchAll(/DefaultValue="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !u.includes('github.com/007Style'));
    expect(urls.length).toBeGreaterThanOrEqual(8);
    for (const u of urls) expect(u.startsWith(`${BASE}/`), u).toBe(true);
    expect(xml).not.toContain(`${BASE}//`);
  });

  it('PLG-M06 lists only the page origin as an app domain', () => {
    expect(xml).toContain('<AppDomain>https://example.github.io</AppDomain>');
    expect(xml.match(/<AppDomain>/g)).toHaveLength(1);
  });

  it('PLG-M07 pinning is offered in the 1.1 overrides only', () => {
    expect(xml.match(/<SupportsPinning>true<\/SupportsPinning>/g)).toHaveLength(2); // one per button
    expect(xml.indexOf('SupportsPinning')).toBeGreaterThan(xml.indexOf('mailappversionoverrides/1.1'));
  });

  it('PLG-M08 the button shows when reading an email and when writing one, in both override sets', () => {
    expect(xml.match(/MessageReadCommandSurface/g)).toHaveLength(2);
    expect(xml.match(/MessageComposeCommandSurface/g)).toHaveLength(2);
  });

  it('PLG-M11 the two buttons have different ids, and the same panel opens from both', () => {
    expect(xml).toContain('id="hdfButton"');
    expect(xml).toContain('id="hdfComposeButton"');
    expect(xml).toContain('id="hdfGroup"');
    expect(xml).toContain('id="hdfComposeGroup"');
    expect(xml.match(/<SourceLocation resid="Taskpane.Url"\/>/g)).toHaveLength(4);
  });

  it('PLG-M12 the button uses the HoneyDue-Flow icon files', () => {
    for (const n of [16, 32, 80]) {
      const png = fs.readFileSync(`public/assets/bee-${n}.png`);
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(png.readUInt32BE(16)).toBe(n);
      expect(png.readUInt32BE(20)).toBe(n);
    }
  });

  it('PLG-M09 every resource id that is used is defined', () => {
    const used = new Set([...xml.matchAll(/resid="([^"]+)"/g)].map((m) => m[1]));
    const defined = new Set([...xml.matchAll(/<bt:(?:Image|Url|String) id="([^"]+)"/g)].map((m) => m[1]));
    for (const id of used) expect(defined.has(id), id).toBe(true);
  });

  it('PLG-M10 refuses to write a manifest for an address that is not a URL', () => {
    expect(() => execFileSync('node', ['tools/make-manifest.mjs', 'not a url', path.join(work, 'x.xml')], { stdio: 'ignore' })).toThrow();
  });
});
