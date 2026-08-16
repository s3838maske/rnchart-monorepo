# Support policy

## Versions

This library is **pre-release**. Nothing is published to npm yet, so there is
no support commitment to break.

Once v1.0.0 ships, the policy below applies. It is written down now because
enterprise teams check for it before adopting, and a policy invented after the
first major bump is not a policy.

### Once v1.0.0 ships

- The **current major** receives features and fixes.
- The **previous major** receives security and compatibility fixes for
  **6 months** after the next major is released.
- Anything older is unsupported.

### Deprecation

Anything removed in a major version must have been deprecated with a `__DEV__`
runtime warning for at least one full minor version beforehand. No silent
removals.

## React Native compatibility

Peer ranges are deliberately wide (`>=`, never `^`). React Native ships roughly
every 8 weeks; a caret range would lock consumers out of every future minor and
force a release of this library for each one.

Tested against React Native 0.86 (Expo SDK 57). The published floor is 0.78,
which is what Skia 2.x requires.

## Reporting a bug

Include:

1. React Native and Expo SDK versions
2. `@shopify/react-native-skia`, `react-native-reanimated` and
   `react-native-worklets` versions
3. Platform and whether it is a debug or release build
4. A minimal reproduction — ideally an Expo Snack or a small repo

Performance reports without a **release** build and a named device are very hard
to act on. Debug React Native is misleadingly slow.

## Security

Report suspected vulnerabilities privately rather than in a public issue.
