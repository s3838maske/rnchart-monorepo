import {
  timeDay,
  timeHour,
  timeMinute,
  timeMonth,
  timeSecond,
  timeWeek,
  timeYear,
} from 'd3-time';
import type { CountableTimeInterval, TimeInterval } from 'd3-time';

import type { Scale } from '../scale/types';
import { formatValue } from './format';
import type { FormatSpec } from './format';

export type LabelledTick = {
  readonly value: number;
  readonly position: number;
  readonly label: string;
};

export type TickOptions = {
  /**
   * Roughly how many pixels one label occupies along the axis.
   *
   * Drives the tick count. Nothing here uses a fixed `tickCount`: a chart
   * 320px wide and one 1200px wide should not get the same number of ticks,
   * and hardcoding a count is why so many mobile charts ship with overlapping
   * axis labels.
   */
  readonly estimatedLabelSizePx?: number;
  readonly format?: FormatSpec;
  readonly maxCount?: number;
};

/** Natural time boundaries, coarsest last. */
const TIME_INTERVALS: readonly {
  readonly interval: CountableTimeInterval;
  readonly step: number;
  readonly approxMs: number;
}[] = [
  { interval: timeSecond, step: 1, approxMs: 1000 },
  { interval: timeSecond, step: 15, approxMs: 15e3 },
  { interval: timeMinute, step: 1, approxMs: 60e3 },
  { interval: timeMinute, step: 15, approxMs: 900e3 },
  { interval: timeHour, step: 1, approxMs: 3.6e6 },
  { interval: timeHour, step: 6, approxMs: 2.16e7 },
  { interval: timeDay, step: 1, approxMs: 8.64e7 },
  { interval: timeWeek, step: 1, approxMs: 6.048e8 },
  { interval: timeMonth, step: 1, approxMs: 2.628e9 },
  { interval: timeMonth, step: 3, approxMs: 7.884e9 },
  { interval: timeYear, step: 1, approxMs: 3.154e10 },
];

function targetCount(availablePx: number, labelSizePx: number): number {
  if (availablePx <= 0) return 1;
  return Math.max(2, Math.min(12, Math.floor(availablePx / labelSizePx)));
}

/**
 * Time ticks snapped to natural boundaries.
 *
 * Picks the granularity whose tick count lands closest to the target, so an
 * axis spanning a year gets month starts rather than an arbitrary set of
 * timestamps 31.4 days apart.
 */
function timeTicks(
  domainStart: number,
  domainEnd: number,
  count: number
): number[] {
  const span = Math.abs(domainEnd - domainStart);
  if (span === 0) return [domainStart];

  const ideal = span / Math.max(1, count);

  let best = TIME_INTERVALS[TIME_INTERVALS.length - 1]!;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of TIME_INTERVALS) {
    const distance = Math.abs(Math.log(candidate.approxMs / ideal));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  const lo = Math.min(domainStart, domainEnd);
  const hi = Math.max(domainStart, domainEnd);
  const interval: TimeInterval =
    best.interval.every(best.step) ?? best.interval;

  return interval.range(new Date(lo), new Date(hi + 1)).map((d) => d.getTime());
}

/**
 * Generate ticks for an axis, sized to the space actually available.
 *
 * Returns value, pixel position and formatted label together so the renderer
 * never has to re-derive any of them — phase 6 draws all tick marks as a single
 * path from exactly this array.
 */
export function generateTicks(
  scale: Scale,
  availablePx: number,
  options: TickOptions = {}
): LabelledTick[] {
  const isTime = scale.type === 'time';
  const labelSize =
    options.estimatedLabelSizePx ??
    (isTime ? 64 : scale.type === 'band' ? 48 : 40);

  const count = Math.min(
    targetCount(availablePx, labelSize),
    options.maxCount ?? Number.POSITIVE_INFINITY
  );

  const format: FormatSpec =
    options.format ?? (isTime ? { type: 'time' } : { type: 'compact' });

  if (scale.type === 'band' || scale.type === 'point') {
    const categories = scale.domain as readonly (string | number)[];

    // Ordinal axes cannot invent intermediate values, so thin by whole steps.
    const stride = Math.max(
      1,
      Math.ceil(categories.length / Math.max(1, count))
    );

    const out: LabelledTick[] = [];
    for (let i = 0; i < categories.length; i += stride) {
      const category = categories[i];
      if (category === undefined) continue;
      out.push({
        value: i,
        position: scale.map(category) + scale.bandwidth / 2,
        label:
          typeof category === 'number'
            ? formatValue(category, format)
            : String(category),
      });
    }
    return out;
  }

  const [start, end] = scale.domain as readonly [number, number];
  const values = isTime ? timeTicks(start, end, count) : scale.ticks(count);

  return values
    .filter((v) => Number.isFinite(v) && scale.supports(v))
    .map((value) => ({
      value,
      position: scale.map(value),
      label: formatValue(value, format),
    }));
}
