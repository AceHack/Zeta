import { describe, expect, it } from "bun:test";
import type { World } from "./observe.ts";
import {
  backgroundSync,
  mergeRemoteChannels,
  observeAfterRemote,
  observeLocal,
  runLocal,
} from "./local-command.ts";

const emptyWorld = (): World => ({ backlog: [] });

describe("local-command — commands work without a network", () => {
  it("observeLocal on an empty backlog is explore (preexisting NextAction DU)", () => {
    const a = observeLocal(emptyWorld());
    expect(a.kind).toBe("explore");
  });

  it("runLocal is simulate: do_item leaves the backlog, no fetch", () => {
    const item = { id: "081TEST", title: "t", ready: true, ambiguous: false };
    const world: World = { backlog: [item] };
    const next = runLocal(world, { kind: "do_item", item });
    expect(next.backlog).toEqual([]);
    expect(world.backlog).toHaveLength(1);
  });
});

describe("local-command — background remote sync uses the same DUs", () => {
  it("mergeRemoteChannels does not rewrite local history", () => {
    const local: World = {
      backlog: [],
      history: [{ type: "do_item", item: { id: "x", title: "x", ready: true, ambiguous: false } }],
    };
    const merged = mergeRemoteChannels(local, {
      forgeState: { openPrCount: 1, cleanPrCount: 1, cleanPrNumbers: [42] },
    });
    expect(merged.history).toBe(local.history);
    expect(merged.forgeState?.cleanPrNumbers).toEqual([42]);
  });

  it("observeAfterRemote picks merge-pr from preexisting do_item DU when a clean PR arrives", () => {
    const a = observeAfterRemote(emptyWorld(), {
      forgeState: { openPrCount: 1, cleanPrCount: 1, cleanPrNumbers: [15718] },
    });
    expect(a.kind).toBe("do_item");
    if (a.kind === "do_item") expect(a.item.id).toBe("merge-pr-15718");
  });

  it("backgroundSync fetches only through the injected door", async () => {
    let calls = 0;
    const door = {
      fetch: async () => {
        calls += 1;
        return { forgeState: { openPrCount: 2, cleanPrCount: 0, cleanPrNumbers: [] } };
      },
    };
    const next = await backgroundSync(emptyWorld(), door);
    expect(calls).toBe(1);
    expect(next.forgeState?.openPrCount).toBe(2);
    expect(observeLocal(next).kind).toBe("explore");
  });
});
