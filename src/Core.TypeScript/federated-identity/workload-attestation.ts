/**
 * workload-attestation.ts — SPIFFE's core move, node-local.
 *
 * The workload presents NO secret. The node looks at properties it can observe
 * about the calling process (uid, binary hash, container id, argv) and decides
 * which SPIFFE path that process is entitled to. This is exactly the SPIRE unix
 * / docker workload attestor model, reduced to a pure function over observations.
 *
 * ── THE LIMIT, STATED IN THE FILE THAT EARNS IT ──────────────────────────────
 * Software workload attestation on a shared kernel is **operational identity,
 * not cryptographic isolation**. Everything in `ObservedProcess` is under host
 * root's control: root can run as any uid, can place a binary with any hash, can
 * relabel a container. So an SVID issued from these selectors says
 * *"the node's own bookkeeping believes this process is X"* — not
 * *"this process cryptographically proved it is X"*. Aaron has accepted this
 * limit explicitly; it is written here so nobody downstream has to rediscover it.
 * The thing that would change the class is a hardware root of trust measuring
 * the boot chain, and none of that is implemented.
 *
 * REGISTER: `unmetered`.
 */

import { createHash } from "node:crypto";

import {
  canonicalJson,
  type AttestationRefusal,
  type AttestedWorkload,
  type ObservedProcess,
  type Phase,
  type Result,
  type WorkloadAttestor,
  err,
  ok,
} from "./ports.ts";

/**
 * One selector rule. Every constraint present must match; a rule with NO
 * constraints is rejected at construction rather than silently matching every
 * process on the box — a rule that cannot fail is not a rule.
 */
export interface WorkloadSelectorRule {
  /** Path within the local trust domain, e.g. `/agent/otto`. */
  readonly spiffePath: string;
  readonly requireUid?: number;
  readonly requireBinarySha256?: string;
  readonly requireContainerId?: string;
  readonly requireArgvSha256?: string;
}

export type SelectorRuleError =
  | { readonly kind: "rule-has-no-constraints"; readonly spiffePath: string }
  | { readonly kind: "path-not-absolute"; readonly spiffePath: string }
  | { readonly kind: "duplicate-path"; readonly spiffePath: string };

/** Validate a rule set. Refuses the shapes that would make attestation vacuous. */
export function validateSelectorRules(
  rules: readonly WorkloadSelectorRule[],
): Result<readonly WorkloadSelectorRule[], SelectorRuleError> {
  const seen = new Set<string>();
  for (const rule of rules) {
    if (!rule.spiffePath.startsWith("/")) {
      return err({ kind: "path-not-absolute", spiffePath: rule.spiffePath });
    }
    if (seen.has(rule.spiffePath)) {
      return err({ kind: "duplicate-path", spiffePath: rule.spiffePath });
    }
    seen.add(rule.spiffePath);
    const constraints =
      (rule.requireUid === undefined ? 0 : 1) +
      (rule.requireBinarySha256 === undefined ? 0 : 1) +
      (rule.requireContainerId === undefined ? 0 : 1) +
      (rule.requireArgvSha256 === undefined ? 0 : 1);
    if (constraints === 0) {
      return err({ kind: "rule-has-no-constraints", spiffePath: rule.spiffePath });
    }
  }
  return ok(rules);
}

/** The selectors a rule actually matched, so the SVID can be bound to evidence. */
function matchedSelectors(rule: WorkloadSelectorRule, observed: ObservedProcess): Record<string, unknown> | null {
  const matched: Record<string, unknown> = {};
  if (rule.requireUid !== undefined) {
    if (observed.uid !== rule.requireUid) return null;
    matched.uid = rule.requireUid;
  }
  if (rule.requireBinarySha256 !== undefined) {
    if (observed.binarySha256 !== rule.requireBinarySha256) return null;
    matched.binarySha256 = rule.requireBinarySha256;
  }
  if (rule.requireContainerId !== undefined) {
    if (observed.containerId !== rule.requireContainerId) return null;
    matched.containerId = rule.requireContainerId;
  }
  if (rule.requireArgvSha256 !== undefined) {
    if (observed.argvSha256 !== rule.requireArgvSha256) return null;
    matched.argvSha256 = rule.requireArgvSha256;
  }
  return matched;
}

/**
 * Build an attestor over a validated rule set.
 *
 * AMBIGUITY IS A REFUSAL, not a first-match-wins. If two rules match the same
 * process, the node genuinely does not know which identity the process holds,
 * and picking the first one in array order would make identity depend on config
 * file ordering. That is the class of bug that only shows up after someone
 * reorders a list.
 */
export function createSoftwareWorkloadAttestor(rules: readonly WorkloadSelectorRule[]): WorkloadAttestor {
  return {
    attest(observed: ObservedProcess, currentPhase: Phase): Result<AttestedWorkload, AttestationRefusal> {
      if (!Number.isSafeInteger(observed.pid) || observed.pid <= 0) {
        return err({ kind: "malformed-observation", field: "pid" });
      }
      if (!Number.isSafeInteger(observed.uid) || observed.uid < 0) {
        return err({ kind: "malformed-observation", field: "uid" });
      }
      if (!/^[0-9a-f]{64}$/.test(observed.binarySha256)) {
        return err({ kind: "malformed-observation", field: "binarySha256" });
      }

      const hits: { rule: WorkloadSelectorRule; matched: Record<string, unknown> }[] = [];
      for (const rule of rules) {
        const matched = matchedSelectors(rule, observed);
        if (matched !== null) hits.push({ rule, matched });
      }
      if (hits.length === 0) {
        return err({ kind: "no-matching-selector", pid: observed.pid });
      }
      if (hits.length > 1) {
        return err({ kind: "ambiguous-selectors", pid: observed.pid, matched: hits.map((h) => h.rule.spiffePath) });
      }
      const hit = hits[0];
      if (hit === undefined) return err({ kind: "no-matching-selector", pid: observed.pid });
      return ok({
        spiffePath: hit.rule.spiffePath,
        attestationDigest: attestationDigestOf(hit.rule.spiffePath, hit.matched),
        attestedAtPhase: currentPhase,
      });
    },
  };
}

/**
 * Digest over (path, matched selectors). Deliberately EXCLUDES pid: a pid is
 * recycled by the OS, so binding a credential to one would make the credential's
 * meaning change under it.
 */
export function attestationDigestOf(spiffePath: string, matched: Record<string, unknown>): string {
  return createHash("sha256").update(canonicalJson({ spiffePath, matched }), "utf8").digest("hex");
}
