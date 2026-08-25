export interface ZetaDbRetentionProposal {
  readonly currentEventIds: readonly string[];
  readonly candidateEventIds: readonly string[];
  readonly limit: number;
}

export interface ZetaDbRetentionDecision {
  readonly retainedEventIds: readonly string[];
}

export interface ZetaDbCheckpointByteRetentionProposal extends ZetaDbRetentionProposal {
  readonly maxCheckpointBytes: number;
  /** Exact kernel-owned measurement; `null` means the proposed subset cannot form a valid image. */
  measureCheckpointBytes(retainedEventIds: readonly string[]): number | null;
}

export interface ZetaDbCheckpointByteRetentionContext {
  readonly maxCheckpointBytes: number;
  measureCheckpointBytes(retainedEventIds: readonly string[]): number | null;
}

export type ZetaDbRetentionResource = "retained-events" | "checkpoint-bytes";

export interface ZetaDbRetentionHeatReceipt {
  readonly code: "database-retention-displaced";
  readonly signal: "forgotten";
  readonly kind: "database-retention.forgotten";
  readonly policyId: string;
  readonly resource: ZetaDbRetentionResource;
  readonly limit: number;
  readonly units: number;
  readonly displacedEventIds: readonly string[];
  readonly detail: string;
}

export interface ZetaDbRetentionReceipt {
  readonly policyId: string;
  readonly resource: ZetaDbRetentionResource;
  readonly limit: number;
  readonly retainedEventIds: readonly string[];
  readonly displacedEventIds: readonly string[];
  readonly refusedEventIds: readonly string[];
  readonly duplicateEventIds: readonly string[];
  readonly heatReceipts: readonly ZetaDbRetentionHeatReceipt[];
}

export interface ZetaDbRetentionFeedback {
  readonly code: "database-retention-request-invalid" | "database-retention-policy-failed";
  readonly detail: string;
}

export type ZetaDbRetentionResult =
  | { readonly ok: true; readonly value: ZetaDbRetentionReceipt }
  | { readonly ok: false; readonly feedback: ZetaDbRetentionFeedback };

/** Pure event-count policy port. The evaluator owns validation and derives all loss accounting. */
export interface ZetaDbEventCountRetentionPolicyPort {
  readonly id: string;
  readonly resource: "retained-events";
  plan(proposal: ZetaDbRetentionProposal): ZetaDbRetentionDecision;
}

/** Pure byte-bound policy port. Encoding and row folding stay behind the supplied measurement capability. */
export interface ZetaDbCheckpointByteRetentionPolicyPort {
  readonly id: string;
  readonly resource: "checkpoint-bytes";
  plan(proposal: ZetaDbCheckpointByteRetentionProposal): ZetaDbRetentionDecision;
}

export type ZetaDbRetentionPolicyPort = ZetaDbEventCountRetentionPolicyPort | ZetaDbCheckpointByteRetentionPolicyPort;

export const ZETA_DB_RETENTION_MODE_IDS = [
  "no-forget-backpressure",
  "canonical-event-id",
  "canonical-checkpoint-byte",
] as const;

export type ZetaDbRetentionModeId = (typeof ZETA_DB_RETENTION_MODE_IDS)[number];

export interface ZetaDbRetentionModeSelection {
  readonly id: ZetaDbRetentionModeId;
  /** Omitted for the kernel's existing incremental no-forget path. */
  readonly retentionPolicy?: ZetaDbRetentionPolicyPort;
}

export interface ZetaDbRetentionModeFeedback {
  readonly code: "database-retention-mode-invalid";
  readonly detail: string;
}

export type ZetaDbRetentionModeResult =
  | { readonly ok: true; readonly value: ZetaDbRetentionModeSelection }
  | { readonly ok: false; readonly feedback: ZetaDbRetentionModeFeedback };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isEventId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024;
}

function compareOrdinal(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sorted(values: ReadonlySet<string>): readonly string[] {
  return [...values].sort(compareOrdinal);
}

function snapshotIds(value: unknown): unknown {
  return Array.isArray(value) ? value.map((entry: unknown) => entry) : value;
}

function snapshotProposal(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    currentEventIds: snapshotIds(value.currentEventIds),
    candidateEventIds: snapshotIds(value.candidateEventIds),
    limit: value.limit,
  };
}

function validProposal(value: unknown): value is ZetaDbRetentionProposal {
  if (!isRecord(value) || !Array.isArray(value.currentEventIds) || !Array.isArray(value.candidateEventIds)) {
    return false;
  }
  if (!Number.isSafeInteger(value.limit) || (value.limit as number) < 1) return false;
  if (!value.currentEventIds.every(isEventId) || !value.candidateEventIds.every(isEventId)) return false;
  const current = new Set(value.currentEventIds);
  return current.size === value.currentEventIds.length;
}

function snapshotDecision(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return { retainedEventIds: snapshotIds(value.retainedEventIds) };
}

function validDecision(value: unknown, known: ReadonlySet<string>, limit: number): value is ZetaDbRetentionDecision {
  if (!isRecord(value) || !Array.isArray(value.retainedEventIds)) return false;
  if (!value.retainedEventIds.every(isEventId)) return false;
  const retained = new Set(value.retainedEventIds);
  return (
    retained.size === value.retainedEventIds.length &&
    retained.size <= limit &&
    value.retainedEventIds.every((eventId) => known.has(eventId))
  );
}

interface ZetaDbEvaluatedRetentionDecision {
  readonly policyId: string;
  readonly resource: ZetaDbRetentionResource;
  readonly limit: number;
  readonly decision: unknown;
}

type ZetaDbEvaluatedRetentionDecisionResult =
  | { readonly ok: true; readonly value: ZetaDbEvaluatedRetentionDecision }
  | { readonly ok: false; readonly feedback: ZetaDbRetentionFeedback };

function validPolicy(value: unknown): value is ZetaDbRetentionPolicyPort {
  return (
    isRecord(value) &&
    isEventId(value.id) &&
    (value.resource === "retained-events" || value.resource === "checkpoint-bytes") &&
    typeof value.plan === "function"
  );
}

function validCheckpointContext(value: unknown): value is ZetaDbCheckpointByteRetentionContext {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.maxCheckpointBytes) &&
    (value.maxCheckpointBytes as number) > 0 &&
    typeof value.measureCheckpointBytes === "function"
  );
}

function guardedCheckpointMeasurement(
  proposal: ZetaDbRetentionProposal,
  context: ZetaDbCheckpointByteRetentionContext,
): (retainedEventIds: readonly string[]) => number | null {
  const known = new Set([...proposal.currentEventIds, ...proposal.candidateEventIds]);
  return (retainedEventIds) => {
    if (!Array.isArray(retainedEventIds) || !retainedEventIds.every(isEventId)) return null;
    const retained = new Set(retainedEventIds);
    if (
      retained.size !== retainedEventIds.length ||
      retained.size > proposal.limit ||
      retainedEventIds.some((eventId) => !known.has(eventId))
    ) {
      return null;
    }
    try {
      const measured = context.measureCheckpointBytes([...retainedEventIds]);
      return typeof measured === "number" && Number.isSafeInteger(measured) && measured >= 0 ? measured : null;
    } catch {
      return null;
    }
  };
}

function decisionFailed(code: ZetaDbRetentionFeedback["code"], detail: string): ZetaDbEvaluatedRetentionDecisionResult {
  return { ok: false, feedback: { code, detail } };
}

function executeRetentionPolicy(
  policyValue: unknown,
  proposal: ZetaDbRetentionProposal,
  checkpointContext?: ZetaDbCheckpointByteRetentionContext,
): ZetaDbEvaluatedRetentionDecisionResult {
  let policyId = "<unreadable>";
  try {
    if (!validPolicy(policyValue)) {
      return decisionFailed(
        "database-retention-policy-failed",
        "The database retention policy is not a named pure planner.",
      );
    }
    const policy = policyValue;
    policyId = policy.id;
    if (policy.resource === "retained-events") {
      return {
        ok: true,
        value: {
          policyId: policy.id,
          resource: policy.resource,
          limit: proposal.limit,
          decision: snapshotDecision(policy.plan(proposal)),
        },
      };
    }
    if (!validCheckpointContext(checkpointContext)) {
      return decisionFailed(
        "database-retention-request-invalid",
        "Checkpoint-byte retention requires a positive byte limit and an exact measurement capability.",
      );
    }
    const measureCheckpointBytes = guardedCheckpointMeasurement(proposal, checkpointContext);
    const decision = snapshotDecision(
      policy.plan({ ...proposal, maxCheckpointBytes: checkpointContext.maxCheckpointBytes, measureCheckpointBytes }),
    );
    const retainedEventIds = isRecord(decision) ? decision.retainedEventIds : null;
    const measured = Array.isArray(retainedEventIds) ? measureCheckpointBytes(retainedEventIds) : null;
    const retainedCount = Array.isArray(retainedEventIds) ? retainedEventIds.length : 0;
    if (measured === null || (retainedCount > 0 && measured > checkpointContext.maxCheckpointBytes)) {
      return decisionFailed(
        "database-retention-policy-failed",
        `Database retention policy ${policy.id} returned a plan outside the checkpoint-byte bound.`,
      );
    }
    return {
      ok: true,
      value: {
        policyId: policy.id,
        resource: policy.resource,
        limit: checkpointContext.maxCheckpointBytes,
        decision,
      },
    };
  } catch (error) {
    return decisionFailed(
      "database-retention-policy-failed",
      `Database retention policy ${policyId} failed: ${String(error)}`,
    );
  }
}

function failed(code: ZetaDbRetentionFeedback["code"], detail: string): ZetaDbRetentionResult {
  return { ok: false, feedback: { code, detail } };
}

function candidateSets(
  current: ReadonlySet<string>,
  candidateEventIds: readonly string[],
): { readonly novel: ReadonlySet<string>; readonly duplicates: ReadonlySet<string> } {
  const seen = new Set(current);
  const novel = new Set<string>();
  const duplicates = new Set<string>();
  for (const eventId of candidateEventIds) {
    if (seen.has(eventId)) duplicates.add(eventId);
    else {
      seen.add(eventId);
      novel.add(eventId);
    }
  }
  return { novel, duplicates };
}

/**
 * Execute an injected policy inside a guarded boundary. Policies choose only the retained IDs;
 * refused candidates, displaced history, duplicate input, and displacement heat are derived here.
 */
export function evaluateZetaDbRetentionPolicy(
  policy: ZetaDbRetentionPolicyPort,
  proposalValue: ZetaDbRetentionProposal,
  checkpointContext?: ZetaDbCheckpointByteRetentionContext,
): ZetaDbRetentionResult {
  let proposal: unknown;
  try {
    proposal = snapshotProposal(proposalValue);
  } catch (error) {
    return failed(
      "database-retention-request-invalid",
      `Database retention proposal could not be read: ${String(error)}`,
    );
  }
  if (!validProposal(proposal)) {
    return failed(
      "database-retention-request-invalid",
      "Database retention requires unique current event IDs within a positive safe-integer limit and bounded candidate IDs.",
    );
  }

  const countProposal: ZetaDbRetentionProposal = {
    currentEventIds: [...proposal.currentEventIds],
    candidateEventIds: [...proposal.candidateEventIds],
    limit: proposal.limit,
  };
  const evaluated = executeRetentionPolicy(policy, countProposal, checkpointContext);
  if (!evaluated.ok) return evaluated;
  const { policyId, resource, limit, decision } = evaluated.value;

  const current = new Set(proposal.currentEventIds);
  const candidates = candidateSets(current, proposal.candidateEventIds);
  const known = new Set([...current, ...candidates.novel]);
  if (!validDecision(decision, known, proposal.limit)) {
    return failed(
      "database-retention-policy-failed",
      `Database retention policy ${policyId} returned an invalid plan.`,
    );
  }

  const retained = new Set(decision.retainedEventIds);
  const displaced = new Set([...current].filter((eventId) => !retained.has(eventId)));
  const refused = new Set([...candidates.novel].filter((eventId) => !retained.has(eventId)));
  const displacedEventIds = sorted(displaced);
  const heatReceipts: readonly ZetaDbRetentionHeatReceipt[] =
    displacedEventIds.length === 0
      ? []
      : [
          {
            code: "database-retention-displaced",
            signal: "forgotten",
            kind: "database-retention.forgotten",
            policyId,
            resource,
            limit,
            units: displacedEventIds.length,
            displacedEventIds,
            detail: `Retention policy ${policyId} displaced ${String(displacedEventIds.length)} retained event(s).`,
          },
        ];
  return {
    ok: true,
    value: {
      policyId,
      resource,
      limit,
      retainedEventIds: sorted(retained),
      displacedEventIds,
      refusedEventIds: sorted(refused),
      duplicateEventIds: sorted(candidates.duplicates),
      heatReceipts,
    },
  };
}

/** Preserve admitted history and refuse novel events once the finite entry limit binds. */
export const noForgetBackpressureRetentionPolicy: ZetaDbEventCountRetentionPolicyPort = {
  id: "no-forget-backpressure",
  resource: "retained-events",
  plan: (proposal) => {
    const retained = [...proposal.currentEventIds];
    const seen = new Set(retained);
    for (const eventId of proposal.candidateEventIds) {
      if (seen.has(eventId)) continue;
      seen.add(eventId);
      if (retained.length < proposal.limit) retained.push(eventId);
    }
    return { retainedEventIds: retained };
  },
};

/**
 * Retain the ordinally-smallest event IDs from the observed union. This converges for a shared
 * finite event-count bound, at the explicit cost of displacing previously retained history.
 */
export const canonicalEventIdRetentionPolicy: ZetaDbEventCountRetentionPolicyPort = {
  id: "canonical-event-id",
  resource: "retained-events",
  plan: (proposal) => ({
    retainedEventIds: [...new Set([...proposal.currentEventIds, ...proposal.candidateEventIds])]
      .sort(compareOrdinal)
      .slice(0, proposal.limit),
  }),
};

/**
 * Retain the ordinally-smallest event-ID subset whose exact canonical image fits the byte bound.
 * Invalid intermediate folds and oversized candidates are skipped deterministically.
 */
export const canonicalCheckpointByteRetentionPolicy: ZetaDbCheckpointByteRetentionPolicyPort = {
  id: "canonical-checkpoint-byte",
  resource: "checkpoint-bytes",
  plan: (proposal) => {
    let retainedEventIds: readonly string[] = [];
    for (const eventId of [...new Set([...proposal.currentEventIds, ...proposal.candidateEventIds])].sort(
      compareOrdinal,
    )) {
      if (retainedEventIds.length >= proposal.limit) break;
      const candidate = [...retainedEventIds, eventId];
      const measured = proposal.measureCheckpointBytes(candidate);
      if (measured !== null && measured <= proposal.maxCheckpointBytes) retainedEventIds = candidate;
    }
    return { retainedEventIds };
  },
};

/** Resolve untrusted runtime configuration without letting a string become an executable policy. */
export function resolveZetaDbRetentionMode(value: unknown): ZetaDbRetentionModeResult {
  switch (value) {
    case "no-forget-backpressure":
      return { ok: true, value: { id: value } };
    case "canonical-event-id":
      return { ok: true, value: { id: value, retentionPolicy: canonicalEventIdRetentionPolicy } };
    case "canonical-checkpoint-byte":
      return { ok: true, value: { id: value, retentionPolicy: canonicalCheckpointByteRetentionPolicy } };
    default:
      return {
        ok: false,
        feedback: {
          code: "database-retention-mode-invalid",
          detail: `Database retention mode must be one of: ${ZETA_DB_RETENTION_MODE_IDS.join(", ")}.`,
        },
      };
  }
}
