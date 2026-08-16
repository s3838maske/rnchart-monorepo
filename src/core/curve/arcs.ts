export type ArcOptions = {
  /** Radians, clockwise from 12 o'clock. Default -PI/2 (top). */
  readonly startAngle?: number;
  readonly endAngle?: number;
  readonly padAngle?: number;
  readonly innerRadius?: number;
  readonly outerRadius: number;
  /** Sort slices largest-first before laying them out. */
  readonly sort?: boolean;
};

export type Arc = {
  readonly index: number;
  readonly value: number;
  readonly startAngle: number;
  readonly endAngle: number;
  /** Midpoint angle — the direction a slice explodes along. */
  readonly centroidAngle: number;
  readonly innerRadius: number;
  readonly outerRadius: number;
};

const TAU = Math.PI * 2;

/**
 * Lay out pie or donut slices.
 *
 * Pure geometry, in core, so it is unit-testable without a renderer — the Pie
 * component only draws what this returns. Negative and non-finite values are
 * treated as zero rather than producing a slice that sweeps backwards.
 */
export function computeArcs(
  values: ArrayLike<number>,
  options: ArcOptions
): Arc[] {
  const start = options.startAngle ?? -Math.PI / 2;
  const end = options.endAngle ?? start + TAU;
  const pad = options.padAngle ?? 0;
  const inner = options.innerRadius ?? 0;
  const outer = options.outerRadius;

  const entries: { index: number; value: number }[] = [];
  let total = 0;

  for (let i = 0; i < values.length; i += 1) {
    const raw = values[i];
    const v = raw === undefined || !Number.isFinite(raw) || raw < 0 ? 0 : raw;
    entries.push({ index: i, value: v });
    total += v;
  }

  if (options.sort === true) entries.sort((a, b) => b.value - a.value);

  if (total <= 0) return [];

  const sweep = end - start;
  // Padding must not consume the whole circle when there are many small slices.
  const usablePad = Math.min(pad, Math.abs(sweep) / (entries.length * 2 || 1));
  const available = sweep - usablePad * entries.length;

  const arcs: Arc[] = [];
  let cursor = start;

  for (const entry of entries) {
    const angle = (entry.value / total) * available;
    const a0 = cursor;
    const a1 = cursor + angle;

    arcs.push({
      index: entry.index,
      value: entry.value,
      startAngle: a0,
      endAngle: a1,
      centroidAngle: (a0 + a1) / 2,
      innerRadius: inner,
      outerRadius: outer,
    });

    cursor = a1 + usablePad;
  }

  return arcs;
}
