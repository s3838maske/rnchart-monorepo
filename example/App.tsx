import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  ActivityGauge,
  AngularAxis,
  Area,
  Bar,
  Chart,
  Crosshair,
  Gauge,
  Grid,
  Legend,
  Line,
  PieChart,
  PolarChart,
  PolarGrid,
  Radar,
  Scatter,
  Tooltip,
  WindRose,
  ZoomPan,
  XAxis,
  YAxis,
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

const SCATTERED = Array.from({ length: 40 }, (_, i) => ({
  x: i,
  y: Math.round(50 + Math.sin(i / 3) * 30 + ((i * 37) % 23)),
  weight: ((i * 17) % 40) + 5,
}));

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
            v1.1.0 · cartesian + polar · 10 chart types
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
