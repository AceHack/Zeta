import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadNodeSession, pendingNodeSession } from "./load-node-session";

describe("loadNodeSession", () => {
  it("returns undefined when marker exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-fs-marker-"));
    const marker = join(dir, "complete.marker");
    writeFileSync(marker, "done\n");
    expect(loadNodeSession({ markerPath: marker })).toBeUndefined();
  });

  it("returns injected session for tests", () => {
    const session = pendingNodeSession();
    expect(loadNodeSession({ session })).toEqual(session);
  });
});
