import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { rendererInfo } from '@rnchart/skia';
import { VERSION } from './version';

export type PlaceholderProps = {
  /** Heading shown above the version line. */
  readonly label?: string;
};

/**
 * The phase 1 placeholder.
 *
 * It exists to satisfy one acceptance test — that the example app can import
 * from `@rnchart/charts` and render it on a device — and it is deleted in
 * phase 5 when `<Chart>` replaces it.
 */
export function Placeholder({
  label = '@rnchart',
}: PlaceholderProps): ReactElement {
  const info = rendererInfo();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.detail}>
        {`charts ${VERSION} · ${info.renderer} ${info.version} · core ${info.coreVersion}`}
      </Text>
      <Text style={styles.caption}>
        Foundation scaffold. Nothing renders yet — that starts at phase 5.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  detail: {
    fontSize: 13,
    opacity: 0.7,
  },
  caption: {
    fontSize: 12,
    opacity: 0.45,
    textAlign: 'center',
  },
});
