import { useMemo } from 'react';
import { Platform } from 'react-native';
import { matchFont } from '@shopify/react-native-skia';
import type { SkFont } from '@shopify/react-native-skia';

/** Matches the weights Skia's font matcher accepts. */
export type FontWeight =
  | 'normal'
  | 'bold'
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900';

export type FontSpec = {
  readonly family?: string;
  readonly size?: number;
  readonly weight?: FontWeight;
};

/**
 * The platform's default UI font family.
 *
 * `matchFont` resolves against system fonts, which is what lets the library
 * render text on day one without a consumer shipping a .ttf. A bundled font can
 * be layered on later for pixel-identical cross-platform output; forcing one
 * now would be an install-time tax on every consumer.
 */
const SYSTEM_FAMILY = Platform.select({
  ios: 'Helvetica',
  android: 'sans-serif',
  default: 'sans-serif',
});

/**
 * Memoised Skia font.
 *
 * Keyed on the full spec so a re-render never reconstructs one. Font objects
 * are expensive and, unlike most JS values, hold native memory.
 */
export function useChartFont(spec: FontSpec = {}): SkFont {
  const family = spec.family ?? SYSTEM_FAMILY;
  const size = spec.size ?? 11;
  const weight = spec.weight ?? '400';

  return useMemo(
    () => matchFont({ fontFamily: family, fontSize: size, fontWeight: weight }),
    [family, size, weight]
  );
}
