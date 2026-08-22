/**
 * tools/nvidia-open-preflight.test.ts
 *
 * Falsifier suite for `nvidia-open-preflight.ts` — the gate that decides
 * whether one node may set `hardware.nvidia.open = true`.
 *
 * The probe cannot be exercised against real hardware from CI (or from the
 * machine that wrote it), so this suite is the only thing standing between it
 * and a wrong answer. `evaluateRoster` is pure by design precisely so the
 * decision can be tested with no GPU present; the CLI cases below stub
 * `nvidia-smi` on PATH and cover the wiring around it.
 *
 * The case that earns the suite is `volta-7.0`. The architecture boundary for
 * the open kernel modules is Turing, whose compute capability is 7.5 — but
 * Volta is 7.0/7.2, so a natural-looking `major >= 7` test passes a card the
 * open module cannot bind. That mistake is invisible in every other case here
 * and would take out a node. `turing-7.5` pins the other side of the boundary.
 *
 * The Ampere control is what stops a probe that refused unconditionally from
 * passing every refusal case.
 */

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateRoster, renderReport } from "./nvidia-open-preflight.ts";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "nvidia-open-preflight.ts");

describe("evaluateRoster: passes only Turing-or-newer silicon", () => {
  test("control — Ampere RTX 3090 x2 passes", () => {
    const v = evaluateRoster("0, NVIDIA GeForce RTX 3090, 8.6\n1, NVIDIA GeForce RTX 3090, 8.6");
    expect(v.pass).toBe(true);
    expect(v.blocking).toBe(0);
    expect(v.gpus).toHaveLength(2);
    expect(renderReport(v)).toContain("can run the open kernel modules");
  });

  test("ada-8.9 — RTX 4090 passes", () => {
    const v = evaluateRoster("0, NVIDIA GeForce RTX 4090, 8.9");
    expect(v.pass).toBe(true);
    expect(v.gpus[0]?.status).toBe("ok");
  });

  test("turing-7.5 — the exact boundary passes", () => {
    const v = evaluateRoster("0, NVIDIA GeForce RTX 2080, 7.5");
    expect(v.pass).toBe(true);
    expect(v.gpus[0]?.status).toBe("ok");
  });

  // The case a `major >= 7` shortcut gets wrong. Volta has no GSP.
  test("volta-7.0 — blocked despite major version 7", () => {
    const v = evaluateRoster("0, Tesla V100-PCIE-16GB, 7.0");
    expect(v.pass).toBe(false);
    expect(v.gpus[0]?.status).toBe("blocking-pre-turing");
    expect(renderReport(v)).toContain("DO NOT set hardware.nvidia.open = true");
  });

  test("volta-7.2 — the other Volta capability is blocked too", () => {
    expect(evaluateRoster("0, Tesla V100, 7.2").pass).toBe(false);
  });

  test("pascal-6.1 — GTX 1080 Ti blocked", () => {
    const v = evaluateRoster("0, NVIDIA GeForce GTX 1080 Ti, 6.1");
    expect(v.pass).toBe(false);
    expect(renderReport(v)).toContain("BLOCKING");
  });

  test("blackwell-12.0 — passes AND is flagged as requiring open", () => {
    const v = evaluateRoster("0, NVIDIA GeForce RTX 5090, 12.0");
    expect(v.pass).toBe(true);
    expect(v.requiresOpen).toBe(1);
    expect(v.gpus[0]?.status).toBe("requires-open");

    const report = renderReport(v);
    expect(report).toContain("REQUIRES the open module");
    expect(report).toContain("not the conservative option");
  });

  test("mixed box — one pre-Turing card blocks the whole node", () => {
    const v = evaluateRoster(
      "0, NVIDIA GeForce RTX 3090, 8.6\n1, NVIDIA GeForce GTX 1080 Ti, 6.1",
    );
    expect(v.pass).toBe(false);
    expect(v.blocking).toBe(1);
    expect(renderReport(v)).toContain("1 of 2 card(s) would lose their driver");
  });

  test("a comma inside the card name does not eat the capability field", () => {
    const v = evaluateRoster("0, NVIDIA RTX A6000, Founders, 8.6");
    expect(v.pass).toBe(true);
    expect(v.gpus[0]?.capability).toBe("8.6");
    expect(v.gpus[0]?.name).toBe("NVIDIA RTX A6000, Founders");
  });
});

describe("evaluateRoster: unknown is never a pass", () => {
  test("unreadable compute capability blocks", () => {
    const v = evaluateRoster("0, NVIDIA Weird Prototype, N/A");
    expect(v.pass).toBe(false);
    expect(v.gpus[0]?.status).toBe("blocking-unreadable");
    expect(renderReport(v)).toContain("UNREADABLE");
  });

  test("no GPUs reported is not a pass", () => {
    const v = evaluateRoster("");
    expect(v.pass).toBe(false);
    expect(v.gpus).toHaveLength(0);
    expect(renderReport(v)).toContain("no NVIDIA GPUs reported");
  });

  test("whitespace-only output is not a pass", () => {
    expect(evaluateRoster("\n   \n").pass).toBe(false);
  });
});

/** Write an executable `nvidia-smi` stub into a fresh dir, return that dir. */
function stubDir(behaviour: string): string {
  const dir = mkdtempSync(join(tmpdir(), "nvopen-cli-"));
  const stub = join(dir, "nvidia-smi");
  writeFileSync(stub, `#!/usr/bin/env bun\n${behaviour}\n`);
  chmodSync(stub, 0o755);
  return dir;
}

function runCli(dir: string, args: readonly string[] = []): { code: number; out: string } {
  const r = spawnSync("bun", [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${dir}:${process.env["PATH"] ?? ""}` },
  });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

describe("CLI wiring", () => {
  test("exit 0 and a report when the roster passes", () => {
    const dir = stubDir('process.stdout.write("0, NVIDIA GeForce RTX 3090, 8.6\\n");');
    const { code, out } = runCli(dir);
    expect(code).toBe(0);
    expect(out).toContain("can run the open kernel modules");
  });

  test("exit 1 when a pre-Turing card is present", () => {
    const dir = stubDir('process.stdout.write("0, NVIDIA GeForce GTX 1080 Ti, 6.1\\n");');
    const { code, out } = runCli(dir);
    expect(code).toBe(1);
    expect(out).toContain("BLOCKING");
  });

  test("--quiet reports through the exit code and prints nothing", () => {
    const passDir = stubDir('process.stdout.write("0, RTX 3090, 8.6\\n");');
    const failDir = stubDir('process.stdout.write("0, GTX 1080 Ti, 6.1\\n");');

    const pass = runCli(passDir, ["--quiet"]);
    const fail = runCli(failDir, ["--quiet"]);

    expect(pass.code).toBe(0);
    expect(fail.code).toBe(1);
    expect(pass.out.trim()).toBe("");
  });

  test("a failing nvidia-smi is a refusal, not a pass", () => {
    const dir = stubDir("process.exit(9);");
    const { code, out } = runCli(dir);
    expect(code).toBe(1);
    expect(out).toContain("could not enumerate GPUs");
  });

  test("nvidia-smi absent is a refusal", () => {
    // PATH is emptied to hide nvidia-smi, so bun itself is invoked by absolute
    // path — otherwise the spawn fails and a broken test looks like a correct
    // refusal (both surface as non-zero).
    const empty = mkdtempSync(join(tmpdir(), "nvopen-nopath-"));
    const r = spawnSync(process.execPath, [CLI], {
      encoding: "utf8",
      env: { ...process.env, PATH: empty },
    });
    expect(r.status).toBe(1);
    expect(`${r.stdout ?? ""}`).toContain("nvidia-smi not found");
  });
});
