import { describe, expect, it } from "bun:test";
import { foldWorkItemEvents, openWorkItems } from "./fold";
import {
  makeClosedEvent,
  makeCreatedEvent,
  makeStateChangedEvent,
  mintWorkItemEventIdHex,
} from "./types";
import { DETERMINISTIC_ENV } from "../zeta-id/zeta-id";

const WI = "081KSXN940008QG0R002FWR9B2";
const mintAt = (ms: number) => mintWorkItemEventIdHex(DETERMINISTIC_ENV, ms);

describe("foldWorkItemEvents", () => {
  it("created → backlog; open view includes it", () => {
    const at = Date.UTC(2026, 6, 2, 12, 0, 0);
    const events = [
      makeCreatedEvent(
        {
          workItemId: WI,
          type: "task",
          title: "T",
          slug: "t",
          priority: "P2",
          filename: `${WI}-t.md`,
        },
        "otto",
        at,
        mintAt,
      ),
    ];
    const folded = foldWorkItemEvents(events);
    expect(folded.get(WI)?.state).toBe("backlog");
    expect(openWorkItems(folded)).toHaveLength(1);
  });

  it("state-changed to in-progress stays open; done removes from open view", () => {
    const t0 = Date.UTC(2026, 6, 2, 12, 0, 0);
    const t1 = Date.UTC(2026, 6, 2, 13, 0, 0);
    const t2 = Date.UTC(2026, 6, 2, 14, 0, 0);
    const events = [
      makeCreatedEvent(
        { workItemId: WI, type: "task", title: "T", slug: "t", priority: "P2", filename: `${WI}-t.md` },
        "otto",
        t0,
        mintAt,
      ),
      makeStateChangedEvent({ workItemId: WI, from: "backlog", to: "in-progress" }, "otto", t1, mintAt),
      makeStateChangedEvent({ workItemId: WI, from: "in-progress", to: "done" }, "otto", t2, mintAt),
    ];
    const folded = foldWorkItemEvents(events);
    expect(folded.get(WI)?.state).toBe("done");
    expect(openWorkItems(folded)).toHaveLength(0);
  });

  it("closed event removes from open view (Z-set retract)", () => {
    const t0 = Date.UTC(2026, 6, 2, 12, 0, 0);
    const t1 = Date.UTC(2026, 6, 2, 13, 0, 0);
    const events = [
      makeCreatedEvent(
        { workItemId: WI, type: "bug", title: "B", slug: "b", priority: "P1", filename: `${WI}-b.md` },
        "otto",
        t0,
        mintAt,
      ),
      makeClosedEvent({ workItemId: WI, reason: "superseded" }, "otto", t1, mintAt),
    ];
    const folded = foldWorkItemEvents(events);
    expect(folded.get(WI)?.state).toBe("closed");
    expect(openWorkItems(folded)).toHaveLength(0);
  });

  it("folds events in (at, id) order deterministically", () => {
    const t0 = Date.UTC(2026, 6, 2, 12, 0, 0);
    const t1 = Date.UTC(2026, 6, 2, 13, 0, 0);
    const a = makeStateChangedEvent({ workItemId: WI, from: "backlog", to: "in-progress" }, "otto", t1, mintAt);
    const b = makeCreatedEvent(
      { workItemId: WI, type: "task", title: "T", slug: "t", priority: "P2", filename: `${WI}-t.md` },
      "otto",
      t0,
      mintAt,
    );
    // out-of-order input — fold must sort
    expect(foldWorkItemEvents([a, b]).get(WI)?.state).toBe("in-progress");
  });
});
