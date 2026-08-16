import { createScale } from '../scale/createScale';
import { createCartesian } from './cartesian';
import { categoryAngle, createPolar, uprightRotation } from './polar';

const TAU = Math.PI * 2;

const linear = (domain: [number, number], range: [number, number]) =>
  createScale({ type: 'linear', domain, range });

describe('cartesian coordinate system', () => {
  const coord = createCartesian({
    xScale: linear([0, 10], [0, 100]),
    yScale: linear([0, 100], [200, 0]),
  });

  it('projects data to pixels through the scales', () => {
    expect(coord.project(5, 50)).toEqual({ x: 50, y: 100 });
  });

  it('round-trips through invert', () => {
    const { dataX, dataY } = coord.invert(50, 100);
    expect(dataX).toBeCloseTo(5, 9);
    expect(dataY).toBeCloseTo(50, 9);
  });

  it('always connects with a straight line', () => {
    const segment = coord.pathBetween({ x: 0, y: 0 }, { x: 10, y: 10 }, 0, 1);
    expect(segment.kind).toBe('line');
    expect(segment.to).toEqual({ x: 10, y: 10 });
  });

  it('reports the baseline as a y pixel', () => {
    expect(coord.baseline(0)).toBe(200);
  });
});

describe('polar coordinate system', () => {
  const polar = createPolar({
    angleScale: linear([0, 4], [0, TAU]),
    radiusScale: linear([0, 100], [0, 200]),
    centerX: 500,
    centerY: 500,
  });

  it("places angle 0 at 12 o'clock", () => {
    const p = polar.project(0, 100);
    expect(p.x).toBeCloseTo(500, 6);
    expect(p.y).toBeCloseTo(300, 6); // straight up: centre minus radius
  });

  it('increases angle clockwise', () => {
    // A quarter turn clockwise from 12 o'clock is 3 o'clock.
    const p = polar.project(1, 100);
    expect(p.x).toBeCloseTo(700, 6);
    expect(p.y).toBeCloseTo(500, 6);
  });

  it("places a half turn at 6 o'clock", () => {
    const p = polar.project(2, 100);
    expect(p.x).toBeCloseTo(500, 6);
    expect(p.y).toBeCloseTo(700, 6);
  });

  it('honours counterclockwise direction', () => {
    const ccw = createPolar({
      angleScale: linear([0, 4], [0, TAU]),
      radiusScale: linear([0, 100], [0, 200]),
      centerX: 500,
      centerY: 500,
      direction: 'counterclockwise',
    });

    // A quarter turn the other way is 9 o'clock.
    const p = ccw.project(1, 100);
    expect(p.x).toBeCloseTo(300, 6);
    expect(p.y).toBeCloseTo(500, 6);
  });

  it('puts a zero radius at the centre', () => {
    const p = polar.project(1, 0);
    expect(p.x).toBeCloseTo(500, 6);
    expect(p.y).toBeCloseTo(500, 6);
  });

  it('round-trips through invert', () => {
    for (const [dataX, dataY] of [
      [0, 50],
      [1, 100],
      [2, 25],
      [3, 75],
    ] as const) {
      const p = polar.project(dataX, dataY);
      const back = polar.invert(p.x, p.y);
      expect(back.dataX).toBeCloseTo(dataX, 5);
      expect(back.dataY).toBeCloseTo(dataY, 5);
    }
  });

  it('inverts the centre to a zero radius', () => {
    expect(polar.invert(500, 500).dataY).toBeCloseTo(0, 6);
  });

  describe('pathBetween', () => {
    it('uses straight segments in polygon mode — the spiderweb radar', () => {
      const segment = polar.pathBetween(
        polar.project(0, 100),
        polar.project(1, 100),
        0,
        1
      );
      expect(segment.kind).toBe('line');
    });

    it('uses a true arc in circle mode at a constant radius', () => {
      const circular = createPolar({
        angleScale: linear([0, 4], [0, TAU]),
        radiusScale: linear([0, 100], [0, 200]),
        centerX: 500,
        centerY: 500,
        gridShape: 'circle',
      });

      const segment = circular.pathBetween(
        circular.project(0, 100),
        circular.project(1, 100),
        0,
        1
      );

      expect(segment.kind).toBe('arc');
      if (segment.kind === 'arc') {
        expect(segment.radius).toBeCloseTo(200, 6);
        expect(segment.sweep).toBeCloseTo(Math.PI / 2, 6);
        expect(segment.center).toEqual({ x: 500, y: 500 });
      }
    });

    it('falls back to a line when the radius changes', () => {
      // Two points at different radii trace a spiral, which is not one arc.
      // Drawing an arc anyway would be subtly wrong, so it must not.
      const circular = createPolar({
        angleScale: linear([0, 4], [0, TAU]),
        radiusScale: linear([0, 100], [0, 200]),
        centerX: 500,
        centerY: 500,
        gridShape: 'circle',
      });

      const segment = circular.pathBetween(
        circular.project(0, 100),
        circular.project(1, 40),
        0,
        1
      );

      expect(segment.kind).toBe('line');
    });
  });

  it('reports the baseline as a point, not a scalar', () => {
    const base = polar.baseline(0);
    expect(typeof base).toBe('object');
  });
});

describe('categoryAngle', () => {
  it('spreads categories evenly around a full turn', () => {
    expect(categoryAngle(0, 4)).toBeCloseTo(0, 9);
    expect(categoryAngle(1, 4)).toBeCloseTo(Math.PI / 2, 9);
    expect(categoryAngle(2, 4)).toBeCloseTo(Math.PI, 9);
  });

  it('respects a partial sweep', () => {
    expect(categoryAngle(1, 2, 0, Math.PI)).toBeCloseTo(Math.PI / 2, 9);
  });

  it('handles an empty domain', () => {
    expect(categoryAngle(0, 0)).toBe(0);
  });
});

describe('uprightRotation', () => {
  it('leaves upper-half labels alone', () => {
    expect(uprightRotation(0)).toBeCloseTo(0, 9);
    expect(uprightRotation(Math.PI / 4)).toBeCloseTo(Math.PI / 4, 9);
  });

  it('flips lower-half labels so they are never upside down', () => {
    // Without this, every label on the bottom of a radar reads inverted.
    expect(uprightRotation(Math.PI)).toBeCloseTo(TAU, 9);
    const flipped = uprightRotation((3 * Math.PI) / 4);
    expect(flipped).toBeCloseTo((3 * Math.PI) / 4 + Math.PI, 9);
  });

  it('normalises angles outside one turn', () => {
    expect(uprightRotation(TAU)).toBeCloseTo(0, 9);
    expect(uprightRotation(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 9);
  });
});
