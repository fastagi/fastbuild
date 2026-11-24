import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'src');
const originalDevtoolsFlag = process.env.NEXT_PUBLIC_DEVTOOLS_ENABLED;

function readSource(path: string): string {
  return readFileSync(resolve(sourceRoot, path), 'utf8');
}

async function loadDevtoolsConfig(nodeEnv: string, flag?: string) {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', nodeEnv);
  if (flag === undefined) {
    delete process.env.NEXT_PUBLIC_DEVTOOLS_ENABLED;
  } else {
    process.env.NEXT_PUBLIC_DEVTOOLS_ENABLED = flag;
  }

  return import('@/config/devtools');
}

describe('devtools production configuration', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    if (originalDevtoolsFlag === undefined) {
      delete process.env.NEXT_PUBLIC_DEVTOOLS_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_DEVTOOLS_ENABLED = originalDevtoolsFlag;
    }
  });

  it('disables devtools in production by default', async () => {
    const config = await loadDevtoolsConfig('production');

    expect(config.isDevtoolsEnabled()).toBe(false);
  });

  it('keeps devtools disabled when production sets the flag off', async () => {
    const config = await loadDevtoolsConfig('production', 'false');

    expect(config.isDevtoolsEnabled()).toBe(false);
  });

  it('enables devtools in production only with an explicit opt-in', async () => {
    const config = await loadDevtoolsConfig('production', 'true');

    expect(config.isDevtoolsEnabled()).toBe(true);
  });

  it('enables devtools outside production by default', async () => {
    expect((await loadDevtoolsConfig('development')).isDevtoolsEnabled()).toBe(true);
    expect((await loadDevtoolsConfig('test')).isDevtoolsEnabled()).toBe(true);
  });

  it('rejects an unrecognized flag value', async () => {
    await expect(loadDevtoolsConfig('production', 'maybe')).rejects.toThrow(
      'Invalid public environment variable: NEXT_PUBLIC_DEVTOOLS_ENABLED'
    );
  });

  it('matches every devtools route and its descendants', async () => {
    const config = await loadDevtoolsConfig('production');

    expect(config.isDevtoolsPath('/styleguide')).toBe(true);
    expect(config.isDevtoolsPath('/styleguide/buttons')).toBe(true);
    expect(config.isDevtoolsPath('/i18n-test')).toBe(true);
    expect(config.isDevtoolsPath('/styleguides')).toBe(false);
    expect(config.isDevtoolsPath('/console')).toBe(false);
  });
});

describe('devtools route gate', () => {
  it('returns 404 from the devtools route group layout when disabled', () => {
    const layout = readSource('app/(protected)/(devtools)/layout.tsx');

    expect(layout).toContain("from 'next/navigation'");
    expect(layout).toMatch(/if \(!isDevtoolsEnabled\(\)\) \{\s*notFound\(\);/);
  });

  it('rewrites disabled devtools paths to 404 in the proxy before auth handling', () => {
    const proxy = readSource('proxy.ts');

    const gate = proxy.indexOf('!isDevtoolsEnabled() && isDevtoolsPath(pathname)');

    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(proxy.indexOf("getAuthRuntimeMode() !== 'mock-session'"));
    expect(proxy).toContain('NextResponse.rewrite(new URL(DEVTOOLS_DISABLED_PATH');
  });

  it('hides console links to devtools when disabled', () => {
    const consoleLayout = readSource('app/(protected)/(console)/console/layout.tsx');
    const consoleHome = readSource('app/(protected)/(console)/console/page.tsx');

    for (const source of [consoleLayout, consoleHome]) {
      for (const match of source.matchAll(/ROUTES\.DEVTOOLS\./g)) {
        const preceding = source.slice(0, match.index);
        expect(preceding.lastIndexOf('isDevtoolsEnabled()')).toBeGreaterThan(-1);
      }
    }
  });
});
