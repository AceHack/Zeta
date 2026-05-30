import { equal, ok, throws } from "node:assert/strict";
import { test } from "node:test";

import { ExternalSystem, ReviewGateKind, type ChangeSet, type ReviewStage } from "../../../packages/domain/src/index.ts";
import { resolveGitHubExternalPort, GitHubPortEnvName } from "../src/github-port-config.ts";

const STAGE: ReviewStage = {
  id: "external-code-review", ownerLabel: "code_reviewer",
  authority: { kind: "external", system: ExternalSystem.GitHub }, gate: ReviewGateKind.ExternalApproved,
  blocking: true, projectTo: ExternalSystem.GitHub,
};

function changeSet(): ChangeSet {
  return {
    changeSetId: "cs-1", organizationId: "org-lfg", workItemId: "w-1", proposerHatId: "code_author",
    title: "t", targetRef: "feat/x", phase: "in_review", pipelineId: "github-gated", currentStageIndex: 0,
    artifacts: [{ kind: "code_diff", path: "a.ts", diff: "+x", language: "ts" }], projections: [], revision: 2,
    openedAt: "2026-05-30T00:00:00Z", updatedAt: "2026-05-30T00:00:00Z",
  };
}

test("L0: no GitHub env → null (the org runs internal-only by default)", () => {
  const port = resolveGitHubExternalPort({}, { nowMs: () => 0 });
  equal(port, null);
});

test("L0: a partial GitHub config fails fast (does not silently degrade)", () => {
  throws(
    () => resolveGitHubExternalPort({ [GitHubPortEnvName.Token]: "ghp_x" }, { nowMs: () => 0 }),
    /partial GitHub config/,
  );
});

test("L0: full GitHub env → a real port that instantiates a working client", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(`${(init?.method ?? "GET").toUpperCase()} ${url}`);
    if (url.endsWith("/git/ref/heads/main")) return new Response(JSON.stringify({ object: { sha: "s" } }), { status: 200 });
    if (url.endsWith("/pulls")) return new Response(JSON.stringify({ number: 7, html_url: "https://github.com/o/r/pull/7" }), { status: 201 });
    return new Response("{}", { status: 201 });
  }) as typeof fetch;

  const port = resolveGitHubExternalPort(
    { [GitHubPortEnvName.Token]: "ghp_x", [GitHubPortEnvName.Owner]: "o", [GitHubPortEnvName.Repo]: "r" },
    { nowMs: () => Date.parse("2026-05-30T00:00:00Z"), fetchImpl },
  );
  ok(port !== null);
  equal(port!.system, ExternalSystem.GitHub);

  // the resolved port drives the real client against the injected transport
  const ref = await port!.project(changeSet(), STAGE);
  equal(ref.externalId, "7");
  ok(calls.some((c) => c.includes("/repos/o/r/pulls")), "the live client hit the real owner/repo path");
});
