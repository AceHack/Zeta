import { describe, expect, test } from "bun:test";
import { GitLabAdapter } from "./gitlab-adapter";
describe("GitLabAdapter", () => {
    test("forgeName is gitlab", () => {
        const adapter = new GitLabAdapter("team", "project");
        expect(adapter.forgeName).toBe("gitlab");
    });
    test("not-supported methods return proper error kind", async () => {
        const adapter = new GitLabAdapter("team", "project");
        const gate = await adapter.getPrGateState(1);
        expect(gate.ok).toBe(false);
        if (!gate.ok) {
            expect(gate.error.kind).toBe("not-supported");
            expect(gate.error.retryable).toBe(false);
        }
        const thread = await adapter.resolveThread("t1", "ack");
        expect(thread.ok).toBe(false);
        if (!thread.ok)
            expect(thread.error.kind).toBe("not-supported");
    });
    test("listOpenPullRequests calls glab (fails gracefully without glab)", async () => {
        const adapter = new GitLabAdapter("team", "project");
        const result = await adapter.listOpenPullRequests({ limit: 5 });
        // Without glab installed, this returns an internal error — not a crash
        if (!result.ok) {
            expect(["internal", "not-found"]).toContain(result.error.kind);
        }
    });
});
