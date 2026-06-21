import { describe, expect, test } from "bun:test";
import { applyRevoke, applyQuarantine, applyUnquarantine } from "./registry-revoke.js";
function baseContent() {
    return {
        format_version: 1,
        sequence: 1,
        issued_at: "2026-06-01T00:00:00Z",
        packages: Object.create(null),
    };
}
describe("applyRevoke", () => {
    test("adds entry to revoked + sets format_version 2", () => {
        const prev = baseContent();
        const next = applyRevoke(prev, "leaf", "1.0.0", "critical bug", "2026-06-01T00:00:00Z");
        expect(next.format_version).toBe(2);
        expect(next.revoked?.["leaf"]?.["1.0.0"]?.reason).toBe("critical bug");
        expect(next.revoked?.["leaf"]?.["1.0.0"]?.at).toBe("2026-06-01T00:00:00Z");
    });
    test("without reason — entry has no reason field (exactOptionalPropertyTypes)", () => {
        const prev = baseContent();
        const next = applyRevoke(prev, "leaf", "1.0.0", undefined, "2026-06-01T00:00:00Z");
        const entry = next.revoked?.["leaf"]?.["1.0.0"];
        expect(entry).toBeDefined();
        expect("reason" in (entry ?? {})).toBe(false);
        expect(entry?.at).toBe("2026-06-01T00:00:00Z");
    });
    test("re-revoke is idempotent (no error, still revoked)", () => {
        const prev = baseContent();
        const once = applyRevoke(prev, "leaf", "1.0.0", "v1", "2026-06-01T00:00:00Z");
        const twice = applyRevoke(once, "leaf", "1.0.0", "v2", "2026-06-01T01:00:00Z");
        expect("error" in twice).toBe(false);
        // latest call wins
        expect(twice.revoked?.["leaf"]?.["1.0.0"]?.reason).toBe("v2");
        expect(twice.format_version).toBe(2);
    });
    test("revoke clears matching quarantined entry", () => {
        let prev = baseContent();
        prev = applyQuarantine(prev, "leaf", "1.0.0", "maybe bad", "2026-06-01T00:00:00Z");
        expect(prev.quarantined?.["leaf"]?.["1.0.0"]).toBeDefined();
        const next = applyRevoke(prev, "leaf", "1.0.0", "definitely bad", "2026-06-01T01:00:00Z");
        expect(next.revoked?.["leaf"]?.["1.0.0"]).toBeDefined();
        expect(next.quarantined?.["leaf"]?.["1.0.0"]).toBeUndefined();
    });
    test("does not mutate prev", () => {
        const prev = baseContent();
        applyRevoke(prev, "leaf", "1.0.0", "bug", "2026-06-01T00:00:00Z");
        expect(prev.revoked).toBeUndefined();
        expect(prev.format_version).toBe(1);
    });
});
describe("applyQuarantine", () => {
    test("adds entry to quarantined + sets format_version 2", () => {
        const prev = baseContent();
        const next = applyQuarantine(prev, "leaf", "1.0.0", "suspicious", "2026-06-01T00:00:00Z");
        expect("error" in next).toBe(false);
        if ("error" in next)
            return;
        expect(next.format_version).toBe(2);
        expect(next.quarantined?.["leaf"]?.["1.0.0"]?.reason).toBe("suspicious");
        expect(next.quarantined?.["leaf"]?.["1.0.0"]?.at).toBe("2026-06-01T00:00:00Z");
    });
    test("without reason — no reason field", () => {
        const prev = baseContent();
        const next = applyQuarantine(prev, "leaf", "1.0.0", undefined, "2026-06-01T00:00:00Z");
        if ("error" in next)
            return;
        const entry = next.quarantined?.["leaf"]?.["1.0.0"];
        expect(entry).toBeDefined();
        expect("reason" in (entry ?? {})).toBe(false);
    });
    test("errors when already revoked", () => {
        const prev = applyRevoke(baseContent(), "leaf", "1.0.0", undefined, "2026-06-01T00:00:00Z");
        const result = applyQuarantine(prev, "leaf", "1.0.0", "too late", "2026-06-01T01:00:00Z");
        expect("error" in result).toBe(true);
        if ("error" in result)
            expect(result.error).toMatch(/revoked/);
    });
    test("does not mutate prev", () => {
        const prev = baseContent();
        applyQuarantine(prev, "leaf", "1.0.0", "q", "2026-06-01T00:00:00Z");
        expect(prev.quarantined).toBeUndefined();
        expect(prev.format_version).toBe(1);
    });
});
describe("applyUnquarantine", () => {
    test("removes quarantine entry", () => {
        let prev = baseContent();
        const q = applyQuarantine(prev, "leaf", "1.0.0", "q", "2026-06-01T00:00:00Z");
        if ("error" in q)
            throw new Error("unexpected error");
        prev = q;
        const next = applyUnquarantine(prev, "leaf", "1.0.0", "2026-06-01T01:00:00Z");
        expect("error" in next).toBe(false);
        if ("error" in next)
            return;
        expect(next.quarantined?.["leaf"]?.["1.0.0"]).toBeUndefined();
    });
    test("reverts format_version to 1 when it was the last mark", () => {
        const q = applyQuarantine(baseContent(), "leaf", "1.0.0", "q", "2026-06-01T00:00:00Z");
        if ("error" in q)
            throw new Error("unexpected");
        const next = applyUnquarantine(q, "leaf", "1.0.0", "2026-06-01T01:00:00Z");
        if ("error" in next)
            throw new Error("unexpected");
        expect(next.format_version).toBe(1);
    });
    test("keeps format_version 2 when other marks remain", () => {
        let prev = baseContent();
        const q1 = applyQuarantine(prev, "alpha", "1.0.0", "q1", "2026-06-01T00:00:00Z");
        if ("error" in q1)
            throw new Error("unexpected");
        prev = q1;
        const q2 = applyQuarantine(prev, "beta", "2.0.0", "q2", "2026-06-01T00:00:00Z");
        if ("error" in q2)
            throw new Error("unexpected");
        prev = q2;
        const next = applyUnquarantine(prev, "alpha", "1.0.0", "2026-06-01T01:00:00Z");
        if ("error" in next)
            throw new Error("unexpected");
        expect(next.format_version).toBe(2);
        expect(next.quarantined?.["beta"]?.["2.0.0"]).toBeDefined();
    });
    test("errors when not quarantined", () => {
        const result = applyUnquarantine(baseContent(), "leaf", "1.0.0", "2026-06-01T01:00:00Z");
        expect("error" in result).toBe(true);
        if ("error" in result)
            expect(result.error).toMatch(/not quarantined/);
    });
    test("does not mutate prev", () => {
        const q = applyQuarantine(baseContent(), "leaf", "1.0.0", "q", "2026-06-01T00:00:00Z");
        if ("error" in q)
            throw new Error("unexpected");
        const snap = JSON.stringify(q);
        applyUnquarantine(q, "leaf", "1.0.0", "2026-06-01T01:00:00Z");
        expect(JSON.stringify(q)).toBe(snap);
    });
});
describe("issued_at refresh", () => {
    test("applyRevoke sets issued_at to the `at` param", () => {
        const prev = baseContent(); // issued_at "2026-06-01T00:00:00Z"
        const at = "2026-06-01T12:00:00Z";
        const next = applyRevoke(prev, "leaf", "1.0.0", "bug", at);
        expect(next.issued_at).toBe(at);
        expect(next.issued_at).not.toBe(prev.issued_at);
    });
    test("applyQuarantine sets issued_at to the `at` param", () => {
        const prev = baseContent();
        const at = "2026-06-01T12:00:00Z";
        const next = applyQuarantine(prev, "leaf", "1.0.0", "suspicious", at);
        if ("error" in next)
            throw new Error("unexpected error");
        expect(next.issued_at).toBe(at);
        expect(next.issued_at).not.toBe(prev.issued_at);
    });
    test("applyUnquarantine sets issued_at to the `at` param", () => {
        const q = applyQuarantine(baseContent(), "leaf", "1.0.0", "q", "2026-06-01T00:00:00Z");
        if ("error" in q)
            throw new Error("unexpected");
        const at = "2026-06-01T12:00:00Z";
        const next = applyUnquarantine(q, "leaf", "1.0.0", at);
        if ("error" in next)
            throw new Error("unexpected");
        expect(next.issued_at).toBe(at);
        expect(next.issued_at).not.toBe(q.issued_at);
    });
});
describe("empty mark map stripping (pure layer)", () => {
    test("applyUnquarantine of last quarantined mark leaves no quarantined key", () => {
        const q = applyQuarantine(baseContent(), "leaf", "1.0.0", "q", "2026-06-01T00:00:00Z");
        if ("error" in q)
            throw new Error("unexpected");
        const next = applyUnquarantine(q, "leaf", "1.0.0", "2026-06-01T01:00:00Z");
        if ("error" in next)
            throw new Error("unexpected");
        expect("quarantined" in next).toBe(false);
        expect(next.format_version).toBe(1);
    });
    test("applyRevoke of only quarantined version clears quarantined key, keeps revoked", () => {
        const q = applyQuarantine(baseContent(), "leaf", "1.0.0", "q", "2026-06-01T00:00:00Z");
        if ("error" in q)
            throw new Error("unexpected");
        // revoke supersedes quarantine: quarantined becomes empty
        const next = applyRevoke(q, "leaf", "1.0.0", "bad", "2026-06-01T01:00:00Z");
        expect("quarantined" in next).toBe(false);
        expect(next.revoked?.["leaf"]?.["1.0.0"]).toBeDefined();
        expect(next.format_version).toBe(2);
    });
});
