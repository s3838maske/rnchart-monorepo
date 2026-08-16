import { PALETTES } from './palettes';
import type { PaletteName } from './palettes';

export type ChartTheme = {
  readonly colors: {
    readonly series: readonly string[];
    readonly background: string;
    readonly foreground: string;
    readonly muted: string;
    readonly grid: string;
    readonly tooltip: {
      readonly bg: string;
      readonly text: string;
      readonly border: string;
    };
  };
  readonly typography: {
    readonly fontFamily?: string;
    readonly axisLabel: number;
    readonly dataLabel: number;
    readonly title: number;
    readonly letterSpacing: number;
  };
  readonly grid: {
    readonly width: number;
    readonly dash: readonly [number, number] | null;
    readonly opacity: number;
  };
  readonly animation: {
    readonly duration: number;
    readonly stagger: number;
    readonly spring: { readonly damping: number; readonly stiffness: number };
    readonly enabled: boolean;
  };
  readonly radii: {
    readonly bar: number;
    readonly tooltip: number;
  };
};

/**
 * A partial override of a theme.
 *
 * Nested groups are Omitted from the outer Partial before being re-added as
 * partials of their own. Intersecting `Partial<T>` with `{ nested?: Partial<N> }`
 * looks equivalent but is not: the intersection keeps the FULL `nested` from
 * `Partial<T>`, so overriding one tooltip colour would demand all three.
 */
export type ChartThemeInput = {
  readonly colors?: Partial<Omit<ChartTheme['colors'], 'tooltip'>> & {
    readonly tooltip?: Partial<ChartTheme['colors']['tooltip']>;
  };
  readonly typography?: Partial<ChartTheme['typography']>;
  readonly grid?: Partial<ChartTheme['grid']>;
  readonly animation?: Partial<Omit<ChartTheme['animation'], 'spring'>> & {
    readonly spring?: Partial<ChartTheme['animation']['spring']>;
  };
  readonly radii?: Partial<ChartTheme['radii']>;
};

const BASE_TYPOGRAPHY: ChartTheme['typography'] = {
  axisLabel: 11,
  dataLabel: 10,
  title: 16,
  // A touch of tracking at small sizes; axis labels read as cramped without it.
  letterSpacing: 0.3,
};

const BASE_ANIMATION: ChartTheme['animation'] = {
  duration: 450,
  stagger: 30,
  spring: { damping: 18, stiffness: 90 },
  enabled: true,
};

const BASE_RADII: ChartTheme['radii'] = { bar: 4, tooltip: 10 };

export function lightTheme(palette: PaletteName = 'vivid'): ChartTheme {
  return {
    colors: {
      series: PALETTES[palette],
      background: 'transparent',
      foreground: '#111827',
      muted: '#6b7280',
      grid: '#111827',
      tooltip: {
        bg: 'rgba(255,255,255,0.94)',
        text: '#111827',
        border: 'rgba(0,0,0,0.12)',
      },
    },
    typography: BASE_TYPOGRAPHY,
    // 8% is the sweet spot: present enough to guide the eye, faint enough that
    // the data always wins. Most chart libraries draw grid lines far too dark.
    grid: { width: 1, dash: null, opacity: 0.08 },
    animation: BASE_ANIMATION,
    radii: BASE_RADII,
  };
}

export function darkTheme(palette: PaletteName = 'vivid'): ChartTheme {
  return {
    colors: {
      series: PALETTES[palette],
      background: 'transparent',
      foreground: '#f9fafb',
      muted: '#9ca3af',
      grid: '#f9fafb',
      tooltip: {
        bg: 'rgba(24,24,27,0.94)',
        text: '#f9fafb',
        border: 'rgba(255,255,255,0.14)',
      },
    },
    typography: BASE_TYPOGRAPHY,
    // Light-on-dark grid lines read stronger at the same opacity, so ease off.
    grid: { width: 1, dash: null, opacity: 0.12 },
    animation: BASE_ANIMATION,
    radii: BASE_RADII,
  };
}

/**
 * Higher-contrast variant.
 *
 * Auto-activated in phase 27 from the OS accessibility setting. Heavier
 * strokes, stronger grid, pure black or white extremes.
 */
export function contrastTheme(dark: boolean): ChartTheme {
  const base = dark ? darkTheme('vivid') : lightTheme('vivid');
  return mergeTheme(base, {
    colors: {
      foreground: dark ? '#ffffff' : '#000000',
      muted: dark ? '#e5e7eb' : '#1f2937',
    },
    grid: { opacity: dark ? 0.3 : 0.22, width: 1.5 },
    typography: { axisLabel: 12, dataLabel: 11 },
  });
}

/**
 * Deep-merge a partial override onto a theme.
 *
 * Deep rather than shallow because a consumer overriding one tooltip colour
 * must not have to restate the other two. Nested objects are merged one level,
 * which covers every group in `ChartTheme`.
 */
export function mergeTheme(
  base: ChartTheme,
  override: ChartThemeInput | undefined
): ChartTheme {
  if (override === undefined) return base;

  return {
    colors: {
      ...base.colors,
      ...override.colors,
      tooltip: { ...base.colors.tooltip, ...override.colors?.tooltip },
    },
    typography: { ...base.typography, ...override.typography },
    grid: { ...base.grid, ...override.grid },
    animation: {
      ...base.animation,
      ...override.animation,
      spring: { ...base.animation.spring, ...override.animation?.spring },
    },
    radii: { ...base.radii, ...override.radii },
  };
}

/** Typed helper so consumers get autocomplete when authoring a theme. */
export function defineTheme(input: ChartThemeInput): ChartThemeInput {
  return input;
}
