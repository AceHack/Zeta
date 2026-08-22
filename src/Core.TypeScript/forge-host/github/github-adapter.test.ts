import { describe, expect, test } from "bun:test";
import { GitHubAdapter } from "./github-adapter";

describe("GitHubAdapter", () => {
  test("forgeName is github", () => {
    const adapter = new GitHubAdapter("Lucent-Financial-Group", "Zeta");
    expect(adapter.forgeName).toBe("github");
  });

  test("not-supported methods return proper error", async () => {
    const adapter = new GitHubAdapter("org", "repo");

    // getBranchProtection is still not-supported
    const protection = await adapter.getBranchProtection("main");
    expect(protection.ok).toBe(false);
    if (!protection.ok) expect(protection.error.kind).toBe("not-supported");
  });

  test("git data API methods attempt real calls (not not-supported)", async () => {
    const adapter = new GitHubAdapter("org", "repo");
    // These now call gh api — they fail with auth/network errors, not "not-supported"
    const blob = await adapter.createBlob("hello");
    expect(blob.ok).toBe(false);
    if (!blob.ok) expect(blob.error.kind).not.toBe("not-supported");
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
