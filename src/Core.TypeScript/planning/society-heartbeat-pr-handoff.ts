/**
 * Handoff one society evidence branch to an independently gated PR.
 *
 * This module deliberately requires ZETA_PR_ARCHIVE_TOKEN only at the PR
 * boundary. The schedule dispatcher never receives that authority.
 */

import { spawnSync } from "node:child_process";
import { planSocietyPrDelivery, requireSocietyPrToken, type SocietyPrDeliveryPlan } from "./society-heartbeat-pr-delivery";

export interface SocietyPrReference {
  readonly number: number;
  readonly url: string;
  readonly reused: boolean;
}

export interface SocietyPrGateway {
  findOpen(repo: string, branch: string, base: string): SocietyPrReference | null;
  create(repo: string, plan: SocietyPrDeliveryPlan): SocietyPrReference;
}

/** Idempotently create or reuse the one PR carrying a heartbeat event/index pair. */
export function handoffSocietyEvidence(
  gateway: SocietyPrGateway,
  repo: string,
  runId: string,
  attempt: string,
): SocietyPrReference {
  const plan = planSocietyPrDelivery(runId, attempt);
  const existing = gateway.findOpen(repo, plan.branch, plan.base);
  if (existing) return { ...existing, reused: true };
  return gateway.create(repo, plan);
}

function gh(args: readonly string[], input: string | undefined, token: string): { readonly status: number; readonly stdout: string; readonly stderr: string } {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    input,
    env: { ...process.env, GH_TOKEN: token },
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`teaching error: gh launch failed; install GitHub CLI in the runner: ${result.error.message}`);
  }
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

function parseReference(raw: string, reused: boolean): SocietyPrReference {
  try {
    const value = JSON.parse(raw) as { readonly number?: unknown; readonly html_url?: unknown };
    if (typeof value.number !== "number" || !Number.isInteger(value.number) || typeof value.html_url !== "string") {
      throw new Error("response lacks numeric number or html_url");
    }
    return { number: value.number, url: value.html_url, reused };
  } catch (error) {
    throw new Error(`teaching error: GitHub PR response was not parseable; inspect runner output and repair the PR handoff: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Production gateway: only this CLI boundary consumes ZETA_PR_ARCHIVE_TOKEN. */
export function githubSocietyPrGateway(token: string): SocietyPrGateway {
  return {
    findOpen(repo, branch, base) {
      const owner = repo.split("/")[0];
      if (!owner) throw new Error("teaching error: repo must be owner/name");
      const response = gh(["api", `repos/${repo}/pulls?state=open&head=${owner}:${branch}&base=${base}`], undefined, token);
      if (response.status !== 0) {
        throw new Error(`teaching error: could not list existing society evidence PRs; ${response.stderr || response.stdout}`);
      }
      try {
        const items = JSON.parse(response.stdout) as readonly { readonly number?: unknown; readonly html_url?: unknown }[];
        const first = items[0];
        return first ? parseReference(JSON.stringify(first), true) : null;
      } catch (error) {
        throw new Error(`teaching error: existing PR query was not parseable; ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    create(repo, plan) {
      const response = gh(
        ["api", "-X", "POST", `repos/${repo}/pulls`, "--input", "-"],
        JSON.stringify({ title: plan.title, body: plan.body, head: plan.branch, base: plan.base }),
        token,
      );
      if (response.status !== 0) {
        throw new Error(`teaching error: could not create society evidence PR; ${response.stderr || response.stdout}`);
      }
      return parseReference(response.stdout, false);
    },
  };
}

function main(): void {
  const token = requireSocietyPrToken(process.env.ZETA_PR_ARCHIVE_TOKEN);
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error("teaching error: GITHUB_REPOSITORY is required for society PR delivery");
  const result = handoffSocietyEvidence(
    githubSocietyPrGateway(token),
    repo,
    process.env.GITHUB_RUN_ID ?? "",
    process.env.GITHUB_RUN_ATTEMPT ?? "",
  );
  console.log(JSON.stringify(result));
}

if (import.meta.main) main();
