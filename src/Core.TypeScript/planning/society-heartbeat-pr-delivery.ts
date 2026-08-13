/**
 * Protected-main delivery plan for one durable society evolution event.
 *
 * The heartbeat never pushes directly to main. It writes its event/index pair
 * to a unique branch, opens a PR with a separate Pull-requests-only token,
 * then lets the repository's independent required gate decide whether main
 * may receive the evidence.
 */

import { appendFileSync } from "node:fs";

export const SOCIETY_PR_TOKEN_ENV = "ZETA_PR_ARCHIVE_TOKEN" as const;
export const SOCIETY_BASE_BRANCH = "main" as const;

export interface SocietyPrDeliveryPlan {
  readonly branch: string;
  readonly base: typeof SOCIETY_BASE_BRANCH;
  readonly title: string;
  readonly body: string;
}

function positiveIdentifier(value: string, label: string): string {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`teaching error: ${label} must be a positive decimal identifier; received ${JSON.stringify(value)}`);
  }
  return value;
}

/** Build deterministic branch and PR metadata from trusted GitHub run identifiers. */
export function planSocietyPrDelivery(runId: string, attempt: string): SocietyPrDeliveryPlan {
  const checkedRunId = positiveIdentifier(runId, "runId");
  const checkedAttempt = positiveIdentifier(attempt, "attempt");
  const branch = `society/evolution-run-${checkedRunId}-attempt-${checkedAttempt}`;
  return {
    branch,
    base: SOCIETY_BASE_BRANCH,
    title: `society: evolution evidence from run ${checkedRunId}`,
    body: [
      "## Society evolution evidence",
      "",
      `- Source workflow run: ${checkedRunId}, attempt ${checkedAttempt}`,
      "- Contains one append-only society event and the regenerated hash-chain index.",
      "- Direct pushes to protected `main` are intentionally forbidden.",
      "- Merge is permitted only after the repository's independent `gate (required)` status passes.",
    ].join("\n"),
  };
}

/** Keep the PR credential boundary explicit and teachable. */
export function requireSocietyPrToken(token: string | undefined): string {
  if (!token?.trim()) {
    throw new Error(
      `teaching error: ${SOCIETY_PR_TOKEN_ENV} is required only to create the society evidence PR; ` +
      "set a Zeta-only fine-grained token with Pull requests: write in GitHub Actions secrets",
    );
  }
  return token;
}

function main(): void {
  const plan = planSocietyPrDelivery(process.env.GITHUB_RUN_ID ?? "", process.env.GITHUB_RUN_ATTEMPT ?? "");
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    appendFileSync(outputPath, `branch=${plan.branch}\n`);
    appendFileSync(outputPath, `title=${plan.title}\n`);
    return;
  }
  console.log(JSON.stringify(plan));
}

if (import.meta.main) main();
