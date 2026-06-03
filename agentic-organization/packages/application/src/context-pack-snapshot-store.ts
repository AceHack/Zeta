import type {
  ContextReadout,
  RunLifecyclePhase,
  RunTrace,
} from "./observe.ts";

export type ContextPackSnapshotRecord = {
  context: ContextReadout;
  recordedAt: string;
  trace: RunTrace;
  phase?: RunLifecyclePhase | undefined;
};

export type ContextPackSnapshotLookup = {
  contextPackId: string;
};

export type ContextPackScopeLookup = {
  organizationId: string;
  hatAssignmentId?: string | undefined;
  agentId?: string | undefined;
  projectId?: string | undefined;
  teamId?: string | undefined;
  workItemId?: string | undefined;
};

export type ContextPackSnapshotStorePort = {
  record: (snapshot: ContextPackSnapshotRecord) => Promise<void>;
  get: (lookup: ContextPackSnapshotLookup) => Promise<ContextPackSnapshotRecord | null>;
  latestForScope: (lookup: ContextPackScopeLookup) => Promise<ContextPackSnapshotRecord | null>;
};
