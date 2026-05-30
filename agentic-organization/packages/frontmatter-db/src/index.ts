export {
  ColumnType,
  edgeColumns,
  findColumn,
  primaryKeyColumn,
  type ColumnDef,
  type FrontmatterRow,
  type FrontmatterValue,
  type TableSchema,
} from "./schema.ts";
export {
  EventOp,
  asZetaIdDecimal,
  timestampMsFromZetaId,
  zetaIdWithTimestamp,
  type FrontmatterEvent,
  type ZetaIdDecimal,
} from "./event.ts";
export {
  appendEvent,
  emptyLog,
  fromEvents,
  logSize,
  mergeLogs,
  type EventLog,
} from "./crdt-log.ts";
export { project, type Projection } from "./project.ts";
export { parseCreateTable, type SchemaParseResult } from "./sql-to-schema.ts";
export { validateRow, type RowViolation, type ValidationResult } from "./validate.ts";
export { edgesOf, neighbors, type Edge } from "./traverse.ts";
export {
  ParseFeedbackReason,
  documentToRow,
  parseFrontmatterDocument,
  rowToDocument,
  serializeFrontmatterDocument,
  type ParsedDocument,
  type ParseResult,
} from "./frontmatter-codec.ts";
export { emitCreateTable } from "./schema-to-sql.ts";
export {
  SyncDirection,
  syncGitToIndex,
  syncIndexToGit,
  type GitEventSink,
  type GitEventSource,
  type GitToIndexResult,
  type IdGenerator,
  type IndexRowSink,
  type IndexRowSource,
  type IndexToGitResult,
  type SyncFeedback,
} from "./sync.ts";
export {
  EventCodecFeedbackReason,
  parseEvent,
  serializeEvent,
  type EventParseResult,
} from "./event-codec.ts";
export {
  GitFsAdapterFeedbackReason,
  createGitFsAdapter,
  eventFilePath,
  type EventFileSystem,
  type GitFsAdapter,
  type GitFsLoadResult,
} from "./git-fs-adapter.ts";
export {
  createInMemoryCockroachRowSink,
  type CockroachRowSink,
} from "./cockroach-row-sink.ts";
export {
  ReconcileCycleStatus,
  ReconcileLane,
  createReconcileWorker,
  type CreateReconcileWorkerInput,
  type ReconcileCycleResult,
  type ReconcileLaneFailure,
  type ReconcileTableSummary,
  type ReconcileWorker,
} from "./reconcile-worker.ts";
