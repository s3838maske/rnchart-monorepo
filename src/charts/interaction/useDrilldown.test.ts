import { drilldownReducer } from './useDrilldown';
import type { DrilldownLevel, DrilldownState } from './useDrilldown';

const level = (label: string, fromIndex = -1): DrilldownLevel => ({
  data: [{ name: label, value: 1 }],
  label,
  fromIndex,
});

const root = level('All');

const stateWith = (...labels: string[]): DrilldownState => ({
  stack: labels.map((l, i) => level(l, i === 0 ? -1 : i - 1)),
  loading: false,
  error: null,
});

describe('drilldownReducer', () => {
  describe('push', () => {
    it('descends one level', () => {
      const next = drilldownReducer(stateWith('All'), {
        type: 'push',
        level: level('India', 0),
      });

      expect(next.stack).toHaveLength(2);
      expect(next.stack[1]?.label).toBe('India');
    });

    it('clears loading and error, because arriving means both are resolved', () => {
      const busy: DrilldownState = {
        stack: [root],
        loading: true,
        error: 'stale failure',
      };

      const next = drilldownReducer(busy, {
        type: 'push',
        level: level('X', 0),
      });

      expect(next.loading).toBe(false);
      expect(next.error).toBeNull();
    });
  });

  describe('pop', () => {
    it('ascends one level', () => {
      const next = drilldownReducer(stateWith('All', 'India'), { type: 'pop' });

      expect(next.stack).toHaveLength(1);
      expect(next.stack[0]?.label).toBe('All');
    });

    it('can NEVER pop the root away', () => {
      // The failure this prevents: a blank screen with nothing to return to.
      const next = drilldownReducer(stateWith('All'), { type: 'pop' });

      expect(next.stack).toHaveLength(1);
    });

    it('returns the same object when there is nothing to pop', () => {
      // Reference equality matters: it stops React re-rendering for nothing.
      const state = stateWith('All');
      expect(drilldownReducer(state, { type: 'pop' })).toBe(state);
    });

    it('clears a stale error on the way up', () => {
      const failed: DrilldownState = {
        ...stateWith('All', 'India'),
        error: 'network',
      };

      expect(drilldownReducer(failed, { type: 'pop' }).error).toBeNull();
    });
  });

  describe('popTo', () => {
    it('jumps to an arbitrary depth', () => {
      const next = drilldownReducer(stateWith('All', 'India', 'MH'), {
        type: 'popTo',
        depth: 0,
      });

      expect(next.stack).toHaveLength(1);
    });

    it('keeps the target level itself', () => {
      const next = drilldownReducer(stateWith('All', 'India', 'MH'), {
        type: 'popTo',
        depth: 1,
      });

      expect(next.stack).toHaveLength(2);
      expect(next.stack[1]?.label).toBe('India');
    });

    it('ignores a depth past the end', () => {
      const state = stateWith('All', 'India');
      expect(drilldownReducer(state, { type: 'popTo', depth: 9 })).toBe(state);
    });

    it('ignores a negative depth', () => {
      const state = stateWith('All', 'India');
      expect(drilldownReducer(state, { type: 'popTo', depth: -1 })).toBe(state);
    });

    it('jumping to the current depth is a no-op in content', () => {
      const next = drilldownReducer(stateWith('All', 'India'), {
        type: 'popTo',
        depth: 1,
      });

      expect(next.stack).toHaveLength(2);
    });
  });

  describe('loading and error', () => {
    it('sets loading and clears any previous error', () => {
      const failed: DrilldownState = {
        stack: [root],
        loading: false,
        error: 'old',
      };
      const next = drilldownReducer(failed, { type: 'loading' });

      expect(next.loading).toBe(true);
      expect(next.error).toBeNull();
    });

    it('an error clears loading — a spinner must never outlive its request', () => {
      const busy: DrilldownState = {
        stack: [root],
        loading: true,
        error: null,
      };
      const next = drilldownReducer(busy, { type: 'error', message: 'boom' });

      expect(next.loading).toBe(false);
      expect(next.error).toBe('boom');
    });

    it('an error does not change the level', () => {
      const busy = stateWith('All', 'India');
      const next = drilldownReducer(busy, { type: 'error', message: 'boom' });

      expect(next.stack).toHaveLength(2);
    });
  });

  describe('reset', () => {
    it('collapses to a single root level', () => {
      const next = drilldownReducer(stateWith('All', 'India', 'MH'), {
        type: 'reset',
        root: level('Fresh'),
      });

      expect(next.stack).toHaveLength(1);
      expect(next.stack[0]?.label).toBe('Fresh');
    });

    it('clears loading and error', () => {
      const messy: DrilldownState = {
        ...stateWith('All', 'India'),
        loading: true,
        error: 'boom',
      };

      const next = drilldownReducer(messy, { type: 'reset', root });

      expect(next.loading).toBe(false);
      expect(next.error).toBeNull();
    });
  });

  it('is pure — the input state is never mutated', () => {
    const state = stateWith('All', 'India');
    const snapshot = JSON.stringify(state);

    drilldownReducer(state, { type: 'pop' });
    drilldownReducer(state, { type: 'push', level: level('X', 0) });
    drilldownReducer(state, { type: 'reset', root });

    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
