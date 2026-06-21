import { describe, expect, test } from "bun:test";
import { buildCoincidenceWindowTriggerSource, broadcastBlockerEventsFromJson, buildHealthReport, collectStandingQuerySignals, classifyClaimPathCollisions, classifyBranchLane, classifyCoincidenceWindows, classifyLaneRunway, classifyParallelRunway, codexLoopServiceHealthFromJson, classifyLocalWorktreeDirt, factoryTrajectoryFromPullRequestBranch, factoryTrajectoryFromTrajectoryPath, findClaimPathCollisions, findCoincidenceWindows, laneRunwayServiceHealthFromObservations, laneRunwaySnapshotFromObservations, localWorktreeDirtObservationFromStatus, loopRunReceiptEventsFromRunnerLog, mergedPullRequestEventsFromJson, pullRequestBlockerEventsFromJson, parseClaimPathSet, parseGitWorktreeListPorcelain, parseLocalWorktreeDirtScanLimit, resolveCodexLoopRunnerLog, runHealthCheck, summarizeCoincidenceWindows, trajectoryReceiptEventsFromGitLog, } from "./factory-health-monitor";
const HEALTH_CHECK_TIMEOUT_MS = 60_000;
let cachedReport;
function getReport() {
    cachedReport ??= runHealthCheck();
    return cachedReport;
}
function expectSignal(signals, expected) {
    expect(signals.some((signal) => signal.surface === expected.surface &&
        signal.level === expected.level &&
        signal.message === expected.message &&
        signal.action === expected.action)).toBe(true);
}
describe("factory-health-monitor", () => {
    test("findCoincidenceWindows detects cross-trajectory events inside a bounded window", () => {
        const firstEvent = {
            id: "a-1",
            trajectory: "autonomous-loop-coordination",
            occurredAt: "2026-05-30T05:00:00.000Z",
        };
        const secondEvent = {
            id: "b-1",
            trajectory: "factory-health",
            occurredAt: "2026-05-30T05:00:20.000Z",
        };
        const events = [
            firstEvent,
            secondEvent,
            {
                id: "c-1",
                trajectory: "late",
                occurredAt: "2026-05-30T05:05:00.000Z",
            },
        ];
        expect(findCoincidenceWindows(events, { windowMs: 30_000, minimumEvents: 2 })).toEqual([
            {
                windowStart: "2026-05-30T05:00:00.000Z",
                windowEnd: "2026-05-30T05:00:30.000Z",
                trajectories: ["autonomous-loop-coordination", "factory-health"],
                events: [firstEvent, secondEvent],
            },
        ]);
    });
    test("findCoincidenceWindows ignores same-trajectory clusters and invalid timestamps", () => {
        const events = [
            { id: "same-1", trajectory: "codex", occurredAt: "2026-05-30T05:00:00.000Z" },
            { id: "same-2", trajectory: "codex", occurredAt: "2026-05-30T05:00:10.000Z" },
            { id: "bad-1", trajectory: "otto", occurredAt: "not-a-date" },
        ];
        expect(findCoincidenceWindows(events, { windowMs: 30_000, minimumEvents: 2 })).toEqual([]);
    });
    test("findCoincidenceWindows deduplicates same-lifecycle events before classifying a window", () => {
        const mergedPr = {
            id: "merged-pr-6097",
            trajectory: "codex",
            occurredAt: "2026-05-30T05:00:00.000Z",
            correlationKey: "pr:6097",
        };
        const trajectoryReceipt = {
            id: "trajectory-receipt-6097",
            trajectory: "autonomous-loop-coordination",
            occurredAt: "2026-05-30T05:00:01.000Z",
            correlationKey: "pr:6097",
        };
        expect(findCoincidenceWindows([mergedPr, trajectoryReceipt], {
            windowMs: 30_000,
            minimumEvents: 2,
        })).toEqual([]);
        const independentEvent = {
            id: "otto-1",
            trajectory: "otto",
            occurredAt: "2026-05-30T05:00:02.000Z",
        };
        expect(findCoincidenceWindows([mergedPr, trajectoryReceipt, independentEvent], {
            windowMs: 30_000,
            minimumEvents: 2,
        })).toEqual([
            {
                windowStart: "2026-05-30T05:00:00.000Z",
                windowEnd: "2026-05-30T05:00:30.000Z",
                trajectories: ["codex", "otto"],
                events: [mergedPr, independentEvent],
            },
        ]);
    });
    test("findCoincidenceWindows deduplicates shared secondary correlation keys", () => {
        const firstBurstPr = {
            id: "merged-pr-6101",
            trajectory: "codex",
            occurredAt: "2026-05-30T05:00:00.000Z",
            correlationKey: "pr:6101",
            correlationKeys: ["merge-burst:2026-05-30T05:00:00.000Z:6101+6102"],
        };
        const secondBurstPr = {
            id: "merged-pr-6102",
            trajectory: "otto",
            occurredAt: "2026-05-30T05:00:20.000Z",
            correlationKey: "pr:6102",
            correlationKeys: ["merge-burst:2026-05-30T05:00:00.000Z:6101+6102"],
        };
        expect(findCoincidenceWindows([firstBurstPr, secondBurstPr], {
            windowMs: 30_000,
            minimumEvents: 2,
        })).toEqual([]);
        const independentEvent = {
            id: "riven-1",
            trajectory: "riven",
            occurredAt: "2026-05-30T05:00:25.000Z",
        };
        expect(findCoincidenceWindows([firstBurstPr, secondBurstPr, independentEvent], {
            windowMs: 30_000,
            minimumEvents: 2,
        })).toEqual([
            {
                windowStart: "2026-05-30T05:00:00.000Z",
                windowEnd: "2026-05-30T05:00:30.000Z",
                trajectories: ["codex", "riven"],
                events: [firstBurstPr, independentEvent],
            },
        ]);
    });
    test("findCoincidenceWindows keeps signatures overlap-aware across primary and secondary keys", () => {
        const mergedPr = {
            id: "merged-pr-6103",
            trajectory: "codex",
            occurredAt: "2026-05-30T05:00:00.000Z",
            correlationKey: "pr:6103",
            correlationKeys: ["merge-burst:2026-05-30T05:00:00.000Z:6103+6104"],
        };
        const independentEvent = {
            id: "otto-1",
            trajectory: "otto",
            occurredAt: "2026-05-30T05:00:01.000Z",
        };
        const secondBurstPr = {
            id: "merged-pr-6104",
            trajectory: "riven",
            occurredAt: "2026-05-30T05:00:20.000Z",
            correlationKey: "pr:6104",
            correlationKeys: ["merge-burst:2026-05-30T05:00:00.000Z:6103+6104", "pr:6103"],
        };
        const trajectoryReceipt = {
            id: "trajectory-receipt-6103",
            trajectory: "autonomous-loop-coordination",
            occurredAt: "2026-05-30T05:00:21.000Z",
            correlationKey: "pr:6103",
        };
        expect(findCoincidenceWindows([mergedPr, independentEvent, secondBurstPr, trajectoryReceipt], {
            windowMs: 30_000,
            minimumEvents: 2,
        })).toEqual([
            {
                windowStart: "2026-05-30T05:00:00.000Z",
                windowEnd: "2026-05-30T05:00:30.000Z",
                trajectories: ["codex", "otto"],
                events: [mergedPr, independentEvent],
            },
        ]);
    });
    test("classifyCoincidenceWindows emits ok and warning signals", () => {
        expect(classifyCoincidenceWindows([], { windowMs: 30_000, minimumEvents: 2 })).toEqual([
            {
                surface: "coincidence",
                level: "ok",
                message: "No event-window coincidences detected",
            },
        ]);
        expect(classifyCoincidenceWindows([
            { id: "codex-1", trajectory: "codex", occurredAt: "2026-05-30T05:00:00.000Z" },
            { id: "otto-1", trajectory: "otto", occurredAt: "2026-05-30T05:00:05.000Z" },
        ], { windowMs: 30_000, minimumEvents: 2 })).toEqual([
            {
                surface: "coincidence",
                level: "warning",
                message: "1 event-window coincidence(s) detected",
                action: "inspect shared upstream cause for coincident trajectory events",
            },
            {
                surface: "coincidence-debug",
                level: "warning",
                message: "Top coincidence windows: 2026-05-30T05:00:00.000Z..2026-05-30T05:00:30.000Z trajectories=codex+otto events=codex:codex-1,otto:otto-1",
                action: "inspect listed coincidence event ids before adding another source",
            },
        ]);
    });
    test("classifyCoincidenceWindows keeps pure merged PR adjacency warning-grade", () => {
        expect(classifyCoincidenceWindows([
            { id: "merged-pr-20", trajectory: "codex", occurredAt: "2026-05-30T05:00:00.000Z" },
            { id: "merged-pr-21", trajectory: "otto", occurredAt: "2026-05-30T05:00:05.000Z" },
        ], { windowMs: 30_000, minimumEvents: 2 })).toEqual([
            {
                surface: "coincidence",
                level: "warning",
                message: "1 event-window coincidence(s) detected",
                action: "inspect shared upstream cause for coincident trajectory events",
            },
            {
                surface: "coincidence-debug",
                level: "warning",
                message: "Top coincidence windows: 2026-05-30T05:00:00.000Z..2026-05-30T05:00:30.000Z trajectories=codex+otto events=codex:merged-pr-20,otto:merged-pr-21",
                action: "inspect listed coincidence event ids before adding another source",
            },
        ]);
    });
    test("classifyCoincidenceWindows escalates when a stronger source joins", () => {
        expect(classifyCoincidenceWindows([
            { id: "merged-pr-20", trajectory: "otto", occurredAt: "2026-05-30T05:00:00.000Z" },
            { id: "loop-run-20260530T050100Z", trajectory: "codex", occurredAt: "2026-05-30T05:00:05.000Z" },
        ], { windowMs: 30_000, minimumEvents: 2 })).toEqual([
            {
                surface: "coincidence-incident",
                level: "critical",
                message: "1 incident-grade coincidence window(s) detected",
                action: "investigate stronger-source coincidence before treating it as queue-drain noise",
            },
            {
                surface: "coincidence-incident-debug",
                level: "warning",
                message: "Incident-grade windows: 2026-05-30T05:00:00.000Z..2026-05-30T05:00:30.000Z trajectories=codex+otto events=otto:merged-pr-20,codex:loop-run-20260530T050100Z",
                action: "inspect listed stronger-source event ids before escalating response",
            },
            {
                surface: "coincidence",
                level: "warning",
                message: "1 event-window coincidence(s) detected",
                action: "inspect shared upstream cause for coincident trajectory events",
            },
            {
                surface: "coincidence-debug",
                level: "warning",
                message: "Top coincidence windows: 2026-05-30T05:00:00.000Z..2026-05-30T05:00:30.000Z trajectories=codex+otto events=otto:merged-pr-20,codex:loop-run-20260530T050100Z",
                action: "inspect listed coincidence event ids before adding another source",
            },
        ]);
    });
    test("summarizeCoincidenceWindows emits capped compact debug lines", () => {
        const windows = findCoincidenceWindows([
            { id: "codex-1", trajectory: "codex", occurredAt: "2026-05-30T05:00:00.000Z" },
            { id: "otto-1", trajectory: "otto", occurredAt: "2026-05-30T05:00:01.000Z" },
            { id: "riven-1", trajectory: "riven", occurredAt: "2026-05-30T05:00:02.000Z" },
        ], { windowMs: 30_000, minimumEvents: 2 });
        expect(summarizeCoincidenceWindows(windows, {
            maxEventsPerWindow: 2,
            maxTrajectoriesPerWindow: 2,
            maxWindows: 1,
        })).toEqual([
            "2026-05-30T05:00:00.000Z..2026-05-30T05:00:30.000Z trajectories=codex+otto,+1 more events=codex:codex-1,otto:otto-1,+1 more",
        ]);
    });
    test("buildCoincidenceWindowTriggerSource exposes coincidence as a standing-query source", () => {
        const source = buildCoincidenceWindowTriggerSource([
            { id: "codex-1", trajectory: "codex", occurredAt: "2026-05-30T05:00:00.000Z" },
            { id: "riven-1", trajectory: "riven", occurredAt: "2026-05-30T05:00:01.000Z" },
        ], { windowMs: 5_000, minimumEvents: 2 });
        expect(source.surface).toBe("coincidence");
        expect(source.failureAction).toBe("inspect event-window source before trusting coincidence signals");
        expect(source.collect()).toEqual([
            {
                surface: "coincidence",
                level: "warning",
                message: "1 event-window coincidence(s) detected",
                action: "inspect shared upstream cause for coincident trajectory events",
            },
            {
                surface: "coincidence-debug",
                level: "warning",
                message: "Top coincidence windows: 2026-05-30T05:00:00.000Z..2026-05-30T05:00:05.000Z trajectories=codex+riven events=codex:codex-1,riven:riven-1",
                action: "inspect listed coincidence event ids before adding another source",
            },
        ]);
    });
    test("factoryTrajectoryFromPullRequestBranch maps branches to factory trajectories", () => {
        expect(factoryTrajectoryFromPullRequestBranch("claim/codex-loop-20260530")).toBe("codex");
        expect(factoryTrajectoryFromPullRequestBranch("otto-cli/event-source")).toBe("otto");
        expect(factoryTrajectoryFromPullRequestBranch("feat/unowned-draft")).toBe("other:feat/unowned-draft");
        expect(factoryTrajectoryFromPullRequestBranch(null)).toBe("other:unknown");
    });
    test("mergedPullRequestEventsFromJson builds bounded factory events from merged PRs", () => {
        expect(mergedPullRequestEventsFromJson(JSON.stringify([
            {
                number: 10,
                title: "Codex source",
                mergedAt: "2026-05-30T05:00:00Z",
                headRefName: "claim/codex-source",
            },
            {
                number: 11,
                title: "Otto source",
                mergedAt: "2026-05-30T05:03:00Z",
                headRefName: "otto-cli/source",
            },
            {
                number: 12,
                title: "Stale source",
                mergedAt: "2026-05-28T05:00:00Z",
                headRefName: "lior-source",
            },
            {
                number: 13,
                title: "Open source",
                mergedAt: null,
                headRefName: "riven-source",
            },
            {
                number: 14,
                title: "Bad time",
                mergedAt: "not-a-date",
                headRefName: "kiro/source",
            },
        ]), "2026-05-30T06:00:00Z", 2 * 60 * 60 * 1000)).toEqual([
            {
                id: "merged-pr-10",
                trajectory: "codex",
                occurredAt: "2026-05-30T05:00:00.000Z",
                description: "#10 Codex source",
                correlationKey: "pr:10",
            },
            {
                id: "merged-pr-11",
                trajectory: "otto",
                occurredAt: "2026-05-30T05:03:00.000Z",
                description: "#11 Otto source",
                correlationKey: "pr:11",
            },
        ]);
    });
    test("mergedPullRequestEventsFromJson falls back to commit author labels for unowned PR branches", () => {
        expect(mergedPullRequestEventsFromJson(JSON.stringify([
            {
                number: 15,
                title: "Unknown branch with Otto attribution",
                mergedAt: "2026-05-30T05:00:00Z",
                headRefName: "backlog/b-0347-carve-skills",
                mergeCommit: { oid: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
            },
            {
                number: 16,
                title: "Known branch keeps branch lane",
                mergedAt: "2026-05-30T05:10:00Z",
                headRefName: "claim/codex-source",
                mergeCommit: { oid: " cccccccccccccccccccccccccccccccccccccccc " },
            },
            {
                number: 17,
                title: "Ambiguous unknown branch stays other",
                mergedAt: "2026-05-30T05:20:00Z",
                headRefName: "research/mixed-source",
                mergeCommit: { oid: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
            },
            {
                number: 18,
                title: "Subject mention is not attribution",
                mergedAt: "2026-05-30T05:30:00Z",
                headRefName: "research/codex-notes",
                mergeCommit: { oid: "dddddddddddddddddddddddddddddddddddddddd" },
            },
        ]), "2026-05-30T06:00:00Z", 2 * 60 * 60 * 1000, new Map([
            [
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "docs(081KR50HA0008QG0R002ZNFQBZ): carve skill descriptions\n\nCo-authored-by: Otto-CLI (Claude) <noreply@anthropic.com>",
            ],
            [
                "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "research: mixed source\n\nCo-authored-by: Lior <lior@zeta.dev>\nCo-authored-by: Claude <noreply@anthropic.com>",
            ],
            ["cccccccccccccccccccccccccccccccccccccccc", "docs: known branch\n\nCo-Authored-By: Lior <lior@zeta.dev>"],
            ["dddddddddddddddddddddddddddddddddddddddd", "feat: add codex skill notes\n\nNo author trailer here."],
        ]))).toEqual([
            {
                id: "merged-pr-15",
                trajectory: "otto",
                occurredAt: "2026-05-30T05:00:00.000Z",
                description: "#15 Unknown branch with Otto attribution",
                correlationKey: "pr:15",
            },
            {
                id: "merged-pr-16",
                trajectory: "codex",
                occurredAt: "2026-05-30T05:10:00.000Z",
                description: "#16 Known branch keeps branch lane",
                correlationKey: "pr:16",
            },
            {
                id: "merged-pr-17",
                trajectory: "other:research/mixed-source",
                occurredAt: "2026-05-30T05:20:00.000Z",
                description: "#17 Ambiguous unknown branch stays other",
                correlationKey: "pr:17",
            },
            {
                id: "merged-pr-18",
                trajectory: "other:research/codex-notes",
                occurredAt: "2026-05-30T05:30:00.000Z",
                description: "#18 Subject mention is not attribution",
                correlationKey: "pr:18",
            },
        ]);
    });
    test("mergedPullRequestEventsFromJson marks tightly clustered merged PRs as one burst", () => {
        expect(mergedPullRequestEventsFromJson(JSON.stringify([
            {
                number: 20,
                title: "First burst PR",
                mergedAt: "2026-05-30T05:00:00Z",
                headRefName: "claim/codex-first",
            },
            {
                number: 21,
                title: "Second burst PR",
                mergedAt: "2026-05-30T05:00:20Z",
                headRefName: "otto-cli/second",
            },
            {
                number: 22,
                title: "Later PR",
                mergedAt: "2026-05-30T05:05:00Z",
                headRefName: "riven-later",
            },
        ]), "2026-05-30T06:00:00Z", 2 * 60 * 60 * 1000)).toEqual([
            {
                id: "merged-pr-20",
                trajectory: "codex",
                occurredAt: "2026-05-30T05:00:00.000Z",
                description: "#20 First burst PR",
                correlationKey: "pr:20",
                correlationKeys: ["merge-burst:2026-05-30T05:00:00.000Z:20+21", "pr:21"],
            },
            {
                id: "merged-pr-21",
                trajectory: "otto",
                occurredAt: "2026-05-30T05:00:20.000Z",
                description: "#21 Second burst PR",
                correlationKey: "pr:21",
                correlationKeys: ["merge-burst:2026-05-30T05:00:00.000Z:20+21", "pr:20"],
            },
            {
                id: "merged-pr-22",
                trajectory: "riven",
                occurredAt: "2026-05-30T05:05:00.000Z",
                description: "#22 Later PR",
                correlationKey: "pr:22",
            },
        ]);
    });
    test("factoryTrajectoryFromTrajectoryPath maps trajectory receipt paths", () => {
        expect(factoryTrajectoryFromTrajectoryPath("docs/trajectories/autonomous-loop-coordination/RESUME.md")).toBe("autonomous-loop-coordination");
        expect(factoryTrajectoryFromTrajectoryPath("./docs/trajectories/factory-trajectory-surface/receipt.md")).toBe("factory-trajectory-surface");
        expect(factoryTrajectoryFromTrajectoryPath("docs/not-trajectories/example.md")).toBeNull();
        expect(factoryTrajectoryFromTrajectoryPath(null)).toBeNull();
    });
    test("trajectoryReceiptEventsFromGitLog builds bounded factory events from trajectory commits", () => {
        const output = [
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\t2026-05-30T05:00:00+00:00\tland two receipts (#6097)",
            "docs/trajectories/autonomous-loop-coordination/RESUME.md",
            "docs/trajectories/factory-trajectory-surface/receipt.md",
            "docs/trajectories/factory-trajectory-surface/RESUME.md",
            "",
            "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\t2026-05-30T05:10:00+00:00\tland receipt without PR marker",
            "docs/trajectories/autonomous-loop-coordination/followup.md",
            "",
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\t2026-05-28T05:00:00+00:00\tstale receipt",
            "docs/trajectories/stale/RESUME.md",
            "",
            "cccccccccccccccccccccccccccccccccccccccc\tnot-a-date\tbad receipt",
            "docs/trajectories/bad/RESUME.md",
            "",
            "dddddddddddddddddddddddddddddddddddddddd\t2026-05-30T05:02:00+00:00\toutside path",
            "docs/not-trajectories/example.md",
        ].join("\n");
        expect(trajectoryReceiptEventsFromGitLog(output, "2026-05-30T06:00:00Z", 2 * 60 * 60 * 1000)).toEqual([
            {
                id: "trajectory-receipt-aaaaaaaaaaaa-autonomous-loop-coordination",
                trajectory: "autonomous-loop-coordination",
                occurredAt: "2026-05-30T05:00:00.000Z",
                description: "aaaaaaaaaaaa land two receipts (#6097)",
                correlationKey: "pr:6097",
            },
            {
                id: "trajectory-receipt-aaaaaaaaaaaa-factory-trajectory-surface",
                trajectory: "factory-trajectory-surface",
                occurredAt: "2026-05-30T05:00:00.000Z",
                description: "aaaaaaaaaaaa land two receipts (#6097)",
                correlationKey: "pr:6097",
            },
            {
                id: "trajectory-receipt-eeeeeeeeeeee-autonomous-loop-coordination",
                trajectory: "autonomous-loop-coordination",
                occurredAt: "2026-05-30T05:10:00.000Z",
                description: "eeeeeeeeeeee land receipt without PR marker",
            },
        ]);
    });
    test("loopRunReceiptEventsFromRunnerLog gates Codex loop-run events on claim count increases", () => {
        const output = [
            "2026-05-30T05:00:00Z heartbeat complete run_id=20260530T050000Z fetch=ok claims=1 open_prs=0 dirty=0 codex=wait due_in=60s",
            "2026-05-30T05:01:00Z codex forward gate start run_id=20260530T050100Z timeout=180s",
            "2026-05-30T05:04:00Z codex forward gate end run_id=20260530T050100Z status=0",
            "2026-05-30T05:05:00Z heartbeat complete run_id=20260530T050500Z fetch=ok claims=2 open_prs=0 dirty=0 codex=wait due_in=60s",
            "2026-05-30T05:10:00Z heartbeat complete run_id=20260530T051000Z fetch=ok claims=2 open_prs=0 dirty=0 codex=wait due_in=60s",
            "2026-05-30T05:11:00Z codex forward gate end run_id=no-delta status=0",
            "2026-05-30T05:12:00Z heartbeat complete run_id=20260530T051200Z fetch=ok claims=2 open_prs=0 dirty=0 codex=wait due_in=60s",
            "2026-05-30T05:20:00Z heartbeat complete run_id=20260530T052000Z fetch=ok claims=2 open_prs=0 dirty=0 codex=wait due_in=60s",
            "2026-05-30T05:21:00Z codex forward gate end run_id=open-pr-only-delta status=0",
            "2026-05-30T05:22:00Z heartbeat complete run_id=20260530T052200Z fetch=ok claims=2 open_prs=2 dirty=0 codex=wait due_in=60s",
            "2026-05-30T05:30:00Z heartbeat complete run_id=20260530T053000Z fetch=ok claims=2 open_prs=0 dirty=0 codex=wait due_in=60s",
            "2026-05-30T05:31:00Z codex forward gate end run_id=claim-decrease status=0",
            "2026-05-30T05:32:00Z heartbeat complete run_id=20260530T053200Z fetch=ok claims=1 open_prs=0 dirty=0 codex=wait due_in=60s",
            "2026-05-28T05:04:00Z codex forward gate end run_id=stale status=0",
            "2026-05-30T08:04:00Z codex forward gate end run_id=future status=0",
            "not-a-date codex forward gate end run_id=bad status=0",
        ].join("\n");
        expect(loopRunReceiptEventsFromRunnerLog(output, "2026-05-30T05:06:00Z", 2 * 60 * 60 * 1000)).toEqual([
            {
                id: "loop-run-20260530T050100Z",
                trajectory: "codex",
                occurredAt: "2026-05-30T05:05:00.000Z",
                description: "codex forward gate 20260530T050100Z status=0 claims 1->2 open_prs 0->0",
                source: "loop-run",
            },
        ]);
    });
    test("loopRunReceiptEventsFromRunnerLog demotes old completed claim increases to lifecycle residue", () => {
        const output = [
            "2026-05-30T05:00:00Z heartbeat complete run_id=20260530T050000Z fetch=ok claims=1 open_prs=0 dirty=0 codex=wait due_in=60s",
            "2026-05-30T05:04:00Z codex forward gate end run_id=20260530T050100Z status=0",
            "2026-05-30T05:05:00Z heartbeat complete run_id=20260530T050500Z fetch=ok claims=2 open_prs=0 dirty=0 codex=wait due_in=60s",
        ].join("\n");
        const [event] = loopRunReceiptEventsFromRunnerLog(output, "2026-05-30T06:00:00Z", 2 * 60 * 60 * 1000);
        expect(event).toEqual({
            id: "loop-run-20260530T050100Z",
            trajectory: "codex",
            occurredAt: "2026-05-30T05:05:00.000Z",
            description: "codex forward gate 20260530T050100Z status=0 claims 1->2 open_prs 0->0 lifecycle-residue",
            source: "unknown",
        });
        expect(classifyCoincidenceWindows([
            { id: "merged-pr-20", trajectory: "otto", occurredAt: "2026-05-30T05:05:05.000Z" },
            event,
        ], { windowMs: 30_000, minimumEvents: 2 })).toEqual([
            {
                surface: "coincidence",
                level: "warning",
                message: "1 event-window coincidence(s) detected",
                action: "inspect shared upstream cause for coincident trajectory events",
            },
            {
                surface: "coincidence-debug",
                level: "warning",
                message: "Top coincidence windows: 2026-05-30T05:05:00.000Z..2026-05-30T05:05:30.000Z trajectories=codex+otto events=codex:loop-run-20260530T050100Z,otto:merged-pr-20",
                action: "inspect listed coincidence event ids before adding another source",
            },
        ]);
    });
    test("loopRunReceiptEventsFromRunnerLog uses the after heartbeat for freshness and event time", () => {
        const output = [
            "2026-05-30T05:00:00Z heartbeat complete run_id=20260530T050000Z fetch=ok claims=1 open_prs=0 dirty=0 codex=wait due_in=60s",
            "2026-05-30T05:04:00Z codex forward gate end run_id=delayed-claim-snapshot status=0",
            "2026-05-30T05:50:00Z heartbeat complete run_id=20260530T055000Z fetch=ok claims=2 open_prs=0 dirty=0 codex=wait due_in=60s",
        ].join("\n");
        expect(loopRunReceiptEventsFromRunnerLog(output, "2026-05-30T05:51:00Z", 2 * 60 * 60 * 1000)).toEqual([
            {
                id: "loop-run-delayed-claim-snapshot",
                trajectory: "codex",
                occurredAt: "2026-05-30T05:50:00.000Z",
                description: "codex forward gate delayed-claim-snapshot status=0 claims 1->2 open_prs 0->0",
                source: "loop-run",
            },
        ]);
    });
    test("loopRunReceiptEventsFromRunnerLog is conservative when observation time is unsafe", () => {
        const output = [
            "2026-05-30T05:00:00Z heartbeat complete run_id=20260530T050000Z fetch=ok claims=1 open_prs=0 dirty=0 codex=wait due_in=60s",
            "2026-05-30T05:04:00Z codex forward gate end run_id=invalid-now status=0",
            "2026-05-30T05:05:00Z heartbeat complete run_id=20260530T050500Z fetch=ok claims=2 open_prs=0 dirty=0 codex=wait due_in=60s",
        ].join("\n");
        expect(loopRunReceiptEventsFromRunnerLog(output, "not-a-date", 2 * 60 * 60 * 1000)).toEqual([
            {
                id: "loop-run-invalid-now",
                trajectory: "codex",
                occurredAt: "2026-05-30T05:05:00.000Z",
                description: "codex forward gate invalid-now status=0 claims 1->2 open_prs 0->0 lifecycle-residue",
                source: "unknown",
            },
        ]);
    });
    test("loopRunReceiptEventsFromRunnerLog ignores out-of-window after heartbeats", () => {
        const output = [
            "2026-05-30T05:00:00Z heartbeat complete run_id=20260530T050000Z fetch=ok claims=1 open_prs=0 dirty=0 codex=wait due_in=60s",
            "2026-05-30T05:04:00Z codex forward gate end run_id=future-after status=0",
            "2026-05-30T08:00:00Z heartbeat complete run_id=20260530T080000Z fetch=ok claims=2 open_prs=0 dirty=0 codex=wait due_in=60s",
        ].join("\n");
        expect(loopRunReceiptEventsFromRunnerLog(output, "2026-05-30T05:06:00Z", 2 * 60 * 60 * 1000)).toEqual([]);
    });
    test("broadcastBlockerEventsFromJson only converts fresh explicit blocker records", () => {
        expect(broadcastBlockerEventsFromJson(JSON.stringify([
            {
                id: "env-1",
                from: "otto-cli",
                to: "*",
                topic: "shadow-catch",
                timestamp: "2026-05-30T05:00:00Z",
                expiresAt: "2026-05-30T07:00:00Z",
                payload: {
                    blockers: [
                        {
                            id: "review-thread",
                            trajectory: "otto",
                            observedAt: "2026-05-30T05:00:10Z",
                            description: "Review thread blocks PR #50",
                            correlationKey: "pr:50",
                            correlationKeys: ["thread:abc123"],
                        },
                        {
                            id: "missing-trajectory",
                            observedAt: "2026-05-30T05:00:20Z",
                            description: "No trajectory means no event",
                        },
                    ],
                },
            },
            {
                id: "env-2",
                from: "riven-cli",
                topic: "shadow-catch",
                timestamp: "2026-05-30T05:01:00Z",
                expiresAt: "2026-05-30T05:59:00Z",
                payload: {
                    blockers: [
                        {
                            id: "expired",
                            trajectory: "riven",
                            description: "Expired envelope should not count",
                        },
                    ],
                },
            },
            {
                id: "env-3",
                from: "lior-gemini",
                topic: "shadow-catch",
                timestamp: "2026-05-30T05:02:00Z",
                expiresAt: "2026-05-30T07:00:00Z",
                payload: {
                    content: "Markdown-ish blocker text is coordination input, not a structured event.",
                },
            },
            {
                id: "env-4",
                from: "vera-codex",
                topic: "shadow-catch",
                timestamp: "2026-05-28T05:02:00Z",
                expiresAt: "2026-05-30T07:00:00Z",
                payload: {
                    blocker: {
                        id: "stale",
                        trajectory: "codex",
                        description: "Stale blocker should not count",
                    },
                },
            },
            {
                id: "env-private",
                from: "otto-cli",
                to: "vera",
                topic: "shadow-catch",
                timestamp: "2026-05-30T05:03:00Z",
                expiresAt: "2026-05-30T07:00:00Z",
                payload: {
                    blocker: {
                        id: "private",
                        trajectory: "otto",
                        description: "Private blocker should not count",
                    },
                },
            },
            {
                id: "env-bad-expiry",
                from: "otto-cli",
                to: "*",
                topic: "shadow-catch",
                timestamp: "2026-05-30T05:03:00Z",
                expiresAt: "not-a-date",
                payload: {
                    blocker: {
                        id: "bad-expiry",
                        trajectory: "otto",
                        description: "Malformed expiry should not count",
                    },
                },
            },
        ]), "2026-05-30T06:00:00Z", 2 * 60 * 60 * 1000)).toEqual([
            {
                id: "broadcast-blocker-env-1-review-thread",
                trajectory: "otto",
                occurredAt: "2026-05-30T05:00:10.000Z",
                description: "Review thread blocks PR #50",
                correlationKey: "pr:50",
                correlationKeys: ["thread:abc123"],
                source: "broadcast-blocker",
            },
        ]);
    });
    test("classifyCoincidenceWindows escalates when explicit broadcast blockers join ordinary merge events", () => {
        expect(classifyCoincidenceWindows([
            {
                id: "merged-pr-50",
                trajectory: "otto",
                occurredAt: "2026-05-30T05:00:00.000Z",
                source: "merged-pr",
            },
            {
                id: "broadcast-blocker-env-1-review-thread",
                trajectory: "codex",
                occurredAt: "2026-05-30T05:00:10.000Z",
                source: "broadcast-blocker",
            },
        ], { windowMs: 30_000, minimumEvents: 2 })[0]).toEqual({
            surface: "coincidence-incident",
            level: "critical",
            message: "1 incident-grade coincidence window(s) detected",
            action: "investigate stronger-source coincidence before treating it as queue-drain noise",
        });
    });
    test("pullRequestBlockerEventsFromJson builds review and failed-gate stronger-source events", () => {
        expect(pullRequestBlockerEventsFromJson(JSON.stringify([
            {
                number: 31,
                title: "Review blocked",
                createdAt: "2026-05-30T04:00:00Z",
                updatedAt: "2026-05-30T05:00:00Z",
                headRefName: "otto/review-blocked",
                reviewDecision: "CHANGES_REQUESTED",
                statusCheckRollup: [
                    { name: "lint (markdownlint)", workflowName: "gate", status: "COMPLETED", conclusion: "SUCCESS" },
                ],
            },
            {
                number: 32,
                title: "Gate blocked",
                createdAt: "2026-05-30T04:01:00Z",
                updatedAt: "2026-05-30T05:01:00Z",
                headRefName: "claim/codex-gate-blocked",
                reviewDecision: "APPROVED",
                statusCheckRollup: [
                    { name: "lint (markdownlint)", workflowName: "gate", status: "COMPLETED", conclusion: "FAILURE" },
                    { name: "build", workflowName: "gate", status: "COMPLETED", conclusion: "TIMED_OUT" },
                    { name: "queued", workflowName: "gate", status: "QUEUED", conclusion: "" },
                ],
            },
            {
                number: 33,
                title: "Still running",
                createdAt: "2026-05-30T04:02:00Z",
                updatedAt: "2026-05-30T05:02:00Z",
                headRefName: "riven/running",
                reviewDecision: "",
                statusCheckRollup: [{ name: "lint", workflowName: "gate", status: "IN_PROGRESS", conclusion: "" }],
            },
            {
                number: 34,
                title: "Stale blocked",
                createdAt: "2026-05-28T04:00:00Z",
                updatedAt: "2026-05-28T05:00:00Z",
                headRefName: "lior/stale",
                reviewDecision: "CHANGES_REQUESTED",
            },
        ]), "2026-05-30T06:00:00Z", 2 * 60 * 60 * 1000)).toEqual([
            {
                id: "pr-review-blocker-31",
                trajectory: "otto",
                occurredAt: "2026-05-30T05:00:00.000Z",
                description: "#31 Review blocked has requested changes",
                correlationKey: "pr:31",
                source: "pr-review-blocker",
            },
            {
                id: "failed-gate-32",
                trajectory: "codex",
                occurredAt: "2026-05-30T05:01:00.000Z",
                description: "#32 Gate blocked failed gates: gate/build, gate/lint (markdownlint)",
                correlationKey: "pr:32",
                source: "failed-gate",
            },
        ]);
    });
    test("pullRequestBlockerEventsFromJson follows required-check gate semantics", () => {
        expect(pullRequestBlockerEventsFromJson(JSON.stringify([
            {
                number: 35,
                title: "Diagnostic only failure",
                createdAt: "2026-05-30T04:00:00Z",
                updatedAt: "2026-05-30T05:00:00Z",
                headRefName: "claim/codex-diagnostic-only",
                requiredCheckNames: ["required-build"],
                statusCheckRollup: [
                    { name: "diagnostic", workflowName: "gate", status: "COMPLETED", conclusion: "FAILURE" },
                    { name: "required-build", workflowName: "gate", status: "COMPLETED", conclusion: "SUCCESS" },
                ],
            },
            {
                number: 36,
                title: "Required failures",
                createdAt: "2026-05-30T04:01:00Z",
                updatedAt: "2026-05-30T05:01:00Z",
                headRefName: "claim/codex-required-failures",
                requiredCheckNames: ["cancelled", "error-state", "stale", "startup"],
                statusCheckRollup: [
                    { name: "diagnostic", workflowName: "gate", status: "COMPLETED", conclusion: "FAILURE" },
                    { name: "cancelled", workflowName: "gate", status: "COMPLETED", conclusion: "CANCELLED" },
                    { name: "error-state", workflowName: "gate", state: "ERROR", status: "COMPLETED", conclusion: "" },
                    { name: "stale", workflowName: "gate", status: "COMPLETED", conclusion: "STALE" },
                    { name: "startup", workflowName: "gate", status: "COMPLETED", conclusion: "STARTUP_FAILURE" },
                ],
            },
        ]), "2026-05-30T06:00:00Z", 2 * 60 * 60 * 1000)).toEqual([
            {
                id: "failed-gate-36",
                trajectory: "codex",
                occurredAt: "2026-05-30T05:01:00.000Z",
                description: "#36 Required failures failed gates: gate/cancelled, gate/error-state, gate/stale, +1 more",
                correlationKey: "pr:36",
                source: "failed-gate",
            },
        ]);
    });
    test("classifyCoincidenceWindows escalates when PR blockers join ordinary merge events", () => {
        expect(classifyCoincidenceWindows([
            {
                id: "merged-pr-40",
                trajectory: "otto",
                occurredAt: "2026-05-30T05:00:00.000Z",
                source: "merged-pr",
            },
            {
                id: "failed-gate-41",
                trajectory: "codex",
                occurredAt: "2026-05-30T05:00:10.000Z",
                source: "failed-gate",
            },
        ], { windowMs: 30_000, minimumEvents: 2 })[0]).toEqual({
            surface: "coincidence-incident",
            level: "critical",
            message: "1 incident-grade coincidence window(s) detected",
            action: "investigate stronger-source coincidence before treating it as queue-drain noise",
        });
    });
    test("resolveCodexLoopRunnerLog honors writer log-dir override and explicit override", () => {
        // 1. Explicit monitor override wins (even when other vars are set).
        expect(resolveCodexLoopRunnerLog({
            FACTORY_HEALTH_CODEX_LOOP_RUNNER_LOG: "/custom/runner.log",
            ZETA_CODEX_LOOP_LOG_DIR: "/elsewhere",
            HOME: "/Users/acehack",
        })).toBe("/custom/runner.log");
        // 2. Writer log-dir override is mirrored (the bug this test guards).
        expect(resolveCodexLoopRunnerLog({ ZETA_CODEX_LOOP_LOG_DIR: "/var/log/zeta", HOME: "/Users/acehack" })).toBe("/var/log/zeta/runner.log");
        // 3. Default to the writer's HOME-relative location.
        expect(resolveCodexLoopRunnerLog({ HOME: "/Users/acehack" })).toBe("/Users/acehack/Library/Logs/zeta-codex-loop/runner.log");
        // 4. No HOME and no override → source absent ("").
        expect(resolveCodexLoopRunnerLog({})).toBe("");
        // 5. Explicit empty override stays empty (caller opted the source off).
        expect(resolveCodexLoopRunnerLog({ FACTORY_HEALTH_CODEX_LOOP_RUNNER_LOG: "", HOME: "/Users/acehack" })).toBe("");
    });
    test("classifyBranchLane maps known branch prefixes to lanes", () => {
        expect(classifyBranchLane("codex/health-fix")).toBe("codex");
        expect(classifyBranchLane("origin/claim/codex-loop-20260529")).toBe("codex");
        expect(classifyBranchLane("otto-cli/b0355-bootstrap")).toBe("otto");
        expect(classifyBranchLane("otto-bg-worker/tick-shard")).toBe("otto");
        expect(classifyBranchLane("lior-pr-cleanup")).toBe("lior");
        expect(classifyBranchLane("kiro/bootstrap")).toBe("alexa");
        expect(classifyBranchLane("claim/kiro-background-service")).toBe("alexa");
        expect(classifyBranchLane("riven-loop-health")).toBe("riven");
        expect(classifyBranchLane("chore/unowned-work")).toBe("other");
    });
    test("parseClaimPathSet accepts initial and planned path-set headings", () => {
        expect(parseClaimPathSet([
            "# Claim",
            "",
            "Initial intended path set:",
            "",
            "- `tools/health/factory-health-monitor.ts`",
            "- ./docs/trajectory.md",
        ].join("\n"))).toEqual(["docs/trajectory.md", "tools/health/factory-health-monitor.ts"]);
        expect(parseClaimPathSet([
            "# Claim",
            "",
            "Planned path set:",
            "",
            "- `tools/health/factory-health-monitor.test.ts`",
            "",
            "## Notes",
            "- `ignored-after-heading.md`",
        ].join("\n"))).toEqual(["tools/health/factory-health-monitor.test.ts"]);
    });
    test("parseClaimPathSet falls back to durable target paths", () => {
        expect(parseClaimPathSet([
            "# Claim",
            "",
            "- **Durable target:** `tools/health/factory-health-monitor.ts`, docs/claims/example.md, https://example.invalid, `claim/not-a-path-branch`",
        ].join("\n"))).toEqual(["docs/claims/example.md", "tools/health/factory-health-monitor.ts"]);
        expect(parseClaimPathSet(["# Claim", "", "- **Durable target:** PR from `claim/codex-loop-branch-only`"].join("\n"))).toEqual([]);
    });
    test("findClaimPathCollisions detects exact and glob ownership overlap", () => {
        expect(findClaimPathCollisions([
            { claimBranch: "origin/claim/codex-health", paths: ["tools/health/**"] },
            {
                claimBranch: "claim/otto-health-test",
                paths: ["tools/health/factory-health-monitor.ts"],
            },
            { claimBranch: "claim/lior-doc", paths: ["docs/only.md"] },
        ])).toEqual([
            {
                path: "tools/health/** overlaps tools/health/factory-health-monitor.ts",
                claimBranches: ["claim/codex-health", "claim/otto-health-test"],
            },
        ]);
    });
    test("findClaimPathCollisions canonicalizes overlap messages", () => {
        const forward = findClaimPathCollisions([
            { claimBranch: "claim/a", paths: ["tools/health/**"] },
            { claimBranch: "claim/b", paths: ["tools/health/file.ts"] },
        ]);
        const reversed = findClaimPathCollisions([
            { claimBranch: "claim/b", paths: ["tools/health/file.ts"] },
            { claimBranch: "claim/a", paths: ["tools/health/**"] },
        ]);
        expect(forward).toEqual(reversed);
        expect(forward[0]?.path).toBe("tools/health/** overlaps tools/health/file.ts");
    });
    test("classifyClaimPathCollisions emits lane-runway warnings only for collisions", () => {
        expect(classifyClaimPathCollisions([
            { claimBranch: "claim/a", paths: ["docs/a.md"] },
            { claimBranch: "claim/b", paths: ["docs/b.md"] },
        ])).toEqual([]);
        expect(classifyClaimPathCollisions([
            { claimBranch: "claim/a", paths: ["docs/shared.md"] },
            { claimBranch: "claim/b", paths: ["docs/shared.md"] },
        ])).toEqual([
            {
                surface: "lane-runway",
                level: "warning",
                message: "claim-path collision on docs/shared.md: claim/a, claim/b",
                action: "inspect remote claim files and release or hand off one owner before writing claimed paths",
            },
        ]);
    });
    test("parseGitWorktreeListPorcelain extracts local worktree branches", () => {
        expect(parseGitWorktreeListPorcelain([
            "worktree /repo/Zeta",
            "HEAD abc123",
            "branch refs/heads/main",
            "",
            "worktree /repo/Zeta-worktrees/codex-health",
            "HEAD def456",
            "branch refs/heads/claim/codex-health",
            "",
            "worktree /repo/detached",
            "HEAD 789abc",
            "detached",
        ].join("\n"))).toEqual([
            { path: "/repo/Zeta", branch: "main" },
            { path: "/repo/Zeta-worktrees/codex-health", branch: "claim/codex-health" },
            { path: "/repo/detached", branch: null },
        ]);
    });
    test("classifyLocalWorktreeDirt warns about dirty same-machine worktrees", () => {
        const observation = localWorktreeDirtObservationFromStatus({ path: "/repo/Zeta-worktrees/codex-health", branch: "claim/codex-health" }, [" M tools/health/factory-health-monitor.ts", "?? docs/claims/codex-health.md"].join("\n"));
        expect(observation).toEqual({
            path: "/repo/Zeta-worktrees/codex-health",
            branch: "claim/codex-health",
            dirtyEntries: 2,
            modifiedEntries: 1,
            untrackedEntries: 1,
        });
        expect(classifyLocalWorktreeDirt(observation === null ? [] : [observation])).toEqual([
            {
                surface: "lane-runway",
                level: "warning",
                message: "local dirty worktree claim/codex-health: 2 dirty file(s) (1 modified, 1 untracked)",
                action: "inspect local worktree status before treating same-machine lane/path ownership as free",
            },
        ]);
        expect(localWorktreeDirtObservationFromStatus({ path: "/repo/Zeta", branch: "main" }, "")).toBeNull();
    });
    test("parseLocalWorktreeDirtScanLimit falls back on malformed values", () => {
        expect(parseLocalWorktreeDirtScanLimit(undefined)).toBe(60);
        expect(parseLocalWorktreeDirtScanLimit("12")).toBe(12);
        expect(parseLocalWorktreeDirtScanLimit("0")).toBe(0);
        expect(parseLocalWorktreeDirtScanLimit("not-a-number")).toBe(60);
        expect(parseLocalWorktreeDirtScanLimit("-1")).toBe(60);
    });
    test("classifyLaneRunway distinguishes active, quiet, and unhealthy lanes", () => {
        const signals = classifyLaneRunway({
            openPrBranches: ["codex/source-patch", "otto-cli/bootstrap"],
            activeClaimBranches: ["claim/codex-loop-20260529"],
            healthyServices: {
                codex: true,
                otto: true,
                lior: true,
                alexa: true,
                riven: false,
            },
        });
        expectSignal(signals, {
            surface: "lane-runway",
            level: "ok",
            message: "codex: active (1 open PR(s), 1 active claim(s))",
        });
        expectSignal(signals, {
            surface: "lane-runway",
            level: "ok",
            message: "lior: quiet runway (0 open PRs, 0 active claims)",
        });
        expectSignal(signals, {
            surface: "lane-runway",
            level: "warning",
            message: "riven: no open PRs or claims and service unhealthy",
            action: "inspect riven background service before treating lane as quiet",
        });
    });
    test("classifyLaneRunway warns about branches outside named lanes", () => {
        const signals = classifyLaneRunway({
            openPrBranches: ["chore/no-owner"],
            activeClaimBranches: ["claim/task-unowned-work"],
        });
        expectSignal(signals, {
            surface: "lane-runway",
            level: "warning",
            message: "other: 1 open PR(s), 1 active claim(s) outside named lanes",
            action: "classify owner or assign an explicit lane before treating as runway",
        });
    });
    test("classifyParallelRunway warns when Codex has no active item", () => {
        expect(classifyParallelRunway({
            openPrBranches: ["otto-cli/bootstrap"],
            activeClaimBranches: ["claim/lior-doc"],
        }, { lane: "codex", minimumActiveItems: 1, targetActiveItems: 2 })).toEqual([
            {
                surface: "lane-runway",
                level: "warning",
                message: "codex: parallel runway below minimum (0/1 active item(s), target 2)",
                action: "open or advance a bounded codex PR before treating the lane as idle",
            },
        ]);
    });
    test("classifyParallelRunway distinguishes under-target and target-met runway", () => {
        expect(classifyParallelRunway({
            openPrBranches: ["claim/codex-doc-packet"],
            activeClaimBranches: ["origin/claim/codex-doc-packet"],
        }, { lane: "codex", minimumActiveItems: 1, targetActiveItems: 2 })).toEqual([
            {
                surface: "lane-runway",
                level: "ok",
                message: "codex: parallel runway above minimum but below target (1/2 active item(s))",
            },
        ]);
        expect(classifyParallelRunway({
            openPrBranches: ["codex/health-signal"],
            activeClaimBranches: ["claim/codex-doc-packet"],
        }, { lane: "codex", minimumActiveItems: 1, targetActiveItems: 2 })).toEqual([
            {
                surface: "lane-runway",
                level: "ok",
                message: "codex: parallel runway target met (2/2 active item(s))",
            },
        ]);
    });
    test("laneRunwaySnapshotFromObservations builds classifier input", () => {
        const snapshot = laneRunwaySnapshotFromObservations(JSON.stringify([
            {
                number: 1,
                title: "Codex source patch",
                createdAt: "2026-05-29T21:00:00Z",
                autoMergeRequest: null,
                headRefName: "codex/source-patch",
            },
            {
                number: 2,
                title: "Otto bootstrap",
                createdAt: "2026-05-29T21:05:00Z",
                autoMergeRequest: { enabledAt: "2026-05-29T21:06:00Z" },
                headRefName: "otto-cli/bootstrap",
            },
            { headRefName: null },
        ]), "  origin/claim/codex-loop-20260529\norigin/claim/kiro-background-service\n\n", { codex: true, alexa: false });
        expect(snapshot).toEqual({
            openPrBranches: ["codex/source-patch", "otto-cli/bootstrap"],
            activeClaimBranches: ["claim/codex-loop-20260529", "claim/kiro-background-service"],
            healthyServices: { codex: true, alexa: false },
        });
    });
    test("laneRunwayServiceHealthFromObservations builds monitor adapter input", () => {
        expect(laneRunwayServiceHealthFromObservations([
            { lane: "codex", healthy: true },
            { lane: "riven", healthy: false },
        ])).toEqual({
            codex: true,
            riven: false,
        });
        expect(laneRunwayServiceHealthFromObservations([])).toBeUndefined();
    });
    test("codexLoopServiceHealthFromJson maps probe severity to lane health", () => {
        expect(codexLoopServiceHealthFromJson('{"severity":"ok"}')).toBe(true);
        expect(codexLoopServiceHealthFromJson('{"severity":"attention"}')).toBe(false);
        expect(codexLoopServiceHealthFromJson('{"severity":"stuck"}')).toBe(false);
        expect(codexLoopServiceHealthFromJson('{"severity":"unknown"}')).toBeNull();
        expect(codexLoopServiceHealthFromJson("not json")).toBeNull();
    });
    test("buildHealthReport summarizes deterministic signals", () => {
        const signals = [
            { surface: "pr-queue", level: "ok", message: "ready" },
            {
                surface: "claims",
                level: "warning",
                message: "claim drift",
                action: "audit claims",
            },
            {
                surface: "cadence",
                level: "critical",
                message: "idle",
                action: "wake runner",
            },
        ];
        const report = buildHealthReport(signals, "2026-05-07T15:10:00.000Z");
        expect(report.summary).toEqual({ ok: 1, warning: 1, critical: 1 });
        expect(report.recommendedAction).toBe("wake runner");
        expect(report.timestamp).toBe("2026-05-07T15:10:00.000Z");
    });
    test("collectStandingQuerySignals preserves trigger source order", () => {
        const sources = [
            {
                surface: "lane-runway",
                collect: () => [{ surface: "lane-runway", level: "ok", message: "codex active" }],
            },
            {
                surface: "backlog",
                collect: () => [{ surface: "backlog", level: "warning", message: "P1 queue high" }],
            },
        ];
        expect(collectStandingQuerySignals(sources)).toEqual([
            { surface: "lane-runway", level: "ok", message: "codex active" },
            { surface: "backlog", level: "warning", message: "P1 queue high" },
        ]);
    });
    test("collectStandingQuerySignals converts source failures to bounded warnings", () => {
        const sources = [
            {
                surface: "claims",
                failureAction: "inspect claim refs",
                collect: () => {
                    throw new Error("boom");
                },
            },
        ];
        expect(collectStandingQuerySignals(sources)).toEqual([
            {
                surface: "claims",
                level: "warning",
                message: "claims standing-query source failed",
                action: "inspect claim refs",
            },
        ]);
    });
    test("runHealthCheck returns a valid HealthReport shape", () => {
        const report = getReport();
        expect(report).toHaveProperty("timestamp");
        expect(report).toHaveProperty("signals");
        expect(report).toHaveProperty("summary");
        expect(Array.isArray(report.signals)).toBe(true);
        expect(typeof report.summary.ok).toBe("number");
        expect(typeof report.summary.warning).toBe("number");
        expect(typeof report.summary.critical).toBe("number");
    }, HEALTH_CHECK_TIMEOUT_MS);
    test("summary counts match signal levels", () => {
        const report = getReport();
        const okCount = report.signals.filter((s) => s.level === "ok").length;
        const warnCount = report.signals.filter((s) => s.level === "warning").length;
        const critCount = report.signals.filter((s) => s.level === "critical").length;
        expect(report.summary.ok).toBe(okCount);
        expect(report.summary.warning).toBe(warnCount);
        expect(report.summary.critical).toBe(critCount);
    }, HEALTH_CHECK_TIMEOUT_MS);
    test("all signals have required fields", () => {
        const report = getReport();
        for (const signal of report.signals) {
            expect(typeof signal.surface).toBe("string");
            expect(["ok", "warning", "critical"]).toContain(signal.level);
            expect(typeof signal.message).toBe("string");
            expect(signal.message.length).toBeGreaterThan(0);
        }
    }, HEALTH_CHECK_TIMEOUT_MS);
    test("timestamp is valid ISO 8601", () => {
        const report = getReport();
        const parsed = new Date(report.timestamp);
        expect(parsed.getTime()).not.toBeNaN();
    }, HEALTH_CHECK_TIMEOUT_MS);
    test("at least one signal covers each expected surface", () => {
        const report = getReport();
        const surfaces = new Set(report.signals.map((s) => s.surface));
        expect(surfaces.has("lane-runway")).toBe(true);
        expect(surfaces.has("pr-queue") || surfaces.has("backlog")).toBe(true);
        expect(surfaces.has("cadence")).toBe(true);
    }, HEALTH_CHECK_TIMEOUT_MS);
});
