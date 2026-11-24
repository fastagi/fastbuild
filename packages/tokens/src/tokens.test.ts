import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BRAND_IDENTIFIER,
  BRAND_MARK_RECTS,
  BRAND_MARK_VIEWBOX,
  BRAND_NAME,
  darkTokens,
  designTokens,
  getRnTheme,
  lightTokens,
  rnDarkTheme,
  rnLightTheme,
} from './index.ts';

describe('@fastbuild/tokens', () => {
  it('exposes the Modular Stack "F" brand geometry', () => {
    assert.equal(BRAND_NAME, 'FastBuild');
    assert.equal(BRAND_IDENTIFIER, 'fastbuild');
    assert.equal(BRAND_MARK_VIEWBOX, '0 0 24 24');
    assert.equal(BRAND_MARK_RECTS.length, 3);
    assert.deepEqual(BRAND_MARK_RECTS[0], { x: 4, y: 3.5, width: 16, height: 4.25, rx: 1.25 });
    assert.deepEqual(BRAND_MARK_RECTS[1], { x: 4, y: 10, width: 11.5, height: 4.25, rx: 1.25 });
    assert.deepEqual(BRAND_MARK_RECTS[2], { x: 4, y: 16.5, width: 5.25, height: 4.25, rx: 1.25 });
  });

  it('uses pure zero-chroma OKLCH neutrals for light and dark surfaces', () => {
    const neutralKeys = ['background', 'foreground', 'card', 'primary', 'secondary', 'muted'] as const;
    for (const key of neutralKeys) {
      assert.match(lightTokens[key], /^oklch\([\d.]+ 0 0\)$/);
      assert.match(darkTokens[key], /^oklch\([\d.]+ 0 0\)$/);
    }
    assert.equal(designTokens.colors.light, lightTokens);
    assert.equal(designTokens.colors.dark, darkTokens);
  });

  it('keeps React Native theme keys aligned with semantic color tokens', () => {
    const tokenKeys = Object.keys(lightTokens).sort();
    assert.deepEqual(Object.keys(rnLightTheme.colors).sort(), tokenKeys);
    assert.deepEqual(Object.keys(rnDarkTheme.colors).sort(), tokenKeys);
    assert.equal(getRnTheme('light'), rnLightTheme);
    assert.equal(getRnTheme('dark'), rnDarkTheme);
  });
});
