import type { ZSet } from "../z-set/z-set";

/**
 * One entry in the delta log — the durable record of a committed input Z-set delta
 * at a logical sequence number, plus any captured non-determinism the producer read.
 */
export interface DeltaLogEntry<K> {
  readonly seq: number;
  readonly delta: ZSet<K>;
  readonly captured: ReadonlyMap<string, string>;
}

/**
 * Append-only delta log — the durable-tier mechanism for "persist inputs, recompute derived".
 */
export interface IDeltaLog<K> {
  /**
   * Append a committed delta; returns the assigned sequence number (monotonic, starting at 1).
   */
  append(delta: ZSet<K>, captured: ReadonlyMap<string, string>): Promise<number>;

  /**
   * Replay entries with seq strictly greater than `fromSeqExclusive`, in order.
   */
  replay(fromSeqExclusive: number): Promise<readonly DeltaLogEntry<K>[]>;

  /**
   * Highest assigned sequence number (0 if empty).
   */
  highWater(): number;

  /**
   * GC entries with seq <= `throughSeqInclusive`.
   */
  truncate(throughSeqInclusive: number): Promise<void>;
}

/**
 * In-memory delta log — the reference implementation + the test substrate.
 */
export class InMemoryDeltaLog<K> implements IDeltaLog<K> {
  private readonly entries: DeltaLogEntry<K>[] = [];
  private nextSeq = 0;

  async append(delta: ZSet<K>, captured: ReadonlyMap<string, string>): Promise<number> {
    this.nextSeq += 1;
    this.entries.push({ seq: this.nextSeq, delta, captured });
    return this.nextSeq;
  }

  async replay(fromSeqExclusive: number): Promise<readonly DeltaLogEntry<K>[]> {
    return this.entries.filter((e) => e.seq > fromSeqExclusive);
  }

  highWater(): number {
    return this.nextSeq;
  }

  async truncate(throughSeqInclusive: number): Promise<void> {
    const idx = this.entries.findIndex((e) => e.seq > throughSeqInclusive);
    if (idx === -1) {
      this.entries.length = 0;
    } else if (idx > 0) {
      this.entries.splice(0, idx);
    }
  }
}
