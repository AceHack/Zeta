import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { DEFAULT_CONFIG, defaultHistoryFile, parseArgs, parseRow, parsePositiveMinutes, pollOnce, runOnce, } from "./backlog-ready-notifier";
function fakeAdapters(nowIso, rows, capturedCalls = [], gitLogStr = "", ghPrListStr = "", history = { read: null, written: [] }) {
    return {
        now: () => new Date(nowIso),
        scanBacklog: () => rows,
        publishAssignment: (from, to, rowId, priority, rationale) => {
            capturedCalls.push({ from, to, rowId, priority, rationale });
            return {
                id: `env-${capturedCalls.length}`,
                from,
                to,
                timestamp: nowIso,
                expiresAt: nowIso,
                topic: "work-assignment",
                payload: { rowId, priority, rationale },
            };
        },
        agentPatterns: {
            "testagent": ["testagent"],
        },
        execGitLog: () => gitLogStr,
        execGhPrList: () => ghPrListStr,
        readHistoryFile: () => history.read,
        writeHistoryFile: (_path, h) => {
            history.written.push(h);
            history.read = h;
        },
    };
}
const ROW_OPEN_NO_DEPS = {
    id: "B-9001",
    priority: "P1",
    status: "open",
    dependsOn: [],
    filename: "B-9001-test-no-deps.md",
};
const ROW_OPEN_DEPS_SATISFIED = {
    id: "B-9002",
    priority: "P1",
    status: "open",
    dependsOn: ["B-9000"],
    filename: "B-9002-test-deps-ok.md",
};
const ROW_OPEN_DEPS_UNSATISFIED = {
    id: "B-9003",
    priority: "P2",
    status: "open",
    dependsOn: ["B-9999"],
    filename: "B-9003-test-deps-pending.md",
};
const ROW_CLOSED = {
    id: "B-9000",
    priority: "P1",
    status: "closed",
    dependsOn: [],
    filename: "B-9000-test-closed.md",
};
const ROW_OPEN_DEPS_PENDING = {
    id: "B-9999",
    priority: "P3",
    status: "open",
    dependsOn: [],
    filename: "B-9999-test-pending.md",
};
describe("backlog-ready-notifier slice 2", () => {
    test("default config has sensible poll interval and backlog dir", () => {
        expect(DEFAULT_CONFIG.pollIntervalMin).toBe(10);
        expect(DEFAULT_CONFIG.once).toBe(false);
        expect(DEFAULT_CONFIG.backlogDir).toBe("docs/backlog");
    });
    describe("parseRow", () => {
        test("extracts id + priority + status + depends_on from frontmatter", () => {
            const content = `---
id: B-0440
priority: P1
status: open
title: "Test row"
depends_on: [B-0400, B-0402]
---

body content`;
            const row = parseRow(content, "B-0440-test.md");
            expect(row).not.toBeNull();
            expect(row?.id).toBe("B-0440");
            expect(row?.priority).toBe("P1");
            expect(row?.status).toBe("open");
            expect(row?.dependsOn).toEqual(["B-0400", "B-0402"]);
        });
        test("handles empty depends_on array", () => {
            const content = `---
id: B-9001
priority: P2
status: open
depends_on: []
---`;
            const row = parseRow(content, "B-9001.md");
            expect(row?.dependsOn).toEqual([]);
        });
        test("handles missing depends_on field (treats as empty)", () => {
            const content = `---
id: B-9002
priority: P3
status: closed
---`;
            const row = parseRow(content, "B-9002.md");
            expect(row?.dependsOn).toEqual([]);
        });
        test("parses block-style depends_on YAML list", () => {
            const content = `---
id: B-9010
priority: P1
status: open
depends_on:
  - B-9000
  - B-9001
  - B-9002
---`;
            const row = parseRow(content, "B-9010.md");
            expect(row?.dependsOn).toEqual(["B-9000", "B-9001", "B-9002"]);
        });
        test("strips YAML inline comments from block-style depends_on", () => {
            // Real-world example from B-0422: `- B-0395  # operational-resonance-...`
            // was previously parsed as the full string (including the comment),
            // producing a false-positive dangling-dep warning.
            const content = `---
id: B-9011
priority: P1
status: open
depends_on:
  - B-0395  # operational-resonance-conversation-interface (Clifford engine)
  - B-9001
  - B-9002 # short trailing note
---`;
            const row = parseRow(content, "B-9011.md");
            expect(row?.dependsOn).toEqual(["B-0395", "B-9001", "B-9002"]);
        });
        test("strips YAML inline comments from inline-array depends_on", () => {
            const content = `---
id: B-9012
priority: P1
status: open
depends_on: [B-0440, B-0441 # ready-to-grind notifier, B-0442]
---`;
            const row = parseRow(content, "B-9012.md");
            // Note: a `#` in an inline-array element terminates the list visually
            // but YAML doesn't treat `]` as commentable so this is best-effort.
            // The first two entries are clean; the third gets absorbed by the
            // comment which the parser strips. Verify the clean entries survive.
            expect(row?.dependsOn).toContain("B-0440");
            expect(row?.dependsOn).toContain("B-0441");
        });
        test("returns null when frontmatter missing", () => {
            expect(parseRow("no frontmatter here", "x.md")).toBeNull();
        });
        test("returns null when required fields missing", () => {
            const content = `---
title: only a title
---`;
            expect(parseRow(content, "x.md")).toBeNull();
        });
    });
    describe("isAgentQueueEmpty", () => {
        const { isAgentQueueEmpty } = require("./backlog-ready-notifier");
        test("returns true when agent is unknown", () => {
            const adapters = fakeAdapters("2026-05-13T18:00:00Z", [], [], "some git log", "some prs");
            expect(isAgentQueueEmpty("UnknownAgent", adapters)).toBe(true);
        });
        test("returns true when known agent has no commits and no PRs", () => {
            const adapters = fakeAdapters("2026-05-13T18:00:00Z", [], [], "other stuff", "[]");
            expect(isAgentQueueEmpty("TestAgent", adapters)).toBe(true);
        });
        test("returns false when known agent has recent commits", () => {
            const adapters = fakeAdapters("2026-05-13T18:00:00Z", [], [], "commit by testagent", "[]");
            expect(isAgentQueueEmpty("TestAgent", adapters)).toBe(false);
        });
        test("returns false when known agent has open PRs", () => {
            const prData = JSON.stringify([{ title: "test", body: "fixed by TestAgent", author: { login: "other" } }]);
            const adapters = fakeAdapters("2026-05-13T18:00:00Z", [], [], "", prData);
            expect(isAgentQueueEmpty("TestAgent", adapters)).toBe(false);
        });
        test("returns false (conservative-busy) when execGitLog returns null — git unavailable must not trigger assignment", () => {
            const adapters = {
                ...fakeAdapters("2026-05-13T18:00:00Z", [], [], "irrelevant", "[]"),
                execGitLog: () => null,
            };
            expect(isAgentQueueEmpty("TestAgent", adapters)).toBe(false);
        });
        test("returns false (conservative-busy) when execGhPrList returns null — gh unavailable must not trigger assignment", () => {
            // git log is clean (no agent pattern), but gh fails → still conservative
            const adapters = {
                ...fakeAdapters("2026-05-13T18:00:00Z", [], [], "no match here", "irrelevant"),
                execGhPrList: () => null,
            };
            expect(isAgentQueueEmpty("TestAgent", adapters)).toBe(false);
        });
    });
    describe("pollOnce with injected adapters", () => {
        test("flags rows with no dependencies as ready", () => {
            const result = pollOnce(DEFAULT_CONFIG, fakeAdapters("2026-05-13T18:00:00Z", [ROW_OPEN_NO_DEPS]));
            expect(result.totalOpenRows).toBe(1);
            expect(result.readyRowsFound).toBe(1);
            expect(result.candidateIds).toEqual(["B-9001"]);
        });
        test("flags rows with all deps closed as ready", () => {
            const result = pollOnce(DEFAULT_CONFIG, fakeAdapters("2026-05-13T18:00:00Z", [
                ROW_CLOSED,
                ROW_OPEN_DEPS_SATISFIED,
            ]));
            expect(result.totalOpenRows).toBe(1);
            expect(result.readyRowsFound).toBe(1);
            expect(result.candidateIds).toEqual(["B-9002"]);
        });
        test("does NOT flag a row whose dep is still open", () => {
            // ROW_OPEN_DEPS_UNSATISFIED depends on ROW_OPEN_DEPS_PENDING (id=B-9999, status=open)
            // So B-9003 should NOT be ready. B-9999 has no deps so IT is ready.
            const result = pollOnce(DEFAULT_CONFIG, fakeAdapters("2026-05-13T18:00:00Z", [
                ROW_OPEN_DEPS_UNSATISFIED,
                ROW_OPEN_DEPS_PENDING,
            ]));
            expect(result.totalOpenRows).toBe(2);
            expect(result.readyRowsFound).toBe(1);
            expect(result.candidateIds).toEqual(["B-9999"]);
        });
        test("limits candidateIds to first 10 rows", () => {
            const rows = Array.from({ length: 15 }, (_, i) => ({
                id: `B-${String(8000 + i).padStart(4, "0")}`,
                priority: "P2",
                status: "open",
                dependsOn: [],
                filename: `B-${String(8000 + i).padStart(4, "0")}.md`,
            }));
            const result = pollOnce(DEFAULT_CONFIG, fakeAdapters("2026-05-13T18:00:00Z", rows));
            expect(result.readyRowsFound).toBe(15);
            expect(result.candidateIds).toHaveLength(10);
        });
        test("returns 0 when no open rows exist", () => {
            const result = pollOnce(DEFAULT_CONFIG, fakeAdapters("2026-05-13T18:00:00Z", [ROW_CLOSED]));
            expect(result.totalOpenRows).toBe(0);
            expect(result.readyRowsFound).toBe(0);
            expect(result.candidateIds).toEqual([]);
        });
        test("treats superseded-by-* deps as satisfied (matches generate-index)", () => {
            const supersededRow = {
                id: "B-8000",
                priority: "P1",
                status: "superseded-by-B-9999",
                dependsOn: [],
                filename: "B-8000.md",
            };
            const openWithSupersededDep = {
                id: "B-8001",
                priority: "P1",
                status: "open",
                dependsOn: ["B-8000"],
                filename: "B-8001.md",
            };
            const result = pollOnce(DEFAULT_CONFIG, fakeAdapters("2026-05-13T18:00:00Z", [supersededRow, openWithSupersededDep]));
            expect(result.readyRowsFound).toBe(1);
            expect(result.candidateIds).toEqual(["B-8001"]);
        });
        test("flags dangling dep references in note", () => {
            const openWithDanglingDep = {
                id: "B-8002",
                priority: "P2",
                status: "open",
                dependsOn: ["B-NONEXISTENT"],
                filename: "B-8002.md",
            };
            const result = pollOnce(DEFAULT_CONFIG, fakeAdapters("2026-05-13T18:00:00Z", [openWithDanglingDep]));
            expect(result.readyRowsFound).toBe(0);
            expect(result.note).toContain("dangling dep ref");
            expect(result.note).toContain("B-NONEXISTENT");
        });
    });
    test("runOnce returns a single result without daemon mode", () => {
        const result = runOnce({ ...DEFAULT_CONFIG, backlogDir: "/nonexistent" }, fakeAdapters("2026-05-13T18:00:00Z", []));
        expect(result.pollAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        // /nonexistent has no P*/ dirs so should report 0 rows
        expect(result.totalOpenRows).toBe(0);
    });
    describe("parsePositiveMinutes", () => {
        test("accepts positive finite numbers", () => {
            expect(parsePositiveMinutes("10", "--poll-min")).toBe(10);
        });
        test("rejects invalid inputs", () => {
            expect(() => parsePositiveMinutes(undefined, "--poll-min")).toThrow(/requires/);
            expect(() => parsePositiveMinutes("0", "--poll-min")).toThrow(/positive finite/);
            expect(() => parsePositiveMinutes("abc", "--poll-min")).toThrow(/positive finite/);
        });
    });
    describe("bus publish (slice 4)", () => {
        test("publishes work-assignment envelope for each ready row up to maxAssignments", () => {
            const captured = [];
            const result = pollOnce({ ...DEFAULT_CONFIG, maxAssignments: 2 }, fakeAdapters("2026-05-13T18:00:00Z", [ROW_OPEN_NO_DEPS, ROW_CLOSED, ROW_OPEN_DEPS_SATISFIED], captured));
            expect(result.readyRowsFound).toBe(2);
            expect(result.publishedEnvelopeIds).toHaveLength(2);
            expect(captured).toHaveLength(2);
            expect(captured[0].from).toBe("otto");
            expect(captured[0].to).toBe("*");
            expect(captured[0].rowId).toBe("B-9001");
            expect(captured[0].priority).toBe("P1");
            expect(captured[0].rationale).toContain("Ready-to-grind");
        });
        test("does NOT publish when noPublish: true (dry-run)", () => {
            const captured = [];
            const result = pollOnce({ ...DEFAULT_CONFIG, noPublish: true }, fakeAdapters("2026-05-13T18:00:00Z", [ROW_OPEN_NO_DEPS], captured));
            expect(result.readyRowsFound).toBe(1);
            expect(result.publishedEnvelopeIds).toHaveLength(0);
            expect(captured).toHaveLength(0);
            expect(result.note).toContain("publish skipped");
        });
        test("does NOT publish when ALL open rows have unsatisfied deps (no readies)", () => {
            // Only ROW_OPEN_DEPS_UNSATISFIED is in this set — its dep (B-9999)
            // isn't in the scan, so it's dangling/unsatisfied → not ready.
            const captured = [];
            const result = pollOnce(DEFAULT_CONFIG, fakeAdapters("2026-05-13T18:00:00Z", [ROW_OPEN_DEPS_UNSATISFIED], captured));
            expect(result.readyRowsFound).toBe(0);
            expect(result.publishedEnvelopeIds).toHaveLength(0);
            expect(captured).toHaveLength(0);
        });
        test("caps published envelopes at maxAssignments even with many ready rows", () => {
            const captured = [];
            const manyRows = Array.from({ length: 10 }, (_, i) => ({
                id: `B-${String(8000 + i).padStart(4, "0")}`,
                priority: "P2",
                status: "open",
                dependsOn: [],
                filename: `B-${String(8000 + i).padStart(4, "0")}.md`,
            }));
            const result = pollOnce({ ...DEFAULT_CONFIG, maxAssignments: 3 }, fakeAdapters("2026-05-13T18:00:00Z", manyRows, captured));
            expect(result.readyRowsFound).toBe(10);
            expect(result.publishedEnvelopeIds).toHaveLength(3);
            expect(captured).toHaveLength(3);
        });
        test("pollOnce with queue-busy adapters → queueBusy: true, no publish", () => {
            const captured = [];
            // "testagent" has commit pattern "testagent". Set git log to contain it.
            const adapters = fakeAdapters("2026-05-13T18:00:00Z", [ROW_OPEN_NO_DEPS], captured, "commit by testagent");
            const config = { ...DEFAULT_CONFIG, targetAgent: "testagent" };
            const result = pollOnce(config, adapters);
            expect(result.queueBusy).toBe(true);
            expect(result.publishedEnvelopeIds).toHaveLength(0);
            expect(captured).toHaveLength(0);
            expect(result.note).toContain("queue busy for testagent");
        });
        test("pollOnce with queue-empty adapters AND ready rows → queueBusy: false, publishes", () => {
            const captured = [];
            // clean git log and prs
            const adapters = fakeAdapters("2026-05-13T18:00:00Z", [ROW_OPEN_NO_DEPS], captured, "", "");
            const config = { ...DEFAULT_CONFIG, targetAgent: "testagent" };
            const result = pollOnce(config, adapters);
            expect(result.queueBusy).toBe(false);
            expect(result.publishedEnvelopeIds).toHaveLength(1);
            expect(captured).toHaveLength(1);
        });
    });
    describe("assignment-history cooldown (slice 5a)", () => {
        test("defaultHistoryFile honors ZETA_BUS_DIR env var when set", () => {
            // Use `path.join` for expected values so the assertion is platform-
            // independent (PR #4449 review finding: hard-coded forward slashes
            // would fail on Windows where path.join returns backslashes).
            const before = process.env.ZETA_BUS_DIR;
            try {
                process.env.ZETA_BUS_DIR = "/var/zeta-test";
                expect(defaultHistoryFile()).toBe(join("/var/zeta-test", "assignment-history.json"));
                delete process.env.ZETA_BUS_DIR;
                expect(defaultHistoryFile()).toBe(join("/tmp/zeta-bus", "assignment-history.json"));
            }
            finally {
                if (before === undefined)
                    delete process.env.ZETA_BUS_DIR;
                else
                    process.env.ZETA_BUS_DIR = before;
            }
        });
        test("row assigned at T=0; same row at T=15min (within 30min cooldown) → skipped", () => {
            const captured = [];
            // Pre-populate history with B-9001 published at T=0.
            const history = {
                read: { entries: [{ rowId: "B-9001", publishedAt: "2026-05-13T18:00:00.000Z" }] },
                written: [],
            };
            // Poll at T+15min.
            const adapters = fakeAdapters("2026-05-13T18:15:00.000Z", [ROW_OPEN_NO_DEPS], captured, "", "", history);
            const result = pollOnce({ ...DEFAULT_CONFIG, cooldownMin: 30 }, adapters);
            expect(result.skippedDueToCooldown).toEqual(["B-9001"]);
            expect(result.publishedEnvelopeIds).toHaveLength(0);
            expect(captured).toHaveLength(0);
            expect(result.note).toContain("skipped 1 due to cooldown");
        });
        test("row assigned at T=0; same row at T=35min (after 30min cooldown) → re-assigned", () => {
            const captured = [];
            const history = {
                read: { entries: [{ rowId: "B-9001", publishedAt: "2026-05-13T18:00:00.000Z" }] },
                written: [],
            };
            // Poll at T+35min — entry is expired (older than 30min cooldown).
            const adapters = fakeAdapters("2026-05-13T18:35:00.000Z", [ROW_OPEN_NO_DEPS], captured, "", "", history);
            const result = pollOnce({ ...DEFAULT_CONFIG, cooldownMin: 30 }, adapters);
            expect(result.skippedDueToCooldown).toEqual([]);
            expect(result.publishedEnvelopeIds).toHaveLength(1);
            expect(captured).toHaveLength(1);
            // History rewritten: pruned the stale entry, appended fresh entry.
            expect(history.written).toHaveLength(1);
            expect(history.written[0].entries).toEqual([
                { rowId: "B-9001", publishedAt: "2026-05-13T18:35:00.000Z" },
            ]);
        });
        test("history file absent → first assignment proceeds normally and writes history", () => {
            const captured = [];
            const history = { read: null, written: [] };
            const adapters = fakeAdapters("2026-05-13T18:00:00.000Z", [ROW_OPEN_NO_DEPS], captured, "", "", history);
            const result = pollOnce(DEFAULT_CONFIG, adapters);
            expect(result.skippedDueToCooldown).toEqual([]);
            expect(result.publishedEnvelopeIds).toHaveLength(1);
            expect(history.written).toHaveLength(1);
            expect(history.written[0].entries[0]).toMatchObject({
                rowId: "B-9001",
                publishedAt: "2026-05-13T18:00:00.000Z",
            });
        });
        test("multiple rows in cooldown → only expired rows published; skippedDueToCooldown lists skipped IDs", () => {
            const captured = [];
            // B-9001 published 15min ago (still in cooldown); B-9002 published 45min ago (expired).
            const history = {
                read: {
                    entries: [
                        { rowId: "B-9001", publishedAt: "2026-05-13T18:00:00.000Z" },
                        { rowId: "B-9002", publishedAt: "2026-05-13T17:30:00.000Z" },
                    ],
                },
                written: [],
            };
            const rowB9001 = { ...ROW_OPEN_NO_DEPS, id: "B-9001" };
            const rowB9002 = { ...ROW_OPEN_NO_DEPS, id: "B-9002" };
            const adapters = fakeAdapters("2026-05-13T18:15:00.000Z", // T+15min from B-9001; T+45min from B-9002
            [rowB9001, rowB9002], captured, "", "", history);
            const result = pollOnce({ ...DEFAULT_CONFIG, maxAssignments: 10, cooldownMin: 30 }, adapters);
            expect(result.skippedDueToCooldown).toEqual(["B-9001"]);
            expect(result.publishedEnvelopeIds).toHaveLength(1);
            expect(captured.map(c => c.rowId)).toEqual(["B-9002"]);
        });
        test("history pruning: entries older than cooldownMin removed on write", () => {
            const captured = [];
            // One ancient entry + one fresh entry from a different row that's about to be re-published-fresh.
            const history = {
                read: {
                    entries: [
                        { rowId: "B-OLD", publishedAt: "2026-05-13T17:00:00.000Z" }, // 60min old (expired)
                        { rowId: "B-RECENT", publishedAt: "2026-05-13T17:50:00.000Z" }, // 10min old (kept)
                    ],
                },
                written: [],
            };
            const rowNew = { ...ROW_OPEN_NO_DEPS, id: "B-NEW" };
            const adapters = fakeAdapters("2026-05-13T18:00:00.000Z", [rowNew], captured, "", "", history);
            const result = pollOnce({ ...DEFAULT_CONFIG, cooldownMin: 30 }, adapters);
            expect(result.publishedEnvelopeIds).toHaveLength(1);
            // Written history should NOT include B-OLD (pruned) but should keep B-RECENT and add B-NEW.
            expect(history.written).toHaveLength(1);
            const writtenIds = history.written[0].entries.map(e => e.rowId);
            expect(writtenIds).not.toContain("B-OLD");
            expect(writtenIds).toContain("B-RECENT");
            expect(writtenIds).toContain("B-NEW");
        });
        test("--history-file and --cooldown-min flags parse correctly", () => {
            const config = parseArgs([
                "--history-file", "/custom/path/assignment-history.json",
                "--cooldown-min", "60",
            ]);
            expect(config.historyFile).toBe("/custom/path/assignment-history.json");
            expect(config.cooldownMin).toBe(60);
        });
        test("--history-file rejects missing value", () => {
            expect(() => parseArgs(["--history-file"])).toThrow(/requires a value/);
        });
        test("cooled-down rows do NOT consume maxAssignments quota — later eligible rows still publish (Codex P1 #4449)", () => {
            const captured = [];
            // First 3 ready rows are in cooldown; 4th and 5th are eligible.
            // With maxAssignments=3, all 3 publishes should go to the 4th, 5th, and... wait we need 3 eligible.
            // Re-cast: 3 in cooldown + 3 eligible; maxAssignments=3 must publish the 3 eligible.
            const history = {
                read: {
                    entries: [
                        { rowId: "B-COOLED-1", publishedAt: "2026-05-13T18:00:00.000Z" },
                        { rowId: "B-COOLED-2", publishedAt: "2026-05-13T18:00:00.000Z" },
                        { rowId: "B-COOLED-3", publishedAt: "2026-05-13T18:00:00.000Z" },
                    ],
                },
                written: [],
            };
            const rows = [
                { ...ROW_OPEN_NO_DEPS, id: "B-COOLED-1" },
                { ...ROW_OPEN_NO_DEPS, id: "B-COOLED-2" },
                { ...ROW_OPEN_NO_DEPS, id: "B-COOLED-3" },
                { ...ROW_OPEN_NO_DEPS, id: "B-ELIG-1" },
                { ...ROW_OPEN_NO_DEPS, id: "B-ELIG-2" },
                { ...ROW_OPEN_NO_DEPS, id: "B-ELIG-3" },
            ];
            // Poll at T+15min — cooldown 30min still active for COOLED-* rows.
            const adapters = fakeAdapters("2026-05-13T18:15:00.000Z", rows, captured, "", "", history);
            const result = pollOnce({ ...DEFAULT_CONFIG, maxAssignments: 3, cooldownMin: 30 }, adapters);
            expect(result.publishedEnvelopeIds).toHaveLength(3);
            expect(captured.map(c => c.rowId)).toEqual(["B-ELIG-1", "B-ELIG-2", "B-ELIG-3"]);
            expect(result.skippedDueToCooldown).toEqual(["B-COOLED-1", "B-COOLED-2", "B-COOLED-3"]);
        });
        test("readHistoryFile NOT called when noPublish: true (Copilot P1 #4449 — defer history IO)", () => {
            const captured = [];
            let readCount = 0;
            const baseAdapters = fakeAdapters("2026-05-13T18:00:00Z", [ROW_OPEN_NO_DEPS], captured);
            const adapters = {
                ...baseAdapters,
                readHistoryFile: (_path) => {
                    readCount += 1;
                    return null;
                },
            };
            const result = pollOnce({ ...DEFAULT_CONFIG, noPublish: true }, adapters);
            expect(result.publishedEnvelopeIds).toHaveLength(0);
            expect(readCount).toBe(0);
        });
        test("readHistoryFile NOT called when readyRows is empty (Copilot P1 #4449 — defer history IO)", () => {
            const captured = [];
            let readCount = 0;
            const baseAdapters = fakeAdapters("2026-05-13T18:00:00Z", [ROW_CLOSED], captured);
            const adapters = {
                ...baseAdapters,
                readHistoryFile: (_path) => {
                    readCount += 1;
                    return null;
                },
            };
            const result = pollOnce(DEFAULT_CONFIG, adapters);
            expect(result.readyRowsFound).toBe(0);
            expect(readCount).toBe(0);
        });
        test("read-merge-write preserves concurrent peer's history entry (Codex P1 #4449)", () => {
            const captured = [];
            // Initial read: empty (our snapshot says no prior history).
            // Pre-write read: peer wrote B-PEER between our two reads.
            // We're publishing B-OURS. Expect both B-PEER + B-OURS in the final write.
            const initialHistory = { entries: [] };
            const peerWroteBetween = {
                entries: [{ rowId: "B-PEER", publishedAt: "2026-05-13T17:55:00.000Z" }],
            };
            let readIdx = 0;
            const writtenHistory = [];
            const baseAdapters = fakeAdapters("2026-05-13T18:00:00.000Z", [{ ...ROW_OPEN_NO_DEPS, id: "B-OURS" }], captured);
            const adapters = {
                ...baseAdapters,
                readHistoryFile: () => {
                    // 1st read: initial (empty); 2nd read: just before write (peer added entry)
                    const result = readIdx === 0 ? initialHistory : peerWroteBetween;
                    readIdx += 1;
                    return result;
                },
                writeHistoryFile: (_path, h) => {
                    writtenHistory.push(h);
                },
            };
            const result = pollOnce({ ...DEFAULT_CONFIG, cooldownMin: 30 }, adapters);
            expect(result.publishedEnvelopeIds).toHaveLength(1);
            expect(captured[0].rowId).toBe("B-OURS");
            expect(writtenHistory).toHaveLength(1);
            const writtenIds = writtenHistory[0].entries.map(e => e.rowId).sort();
            expect(writtenIds).toEqual(["B-OURS", "B-PEER"]);
        });
    });
    describe("parseArgs", () => {
        test("default config when no args", () => {
            expect(parseArgs([])).toEqual(DEFAULT_CONFIG);
        });
        test("--once flag", () => {
            expect(parseArgs(["--once"]).once).toBe(true);
        });
        test("--poll-min + --backlog-dir set values", () => {
            const config = parseArgs(["--poll-min", "20", "--backlog-dir", "/custom"]);
            expect(config.pollIntervalMin).toBe(20);
            expect(config.backlogDir).toBe("/custom");
        });
        test("--no-publish + --agent + --to + --max-assignments + --target-agent", () => {
            const config = parseArgs([
                "--no-publish",
                "--agent", "vera",
                "--to", "lior",
                "--max-assignments", "5",
                "--target-agent", "riven",
            ]);
            expect(config.noPublish).toBe(true);
            expect(config.fromAgent).toBe("vera");
            expect(config.toAgent).toBe("lior");
            expect(config.maxAssignments).toBe(5);
            expect(config.targetAgent).toBe("riven");
        });
        test("rejects unknown flags", () => {
            expect(() => parseArgs(["--unknown"])).toThrow(/unknown flag/);
        });
        test("rejects --backlog-dir without value", () => {
            expect(() => parseArgs(["--backlog-dir"])).toThrow(/requires a value/);
        });
    });
});
