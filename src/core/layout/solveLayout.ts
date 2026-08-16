import { createRect } from '../geometry';
import type { Rect } from '../geometry';
import { createScale } from '../scale/createScale';
import type {
  Category,
  ContinuousScaleType,
  Domain,
  Scale,
} from '../scale/types';
import { generateTicks } from './ticks';
import type { LabelledTick } from './ticks';
import { resolveCollisions } from './collisions';
import type { CollisionStrategy, ResolvedTick } from './collisions';
import type { FormatSpec } from './format';

export type AxisPlacement = 'bottom' | 'top' | 'left' | 'right';

/** A scale spec with the range left out — the solver decides the range. */
export type AxisScaleSpec =
  | {
      readonly type: ContinuousScaleType;
      readonly domain: Domain;
      readonly clamp?: boolean;
    }
  | {
      readonly type: 'band';
      readonly domain: readonly Category[];
      readonly padding?: number;
      readonly paddingInner?: number;
      readonly paddingOuter?: number;
    }
  | {
      readonly type: 'point';
      readonly domain: readonly Category[];
      readonly padding?: number;
    };

export type AxisInput = {
  readonly id: string;
  readonly placement: AxisPlacement;
  readonly scale: AxisScaleSpec;
  readonly title?: string;
  readonly labelFormat?: FormatSpec;
  readonly labelFontSize?: number;
  readonly titleFontSize?: number;
  readonly tickLength?: number;
  readonly showLabels?: boolean;
  readonly collisions?: CollisionStrategy;
};

export type LegendInput = {
  readonly placement: 'top' | 'bottom' | 'left' | 'right';
  readonly widthPx?: number;
  readonly heightPx?: number;
};

export type TitleInput = {
  readonly text: string;
  readonly fontSize?: number;
};

export type Padding = {
  readonly top?: number;
  readonly right?: number;
  readonly bottom?: number;
  readonly left?: number;
};

/**
 * Text measurement, injected.
 *
 * Core cannot measure text — that needs a font, which needs a renderer. Phase 5
 * passes a Skia-backed implementation; tests pass a deterministic stub. Keeping
 * this an argument rather than an import is what lets the layout solver be
 * unit-tested in plain Node.
 */
export type MeasureText = (
  text: string,
  fontSize: number
) => { width: number; height: number };

export type LayoutInput = {
  readonly width: number;
  readonly height: number;
  readonly axes?: readonly AxisInput[];
  readonly legend?: LegendInput;
  readonly title?: TitleInput;
  readonly padding?: Padding;
  readonly measureText: MeasureText;
};

export type SolvedAxis = {
  readonly id: string;
  readonly placement: AxisPlacement;
  readonly scale: Scale;
  readonly ticks: readonly ResolvedTick[];
  /** Space this axis reserved, perpendicular to its direction. */
  readonly thickness: number;
};

export type Layout = {
  readonly plotArea: Rect;
  readonly axes: readonly SolvedAxis[];
  readonly legendRect: Rect;
  readonly titleRect: Rect;
};

const LABEL_GAP = 6;
const TITLE_GAP = 4;
const DEFAULT_LABEL_FONT = 11;
const DEFAULT_TITLE_FONT = 13;
const DEFAULT_TICK_LENGTH = 4;
const MAX_PASSES = 2;

const isVertical = (p: AxisPlacement): boolean => p === 'left' || p === 'right';

function buildScale(
  spec: AxisScaleSpec,
  range: readonly [number, number]
): Scale {
  if (spec.type === 'band') {
    return createScale({
      type: 'band',
      domain: spec.domain,
      range,
      ...(spec.padding !== undefined ? { padding: spec.padding } : {}),
      ...(spec.paddingInner !== undefined
        ? { paddingInner: spec.paddingInner }
        : {}),
      ...(spec.paddingOuter !== undefined
        ? { paddingOuter: spec.paddingOuter }
        : {}),
    });
  }
  if (spec.type === 'point') {
    return createScale({
      type: 'point',
      domain: spec.domain,
      range,
      ...(spec.padding !== undefined ? { padding: spec.padding } : {}),
    });
  }
  return createScale({
    type: spec.type,
    domain: spec.domain,
    range,
    ...(spec.clamp !== undefined ? { clamp: spec.clamp } : {}),
  });
}

/**
 * Reserve the space one axis needs perpendicular to its own direction.
 *
 * A y-axis reserves width (its widest label); an x-axis reserves height (its
 * tallest label, or the rotated footprint if labels were rotated).
 */
function measureAxis(
  axis: AxisInput,
  ticks: readonly ResolvedTick[],
  measureText: MeasureText
): number {
  if (axis.showLabels === false && axis.title === undefined) return 0;

  const labelFont = axis.labelFontSize ?? DEFAULT_LABEL_FONT;
  const tickLength = axis.tickLength ?? DEFAULT_TICK_LENGTH;
  const vertical = isVertical(axis.placement);

  let labelExtent = 0;
  if (axis.showLabels !== false) {
    for (const tick of ticks) {
      if (tick.hidden) continue;
      const m = measureText(tick.label, labelFont);
      if (tick.rotation !== 0) {
        // Rotated labels project onto both axes.
        const projected =
          Math.abs(m.width * Math.sin(tick.rotation)) +
          Math.abs(m.height * Math.cos(tick.rotation));
        labelExtent = Math.max(labelExtent, projected);
      } else {
        labelExtent = Math.max(labelExtent, vertical ? m.width : m.height);
      }
    }
  }

  let titleExtent = 0;
  if (axis.title !== undefined && axis.title.length > 0) {
    const titleFont = axis.titleFontSize ?? DEFAULT_TITLE_FONT;
    const m = measureText(axis.title, titleFont);
    // A vertical axis title is drawn rotated, so its height is what costs width.
    titleExtent = (vertical ? m.height : m.height) + TITLE_GAP;
  }

  return tickLength + LABEL_GAP + labelExtent + titleExtent;
}

/**
 * THE critical function: decide where the plot area actually is.
 *
 * Two passes, never more. The first pass measures labels against a provisional
 * plot rect; reserving space changes that rect, which changes how many ticks
 * fit, which changes the labels — so a second pass regenerates ticks against
 * the real size. A third pass buys almost nothing and risks oscillating between
 * two label counts forever, so it settles instead.
 *
 * The plot rect is clamped to at least 1x1 for any input, including a chart
 * smaller than its own padding. Layout runs on mount and resize only; it must
 * never throw and never return a negative rectangle.
 */
export function solveLayout(input: LayoutInput): Layout {
  const axes = input.axes ?? [];
  const measureText = input.measureText;

  const padTop = input.padding?.top ?? 8;
  const padRight = input.padding?.right ?? 8;
  const padBottom = input.padding?.bottom ?? 8;
  const padLeft = input.padding?.left ?? 8;

  // Title and legend claim their space first — neither depends on the ticks.
  let titleRect: Rect = createRect(0, 0, 0, 0);
  let topOffset = padTop;

  if (input.title !== undefined && input.title.text.length > 0) {
    const font = input.title.fontSize ?? 16;
    const m = measureText(input.title.text, font);
    titleRect = createRect(
      padLeft,
      topOffset,
      input.width - padLeft - padRight,
      m.height
    );
    topOffset += m.height + LABEL_GAP;
  }

  let legendRect: Rect = createRect(0, 0, 0, 0);
  let bottomOffset = padBottom;
  let leftOffset = padLeft;
  let rightOffset = padRight;

  if (input.legend !== undefined) {
    const lw = input.legend.widthPx ?? 0;
    const lh = input.legend.heightPx ?? 0;
    switch (input.legend.placement) {
      case 'top':
        legendRect = createRect(
          padLeft,
          topOffset,
          input.width - padLeft - padRight,
          lh
        );
        topOffset += lh + LABEL_GAP;
        break;
      case 'bottom':
        bottomOffset += lh + LABEL_GAP;
        legendRect = createRect(
          padLeft,
          input.height - bottomOffset,
          input.width - padLeft - padRight,
          lh
        );
        break;
      case 'left':
        legendRect = createRect(
          leftOffset,
          topOffset,
          lw,
          input.height - topOffset - bottomOffset
        );
        leftOffset += lw + LABEL_GAP;
        break;
      default:
        rightOffset += lw + LABEL_GAP;
        legendRect = createRect(
          input.width - rightOffset,
          topOffset,
          lw,
          input.height - topOffset - bottomOffset
        );
        break;
    }
  }

  const thickness = new Map<string, number>();
  for (const axis of axes) thickness.set(axis.id, 0);

  let plotArea = createRect(0, 0, 1, 1);
  let solved: SolvedAxis[] = [];

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    let reserveLeft = leftOffset;
    let reserveRight = rightOffset;
    let reserveTop = topOffset;
    let reserveBottom = bottomOffset;

    for (const axis of axes) {
      const t = thickness.get(axis.id) ?? 0;
      switch (axis.placement) {
        case 'left':
          reserveLeft += t;
          break;
        case 'right':
          reserveRight += t;
          break;
        case 'top':
          reserveTop += t;
          break;
        default:
          reserveBottom += t;
          break;
      }
    }

    // Rule (f): never a negative or zero-size plot, however absurd the input.
    const plotWidth = Math.max(1, input.width - reserveLeft - reserveRight);
    const plotHeight = Math.max(1, input.height - reserveTop - reserveBottom);
    plotArea = createRect(reserveLeft, reserveTop, plotWidth, plotHeight);

    solved = [];
    for (const axis of axes) {
      const vertical = isVertical(axis.placement);
      // Screen y grows downward, so a vertical scale's range is inverted.
      const range: readonly [number, number] = vertical
        ? [plotArea.y + plotArea.height, plotArea.y]
        : [plotArea.x, plotArea.x + plotArea.width];

      const scale = buildScale(axis.scale, range);
      const available = vertical ? plotArea.height : plotArea.width;

      const raw: LabelledTick[] = generateTicks(scale, available, {
        ...(axis.labelFormat !== undefined ? { format: axis.labelFormat } : {}),
      });

      const labelFont = axis.labelFontSize ?? DEFAULT_LABEL_FONT;
      const widths = raw.map((t) => measureText(t.label, labelFont).width);

      // Only horizontal axes collide — vertical labels are stacked with the
      // tick spacing already guaranteeing vertical separation.
      const resolved: ResolvedTick[] = vertical
        ? raw.map((t) => ({ ...t, rotation: 0, hidden: false }))
        : resolveCollisions(raw, available, axis.collisions ?? 'auto', {
            labelWidths: widths,
          });

      thickness.set(axis.id, measureAxis(axis, resolved, measureText));
      solved.push({
        id: axis.id,
        placement: axis.placement,
        scale,
        ticks: resolved,
        thickness: thickness.get(axis.id) ?? 0,
      });
    }
  }

  return { plotArea, axes: solved, legendRect, titleRect };
}
