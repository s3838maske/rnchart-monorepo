/**
 * @rnchart/charts — the public API consumers import.
 *
 * Phases 5-11: the `<Chart>` shell, axes and grid, and the cartesian series
 * (line, area, bar, scatter) plus pie. Tooltip, legend and the theme system
 * follow in phases 12-14.
 */

export { VERSION } from './version';

export { Chart } from './Chart';
export type { ChartProps, XScaleKind } from './Chart';

export { useChart } from './ChartContext';
export type { ChartContextValue, SeriesDatum } from './ChartContext';

export { Grid, XAxis, YAxis } from './axis/Axes';
export type { AxisProps, GridProps } from './axis/Axes';

export { Line } from './series/Line';
export type { CurveKind, LineProps } from './series/Line';

export { Area } from './series/Area';
export type { AreaProps } from './series/Area';

export { Bar } from './series/Bar';
export type { BarProps } from './series/Bar';

export { Scatter } from './series/Scatter';
export type { ScatterProps, ScatterShape } from './series/Scatter';

export { PieChart } from './series/Pie';
export type { PieChartProps } from './series/Pie';

export { Crosshair } from './interaction/Crosshair';
export type { CrosshairProps } from './interaction/Crosshair';

export { Tooltip } from './interaction/Tooltip';
export type { TooltipProps } from './interaction/Tooltip';

export { useCursor, nearestIndexByX } from './interaction/cursorState';
export type { CursorState } from './interaction/cursorState';

export { Legend } from './overlays/Legend';
export type { LegendItem, LegendProps, LegendSymbol } from './overlays/Legend';

export { useChartAnimation } from './theme/useChartAnimation';
export type { ChartAnimation } from './theme/useChartAnimation';

export {
  ChartThemeProvider,
  resetDefaults,
  seriesColor,
  setDefaults,
  useChartTheme,
} from './theme/ThemeProvider';
export type {
  ChartThemeProviderProps,
  ColorSchemeName,
  UseChartThemeOptions,
} from './theme/ThemeProvider';

export { SERIES_COLORS, seriesColorAt, withAlpha } from './colors';

export { Placeholder } from './Placeholder';
export type { PlaceholderProps } from './Placeholder';
