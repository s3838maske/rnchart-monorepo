import { createContext, useContext } from 'react';
import type { CoordinateSystem, Point, Scale } from '../core';

export type PolarContextValue = {
  readonly coord: CoordinateSystem;
  readonly categories: readonly string[];
  readonly yKeys: readonly string[];
  readonly centerX: number;
  readonly centerY: number;
  readonly innerRadius: number;
  readonly outerRadius: number;
  readonly angleScale: Scale;
  readonly radiusScale: Scale;
  readonly independentAxes: boolean;
  readonly gridShape: 'circle' | 'polygon';
  /** Radius for a value on a given spoke, honouring independentAxes. */
  readonly radiusFor: (index: number, dataY: number) => number;
  readonly angleFor: (index: number) => number;
  readonly colorFor: (seriesKey: string) => string;
  readonly valuesFor: (seriesKey: string) => Float32Array;
  readonly validFor: (seriesKey: string) => Uint8Array;
  /** Pixel position of a datum. The one call series need. */
  readonly pointAt: (index: number, dataY: number) => Point;
  /** True when the chart sweeps a complete circle, so shapes should close. */
  readonly fullTurn: boolean;
};

const PolarContext = createContext<PolarContextValue | null>(null);

export const PolarProvider = PolarContext.Provider;

export function usePolar(): PolarContextValue {
  const value = useContext(PolarContext);
  if (value === null) {
    throw new Error(
      'react-native-graphify: this component must be rendered inside a <PolarChart>.'
    );
  }
  return value;
}
