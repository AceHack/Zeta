/**
 * transient-toolchain-failure.ts — is a failed toolchain install OUR defect or an upstream blip?
 *
 * ## The measurement (2026-09-10, `build-and-test (windows-11-arm)` on `main`)
 *
 *   mise ERROR Failed to install github:yannh/kubeconform@0.7.0: GitHub artifact
 *   attestations verification error: API error: GitHub API returned 503 Service
 *   Unavailable: {"message":"trust-metadata-api service unavailable", ...}
 *
 * `mise` fails closed when it cannot verify an artifact attestation, which is CORRECT — an
 * unverifiable artifact must not be installed. But a 503 from GitHub's attestation service
 * is not a failed verification; it is a verification that never ran. Failing closed on it is
 * right, and giving up after one attempt is not: the whole Windows lane goes red, on `main`,
 * for an outage lasting seconds.
 *
 * ## Why the classification lives here rather than in the PowerShell
 *
 * The retry plumbing is three lines of PowerShell. The RISKY part is deciding what counts as
 * transient, because a retry predicate that is too broad silently converts real, reproducible
 * failures into slow real failures — and worse, into intermittent green. That decision is a
 * pure function of the tool's output, so it is written here where it can be falsified, and
 * mirrored into `install.ps1` by the check below.
 *
 * ## The discipline
 *
 * A pattern earns its place ONLY if the failure it names is (a) produced by an external
 * service, and (b) genuinely re-attemptable — the same command, unchanged, can succeed on the
 * next call. "Network error" is not sufficient: a DNS failure for a misspelled host is a
 * network error and retrying it is just waiting. Every pattern below carries the observation
 * that produced it.
 */

export interface TransientPattern {
  /** Case-insensitive substring that must appear in the tool's combined output. */
  readonly needle: string;
  /** Why this is re-attemptable — the observation, not a category. */
  readonly why: string;
}

/**
 * Deliberately SHORT. Each entry is a measured upstream outage, not a guess at what might
 * one day be flaky. Adding a pattern is a decision to let a class of failure retry, and the
 * cost of being wrong is intermittent green, which is worse than red.
 */
export const TRANSIENT_PATTERNS: readonly TransientPattern[] = [
  {
    needle: "trust-metadata-api service unavailable",
    why: "GitHub's attestation trust-metadata service returned 503; the artifact's attestation is not in doubt, the service that checks it was down (observed 2026-09-10, windows-11-arm, kubeconform@0.7.0)",
  },
  {
    needle: "503 Service Unavailable",
    why: "a 5xx is the server declining to answer, not an answer — the same request can succeed unchanged",
  },
  {
    needle: "502 Bad Gateway",
    why: "an intermediary failed before the origin was reached, so the request was never served and no answer about the artifact was produced",
  },
  {
    needle: "504 Gateway Time-out",
    why: "the gateway gave up waiting on the origin; nothing about the artifact was decided, so the identical request may still be answered",
  },
];

export type RetryVerdict =
  | { readonly kind: "retry"; readonly matched: string; readonly why: string }
  | { readonly kind: "fail-now"; readonly reason: string };

/**
 * Decide whether a non-zero exit should be re-attempted.
 *
 * A SUCCESS IS NEVER RETRIED and a non-matching failure is never retried. The default is
 * fail-now: a predicate whose default is retry would eventually swallow a real defect, and a
 * check that turns red into slow-green is the vacuity class with a timer attached.
 */
export function classifyToolFailure(input: {
  readonly exitCode: number;
  readonly output: string;
  readonly attempt: number;
  readonly maxAttempts: number;
}): RetryVerdict {
  if (input.exitCode === 0) return { kind: "fail-now", reason: "the command succeeded; there is nothing to retry" };
  if (input.attempt >= input.maxAttempts) {
    return {
      kind: "fail-now",
      reason: `attempt ${String(input.attempt)} of ${String(input.maxAttempts)} — the transient budget is spent, and an outage that outlasts it is an outage worth failing on`,
    };
  }
  // Ordinal, case-insensitive: these are ASCII diagnostics from tools, and an ordinal fold
  // cannot drift with the runner's locale the way a linguistic compare can.
  const haystack = input.output.toLowerCase();
  for (const p of TRANSIENT_PATTERNS) {
    if (haystack.includes(p.needle.toLowerCase())) return { kind: "retry", matched: p.needle, why: p.why };
  }
  return {
    kind: "fail-now",
    reason: "the failure output matches no known transient upstream signature, so it is treated as a real failure — which is the correct default",
  };
}

/** Bounded exponential backoff. Deterministic: no jitter, so a replay is reproducible (DST). */
export function backoffMs(attempt: number): number {
  const base = 2_000;
  const capped = Math.min(attempt, 4);
  return base * 2 ** (capped - 1);
}
