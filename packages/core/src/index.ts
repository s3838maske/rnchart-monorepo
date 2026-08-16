/**
 * @rnchart/core — renderer-agnostic charting maths.
 *
 * Phase 1 deliberately ships almost nothing. The scale engine lands in phase 2,
 * the layout solver in phase 3, decimation and hit-testing in phase 4. What this
 * package establishes today is the boundary: pure TypeScript, zero React Native,
 * runnable under plain Node.
 */

export const VERSION = '0.1.0';

export type { Rect, Size } from './geometry';
export { clamp, createRect } from './geometry';
