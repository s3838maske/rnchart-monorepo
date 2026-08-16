#!/usr/bin/env node
/**
 * Pre-publish verification for react-native-graphify.
 *
 * Runs every gate that must pass before publishing, and inspects what would
 * actually go into the tarball. It deliberately does NOT publish — publishing
 * is public and irreversible, so it stays a human decision.
 *
 * Usage: yarn prepublish:check
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

let failures = 0;
let warnings = 0;

const pass = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const fail = (msg) => {
  console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
  failures += 1;
};
const warn = (msg) => {
  console.log(`  \x1b[33m!\x1b[0m ${msg}`);
  warnings += 1;
};
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

function run(command, label) {
  try {
    execSync(command, { cwd: ROOT, stdio: 'pipe' });
    pass(label);
  } catch {
    fail(`${label} — \`${command}\` failed`);
  }
}

// ---------------------------------------------------------------------------

section('Quality gates');
run('yarn lint', 'lint');
run('yarn typecheck', 'typecheck');
run('yarn test', 'tests');
run('yarn build', 'build');
run('yarn size', 'bundle budget');
run('yarn format:check', 'formatting');

section('Manifest');

if (!pkg.name.startsWith('@')) {
  pass(`name "${pkg.name}" is unscoped — installable with a plain npm i`);
} else {
  warn(`name "${pkg.name}" is scoped and needs an npm org`);
}

if (pkg.private !== true) pass('not marked private');
else fail('package.json has "private": true — npm will refuse to publish');

if (pkg.sideEffects === false) pass('sideEffects false (tree-shakeable)');
else fail('sideEffects must be false for tree-shaking');

for (const field of [
  'description',
  'license',
  'author',
  'repository',
  'homepage',
  'bugs',
]) {
  if (pkg[field]) pass(`${field} present`);
  else warn(`${field} missing — npm shows it on the package page`);
}

if ((pkg.keywords ?? []).length >= 5) {
  pass(`${pkg.keywords.length} keywords (discoverability)`);
} else {
  warn('fewer than 5 keywords');
}

// Peer ranges must be WIDE. A caret on react-native locks consumers out of
// every future minor, which for React Native means roughly every 8 weeks.
const peers = pkg.peerDependencies ?? {};
const narrow = Object.entries(peers).filter(
  ([, r]) => r.startsWith('^') || r.startsWith('~')
);
if (narrow.length === 0) {
  pass(`${Object.keys(peers).length} peer ranges are wide`);
} else {
  for (const [dep, range] of narrow) {
    fail(`peer ${dep}="${range}" is too narrow — use >=`);
  }
}

// Anything a consumer must install themselves belongs in peerDependencies, not
// dependencies — otherwise npm installs a second copy and Reanimated breaks.
const badDeps = Object.keys(pkg.dependencies ?? {}).filter((dep) =>
  /^(react|react-native|@shopify\/react-native-skia)/.test(dep)
);
for (const dep of badDeps) {
  fail(
    `${dep} is a real dependency — it must be a peer, or consumers get a duplicate copy`
  );
}
if (badDeps.length === 0) pass('no React Native packages in dependencies');

section('Build output');
for (const field of ['main', 'module', 'types']) {
  const value = pkg[field];
  if (value === undefined) {
    fail(`${field} not set`);
    continue;
  }
  if (existsSync(join(ROOT, value))) pass(`${field} → ${value}`);
  else fail(`${field} points at a missing file (${value}) — run yarn build`);
}

section('Tarball contents');
let meta;
try {
  // --ignore-scripts because `prepare` (bob build) writes its log to stdout
  // ahead of the JSON. The build is already verified by the gates above; here
  // we only want the file manifest.
  const raw = execSync('npm pack --dry-run --json --ignore-scripts', {
    cwd: ROOT,
    stdio: 'pipe',
  }).toString();
  meta = JSON.parse(raw.slice(raw.indexOf('[')))[0];
} catch (error) {
  fail(`npm pack failed — ${String(error).split('\n')[0]}`);
}

if (meta) {
  const files = (meta.files ?? []).map((f) => f.path);

  const leaked = files.filter(
    (f) => /\.test\./.test(f) || /__tests__/.test(f) || /\.tsbuildinfo$/.test(f)
  );
  if (leaked.length === 0)
    pass(`no tests or build artefacts (${files.length} files)`);
  else fail(`${leaked.length} unwanted files, e.g. ${leaked[0]}`);

  if (files.some((f) => f.endsWith('.d.ts'))) pass('ships type declarations');
  else fail('no .d.ts in the tarball');

  for (const required of ['README.md', 'LICENSE', 'CHANGELOG.md']) {
    if (files.includes(required)) pass(`${required} included`);
    else fail(`${required} missing from the tarball`);
  }

  if (files.some((f) => f.startsWith('example/'))) {
    fail('the example app is in the tarball');
  } else {
    pass('example app excluded');
  }

  pass(
    `${Math.round(meta.unpackedSize / 1024)} kB unpacked, ${Math.round(meta.size / 1024)} kB tarball`
  );
}

section('Registry');
try {
  execSync(`npm view ${pkg.name} version`, { stdio: 'pipe' });
  warn(
    `${pkg.name} already exists on npm — this would be an update, not a first publish`
  );
} catch {
  pass(`${pkg.name} is available on npm`);
}

try {
  const who = execSync('npm whoami', { stdio: 'pipe' }).toString().trim();
  pass(`logged in to npm as ${who}`);
} catch {
  fail('not logged in — run `npm login`');
}

// ---------------------------------------------------------------------------

console.log('');
if (failures > 0) {
  console.log(
    `\x1b[31m${failures} blocking issue(s)\x1b[0m, ${warnings} warning(s).`
  );
  process.exit(1);
}

console.log(
  `\x1b[32mReady to publish\x1b[0m${warnings > 0 ? `, ${warnings} warning(s).` : '.'}`
);
console.log('');
console.log('This script does NOT publish. To release:');
console.log('');
console.log('  npm publish --access public');
console.log('');
console.log(
  'Your npm account has 2FA on writes, so expect a one-time-password'
);
console.log(
  'prompt. Publishing is irreversible: npm allows unpublish only within'
);
console.log('72 hours, and never once another package depends on the version.');
