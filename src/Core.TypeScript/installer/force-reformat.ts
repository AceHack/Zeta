#!/usr/bin/env bun
/**
 * force-reformat.ts — the decision behind zeta-install.sh's force-reformat
 * override, and the TypeScript oracle its shell twin is compared against.
 *
 * Aaron 2026-08-22: *"we could allow for an override to completely reformat and
 * ignore the installed version as an override."*
 *
 * The installer recognises an existing Zeta install and enters repair mode
 * (Step 2.7, R4). This is the escape from that: ignore what is there, wipe,
 * install clean, come back as a NEW node.
 *
 * ── IT ROUTES THROUGH THE BREAKER, IT DOES NOT ROUTE AROUND IT ──────────
 *
 * R9's circuit breaker exists so a failing install cannot eat disks in a
 * reboot loop. A reformat is the most destructive attempt the installer can
 * make, so it is bounded STRICTER than an ordinary one, not exempted:
 *
 *   ordinary attempt   decideBreaker(ledger, ZETA_MAX_DESTRUCTIVE_ATTEMPTS=3)
 *   force reformat     decideBreaker(ledger, ZETA_MAX_REFORMAT_ATTEMPTS=1)
 *
 * Same function, smaller bound. And where an ordinary attempt treats `blind`
 * (the ledger surface is unwritable, so attempts cannot be counted) as a reason
 * to widen the cancel window, a reformat treats it as a refusal: a destructive
 * attempt that cannot be COUNTED is precisely the unbounded loop R9 names.
 *
 * ── THREE INDEPENDENT FACTORS ───────────────────────────────────────────
 *
 * 1. `flag` — the exact literal `REFORMAT`. Not `1`, not `true`. A truthy
 *    value left in an environment does nothing.
 * 2. `declaredNodeId` — must NAME the node found on the disk this run (or the
 *    literal `unreadable`, and only when nothing was recovered). This is what a
 *    stale environment cannot satisfy: it names a different machine. It also
 *    makes the override SELF-DISARMING — after the reformat the node has a new
 *    identity, so the same environment on the next boot no longer matches.
 * 3. `typedConfirmation` — `REFORMAT`, typed. On the declared zero-typing path
 *    the sentinel `non-interactive` stands in, and factor 2 carries the
 *    per-machine attestation there.
 *
 * ── WHAT IT DOES NOT TOUCH ──────────────────────────────────────────────
 *
 * Consent. Identity recovery still happens read-only under `-o ro,noload`
 * BEFORE this is evaluated — the override cannot even arm without it, because
 * factor 2 needs the recovered id. This decides what happens AFTER consent
 * (mint a fresh identity rather than reuse the recovered one); it never
 * shortens the cancel window and never flips a `default=abort` to `proceed`.
 */

import type { BreakerState } from "./install-circuit-breaker.ts";

/** The exact literal both the flag and the typed confirmation must equal. */
export const FORCE_REFORMAT_TOKEN = "REFORMAT";

/** Stands in for factor 3 on the declared zero-typing path. */
export const NON_INTERACTIVE_SENTINEL = "non-interactive";

/** Declared when, and only when, nothing readable was recovered off the disk. */
export const UNREADABLE_NODE_SENTINEL = "unreadable";

/** Default bound on force-reformat attempts. ONE — deliberately tighter than
 *  the ordinary `ZETA_MAX_DESTRUCTIVE_ATTEMPTS` of 3. Overridable by
 *  `ZETA_MAX_REFORMAT_ATTEMPTS=<n>`, which is still a bound, not a bypass. */
export const DEFAULT_MAX_REFORMAT_ATTEMPTS = 1;

export type ForceReformatRefusal =
  | "flag-absent-or-not-exact"
  | "breaker-open"
  | "breaker-blind"
  | "breaker-state-unknown"
  | "node-id-not-declared"
  | "node-id-mismatch"
  | "node-id-declared-but-none-recovered"
  | "confirmation-not-typed";

export type ForceReformatVerdict =
  | { readonly armed: true }
  | { readonly armed: false; readonly reason: ForceReformatRefusal };

export interface ForceReformatInput {
  /** `$ZETA_FORCE_REFORMAT`, empty when unset. */
  readonly flag: string;
  /** `$ZETA_FORCE_REFORMAT_NODE_ID`, empty when unset. */
  readonly declaredNodeId: string;
  /** The hostname recovered read-only at Step 2.7; empty when nothing was read. */
  readonly recoveredNodeId: string;
  /** `zeta_pf_breaker(..., ZETA_MAX_REFORMAT_ATTEMPTS, ...)` — the STRICT bound. */
  readonly reformatBreakerState: BreakerState | string;
  /** What the operator typed, or `non-interactive`. */
  readonly typedConfirmation: string;
}

/**
 * The whole decision. Total: every input maps to `armed` or a NAMED refusal —
 * there is no silent-false path, because a refusal an operator cannot read is
 * a refusal they will work around.
 *
 * Order is chosen for the operator, not the compiler: the breaker is reported
 * before the identity factors, because when the breaker is the blocker no
 * amount of getting the node id right will help and saying so first saves a
 * cycle of guessing.
 */
export function decideForceReformat(input: ForceReformatInput): ForceReformatVerdict {
  if (input.flag !== FORCE_REFORMAT_TOKEN) {
    return { armed: false, reason: "flag-absent-or-not-exact" };
  }
  switch (input.reformatBreakerState) {
    case "open":
      return { armed: false, reason: "breaker-open" };
    case "blind":
      return { armed: false, reason: "breaker-blind" };
    case "closed":
      break;
    default:
      return { armed: false, reason: "breaker-state-unknown" };
  }
  if (input.declaredNodeId.length === 0) {
    return { armed: false, reason: "node-id-not-declared" };
  }
  if (input.recoveredNodeId.length > 0) {
    if (input.declaredNodeId !== input.recoveredNodeId) {
      return { armed: false, reason: "node-id-mismatch" };
    }
  } else if (input.declaredNodeId !== UNREADABLE_NODE_SENTINEL) {
    return { armed: false, reason: "node-id-declared-but-none-recovered" };
  }
  if (
    input.typedConfirmation !== NON_INTERACTIVE_SENTINEL &&
    input.typedConfirmation !== FORCE_REFORMAT_TOKEN
  ) {
    return { armed: false, reason: "confirmation-not-typed" };
  }
  return { armed: true };
}

/** The one-line form the shell prints, so parity is a string comparison. */
export function renderForceReformatVerdict(v: ForceReformatVerdict): string {
  return v.armed ? "armed" : `refused ${v.reason}`;
}
