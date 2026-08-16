export type Rgb = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

export type ColorVisionType =
  'normal' | 'deuteranopia' | 'protanopia' | 'tritanopia';

/** Parse `#rgb` or `#rrggbb`. Returns null for anything else. */
export function parseHex(color: string): Rgb | null {
  const hex = color.trim();

  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    const r = parseInt(hex[1]! + hex[1]!, 16);
    const g = parseInt(hex[2]! + hex[2]!, 16);
    const b = parseInt(hex[3]! + hex[3]!, 16);
    return { r, g, b };
  }

  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }

  return null;
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance. */
export function relativeLuminance(color: Rgb): number {
  return (
    0.2126 * srgbToLinear(color.r) +
    0.7152 * srgbToLinear(color.g) +
    0.0722 * srgbToLinear(color.b)
  );
}

/**
 * WCAG contrast ratio, 1 to 21.
 *
 * Used two ways: series colours against the chart background (the roadmap's
 * 3:1 floor), and picking readable text over a heatmap cell.
 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick black or white text for a background, by luminance.
 *
 * Phase 32's heatmaps need this per cell; doing it by luminance rather than a
 * fixed threshold is what keeps mid-tone cells readable.
 */
export function readableTextColor(background: string): '#000000' | '#ffffff' {
  const rgb = parseHex(background);
  if (rgb === null) return '#000000';
  const white = contrastRatio(rgb, { r: 255, g: 255, b: 255 });
  const black = contrastRatio(rgb, { r: 0, g: 0, b: 0 });
  return white >= black ? '#ffffff' : '#000000';
}

/**
 * Simulate colour-vision deficiency (Brettel/Viénot-style LMS approximation).
 *
 * Approximate, not clinical — good enough to catch a palette where two
 * adjacent series collapse into the same colour, which is the failure this
 * exists to prevent.
 */
export function simulate(color: Rgb, type: ColorVisionType): Rgb {
  if (type === 'normal') return color;

  const { r, g, b } = color;

  // Matrices operate on linear-ish sRGB; the approximation is standard.
  const matrices: Record<Exclude<ColorVisionType, 'normal'>, number[]> = {
    deuteranopia: [0.625, 0.375, 0.0, 0.7, 0.3, 0.0, 0.0, 0.3, 0.7],
    protanopia: [0.567, 0.433, 0.0, 0.558, 0.442, 0.0, 0.0, 0.242, 0.758],
    tritanopia: [0.95, 0.05, 0.0, 0.0, 0.433, 0.567, 0.0, 0.475, 0.525],
  };

  const m = matrices[type];
  const clamp = (v: number): number =>
    Math.max(0, Math.min(255, Math.round(v)));

  return {
    r: clamp(
      (m[0] as number) * r + (m[1] as number) * g + (m[2] as number) * b
    ),
    g: clamp(
      (m[3] as number) * r + (m[4] as number) * g + (m[5] as number) * b
    ),
    b: clamp(
      (m[6] as number) * r + (m[7] as number) * g + (m[8] as number) * b
    ),
  };
}

/**
 * Perceptual distance between two colours.
 *
 * A weighted Euclidean distance in sRGB ("redmean"), which tracks human
 * perception far better than plain RGB distance at a fraction of CIEDE2000's
 * complexity. Sufficient for "are these two series colours distinguishable",
 * which is the only question asked of it.
 */
export function perceptualDistance(a: Rgb, b: Rgb): number {
  const rMean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;

  return Math.sqrt(
    (2 + rMean / 256) * dr * dr +
      4 * dg * dg +
      (2 + (255 - rMean) / 256) * db * db
  );
}

export type PaletteReport = {
  readonly ok: boolean;
  readonly failures: readonly {
    readonly type: ColorVisionType;
    readonly indexA: number;
    readonly indexB: number;
    readonly distance: number;
  }[];
};

/**
 * Check that ADJACENT palette entries stay distinguishable under every
 * simulated colour vision type.
 *
 * Adjacent only, deliberately: a chart assigns colours in order, so series 1
 * and 2 sharing a screen matters enormously while series 1 and 7 rarely
 * appear together without a legend to disambiguate. Requiring all pairs to be
 * distinct would make an eight-colour palette impossible.
 */
export function verifyPalette(
  colors: readonly string[],
  minDistance = 60
): PaletteReport {
  const types: ColorVisionType[] = [
    'normal',
    'deuteranopia',
    'protanopia',
    'tritanopia',
  ];
  const failures: {
    type: ColorVisionType;
    indexA: number;
    indexB: number;
    distance: number;
  }[] = [];

  for (const type of types) {
    for (let i = 0; i < colors.length - 1; i += 1) {
      const a = parseHex(colors[i] as string);
      const b = parseHex(colors[i + 1] as string);
      if (a === null || b === null) continue;

      const distance = perceptualDistance(simulate(a, type), simulate(b, type));
      if (distance < minDistance) {
        failures.push({ type, indexA: i, indexB: i + 1, distance });
      }
    }
  }

  return { ok: failures.length === 0, failures };
}
