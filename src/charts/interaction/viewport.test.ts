import { clampTranslate, zoomAboutFocal } from './viewport';

describe('clampTranslate', () => {
  it('pins translation to zero when not zoomed in', () => {
    // Nothing to pan at scale 1 — allowing it would drag the data off screen
    // with no obvious way back.
    expect(clampTranslate(-200, 1, 400)).toBe(0);
    expect(clampTranslate(500, 0.5, 400)).toBe(0);
  });

  it('allows panning within the zoomed extent', () => {
    // At 2x over a 400px plot there are 400px of hidden content.
    expect(clampTranslate(-100, 2, 400)).toBe(-100);
    expect(clampTranslate(-400, 2, 400)).toBe(-400);
  });

  it('stops at the left edge', () => {
    // Positive translation would reveal empty space before the first datum.
    expect(clampTranslate(50, 2, 400)).toBe(0);
  });

  it('stops at the right edge', () => {
    expect(clampTranslate(-999, 2, 400)).toBe(-400);
  });

  it('scales the pannable range with the zoom factor', () => {
    expect(clampTranslate(-1e6, 4, 400)).toBe(-1200);
    expect(clampTranslate(-1e6, 8, 400)).toBe(-2800);
  });

  it('handles a zero-width plot', () => {
    expect(clampTranslate(-100, 4, 0)).toBe(0);
  });
});

describe('zoomAboutFocal', () => {
  it('keeps the focal point stationary', () => {
    // The invariant that makes a pinch feel direct: whatever is under the
    // fingers must stay under the fingers.
    const focal = 150;
    const from = 1;
    const to = 2;
    const translate = 0;

    const next = zoomAboutFocal(focal, from, to, translate);

    // Content position under the focal point, before and after.
    const before = (focal - translate) / from;
    const after = (focal - next) / to;
    expect(after).toBeCloseTo(before, 9);
  });

  it('keeps the focal point stationary when already panned', () => {
    const focal = 220;
    const from = 2.5;
    const to = 4;
    const translate = -180;

    const next = zoomAboutFocal(focal, from, to, translate);

    const before = (focal - translate) / from;
    const after = (focal - next) / to;
    expect(after).toBeCloseTo(before, 9);
  });

  it('is a no-op when the scale does not change', () => {
    expect(zoomAboutFocal(100, 3, 3, -50)).toBeCloseTo(-50, 9);
  });

  it('zooming at the left edge keeps translation at the left edge', () => {
    expect(zoomAboutFocal(0, 1, 4, 0)).toBeCloseTo(0, 9);
  });

  it('survives a degenerate current scale', () => {
    expect(zoomAboutFocal(100, 0, 2, -20)).toBe(-20);
  });

  it('anchoring at the focal differs from anchoring at the origin', () => {
    // If these were equal the implementation would be the centre-anchored bug
    // the focal maths exists to avoid.
    const focal = 300;
    const atFocal = zoomAboutFocal(focal, 1, 3, 0);
    const atOrigin = 0;
    expect(atFocal).not.toBeCloseTo(atOrigin, 3);
  });
});
