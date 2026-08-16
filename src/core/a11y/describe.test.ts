import {
  describeChart,
  describeOutliers,
  describePoint,
  describeSeries,
} from './describe';

describe('describeSeries', () => {
  it('finds the extremes with their indices', () => {
    const d = describeSeries([5, 2, 9, 4]);

    expect(d?.min).toEqual({ index: 1, value: 2 });
    expect(d?.max).toEqual({ index: 2, value: 9 });
  });

  it('calls a clean rise increasing', () => {
    expect(describeSeries([1, 2, 3, 4, 5, 6])?.trend).toBe('increasing');
  });

  it('calls a clean fall decreasing', () => {
    expect(describeSeries([60, 50, 40, 30, 20])?.trend).toBe('decreasing');
  });

  it('measures trend RELATIVE to the spread, not absolutely', () => {
    // Identical slope, wildly different spread. An absolute cutoff would have
    // to call these the same thing; they are not the same thing.
    //
    // The noisy series is the tight one plus an alternating +/-500, which is
    // symmetric about the centre and so contributes exactly zero to the
    // regression slope while dominating the standard deviation.
    const tight = describeSeries([0, 5, 10, 15, 20]);
    const noisy = describeSeries([500, -495, 510, -485, 520]);

    expect(tight?.slope).toBeCloseTo(noisy?.slope ?? 0, 6);
    expect(tight?.trend).toBe('increasing');
    expect(noisy?.trend).toBe('volatile');
  });

  it('calls a constant series flat', () => {
    expect(describeSeries([7, 7, 7, 7])?.trend).toBe('flat');
  });

  it('computes change as a percentage of the first value', () => {
    expect(describeSeries([200, 300])?.changePercent).toBeCloseTo(50, 9);
  });

  it('avoids dividing by a zero first value', () => {
    expect(describeSeries([0, 50])?.changePercent).toBe(0);
  });

  it('skips non-finite values', () => {
    const d = describeSeries([1, Number.NaN, 3]);
    expect(d?.min.value).toBe(1);
    expect(d?.max.value).toBe(3);
  });

  it('returns null when there is nothing usable', () => {
    expect(describeSeries([])).toBeNull();
    expect(describeSeries([Number.NaN])).toBeNull();
  });
});

describe('describeChart', () => {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr'];

  it('leads with the chart type and carries the point of the chart', () => {
    const text = describeChart([10, 20, 30, 40], {
      chartType: 'Line chart',
      title: 'Revenue',
      categoryLabels: MONTHS,
    });

    expect(text.startsWith('Line chart.')).toBe(true);
    expect(text).toContain('Revenue.');
    expect(text).toContain('Jan to Apr.');
    expect(text).toContain('4 data points.');
    expect(text).toContain('increasing');
  });

  it('names the categories where the extremes fall', () => {
    const text = describeChart([10, 90, 30, 40], {
      categoryLabels: MONTHS,
    });

    expect(text).toContain('at Jan');
    expect(text).toContain('at Feb');
  });

  it('does NOT run the percentage through formatValue', () => {
    // The bug this exists to catch: formatValue formats values in the series'
    // own units, and a percentage is not one. Reusing it produced
    // "Overall up 190 thousand percent" on a chart measured in thousands.
    const text = describeChart([210, 610], {
      formatValue: (v) => `${String(Math.round(v))} thousand`,
    });

    expect(text).toContain('Overall up 190 percent.');
    expect(text).not.toContain('thousand percent');
  });

  it('still formats the VALUES with formatValue', () => {
    const text = describeChart([210, 610], {
      formatValue: (v) => `${String(Math.round(v))} thousand`,
    });

    expect(text).toContain('210 thousand');
    expect(text).toContain('610 thousand');
  });

  it('omits the change sentence when there is no clear trend', () => {
    const text = describeChart([500, -495, 510, -485, 520]);

    expect(text).toContain('no clear trend');
    expect(text).not.toContain('percent.');
  });

  it('handles no data without throwing', () => {
    expect(describeChart([])).toBe('Chart. No data.');
  });
});

describe('describePoint', () => {
  it('includes the position, so swiping feels navigable', () => {
    expect(describePoint(2, 12, 45, { label: 'Mar' })).toBe('Mar, 45, 3 of 12');
  });

  it('says so when a point has no data', () => {
    expect(describePoint(0, 3, Number.NaN, { label: 'Jan' })).toBe(
      'Jan, no data, 1 of 3'
    );
  });

  it('works without a label', () => {
    expect(describePoint(0, 2, 7)).toBe('7, 1 of 2');
  });
});

describe('describeOutliers', () => {
  it('names an outlier by its category', () => {
    const values = [10, 11, 12, 11, 10, 12, 11, 400];
    const text = describeOutliers(values, {
      categoryLabels: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'spike'],
    });

    expect(text).toBe('One outlier, at spike.');
  });

  it('reports when there are none', () => {
    expect(describeOutliers([10, 11, 12, 13, 14])).toBe('No outliers.');
  });

  it('returns empty for a sample too small to fence', () => {
    expect(describeOutliers([1, 2])).toBe('');
  });
});
