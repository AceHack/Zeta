/**
 * forge-host/index.ts — barrel export for the ForgeHost abstraction layer.
 */

// Types
export type {
  Result,
  ForgeError,
  ForgeErrorKind,
  ForgeType,
  DetectedForge,
  PullRequest,
  PrState,
  MergeStateStatus,
  ReviewDecision,
  MergeMethod,
  PrGateState,
  CheckSummary,
  NextAction,
  ThreadResolution,
  BatchResult,
  Issue,
  CheckRollup,
  CiCheck,
  CiConclusion,
  CiRun,
  RepoInfo,
  BranchProtection,
  TreeEntry,
  CreateCommitOpts,
  CommentRef,
  ListPrOpts,
  ListMergedPrOpts,
  CreatePrOpts,
  ListIssueOpts,
  CreateIssueOpts,
  GitRef,
  GitCommitInfo,
  SearchPrOpts,
  SearchPrResult,
  CheckId,
  UnknownReason,
  Verdict,
  VerdictKind,
  CheckExpectation,
  CheckDefinition,
  CheckObservation,
  CheckObservationFailure,
  CheckObservationPass,
  CheckObservationOpts,
} from "./types";

// Interface
export type { ForgeHost, CheckObservationSource } from "./forge-host";

// Result helpers
export { ok, err, forgeError } from "./result";

// Detection
export { detectForgeFromRemote, classifyHost, parseRemoteUrl } from "./detect";

// Registry
export { resolveForgeHost, resolveHostFromRemote, registerAdapter, clearRegistrations } from "./registry";
export type { AdapterFactory } from "./registry";
