export type RingView = {
  /** Entries in oldest-to-newest order. */
  readonly view: Float32Array;
  /** True when the data had to be copied because the buffer had wrapped. */
  readonly copied: boolean;
  /** Number of entries in the view. */
  readonly length: number;
};

export type RingBuffer = {
  readonly capacity: number;
  readonly stride: number;
  /** Entries currently held, up to `capacity`. */
  readonly length: number;
  /** Total entries ever pushed, including those overwritten. */
  readonly total: number;
  push(...values: number[]): void;
  pushBatch(values: ArrayLike<number>): void;
  toView(): RingView;
  clear(): void;
};

/**
 * Fixed-size ring buffer over a `Float32Array`.
 *
 * Memory is allocated ONCE at construction and never grows. That is the entire
 * point: a chart appending 60 points a second for ten minutes pushes 36,000
 * entries, and any implementation that reallocates or shifts an array turns
 * that into steady garbage-collector pressure. A GC pause during a live chart
 * is exactly the stutter users notice.
 *
 * `toView` avoids copying whenever the buffer has not wrapped, and copies
 * exactly once when it has — never twice, and never per read.
 */
export function createRingBuffer(capacity: number, stride = 2): RingBuffer {
  const cap = Math.max(1, Math.floor(capacity));
  const width = Math.max(1, Math.floor(stride));
  const data = new Float32Array(cap * width);

  // Index of the next slot to write, in entries.
  let head = 0;
  let count = 0;
  let total = 0;

  // Reused when the buffer has wrapped, so a read does not allocate.
  let scratch: Float32Array | null = null;

  const writeEntry = (values: ArrayLike<number>, offset: number): void => {
    const base = head * width;
    for (let i = 0; i < width; i += 1) {
      const v = values[offset + i];
      data[base + i] = v === undefined || !Number.isFinite(v) ? 0 : v;
    }
    head = (head + 1) % cap;
    if (count < cap) count += 1;
    total += 1;
  };

  return {
    capacity: cap,
    stride: width,

    get length() {
      return count;
    },

    get total() {
      return total;
    },

    push(...values) {
      writeEntry(values, 0);
    },

    pushBatch(values) {
      const entries = Math.floor(values.length / width);
      // A batch larger than the buffer would overwrite itself; only the last
      // `cap` entries can survive, so skip straight to them.
      const start = Math.max(0, entries - cap);
      for (let e = start; e < entries; e += 1) {
        writeEntry(values, e * width);
      }
    },

    toView() {
      if (count === 0) {
        return { view: data.subarray(0, 0), copied: false, length: 0 };
      }

      // Not yet wrapped: the entries are already contiguous from index 0.
      if (count < cap) {
        return {
          view: data.subarray(0, count * width),
          copied: false,
          length: count,
        };
      }

      // Wrapped but the head happens to sit at 0: still contiguous.
      if (head === 0) {
        return { view: data, copied: false, length: count };
      }

      if (scratch === null || scratch.length !== cap * width) {
        scratch = new Float32Array(cap * width);
      }

      const split = head * width;
      scratch.set(data.subarray(split), 0);
      scratch.set(data.subarray(0, split), data.length - split);

      return { view: scratch, copied: true, length: count };
    },

    clear() {
      head = 0;
      count = 0;
      total = 0;
      data.fill(0);
    },
  };
}
