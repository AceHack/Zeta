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
          nextAction: "alignment measurement trajectory, grounded in B-0205",
          childCandidates: ["alignment measurement trajectory, grounded in B-0205"],
          backlogRefs: ["B-0205"],
        }),
      ],
      [],
    );

    expect(selection.status).toBe("selected");
    expect(selection.action).toBe("create-child-packet");
    expect(selection.executionPrompt).toContain("Create exactly one child trajectory packet");
    expect(selection.executionPrompt).toContain("Trajectory is number one");
    expect(selection.executionPrompt).toContain("B-0205");
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
});
