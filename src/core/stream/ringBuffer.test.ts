import { createRingBuffer } from './ringBuffer';

const entries = (view: Float32Array, stride: number): number[][] => {
  const out: number[][] = [];
  for (let i = 0; i < view.length; i += stride) {
    out.push(Array.from(view.subarray(i, i + stride)));
  }
  return out;
};

describe('createRingBuffer', () => {
  it('reports its configuration', () => {
    const rb = createRingBuffer(10, 2);
    expect(rb.capacity).toBe(10);
    expect(rb.stride).toBe(2);
    expect(rb.length).toBe(0);
  });

  it('is empty before anything is pushed', () => {
    const { view, copied, length } = createRingBuffer(4).toView();
    expect(view.length).toBe(0);
    expect(copied).toBe(false);
    expect(length).toBe(0);
  });

  it('returns entries in push order', () => {
    const rb = createRingBuffer(4, 2);
    rb.push(1, 10);
    rb.push(2, 20);
    rb.push(3, 30);

    const { view, length } = rb.toView();
    expect(length).toBe(3);
    expect(entries(view, 2)).toEqual([
      [1, 10],
      [2, 20],
      [3, 30],
    ]);
  });

  it('does NOT copy before wrapping', () => {
    // The no-copy path is the contract — a streaming chart reads every frame.
    const rb = createRingBuffer(8, 2);
    rb.push(1, 1);
    rb.push(2, 2);

    expect(rb.toView().copied).toBe(false);
  });

  it('overwrites the oldest entry once full', () => {
    const rb = createRingBuffer(3, 2);
    for (let i = 1; i <= 5; i += 1) rb.push(i, i * 10);

    const { view, length } = rb.toView();
    expect(length).toBe(3);
    expect(entries(view, 2)).toEqual([
      [3, 30],
      [4, 40],
      [5, 50],
    ]);
  });

  it('copies exactly once when wrapped, never twice', () => {
    const rb = createRingBuffer(3, 2);
    for (let i = 1; i <= 5; i += 1) rb.push(i, i * 10);

    const first = rb.toView();
    const second = rb.toView();

    expect(first.copied).toBe(true);
    // The scratch array is reused, so repeat reads do not allocate again.
    expect(second.view.buffer).toBe(first.view.buffer);
  });

  it('avoids the copy when the head lands back on zero', () => {
    const rb = createRingBuffer(3, 2);
    for (let i = 1; i <= 6; i += 1) rb.push(i, i * 10);

    // Exactly two full turns: head is at 0 and the data is contiguous again.
    const { copied, view } = rb.toView();
    expect(copied).toBe(false);
    expect(entries(view, 2)).toEqual([
      [4, 40],
      [5, 50],
      [6, 60],
    ]);
  });

  it('keeps memory flat regardless of how much is pushed', () => {
    const rb = createRingBuffer(100, 2);
    const before = rb.toView().view.length;

    for (let i = 0; i < 50_000; i += 1) rb.push(i, Math.sin(i));

    expect(rb.length).toBe(100);
    expect(rb.total).toBe(50_000);
    expect(rb.toView().view.length).toBe(before === 0 ? 200 : before);
  });

  it('tracks total separately from length', () => {
    const rb = createRingBuffer(2, 1);
    rb.push(1);
    rb.push(2);
    rb.push(3);

    expect(rb.length).toBe(2);
    expect(rb.total).toBe(3);
  });

  describe('pushBatch', () => {
    it('appends a whole batch in order', () => {
      const rb = createRingBuffer(6, 2);
      rb.pushBatch([1, 10, 2, 20, 3, 30]);

      expect(entries(rb.toView().view, 2)).toEqual([
        [1, 10],
        [2, 20],
        [3, 30],
      ]);
    });

    it('keeps only the last capacity entries of an oversized batch', () => {
      // Writing all of it would overwrite itself; only the tail can survive,
      // so the earlier entries are skipped rather than written and discarded.
      const rb = createRingBuffer(3, 1);
      rb.pushBatch([1, 2, 3, 4, 5, 6, 7]);

      expect(entries(rb.toView().view, 1)).toEqual([[5], [6], [7]]);
    });

    it('ignores a partial trailing entry', () => {
      const rb = createRingBuffer(4, 2);
      rb.pushBatch([1, 10, 2, 20, 3]);

      expect(rb.length).toBe(2);
    });

    it('handles an empty batch', () => {
      const rb = createRingBuffer(4, 2);
      rb.pushBatch([]);
      expect(rb.length).toBe(0);
    });
  });

  it('substitutes zero for non-finite input', () => {
    const rb = createRingBuffer(2, 2);
    rb.push(Number.NaN, Number.POSITIVE_INFINITY);

    expect(entries(rb.toView().view, 2)).toEqual([[0, 0]]);
  });

  it('clears back to empty', () => {
    const rb = createRingBuffer(3, 2);
    rb.push(1, 1);
    rb.push(2, 2);
    rb.clear();

    expect(rb.length).toBe(0);
    expect(rb.total).toBe(0);
    expect(rb.toView().view.length).toBe(0);
  });

  it('supports a stride of one', () => {
    const rb = createRingBuffer(3, 1);
    rb.push(7);
    rb.push(8);

    expect(entries(rb.toView().view, 1)).toEqual([[7], [8]]);
  });

  it('clamps a degenerate capacity', () => {
    const rb = createRingBuffer(0, 2);
    expect(rb.capacity).toBe(1);
    rb.push(1, 2);
    expect(rb.length).toBe(1);
  });
});
