export type MissingPolicy = 'connect' | 'gap' | 'zero';

export type NormalisedSeries = {
  /** Values after the policy has been applied. */
  readonly values: Float32Array;
  /**
   * 1 where the source datum was a real finite number, 0 where it was
   * null, undefined or NaN.
   *
   * A mask rather than sentinel values because the renderer needs to know the
   * difference between "the data said zero" and "there was no data" — under
   * the `zero` policy both look identical in `values`.
   */
  readonly valid: Uint8Array;
};

export type MissingInput = ArrayLike<number | null | undefined>;

function isMissing(v: number | null | undefined): boolean {
  return v === null || v === undefined || !Number.isFinite(v);
}

/**
 * Apply a missing-data policy, returning values plus a validity mask.
 *
 * The three policies answer the same question differently:
 *
 * - `gap`     — emit NaN. The line renderer issues a fresh `moveTo`, so the
 *               line genuinely breaks. This is the honest default: a gap in
 *               the data should look like a gap.
 * - `connect` — linearly interpolate across the hole so the line runs through
 *               it. Leading and trailing holes carry the nearest known value,
 *               since there is nothing to interpolate between.
 * - `zero`    — treat the hole as zero. Correct for counts, badly misleading
 *               for prices, which is why it is not the default.
 *
 * The mask is identical under all three policies. Only `values` differs.
 */
export function normaliseMissing(
  data: MissingInput,
  policy: MissingPolicy = 'gap'
): NormalisedSeries {
  const n = data.length;
  const values = new Float32Array(n);
  const valid = new Uint8Array(n);

  for (let i = 0; i < n; i += 1) {
    const v = data[i];
    if (isMissing(v)) {
      valid[i] = 0;
      values[i] = policy === 'zero' ? 0 : Number.NaN;
    } else {
      valid[i] = 1;
      values[i] = v as number;
    }
  }

  if (policy !== 'connect') return { values, valid };

  // Interpolate every run of holes that has a valid neighbour on both sides;
  // carry the nearest value for runs at either end.
  let i = 0;
  while (i < n) {
    if (valid[i] === 1) {
      i += 1;
      continue;
    }

    const runStart = i;
    while (i < n && valid[i] === 0) i += 1;
    const runEnd = i; // first valid index after the run, or n

    const hasLeft = runStart > 0;
    const hasRight = runEnd < n;

    if (!hasLeft && !hasRight) break; // nothing valid anywhere

    if (!hasLeft) {
      const right = values[runEnd] as number;
      values.fill(right, runStart, runEnd);
    } else if (!hasRight) {
      const left = values[runStart - 1] as number;
      values.fill(left, runStart, runEnd);
    } else {
      const left = values[runStart - 1] as number;
      const right = values[runEnd] as number;
      const steps = runEnd - runStart + 1;
      for (let k = runStart; k < runEnd; k += 1) {
        const t = (k - runStart + 1) / steps;
        values[k] = left + (right - left) * t;
      }
    }
  }

  return { values, valid };
}
