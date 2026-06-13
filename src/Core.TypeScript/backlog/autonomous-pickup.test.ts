import { describe, expect, test } from "bun:test";
import type { BacklogItem } from "./autonomous-pickup";
import { selectNextBacklogItem } from "./autonomous-pickup";

function item(partial: Partial<BacklogItem> & Pick<BacklogItem, "id" | "priority" | "title">): BacklogItem {
  return {
    status: "open",
    relativePath: `docs/backlog/${partial.priority}/${partial.id}.md`,
    dependsOn: [],
    parent: null,
    created: null,
    lastUpdated: null,
    decomposition: null,
    bodyLineCount: 20,
    ...partial,
  };
}

describe("selectNextBacklogItem", () => {
  test("selects the highest priority open unclaimed item", () => {
    const selection = selectNextBacklogItem(
      [
        item({ id: "B-0100", priority: "P1", title: "P1 work" }),
        item({ id: "B-0200", priority: "P2", title: "P2 work" }),
        item({ id: "B-0001", priority: "P0", title: "P0 work" }),
      ],
      [],
    );

    expect(selection.status).toBe("selected");
    expect(selection.selected?.id).toBe("B-0001");
    expect(selection.action).toBe("claim-and-implement");
  });

  test("returns decompose for blob rows before implementation", () => {
    const selection = selectNextBacklogItem(
      [
        item({
          id: "B-0249",
          priority: "P0",
          title: "Autonomous pickup",
          decomposition: "blob",
        }),
      ],
      [],
    );

    expect(selection.status).toBe("selected");
    expect(selection.selected?.id).toBe("B-0249");
    expect(selection.action).toBe("decompose-first");
    expect(selection.executionPrompt).toContain("Decompose B-0249");
  });

  test("returns decompose for large legacy rows without explicit blob frontmatter", () => {
    const selection = selectNextBacklogItem(
      [
        item({
          id: "B-0062",
          priority: "P0",
          title: "legacy punch list",
          bodyLineCount: 217,
        }),
      ],
      [],
    );

    expect(selection.status).toBe("selected");
    expect(selection.selected?.id).toBe("B-0062");
    expect(selection.action).toBe("decompose-first");
  });

  test("blocks rows with open dependencies", () => {
    const selection = selectNextBacklogItem(
      [
        item({ id: "B-0001", priority: "P0", title: "dependency" }),
        item({
          id: "B-0002",
          priority: "P0",
          title: "blocked by dependency",
          dependsOn: ["B-0001"],
        }),
        item({ id: "B-0100", priority: "P1", title: "fallback" }),
      ],
      [],
    );

    expect(selection.status).toBe("selected");
    expect(selection.selected?.id).toBe("B-0001");
    expect(selection.blocked).toEqual([]);
  });

  test("skips claimed matching rows", () => {
    const selection = selectNextBacklogItem(
      [
        item({ id: "B-0062", priority: "P0", title: "claimed" }),
        item({ id: "B-0109", priority: "P0", title: "fallback" }),
      ],
      ["claim/backlog-0062-wallet"],
    );

    expect(selection.status).toBe("selected");
    expect(selection.selected?.id).toBe("B-0109");
    expect(selection.blocked[0]?.reason).toContain("claim/backlog-0062-wallet");
  });

  test("orders equal-priority candidates by creation age before item number", () => {
    const selection = selectNextBacklogItem(
      [
        item({
          id: "B-0001",
          priority: "P1",
          title: "newer lower id",
          created: "2026-05-08",
        }),
        item({
          id: "B-9999",
          priority: "P1",
          title: "older higher id",
          created: "2026-04-30",
        }),
      ],
      [],
    );

    expect(selection.status).toBe("selected");
    expect(selection.selected?.id).toBe("B-9999");
  });

  test("skips decomposed parents while open children remain", () => {
    const selection = selectNextBacklogItem(
      [
        item({
          id: "B-0249",
          priority: "P0",
          title: "parent",
          decomposition: "decomposed",
        }),
        item({
          id: "B-0278",
          priority: "P0",
          title: "child",
          parent: "B-0249",
        }),
        item({
          id: "B-0300",
          priority: "P1",
          title: "fallback",
        }),
      ],
      [],
    );

    expect(selection.status).toBe("selected");
    expect(selection.selected?.id).toBe("B-0278");
    expect(selection.blocked[0]?.reason).toContain("open child B-0278");
  });
});
