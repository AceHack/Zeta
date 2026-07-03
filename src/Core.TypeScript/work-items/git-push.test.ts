import { describe, expect, it } from "bun:test";
import { buildEventCommitMessage } from "./git-push";
import { makeCreatedEvent, mintWorkItemEventIdHex } from "./types";
import { DETERMINISTIC_ENV } from "../zeta-id/zeta-id";

describe("buildEventCommitMessage", () => {
  it("names kind, workItemId, path, and umbrella id", () => {
    const event = makeCreatedEvent(
      {
        workItemId: "081KSXN940008QG0R002FWR9B2",
        type: "task",
        title: "T",
        slug: "t",
        priority: "P2",
        filename: "081KSXN940008QG0R002FWR9B2-t.md",
      },
      "otto-cli",
      Date.UTC(2026, 6, 2, 12, 0, 0),
      (ms) => mintWorkItemEventIdHex(DETERMINISTIC_ENV, ms),
    );
    const msg = buildEventCommitMessage("workitems/events/2026/07/02/deadbeef.json", "otto-cli", event);
    expect(msg).toContain("work-item(otto-cli): created 081KSXN940008QG0R002FWR9B2");
    expect(msg).toContain("no-PR direct-to-main");
    expect(msg).toContain("Co-Authored-By: Claude");
  });
});
