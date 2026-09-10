// run-tlc.test.ts -- CLI contract only.
//
// DO NOT ADD A REAL TLC RUN TO THIS FILE. `bunfig.toml` declares
// [test] timeout = 20000 and bun IGNORES it: the effective per-test cap is
// 5000 ms (MEASURED 2026-08-14, bun 1.3.14, a 6s test dies at 5002ms --
// independently reproducing 081KZZ3JHP1087G0R00027ARRR). A model check killed
// at five seconds reports as a FAILURE, not as an under-check, which is the
// same class of defect this whole change exists to remove.
//
// The gate runs TLC under `dotnet test` (xUnit, no bun involved), and every
// spawn below is a metadata command that finishes in well under a second.
import { describe, expect, test } from "bun:test";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { loadTlcRegistry } from "./tlc-invocation";

function root(): string {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : process.cwd();
}

describe("run-tlc CLI contract", () => {
  const cli = "src/Core.TypeScript/formal-verification/run-tlc.ts";

  test("--invocation prints the pinned command, so a recorded result can carry it", () => {
    const r = spawnSync("bun", [cli, "--invocation", "QuorumPhaseUnnormalised"], {
      cwd: root(), encoding: "utf8",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("-config QuorumPhaseUnnormalised.cfg");
    expect(r.stdout).toContain("-workers 1");
    expect(r.stdout).not.toContain("-deadlock");
  });

  test("--list names every model in the registry", () => {
    const r = spawnSync("bun", [cli, "--list"], { cwd: root(), encoding: "utf8" });
    expect(r.status).toBe(0);
    const registry = loadTlcRegistry(root());
    for (const model of registry.models) {
      expect(r.stdout).toContain(model.id);
    }
  });

  test("an unknown model id is an error, not a silent no-op", () => {
    // The old --all scanned the specs directory for .cfg files and treated a
    // config without a same-named .tla as drift, which meant it FAILED on all
    // nineteen non-default configs. Naming models removes the ambiguity.
    const r = spawnSync("bun", [cli, "NoSuchModel"], { cwd: root(), encoding: "utf8" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("unknown model id");
  });

  test("an unknown flag exits 3, distinct from a model failure", () => {
    const r = spawnSync("bun", [cli, "--nonsense"], { cwd: root(), encoding: "utf8" });
    expect(r.status).toBe(3);
    // NAMED as a flag, not folded into "unknown model id". Both exit 3, so the
    // code alone cannot tell them apart, and a reader with a typo'd flag would
    // be sent looking for a model that was never meant to exist.
    expect(r.stderr).toContain("unknown flag");
  });

  // Both refusals above are ARGV questions, answered before the toolchain is
  // probed. That ordering was invisible while the jar was committed -- the probe
  // always succeeded -- and it is exactly what broke when the jar became
  // fetched: an unknown model id reported a missing toolchain, which is true and
  // is not the answer to the question that was asked.
  test("an argv error is answered even when the toolchain is not ready", () => {
    // PATH narrowed to bun's own directory so `java` is not findable. Clearing
    // PATH outright would make `bun` itself unfindable, and the test would then
    // pass for the wrong reason -- a status of `undefined` is not exit 3.
    const r = spawnSync(process.execPath, [cli, "NoSuchModel"], {
      cwd: root(),
      encoding: "utf8",
      env: { ...process.env, PATH: dirname(process.execPath) },
    });
    expect(r.status).toBe(3);
    expect(r.stderr).toContain("unknown model id");
    expect(r.stderr).not.toContain("toolchain not ready");
  });
});
