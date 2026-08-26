// github-pr-rest.ts — list / get / create pull requests over GitHub REST, no `gh`.
//
// 081M100RB9Z087G0R000GWY1MM. Porcelain `gh pr list|create|view` is the thing we are
// replacing. REST does not carry GraphQL-only fields (reviewDecision; mergeStateStatus
// on the list endpoint) — those stay unknown/null until getPrGateState is ported.

import type { CreatePrOpts, ForgeError, PullRequest, Result } from "../types";
import { err, forgeError, ok } from "../result";

export type GithubRest = {
  request(method: string, path: string, body?: unknown): Promise<Result<string, ForgeError>>;
};

export interface RestPull {
  readonly number: number;
  readonly title: string;
  readonly html_url: string;
  readonly updated_at: string;
  readonly draft: boolean;
  readonly state: string;
  readonly merged_at: string | null;
  readonly user: { readonly login: string } | null;
  readonly head: { readonly ref: string };
  readonly base: { readonly ref: string };
  readonly mergeable_state?: string;
}

export function restPullToPr(raw: RestPull): PullRequest {
  const merged = typeof raw.merged_at === "string" && raw.merged_at.length > 0;
  return {
    number: raw.number,
    title: raw.title,
    headRef: raw.head.ref,
    baseRef: raw.base.ref,
    state: merged ? "merged" : raw.state.toLowerCase() === "closed" ? "closed" : "open",
    isDraft: raw.draft,
    mergeStateStatus: mapMergeableState(raw.mergeable_state),
    reviewDecision: null,
    url: raw.html_url,
    updatedAt: raw.updated_at,
    author: raw.user?.login ?? "(unknown)",
  };
}

function mapMergeableState(status: string | undefined): PullRequest["mergeStateStatus"] {
  if (status === undefined) return "unknown";
  const lower = status.toLowerCase();
  if (lower === "clean") return "clean";
  if (lower === "blocked") return "blocked";
  if (lower === "dirty" || lower === "behind") return "dirty";
  if (lower === "unstable") return "unstable";
  return "unknown";
}

function parseJson(text: string): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function isRestPull(v: unknown): v is RestPull {
  if (typeof v !== "object" || v === null) return false;
  const p = v as RestPull;
  return typeof p.number === "number" && typeof p.title === "string" && typeof p.html_url === "string"
    && typeof p.updated_at === "string" && typeof p.draft === "boolean" && typeof p.state === "string"
    && typeof p.head === "object" && p.head !== null && typeof p.head.ref === "string"
    && typeof p.base === "object" && p.base !== null && typeof p.base.ref === "string";
}

export async function restListPulls(
  rest: GithubRest,
  nwo: string,
  opts: { readonly state: "open" | "closed"; readonly limit: number; readonly sort: "updated" | "created" },
): Promise<Result<readonly RestPull[], ForgeError>> {
  const perPage = Math.min(Math.max(opts.limit, 1), 100);
  const path = `repos/${nwo}/pulls?state=${opts.state}&per_page=${String(perPage)}&sort=${opts.sort}&direction=desc`;
  const result = await rest.request("GET", path);
  if (!result.ok) return result;
  const parsed = parseJson(result.value);
  if (!parsed.ok) return err(forgeError("parse-failure", `list pulls: ${parsed.error}`));
  if (!Array.isArray(parsed.value)) return err(forgeError("parse-failure", "list pulls: expected an array"));
  const pulls: RestPull[] = [];
  for (const item of parsed.value) {
    if (isRestPull(item)) pulls.push(item);
  }
  return ok(pulls);
}

export async function restGetPull(rest: GithubRest, nwo: string, number: number): Promise<Result<RestPull, ForgeError>> {
  const result = await rest.request("GET", `repos/${nwo}/pulls/${String(number)}`);
  if (!result.ok) return result;
  const parsed = parseJson(result.value);
  if (!parsed.ok) return err(forgeError("parse-failure", `get pull: ${parsed.error}`));
  if (!isRestPull(parsed.value)) return err(forgeError("parse-failure", "get pull: unexpected shape"));
  return ok(parsed.value);
}

export async function restCreatePull(rest: GithubRest, nwo: string, opts: CreatePrOpts): Promise<Result<RestPull, ForgeError>> {
  const result = await rest.request("POST", `repos/${nwo}/pulls`, {
    title: opts.title,
    body: opts.body,
    head: opts.head,
    base: opts.base,
    draft: opts.draft === true,
  });
  if (!result.ok) return result;
  const parsed = parseJson(result.value);
  if (!parsed.ok) return err(forgeError("parse-failure", `create pull: ${parsed.error}`));
  if (!isRestPull(parsed.value)) return err(forgeError("parse-failure", "create pull: unexpected shape"));
  return ok(parsed.value);
}
