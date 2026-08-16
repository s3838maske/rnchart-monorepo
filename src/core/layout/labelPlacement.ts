import type { Rect } from '../geometry';

export type LabelCandidate = {
  readonly id: string;
  readonly rect: Rect;
  /** Higher wins when two labels collide. Larger data values should rank higher. */
  readonly priority: number;
  /** Allow nudging vertically to resolve a collision instead of dropping. */
  readonly nudgeable?: boolean;
};

export type PlacedLabel = {
  readonly id: string;
  readonly rect: Rect;
  readonly visible: boolean;
  /** Vertical offset applied to resolve a collision. 0 when untouched. */
  readonly offsetY: number;
};

export type LabelPlacementOptions = {
  /** Labels must stay inside this rect. */
  readonly bounds?: Rect;
  /** Minimum separation before two rects count as colliding. */
  readonly padding?: number;
  /**
   * Maximum vertical nudge before giving up and dropping the label.
   *
   * Defaults to the label's own height plus padding: a nudge SHORTER than the
   * label can never clear a fully-overlapping neighbour, so a smaller cap makes
   * nudging pointless rather than merely conservative.
   */
  readonly maxNudge?: number;
};

function intersects(a: Rect, b: Rect, padding: number): boolean {
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.y + a.height + padding <= b.y ||
    b.y + b.height + padding <= a.y
  );
}

function withinBounds(rect: Rect, bounds: Rect | undefined): boolean {
  if (bounds === undefined) return true;
  return (
    rect.x >= bounds.x &&
    rect.y >= bounds.y &&
    rect.x + rect.width <= bounds.x + bounds.width &&
    rect.y + rect.height <= bounds.y + bounds.height
  );
}

/**
 * Decide which data labels can be drawn, and where.
 *
 * A single greedy pass in priority order: place the most important label
 * first, then each subsequent one only if it fits. Labels marked `nudgeable`
 * get a chance to shift vertically before being dropped.
 *
 * Greedy rather than an optimal packing on purpose. Optimal label placement is
 * NP-hard, this runs on every data change, and the visual difference on a
 * phone-sized chart is negligible. What matters far more is that the result is
 * STABLE: the same input must always produce the same output, or labels flicker
 * in and out as a chart animates.
 *
 * Shared by data labels (phase 13) and annotations (phase 22) — the roadmap is
 * explicit that annotations must not grow a second implementation of this.
 */
export function resolveLabelPlacement(
  candidates: readonly LabelCandidate[],
  options: LabelPlacementOptions = {}
): PlacedLabel[] {
  const padding = options.padding ?? 2;

  const bounds = options.bounds;

  // Sort by priority, then by id, so ties resolve deterministically.
  const ordered = [...candidates].sort((a, b) =>
    b.priority !== a.priority
      ? b.priority - a.priority
      : a.id < b.id
        ? -1
        : a.id > b.id
          ? 1
          : 0
  );

  const placed: Rect[] = [];
  const results = new Map<string, PlacedLabel>();

  for (const candidate of ordered) {
    let rect = candidate.rect;
    let offsetY = 0;
    let ok =
      withinBounds(rect, bounds) &&
      !placed.some((p) => intersects(rect, p, padding));

    const maxNudge =
      options.maxNudge ?? Math.ceil(candidate.rect.height + padding + 2);

    if (!ok && candidate.nudgeable === true) {
      // Try alternating up/down nudges in growing steps.
      for (let step = 2; step <= maxNudge && !ok; step += 2) {
        for (const direction of [-1, 1]) {
          const shifted: Rect = {
            ...rect,
            y: candidate.rect.y + direction * step,
          };
          if (
            withinBounds(shifted, bounds) &&
            !placed.some((p) => intersects(shifted, p, padding))
          ) {
            rect = shifted;
            offsetY = direction * step;
            ok = true;
            break;
          }
        }
      }
    }

    if (ok) placed.push(rect);
    results.set(candidate.id, {
      id: candidate.id,
      rect,
      visible: ok,
      offsetY,
    });
  }

  // Return in the caller's original order, not priority order.
  return candidates.map(
    (c) =>
      results.get(c.id) ?? {
        id: c.id,
        rect: c.rect,
        visible: false,
        offsetY: 0,
      }
  );
}
