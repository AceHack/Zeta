/**
 * Mechanical authorization check — source-filter + recency resolver (B-0307).
 *
 * Pure function: given PaceInstruction[] from B-0306's extractor,
 * applies source-filter → recency-filter → returns the single
 * operative authorization. No file I/O.
 */

import type { PaceInstruction } from "./pace-extractor.ts";

export interface AuthorizationResult {
  operative: PaceInstruction | null;
  reason: string;
  allCandidates: PaceInstruction[];
  filteredOut: PaceInstruction[];
}

const AUTHORIZED_SOURCES: ReadonlySet<string> = new Set(["aaron"]);

const RESCIND_ONLY_PATTERNS: readonly RegExp[] = [
  /\brescind(?:ed|s)?\b/i,
  /\brevoke(?:d|s)?\b/i,
  /\bcancel(?:led|s)?\b/i,
  /\bforget\s+(?:what|the|about)\b/i,
  /\bnever\s+mind\b/i,
  /\bno\s+longer\s+in\s+effect\b/i,
  /\btake\s+(?:it|that)\s+back\b/i,
  /\bwithdraw(?:n|s)?\b/i,
];

const PACE_INDICATOR_PATTERNS: readonly RegExp[] = [
  /\bgo\s+hard\b/i,
  /\bkeep\s+(?:working|grinding)\b/i,
  /\bgrind(?:ing)?\s+(?:through|the|on)\b/i,
  /\brest\s+now\b/i,
  /\btake\s+it\s+easy\b/i,
  /\bhold\s+the\s+line\b/i,
  /\bstop\s+grinding\b/i,
  /\bcooling\s+period\b/i,
];

function isRescindOnly(inst: PaceInstruction): boolean {
  const hasRescind = RESCIND_ONLY_PATTERNS.some((p) => p.test(inst.raw));
  if (!hasRescind) return false;
  const hasPace = PACE_INDICATOR_PATTERNS.some((p) => p.test(inst.raw));
  return !hasPace;
}

function sortByTimestamp(a: PaceInstruction, b: PaceInstruction): number {
  if (a.timestamp === b.timestamp) return 0;
  if (a.timestamp === null) return -1;
  if (b.timestamp === null) return 1;
  return a.timestamp.localeCompare(b.timestamp);
}

export function resolveAuthorization(
  instructions: PaceInstruction[],
): AuthorizationResult {
  const allCandidates = [...instructions];

  const authorized: PaceInstruction[] = [];
  const filteredOut: PaceInstruction[] = [];

  for (const inst of instructions) {
    if (AUTHORIZED_SOURCES.has(inst.source)) {
      authorized.push(inst);
    } else {
      filteredOut.push(inst);
    }
  }

  if (authorized.length === 0) {
    return {
      operative: null,
      reason:
        "no operative pace authorization found; default to never-idle floor per CLAUDE.md",
      allCandidates,
      filteredOut,
    };
  }

  const sorted = [...authorized].sort(sortByTimestamp);

  for (let i = sorted.length - 1; i >= 0; i--) {
    const candidate = sorted[i]!;
    if (!isRescindOnly(candidate)) {
      return {
        operative: candidate,
        reason: `most recent authorized pace instruction from ${candidate.source} (${candidate.timestamp ?? "undated"})`,
        allCandidates,
        filteredOut,
      };
    }
    break;
  }

  return {
    operative: null,
    reason:
      "all authorized pace instructions were rescinded; default to never-idle floor per CLAUDE.md",
    allCandidates,
    filteredOut,
  };
}
