import { describe, expect, test } from "bun:test";
import { DEFAULT_LOCAL_BROADCAST_TTL_MS, detectLocalBroadcastScopeConflicts, isLocalBroadcastStale, localBroadcastExpiresAt, makeLocalBroadcastReceipt, validateLocalBroadcastEnvelope, } from "./schema";
const writtenAt = "2026-05-26T22:50:00Z";
function validEnvelope() {
    return {
        schemaVersion: 1,
        id: "vera-20260526T225000Z",
        from: "vera",
        writtenAt,
        expiresAt: localBroadcastExpiresAt(writtenAt),
        priority: "P1",
        status: "working",
        summary: "Claimed 081KQX9B50008QG0R001YRPGD6 broadcast schema slice.",
        scope: [{ kind: "claim", value: "claim/codex-b0213-broadcast-bus-schema-ttl-receipts-20260526" }],
    };
}
describe("local broadcast schema", () => {
    test("computes a deterministic default TTL expiry", () => {
        expect(DEFAULT_LOCAL_BROADCAST_TTL_MS).toBe(30 * 60 * 1000);
        expect(localBroadcastExpiresAt(writtenAt)).toBe("2026-05-26T23:20:00.000Z");
    });
    test("marks broadcasts stale at or after expiresAt", () => {
        const envelope = validEnvelope();
        expect(isLocalBroadcastStale(envelope, new Date("2026-05-26T23:19:59Z"))).toBe(false);
        expect(isLocalBroadcastStale(envelope, new Date("2026-05-26T23:20:00Z"))).toBe(true);
    });
    test("builds read receipts that point to the observed broadcast", () => {
        const envelope = validEnvelope();
        expect(makeLocalBroadcastReceipt({
            from: "riven",
            readAt: "2026-05-26T22:51:00Z",
            envelope,
            sourcePath: "/Users/acehack/.local/share/zeta-broadcasts/vera.md",
        })).toEqual({
            kind: "read",
            from: "riven",
            readAt: "2026-05-26T22:51:00Z",
            broadcastId: "vera-20260526T225000Z",
            broadcastFrom: "vera",
            observedWrittenAt: writtenAt,
            sourcePath: "/Users/acehack/.local/share/zeta-broadcasts/vera.md",
        });
    });
    test("detects active overlapping scopes across agents", () => {
        const vera = {
            ...validEnvelope(),
            id: "vera-20260526T225000Z",
            from: "vera",
            summary: "Working on 081KQX9B50008QG0R001YRPGD6 conflict detection.",
            scope: [{ kind: "path", value: "tools/broadcast-local/" }],
        };
        const otto = {
            ...validEnvelope(),
            id: "otto-20260526T225100Z",
            from: "otto",
            summary: "Also touching local broadcast tooling.",
            scope: [{ kind: "path", value: "tools/broadcast-local/" }],
        };
        const riven = {
            ...validEnvelope(),
            id: "riven-20260526T225200Z",
            from: "riven",
            status: "idle",
            summary: "Idle receipt only.",
            scope: [{ kind: "path", value: "tools/broadcast-local/" }],
        };
        const expected = [
            {
                scope: { kind: "path", value: "tools/broadcast-local/" },
                broadcastIds: ["otto-20260526T225100Z", "vera-20260526T225000Z"],
                agents: ["otto", "vera"],
                summaries: ["Also touching local broadcast tooling.", "Working on 081KQX9B50008QG0R001YRPGD6 conflict detection."],
            },
        ];
        expect(detectLocalBroadcastScopeConflicts([vera, otto, riven], new Date("2026-05-26T22:55:00Z"))).toEqual(expected);
        expect(detectLocalBroadcastScopeConflicts([riven, otto, vera], new Date("2026-05-26T22:55:00Z"))).toEqual(expected);
    });
    test("orders multiple conflicts deterministically by scope", () => {
        const otto = {
            ...validEnvelope(),
            id: "otto-20260526T225100Z",
            from: "otto",
            summary: "Touching two local broadcast scopes.",
            scope: [
                { kind: "path", value: "tools/broadcast-local/" },
                { kind: "claim", value: "claim/backlog-0213" },
            ],
        };
        const vera = {
            ...validEnvelope(),
            id: "vera-20260526T225000Z",
            from: "vera",
            summary: "Also touching both local broadcast scopes.",
            scope: [
                { kind: "path", value: "tools/broadcast-local/" },
                { kind: "claim", value: "claim/backlog-0213" },
            ],
        };
        const expected = [
            {
                scope: { kind: "claim", value: "claim/backlog-0213" },
                broadcastIds: ["otto-20260526T225100Z", "vera-20260526T225000Z"],
                agents: ["otto", "vera"],
                summaries: ["Touching two local broadcast scopes.", "Also touching both local broadcast scopes."],
            },
            {
                scope: { kind: "path", value: "tools/broadcast-local/" },
                broadcastIds: ["otto-20260526T225100Z", "vera-20260526T225000Z"],
                agents: ["otto", "vera"],
                summaries: ["Touching two local broadcast scopes.", "Also touching both local broadcast scopes."],
            },
        ];
        expect(detectLocalBroadcastScopeConflicts([vera, otto], new Date("2026-05-26T22:55:00Z"))).toEqual(expected);
        expect(detectLocalBroadcastScopeConflicts([otto, vera], new Date("2026-05-26T22:55:00Z"))).toEqual(expected);
    });
    test("reports every pair when three agents overlap on one scope", () => {
        const otto = {
            ...validEnvelope(),
            id: "otto-20260526T225100Z",
            from: "otto",
            summary: "Touching local broadcast tooling from Otto.",
            scope: [{ kind: "path", value: "tools/broadcast-local/" }],
        };
        const riven = {
            ...validEnvelope(),
            id: "riven-20260526T225200Z",
            from: "riven",
            summary: "Touching local broadcast tooling from Riven.",
            scope: [{ kind: "path", value: "tools/broadcast-local/" }],
        };
        const vera = {
            ...validEnvelope(),
            id: "vera-20260526T225000Z",
            from: "vera",
            summary: "Touching local broadcast tooling from Vera.",
            scope: [{ kind: "path", value: "tools/broadcast-local/" }],
        };
        const expected = [
            {
                scope: { kind: "path", value: "tools/broadcast-local/" },
                broadcastIds: ["otto-20260526T225100Z", "riven-20260526T225200Z"],
                agents: ["otto", "riven"],
                summaries: ["Touching local broadcast tooling from Otto.", "Touching local broadcast tooling from Riven."],
            },
            {
                scope: { kind: "path", value: "tools/broadcast-local/" },
                broadcastIds: ["otto-20260526T225100Z", "vera-20260526T225000Z"],
                agents: ["otto", "vera"],
                summaries: ["Touching local broadcast tooling from Otto.", "Touching local broadcast tooling from Vera."],
            },
            {
                scope: { kind: "path", value: "tools/broadcast-local/" },
                broadcastIds: ["riven-20260526T225200Z", "vera-20260526T225000Z"],
                agents: ["riven", "vera"],
                summaries: ["Touching local broadcast tooling from Riven.", "Touching local broadcast tooling from Vera."],
            },
        ];
        expect(detectLocalBroadcastScopeConflicts([vera, riven, otto], new Date("2026-05-26T22:55:00Z"))).toEqual(expected);
    });
    test("keeps NUL-bearing scope values exact", () => {
        const otto = {
            ...validEnvelope(),
            id: "otto-20260526T225100Z",
            from: "otto",
            summary: "Touching NUL path A.",
            scope: [{ kind: "path", value: "tools/broadcast-local/\0a" }],
        };
        const vera = {
            ...validEnvelope(),
            id: "vera-20260526T225000Z",
            from: "vera",
            summary: "Touching NUL path B.",
            scope: [{ kind: "path", value: "tools/broadcast-local/\0b" }],
        };
        const riven = {
            ...validEnvelope(),
            id: "riven-20260526T225200Z",
            from: "riven",
            summary: "Also touching NUL path A.",
            scope: [{ kind: "path", value: "tools/broadcast-local/\0a" }],
        };
        const expected = [
            {
                scope: { kind: "path", value: "tools/broadcast-local/\0a" },
                broadcastIds: ["otto-20260526T225100Z", "riven-20260526T225200Z"],
                agents: ["otto", "riven"],
                summaries: ["Touching NUL path A.", "Also touching NUL path A."],
            },
        ];
        expect(detectLocalBroadcastScopeConflicts([vera, riven, otto], new Date("2026-05-26T22:55:00Z"))).toEqual(expected);
    });
    test("ignores stale overlapping scopes", () => {
        const vera = validEnvelope();
        const otto = {
            ...validEnvelope(),
            id: "otto-20260526T225100Z",
            from: "otto",
        };
        expect(detectLocalBroadcastScopeConflicts([vera, otto], new Date("2026-05-26T23:30:00Z"))).toEqual([]);
    });
    test("validates the required envelope fields", () => {
        expect(validateLocalBroadcastEnvelope(validEnvelope()).ok).toBe(true);
        const invalid = { ...validEnvelope(), schemaVersion: 2, priority: "P9", summary: "" };
        const result = validateLocalBroadcastEnvelope(invalid);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errors).toContain("schemaVersion must be 1");
            expect(result.errors).toContain("priority must be P0, P1, P2, or P3");
            expect(result.errors).toContain("summary must be a non-empty string");
        }
    });
});
