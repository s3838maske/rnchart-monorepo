import { useCallback } from 'react';
import type { ReactElement } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useChartTheme } from '../theme/ThemeProvider';
import { seriesColor } from '../theme/ThemeProvider';

export type LegendSymbol = 'circle' | 'square' | 'line';

export type LegendItem = {
  readonly key: string;
  readonly label?: string;
  readonly color?: string;
};

export type LegendProps = {
  readonly items: readonly (string | LegendItem)[];
  /** Keys currently hidden. Controlled. */
  readonly hidden?: readonly string[];
  readonly onToggle?: (key: string) => void;
  readonly symbol?: LegendSymbol;
  readonly layout?: 'horizontal' | 'vertical';
  readonly wrap?: boolean;
  readonly scrollable?: boolean;
  readonly align?: 'start' | 'center' | 'end';
  readonly style?: StyleProp<ViewStyle>;
};

const MIN_TOUCH_TARGET = 44;

function normalise(item: string | LegendItem): LegendItem {
  return typeof item === 'string' ? { key: item } : item;
}

/**
 * Legend with tap-to-toggle.
 *
 * A React Native view rather than a Skia layer, deliberately. It needs real
 * touch targets, text selection and screen-reader labels; Skia gives none of
 * those, and a legend is the part of a chart a screen-reader user is most
 * likely to want.
 *
 * Every item presents a 44pt minimum touch target regardless of how small the
 * swatch and text render — the accessibility floor phase 27 enforces globally,
 * applied here from the start because retrofitting hit areas is worse than
 * building them in.
 */
export function Legend({
  items,
  hidden = [],
  onToggle,
  symbol = 'circle',
  layout = 'horizontal',
  wrap = true,
  scrollable = false,
  align = 'start',
  style,
}: LegendProps): ReactElement {
  const theme = useChartTheme();
  const entries = items.map(normalise);

  const isHidden = useCallback((key: string) => hidden.includes(key), [hidden]);

  const content = (
    <View
      style={[
        styles.container,
        layout === 'vertical' ? styles.vertical : styles.horizontal,
        wrap && layout === 'horizontal' ? styles.wrap : null,
        align === 'center'
          ? styles.alignCenter
          : align === 'end'
            ? styles.alignEnd
            : null,
        style,
      ]}
    >
      {entries.map((item, index) => {
        const off = isHidden(item.key);
        const color = item.color ?? seriesColor(theme, index);
        const label = item.label ?? item.key;

        return (
          <Pressable
            key={item.key}
            onPress={
              onToggle === undefined ? undefined : () => onToggle(item.key)
            }
            disabled={onToggle === undefined}
            accessibilityRole={onToggle === undefined ? 'text' : 'button'}
            accessibilityState={{ selected: !off }}
            accessibilityLabel={`${label}${off ? ', hidden' : ''}`}
            // Expand the touch area without changing the visual size.
            hitSlop={12}
            style={styles.item}
          >
            <View style={styles.itemInner}>
              {symbol === 'line' ? (
                <View
                  style={[
                    styles.line,
                    { backgroundColor: color, opacity: off ? 0.35 : 1 },
                  ]}
                />
              ) : (
                <View
                  style={[
                    symbol === 'square' ? styles.square : styles.circle,
                    { backgroundColor: color, opacity: off ? 0.35 : 1 },
                  ]}
                />
              )}
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  {
                    color: theme.colors.muted,
                    // Hidden series render dimmed rather than disappearing, so
                    // the user can still find and re-enable them.
                    opacity: off ? 0.35 : 1,
                    textDecorationLine: off ? 'line-through' : 'none',
                  },
                ]}
              >
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  if (!scrollable) return content;

  return (
    <ScrollView
      horizontal={layout === 'horizontal'}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 14,
    rowGap: 2,
  },
  horizontal: { flexDirection: 'row' },
  vertical: { flexDirection: 'column', alignItems: 'flex-start' },
  wrap: { flexWrap: 'wrap' },
  alignCenter: { justifyContent: 'center' },
  alignEnd: { justifyContent: 'flex-end' },
  item: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  itemInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circle: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  square: { width: 10, height: 10, borderRadius: 2, marginRight: 6 },
  line: { width: 14, height: 3, borderRadius: 2, marginRight: 6 },
  label: { fontSize: 12 },
});
