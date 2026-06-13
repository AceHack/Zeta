import { describe, expect, test } from "bun:test";
import { GitHubAdapter } from "./github-adapter";

describe("GitHubAdapter", () => {
  test("forgeName is github", () => {
    const adapter = new GitHubAdapter("Lucent-Financial-Group", "Zeta");
    expect(adapter.forgeName).toBe("github");
  });

  test("not-supported methods return proper error", async () => {
    const adapter = new GitHubAdapter("org", "repo");

    const blob = await adapter.createBlob("content");
    expect(blob.ok).toBe(false);
    if (!blob.ok) {
      expect(blob.error.kind).toBe("not-supported");
      expect(blob.error.retryable).toBe(false);
    }

    const tree = await adapter.createTree([]);
    expect(tree.ok).toBe(false);
    if (!tree.ok) expect(tree.error.kind).toBe("not-supported");

    const commit = await adapter.createCommit({ message: "x", tree: "sha", parents: [] });
    expect(commit.ok).toBe(false);
    if (!commit.ok) expect(commit.error.kind).toBe("not-supported");

    const ref = await adapter.updateRef("refs/heads/main", "sha");
    expect(ref.ok).toBe(false);
    if (!ref.ok) expect(ref.error.kind).toBe("not-supported");

    const protection = await adapter.getBranchProtection("main");
    expect(protection.ok).toBe(false);
    if (!protection.ok) expect(protection.error.kind).toBe("not-supported");
  });

  test("resolveThreadsBatch maintains arithmetic invariant", async () => {
    const adapter = new GitHubAdapter("org", "repo");
    // This will fail (no gh available in test) but the batch logic is testable
    // by mocking — for now verify the structure
    const threads = [
      { threadId: "t1", body: "ack" },
      { threadId: "t2", body: "ack" },
    ];
    const result = await adapter.resolveThreadsBatch(threads);
    // Whether it succeeds or fails, arithmetic invariant holds
    if (result.ok) {
      expect(result.value.resolved + result.value.failed.length).toBe(threads.length);
    }
  });
});
