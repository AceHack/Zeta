import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TrajectoryPacket } from "./autonomous-pickup";
import { readTrajectoryPackets, selectNextTrajectory } from "./autonomous-pickup";

function packet(partial: Partial<TrajectoryPacket> & Pick<TrajectoryPacket, "slug" | "title">): TrajectoryPacket {
  return {
    relativePath: `docs/trajectories/${partial.slug}/RESUME.md`,
    status: "active",
    blocker: null,
    nextAction: "Claim and implement one small action",
    childCandidates: [],
    backlogRefs: [],
    actionBacklogRefs: [],
    closedActionBacklogRefs: [],
    bodyLineCount: 40,
    ...partial,
  };
}

describe("selectNextTrajectory", () => {
  test("selects child-packet creation before implementation when candidates exist", () => {
    const selection = selectNextTrajectory(
      [
        packet({
          slug: "factory-trajectory-surface",
          title: "Factory Trajectory Surface",
          nextAction: "alignment measurement trajectory, grounded in 081KQTPYE0008QG0R000ZJ2GW8",
          childCandidates: ["alignment measurement trajectory, grounded in 081KQTPYE0008QG0R000ZJ2GW8"],
          backlogRefs: ["081KQTPYE0008QG0R000ZJ2GW8"],
        }),
      ],
      [],
    );

    expect(selection.status).toBe("selected");
    expect(selection.action).toBe("create-child-packet");
    expect(selection.executionPrompt).toContain("Create exactly one child trajectory packet");
    expect(selection.executionPrompt).toContain("Trajectory is number one");
    expect(selection.executionPrompt).toContain("081KQTPYE0008QG0R000ZJ2GW8");
  });

  test("routes broad follow-up text to decomposition", () => {
    const selection = selectNextTrajectory(
      [
        packet({
          slug: "typescript-bun-migration",
          title: "TypeScript / Bun migration",
          nextAction: "Possible follow-ups: (a) audit bash siblings; (b) switch budget wrapper",
        }),
      ],
      [],
    );

    expect(selection.status).toBe("selected");
    expect(selection.action).toBe("decompose");
  });

  test("blocks placeholder child candidate text", () => {
    const selection = selectNextTrajectory(
      [
        packet({
          slug: "factory-trajectory-surface",
          title: "Factory Trajectory Surface",
          nextAction: "none currently selected",
          childCandidates: ["none currently selected"],
        }),
        packet({ slug: "typescript-bun-migration", title: "fallback" }),
      ],
      [],
    );

    expect(selection.status).toBe("selected");
    expect(selection.selected?.slug).toBe("typescript-bun-migration");
    expect(selection.blocked[0]?.reason).toBe("no next action found");
  });

  test("ignores placeholder child candidates when next action is concrete", () => {
    const selection = selectNextTrajectory(
      [
        packet({
          slug: "ready-lane",
          title: "Ready lane",
          nextAction: "Claim and implement one small action",
          childCandidates: ["none currently selected"],
        }),
      ],
      [],
    );

    expect(selection.status).toBe("selected");
    expect(selection.selected?.slug).toBe("ready-lane");
    expect(selection.action).toBe("claim-and-implement");
    expect(selection.executionPrompt).not.toContain("First child candidate");
    expect(selection.executionPrompt).not.toContain("none currently selected");
  });

  test("blocks packets with explicit blockers", () => {
    const selection = selectNextTrajectory(
      [
        packet({
          slug: "blocked-lane",
          title: "Blocked lane",
          blocker: "waiting for maintainer decision",
        }),
        packet({ slug: "ready-lane", title: "Ready lane" }),
      ],
      [],
    );

    expect(selection.status).toBe("selected");
    expect(selection.selected?.slug).toBe("ready-lane");
    expect(selection.blocked[0]?.reason).toContain("waiting for maintainer decision");
  });

  test("blocks closed-maintained trajectory packets", () => {
    const selection = selectNextTrajectory(
      [
        packet({
          slug: "typescript-bun-migration",
          title: "closed maintained lane",
          status: "Closed-maintained bash-retirement phase; Bucket B is empty",
          nextAction: "Maintain the bash-retirement inventory guard",
        }),
        packet({ slug: "ready-lane", title: "Ready lane" }),
      ],
      [],
    );

    expect(selection.status).toBe("selected");
    expect(selection.selected?.slug).toBe("ready-lane");
    expect(selection.blocked[0]?.reason).toContain("closed-maintained trajectory");
  });

  test("skips matching active claims", () => {
    const selection = selectNextTrajectory(
      [
        packet({ slug: "factory-trajectory-surface", title: "claimed" }),
        packet({ slug: "typescript-bun-migration", title: "fallback" }),
      ],
      ["claim/factory-trajectory-surface"],
    );

    expect(selection.status).toBe("selected");
    expect(selection.selected?.slug).toBe("typescript-bun-migration");
    expect(selection.blocked[0]?.reason).toContain("claim/factory-trajectory-surface");
  });

  test("blocks packets whose action backlog refs are all closed", () => {
    const selection = selectNextTrajectory(
      [
        packet({
          slug: "autonomous-backlog-pickup",
          title: "stale closed action",
          nextAction: "Finish the PR-publication executor path for 081KR2E4K0008QG0R0022RVRCZ",
          childCandidates: ["PR-publication executor completion, grounded in 081KR2E4K0008QG0R0022RVRCZ"],
          actionBacklogRefs: ["081KR2E4K0008QG0R0022RVRCZ"],
          closedActionBacklogRefs: ["081KR2E4K0008QG0R0022RVRCZ"],
        }),
        packet({ slug: "typescript-bun-migration", title: "fallback" }),
      ],
      [],
    );

    expect(selection.status).toBe("selected");
    expect(selection.selected?.slug).toBe("typescript-bun-migration");
    expect(selection.blocked[0]?.reason).toBe("action backlog refs already closed: 081KR2E4K0008QG0R0022RVRCZ");
  });

  test("skips closed child candidates before selecting the prompt target", () => {
    const selection = selectNextTrajectory(
      [
        packet({
          slug: "autonomous-backlog-pickup",
          title: "mixed child candidates",
          nextAction: "Create the next viable child packet",
          childCandidates: [
            "PR-publication executor completion, grounded in 081KR2E4K0008QG0R0022RVRCZ",
            "Queue-health continuation, grounded in 081KR2E4K0008QG0R002FSPPQR",
          ],
          actionBacklogRefs: ["081KR2E4K0008QG0R0022RVRCZ", "081KR2E4K0008QG0R002FSPPQR"],
          closedActionBacklogRefs: ["081KR2E4K0008QG0R0022RVRCZ"],
        }),
      ],
      [],
    );

    expect(selection.status).toBe("selected");
    expect(selection.action).toBe("create-child-packet");
    expect(selection.executionPrompt).toContain("First child candidate: Queue-health continuation, grounded in 081KR2E4K0008QG0R002FSPPQR");
    expect(selection.executionPrompt).not.toContain("First child candidate: PR-publication executor completion");
  });
});

describe("readTrajectoryPackets", () => {
  test("keeps wrapped top-level next-action fields together", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "zeta-trajectory-pickup-"));
    try {
      const packetDir = join(repoRoot, "docs", "trajectories", "typescript-bun-migration");
      mkdirSync(packetDir, { recursive: true });
      writeFileSync(
        join(packetDir, "RESUME.md"),
        [
          "# TypeScript / Bun migration",
          "",
          "**Status:** active",
          "**Next concrete action:** Claim the smallest TypeScript/Bun migration slice and",
          "preserve the wrapped continuation text in the generated prompt.",
          "**Current blocker:** none",
          "",
          "## Next Child Packets",
          "",
          "- none currently selected",
        ].join("\n"),
      );

      const packets = readTrajectoryPackets(repoRoot);

      expect(packets).toHaveLength(1);
      expect(packets[0]?.nextAction).toBe(
        "Claim the smallest TypeScript/Bun migration slice and preserve the wrapped continuation text in the generated prompt",
      );
      expect(packets[0]?.blocker).toBe("none");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test("marks action backlog refs that resolve to closed rows", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "zeta-trajectory-pickup-"));
    try {
      const packetDir = join(repoRoot, "docs", "trajectories", "autonomous-backlog-pickup");
      const backlogDir = join(repoRoot, "docs", "backlog", "P0");
      mkdirSync(packetDir, { recursive: true });
      mkdirSync(backlogDir, { recursive: true });
      writeFileSync(
        join(packetDir, "RESUME.md"),
        [
          "# Autonomous backlog pickup",
          "",
          "Status: active child packet",
          "Current blocker: none",
          "Next concrete action: finish the PR-publication executor path for 081KR2E4K0008QG0R0022RVRCZ.",
          "",
          "## Next Child Packets",
          "",
          "- PR-publication executor completion, grounded in 081KR2E4K0008QG0R0022RVRCZ",
        ].join("\n"),
      );
      writeFileSync(
        join(backlogDir, "081KR2E4K0008QG0R0022RVRCZ-autonomous-backlog-pr-publication-and-automerge.md"),
        ["---", "id: 081KR2E4K0008QG0R0022RVRCZ", "status: closed", "---", "", "# 081KR2E4K0008QG0R0022RVRCZ"].join("\n"),
      );

      const packets = readTrajectoryPackets(repoRoot);

      expect(packets).toHaveLength(1);
      expect(packets[0]?.actionBacklogRefs).toEqual(["081KR2E4K0008QG0R0022RVRCZ"]);
      expect(packets[0]?.closedActionBacklogRefs).toEqual(["081KR2E4K0008QG0R0022RVRCZ"]);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  test("treats superseded backlog rows as resolved", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "zeta-trajectory-pickup-"));
    try {
      const packetDir = join(repoRoot, "docs", "trajectories", "autonomous-backlog-pickup");
      const backlogDir = join(repoRoot, "docs", "backlog", "P0");
      mkdirSync(packetDir, { recursive: true });
      mkdirSync(backlogDir, { recursive: true });
      writeFileSync(
        join(packetDir, "RESUME.md"),
        [
          "# Autonomous backlog pickup",
          "",
          "Status: active child packet",
          "Current blocker: none",
          "Next concrete action: continue the superseded lane for 081KR2E4K0008QG0R000J2CKKW.",
        ].join("\n"),
      );
      writeFileSync(
        join(backlogDir, "081KR2E4K0008QG0R000J2CKKW-superseded-row.md"),
        ["---", "id: 081KR2E4K0008QG0R000J2CKKW", "status: superseded-by-081KR2E4K0008QG0R000JW0DZB", "---", "", "# 081KR2E4K0008QG0R000J2CKKW"].join("\n"),
      );

      const packets = readTrajectoryPackets(repoRoot);

      expect(packets).toHaveLength(1);
      expect(packets[0]?.actionBacklogRefs).toEqual(["081KR2E4K0008QG0R000J2CKKW"]);
      expect(packets[0]?.closedActionBacklogRefs).toEqual(["081KR2E4K0008QG0R000J2CKKW"]);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
