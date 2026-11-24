/**
 * FastBuild geometric Modular Stack "F" brand mark geometry.
 *
 * Shared across Web, Admin, Desktop, and Mobile (react-native-svg) so every
 * surface renders the exact same vector proportions.
 */

export const BRAND_NAME = 'FastBuild' as const;
export const BRAND_IDENTIFIER = 'fastbuild' as const;

export const BRAND_MARK_VIEWBOX = '0 0 24 24' as const;

export interface BrandMarkRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rx: number;
}

/** Three stacked horizontal bars forming the Modular Stack "F". */
export const BRAND_MARK_RECTS: readonly BrandMarkRect[] = [
  { x: 4, y: 3.5, width: 16, height: 4.25, rx: 1.25 },
  { x: 4, y: 10, width: 11.5, height: 4.25, rx: 1.25 },
  { x: 4, y: 16.5, width: 5.25, height: 4.25, rx: 1.25 },
] as const;
