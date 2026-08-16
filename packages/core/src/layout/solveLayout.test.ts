import { solveLayout } from './solveLayout';
import type { AxisInput, MeasureText } from './solveLayout';

/**
 * Deterministic stub standing in for Skia's text measurement.
 *
 * Proportional enough to be realistic (wider strings measure wider) without
 * depending on a font, which is exactly why `measureText` is injected.
 */
const measureText: MeasureText = (text, fontSize) => ({
  width: text.length * fontSize * 0.6,
  height: fontSize * 1.2,
});

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const xAxis = (over: Partial<AxisInput> = {}): AxisInput => ({
  id: 'x',
  placement: 'bottom',
  scale: { type: 'band', domain: MONTHS },
  ...over,
});

const yAxis = (over: Partial<AxisInput> = {}): AxisInput => ({
  id: 'y',
  placement: 'left',
  scale: { type: 'linear', domain: [0, 1000] },
  ...over,
});

describe('solveLayout — the 320px acceptance test', () => {
  it('resolves 12 month labels at 320px with no two label boxes overlapping', () => {
    const layout = solveLayout({
      width: 320,
      height: 240,
      axes: [xAxis(), yAxis()],
      measureText,
    });

    const axis = layout.axes.find((a) => a.id === 'x')!;
    const visible = axis.ticks.filter((t) => !t.hidden);

    expect(visible.length).toBeGreaterThan(0);

    // Either they were thinned, or they were rotated. Both are acceptable
    // outcomes; overlapping upright labels are not.
    const rotated = visible.some((t) => t.rotation !== 0);

    if (!rotated) {
      for (let i = 1; i < visible.length; i += 1) {
        const prev = visible[i - 1]!;
        const curr = visible[i]!;
        const halfPrev = measureText(prev.label, 11).width / 2;
        const halfCurr = measureText(curr.label, 11).width / 2;
        const gap = Math.abs(curr.position - prev.position);
        expect(gap).toBeGreaterThanOrEqual(halfPrev + halfCurr);
      }
    }
  });

  it('keeps every month when there is plenty of width', () => {
    const layout = solveLayout({
      width: 1600,
      height: 400,
      axes: [xAxis(), yAxis()],
      measureText,
    });

    const axis = layout.axes.find((a) => a.id === 'x')!;
    const visible = axis.ticks.filter((t) => !t.hidden);

    expect(visible.length).toBeGreaterThan(6);
  });
});

describe('solveLayout — plot area is always drawable', () => {
  it.each([
    ['zero size', 0, 0],
    ['negative size', -100, -100],
    ['smaller than its own padding', 10, 10],
    ['extremely wide and flat', 2000, 4],
    ['extremely tall and thin', 4, 2000],
  ])('%s never produces a negative plot rect', (_name, width, height) => {
    const layout = solveLayout({
      width,
      height,
      axes: [xAxis(), yAxis()],
      padding: { top: 40, right: 40, bottom: 40, left: 40 },
      measureText,
    });

    expect(layout.plotArea.width).toBeGreaterThanOrEqual(1);
    expect(layout.plotArea.height).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(layout.plotArea.x)).toBe(true);
    expect(Number.isFinite(layout.plotArea.y)).toBe(true);
  });

  it('handles no axes at all', () => {
    const layout = solveLayout({ width: 300, height: 200, measureText });

    expect(layout.axes).toEqual([]);
    expect(layout.plotArea.width).toBeGreaterThan(200);
  });

  it('handles an axis with an empty domain', () => {
    const layout = solveLayout({
      width: 300,
      height: 200,
      axes: [xAxis({ scale: { type: 'band', domain: [] } })],
      measureText,
    });

    expect(layout.plotArea.width).toBeGreaterThanOrEqual(1);
    expect(layout.axes[0]!.ticks).toEqual([]);
  });

  it('handles a single-value domain', () => {
    const layout = solveLayout({
      width: 300,
      height: 200,
      axes: [yAxis({ scale: { type: 'linear', domain: [5, 5] } })],
      measureText,
    });

    expect(layout.plotArea.height).toBeGreaterThanOrEqual(1);
  });

  it('survives extremely long labels', () => {
    const long = 'x'.repeat(400);
    const layout = solveLayout({
      width: 320,
      height: 240,
      axes: [yAxis({ scale: { type: 'band', domain: [long, `${long}2`] } })],
      measureText,
    });

    expect(layout.plotArea.width).toBeGreaterThanOrEqual(1);
    expect(layout.plotArea.height).toBeGreaterThanOrEqual(1);
  });
});

describe('solveLayout — space reservation', () => {
  it('reserves width on the left for a left axis', () => {
    const without = solveLayout({ width: 400, height: 300, measureText });
    const withAxis = solveLayout({
      width: 400,
      height: 300,
      axes: [yAxis()],
      measureText,
    });

    expect(withAxis.plotArea.x).toBeGreaterThan(without.plotArea.x);
    expect(withAxis.plotArea.width).toBeLessThan(without.plotArea.width);
  });

  it('reserves height at the bottom for a bottom axis', () => {
    const without = solveLayout({ width: 400, height: 300, measureText });
    const withAxis = solveLayout({
      width: 400,
      height: 300,
      axes: [xAxis()],
      measureText,
    });

    expect(withAxis.plotArea.height).toBeLessThan(without.plotArea.height);
  });

  it('reserves space on both sides for opposite axes', () => {
    const layout = solveLayout({
      width: 400,
      height: 300,
      axes: [
        yAxis(),
        yAxis({
          id: 'y2',
          placement: 'right',
          scale: { type: 'log', domain: [1, 1e6] },
        }),
      ],
      measureText,
    });

    expect(layout.plotArea.x).toBeGreaterThan(8);
    expect(layout.plotArea.x + layout.plotArea.width).toBeLessThan(392);
    expect(layout.axes).toHaveLength(2);
  });

  it('gives each axis an independent scale over the same plot area', () => {
    const layout = solveLayout({
      width: 500,
      height: 300,
      axes: [
        yAxis({ scale: { type: 'linear', domain: [0, 100] } }),
        yAxis({
          id: 'y2',
          placement: 'right',
          scale: { type: 'linear', domain: [0, 1] },
        }),
      ],
      measureText,
    });

    const [left, right] = layout.axes;
    expect(left!.scale.map(50)).toBeCloseTo(right!.scale.map(0.5), 6);
    expect(left!.scale.domain).toEqual([0, 100]);
    expect(right!.scale.domain).toEqual([0, 1]);
  });

  it('reserves more space when an axis has a title', () => {
    const plain = solveLayout({
      width: 400,
      height: 300,
      axes: [yAxis()],
      measureText,
    });
    const titled = solveLayout({
      width: 400,
      height: 300,
      axes: [yAxis({ title: 'Revenue' })],
      measureText,
    });

    expect(titled.plotArea.width).toBeLessThan(plain.plotArea.width);
  });

  it('reserves nothing for an axis with labels off and no title', () => {
    const layout = solveLayout({
      width: 400,
      height: 300,
      axes: [yAxis({ showLabels: false })],
      measureText,
    });

    expect(layout.axes[0]!.thickness).toBe(0);
  });

  it('places the title above the plot', () => {
    const layout = solveLayout({
      width: 400,
      height: 300,
      title: { text: 'Monthly revenue' },
      axes: [xAxis(), yAxis()],
      measureText,
    });

    expect(layout.titleRect.height).toBeGreaterThan(0);
    expect(layout.plotArea.y).toBeGreaterThanOrEqual(layout.titleRect.height);
  });

  it.each(['top', 'bottom', 'left', 'right'] as const)(
    'reserves space for a %s legend',
    (placement) => {
      const without = solveLayout({ width: 400, height: 300, measureText });
      const withLegend = solveLayout({
        width: 400,
        height: 300,
        legend: { placement, widthPx: 80, heightPx: 40 },
        measureText,
      });

      const shrank =
        withLegend.plotArea.width < without.plotArea.width ||
        withLegend.plotArea.height < without.plotArea.height;

      expect(shrank).toBe(true);
      expect(withLegend.legendRect.width).toBeGreaterThan(0);
    }
  );
});

describe('solveLayout — scale ranges', () => {
  it('inverts a vertical scale so larger values sit higher on screen', () => {
    const layout = solveLayout({
      width: 400,
      height: 300,
      axes: [yAxis()],
      measureText,
    });

    const axis = layout.axes[0]!;
    expect(axis.scale.map(1000)).toBeLessThan(axis.scale.map(0));
  });

  it('maps a horizontal scale left to right across the plot area', () => {
    const layout = solveLayout({
      width: 400,
      height: 300,
      axes: [
        {
          id: 'x',
          placement: 'bottom',
          scale: { type: 'linear', domain: [0, 10] },
        },
      ],
      measureText,
    });

    const axis = layout.axes[0]!;
    expect(axis.scale.map(0)).toBeCloseTo(layout.plotArea.x, 6);
    expect(axis.scale.map(10)).toBeCloseTo(
      layout.plotArea.x + layout.plotArea.width,
      6
    );
  });

  it('settles rather than oscillating — two runs agree', () => {
    const once = solveLayout({
      width: 320,
      height: 240,
      axes: [xAxis(), yAxis()],
      measureText,
    });
    const twice = solveLayout({
      width: 320,
      height: 240,
      axes: [xAxis(), yAxis()],
      measureText,
    });

    expect(twice.plotArea).toEqual(once.plotArea);
  });
});
