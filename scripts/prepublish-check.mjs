#!/usr/bin/env node
/**
 * Pre-publish verification.
 *
 * Runs every gate that must pass before `changeset publish`, and inspects what
 * would actually go into each tarball. It deliberately does NOT publish —
 * publishing is irreversible and public, so it stays a human decision.
 *
 * Usage: yarn prepublish:check
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const PACKAGES = ['core', 'skia', 'charts'];

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

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

function run(command, label) {
  try {
    execSync(command, { cwd: ROOT, stdio: 'pipe' });
    pass(label);
    return true;
  } catch {
    fail(`${label} — \`${command}\` failed`);
    return false;
  }
}

function readPkg(name) {
  return JSON.parse(
    readFileSync(join(ROOT, 'packages', name, 'package.json'), 'utf8')
  );
}

// ---------------------------------------------------------------------------

section('Quality gates');
run('yarn lint', 'lint');
run('yarn typecheck', 'typecheck');
run('yarn test', 'tests');
run('yarn build', 'build');
run('yarn size', 'bundle budgets');
run('yarn format:check', 'formatting');

section('Package manifests');
for (const name of PACKAGES) {
  const pkg = readPkg(name);
  const id = pkg.name;

  if (pkg.sideEffects === false)
    pass(`${id}: sideEffects false (tree-shakeable)`);
  else fail(`${id}: sideEffects must be false for tree-shaking`);

  if (pkg.publishConfig?.access === 'public')
    pass(`${id}: publishConfig.access public`);
  else
    fail(
      `${id}: scoped packages default to restricted — set publishConfig.access`
    );

  if (pkg.publishConfig?.provenance === true) pass(`${id}: provenance enabled`);
  else warn(`${id}: provenance not enabled`);

  if (pkg.license) pass(`${id}: license ${pkg.license}`);
  else fail(`${id}: no license field`);

  // Peer ranges must be WIDE. A caret on react-native locks consumers out of
  // every future minor, which for React Native means roughly every 8 weeks.
  const peers = pkg.peerDependencies ?? {};
  for (const [dep, range] of Object.entries(peers)) {
    if (range.startsWith('^') || range.startsWith('~')) {
      fail(`${id}: peer ${dep}="${range}" is too narrow — use a >= range`);
    }
  }
  if (Object.keys(peers).length > 0)
    pass(`${id}: ${Object.keys(peers).length} peer ranges are wide`);

  // Entry points must point at files that exist after a build.
  for (const field of ['main', 'module', 'types']) {
    const value = pkg[field];
    if (value === undefined) continue;
    const target = join(ROOT, 'packages', name, value);
    if (existsSync(target)) pass(`${id}: ${field} resolves`);
    else fail(`${id}: ${field} points at a missing file (${value})`);
  }
}

section('Tarball contents');
for (const name of PACKAGES) {
  const pkg = readPkg(name);
  let output;
  try {
    output = execSync('npm pack --dry-run --json', {
      cwd: join(ROOT, 'packages', name),
      stdio: 'pipe',
    }).toString();
  } catch {
    fail(`${pkg.name}: npm pack failed`);
    continue;
  }

  const [meta] = JSON.parse(output);
  const files = (meta.files ?? []).map((f) => f.path);

  const leaked = files.filter(
    (f) =>
      /\.test\./.test(f) ||
      /__tests__/.test(f) ||
      /\.tsbuildinfo$/.test(f) ||
      /^bench\//.test(f)
  );

  if (leaked.length === 0)
    pass(`${pkg.name}: no tests or build artefacts (${files.length} files)`);
  else fail(`${pkg.name}: ${leaked.length} unwanted files, e.g. ${leaked[0]}`);

  const hasTypes = files.some((f) => f.endsWith('.d.ts'));
  if (hasTypes) pass(`${pkg.name}: ships type declarations`);
  else fail(`${pkg.name}: no .d.ts in the tarball`);

  const sizeKb = Math.round(meta.unpackedSize / 1024);
  pass(`${pkg.name}: ${sizeKb} kB unpacked`);
}

section('Release readiness');
const changesetDir = join(ROOT, '.changeset');
const pending = existsSync(changesetDir)
  ? execSync('ls .changeset', { cwd: ROOT })
      .toString()
      .split('\n')
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
  : [];

if (pending.length > 0) pass(`${pending.length} pending changeset(s)`);
else warn('no pending changesets — `changeset publish` would version nothing');

for (const doc of ['README.md', 'CONTEXT.md', 'docs/getting-started.md']) {
  if (existsSync(join(ROOT, doc))) pass(`${doc} present`);
  else fail(`${doc} missing`);
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
  `\x1b[32mAll checks passed\x1b[0m${warnings > 0 ? `, ${warnings} warning(s).` : '.'}`
);
console.log('');
console.log('This script does NOT publish. To release:');
console.log('  1. yarn changeset version     # apply pending changesets');
console.log('  2. review the version bumps and CHANGELOGs');
console.log('  3. git commit && git push');
console.log('  4. yarn release               # builds, then changeset publish');
console.log('');
console.log('Publishing is public and irreversible. npm allows unpublish only');
console.log('within 72 hours, and never for a version anything depends on.');
