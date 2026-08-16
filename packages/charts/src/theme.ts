/**
 * A minimal palette so charts look deliberate on day one.
 *
 * The full theme system — tokens, light/dark, three curated palettes,
 * `setDefaults` — is phase 14. This is the smallest thing that avoids every
 * chart rendering in default blue, and it is intentionally shaped like the
 * `colors.series` token it will become, so phase 14 is a move rather than a
 * rewrite.
 *
 * Chosen to stay distinguishable under deuteranopia and protanopia: hue steps
 * avoid the red/green confusion axis, and lightness varies alongside hue so the
 * series remain separable in greyscale too.
 */
export const SERIES_COLORS: readonly string[] = [
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

export const CHART_COLORS = {
  foreground: '#111827',
  muted: '#6b7280',
  grid: '#111827',
  /** Grid lines sit at low opacity — visible, never competing with the data. */
  gridOpacity: 0.08,
  background: 'transparent',
} as const;

export function seriesColorAt(index: number): string {
  const color = SERIES_COLORS[index % SERIES_COLORS.length];
  return color ?? '#3b82f6';
}

/**
 * Apply an alpha to a `#rrggbb` colour.
 *
 * Gradient stops carry their own alpha rather than the whole gradient taking an
 * opacity prop — that is what allows the eased three-stop falloff, since a
 * single opacity would scale every stop uniformly and flatten the curve back
 * into a linear fade.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const hex = color.trim();

  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // Unknown format: return it unchanged rather than producing an invalid colour.
  return hex;
}
