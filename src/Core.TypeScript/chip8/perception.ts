/**
 * perception.ts — pixels → objects → geometry, the forced perception layers.
 *
 * The layer this file adds is the one the key predictor was missing: before it,
 * "spatial reasoning" was two color-filtered centroids, which meant the two
 * static walls in mutual-sim (color 1, 32 lit pixels) dominated the "target"
 * centroid over the actual 4-12 pixel adversary sharing their color plane —
 * the agent was steering off the average of the furniture.
 *
 * Layer 1 (objects):   4-connected components per color value, with bounding
 *                      boxes, centroids and pixel areas.
 * Layer 2 (tracking):  stable identities across frames by nearest-centroid
 *                      matching with deterministic tie-breaks; per-track
 *                      velocity (EMA) and a static/moving classification.
 * Layer 3 (relations): pairwise geometry between tracks — offset, distance,
 *                      closing speed — the features hunt/flee actually needs.
 *
 * Everything is pure and deterministic: same display sequence → same tracks,
 * same ids, same velocities. No wall clock, no ambient randomness (DST-safe).
 *
 * Anchors: connected-component labeling (Rosenfeld & Pfaltz 1966); nearest-
 * neighbour data association is the greedy special case of the assignment
 * problem (Kuhn 1955, Hungarian method) — greedy chosen deliberately: at
 * ≤ a dozen blobs the optimal assignment and the greedy one coincide except
 * under pathological symmetry, which the deterministic tie-break resolves
 * reproducibly.
 */

export interface Blob {
  /** Color value shared by every pixel in the blob (1..7 in the CHIP-9 planes). */
  readonly color: number;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  /** Centroid (pixel coordinates, sub-pixel precision). */
  readonly cx: number;
  readonly cy: number;
  /** Lit pixel count. */
  readonly area: number;
}

export interface TrackedObject extends Blob {
  /** Stable identity across frames. Never reused within one PerceptionState. */
  readonly id: number;
  /** Per-tick velocity, exponentially smoothed. */
  readonly vx: number;
  readonly vy: number;
  /** Ticks this track has been alive. */
  readonly age: number;
  /** True once the track has moved less than STATIC_EPS for STATIC_AGE ticks. */
  readonly isStatic: boolean;
  /** Centroid at birth — the fixed point a glitching wall oscillates around. */
  readonly originX: number;
  readonly originY: number;
  /** Farthest the centroid has ever been from its birth position. */
  readonly farthest: number;
  /** True once the track has TRAVELLED — been ≥ MOVED_DIST_MIN px from its
   *  birth spot. Separates an agent from furniture: a wall brushed by a
   *  passing sprite (same-color merge, or wall pixels superposed to another
   *  color for an instruction) wiggles ~1px around a fixed point on every
   *  brush, and per-tick motion counters therefore accrue at TRAFFIC rate —
   *  net displacement is the signal traffic cannot fake. */
  readonly everMoved: boolean;
  /**
   * 0 when the object was seen this tick. Sprites are XOR-erased and redrawn
   * every game-loop iteration, so a display sampled mid-iteration can miss an
   * object for one frame; a track coasts (position advanced by its velocity)
   * for up to COAST_GRACE ticks before dying, keeping identities stable
   * through sampling-phase flicker.
   */
  readonly coastTicks: number;
}

export interface RelationFeature {
  readonly aId: number;
  readonly bId: number;
  /** b relative to a. */
  readonly dx: number;
  readonly dy: number;
  readonly dist: number;
  /** Positive = closing (distance shrinking per tick), negative = separating. */
  readonly closingSpeed: number;
}

export interface PerceptionState {
  readonly tick: number;
  readonly tracks: readonly TrackedObject[];
  readonly relations: readonly RelationFeature[];
  /** Monotone id source; part of the state so replay is exact. */
  readonly nextId: number;
  /** Previous pairwise distances, for closing speed. Key: "aId:bId" (a<b). */
  readonly prevDist: ReadonlyMap<string, number>;
}

export const STATIC_EPS = 0.15; // px/tick below which a track counts as still
export const STATIC_AGE = 8; // ticks of stillness before "static" latches
export const COAST_GRACE = 2; // ticks a vanished track survives on prediction
export const MOVED_DIST_MIN = 4; // px from birth spot before everMoved latches
const VELOCITY_EMA = 0.5; // smoothing for per-tick velocity
const MATCH_MAX_DIST = 12; // beyond this a blob is a new object, not a move

export function createPerceptionState(): PerceptionState {
  return { tick: 0, tracks: [], relations: [], nextId: 1, prevDist: new Map() };
}

/**
 * Layer 1 — connected components over the color display.
 * `display[i]` is the color value at (i % w, floor(i / w)); 0 = unlit.
 * Two lit pixels join the same blob iff 4-adjacent AND the same color value.
 * Row-major scan + union-find keeps labeling order-independent of content.
 */
export function detectBlobs(display: readonly number[], w = 64, h = 32): Blob[] {
  const size = w * h;
  const label = new Int32Array(size).fill(-1);
  const parent: number[] = [];

  const find = (a: number): number => {
    let r = a;
    while (parent[r] !== r) r = parent[r]!;
    // path compression
    let c = a;
    while (parent[c] !== r) {
      const nxt = parent[c]!;
      parent[c] = r;
      c = nxt;
    }
    return r;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = display[i] ?? 0;
      if (c === 0) continue;
      const left = x > 0 && (display[i - 1] ?? 0) === c ? label[i - 1]! : -1;
      const up = y > 0 && (display[i - w] ?? 0) === c ? label[i - w]! : -1;
      if (left >= 0 && up >= 0) {
        label[i] = left;
        union(left, up);
      } else if (left >= 0) {
        label[i] = left;
      } else if (up >= 0) {
        label[i] = up;
      } else {
        const l = parent.length;
        parent.push(l);
        label[i] = l;
      }
    }
  }

  interface Acc {
    color: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    sumX: number;
    sumY: number;
    area: number;
  }
  const acc = new Map<number, Acc>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = display[i] ?? 0;
      if (c === 0) continue;
      const root = find(label[i]!);
      let a = acc.get(root);
      if (!a) {
        a = { color: c, minX: x, minY: y, maxX: x, maxY: y, sumX: 0, sumY: 0, area: 0 };
        acc.set(root, a);
      }
      if (x < a.minX) a.minX = x;
      if (y < a.minY) a.minY = y;
      if (x > a.maxX) a.maxX = x;
      if (y > a.maxY) a.maxY = y;
      a.sumX += x;
      a.sumY += y;
      a.area += 1;
    }
  }

  const blobs: Blob[] = [];
  for (const a of acc.values()) {
    blobs.push({
      color: a.color,
      minX: a.minX,
      minY: a.minY,
      maxX: a.maxX,
      maxY: a.maxY,
      cx: a.sumX / a.area,
      cy: a.sumY / a.area,
      area: a.area,
    });
  }
  // Deterministic order: color, then top-left corner.
  blobs.sort((p, q) => p.color - q.color || p.minY - q.minY || p.minX - q.minX);
  return blobs;
}

/**
 * Layer 2 — associate this frame's blobs with existing tracks.
 * Greedy nearest-centroid within the same color, candidate pairs sorted by
 * (distance, trackId, blob order) so ties resolve identically on every run.
 */
export function trackBlobs(state: PerceptionState, blobs: readonly Blob[]): PerceptionState {
  interface Cand {
    ti: number;
    bi: number;
    d: number;
  }
  const cands: Cand[] = [];
  for (let ti = 0; ti < state.tracks.length; ti++) {
    const t = state.tracks[ti]!;
    for (let bi = 0; bi < blobs.length; bi++) {
      const b = blobs[bi]!;
      if (b.color !== t.color) continue;
      const d = Math.hypot(b.cx - t.cx, b.cy - t.cy);
      if (d <= MATCH_MAX_DIST) cands.push({ ti, bi, d });
    }
  }
  cands.sort((a, b) => a.d - b.d || state.tracks[a.ti]!.id - state.tracks[b.ti]!.id || a.bi - b.bi);

  const takenTrack = new Set<number>();
  const takenBlob = new Set<number>();
  const nextTracks: TrackedObject[] = [];
  let nextId = state.nextId;

  for (const c of cands) {
    if (takenTrack.has(c.ti) || takenBlob.has(c.bi)) continue;
    takenTrack.add(c.ti);
    takenBlob.add(c.bi);
    const t = state.tracks[c.ti]!;
    const b = blobs[c.bi]!;
    const rawVx = b.cx - t.cx;
    const rawVy = b.cy - t.cy;
    const vx = t.age === 0 ? rawVx : t.vx * (1 - VELOCITY_EMA) + rawVx * VELOCITY_EMA;
    const vy = t.age === 0 ? rawVy : t.vy * (1 - VELOCITY_EMA) + rawVy * VELOCITY_EMA;
    const still = Math.hypot(rawVx, rawVy) < STATIC_EPS;
    // isStatic latches on after STATIC_AGE still ticks; any real move clears it.
    const stillRun = still ? Math.min(t.age + 1, STATIC_AGE + 1) : 0;
    const isStatic = still ? t.isStatic || stillRun >= STATIC_AGE : false;
    const farthest = Math.max(t.farthest, Math.hypot(b.cx - t.originX, b.cy - t.originY));
    nextTracks.push({
      ...b,
      id: t.id,
      vx,
      vy,
      age: t.age + 1,
      isStatic,
      originX: t.originX,
      originY: t.originY,
      farthest,
      everMoved: farthest >= MOVED_DIST_MIN,
      coastTicks: 0,
    });
  }

  // Unmatched blobs become new tracks (ids minted in deterministic blob order).
  for (let bi = 0; bi < blobs.length; bi++) {
    if (takenBlob.has(bi)) continue;
    const b = blobs[bi]!;
    nextTracks.push({
      ...b,
      id: nextId++,
      vx: 0,
      vy: 0,
      age: 0,
      isStatic: false,
      originX: b.cx,
      originY: b.cy,
      farthest: 0,
      everMoved: false,
      coastTicks: 0,
    });
  }

  // Unmatched old tracks coast on their predicted position for COAST_GRACE
  // ticks (XOR-erase sampling flicker), then die.
  for (let ti = 0; ti < state.tracks.length; ti++) {
    if (takenTrack.has(ti)) continue;
    const t = state.tracks[ti]!;
    if (t.coastTicks >= COAST_GRACE) continue; // dead — left the screen for real
    nextTracks.push({
      ...t,
      cx: t.cx + t.vx,
      cy: t.cy + t.vy,
      minX: t.minX + t.vx,
      maxX: t.maxX + t.vx,
      minY: t.minY + t.vy,
      maxY: t.maxY + t.vy,
      age: t.age + 1,
      coastTicks: t.coastTicks + 1,
    });
  }

  nextTracks.sort((a, b) => a.id - b.id);

  // Layer 3 — pairwise relations with closing speed against the previous tick.
  const relations: RelationFeature[] = [];
  const prevDist = new Map<string, number>();
  for (let i = 0; i < nextTracks.length; i++) {
    for (let j = i + 1; j < nextTracks.length; j++) {
      const a = nextTracks[i]!;
      const b = nextTracks[j]!;
      const dx = b.cx - a.cx;
      const dy = b.cy - a.cy;
      const dist = Math.hypot(dx, dy);
      const key = `${a.id}:${b.id}`;
      const prev = state.prevDist.get(key);
      const closingSpeed = prev === undefined ? 0 : prev - dist;
      relations.push({ aId: a.id, bId: b.id, dx, dy, dist, closingSpeed });
      prevDist.set(key, dist);
    }
  }

  return { tick: state.tick + 1, tracks: nextTracks, relations, nextId, prevDist };
}

/** Convenience: one perception step (detect + track). */
export function perceive(
  state: PerceptionState,
  display: readonly number[],
  w = 64,
  h = 32,
): PerceptionState {
  return trackBlobs(state, detectBlobs(display, w, h));
}

/** The relation between two specific tracks, if both exist. */
export function relationBetween(
  state: PerceptionState,
  aId: number,
  bId: number,
): RelationFeature | null {
  for (const r of state.relations) {
    if (r.aId === aId && r.bId === bId) return r;
    if (r.aId === bId && r.bId === aId) {
      // Flip so the offset is b relative to a as asked.
      return { aId, bId, dx: -r.dx, dy: -r.dy, dist: r.dist, closingSpeed: r.closingSpeed };
    }
  }
  return null;
}
