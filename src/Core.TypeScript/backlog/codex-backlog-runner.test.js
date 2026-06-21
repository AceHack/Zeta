import { describe, expect, test } from "bun:test";
import { activeClaimsFromHeartbeatSignals, activeClaimsFromOpenPrs, activeClaimsFromRemoteClaimDiffs, capacityGate, capacityPrCount, parseOpenPrListOutput, } from "../service/capacity/capacity";
describe("capacityGate", () => {
    test("allows work while there are open parallel PR slots", () => {
        expect(capacityGate(0, 3)).toEqual({ status: "ready", availablePrSlots: 3 });
        expect(capacityGate(1, 3)).toEqual({ status: "ready", availablePrSlots: 2 });
        expect(capacityGate(2, 3)).toEqual({ status: "ready", availablePrSlots: 1 });
    });
    test("waits only when the bounded parallel PR capacity is full", () => {
        expect(capacityGate(3, 3)).toEqual({ status: "wait-pr-capacity", availablePrSlots: 0 });
        expect(capacityGate(4, 3)).toEqual({ status: "wait-pr-capacity", availablePrSlots: 0 });
    });
});
describe("capacityPrCount", () => {
    const openPrs = [
        { headRefName: "codex/lane-aware-pr-capacity" },
        { headRefName: "archive/pr-preservation" },
        { headRefName: "backlog/b0751-per-agent-isolated-clones" },
        { headRefName: "codex/agent-work-rhythm" },
    ];
    test("counts only PRs in the configured capacity lane", () => {
        expect(capacityPrCount(openPrs, ["codex/"])).toBe(2);
    });
    test("supports global counting when no head prefixes are configured", () => {
        expect(capacityPrCount(openPrs, [])).toBe(4);
    });
    test("matches capacity prefixes case-insensitively", () => {
        expect(capacityPrCount([{ headRefName: "Codex/Lane-Aware-Pr-Capacity" }], ["CODEX/"])).toBe(1);
    });
});
describe("parseOpenPrListOutput", () => {
    test("parses paginated gh api base64 rows without a fixed item cap", () => {
        const rows = [
            { number: 5026, headRefName: "codex/lane-aware-pr-capacity", title: "fix(codex): scope backlog PR capacity by lane" },
            { number: 5027, headRefName: "otto-cli/zflash-detail-richer-display-skill-2026-05-25", title: "feat(zflash): show USB detail" },
        ].map((row) => Buffer.from(JSON.stringify(row), "utf8").toString("base64"));
        expect(parseOpenPrListOutput(`${rows.join("\n")}\n`)).toEqual([
            { number: 5026, headRefName: "codex/lane-aware-pr-capacity", title: "fix(codex): scope backlog PR capacity by lane" },
            { number: 5027, headRefName: "otto-cli/zflash-detail-richer-display-skill-2026-05-25", title: "feat(zflash): show USB detail" },
        ]);
    });
    test("rejects decoded rows with non-object shapes", () => {
        const row = Buffer.from(JSON.stringify(["not", "a", "pr"]), "utf8").toString("base64");
        expect(() => parseOpenPrListOutput(`${row}\n`)).toThrow("non-object open PR row");
    });
});
describe("activeClaimsFromOpenPrs", () => {
    test("turns open PR head refs and titles into rotation claims", () => {
        const claims = activeClaimsFromOpenPrs([
            {
                number: 1881,
                headRefName: "codex/factory-trajectory-surface-alignment-measurement",
                title: "trajectory: alignment measurement child packet",
            },
        ]);
        expect(claims).toContain("codex/factory-trajectory-surface-alignment-measurement");
        expect(claims).toContain("pr-1881:trajectory: alignment measurement child packet");
    });
});
describe("activeClaimsFromRemoteClaimDiffs", () => {
    test("adds remote claim branches and touched paths as pickup blockers", () => {
        const claims = activeClaimsFromRemoteClaimDiffs([
            {
                branch: "origin/claim/trajectory-typescript-bun-live-state",
                paths: ["docs/trajectories/typescript-bun-migration/RESUME.md", "docs/backlog/P0/081KQ3HBZ0008QG0R002S674CG-example.md"],
            },
        ]);
        expect(claims).toContain("claim/trajectory-typescript-bun-live-state");
        expect(claims).toContain("docs/trajectories/typescript-bun-migration/RESUME.md");
        expect(claims).toContain("docs/backlog/P0/081KQ3HBZ0008QG0R002S674CG-example.md");
        expect(claims).toContain("claim/trajectory-typescript-bun-live-state:docs/trajectories/typescript-bun-migration/RESUME.md");
    });
});
describe("activeClaimsFromHeartbeatSignals", () => {
    const now = new Date("2026-05-08T17:00:00Z");
    test("adds fresh heartbeat paths as pickup blockers", () => {
        const claims = activeClaimsFromHeartbeatSignals([
            {
                claim: "trajectory-typescript-bun-live-state",
                paths: ["docs/trajectories/typescript-bun-migration/RESUME.md", "docs/backlog/P0/081KQ3HBZ0008QG0R002S674CG-example.md"],
                updated_at: "2026-05-08T16:55:00Z",
                status: "active",
            },
        ], now);
        expect(claims).toContain("heartbeat:trajectory-typescript-bun-live-state");
        expect(claims).toContain("docs/trajectories/typescript-bun-migration/RESUME.md");
        expect(claims).toContain("heartbeat:trajectory-typescript-bun-live-state:docs/trajectories/typescript-bun-migration/RESUME.md");
    });
    test("ignores stale or completed heartbeat paths", () => {
        const claims = activeClaimsFromHeartbeatSignals([
            {
                claim: "stale",
                paths: ["docs/backlog/P0/081KPYCJH0008QG0R003MDS51N-stale.md"],
                updated_at: "2026-05-08T16:00:00Z",
                status: "active",
            },
            {
                claim: "done",
                paths: ["docs/backlog/P0/081KQ0YZ80008QG0R002T6TM7Z-done.md"],
                updated_at: "2026-05-08T16:59:00Z",
                status: "merged-cleaned",
            },
            {
                claim: "cleanup",
                paths: ["tools/hygiene/check-bash-retirement-inventory.test.ts"],
                updated_at: "2026-05-08T16:59:00Z",
                status: "merged-cleanup-complete",
            },
            {
                claim: "stale-cleanup-complete",
                paths: ["tools/hygiene/check-bash-retirement-inventory.stale.ts"],
                updated_at: "2026-05-08T16:59:00Z",
                status: "stale-cleanup-complete",
            },
            {
                claim: "cleanup-complete",
                paths: ["tools/hygiene/check-bash-retirement-inventory.ts"],
                updated_at: "2026-05-08T16:59:00Z",
                status: "cleanup-complete",
            },
            {
                claim: "complete",
                paths: ["tools/hygiene/check-bash-retirement-inventory.md"],
                updated_at: "2026-05-08T16:59:00Z",
                status: "complete",
            },
        ], now);
        expect(claims).toEqual([]);
    });
});
