/**
 * Hat admission policies — the 7 OPA Gatekeeper throttles as pure,
 * deterministic admission checks.
 *
 * Faithful port of
 * `full-ai-cluster/k8s/applications/hat-system/policies/01..07` (Merge1 §07):
 *   01 cooldown, 02 max-bindings, 03 conflict-of-interest, 04 quorum,
 *   05 warmup, 06 max-new-hats, 07 no-supervisor-cycles.
 *
 * Each policy is a pure function of the `AdmissionRequest` + `HatPolicy`.
 * Time arithmetic uses the request's `nowIso` (NOT `Date.now()`) so admission
 * replays deterministically under DST (MP-1). Decisions are Result-shaped
 * discriminated unions (MP-7), never exceptions.
 */

import { isTerminalHatBinding, type HatBinding } from "../../domain/src/hat-binding.ts";
import type { HatDefinition } from "../../domain/src/hat-definition.ts";
import type { HatPolicy } from "./hat-policy.ts";
import type { HatSwap } from "./hat-swap-event.ts";

/** Which admission gate is being requested. */
export type AdmissionOp =
  | "create-binding" // a wearer is binding a hat
  | "promote-active" // a binding is being promoted Warmup → Active
  | "create-hat"; // a new Hat is being added to the catalog

export interface AdmissionRequest {
  readonly operation: AdmissionOp;
  readonly hatId: string;
  readonly wearerId: string; // SPIFFE-ID analog (matches HatBinding.wearerAgentId)
  readonly nowIso: string; // deterministic clock (MP-1)
  readonly existingBindings: readonly HatBinding[];
  readonly existingHats: readonly HatDefinition[];
  readonly recentSwaps: readonly HatSwap[];
  /** quorum cosignatures collected for the binding (04-quorum). */
  readonly cosignerCount?: number;
  /** the hat being created/updated, for cycle + novelty checks (06/07). */
  readonly candidateHat?: HatDefinition;
  /** when the binding's warmup completes, for promotion gating (05-warmup). */
  readonly warmupEndsAt?: string;
  /** ISO timestamps of hats created recently, for the 24h novelty window (06). */
  readonly recentHatCreations?: readonly string[];
}

export type AdmissionDecision =
  | { readonly outcome: "allow" }
  | { readonly outcome: "deny"; readonly reason: string; readonly throttleName: string };

export interface AdmissionPolicy {
  readonly name: string;
  readonly evaluate: (request: AdmissionRequest, policy: HatPolicy) => AdmissionDecision;
}

const ALLOW: AdmissionDecision = { outcome: "allow" };

function elapsedSeconds(fromIso: string, nowIso: string): number {
  return (Date.parse(nowIso) - Date.parse(fromIso)) / 1000;
}

/** 01-cooldown: deny if wearer had a SwapOff for the same hat within cooldownSeconds. */
export const cooldownPolicy: AdmissionPolicy = {
  name: "cooldown",
  evaluate: (req, policy) => {
    if (req.operation !== "create-binding") return ALLOW;
    const cooldownSeconds = policy.throttles.cooldownSeconds;
    const recentSwapOff = req.recentSwaps.find(
      (s) => s.event === "SwapOff" && s.hat === req.hatId && s.previousWearer?.spiffeID === req.wearerId,
    );
    if (recentSwapOff) {
      const elapsed = elapsedSeconds(recentSwapOff.occurredAt, req.nowIso);
      if (elapsed < cooldownSeconds) {
        return { outcome: "deny", reason: `cooldown: ${elapsed}s < ${cooldownSeconds}s`, throttleName: "cooldown" };
      }
    }
    return ALLOW;
  },
};

/** 02-max-bindings: deny if wearer's non-terminal bindings reach maxBindingsPerWearer. */
export const maxBindingsPolicy: AdmissionPolicy = {
  name: "max-bindings",
  evaluate: (req, policy) => {
    if (req.operation !== "create-binding") return ALLOW;
    const active = req.existingBindings.filter(
      (b) => b.wearerAgentId === req.wearerId && !isTerminalHatBinding(b),
    );
    if (active.length >= policy.throttles.maxBindingsPerWearer) {
      return {
        outcome: "deny",
        reason: `max-bindings: ${active.length} >= ${policy.throttles.maxBindingsPerWearer}`,
        throttleName: "max-bindings",
      };
    }
    return ALLOW;
  },
};

/** 03-conflict-of-interest: deny if wearer holds a hat in the target hat's conflicts set. */
export const conflictOfInterestPolicy: AdmissionPolicy = {
  name: "conflict-of-interest",
  evaluate: (req) => {
    if (req.operation !== "create-binding") return ALLOW;
    const targetHat = req.candidateHat ?? req.existingHats.find((h) => h.id === req.hatId);
    if (!targetHat) return ALLOW;
    const conflicts = new Set(targetHat.conflictsWithHatIds);
    const held = req.existingBindings.find(
      (b) => b.wearerAgentId === req.wearerId && !isTerminalHatBinding(b) && conflicts.has(b.hatId),
    );
    if (held) {
      return {
        outcome: "deny",
        reason: `conflict-of-interest: wearer holds conflicting hat ${held.hatId}`,
        throttleName: "conflict-of-interest",
      };
    }
    return ALLOW;
  },
};

/** 04-quorum: deny if the target hat is quorum-gated and lacks enough cosignatures. */
export const quorumPolicy: AdmissionPolicy = {
  name: "quorum",
  evaluate: (req, policy) => {
    if (req.operation !== "create-binding") return ALLOW;
    const targetHat = req.candidateHat ?? req.existingHats.find((h) => h.id === req.hatId);
    if (!targetHat) return ALLOW;
    const quorumGated = targetHat.quorumSize != null && targetHat.quorumSize > 0;
    if (!quorumGated) return ALLOW;
    const required = targetHat.quorumSize ?? policy.throttles.quorumDefaultSize;
    const signed = req.cosignerCount ?? 0;
    if (signed < required) {
      return { outcome: "deny", reason: `quorum: ${signed} < ${required} cosignatures`, throttleName: "quorum" };
    }
    return ALLOW;
  },
};

/** 05-warmup: deny promoting a binding to Active before its warmup completes. */
export const warmupPolicy: AdmissionPolicy = {
  name: "warmup",
  evaluate: (req) => {
    if (req.operation !== "promote-active") return ALLOW;
    if (req.warmupEndsAt && Date.parse(req.nowIso) < Date.parse(req.warmupEndsAt)) {
      return {
        outcome: "deny",
        reason: `warmup: not complete (now ${req.nowIso} < ${req.warmupEndsAt})`,
        throttleName: "warmup",
      };
    }
    return ALLOW;
  },
};

/** 06-max-new-hats: deny creating a Hat when the 24h novelty budget is exhausted. */
export const maxNewHatsPolicy: AdmissionPolicy = {
  name: "max-new-hats",
  evaluate: (req, policy) => {
    if (req.operation !== "create-hat") return ALLOW;
    const windowSeconds = 24 * 60 * 60;
    const recent = (req.recentHatCreations ?? []).filter((iso) => elapsedSeconds(iso, req.nowIso) < windowSeconds);
    if (recent.length >= policy.throttles.maxNewHatsPerDay) {
      return {
        outcome: "deny",
        reason: `max-new-hats: ${recent.length} >= ${policy.throttles.maxNewHatsPerDay} in 24h`,
        throttleName: "max-new-hats",
      };
    }
    return ALLOW;
  },
};

/**
 * Detect whether the supervises-DAG (existing hats overlaid with the candidate)
 * contains any cycle. Returns the offending hat id, or undefined if acyclic.
 */
function findSupervisorCycle(hats: ReadonlyMap<string, ReadonlyArray<string>>): string | undefined {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of hats.keys()) color.set(id, WHITE);

  const visit = (id: string): string | undefined => {
    color.set(id, GRAY);
    for (const next of hats.get(id) ?? []) {
      if (!hats.has(next)) continue;
      const c = color.get(next);
      if (c === GRAY) return next; // back-edge → cycle
      if (c === WHITE) {
        const found = visit(next);
        if (found) return found;
      }
    }
    color.set(id, BLACK);
    return undefined;
  };

  for (const id of hats.keys()) {
    if (color.get(id) === WHITE) {
      const found = visit(id);
      if (found) return found;
    }
  }
  return undefined;
}

/** 07-no-supervisor-cycles: deny a Hat create/update that would cycle the supervises DAG. */
export const noSupervisorCyclesPolicy: AdmissionPolicy = {
  name: "no-supervisor-cycles",
  evaluate: (req) => {
    if (req.operation !== "create-hat") return ALLOW;
    const graph = new Map<string, ReadonlyArray<string>>();
    for (const h of req.existingHats) graph.set(h.id, h.supervisesHatIds);
    if (req.candidateHat) graph.set(req.candidateHat.id, req.candidateHat.supervisesHatIds);
    const cycleNode = findSupervisorCycle(graph);
    if (cycleNode) {
      return {
        outcome: "deny",
        reason: `no-supervisor-cycles: supervises DAG cycles at ${cycleNode}`,
        throttleName: "no-supervisor-cycles",
      };
    }
    return ALLOW;
  },
};

export const ADMISSION_POLICIES: readonly AdmissionPolicy[] = [
  cooldownPolicy,
  maxBindingsPolicy,
  conflictOfInterestPolicy,
  quorumPolicy,
  warmupPolicy,
  maxNewHatsPolicy,
  noSupervisorCyclesPolicy,
];

/** Evaluate all admission policies in order; deny if ANY policy denies. */
export function evaluateAdmission(request: AdmissionRequest, policy: HatPolicy): AdmissionDecision {
  for (const p of ADMISSION_POLICIES) {
    const result = p.evaluate(request, policy);
    if (result.outcome === "deny") return result;
  }
  return ALLOW;
}
