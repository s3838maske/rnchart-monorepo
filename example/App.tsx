import type { ReactElement } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { Placeholder } from '@rnchart/charts';

/**
 * Phase 1 acceptance test, on screen.
 *
 * If this renders on a device, the monorepo wiring works end to end: Metro
 * resolves `@rnchart/charts` to workspace source, which resolves `@rnchart/skia`,
 * which resolves `@rnchart/core`.
 */
export default function App(): ReactElement {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="default" />
      <View style={styles.center}>
        <Placeholder />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
