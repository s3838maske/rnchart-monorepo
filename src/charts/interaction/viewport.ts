import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export type ViewportState = {
  /** Horizontal zoom factor. 1 = the full data extent. */
  readonly scaleX: SharedValue<number>;
  /** Horizontal translation in pixels, applied after scaling. */
  readonly translateX: SharedValue<number>;
  /** True while a pan or pinch is in progress. */
  readonly active: SharedValue<boolean>;
};

const ViewportContext = createContext<ViewportState | null>(null);

export const ViewportProvider = ViewportContext.Provider;

/** Null when the chart is not zoomable, so `<ZoomPan>` can opt out quietly. */
export function useViewport(): ViewportState | null {
  return useContext(ViewportContext);
}

/**
 * Clamp translation so the plot cannot be dragged away from its own data.
 *
 * At scale 1 there is nothing to pan, so translation is pinned to 0. Above
 * that, the left edge cannot move right of the plot start and the right edge
 * cannot move left of the plot end. Without this a flick sends the data off
 * screen and the chart looks broken with no obvious way back.
 */
export function clampTranslate(
  translateX: number,
  scaleX: number,
  plotWidth: number
): number {
  'worklet';
  if (scaleX <= 1) return 0;
  const maxTranslate = plotWidth * (scaleX - 1);
  // `+ 0` normalises -0 to 0. Harmless in a transform, but -0 leaking out of a
  // clamp is the kind of thing that makes an equality check fail later.
  return Math.min(0, Math.max(-maxTranslate, translateX)) + 0;
}

/**
 * Zoom about a focal point rather than the plot centre.
 *
 * Anchoring at the centre is the most common implementation mistake: content
 * slides out from under the fingers, which reads as the chart fighting you.
 * Keeping the focal point stationary is what makes a pinch feel direct.
 */
export function zoomAboutFocal(
  focalX: number,
  currentScale: number,
  nextScale: number,
  currentTranslate: number
): number {
  'worklet';
  if (currentScale === 0) return currentTranslate;
  // Position under the focal point, in unscaled plot space.
  const contentX = (focalX - currentTranslate) / currentScale;
  return focalX - contentX * nextScale;
}
