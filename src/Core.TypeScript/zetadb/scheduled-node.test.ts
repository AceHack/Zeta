import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runScheduledZetaDbNode } from "./scheduled-node";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("scheduled ZetaDB node", () => {
  test("persists one checkpoint and becomes an idempotent no-op on replay", async () => {
    const directory = mkdtempSync(join(tmpdir(), "zeta-scheduled-node-"));
    directories.push(directory);
    const journalPath = join(directory, "journal.json");
    const checkpointPath = join(directory, "checkpoint.json");
    writeFileSync(
      journalPath,
      JSON.stringify({
        schema: "zeta.db.scheduled-journal.v1",
        nodeId: "global/browser",
        deltas: [{ eventId: "event/1", rowKey: "system/node", payload: "ready", weight: 1 }],
      }),
    );
    const options = {
      journalPath,
      checkpointPath,
      executorId: "actions/1",
      maxDeltas: 8,
      maxEntries: 16,
      maxCheckpointBytes: 16 * 1024,
    };

    const first = await runScheduledZetaDbNode(options);
    const second = await runScheduledZetaDbNode({ ...options, executorId: "actions/2" });

    expect(first.ok && first.value).toMatchObject({ changed: true, tick: { revision: 1, accepted: 1 } });
    expect(second.ok && second.value).toMatchObject({
      changed: false,
      tick: { revision: 1, accepted: 0, duplicates: 1 },
    });
    expect(JSON.parse(readFileSync(checkpointPath, "utf8"))).toMatchObject({
      schema: "zeta.db.file-checkpoint.v1",
      nodeId: "global/browser",
      revision: 1,
    });
  });
});
