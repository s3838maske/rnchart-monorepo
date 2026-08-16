/**
 * Benchmark harness for the performance-critical core paths.
 *
 * Run with `yarn bench` from packages/core (requires a prior `yarn build`,
 * since this exercises the published ESM output rather than source).
 *
 * These numbers are Node on a developer machine and are useful only for
 * catching regressions between runs. The numbers that go in the README must
 * come from a real mid-range Android device in a release build — see
 * Appendix B of the roadmap. Publishing laptop numbers as device numbers is
 * how benchmark tables lose their credibility.
 */
import { Bench } from 'tinybench';

import {
  autoDecimate,
  clipToViewport,
  createHitTester,
  lttb,
  minMaxDecimate,
} from '../lib/module/index.js';

function series(n) {
  const out = new Float32Array(n * 2);
  for (let i = 0; i < n; i += 1) {
    out[i * 2] = i;
    out[i * 2 + 1] = Math.sin(i / 100) * 50 + (i % 13);
  }
  return out;
}

const SIZES = [1_000, 10_000, 100_000, 1_000_000];

const bench = new Bench({ time: 400 });

for (const n of SIZES) {
  const points = series(n);
  const xTester = createHitTester(points, 'x');

  bench
    .add(`lttb ${n} -> 800`, () => {
      lttb(points, 800);
    })
    .add(`minMaxDecimate ${n} -> 400 buckets`, () => {
      minMaxDecimate(points, 400);
    })
    .add(`clipToViewport ${n}`, () => {
      clipToViewport(points, n * 0.25, n * 0.75);
    })
    .add(`autoDecimate ${n} @400px`, () => {
      autoDecimate(points, 400);
    })
    .add(`hitTest x ${n}`, () => {
      xTester.find(Math.random() * n, 0);
    });
}

// Quadtree construction is measured separately: it happens once per data
// change, not per frame, so amortising it into the query number would hide
// the cost that actually matters when data arrives.
for (const n of [1_000, 10_000, 50_000]) {
  const points = series(n);
  bench.add(`build quadtree ${n}`, () => {
    createHitTester(points, 'nearest');
  });

  const tester = createHitTester(points, 'nearest');
  bench.add(`hitTest nearest ${n}`, () => {
    tester.find(Math.random() * n, Math.random() * 100);
  });
}

await bench.run();

console.log('\n@rnchart/core benchmarks — Node, not a device\n');
console.table(
  bench.tasks.map((task) => {
    const r = task.result;
    return {
      task: task.name,
      'ops/sec': r
        ? Math.round(r.throughput.mean).toLocaleString('en-US')
        : '—',
      'mean (ms)': r ? r.latency.mean.toFixed(4) : '—',
      'p99 (ms)': r ? r.latency.p99.toFixed(4) : '—',
      samples: r ? r.latency.samplesCount : 0,
    };
  })
);
