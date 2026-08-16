import { createContext, useContext, useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import {
  darkTheme,
  lightTheme,
  mergeTheme,
  paletteColorAt,
} from '@rnchart/core';
import type { ChartTheme, ChartThemeInput, PaletteName } from '@rnchart/core';

export type ColorSchemeName = 'light' | 'dark' | 'system';

/**
 * Global defaults.
 *
 * Module-level state, deliberately: `setDefaults` is meant to be called once at
 * app start, and threading a provider through every chart in an app just to
 * change the palette is the friction that makes people give up on theming.
 */
let globalOverride: ChartThemeInput | undefined;
let globalPalette: PaletteName = 'vivid';

/**
 * Rebrand every chart in the app with one call.
 *
 * Resolution order, narrowest wins:
 *   chart `theme` prop > `<ChartThemeProvider>` > `setDefaults` > built-in
 */
export function setDefaults(
  input: ChartThemeInput & { readonly palette?: PaletteName }
): void {
  const { palette, ...rest } = input;
  if (palette !== undefined) globalPalette = palette;
  globalOverride =
    globalOverride === undefined ? rest : mergeInputs(globalOverride, rest);
}

/** Reset global defaults. Exposed mainly so tests do not leak into each other. */
export function resetDefaults(): void {
  globalOverride = undefined;
  globalPalette = 'vivid';
}

function mergeInputs(a: ChartThemeInput, b: ChartThemeInput): ChartThemeInput {
  return {
    colors: {
      ...a.colors,
      ...b.colors,
      tooltip: { ...a.colors?.tooltip, ...b.colors?.tooltip },
    },
    typography: { ...a.typography, ...b.typography },
    grid: { ...a.grid, ...b.grid },
    animation: {
      ...a.animation,
      ...b.animation,
      spring: { ...a.animation?.spring, ...b.animation?.spring },
    },
    radii: { ...a.radii, ...b.radii },
  };
}

type ProviderValue = {
  readonly override: ChartThemeInput | undefined;
  readonly palette: PaletteName | undefined;
  readonly colorScheme: ColorSchemeName | undefined;
};

const ThemeContext = createContext<ProviderValue | null>(null);

export type ChartThemeProviderProps = {
  readonly theme?: ChartThemeInput;
  readonly palette?: PaletteName;
  readonly colorScheme?: ColorSchemeName;
  readonly children: ReactNode;
};

/** Scope a theme override to a subtree. */
export function ChartThemeProvider({
  theme,
  palette,
  colorScheme,
  children,
}: ChartThemeProviderProps): ReactElement {
  const value = useMemo<ProviderValue>(
    () => ({ override: theme, palette, colorScheme }),
    [theme, palette, colorScheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export type UseChartThemeOptions = {
  readonly theme?: ChartThemeInput;
  readonly palette?: PaletteName;
  readonly colorScheme?: ColorSchemeName;
};

/**
 * Resolve the effective theme.
 *
 * Dark mode follows the OS by default via `useColorScheme`, so a consumer gets
 * correct dark charts without writing any code — which is the entire point of
 * a theme system that ships defaults.
 */
export function useChartTheme(options: UseChartThemeOptions = {}): ChartTheme {
  const provider = useContext(ThemeContext);
  const systemScheme = useColorScheme();

  const scheme = options.colorScheme ?? provider?.colorScheme ?? 'system';
  const isDark =
    scheme === 'system' ? systemScheme === 'dark' : scheme === 'dark';

  const palette = options.palette ?? provider?.palette ?? globalPalette;

  return useMemo(() => {
    const base = isDark ? darkTheme(palette) : lightTheme(palette);
    // Widest to narrowest.
    return mergeTheme(
      mergeTheme(mergeTheme(base, globalOverride), provider?.override),
      options.theme
    );
  }, [isDark, palette, provider?.override, options.theme]);
}

/** Series colour by index, from the resolved theme. */
export function seriesColor(theme: ChartTheme, index: number): string {
  const colors = theme.colors.series;
  if (colors.length === 0) return paletteColorAt('vivid', index);
  return (
    colors[((index % colors.length) + colors.length) % colors.length] ??
    paletteColorAt('vivid', index)
  );
}
