import { useCallback, useEffect, useReducer } from 'react';
import { BackHandler } from 'react-native';

import type { SeriesDatum } from '../ChartContext';

export type DrilldownLevel = {
  /** Data shown at this level. */
  readonly data: readonly SeriesDatum[];
  /** Breadcrumb label. */
  readonly label: string;
  /** Index tapped in the PARENT level to reach here. -1 at the root. */
  readonly fromIndex: number;
};

export type DrilldownState = {
  readonly stack: readonly DrilldownLevel[];
  readonly loading: boolean;
  readonly error: string | null;
};

export type DrilldownAction =
  | { type: 'push'; level: DrilldownLevel }
  | { type: 'pop' }
  | { type: 'popTo'; depth: number }
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'reset'; root: DrilldownLevel };

/**
 * The whole level-stack machine, as a pure function.
 *
 * Exported and tested directly rather than through a React renderer: every
 * rule worth guarding — the root can never be popped, an out-of-range jump is
 * ignored, pushing clears the error — lives here and needs no component to
 * exercise. Testing it through `renderHook` would add a rendering dependency
 * and a failure mode without testing anything more.
 */
export function drilldownReducer(
  state: DrilldownState,
  action: DrilldownAction
): DrilldownState {
  switch (action.type) {
    case 'push':
      return {
        stack: [...state.stack, action.level],
        loading: false,
        error: null,
      };
    case 'pop':
      // The root can never be popped — there is nothing above it.
      if (state.stack.length <= 1) return state;
      return { ...state, stack: state.stack.slice(0, -1), error: null };
    case 'popTo':
      if (action.depth < 0 || action.depth >= state.stack.length) return state;
      return {
        ...state,
        stack: state.stack.slice(0, action.depth + 1),
        error: null,
      };
    case 'loading':
      return { ...state, loading: true, error: null };
    case 'error':
      return { ...state, loading: false, error: action.message };
    case 'reset':
      return { stack: [action.root], loading: false, error: null };
    default:
      return state;
  }
}

export type DrillResolver = (
  datum: SeriesDatum,
  index: number
) =>
  | readonly SeriesDatum[]
  | null
  | undefined
  | Promise<readonly SeriesDatum[] | null | undefined>;

export type UseDrilldownOptions = {
  readonly data: readonly SeriesDatum[];
  readonly rootLabel?: string;
  readonly onDrill: DrillResolver;
  /** Field used for a child level's breadcrumb label. */
  readonly labelKey?: string;
  readonly maxDepth?: number;
  /** Intercept the Android hardware back button. Default true. */
  readonly handleBack?: boolean;
  readonly onLevelChange?: (depth: number) => void;
};

export type DrilldownApi = {
  readonly level: DrilldownLevel;
  readonly depth: number;
  readonly stack: readonly DrilldownLevel[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly canGoUp: boolean;
  drill(index: number): void;
  up(): void;
  goTo(depth: number): void;
  reset(): void;
};

/**
 * Level-stack state for a drilldown.
 *
 * A reducer rather than several `useState` calls because the transitions are
 * genuinely coupled: pushing a level must also clear the error and the loading
 * flag, and popping must not be able to empty the stack. Expressing that as
 * independent setters is how a drilldown ends up on a blank screen with no
 * root to return to.
 *
 * Android's hardware back button is intercepted while there is somewhere to
 * ascend to, and falls through to navigation at the root — the behaviour users
 * already expect from every other screen.
 */
export function useDrilldown(options: UseDrilldownOptions): DrilldownApi {
  const {
    data,
    rootLabel = 'All',
    onDrill,
    labelKey,
    maxDepth = 4,
    handleBack = true,
    onLevelChange,
  } = options;

  const [state, dispatch] = useReducer(drilldownReducer, {
    stack: [{ data, label: rootLabel, fromIndex: -1 }],
    loading: false,
    error: null,
  });

  // Keep the root in sync when the caller swaps its data out.
  useEffect(() => {
    dispatch({
      type: 'reset',
      root: { data, label: rootLabel, fromIndex: -1 },
    });
  }, [data, rootLabel]);

  const depth = state.stack.length - 1;
  const level = state.stack[depth] as DrilldownLevel;
  const canGoUp = depth > 0;

  useEffect(() => {
    onLevelChange?.(depth);
  }, [depth, onLevelChange]);

  const up = useCallback(() => {
    dispatch({ type: 'pop' });
  }, []);

  const goTo = useCallback((target: number) => {
    dispatch({ type: 'popTo', depth: target });
  }, []);

  const reset = useCallback(() => {
    dispatch({
      type: 'reset',
      root: { data, label: rootLabel, fromIndex: -1 },
    });
  }, [data, rootLabel]);

  const drill = useCallback(
    (index: number) => {
      if (depth >= maxDepth) return;
      const datum = level.data[index];
      if (datum === undefined) return;

      const label =
        labelKey !== undefined && typeof datum[labelKey] === 'string'
          ? datum[labelKey]
          : `Level ${String(depth + 1)}`;

      let result: ReturnType<DrillResolver>;
      try {
        result = onDrill(datum, index);
      } catch (e) {
        dispatch({ type: 'error', message: String(e) });
        return;
      }

      if (result instanceof Promise) {
        dispatch({ type: 'loading' });
        result
          .then((child) => {
            if (child === null || child === undefined || child.length === 0) {
              // A leaf, not a failure. Clear loading and stay put rather than
              // pushing an empty level the user then has to back out of.
              dispatch({ type: 'push', level });
              dispatch({ type: 'pop' });
              return;
            }
            dispatch({
              type: 'push',
              level: { data: child, label, fromIndex: index },
            });
          })
          .catch((e: unknown) => {
            dispatch({ type: 'error', message: String(e) });
          });
        return;
      }

      if (result === null || result === undefined || result.length === 0)
        return;
      dispatch({
        type: 'push',
        level: { data: result, label, fromIndex: index },
      });
    },
    [depth, level, maxDepth, onDrill, labelKey]
  );

  useEffect(() => {
    if (!handleBack || !canGoUp) return;

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        up();
        // Returning true consumes the event. At the root we never register,
        // so back falls through to navigation as users expect.
        return true;
      }
    );

    return () => {
      subscription.remove();
    };
  }, [handleBack, canGoUp, up]);

  return {
    level,
    depth,
    stack: state.stack,
    loading: state.loading,
    error: state.error,
    canGoUp,
    drill,
    up,
    goTo,
    reset,
  };
}
