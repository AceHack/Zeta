import type { ZetaDbExecutorKind, ZetaDbFeedback, ZetaDbTickReadout } from "../zetadb/zeta-db-node";

export const DARK_HALL_DATABASE_READOUT_SCHEMA = "zeta.darkhall.database-readout.v1" as const;
export const DARK_HALL_DATABASE_ROW_SELECTION_TOKEN_SCHEMA = "zeta.darkhall.database-row-selection-token.v1" as const;

export interface DarkHallDatabaseRow {
  readonly rowKey: string;
  readonly payload: string;
  readonly weight: number;
}

/** Versioned row evidence used by compare-and-swap edits. */
export interface DarkHallDatabaseRowSelectionToken {
  readonly schema: typeof DARK_HALL_DATABASE_ROW_SELECTION_TOKEN_SCHEMA;
  readonly nodeId: string;
  readonly revision: number;
  readonly row: DarkHallDatabaseRow;
}

export function selectDarkHallDatabaseRow(
  readout: DarkHallDatabaseReadout,
  rowKey: string,
): DarkHallDatabaseRowSelectionToken | null {
  const row = readout.rows.find((candidate) => candidate.rowKey === rowKey);
  return row === undefined
    ? null
    : {
        schema: DARK_HALL_DATABASE_ROW_SELECTION_TOKEN_SCHEMA,
        nodeId: readout.nodeId,
        revision: readout.revision,
        row: { ...row },
      };
}

export interface DarkHallDatabaseFeedback {
  readonly severity: ZetaDbFeedback["severity"];
  readonly code: ZetaDbFeedback["code"];
  readonly detail: string;
}

export interface DarkHallDatabaseReadout {
  readonly schema: typeof DARK_HALL_DATABASE_READOUT_SCHEMA;
  readonly sourceSchema: ZetaDbTickReadout["schema"];
  readonly nodeId: string;
  readonly executorId: string;
  readonly executorKind: ZetaDbExecutorKind;
  readonly revision: number;
  readonly admission: ZetaDbTickReadout["admission"];
  readonly accepted: number;
  readonly duplicates: number;
  readonly nextDeltaIndex: number;
  readonly rows: readonly DarkHallDatabaseRow[];
  readonly feedback: readonly DarkHallDatabaseFeedback[];
}

/** Copy one finite database tick into the UI-owned readout contract. */
export function zetaDbTickToDarkHallDatabaseReadout(readout: ZetaDbTickReadout): DarkHallDatabaseReadout {
  return {
    schema: DARK_HALL_DATABASE_READOUT_SCHEMA,
    sourceSchema: readout.schema,
    nodeId: readout.nodeId,
    executorId: readout.executorId,
    executorKind: readout.executorKind,
    revision: readout.revision,
    admission: readout.admission,
    accepted: readout.accepted,
    duplicates: readout.duplicates,
    nextDeltaIndex: readout.nextDeltaIndex,
    rows: readout.rows.map((row) => ({ ...row })),
    feedback: readout.feedback.map((item) => ({ ...item })),
  };
}
