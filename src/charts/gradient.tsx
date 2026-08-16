import type { ReactElement } from 'react';
import {
  LinearGradient,
  RadialGradient,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';

import { withAlpha } from './colors';

export type GradientKind = 'linear' | 'radial' | 'sweep';

/**
 * One gradient description, shared by every series type.
 *
 * Deliberately a plain data object rather than a Skia node: a series knows its
 * own geometry (a rect for a bar, a circle for a radar) and the caller does
 * not, so the caller describes the RAMP and the series supplies the frame.
 * Handing a consumer a `<LinearGradient>` to position themselves would mean
 * they need the plot rect, which they do not have.
 */
export type GradientSpec = {
  readonly type?: GradientKind;
  /**
   * Colour stops. Two or more.
   *
   * Shorthand: pass a single colour and it ramps from that colour to
   * transparent, which is what an area fill wants nine times out of ten.
   */
  readonly colors: readonly string[];
  /** Stop positions, 0 to 1. Must match `colors` in length when given. */
  readonly positions?: readonly number[];
  /** Linear only. Defaults to vertical, which suits area and bar fills. */
  readonly direction?: 'vertical' | 'horizontal';
  /** Multiplies every stop's alpha. */
  readonly opacity?: number;
};

/** Accept a bare colour list as shorthand for `{ colors }`. */
export type GradientInput = GradientSpec | readonly string[] | boolean;

export type GradientFrame = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * Normalise the shorthand forms into a full spec.
 *
 * `gradient` accepts `true`, a colour array, or a full spec. `true` means
 * "ramp the series colour to transparent" — the sensible default, and the one
 * that makes `<Area gradient />` do the right thing with no further input.
 */
export function resolveGradient(
  input: GradientInput | undefined,
  seriesColor: string
): GradientSpec | null {
  if (input === undefined || input === false) return null;

  if (input === true) {
    return {
      type: 'linear',
      // Three stops with an eased falloff. A two-stop linear ramp reads as a
      // flat wash; the mid stop is what makes it read as depth.
      colors: [
        withAlpha(seriesColor, 0.6),
        withAlpha(seriesColor, 0.15),
        withAlpha(seriesColor, 0),
      ],
      positions: [0, 0.7, 1],
    };
  }

  if (Array.isArray(input)) {
    return { type: 'linear', colors: input as readonly string[] };
  }

  return input as GradientSpec;
}

function applyOpacity(spec: GradientSpec): string[] {
  if (spec.opacity === undefined) return [...spec.colors];
  return spec.colors.map((c) => withAlpha(c, spec.opacity as number));
}

/**
 * Render a gradient shader sized to `frame`.
 *
 * Must be used as a CHILD of a Skia `<Path>`, `<Rect>` or similar — Skia
 * applies a shader to its parent paint rather than standing alone.
 */
export function SeriesGradient({
  spec,
  frame,
}: {
  readonly spec: GradientSpec;
  readonly frame: GradientFrame;
}): ReactElement | null {
  const colors = applyOpacity(spec);
  if (colors.length < 2) return null;

  const positions = spec.positions ? [...spec.positions] : undefined;
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;

  if (spec.type === 'radial') {
    return (
      <RadialGradient
        c={vec(cx, cy)}
        r={Math.max(frame.width, frame.height) / 2}
        colors={colors}
        {...(positions ? { positions } : {})}
      />
    );
  }

  if (spec.type === 'sweep') {
    return (
      <SweepGradient
        c={vec(cx, cy)}
        colors={colors}
        {...(positions ? { positions } : {})}
      />
    );
  }

  const horizontal = spec.direction === 'horizontal';

  return (
    <LinearGradient
      start={vec(frame.x, frame.y)}
      end={
        horizontal
          ? vec(frame.x + frame.width, frame.y)
          : vec(frame.x, frame.y + frame.height)
      }
      colors={colors}
      {...(positions ? { positions } : {})}
    />
  );
}
