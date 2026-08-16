import { useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { StreamingChartRef } from 'react-native-graphify';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  ActivityGauge,
  AngularAxis,
  Annotations,
  Area,
  AreaRange,
  Bar,
  BoxPlot,
  Chart,
  ChartAccessibility,
  Crosshair,
  DataTable,
  DataTableToggle,
  Drilldown,
  Dumbbell,
  ErrorBars,
  Gauge,
  Grid,
  Legend,
  Line,
  Pattern,
  PieChart,
  PlotBand,
  PlotLine,
  PolarChart,
  PolarGrid,
  Radar,
  Scatter,
  StreamingChart,
  Tooltip,
  Waterfall,
  WindRose,
  ZoomPan,
  XAxis,
  YAxis,
  histogram,
  useChart,
  waterfallDomain,
} from 'react-native-graphify';

const MONTHLY = [
  { month: 'Jan', revenue: 210, target: 180, units: 42 },
  { month: 'Feb', revenue: 340, target: 240, units: 61 },
  { month: 'Mar', revenue: 180, target: 260, units: 33 },
  { month: 'Apr', revenue: 420, target: 300, units: 78 },
  { month: 'May', revenue: 390, target: 340, units: 70 },
  { month: 'Jun', revenue: 560, target: 380, units: 96 },
  { month: 'Jul', revenue: 480, target: 420, units: 84 },
  { month: 'Aug', revenue: 610, target: 460, units: 110 },
];

const WITH_GAPS = [
  { month: 'Jan', value: 20 },
  { month: 'Feb', value: 45 },
  { month: 'Mar', value: null },
  { month: 'Apr', value: null },
  { month: 'May', value: 62 },
  { month: 'Jun', value: 38 },
  { month: 'Jul', value: 74 },
  { month: 'Aug', value: 55 },
];

const SPLIT = [
  { label: 'Mobile', share: 46 },
  { label: 'Desktop', share: 28 },
  { label: 'Tablet', share: 14 },
  { label: 'Other', share: 12 },
];

const SKILLS = [
  { axis: 'Speed', alpha: 82, beta: 55 },
  { axis: 'Power', alpha: 64, beta: 78 },
  { axis: 'Range', alpha: 45, beta: 90 },
  { axis: 'Accuracy', alpha: 88, beta: 61 },
  { axis: 'Control', alpha: 70, beta: 72 },
  { axis: 'Stamina', alpha: 55, beta: 84 },
];

const WIND = [
  { dir: 'N', calm: 12, breeze: 8, gale: 3 },
  { dir: 'NE', calm: 7, breeze: 11, gale: 2 },
  { dir: 'E', calm: 15, breeze: 6, gale: 1 },
  { dir: 'SE', calm: 9, breeze: 13, gale: 4 },
  { dir: 'S', calm: 18, breeze: 9, gale: 6 },
  { dir: 'SW', calm: 11, breeze: 15, gale: 5 },
  { dir: 'W', calm: 6, breeze: 10, gale: 8 },
  { dir: 'NW', calm: 10, breeze: 7, gale: 3 },
];

const COUNTRIES = [
  { name: 'India', value: 420 },
  { name: 'Japan', value: 310 },
  { name: 'Brazil', value: 260 },
];

const STATES: Record<string, { name: string; value: number }[]> = {
  India: [
    { name: 'MH', value: 160 },
    { name: 'KA', value: 140 },
    { name: 'TN', value: 120 },
  ],
  Japan: [
    { name: 'Tokyo', value: 180 },
    { name: 'Osaka', value: 130 },
  ],
  Brazil: [
    { name: 'SP', value: 150 },
    { name: 'RJ', value: 110 },
  ],
};

const CITIES: Record<string, { name: string; value: number }[]> = {
  MH: [
    { name: 'Pune', value: 90 },
    { name: 'Nagpur', value: 70 },
  ],
  KA: [{ name: 'Bengaluru', value: 140 }],
};

const FORECAST = [
  { day: 'Mon', low: 12, high: 22, actual: 18 },
  { day: 'Tue', low: 14, high: 26, actual: 21 },
  { day: 'Wed', low: 11, high: 19, actual: 13 },
  { day: 'Thu', low: 16, high: 29, actual: 27 },
  { day: 'Fri', low: 18, high: 31, actual: 24 },
  { day: 'Sat', low: 15, high: 25, actual: 20 },
  { day: 'Sun', low: 13, high: 23, actual: 22 },
];

const PAY_GAP = [
  { role: 'Eng', before: 62, after: 91 },
  { role: 'Design', before: 48, after: 74 },
  { role: 'Sales', before: 71, after: 83 },
  { role: 'Support', before: 39, after: 66 },
];

/**
 * Four samples with deliberately different shapes: tight, wide, skewed, and one
 * carrying outliers — so the box plot has something to distinguish.
 *
 * n = 24 each, not 10. The notch is 1.58 x IQR / sqrt(n) against a box of one
 * IQR, so below n = 10 the notch is wider than the box and the outline pinches
 * shut into a bowtie. That is real statistics — R prints "notches went outside
 * hinges" for it — but it makes a demo look broken rather than informative.
 */
const SAMPLES = [
  Array.from({ length: 24 }, (_, i) => 45 + ((i * 7) % 5) - 2),
  Array.from({ length: 24 }, (_, i) => 20 + i * 3 + ((i * 11) % 7)),
  Array.from(
    { length: 24 },
    (_, i) => 30 + Math.round(((i * 13) % 17) * 0.8) + (i > 20 ? i * 3 : 0)
  ),
  [...Array.from({ length: 22 }, (_, i) => 50 + ((i * 5) % 9)), 5, 99],
];

const BOX_CATEGORIES = SAMPLES.map((values, i) => ({
  group: ['Tight', 'Wide', 'Skewed', 'Outliers'][i] as string,
  // The chart needs a numeric column to build a y domain from; the box plot
  // reads the raw samples itself.
  median: values[Math.floor(values.length / 2)] as number,
}));

const CASHFLOW = [
  { step: 'Open', delta: 120 },
  { step: 'Sales', delta: 86 },
  { step: 'Refunds', delta: -24 },
  { step: 'Costs', delta: -52 },
  { step: 'Tax', delta: -18 },
  { step: 'Close', delta: 0 },
];

const CASHFLOW_SUMS = [5];

// The chart would otherwise scale to the largest single DELTA (120) while the
// bars climb to 206, silently clipping everything above the top.
const CASHFLOW_DOMAIN = waterfallDomain(
  CASHFLOW.map((s, i) => ({
    label: s.step,
    value: s.delta,
    isSum: CASHFLOW_SUMS.includes(i),
  }))
);

/** Roughly normal, so Freedman–Diaconis has something sensible to bin. */
const MEASUREMENTS = Array.from({ length: 240 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  return 50 + (a - Math.floor(a) + (b - Math.floor(b)) - 1) * 18;
});

const BINS = histogram(MEASUREMENTS).map((bin) => ({
  bin: String(Math.round(bin.x0)),
  count: bin.count,
}));

const SCATTERED = Array.from({ length: 40 }, (_, i) => ({
  x: i,
  y: Math.round(50 + Math.sin(i / 3) * 30 + ((i * 37) % 23)),
  weight: ((i * 17) % 40) + 5,
}));

/**
 * Simulated 60Hz sensor feed.
 *
 * Drives the chart entirely through its ref — this component never calls
 * setState, so React does not reconcile on any of the 60 appends per second.
 */
function LiveFeed({ mode }: { mode: 'scroll' | 'sweep' }): ReactElement {
  const chart = useRef<StreamingChartRef>(null);

  useEffect(() => {
    let t = 0;
    const id = setInterval(() => {
      t += 1;
      const value =
        Math.sin(t / 12) * 40 + Math.sin(t / 3.1) * 8 + (t % 97 === 0 ? 35 : 0);
      chart.current?.append({ x: t, y: value });
    }, 16);

    return () => {
      clearInterval(id);
    };
  }, []);

  return <StreamingChart ref={chart} mode={mode} capacity={240} height={160} />;
}

/**
 * Cross-hatch over one value band — a "below target" zone.
 *
 * `<Pattern>` takes explicit bounds rather than reading the chart, so it can be
 * scoped to a region or a single bar as easily as the whole plot. That means
 * the caller supplies them, and `useChart` is where they come from.
 */
function HatchedZone({ from, to }: { from: number; to: number }): ReactElement {
  const { plotArea, yScale } = useChart();
  const yTop = yScale.map(to);
  const yBottom = yScale.map(from);

  return (
    <Pattern
      kind="cross-hatch"
      color="#ef4444"
      bounds={{
        x: plotArea.x,
        y: yTop,
        width: plotArea.width,
        height: Math.abs(yBottom - yTop),
      }}
      spacing={6}
      opacity={0.35}
    />
  );
}

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: ReactNode;
}): ReactElement {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCaption}>{caption}</Text>
      {children}
    </View>
  );
}

export default function App(): ReactElement {
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);
  const [tableOpen, setTableOpen] = useState(false);

  const toggleKey = (key: string): void => {
    setHiddenKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Toggling removes the series entirely, so the domain recomputes against
  // what is left rather than leaving a gap where the hidden series was.
  const visibleKeys = ['revenue', 'target'].filter(
    (k) => !hiddenKeys.includes(k)
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>react-native-graphify</Text>
        <Text style={styles.subheading}>
          Skia-powered charts for React Native
        </Text>

        <Section
          title="Touch me — cursor, crosshair and tooltip"
          caption="Drag across the chart. Crosshair and dots run entirely on the UI thread; haptics fire once per snapped point, never per frame."
        >
          <Chart
            data={MONTHLY}
            xKey="month"
            yKeys={['revenue', 'target']}
            height={240}
            cursor
            haptics
            overlay={<Tooltip />}
          >
            <Grid />
            <YAxis />
            <XAxis />
            <Area seriesKey="revenue" strokeWidth={2.5} />
            <Line seriesKey="target" strokeWidth={2} />
            <Crosshair />
          </Chart>
        </Section>

        <Section
          title="Line"
          caption="Two series, monotone curve, markers. Curve never overshoots the data."
        >
          <Chart
            data={MONTHLY}
            xKey="month"
            yKeys={['revenue', 'target']}
            height={220}
          >
            <Grid />
            <YAxis />
            <XAxis />
            <Line seriesKey="revenue" markers />
            <Line seriesKey="target" curve="monotone" strokeWidth={2} />
          </Chart>
        </Section>

        <Section
          title="Area"
          caption="Three-stop eased gradient, not a linear fade."
        >
          <Chart data={MONTHLY} xKey="month" yKeys={['revenue']} height={200}>
            <Grid />
            <YAxis />
            <XAxis />
            <Area seriesKey="revenue" />
          </Chart>
        </Section>

        <Section
          title="Column"
          caption="Grouped. All bars of a series draw as one path."
        >
          <Chart
            data={MONTHLY}
            xKey="month"
            yKeys={['revenue', 'target']}
            height={200}
          >
            <Grid />
            <YAxis />
            <XAxis />
            <Bar grouped />
          </Chart>
        </Section>

        <Section
          title="Missing data"
          caption="March and April are null — the line genuinely breaks."
        >
          <Chart data={WITH_GAPS} xKey="month" yKeys={['value']} height={180}>
            <Grid />
            <YAxis />
            <XAxis />
            <Area seriesKey="value" />
          </Chart>
        </Section>

        <Section
          title="Step"
          caption="Step curve, for values that hold until they change."
        >
          <Chart data={MONTHLY} xKey="month" yKeys={['units']} height={180}>
            <Grid />
            <YAxis />
            <XAxis />
            <Line seriesKey="units" curve="step" />
          </Chart>
        </Section>

        <Section title="Scatter" caption="40 points, linear x axis.">
          <Chart
            data={SCATTERED}
            xKey="x"
            yKeys={['y']}
            xScale="linear"
            height={200}
          >
            <Grid />
            <YAxis />
            <XAxis />
            <Scatter seriesKey="y" />
          </Chart>
        </Section>

        <Section
          title="Bubble"
          caption="Third value mapped to radius through a sqrt scale, so area encodes magnitude."
        >
          <Chart
            data={SCATTERED}
            xKey="x"
            yKeys={['y', 'weight']}
            xScale="linear"
            height={200}
          >
            <Grid />
            <YAxis />
            <XAxis />
            <Scatter seriesKey="y" sizeKey="weight" opacity={0.55} />
          </Chart>
        </Section>

        <Section
          title="Legend — tap to toggle"
          caption="Hidden series dim rather than vanish, and the y domain rescales to what remains."
        >
          <Chart data={MONTHLY} xKey="month" yKeys={visibleKeys} height={200}>
            <Grid />
            <YAxis />
            <XAxis />
            <Bar grouped />
          </Chart>
          <Legend
            items={['revenue', 'target']}
            hidden={hiddenKeys}
            onToggle={toggleKey}
            align="center"
          />
        </Section>

        <Section
          title="Radar"
          caption="Two series over 6 axes. <Radar> only draws — the polar coordinate system does the projection."
        >
          <PolarChart
            data={SKILLS}
            categoryKey="axis"
            yKeys={['alpha', 'beta']}
            height={300}
          >
            <PolarGrid />
            <AngularAxis />
            <Radar seriesKey="alpha" />
            <Radar seriesKey="beta" />
          </PolarChart>
        </Section>

        <Section
          title="Radar — independent axes"
          caption="Each spoke normalises to its own min/max. Essential when the axes are in different units."
        >
          <PolarChart
            data={SKILLS}
            categoryKey="axis"
            yKeys={['alpha', 'beta']}
            independentAxes
            height={300}
          >
            <PolarGrid />
            <AngularAxis />
            <Radar seriesKey="alpha" />
            <Radar seriesKey="beta" />
          </PolarChart>
        </Section>

        <Section
          title="Wind rose"
          caption="Stacked polar columns over 8 compass directions."
        >
          <PolarChart
            data={WIND}
            categoryKey="dir"
            yKeys={['calm', 'breeze', 'gale']}
            stacked
            height={300}
          >
            <PolarGrid rings={3} spokes={false} />
            <AngularAxis />
            <WindRose />
          </PolarChart>
        </Section>

        <Section
          title="Gauge"
          caption="Coloured bands across an arbitrary angle range, with a tapered needle."
        >
          <Gauge
            value={72}
            bands={[
              { from: 0, to: 40, color: '#10b981' },
              { from: 40, to: 75, color: '#f59e0b' },
              { from: 75, to: 100, color: '#ef4444' },
            ]}
            height={200}
          >
            <Text style={styles.donutValue}>72</Text>
            <Text style={styles.donutLabel}>Load</Text>
          </Gauge>
        </Section>

        <Section
          title="Activity rings"
          caption="Concentric progress rings with rounded caps."
        >
          <ActivityGauge
            rings={[
              { value: 82, max: 100 },
              { value: 61, max: 100 },
              { value: 45, max: 100 },
            ]}
            height={240}
          >
            <Text style={styles.donutValue}>82%</Text>
            <Text style={styles.donutLabel}>Move</Text>
          </ActivityGauge>
        </Section>

        <Section
          title="Radar — gradient fill"
          caption="A radial gradient runs centre-outward, matching how the eye reads distance from the middle as magnitude."
        >
          <PolarChart
            data={SKILLS}
            categoryKey="axis"
            yKeys={['alpha']}
            height={300}
          >
            <PolarGrid />
            <AngularAxis />
            <Radar
              seriesKey="alpha"
              gradient={{
                type: 'radial',
                colors: [
                  'rgba(139, 92, 246, 0.05)',
                  'rgba(59, 130, 246, 0.45)',
                  'rgba(6, 182, 212, 0.75)',
                ],
                positions: [0, 0.55, 1],
              }}
              markerSize={4}
            />
          </PolarChart>
        </Section>

        <Section
          title="Gradient column"
          caption="Any series takes the same gradient spec — a colour array is the short form."
        >
          <Chart data={MONTHLY} xKey="month" yKeys={['revenue']} height={200}>
            <Grid />
            <YAxis />
            <XAxis />
            <Bar
              seriesKey="revenue"
              gradient={['#8b5cf6', '#3b82f6', '#06b6d4']}
              cornerRadius={6}
            />
          </Chart>
        </Section>

        <Section
          title="Pinch to zoom, drag to pan"
          caption="Pinch anchors at your fingers, not the centre. A flick carries momentum and rubber-bands at the data edges. Double-tap resets."
        >
          <Chart
            data={MONTHLY}
            xKey="month"
            yKeys={['revenue']}
            height={220}
            zoomable
          >
            <Grid />
            <YAxis />
            <XAxis />
            <ZoomPan>
              <Line seriesKey="revenue" markers />
            </ZoomPan>
          </Chart>
        </Section>

        <Section
          title="Streaming — scroll"
          caption="60 appends per second through a ref. No setState, so React never reconciles. Memory is flat: a fixed ring buffer, allocated once."
        >
          <LiveFeed mode="scroll" />
        </Section>

        <Section
          title="Streaming — sweep"
          caption="The ECG pattern: a fixed window overwritten left to right by a moving write head."
        >
          <LiveFeed mode="sweep" />
        </Section>

        <Section
          title="Drilldown — tap a bar"
          caption="Country → state → city. Breadcrumbs navigate back, and Android's hardware back button ascends one level before falling through."
        >
          <Drilldown
            data={COUNTRIES}
            rootLabel="Countries"
            labelKey="name"
            transition="slide"
            onDrill={(datum) => {
              const key = String(datum.name);

              const states = STATES[key];
              if (states !== undefined) return states;

              // The third level is deliberately async, to exercise the
              // loading path and prove the spinner clears on arrival.
              const cities = CITIES[key];
              if (cities !== undefined) {
                return new Promise<typeof cities>((resolve) => {
                  setTimeout(() => {
                    resolve(cities);
                  }, 400);
                });
              }

              return null;
            }}
          >
            {(api) => (
              <Chart
                data={api.level.data}
                xKey="name"
                yKeys={['value']}
                height={200}
                onPointPress={(i) => {
                  api.drill(i);
                }}
              >
                <Grid />
                <YAxis />
                <XAxis />
                <Bar seriesKey="value" cornerRadius={6} />
              </Chart>
            )}
          </Drilldown>
        </Section>

        <Section
          title="Annotations — plot lines and bands"
          caption="Positioned in DATA coordinates, so they track pan and zoom instead of drifting. Labels dodge the ones already placed."
        >
          <Chart data={MONTHLY} xKey="month" yKeys={['revenue']} height={230}>
            <Grid />
            <YAxis />
            <XAxis />
            <PlotBand axis="y" from={380} to={520} label="Target range" />
            <HatchedZone from={0} to={250} />
            <PlotLine axis="y" value={450} label="Goal 450" color="#ef4444" />
            <PlotLine
              axis="y"
              value={300}
              label="Break-even"
              dash={[4, 4]}
              labelAlign="start"
            />
            <Line seriesKey="revenue" markers />
            <Annotations
              items={[
                {
                  id: 'peak',
                  x: 'Aug',
                  y: 610,
                  text: 'Record month',
                  connector: true,
                },
                { id: 'dip', x: 'Mar', y: 180, text: 'Supply issue' },
              ]}
            />
          </Chart>
        </Section>

        <Section
          title="Area range + line"
          caption="Forecast band with the actual over it. The range is declared first so the line lands on top."
        >
          <Chart
            data={FORECAST}
            xKey="day"
            yKeys={['low', 'high', 'actual']}
            height={220}
          >
            <Grid />
            <YAxis />
            <XAxis />
            <AreaRange lowKey="low" highKey="high" />
            <Line seriesKey="actual" markers strokeWidth={2.5} />
          </Chart>
        </Section>

        <Section
          title="Dumbbell"
          caption="Before and after, joined. Reads as change per row rather than two bars you have to mentally subtract."
        >
          <Chart
            data={PAY_GAP}
            xKey="role"
            yKeys={['before', 'after']}
            height={200}
          >
            <Grid />
            <YAxis />
            <XAxis />
            <Dumbbell lowKey="before" highKey="after" markerSize={6} />
          </Chart>
        </Section>

        <Section
          title="Box plot"
          caption="Tukey whiskers reach the extreme value INSIDE the fence, never the fence itself. Quartiles come from core, tested against R."
        >
          <Chart
            data={BOX_CATEGORIES}
            xKey="group"
            yKeys={['median']}
            height={260}
            yDomain={[0, 105]}
          >
            <Grid />
            <YAxis />
            <XAxis />
            <BoxPlot groups={SAMPLES} showMean notched />
          </Chart>
        </Section>

        <Section
          title="Error bars"
          caption="Attachable over any series — here a column with its confidence interval."
        >
          <Chart
            data={FORECAST}
            xKey="day"
            yKeys={['actual', 'low', 'high']}
            height={200}
          >
            <Grid />
            <YAxis />
            <XAxis />
            <Bar seriesKey="actual" cornerRadius={4} />
            <ErrorBars lowKey="low" highKey="high" />
          </Chart>
        </Section>

        <Section
          title="Waterfall"
          caption="Running totals with connectors. The closing bar is a subtotal, so it rises from zero rather than stacking on the running total."
        >
          <Chart
            data={CASHFLOW}
            xKey="step"
            yKeys={['delta']}
            height={220}
            yDomain={CASHFLOW_DOMAIN}
          >
            <Grid />
            <YAxis />
            <XAxis />
            <Waterfall valueKey="delta" sumIndices={CASHFLOW_SUMS} />
          </Chart>
        </Section>

        <Section
          title="Histogram"
          caption="240 samples binned by Freedman–Diaconis, which uses the IQR and so survives an outlier that would blow Scott's bin width out."
        >
          <Chart data={BINS} xKey="bin" yKeys={['count']} height={200}>
            <Grid />
            <YAxis />
            <XAxis />
            <Bar seriesKey="count" cornerRadius={2} />
          </Chart>
        </Section>

        <Section
          title="Pattern fills"
          caption="Texture instead of colour alone, so the series stay distinguishable in greyscale and under colour-vision deficiency."
        >
          <Chart
            data={MONTHLY}
            xKey="month"
            yKeys={['revenue', 'target']}
            height={200}
          >
            <Grid />
            <YAxis />
            <XAxis />
            <Bar
              grouped
              cornerRadius={4}
              pattern="diagonal"
              patternColor="#1e3a8a"
            />
          </Chart>
        </Section>

        <Section
          title="Accessibility — turn on VoiceOver or TalkBack"
          caption="A Skia canvas is invisible to screen readers. This adds a spoken summary plus one focusable element per point, in data order."
        >
          <Chart
            data={MONTHLY}
            xKey="month"
            yKeys={['revenue']}
            height={200}
            overlay={
              <ChartAccessibility
                chartType="Line chart"
                title="Monthly revenue"
                formatValue={(v) => `${String(Math.round(v))} thousand`}
              />
            }
          >
            <Grid />
            <YAxis />
            <XAxis />
            <Line seriesKey="revenue" markers />
          </Chart>

          <DataTableToggle
            expanded={tableOpen}
            onPress={() => {
              setTableOpen((v) => !v);
            }}
          />
          {tableOpen ? (
            <DataTable
              data={MONTHLY}
              xKey="month"
              seriesKeys={['revenue', 'target']}
            />
          ) : null}
        </Section>

        <Section title="Donut" caption="Arc geometry computed in core.">
          <PieChart
            data={SPLIT}
            valueKey="share"
            innerRadius={0.62}
            height={240}
          >
            <View style={styles.donutCentre}>
              <Text style={styles.donutValue}>46%</Text>
              <Text style={styles.donutLabel}>Mobile</Text>
            </View>
          </PieChart>
        </Section>

        <Section title="Pie" caption="Same renderer, innerRadius 0.">
          <PieChart data={SPLIT} valueKey="share" height={240} />
        </Section>

        <Section title="Semi-circle" caption="Arbitrary start and end angle.">
          <PieChart
            data={SPLIT}
            valueKey="share"
            innerRadius={0.55}
            startAngle={-180}
            endAngle={0}
            height={180}
          />
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            v1.4.0 · cartesian + polar + statistical · 18 chart types
          </Text>
        </View>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  content: { paddingTop: 64, paddingBottom: 48, paddingHorizontal: 16 },
  heading: { fontSize: 26, fontWeight: '700', letterSpacing: 0.3 },
  subheading: { fontSize: 14, opacity: 0.55, marginTop: 2, marginBottom: 8 },
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 17, fontWeight: '600' },
  sectionCaption: { fontSize: 12, opacity: 0.5, marginTop: 2, marginBottom: 8 },
  donutCentre: { alignItems: 'center' },
  donutValue: { fontSize: 26, fontWeight: '700' },
  donutLabel: { fontSize: 12, opacity: 0.55 },
  footer: { marginTop: 36, alignItems: 'center' },
  footerText: { fontSize: 11, opacity: 0.4 },
});
