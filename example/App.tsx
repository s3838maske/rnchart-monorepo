import type { ReactElement, ReactNode } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Area,
  Bar,
  Chart,
  Crosshair,
  Grid,
  Line,
  PieChart,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from '@rnchart/charts';

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
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>@rnchart</Text>
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
            Phases 1-12 · core, layout solver, decimation, hit-testing, 5
            series, cursor
          </Text>
        </View>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  content: { paddingTop: 64, paddingBottom: 48, paddingHorizontal: 16 },
  heading: { fontSize: 30, fontWeight: '700', letterSpacing: 0.3 },
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
