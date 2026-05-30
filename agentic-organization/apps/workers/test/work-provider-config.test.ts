import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { resolveChangeControlExternalPort, resolveWorkProviderFromEnv, WorkProviderConfigError } from "../src/work-provider-config.ts";

const NOW = () => 0;
const noFetch = (async () => new Response("", { status: 200 })) as typeof fetch;

test("GEN3: no provider env → null port, internal-only (the safe default)", () => {
  const r = resolveChangeControlExternalPort({}, { nowMs: NOW });
  equal(r.port, null);
  equal(r.mode, "internal-only");
});

test("GEN3: WORK_PROVIDER=github → live ChangeControlPort, mode external:github", () => {
  const r = resolveChangeControlExternalPort({ WORK_PROVIDER: "github", GITHUB_TOKEN: "t", GITHUB_OWNER: "o", GITHUB_REPO: "r" }, { nowMs: NOW, fetchImpl: noFetch });
  ok(r.port !== null);
  equal(r.port?.system, "github");
  equal(r.mode, "external:github");
});

test("GEN3: WORK_PROVIDER=gitlab → live ChangeControlPort, mode external:gitlab", () => {
  const r = resolveChangeControlExternalPort({ WORK_PROVIDER: "gitlab", GITLAB_TOKEN: "t", GITLAB_PROJECT_ID: "g/p" }, { nowMs: NOW, fetchImpl: noFetch });
  ok(r.port !== null);
  equal(r.port?.system, "gitlab");
  equal(r.mode, "external:gitlab");
});

test("GEN3: WORK_PROVIDER=jira → a work-item provider leaves change-control internal-only", () => {
  const r = resolveChangeControlExternalPort({ WORK_PROVIDER: "jira", JIRA_TOKEN: "t", JIRA_BASE_URL: "https://x/rest/api/3", JIRA_PROJECT_KEY: "ENG" }, { nowMs: NOW, fetchImpl: noFetch });
  equal(r.port, null, "a card provider is not a PR port");
  ok(r.mode.startsWith("work-item:jira"));
});

test("GEN3: WORK_PROVIDER=linear resolves a work-item provider", () => {
  const provider = resolveWorkProviderFromEnv({ WORK_PROVIDER: "linear", LINEAR_TOKEN: "t", LINEAR_TEAM_ID: "team" }, { nowMs: NOW, fetchImpl: noFetch });
  ok(provider !== null);
  equal(provider?.kind, "linear");
});

test("GEN3: a SELECTED provider missing a required field throws (fail fast, never silent)", () => {
  let threw = false;
  try { resolveChangeControlExternalPort({ WORK_PROVIDER: "github", GITHUB_TOKEN: "t" }, { nowMs: NOW, fetchImpl: noFetch }); } catch (e) { threw = true; ok(e instanceof WorkProviderConfigError); ok(String((e as Error).message).includes("GITHUB_OWNER")); }
  ok(threw);
});

test("GEN3: an unknown WORK_PROVIDER value throws", () => {
  let threw = false;
  try { resolveWorkProviderFromEnv({ WORK_PROVIDER: "bitbucket" }, { nowMs: NOW }); } catch (e) { threw = true; ok(String((e as Error).message).includes("unknown WORK_PROVIDER")); }
  ok(threw);
});

test("GEN3: back-compat — legacy GITHUB_* with no WORK_PROVIDER resolves github (the L0 path)", () => {
  const r = resolveChangeControlExternalPort({ GITHUB_TOKEN: "t", GITHUB_OWNER: "o", GITHUB_REPO: "r" }, { nowMs: NOW, fetchImpl: noFetch });
  ok(r.port !== null);
  equal(r.mode, "external:github");
});
