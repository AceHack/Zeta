import { ZSet } from "../z-set/z-set";

/**
 * A durable pointer to a snapshot: the store handle + the delta-log sequence the snapshot covers.
 */
export interface SnapshotPointer {
  readonly handle: unknown;
  readonly seq: number;
}

/**
 * Snapshot store with stable, manifest-tracked addressing.
 */
export interface ISnapshotStore<K> {
  /**
   * Persist state at seq; update the durable manifest; return the pointer.
   */
  write(seq: number, state: ZSet<K>): Promise<SnapshotPointer>;

  /**
   * Load a snapshot by pointer.
   */
  read(pointer: SnapshotPointer): Promise<ZSet<K>>;

  /**
   * The latest snapshot pointer from the manifest, or null if none written.
   */
  latest(): Promise<SnapshotPointer | null>;
}

/**
 * In-memory snapshot store — the reference + test substrate.
 */
export class InMemorySnapshotStore<K> implements ISnapshotStore<K> {
  private readonly store = new Map<number, ZSet<K>>();
  private latestPointer: SnapshotPointer | null = null;

  async write(seq: number, state: ZSet<K>): Promise<SnapshotPointer> {
    const p: SnapshotPointer = { handle: seq, seq };
    this.store.set(seq, state);
    this.latestPointer = p;
    return p;
  }

  async read(pointer: SnapshotPointer): Promise<ZSet<K>> {
    const seq = pointer.handle as number;
    const state = this.store.get(seq);
    if (state === undefined) {
      throw new Error(`InMemorySnapshotStore.read: snapshot not found for seq ${seq}`);
    }
    return state;
  }

  async latest(): Promise<SnapshotPointer | null> {
    return this.latestPointer;
  }
}
