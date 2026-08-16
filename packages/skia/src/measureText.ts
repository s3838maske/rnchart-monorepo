import type { SkFont } from '@shopify/react-native-skia';
import type { MeasureText } from '@rnchart/core';

/**
 * Cache key for one measurement.
 *
 * Text measurement is the hot path inside the layout solver — it runs for every
 * tick label on every axis, twice per solve — and Skia's measureText crosses
 * into native each time. Caching turns a resize from hundreds of native calls
 * into a handful.
 */
function keyFor(text: string, fontSize: number, family: string): string {
  return `${family}|${fontSize}|${text}`;
}

const DEFAULT_CAPACITY = 512;

/**
 * Build a `MeasureText` backed by a Skia font, with a bounded LRU cache.
 *
 * Bounded rather than unbounded because a streaming chart relabels its axis
 * continuously; an unbounded cache would be a slow memory leak that only shows
 * up after ten minutes of running, which is exactly the kind of bug that never
 * gets caught in a demo.
 */
export function createMeasureText(
  font: SkFont | null,
  options: { readonly family?: string; readonly capacity?: number } = {}
): MeasureText {
  const family = options.family ?? 'default';
  const capacity = options.capacity ?? DEFAULT_CAPACITY;
  const cache = new Map<string, { width: number; height: number }>();

  return (text, fontSize) => {
    const key = keyFor(text, fontSize, family);
    const hit = cache.get(key);
    if (hit !== undefined) {
      // Refresh recency: delete + set moves the entry to the end of the Map.
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }

    let measured: { width: number; height: number };

    if (font === null) {
      // The font has not resolved yet. Estimate rather than returning zero:
      // a zero-width label makes the solver reserve no space, and the first
      // frame renders with the axis labels clipped.
      measured = {
        width: text.length * fontSize * 0.6,
        height: fontSize * 1.2,
      };
    } else {
      const width = font.getTextWidth(text);
      const metrics = font.getMetrics();
      const height =
        metrics === undefined
          ? fontSize * 1.2
          : Math.abs(metrics.ascent) + Math.abs(metrics.descent);
      measured = {
        width: Number.isFinite(width) ? width : text.length * fontSize * 0.6,
        height: Number.isFinite(height) ? height : fontSize * 1.2,
      };
    }

    if (cache.size >= capacity) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, measured);
    return measured;
  };
}
