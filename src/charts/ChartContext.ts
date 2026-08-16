import { createContext, useContext } from 'react';
import type { Layout, Rect, Scale } from '../core';

export type SeriesDatum = Record<string, number | string | null | undefined>;

export type ChartContextValue = {
  readonly layout: Layout;
  readonly plotArea: Rect;
  /** Horizontal scale, already bound to the solved plot area. */
  readonly xScale: Scale;
  /** Vertical scale, already bound to the solved plot area. */
  readonly yScale: Scale;
  readonly data: readonly SeriesDatum[];
  readonly xKey: string;
  readonly yKeys: readonly string[];
  /** Resolved series colour, by series key. */
  readonly colorFor: (seriesKey: string) => string;
  /** Numeric values for one series, missing entries already normalised. */
  readonly valuesFor: (seriesKey: string) => Float32Array;
  readonly validFor: (seriesKey: string) => Uint8Array;
  /** Pixel x for the datum at `index`, centred within its band if ordinal. */
  readonly xAt: (index: number) => number;
  readonly animate: boolean;
};

export const ChartContext = createContext<ChartContextValue | null>(null);

export const ChartProvider = ChartContext.Provider;

/**
 * Read the chart context.
 *
 * Throws rather than returning null: a series rendered outside a `<Chart>` has
 * no scales and no plot area, and failing loudly at development time beats
 * rendering an invisible component and leaving the consumer to wonder why.
 */
export function useChart(): ChartContextValue {
  const value = useContext(ChartContext);
  if (value === null) {
    throw new Error(
      '@rnchart: this component must be rendered inside a <Chart>.'
    );
  }
  return value;
}
