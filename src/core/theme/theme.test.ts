import {
  contrastRatio,
  parseHex,
  perceptualDistance,
  readableTextColor,
  simulate,
  verifyPalette,
} from './contrast';
import { PALETTES, paletteColorAt } from './palettes';
import {
  contrastTheme,
  darkTheme,
  defineTheme,
  lightTheme,
  mergeTheme,
} from './tokens';

describe('parseHex', () => {
  it('parses 6-digit hex', () => {
    expect(parseHex('#3b82f6')).toEqual({ r: 59, g: 130, b: 246 });
  });

  it('parses 3-digit shorthand', () => {
    expect(parseHex('#f00')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('returns null for anything else', () => {
    expect(parseHex('rgb(1,2,3)')).toBeNull();
    expect(parseHex('nonsense')).toBeNull();
    expect(parseHex('')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black on white', () => {
    expect(
      contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })
    ).toBeCloseTo(21, 1);
  });

  it('is 1:1 for a colour against itself', () => {
    expect(
      contrastRatio({ r: 40, g: 90, b: 120 }, { r: 40, g: 90, b: 120 })
    ).toBe(1);
  });

  it('is symmetric', () => {
    const a = { r: 10, g: 200, b: 90 };
    const b = { r: 240, g: 30, b: 60 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });
});

describe('readableTextColor', () => {
  it('picks white on a dark background', () => {
    expect(readableTextColor('#0f172a')).toBe('#ffffff');
  });

  it('picks black on a light background', () => {
    expect(readableTextColor('#e2e8f0')).toBe('#000000');
  });

  it('falls back to black for an unparseable colour', () => {
    expect(readableTextColor('not-a-colour')).toBe('#000000');
  });
});

describe('simulate', () => {
  it('leaves colours untouched for normal vision', () => {
    const c = { r: 12, g: 34, b: 56 };
    expect(simulate(c, 'normal')).toEqual(c);
  });

  it('collapses red and green toward each other under deuteranopia', () => {
    const red = parseHex('#ff0000')!;
    const green = parseHex('#00ff00')!;

    const normalGap = perceptualDistance(red, green);
    const simulatedGap = perceptualDistance(
      simulate(red, 'deuteranopia'),
      simulate(green, 'deuteranopia')
    );

    expect(simulatedGap).toBeLessThan(normalGap);
  });

  it('keeps every channel in range', () => {
    for (const type of ['deuteranopia', 'protanopia', 'tritanopia'] as const) {
      const out = simulate({ r: 255, g: 255, b: 255 }, type);
      for (const channel of [out.r, out.g, out.b]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('shipped palettes', () => {
  // The roadmap asks for an automated check rather than a manual eyeball.
  // This is that check: adjacent series must stay apart under every simulated
  // colour vision type, because a chart assigns colours in order.
  it.each(['vivid', 'muted', 'mono'] as const)(
    '%s keeps adjacent series distinguishable under CVD simulation',
    (name) => {
      const report = verifyPalette(PALETTES[name]);
      expect(report.failures).toEqual([]);
      expect(report.ok).toBe(true);
    }
  );

  it.each(['vivid', 'muted', 'mono'] as const)(
    '%s has at least 8 colours',
    (name) => {
      expect(PALETTES[name].length).toBeGreaterThanOrEqual(8);
    }
  );

  it('reports failures for a deliberately bad palette', () => {
    // Two near-identical blues — the check must catch this, or it proves
    // nothing about the real palettes.
    const report = verifyPalette(['#3b82f6', '#3b84f8']);
    expect(report.ok).toBe(false);
    expect(report.failures.length).toBeGreaterThan(0);
  });

  it('wraps the palette by index', () => {
    expect(paletteColorAt('vivid', 0)).toBe(paletteColorAt('vivid', 8));
    expect(paletteColorAt('vivid', -1)).toBeDefined();
  });
});

describe('themes', () => {
  it('light and dark differ in foreground', () => {
    expect(lightTheme().colors.foreground).not.toBe(
      darkTheme().colors.foreground
    );
  });

  it('selects the requested palette', () => {
    expect(lightTheme('mono').colors.series).toEqual(PALETTES.mono);
  });

  it('raises grid opacity on dark, where light lines read stronger', () => {
    expect(darkTheme().grid.opacity).toBeGreaterThan(lightTheme().grid.opacity);
  });

  it('contrast theme is stronger than the base theme', () => {
    expect(contrastTheme(false).grid.opacity).toBeGreaterThan(
      lightTheme().grid.opacity
    );
    expect(contrastTheme(false).colors.foreground).toBe('#000000');
    expect(contrastTheme(true).colors.foreground).toBe('#ffffff');
  });
});

describe('mergeTheme', () => {
  it('returns the base untouched with no override', () => {
    const base = lightTheme();
    expect(mergeTheme(base, undefined)).toBe(base);
  });

  it('merges nested colour groups without dropping siblings', () => {
    const merged = mergeTheme(lightTheme(), {
      colors: { tooltip: { bg: '#123456' } },
    });

    expect(merged.colors.tooltip.bg).toBe('#123456');
    // The point of a deep merge: the other two survive.
    expect(merged.colors.tooltip.text).toBe(lightTheme().colors.tooltip.text);
    expect(merged.colors.foreground).toBe(lightTheme().colors.foreground);
  });

  it('merges the spring config without dropping the other half', () => {
    const merged = mergeTheme(lightTheme(), {
      animation: { spring: { damping: 5 } },
    });

    expect(merged.animation.spring.damping).toBe(5);
    expect(merged.animation.spring.stiffness).toBe(
      lightTheme().animation.spring.stiffness
    );
  });

  it('can disable animation wholesale', () => {
    expect(
      mergeTheme(lightTheme(), { animation: { enabled: false } }).animation
        .enabled
    ).toBe(false);
  });

  it('defineTheme is an identity helper for typing', () => {
    const input = { radii: { bar: 12 } };
    expect(defineTheme(input)).toEqual(input);
  });
});
