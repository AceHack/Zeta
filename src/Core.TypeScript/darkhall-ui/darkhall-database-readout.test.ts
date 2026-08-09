import { describe, expect, it } from "bun:test";
import { ZETA_DB_TICK_SCHEMA, type ZetaDbTickReadout } from "../zetadb/zeta-db-node";
import { DARK_HALL_DATABASE_READOUT_SCHEMA, zetaDbTickToDarkHallDatabaseReadout } from "./darkhall-database-readout";

describe("Dark Hall database readout", () => {
  it("copies a finite ZetaDB tick into the UI-owned contract", () => {
    const tick: ZetaDbTickReadout = {
      schema: ZETA_DB_TICK_SCHEMA,
      nodeId: "room-db",
      executorId: "tab-b",
      executorKind: "browser-tab",
      revision: 7,
      admission: "backpressured",
      accepted: 2,
      duplicates: 1,
      nextDeltaIndex: 3,
      rows: [{ rowKey: "game/score", payload: "9000", weight: 1 }],
      feedback: [
        {
          severity: "backpressure",
          code: "database-capacity-exhausted",
          detail: "The tick spent its delta budget.",
        },
      ],
    };

    const readout = zetaDbTickToDarkHallDatabaseReadout(tick);

    expect(readout).toEqual({
      schema: DARK_HALL_DATABASE_READOUT_SCHEMA,
      sourceSchema: ZETA_DB_TICK_SCHEMA,
      nodeId: "room-db",
      executorId: "tab-b",
      executorKind: "browser-tab",
      revision: 7,
      admission: "backpressured",
      accepted: 2,
      duplicates: 1,
      nextDeltaIndex: 3,
      rows: [{ rowKey: "game/score", payload: "9000", weight: 1 }],
      feedback: [
        {
          severity: "backpressure",
          code: "database-capacity-exhausted",
          detail: "The tick spent its delta budget.",
        },
      ],
    });
    expect(readout.rows).not.toBe(tick.rows);
    expect(readout.feedback).not.toBe(tick.feedback);
  });
});
