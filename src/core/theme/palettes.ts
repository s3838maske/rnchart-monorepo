export type PaletteName = 'vivid' | 'muted' | 'mono';

/**
 * The three shipped palettes.
 *
 * These are a marketing asset as much as a technical one — the default look is
 * what a developer judges the library on in the first ten seconds — so they are
 * chosen, not generated.
 *
 * Every palette is built to survive colour-vision deficiency. The hue steps
 * avoid relying on the red/green axis to separate ADJACENT series, and
 * lightness varies alongside hue so the series stay distinguishable in
 * greyscale too. `verifyPalette` in ./contrast checks the perceptual distance
 * claim rather than leaving it as an assertion in a comment.
 */
export const PALETTES: Record<PaletteName, readonly string[]> = {
  // Saturated and high contrast — consumer apps, dashboards meant to pop.
  vivid: [
    '#3b82f6',
    '#f59e0b',
    '#10b981',
    '#8b5cf6',
    '#ef4444',
    '#06b6d4',
    '#ec4899',
    '#84cc16',
  ],
  // Desaturated — dense analytics screens where many series share one chart
  // and full saturation becomes visual noise. Deliberately ALTERNATES dark and
  // light: lightness is the one channel every colour-vision type preserves, so
  // alternating it is what keeps adjacent series apart under simulation. An
  // all-mid-tone muted palette fails deuteranopia, which is how the first
  // version of this was written.
  muted: [
    '#4a6fa5',
    '#d9a441',
    '#3f7d63',
    '#b09bd4',
    '#9e4f4a',
    '#7fc3cf',
    '#8c5578',
    '#c3cf87',
  ],
  // Single hue at varying lightness — print-style reports and anywhere colour
  // cannot be relied on at all.
  mono: [
    '#0b1220',
    '#26364f',
    '#42597c',
    '#6480a6',
    '#8ba3c4',
    '#b0c2da',
    '#d0dcea',
    '#eef3f9',
  ],
};

export function paletteColorAt(palette: PaletteName, index: number): string {
  const colors = PALETTES[palette];
  const color =
    colors[((index % colors.length) + colors.length) % colors.length];
  return color ?? '#3b82f6';
}
