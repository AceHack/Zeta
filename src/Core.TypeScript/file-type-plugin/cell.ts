import { type ZSet, empty, union } from "../z-set/z-set";
import { type Tagged } from "../dynamic-value/types";
import { type IDeltaLog, InMemoryDeltaLog } from "../durability/delta-log";
import { compareTagged } from "./types";

export class ZetaCell {
  readonly identity: string;
  readonly log: IDeltaLog<Tagged>;
  private currentState: ZSet<Tagged> = empty();
  private logicalTime = 0;

  constructor(identity: string, log: IDeltaLog<Tagged> = new InMemoryDeltaLog()) {
    this.identity = identity;
    this.log = log;
  }

  /**
   * Appends a delta ZSet to the cell's durable log and updates current state.
   */
  async append(delta: ZSet<Tagged>, captured: ReadonlyMap<string, string> = new Map()): Promise<number> {
    const seq = await this.log.append(delta, captured);
    this.currentState = union(compareTagged, this.currentState, delta);
    return seq;
  }

  /**
   * Replays the cell's log from the beginning to reconstruct the current state.
   */
  async replay(): Promise<void> {
    const entries = await this.log.replay(0);
    this.currentState = empty();
    for (const entry of entries) {
      this.currentState = union(compareTagged, this.currentState, entry.delta);
    }
  }

  /**
   * Gets the current accumulated state of the cell.
   */
  getState(): ZSet<Tagged> {
    return this.currentState;
  }

  /**
   * Advances the logical time crystal clock by 1 tick and processes the inputs.
   */
  async tick(inputs: ZSet<Tagged>): Promise<number> {
    this.logicalTime += 1;
    // Map the tick sequence to a trace map to ensure captured context exists
    const trace = new Map<string, string>([["tick", this.logicalTime.toString()]]);
    return this.append(inputs, trace);
  }

  /**
   * Gets the current logical clock time.
   */
  getLogicalTime(): number {
    return this.logicalTime;
  }
}
