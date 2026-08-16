import { useEffect } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { CHART_COLORS } from '../colors';
import { useDrilldown } from './useDrilldown';
import type { DrilldownApi, UseDrilldownOptions } from './useDrilldown';

export type DrilldownTransition = 'slide' | 'fade' | 'zoom' | 'none';

export type DrilldownProps = UseDrilldownOptions & {
  readonly transition?: DrilldownTransition;
  readonly breadcrumb?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly loadingMessage?: string;
  readonly children: (api: DrilldownApi) => ReactNode;
};

const DURATION = 450;

/**
 * Drilldown container.
 *
 * A render prop rather than cloned children: the chart needs the CURRENT
 * level's data and the `drill` callback, and passing those down by cloning
 * arbitrary children is guesswork about their prop names.
 *
 * On mobile this is the primary interaction for hierarchical data — far more
 * natural than the hover-and-expand pattern desktop charts use.
 */
export function Drilldown({
  transition = 'slide',
  breadcrumb = true,
  style,
  loadingMessage = 'Loading…',
  children,
  ...options
}: DrilldownProps): ReactElement {
  const api = useDrilldown(options);
  const progress = useSharedValue(1);
  const direction = useSharedValue(1);

  // Re-run the entrance animation whenever the depth changes. Descending
  // enters from the right, ascending from the left — the direction is what
  // makes the hierarchy legible rather than just "something moved".
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: DURATION });
  }, [api.depth, progress]);

  const previousDepth = useSharedValue(0);
  useEffect(() => {
    direction.value = api.depth >= previousDepth.value ? 1 : -1;
    previousDepth.value = api.depth;
  }, [api.depth, direction, previousDepth]);

  const animatedStyle = useAnimatedStyle(() => {
    if (transition === 'none') return {};

    const t = progress.value;

    if (transition === 'fade') return { opacity: t };

    if (transition === 'zoom') {
      return { opacity: t, transform: [{ scale: 0.92 + 0.08 * t }] };
    }

    return {
      opacity: t,
      transform: [{ translateX: (1 - t) * 40 * direction.value }],
    };
  });

  return (
    <View style={style}>
      {breadcrumb ? <Breadcrumb api={api} /> : null}

      <Animated.View style={animatedStyle}>{children(api)}</Animated.View>

      {api.loading ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayText}>{loadingMessage}</Text>
        </View>
      ) : null}

      {api.error !== null ? (
        <View style={styles.overlay}>
          <Text style={styles.errorText}>{api.error}</Text>
        </View>
      ) : null}
    </View>
  );
}

export type BreadcrumbProps = {
  readonly api: DrilldownApi;
};

/**
 * Horizontal trail of levels, each tappable.
 *
 * A React Native view rather than canvas: these are navigation controls and
 * need real touch targets and screen-reader roles.
 */
export function Breadcrumb({ api }: BreadcrumbProps): ReactElement | null {
  if (api.stack.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.crumbs}
    >
      {api.stack.map((level, i) => {
        const isLast = i === api.stack.length - 1;
        return (
          <View key={`${level.label}-${i}`} style={styles.crumbRow}>
            <Pressable
              onPress={isLast ? undefined : () => api.goTo(i)}
              disabled={isLast}
              accessibilityRole={isLast ? 'text' : 'button'}
              accessibilityLabel={
                isLast
                  ? `${level.label}, current level`
                  : `Back to ${level.label}`
              }
              hitSlop={10}
              style={styles.crumb}
            >
              <Text style={[styles.crumbText, isLast && styles.crumbCurrent]}>
                {level.label}
              </Text>
            </Pressable>
            {!isLast ? <Text style={styles.separator}>›</Text> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  crumbs: { alignItems: 'center', paddingVertical: 4 },
  crumbRow: { flexDirection: 'row', alignItems: 'center' },
  crumb: { minHeight: 32, justifyContent: 'center' },
  crumbText: { fontSize: 12, color: CHART_COLORS.muted },
  crumbCurrent: { color: CHART_COLORS.foreground, fontWeight: '600' },
  separator: { fontSize: 13, color: CHART_COLORS.muted, marginHorizontal: 6 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { fontSize: 13, color: CHART_COLORS.muted },
  errorText: { fontSize: 13, color: '#ef4444' },
});
