import type { ReactElement, ReactNode } from 'react';
import { Group } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';

import { useChart } from '../ChartContext';
import { useViewport } from './viewport';

export type ZoomPanProps = {
  readonly children: ReactNode;
};

/**
 * Applies the viewport transform to its children.
 *
 * Put the series inside this and leave the grid and axes outside — the grid
 * should not stretch with the data, and axis labels are regenerated on gesture
 * end rather than transformed.
 *
 * IMPLEMENTATION NOTE, stated plainly because it is a real trade-off. This
 * transforms the drawn group rather than rebuilding paths from a viewport on
 * every frame. Transforming is dramatically cheaper and stays entirely on the
 * UI thread, which is what keeps a 100k-point pan at 60fps. The cost is that a
 * horizontal scale also stretches stroke geometry, so `<Line>` and friends
 * divide their stroke width by the current scale to compensate.
 *
 * Rebuilding paths inside a worklet — what the roadmap describes — removes the
 * compensation entirely and is the better long-term answer. It needs
 * worklet-safe path construction throughout, which is a phase 28 concern.
 */
export function ZoomPan({ children }: ZoomPanProps): ReactElement {
  const { plotArea } = useChart();
  const viewport = useViewport();

  const transform = useDerivedValue(() => {
    if (viewport === null) return [{ translateX: 0 }];
    return [
      { translateX: viewport.translateX.value },
      { scaleX: viewport.scaleX.value },
    ];
  }, [viewport]);

  if (viewport === null) return <Group>{children}</Group>;

  return (
    <Group
      transform={transform}
      // Scale about the plot's left edge so translation stays in pixel space
      // and the clamp maths remains simple.
      origin={{ x: plotArea.x, y: plotArea.y }}
      clip={{
        x: plotArea.x,
        y: plotArea.y,
        width: plotArea.width,
        height: plotArea.height,
      }}
    >
      {children}
    </Group>
  );
}
