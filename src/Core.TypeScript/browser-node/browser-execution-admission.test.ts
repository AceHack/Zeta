import { describe, expect, test } from "bun:test";
import { createInMemoryBrowserExecutionAdmission } from "./browser-execution-admission";

describe("browser execution admission", () => {
  test("queues recovery behind a finite owner without changing nonblocking admission", async () => {
    const admission = createInMemoryBrowserExecutionAdmission();
    let release: (() => void) | undefined;
    const held = admission.tryRun("database/global", async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return "writer";
    });
    for (let attempt = 0; attempt < 100 && release === undefined; attempt += 1) await Promise.resolve();
    expect(release).toBeDefined();

    expect(await admission.tryRun("database/global", () => Promise.resolve("interactive"))).toMatchObject({
      ok: true,
      value: { status: "busy" },
    });
    let recoveryRan = false;
    const recovery = admission.runWhenAvailable?.("database/global", () => {
      recoveryRan = true;
      return Promise.resolve("recovered");
    });
    expect(recovery).toBeDefined();
    await Promise.resolve();
    expect(recoveryRan).toBe(false);

    release?.();
    expect(await held).toMatchObject({ ok: true, value: { status: "admitted", value: "writer" } });
    expect(await recovery).toMatchObject({ ok: true, value: { status: "admitted", value: "recovered" } });
  });
});
