export type FormatType = 'number' | 'currency' | 'percent' | 'time' | 'compact';

export type FormatSpec = {
  readonly type?: FormatType;
  readonly locale?: string;
  /** ISO 4217 code, for `currency`. */
  readonly currency?: string;
  readonly decimals?: number;
  /** Date pattern hint for `time`. Ignored by the other types. */
  readonly timeStyle?: 'auto' | 'time' | 'day' | 'month' | 'year';
  /** Escape hatch. Wins over everything else. */
  readonly formatter?: (value: number) => string;
};

const COMPACT_UNITS: readonly {
  readonly at: number;
  readonly suffix: string;
}[] = [
  { at: 1e12, suffix: 'T' },
  { at: 1e9, suffix: 'B' },
  { at: 1e6, suffix: 'M' },
  { at: 1e3, suffix: 'k' },
];

/** `Intl` is present on every supported runtime, but Hermes has shipped without it. */
function hasIntl(): boolean {
  return typeof Intl !== 'undefined' && typeof Intl.NumberFormat === 'function';
}

function trimTrailingZero(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/**
 * Compact notation: 1_200 -> "1.2k", 3_400_000 -> "3.4M".
 *
 * Hand-rolled rather than delegating to `Intl.NumberFormat({notation:'compact'})`
 * because Intl renders 1.2K with a capital K in en-US, and axis labels
 * conventionally use a lowercase k for thousands.
 */
function formatCompact(value: number, decimals: number | undefined): string {
  const abs = Math.abs(value);
  const unit = COMPACT_UNITS.find((u) => abs >= u.at);

  if (unit === undefined) {
    return decimals === undefined
      ? trimTrailingZero(String(Number(value.toFixed(2))))
      : value.toFixed(decimals);
  }

  const scaled = value / unit.at;
  const places = decimals ?? (Math.abs(scaled) < 10 ? 1 : 0);
  return `${trimTrailingZero(scaled.toFixed(places))}${unit.suffix}`;
}

function formatTime(value: number, spec: FormatSpec): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  if (!hasIntl()) return date.toISOString().slice(0, 10);

  const style = spec.timeStyle ?? 'auto';
  const options: Intl.DateTimeFormatOptions =
    style === 'time'
      ? { hour: '2-digit', minute: '2-digit' }
      : style === 'day'
        ? { day: 'numeric', month: 'short' }
        : style === 'month'
          ? { month: 'short', year: 'numeric' }
          : style === 'year'
            ? { year: 'numeric' }
            : { day: 'numeric', month: 'short' };

  try {
    return new Intl.DateTimeFormat(spec.locale, options).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Format an axis or data label.
 *
 * Shared by axes and data labels deliberately — phase 13's labels call this
 * same function so a chart's labels and its axis can never disagree about how
 * a number is written.
 *
 * Falls back gracefully when `Intl` is unavailable rather than throwing: a
 * missing locale API should degrade a label, not blank a chart.
 */
export function formatValue(value: number, spec: FormatSpec = {}): string {
  if (spec.formatter !== undefined) return spec.formatter(value);
  if (!Number.isFinite(value)) return '';

  const type = spec.type ?? 'number';

  if (type === 'compact') return formatCompact(value, spec.decimals);
  if (type === 'time') return formatTime(value, spec);

  if (!hasIntl()) {
    const fixed =
      spec.decimals === undefined
        ? trimTrailingZero(String(Number(value.toFixed(6))))
        : value.toFixed(spec.decimals);
    if (type === 'percent')
      return `${trimTrailingZero((value * 100).toFixed(spec.decimals ?? 0))}%`;
    return fixed;
  }

  const options: Intl.NumberFormatOptions =
    type === 'currency'
      ? { style: 'currency', currency: spec.currency ?? 'USD' }
      : type === 'percent'
        ? { style: 'percent' }
        : {};

  if (spec.decimals !== undefined) {
    options.minimumFractionDigits = spec.decimals;
    options.maximumFractionDigits = spec.decimals;
  }

  try {
    return new Intl.NumberFormat(spec.locale, options).format(value);
  } catch {
    return String(value);
  }
}
