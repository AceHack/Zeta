import { type Compare, union, type ZSet, empty } from "../z-set/z-set";
import type { IDeltaLog } from "./delta-log";
import type { ISnapshotStore, SnapshotPointer } from "./snapshot-store";

/**
 * RecoverableSpine — ties an input IDeltaLog together with cadenced
 * snapshots (via a manifest-tracked ISnapshotStore) and a restore -> replay recovery path.
 */
export class RecoverableSpine<K> {
  private state: ZSet<K>;
  private appliedSeq: number;
  private cadence = 0;
  private commitsSinceSnapshot = 0;
  private latestSnapshotPointer: SnapshotPointer | null = null;
  private readonly compare: Compare<K>;
  private readonly log: IDeltaLog<K>;
  private readonly snap: ISnapshotStore<K>;

  constructor(
    compare: Compare<K>,
    log: IDeltaLog<K>,
    snap: ISnapshotStore<K>,
    initialState: ZSet<K>,
    initialSeq: number
  ) {
    this.compare = compare;
    this.log = log;
    this.snap = snap;
    this.state = initialState;
    this.appliedSeq = initialSeq;
  }

  /**
   * The current folded state (the "consolidated" view).
   */
  consolidate(): ZSet<K> {
    return this.state;
  }

  /**
   * Highest delta-log sequence folded into the current state.
   */
  getAppliedSeq(): number {
    return this.appliedSeq;
  }

  getLog(): IDeltaLog<K> {
    return this.log;
  }

  getSnapshotStore(): ISnapshotStore<K> {
    return this.snap;
  }

  /**
   * The most recent snapshot pointer taken by this spine this session, or null.
   */
  getLatestSnapshot(): SnapshotPointer | null {
    return this.latestSnapshotPointer;
  }

  /**
   * Take + GC a snapshot every N commits (0 disables).
   */
  getAutoSnapshotEvery(): number {
    return this.cadence;
  }

  setAutoSnapshotEvery(n: number): void {
    this.cadence = Math.max(0, n);
  }

  /**
   * Persist the current consolidated state as a snapshot.
   */
  async snapshot(): Promise<SnapshotPointer> {
    const p = await this.snap.write(this.appliedSeq, this.state);
    this.latestSnapshotPointer = p;
    this.commitsSinceSnapshot = 0;
    return p;
  }

  /**
   * Commit one input delta: append it to the durable log, then fold it into
   * the live state. If cadence is set and the threshold is crossed, take a
   * snapshot and GC the log through it.
   */
  async commit(delta: ZSet<K>, captured: ReadonlyMap<string, string> = new Map()): Promise<number> {
    const seq = await this.log.append(delta, captured);
    this.state = union(this.compare, this.state, delta);
    this.appliedSeq = seq;
    this.commitsSinceSnapshot += 1;

    if (this.cadence > 0 && this.commitsSinceSnapshot >= this.cadence) {
      const p = await this.snapshot();
      await this.log.truncate(p.seq);
    }
    return seq;
  }

  /**
   * Fold a replayed delta into the state during recovery.
   */
  applyReplayed(delta: ZSet<K>, seq: number): void {
    this.state = union(this.compare, this.state, delta);
    this.appliedSeq = seq;
  }

  /**
   * Recover a spine from durable state.
   */
  static async recover<K>(
    compare: Compare<K>,
    log: IDeltaLog<K>,
    snap: ISnapshotStore<K>,
    pointer?: SnapshotPointer
  ): Promise<RecoverableSpine<K>> {
    const resolved = pointer ? pointer : await snap.latest();
    let baseState: ZSet<K> = empty();
    let baseSeq = 0;

    if (resolved) {
      baseState = await snap.read(resolved);
      baseSeq = resolved.seq;
    }

    const spine = new RecoverableSpine<K>(compare, log, snap, baseState, baseSeq);
    const tail = await log.replay(baseSeq);
    for (const e of tail) {
      spine.applyReplayed(e.delta, e.seq);
    }
    return spine;
  }
}
