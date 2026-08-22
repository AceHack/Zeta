/**
 * drift-dashboard/roster.ts — the remembered set of checks that are supposed to exist.
 *
 * WHY A PERSISTED ROSTER AT ALL.
 *
 * To say "this check was not observed" you must already know the check exists. A pass
 * that only knows what it just saw cannot distinguish a check that vanished from a
 * check that never was — so it silently shrinks its own denominator and reports a
 * cleaner number than it earned. The roster is the memory that makes absence
 * *nameable*.
 *
 * Aaron 2026-08-22, on the unknown verdict: *"this is what most humans and AI are not
 * good at keeping in their head the unknowns they forgot about lol, so the more
 * mechanical the better."* The roster is the mechanical half: a check that stops
 * reporting keeps occupying its slot and keeps being counted, whether or not anyone
 * remembers it.
 *
 * TEXT, AND DIFFABLE ON PURPOSE. `.claude/rules/no-binary-in-proof-lineage.md` — a new
 * check appearing and a known check vanishing are both events worth seeing in a
 * `git diff`, and this file is the record of both. Keys sorted ordinally
 * (`.claude/rules/culture-invariant-by-default.md`) so the diff is the change and
 * never the platform's collation.
 *
 * RETIREMENT IS A DECISION, NEVER A SIDE EFFECT. Nothing in this module ever sets
 * `retired`. A check that disappears from every source is marked `declaredNow: false`
 * and stays in the denominator; removing it from the denominator is a human/agent call
 * recorded in the file, which is the only form of that decision that leaves a trace.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { CheckDefinition, CheckExpectation, CheckId, VerdictKind } from "../forge-host/types.ts";

/** Schema version. Bump only on a breaking shape change. */
export const ROSTER_VERSION = 1 as const;

export interface RosterEntry {
  readonly checkId: CheckId;
  readonly displayName: string;
  /** Producer that most recently declared this check. Provenance, never authority. */
  readonly source: string;
  readonly expectation: CheckExpectation;
  /**
   * ISO-8601 of when the check's DEFINITION first existed, as the producer establishes
   * it — NOT `firstSeenAt`, which is only when this dashboard first looked. The
   * distinction is the whole of the `not-yet-due` verdict: a scheduled check added
   * yesterday owes nothing today, and confusing "new to us" with "new" is how a
   * detector cries wolf on every workflow anyone adds.
   */
  readonly definitionSince?: string;
  /** ISO-8601. First pass in which any source declared this check. */
  readonly firstSeenAt: string;
  /** ISO-8601. Most recent pass in which any source declared this check. */
  readonly lastDeclaredAt: string;
  /** Did a source declare this check in the pass that wrote this file? */
  readonly declaredNow: boolean;
  /** ISO-8601 of the newest verdict ever established for this check, across all passes. */
  readonly lastObservedAt: string | null;
  /** Kind of that newest verdict. `null` ⇒ nothing has ever been observed. */
  readonly lastVerdictKind: VerdictKind | null;
  /**
   * ISO-8601 of the newest verdict that arrived via the check's own DECLARED trigger,
   * ever. `null` ⇒ the declared trigger has never once produced a verdict — which is a
   * different and worse fact than "no verdict recently", and is exactly what a
   * last-run-only model cannot see.
   */
  readonly lastDeclaredTriggerAt: string | null;
  /**
   * Excluded from the denominator. **Only ever set by hand**, and the hand-written
   * `retiredReason` is the audit trail. Nothing in this codebase sets it.
   */
  readonly retired?: boolean;
  readonly retiredReason?: string;
}

export interface Roster {
  readonly version: typeof ROSTER_VERSION;
  /** Ref the roster is scoped to (a check's expectation is ref-relative). */
  readonly ref: string;
  /** ISO-8601 of the pass that wrote this file. Metadata only — never enters the fold. */
  readonly updatedAt: string;
  readonly checks: readonly RosterEntry[];
}

/** An empty roster for `ref`. A first pass legitimately starts from nothing. */
export function emptyRoster(ref: string, at: string): Roster {
  return { version: ROSTER_VERSION, ref, updatedAt: at, checks: [] };
}

/** Ordinal string compare — culture-invariant by default. */
export function ordinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Fold this pass's definitions into the prior roster.
 *
 * Pure: `(prior, definitions, now) -> next`. No I/O, no ambient clock — `now` is
 * injected, which is what makes a pass replayable (DST) and keeps local time out of
 * the result (`.claude/rules/local-time-never-enters-the-shared-fold.md`).
 *
 * The one property that matters: **an entry present in `prior` and absent from
 * `definitions` survives**, with `declaredNow: false`. That is what stops a vanished
 * check from quietly improving the coverage number.
 */
export function mergeDefinitions(
  prior: Roster,
  definitions: readonly CheckDefinition[],
  now: string,
): Roster {
  const byId = new Map<CheckId, RosterEntry>();
  for (const entry of prior.checks) byId.set(entry.checkId, { ...entry, declaredNow: false });

  for (const def of definitions) {
    const existing = byId.get(def.checkId);
    byId.set(def.checkId, {
      checkId: def.checkId,
      displayName: def.displayName,
      source: def.source,
      expectation: def.expectation,
      firstSeenAt: existing?.firstSeenAt ?? now,
      lastDeclaredAt: now,
      declaredNow: true,
      ...(def.definitionSince === undefined
        ? existing?.definitionSince === undefined
          ? {}
          : { definitionSince: existing.definitionSince }
        : { definitionSince: def.definitionSince }),
      lastObservedAt: existing?.lastObservedAt ?? null,
      lastVerdictKind: existing?.lastVerdictKind ?? null,
      lastDeclaredTriggerAt: existing?.lastDeclaredTriggerAt ?? null,
      ...(existing?.retired === undefined ? {} : { retired: existing.retired }),
      ...(existing?.retiredReason === undefined ? {} : { retiredReason: existing.retiredReason }),
    });
  }

  return {
    version: ROSTER_VERSION,
    ref: prior.ref,
    updatedAt: now,
    checks: [...byId.values()].sort((a, b) => ordinal(a.checkId, b.checkId)),
  };
}

/**
 * Record the verdicts this pass established, so the NEXT pass can tell
 * "never observed" from "not observed this time" — the distinction today's bug
 * destroys by collapsing.
 *
 * Monotone in `observedAt`: an older observation never overwrites a newer one, so a
 * replayed or out-of-order pass cannot walk the roster's memory backwards.
 */
export function recordObservations(
  roster: Roster,
  observed: ReadonlyMap<
    CheckId,
    { readonly observedAt: string; readonly kind: VerdictKind; readonly viaDeclaredTrigger?: boolean }
  >,
): Roster {
  return {
    ...roster,
    checks: roster.checks.map((entry) => {
      const seen = observed.get(entry.checkId);
      if (seen === undefined) return entry;
      const declaredAt =
        seen.viaDeclaredTrigger === true &&
        (entry.lastDeclaredTriggerAt === null || ordinal(seen.observedAt, entry.lastDeclaredTriggerAt) > 0)
          ? seen.observedAt
          : entry.lastDeclaredTriggerAt;
      if (entry.lastObservedAt !== null && ordinal(seen.observedAt, entry.lastObservedAt) <= 0) {
        return { ...entry, lastDeclaredTriggerAt: declaredAt };
      }
      return { ...entry, lastObservedAt: seen.observedAt, lastVerdictKind: seen.kind, lastDeclaredTriggerAt: declaredAt };
    }),
  };
}

// ─── Edge: I/O only, no decisions ───────────────────────────────────────────

export function loadRoster(path: string, ref: string, at: string): Roster {
  // Read and interpret the failure, rather than asking `existsSync` a question whose
  // answer is stale before the read runs (CWE-367). One syscall, one answer, no window
  // — and "first pass, no roster yet" is a legitimate state, not an error.
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyRoster(ref, at);
    throw e;
  }
  const parsed = JSON.parse(text) as Roster;
  if (parsed.version !== ROSTER_VERSION) {
    throw new Error(`roster ${path}: unsupported version ${String(parsed.version)} (expected ${ROSTER_VERSION})`);
  }
  return parsed;
}

export function saveRoster(path: string, roster: Roster): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(roster, null, 2)}\n`, "utf8");
}
