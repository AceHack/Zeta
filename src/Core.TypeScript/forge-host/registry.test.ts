import { describe, expect, test, beforeEach } from "bun:test";
import { resolveHostFromRemote, registerAdapter, clearRegistrations } from "./registry";
import type { ForgeHost } from "./forge-host";
import { ok } from "./result";

function stubAdapter(name: string): ForgeHost {
  return {
    forgeName: name,
    sourceName: name,
    listCheckDefinitions: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    listLatestCheckObservations: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    listOpenPullRequests: async () => ok([]),
    getPullRequest: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    getPrGateState: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    listMergedPullRequests: async () => ok([]),
    resolveThread: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    resolveThreadsBatch: async () => ok({ resolved: 0, failed: [] }),
    createPullRequest: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    enableAutoMerge: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    addPrComment: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    listOpenIssues: async () => ok([]),
    createIssue: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    getCheckStatus: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    listPendingRuns: async () => ok([]),
    getRepoInfo: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    getBranchProtection: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    createBlob: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    createTree: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    createCommit: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    updateRef: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    getRef: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    getCommit: async () => ({ ok: false, error: { kind: "not-supported", message: "stub", retryable: false } }),
    searchPullRequests: async () => ok([]),
  } as ForgeHost;
}

describe("registry", () => {
  beforeEach(() => {
    clearRegistrations();
  });

  test("resolves GitHub adapter when registered", () => {
    registerAdapter(/github/, (owner, repo) => stubAdapter(`github:${owner}/${repo}`));
    const result = resolveHostFromRemote("git@github.com:org/repo.git");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.forgeName).toBe("github:org/repo");
    }
  });

  test("custom adapter registration takes precedence", () => {
    registerAdapter(/my-forge\.internal/, (owner, repo) => stubAdapter(`custom:${owner}/${repo}`));
    registerAdapter(/github/, (owner, repo) => stubAdapter(`github:${owner}/${repo}`));
    const result = resolveHostFromRemote("https://my-forge.internal/team/project.git");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.forgeName).toBe("custom:team/project");
    }
  });

  test("returns not-found error for unknown host with no adapter", () => {
    const result = resolveHostFromRemote("git@unknown-host.example:org/repo.git");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("not-found");
    }
  });

  test("returns parse-failure for unparseable URL", () => {
    const result = resolveHostFromRemote("not-a-valid-url");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("parse-failure");
    }
  });

  test("pattern matches against host string", () => {
    registerAdapter(/gitlab\.corp/, (owner, repo) => stubAdapter(`corp-gitlab:${owner}/${repo}`));
    const result = resolveHostFromRemote("git@gitlab.corp.io:infra/platform.git");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.forgeName).toBe("corp-gitlab:infra/platform");
    }
  });
});
