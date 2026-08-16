import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { ChartTheme } from '@rnchart/core';

import { useChartTheme } from './ThemeProvider';

export type ChartAnimation = {
  /** False when animation is disabled by theme or by the OS reduce-motion setting. */
  readonly enabled: boolean;
  readonly duration: number;
  readonly stagger: number;
  readonly spring: ChartTheme['animation']['spring'];
  /**
   * Total stagger budget, capped.
   *
   * A 30ms stagger across 200 bars would take six seconds; capping the TOTAL
   * rather than the per-item delay keeps a dense chart snappy while a sparse
   * one still gets the cascade.
   */
  staggerFor(index: number, count: number): number;
};

const MAX_TOTAL_STAGGER_MS = 800;

/**
 * The single hook every series uses for entrance animation.
 *
 * Routing all animation through one hook is what makes phase 27's audit
 * possible: "does anything animate when reduce-motion is on" becomes a
 * question about one function rather than about every component.
 *
 * When reduce motion is enabled the answer is to SNAP to the final state, not
 * to shorten the duration. A fast animation is still an animation, and the
 * setting exists for people who get motion sickness from it.
 */
export function useChartAnimation(): ChartAnimation {
  const theme = useChartTheme();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduceMotion(value);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        setReduceMotion(value);
      }
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const enabled = theme.animation.enabled && !reduceMotion;

  return {
    enabled,
    duration: enabled ? theme.animation.duration : 0,
    stagger: enabled ? theme.animation.stagger : 0,
    spring: theme.animation.spring,
    staggerFor(index, count) {
      if (!enabled || count <= 0) return 0;
      const perItem = Math.min(
        theme.animation.stagger,
        MAX_TOTAL_STAGGER_MS / Math.max(1, count)
      );
      return perItem * index;
    },
  };
}
