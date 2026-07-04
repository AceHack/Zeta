import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { listSetupRealizerInstallOrder } from "./setup-realizers/index.ts";

const SETUP_REALIZE = join(import.meta.dir, "setup-realize.ts");

describe("setup-realize CLI", () => {
  test("--list emits install-graph order", () => {
    const out = spawnSync("bun", [SETUP_REALIZE, "--list"], { encoding: "utf8" });
    expect(out.status).toBe(0);
    const lines = (out.stdout ?? "").trim().split("\n");
    expect(lines[0]).toBe("from-deb");
    expect(lines).toEqual([...listSetupRealizerInstallOrder()]);
  });

  test("--available accepts registered id", () => {
    const out = spawnSync("bun", [SETUP_REALIZE, "--available", "from-uv-tool"], { encoding: "utf8" });
    expect(out.status).toBe(0);
  });
});
