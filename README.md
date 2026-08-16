# @rnchart

Skia-powered charts for React Native. Native performance, no WebView, one API
for iOS and Android.

> **Status: phase 1 of 41.** Nothing renders yet. This repository currently
> contains the monorepo scaffold and the architectural boundary that everything
> else depends on. The first chart appears in phase 7; the first public release
> is v1.0.0 at phase 15.

## Packages

| Package | What it is |
| --- | --- |
| `@rnchart/core` | Renderer-agnostic charting maths. Pure TypeScript, zero React Native, runs in plain Node. |
| `@rnchart/skia` | Skia renderer adapter. Bridges core geometry to Skia draw calls. |
| `@rnchart/charts` | The public API — the components consumers import. |
| `example/` | Expo dev-client app used for visual verification. Not published. |

`@rnchart/core` having no React Native dependency is not a stylistic
preference. Every renderer — Skia today, the web renderer in v3.0.0 — is an
adapter over it. It is why phase 39 is a few weeks of adapter work rather than a
rewrite, and it is why victory-native had to abandon web parity when it moved to
Skia. A lint rule fails the build if anything in `packages/core` imports React
Native.

## Setup

Requires **Node 20+**. Yarn 4 comes from Corepack, which ships with Node.

```sh
corepack enable
yarn install
```

Then verify the whole repo:

```sh
yarn build      # compile all three packages with builder-bob
yarn test       # jest, per package
yarn lint       # eslint, including the core-purity rule
yarn typecheck  # tsc --noEmit across packages and the example app
```

## Running the example app

Skia does not run in Expo Go, so the example needs a dev client. That means a
native build — the first one takes a while.

```sh
yarn example:ios       # or: yarn example:android
```

Once a dev client is installed on the device, the fast loop is:

```sh
yarn example           # expo start --dev-client
```

Metro is configured to resolve `@rnchart/*` to workspace **source**, so editing
`packages/*/src` hot-reloads the app with no rebuild.

## Scripts

| Script | Does |
| --- | --- |
| `yarn build` | Builds core, then skia, then charts. Order matters. |
| `yarn test` | Runs each package's Jest suite. |
| `yarn test:coverage` | Coverage for `@rnchart/core` (thresholds enforced at 90%). |
| `yarn lint` / `yarn lint:fix` | ESLint across the repo. |
| `yarn typecheck` | Whole-repo type check, including `example/`. |
| `yarn format` / `yarn format:check` | Prettier. |
| `yarn clean` | Removes `lib/` from every package. |
| `yarn changeset` | Records a version bump. All three packages move in lockstep. |
| `yarn release` | Builds, then publishes via changesets. |

Run these from the repository root. Individual package scripts resolve their
binaries through the root workspace.

## Working on this

Read [`CONTEXT.md`](./CONTEXT.md) first. It holds the global context block to
paste at the start of an AI session, and — more importantly — the list of places
where the roadmap PDF is out of date relative to the current dependency
versions. Pasting the roadmap's original block will generate Reanimated 3 code
that does not compile against Reanimated 4.

The phase discipline from the roadmap is worth keeping:

- Run each phase's acceptance test on a **real device**, not a simulator, before
  moving on.
- Do not run two phases in parallel.
- Do not reorder phases within a version. Later phases assume earlier ones.

## Definition of done

A phase is finished when every line is true, not when the code runs:

- [ ] TypeScript strict, zero `any`, zero `@ts-ignore`
- [ ] Unit tests for all core logic, >85% coverage on the package
- [ ] Screenshot regression tests for every new visual output, iOS and Android
- [ ] An example app screen demonstrating every new prop
- [ ] TSDoc on every exported symbol
- [ ] A documentation page with at least one live Snack embed
- [ ] Benchmarked against the target, with the number recorded
- [ ] Accessibility: summary, per-point labels, reduced motion respected
- [ ] No new direct dependency without written justification
- [ ] Bundle size delta measured and within budget
- [ ] Tested on a low-end Android device, not only a simulator
- [ ] Changeset written in consumer-facing terms

## Licence

MIT
