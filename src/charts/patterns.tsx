import type { ReactElement } from 'react';
import { Group, Path, Skia } from '@shopify/react-native-skia';

import { withAlpha } from './colors';

export type PatternKind =
  | 'diagonal'
  | 'diagonal-reverse'
  | 'cross-hatch'
  | 'dots'
  | 'horizontal'
  | 'vertical';

export type PatternProps = {
  readonly kind: PatternKind;
  readonly color: string;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly spacing?: number;
  readonly strokeWidth?: number;
  readonly opacity?: number;
};

/**
 * Texture overlay so series are distinguishable WITHOUT relying on colour.
 *
 * The point is redundancy: colour plus pattern means a chart still works for
 * someone who cannot separate two hues, and still prints legibly in greyscale.
 * Phase 27's `patternFallback` applies these automatically when the OS reports
 * a colour-vision preference.
 *
 * Drawn as an explicit clipped path rather than a Skia shader tile — a shader
 * would be tidier, but a path composes with the existing fill without a second
 * paint and keeps every series on the same one-draw-call-per-series budget.
 */
export function Pattern({
  kind,
  color,
  bounds,
  spacing = 7,
  strokeWidth = 1.5,
  opacity = 0.55,
}: PatternProps): ReactElement {
  const path = Skia.Path.Make();
  const { x, y, width, height } = bounds;
  const step = Math.max(2, spacing);

  if (kind === 'dots') {
    for (let cy = y + step / 2; cy < y + height; cy += step) {
      for (let cx = x + step / 2; cx < x + width; cx += step) {
        path.addCircle(cx, cy, strokeWidth);
      }
    }
    return (
      <Group clip={{ x, y, width, height }}>
        <Path path={path} style="fill" color={withAlpha(color, opacity)} />
      </Group>
    );
  }

  if (kind === 'horizontal' || kind === 'cross-hatch') {
    for (let cy = y; cy < y + height; cy += step) {
      path.moveTo(x, cy);
      path.lineTo(x + width, cy);
    }
  }

  if (kind === 'vertical' || kind === 'cross-hatch') {
    for (let cx = x; cx < x + width; cx += step) {
      path.moveTo(cx, y);
      path.lineTo(cx, y + height);
    }
  }

  if (kind === 'diagonal' || kind === 'diagonal-reverse') {
    const reverse = kind === 'diagonal-reverse';
    const span = width + height;
    for (let d = 0; d < span; d += step) {
      if (reverse) {
        path.moveTo(x + d, y);
        path.lineTo(x + d - height, y + height);
      } else {
        path.moveTo(x + d - height, y);
        path.lineTo(x + d, y + height);
      }
    }
  }

  return (
    <Group clip={{ x, y, width, height }}>
      <Path
        path={path}
        style="stroke"
        strokeWidth={strokeWidth}
        color={withAlpha(color, opacity)}
      />
    </Group>
  );
}
