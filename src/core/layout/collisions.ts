import type { LabelledTick } from './ticks';

export type CollisionStrategy =
  'rotate' | 'skip' | 'truncate' | 'auto' | 'none';

export type ResolvedTick = LabelledTick & {
  /** Radians. Non-zero only under the rotate strategy. */
  readonly rotation: number;
  readonly hidden: boolean;
};

export type CollisionOptions = {
  /** Measured or estimated width of each label, parallel to `ticks`. */
  readonly labelWidths: readonly number[];
  /** Minimum gap between two label boxes before they count as colliding. */
  readonly gapPx?: number;
  /** Used by `truncate` to decide how many characters survive. */
  readonly charWidthPx?: number;
};

const ROTATION_RADIANS = -Math.PI / 4; // 45°

function widthAt(
  widths: readonly number[],
  i: number,
  fallback: number
): number {
  const w = widths[i];
  return w === undefined || !Number.isFinite(w) ? fallback : w;
}

/** Do any two adjacent labels overlap at their current widths? */
function collides(
  ticks: readonly LabelledTick[],
  widths: readonly number[],
  gap: number,
  scale: number
): boolean {
  for (let i = 1; i < ticks.length; i += 1) {
    const prev = ticks[i - 1]!;
    const curr = ticks[i]!;
    const halfPrev = (widthAt(widths, i - 1, 40) * scale) / 2;
    const halfCurr = (widthAt(widths, i, 40) * scale) / 2;
    if (Math.abs(curr.position - prev.position) < halfPrev + halfCurr + gap) {
      return true;
    }
  }
  return false;
}

function keepEveryNth(
  ticks: readonly LabelledTick[],
  n: number
): ResolvedTick[] {
  return ticks.map((tick, i) => ({
    ...tick,
    rotation: 0,
    hidden: i % n !== 0,
  }));
}

function truncateLabels(
  ticks: readonly LabelledTick[],
  budgetPx: number,
  charWidthPx: number
): ResolvedTick[] {
  const maxChars = Math.max(1, Math.floor(budgetPx / charWidthPx));
  return ticks.map((tick) => ({
    ...tick,
    rotation: 0,
    hidden: false,
    label:
      tick.label.length > maxChars
        ? `${tick.label.slice(0, Math.max(1, maxChars - 1))}…`
        : tick.label,
  }));
}

/**
 * Resolve overlapping axis labels.
 *
 * `auto` is the interesting one, and its order is deliberate: skip alternate
 * labels first, then rotate 45°, then truncate. Skipping preserves every
 * remaining label perfectly and is the least visually disruptive; rotation
 * keeps all the information but costs vertical space; truncation destroys
 * information and so goes last.
 *
 * The canonical case is 12 month labels in 320px, which skip-alternate solves
 * cleanly at 6 labels.
 */
export function resolveCollisions(
  ticks: readonly LabelledTick[],
  availablePx: number,
  strategy: CollisionStrategy = 'auto',
  options: CollisionOptions
): ResolvedTick[] {
  const asIs = (): ResolvedTick[] =>
    ticks.map((t) => ({ ...t, rotation: 0, hidden: false }));

  if (ticks.length <= 1 || strategy === 'none') return asIs();

  const gap = options.gapPx ?? 4;
  const charWidth = options.charWidthPx ?? 7;
  const widths = options.labelWidths;

  if (!collides(ticks, widths, gap, 1)) return asIs();

  if (strategy === 'rotate') {
    return ticks.map((t) => ({
      ...t,
      rotation: ROTATION_RADIANS,
      hidden: false,
    }));
  }

  if (strategy === 'truncate') {
    const budget = availablePx / ticks.length - gap;
    return truncateLabels(ticks, Math.max(charWidth, budget), charWidth);
  }

  if (strategy === 'skip') {
    for (let n = 2; n <= ticks.length; n += 1) {
      const kept = ticks.filter((_, i) => i % n === 0);
      const keptWidths = widths.filter((_, i) => i % n === 0);
      if (!collides(kept, keptWidths, gap, 1)) return keepEveryNth(ticks, n);
    }
    return keepEveryNth(ticks, ticks.length);
  }

  // auto: skip → rotate → truncate
  for (let n = 2; n <= Math.min(ticks.length, 6); n += 1) {
    const kept = ticks.filter((_, i) => i % n === 0);
    const keptWidths = widths.filter((_, i) => i % n === 0);
    if (!collides(kept, keptWidths, gap, 1)) return keepEveryNth(ticks, n);
  }

  // Rotating by 45° shrinks a label's horizontal footprint by cos(45°).
  if (!collides(ticks, widths, gap, Math.SQRT1_2)) {
    return ticks.map((t) => ({
      ...t,
      rotation: ROTATION_RADIANS,
      hidden: false,
    }));
  }

  const budget = availablePx / ticks.length - gap;
  return truncateLabels(ticks, Math.max(charWidth, budget), charWidth);
}
