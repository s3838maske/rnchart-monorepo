import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import { computeBoxStats, notchWidth, waterfall } from '../../core';
import type { WhiskerMethod } from '../../core';

import { useChart } from '../ChartContext';
import { seriesColorAt, withAlpha, CHART_COLORS } from '../colors';

// ---------------------------------------------------------------------------
// Range series (phase 23)
// ---------------------------------------------------------------------------

export type AreaRangeProps = {
  readonly lowKey: string;
  readonly highKey: string;
  readonly color?: string;
  readonly fillOpacity?: number;
  readonly strokeWidth?: number;
};

/**
 * Band between a low and a high series — a confidence interval, a temperature
 * min/max, a forecast range.
 *
 * Path: forward along the high edge, reverse along the low edge, close. The
 * most common real-world use is this combined with a `<Line>` for the actual
 * value, so declare the range FIRST and the line will sit on top of it.
 */
export function AreaRange({
  lowKey,
  highKey,
  color,
  fillOpacity = 0.22,
  strokeWidth = 1,
}: AreaRangeProps): ReactElement {
  const { valuesFor, validFor, xAt, yScale, colorFor } = useChart();
  const tint = color ?? colorFor(highKey);

  const path = useMemo(() => {
    const lows = valuesFor(lowKey);
    const highs = valuesFor(highKey);
    const validLow = validFor(lowKey);
    const validHigh = validFor(highKey);
    const n = Math.min(lows.length, highs.length);

    const p = Skia.Path.Make();
    const usable: number[] = [];
    for (let i = 0; i < n; i += 1) {
      if (validLow[i] === 1 && validHigh[i] === 1) usable.push(i);
    }
    if (usable.length < 2) return p;

    usable.forEach((i, k) => {
      const x = xAt(i);
      const y = yScale.map(highs[i] as number);
      if (k === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    });

    for (let k = usable.length - 1; k >= 0; k -= 1) {
      const i = usable[k] as number;
      p.lineTo(xAt(i), yScale.map(lows[i] as number));
    }

    p.close();
    return p;
  }, [lowKey, highKey, valuesFor, validFor, xAt, yScale]);

  return (
    <Group>
      <Path path={path} style="fill" color={withAlpha(tint, fillOpacity)} />
      {strokeWidth > 0 ? (
        <Path
          path={path}
          style="stroke"
          strokeWidth={strokeWidth}
          color={withAlpha(tint, 0.5)}
        />
      ) : null}
    </Group>
  );
}

export type DumbbellProps = {
  readonly lowKey: string;
  readonly highKey: string;
  readonly lowColor?: string;
  readonly highColor?: string;
  readonly lineColor?: string;
  readonly lineWidth?: number;
  readonly markerSize?: number;
};

/** Two markers joined by a connector — the standard before/after comparison. */
export function Dumbbell({
  lowKey,
  highKey,
  lowColor,
  highColor,
  lineColor = CHART_COLORS.muted,
  lineWidth = 2,
  markerSize = 5,
}: DumbbellProps): ReactElement {
  const { valuesFor, validFor, xAt, yScale } = useChart();

  const items = useMemo(() => {
    const lows = valuesFor(lowKey);
    const highs = valuesFor(highKey);
    const vLow = validFor(lowKey);
    const vHigh = validFor(highKey);
    const n = Math.min(lows.length, highs.length);

    const out: { x: number; yLow: number; yHigh: number }[] = [];
    for (let i = 0; i < n; i += 1) {
      if (vLow[i] !== 1 || vHigh[i] !== 1) continue;
      out.push({
        x: xAt(i),
        yLow: yScale.map(lows[i] as number),
        yHigh: yScale.map(highs[i] as number),
      });
    }
    return out;
  }, [lowKey, highKey, valuesFor, validFor, xAt, yScale]);

  const connectors = useMemo(() => {
    const p = Skia.Path.Make();
    for (const it of items) {
      p.moveTo(it.x, it.yLow);
      p.lineTo(it.x, it.yHigh);
    }
    return p;
  }, [items]);

  return (
    <Group>
      <Path
        path={connectors}
        style="stroke"
        strokeWidth={lineWidth}
        strokeCap="round"
        color={withAlpha(lineColor, 0.5)}
      />
      {items.map((it, i) => (
        <Group key={i}>
          <Circle
            cx={it.x}
            cy={it.yLow}
            r={markerSize}
            color={lowColor ?? seriesColorAt(1)}
          />
          <Circle
            cx={it.x}
            cy={it.yHigh}
            r={markerSize}
            color={highColor ?? seriesColorAt(0)}
          />
        </Group>
      ))}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Box plot (phase 24)
// ---------------------------------------------------------------------------

export type BoxPlotProps = {
  /** One array of raw values per category. */
  readonly groups: readonly (readonly number[])[];
  readonly whiskers?: WhiskerMethod;
  readonly showOutliers?: boolean;
  readonly showMean?: boolean;
  readonly notched?: boolean;
  readonly color?: string;
  readonly boxWidth?: number;
};

/**
 * Box plot with configurable whiskers.
 *
 * Quartiles come from `computeBoxStats` in core, which is unit-tested against
 * known R output — libraries disagree about quantile definitions and the
 * discrepancy is a recurring bug report, so the maths is pinned down where it
 * can be verified rather than inline here.
 */
export function BoxPlot({
  groups,
  whiskers = 'tukey',
  showOutliers = true,
  showMean = false,
  notched = false,
  color,
  boxWidth,
}: BoxPlotProps): ReactElement {
  const { xScale, yScale, xAt } = useChart();
  const tint = color ?? seriesColorAt(0);

  const shapes = useMemo(() => {
    const band = xScale.bandwidth > 0 ? xScale.bandwidth : 40;
    const width = boxWidth ?? band * 0.55;
    const half = width / 2;

    const boxes = Skia.Path.Make();
    const lines = Skia.Path.Make();
    const outliers: { x: number; y: number }[] = [];
    const means: { x: number; y: number }[] = [];

    groups.forEach((values, i) => {
      const s = computeBoxStats(values, { whiskers });
      if (s.n === 0) return;

      const cx = xAt(i);
      const yQ1 = yScale.map(s.q1);
      const yQ3 = yScale.map(s.q3);
      const yMed = yScale.map(s.median);
      const yMin = yScale.map(s.min);
      const yMax = yScale.map(s.max);

      const top = Math.min(yQ1, yQ3);
      const height = Math.abs(yQ3 - yQ1);

      if (notched) {
        // Clamped to stay inside the box. The notch is 1.58 x IQR / sqrt(n)
        // while half the box is IQR / 2, so for n < 10 the notch is the larger
        // of the two and the outline turns inside out — an hourglass with its
        // waist outside the quartiles, which reads as a rendering fault rather
        // than as the "sample too small to notch" signal it really is.
        const notch = Math.min(
          Math.abs(yScale.map(s.median) - yScale.map(s.median + notchWidth(s))),
          Math.abs(yMed - yQ1),
          Math.abs(yMed - yQ3)
        );
        const inset = half * 0.45;
        // Taper inward at the median to show its confidence interval.
        boxes.moveTo(cx - half, top);
        boxes.lineTo(cx + half, top);
        boxes.lineTo(cx + half, yMed - notch);
        boxes.lineTo(cx + inset, yMed);
        boxes.lineTo(cx + half, yMed + notch);
        boxes.lineTo(cx + half, top + height);
        boxes.lineTo(cx - half, top + height);
        boxes.lineTo(cx - half, yMed + notch);
        boxes.lineTo(cx - inset, yMed);
        boxes.lineTo(cx - half, yMed - notch);
        boxes.close();
      } else {
        boxes.addRect(Skia.XYWHRect(cx - half, top, width, height));
      }

      // Whiskers plus their caps, and the median line.
      lines.moveTo(cx, yMin);
      lines.lineTo(cx, Math.max(yQ1, yQ3));
      lines.moveTo(cx, yMax);
      lines.lineTo(cx, Math.min(yQ1, yQ3));
      lines.moveTo(cx - half * 0.5, yMin);
      lines.lineTo(cx + half * 0.5, yMin);
      lines.moveTo(cx - half * 0.5, yMax);
      lines.lineTo(cx + half * 0.5, yMax);
      lines.moveTo(cx - half, yMed);
      lines.lineTo(cx + half, yMed);

      if (showOutliers) {
        s.outliers.forEach((v, k) => {
          // Jitter coincident outliers so overlapping points stay countable.
          const jitter = ((k % 3) - 1) * (half * 0.25);
          outliers.push({ x: cx + jitter, y: yScale.map(v) });
        });
      }

      if (showMean) means.push({ x: cx, y: yScale.map(s.mean) });
    });

    return { boxes, lines, outliers, means };
  }, [
    groups,
    whiskers,
    showOutliers,
    showMean,
    notched,
    boxWidth,
    xScale,
    yScale,
    xAt,
  ]);

  return (
    <Group>
      <Path path={shapes.boxes} style="fill" color={withAlpha(tint, 0.25)} />
      <Path path={shapes.boxes} style="stroke" strokeWidth={1.5} color={tint} />
      <Path path={shapes.lines} style="stroke" strokeWidth={1.5} color={tint} />

      {shapes.outliers.map((o, i) => (
        <Circle
          key={`o${i}`}
          cx={o.x}
          cy={o.y}
          r={2.5}
          color={withAlpha(tint, 0.7)}
        />
      ))}
      {shapes.means.map((m, i) => (
        <Circle
          key={`m${i}`}
          cx={m.x}
          cy={m.y}
          r={3}
          color={CHART_COLORS.foreground}
        />
      ))}
    </Group>
  );
}

export type ErrorBarsProps = {
  readonly lowKey: string;
  readonly highKey: string;
  readonly color?: string;
  readonly capWidth?: number;
  readonly width?: number;
};

/** Error bars, attachable over any series. */
export function ErrorBars({
  lowKey,
  highKey,
  color = CHART_COLORS.foreground,
  capWidth = 8,
  width = 1.5,
}: ErrorBarsProps): ReactElement {
  const { valuesFor, validFor, xAt, yScale } = useChart();

  const path = useMemo(() => {
    const lows = valuesFor(lowKey);
    const highs = valuesFor(highKey);
    const vLow = validFor(lowKey);
    const vHigh = validFor(highKey);
    const n = Math.min(lows.length, highs.length);
    const p = Skia.Path.Make();
    const half = capWidth / 2;

    for (let i = 0; i < n; i += 1) {
      if (vLow[i] !== 1 || vHigh[i] !== 1) continue;
      const x = xAt(i);
      const yLow = yScale.map(lows[i] as number);
      const yHigh = yScale.map(highs[i] as number);

      p.moveTo(x, yLow);
      p.lineTo(x, yHigh);
      p.moveTo(x - half, yLow);
      p.lineTo(x + half, yLow);
      p.moveTo(x - half, yHigh);
      p.lineTo(x + half, yHigh);
    }
    return p;
  }, [lowKey, highKey, valuesFor, validFor, xAt, yScale, capWidth]);

  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={width}
      color={withAlpha(color, 0.7)}
    />
  );
}

// ---------------------------------------------------------------------------
// Waterfall (phase 25)
// ---------------------------------------------------------------------------

export type WaterfallProps = {
  readonly valueKey: string;
  /** Indices that are subtotals, rising from zero. */
  readonly sumIndices?: readonly number[];
  readonly positiveColor?: string;
  readonly negativeColor?: string;
  readonly sumColor?: string;
  readonly showConnectors?: boolean;
  readonly cornerRadius?: number;
};

/**
 * Waterfall with running totals and connectors.
 *
 * The running-total maths lives in core's `waterfall`, including the rule that
 * subtotals rise from ZERO rather than from the running total. That is an
 * absolute position, not another delta, and treating it as a delta is what
 * makes waterfall charts silently wrong.
 *
 * Set the chart's `yDomain` from `waterfallDomain(steps)`. The chart derives
 * its domain from the values it is handed — the DELTAS — while the bars are
 * drawn at cumulative positions that usually climb higher, and the ones past
 * the top are then clipped away with nothing to show for it.
 */
export function Waterfall({
  valueKey,
  sumIndices = [],
  positiveColor = '#10b981',
  negativeColor = '#ef4444',
  sumColor,
  showConnectors = true,
  cornerRadius = 3,
}: WaterfallProps): ReactElement {
  const { valuesFor, data, xKey, xScale, yScale, xAt } = useChart();
  const sumTint = sumColor ?? seriesColorAt(0);

  const shapes = useMemo(() => {
    const values = valuesFor(valueKey);
    const steps = Array.from({ length: values.length }, (_, i) => ({
      label: String(data[i]?.[xKey] ?? i),
      value: values[i] ?? 0,
      isSum: sumIndices.includes(i),
    }));

    const bars = waterfall(steps);
    const band = xScale.bandwidth > 0 ? xScale.bandwidth : 30;
    const width = band * 0.7;

    const positive = Skia.Path.Make();
    const negative = Skia.Path.Make();
    const sums = Skia.Path.Make();
    const connectors = Skia.Path.Make();

    bars.forEach((bar, i) => {
      const cx = xAt(i);
      const yStart = yScale.map(bar.start);
      const yEnd = yScale.map(bar.end);
      const top = Math.min(yStart, yEnd);
      const height = Math.max(1, Math.abs(yEnd - yStart));

      const rect = Skia.RRectXY(
        Skia.XYWHRect(cx - width / 2, top, width, height),
        cornerRadius,
        cornerRadius
      );

      if (bar.kind === 'sum') sums.addRRect(rect);
      else if (bar.kind === 'positive') positive.addRRect(rect);
      else negative.addRRect(rect);

      // Connector to the next bar, drawn at the level this one ended.
      if (showConnectors && i < bars.length - 1) {
        const next = bars[i + 1] as (typeof bars)[number];
        if (!next.isSum) {
          const y = yScale.map(bar.end);
          connectors.moveTo(cx + width / 2, y);
          connectors.lineTo(xAt(i + 1) - width / 2, y);
        }
      }
    });

    return { positive, negative, sums, connectors };
  }, [
    valueKey,
    valuesFor,
    data,
    xKey,
    sumIndices,
    xScale,
    yScale,
    xAt,
    cornerRadius,
    showConnectors,
  ]);

  return (
    <Group>
      {showConnectors ? (
        <Path
          path={shapes.connectors}
          style="stroke"
          strokeWidth={1}
          color={withAlpha(CHART_COLORS.foreground, 0.25)}
        />
      ) : null}
      <Path path={shapes.positive} style="fill" color={positiveColor} />
      <Path path={shapes.negative} style="fill" color={negativeColor} />
      <Path path={shapes.sums} style="fill" color={sumTint} />
    </Group>
  );
}
