/**
 * @rnchart/skia — the adapter between core geometry and Skia draw calls.
 *
 * Phase 1 ships only the seam. The real work — `measureText` injected into
 * core's layout solver, memoised Paint/Font/Path factories, `<PlotClip>` —
 * lands in phase 5.
 */

import { VERSION as CORE_VERSION } from '@rnchart/core';

export const VERSION = '0.1.0';

export type RendererInfo = {
  readonly renderer: 'skia';
  readonly version: string;
  readonly coreVersion: string;
};

/**
 * Reports which core this adapter is bound to.
 *
 * Its real job in phase 1 is to prove the workspace wiring end to end: if this
 * resolves, `@rnchart/skia` can see `@rnchart/core` in development (through the
 * path alias) and after publishing (through the built declarations).
 */
export function rendererInfo(): RendererInfo {
  return {
    renderer: 'skia',
    version: VERSION,
    coreVersion: CORE_VERSION,
  };
}
