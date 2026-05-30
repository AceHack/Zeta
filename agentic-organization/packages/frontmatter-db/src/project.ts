/**
 * Project the event log into materialized frontmatter rows (the current state).
 *
 * State = a deterministic fold over the events of a table, ordered by the
 * timestamp carried inside each ZetaId, with the id as a stable tiebreaker.
 * Because the order is derived from the ids (not from insertion/merge order),
 * project(merge(a, b)) === project(merge(b, a)) — the CRDT convergence property.
 *
 * Semantics (retraction-native, Z-set style):
 *   - upsert : merge fields into the aggregate (last-writer-wins by timestamp)
 *   - retract: tombstone the aggregate (drops out of the projection)
 * A later upsert after a retract revives the aggregate (op order is timestamp).
 */

import type { EventLog } from "./crdt-log.ts";
import { EventOp, timestampMsFromZetaId, type ZetaIdDecimal } from "./event.ts";
import type { FrontmatterRow, FrontmatterValue } from "./schema.ts";

export type Projection = ReadonlyMap<ZetaIdDecimal, FrontmatterRow>;

type Accumulator = { values: Record<string, FrontmatterValue>; live: boolean };

export function project(log: EventLog, table: string): Projection {
  const ordered = [...log.values()]
    .filter((event) => event.table === table)
    .sort((x, y) => {
      const tx = timestampMsFromZetaId(x.id);
      const ty = timestampMsFromZetaId(y.id);
      if (tx !== ty) {
        return tx - ty;
      }
      return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
    });

  const accumulators = new Map<ZetaIdDecimal, Accumulator>();
  for (const event of ordered) {
    const current = accumulators.get(event.aggregateId) ?? { values: {}, live: false };
    if (event.op === EventOp.Retract) {
      current.live = false;
    } else {
      for (const [key, value] of Object.entries(event.fields)) {
        current.values[key] = value;
      }
      current.live = true;
    }
    accumulators.set(event.aggregateId, current);
  }

  const rows = new Map<ZetaIdDecimal, FrontmatterRow>();
  for (const [aggregateId, accumulator] of accumulators) {
    if (accumulator.live) {
      rows.set(aggregateId, { table, values: accumulator.values });
    }
  }
  return rows;
}
