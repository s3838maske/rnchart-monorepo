/**
 * @rnchart/skia — the adapter between core geometry and Skia draw calls.
 *
 * Everything renderer-specific lives here. `@rnchart/charts` composes these
 * primitives; `@rnchart/core` knows nothing about any of it, which is what
 * makes the phase 39 web renderer an adapter swap rather than a rewrite.
 */

import { VERSION as CORE_VERSION } from '../core';

export const VERSION = '0.1.0';

export type RendererInfo = {
  readonly renderer: 'skia';
  readonly version: string;
  readonly coreVersion: string;
};

export function rendererInfo(): RendererInfo {
  return {
    renderer: 'skia',
    version: VERSION,
    coreVersion: CORE_VERSION,
  };
}

export { createMeasureText } from './measureText';
export { useChartFont } from './useChartFont';
export type { FontSpec, FontWeight } from './useChartFont';
