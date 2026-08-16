import type { ReactElement } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { Placeholder } from '@rnchart/charts';

/**
 * Phase 1 acceptance test, on screen.
 *
 * If this renders on a device, the monorepo wiring works end to end: Metro
 * resolves `@rnchart/charts` to workspace source, which resolves `@rnchart/skia`,
 * which resolves `@rnchart/core`.
 */
export default function App(): ReactElement {
  // Plain View rather than SafeAreaView: RN 0.86 deprecates SafeAreaView in
  // favour of react-native-safe-area-context. Adding that dependency is not
  // justified for a centred placeholder — revisit when real chart screens with
  // edge-to-edge layout arrive.
  return (
    <View style={styles.root}>
      <StatusBar barStyle="default" />
      <View style={styles.center}>
        <Placeholder />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
