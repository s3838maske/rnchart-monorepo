/**
 * Optional haptic feedback.
 *
 * `expo-haptics` is an OPTIONAL peer dependency, resolved defensively. A
 * charting library should not force an app to install a haptics module it may
 * not want, and a missing module must degrade to silence rather than crash the
 * chart.
 */

type ImpactStyle = 'light' | 'medium' | 'heavy';

type HapticsModule = {
  impactAsync: (style: unknown) => Promise<void>;
  ImpactFeedbackStyle: Record<string, unknown>;
};

let resolved: HapticsModule | null | undefined;

function loadHaptics(): HapticsModule | null {
  if (resolved !== undefined) return resolved;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-haptics') as HapticsModule;
    resolved = typeof mod?.impactAsync === 'function' ? mod : null;
  } catch {
    resolved = null;
  }

  return resolved;
}

/**
 * Fire one impact.
 *
 * Called from `runOnJS` on an index CHANGE only — never per frame. Firing per
 * frame produces a continuous buzz that users read as a malfunction, and it is
 * the most common way haptics get implemented wrong in a chart.
 */
export function triggerImpact(style: ImpactStyle = 'light'): void {
  const haptics = loadHaptics();
  if (haptics === null) return;

  const key =
    style === 'light' ? 'Light' : style === 'medium' ? 'Medium' : 'Heavy';
  const resolvedStyle = haptics.ImpactFeedbackStyle?.[key];

  void haptics.impactAsync(resolvedStyle).catch(() => {
    // A failed haptic must never surface as an error in a chart.
  });
}

/** Exposed for tests: forget any cached resolution. */
export function resetHapticsCache(): void {
  resolved = undefined;
}
