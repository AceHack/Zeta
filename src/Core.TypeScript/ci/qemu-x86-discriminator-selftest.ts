#!/usr/bin/env bun
/**
 * src/Core.TypeScript/ci/qemu-x86-discriminator-selftest.ts
 *
 * Proves, on the runner that is about to gate the ISO, that
 * `qemu-boot-test.ts` can still tell a BROKEN x86_64 image from a SLOW
 * one — before it is asked to judge the real one.
 *
 * ── WHY THIS RUNS IN CI AND NOT ONLY AS A UNIT TEST ─────────────────
 * The x86_64 ladder silently read a constant for nineteen consecutive
 * green runs. No unit test caught it, and no unit test COULD: every
 * assertion was over strings we wrote ourselves, and the defect was that
 * the strings we wrote were not the strings the guest emits. The only
 * check with the power to fail is one that boots something and reads
 * what actually comes out of the UART.
 *
 * It is also the guard on the newer, sharper failure: the BOOT-FAILED
 * verdict now depends on SeaBIOS writing to the debugcon channel, and
 * whether a given distribution's SeaBIOS was built with debug output is
 * a property of the RUNNER, not of this repository. If Ubuntu ships a
 * quiet SeaBIOS tomorrow, this step fails loudly on the next run instead
 * of the harness quietly reverting to a budget-only verdict — a check
 * that stopped running must never look like one that passed.
 *
 * Costs ~15s and boots nothing larger than 1MB.
 *
 * Usage:  bun src/Core.TypeScript/ci/qemu-x86-discriminator-selftest.ts
 * Exit:   0 the discriminator works, 1 it does not, 2 QEMU unavailable.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMarkerImage, type MarkerStage } from "./qemu-x86-marker-image.ts";

const CI_DIR = dirname(fileURLToPath(import.meta.url));
const BOOT_TEST = join(CI_DIR, "qemu-boot-test.ts");

/**
 * `stage` is what the synthetic guest climbs to; `expectExit` is the
 * verdict the harness must reach. The pair is the falsifier: if these
 * two images ever produce the SAME exit code, the discriminator has
 * collapsed and the lane is back to reporting "something took a while".
 */
interface Case {
  readonly name: string;
  readonly stage: MarkerStage;
  readonly timeoutSeconds: number;
  readonly stallSeconds: number;
  readonly expectExit: number;
  readonly expectInOutput: readonly string[];
  /**
   * Upper bound on how long the verdict may take.
   *
   * NOT decoration — it is the assertion carrying the weight, and that
   * is a measured result rather than a guess. Mutation-checked
   * 2026-08-16 by deleting the `No bootable device` failure marker: the
   * BOOT-FAILED case STILL EXITED 1, because it fell through to the
   * budget-exhaustion branch. Only the elapsed time changed — 10s became
   * 120s. A self-test comparing exit codes alone would have passed while
   * the evidence-based verdict was gone and the harness had quietly
   * reverted to deciding by clock.
   *
   * That difference — a verdict reached from evidence versus one reached
   * by running out of time — is the entire subject of this file, so it
   * is the thing that must be asserted directly.
   */
  readonly maxSettleSeconds: number;
}

const CASES: readonly Case[] = [
  {
    // No 0x55AA at all. SeaBIOS tries every boot option, fails, prints
    // `No bootable device.` — and DOES NOT EXIT.
    //
    // The budget sits deliberately far above the settle time so the two
    // are distinguishable. Measured locally (macOS, TCG, QEMU 11.0.1):
    // 10s with no network reachable, and 23s in an earlier probe where
    // SeaBIOS also ran the NIC's iPXE ROM before giving up. A CI runner
    // has real NAT, so budget for the slower shape: 75s is >3x the
    // slowest observed settle and <45% of the budget, which is the
    // property that matters — a clock-driven verdict lands at 180s and
    // cannot sneak under this bound.
    name: "no boot signature -> BOOT-FAILED",
    stage: "none",
    timeoutSeconds: 180,
    stallSeconds: 150,
    expectExit: 1,
    expectInOutput: ["Outcome: BOOT-FAILED", "no bootable device"],
    maxSettleSeconds: 75,
  },
  {
    // A guest that genuinely runs, reaches the bootloader rung and then
    // makes no further progress. Nothing about it is broken from the
    // firmware's point of view — which is exactly the case that must
    // NOT be called a boot failure. Here the clock SHOULD be what
    // settles it, so the bound is just the budget plus start-up slack.
    name: "progressed then out of budget -> TIMEOUT",
    stage: "bootloader",
    timeoutSeconds: 15,
    stallSeconds: 600,
    expectExit: 3,
    expectInOutput: ["Outcome: TIMEOUT", "furthest stage: bootloader"],
    maxSettleSeconds: 45,
  },
];

function qemuAvailable(): boolean {
  try {
    return spawnSync("qemu-system-x86_64", ["--version"]).status === 0;
  } catch {
    return false;
  }
}

function main(): never {
  if (!qemuAvailable()) {
    console.error("[x86-discriminator-selftest] qemu-system-x86_64 not on PATH");
    process.exit(2);
  }

  const dir = mkdtempSync(join(tmpdir(), "zeta-x86-discriminator-"));
  const seen = new Map<string, number>();
  let failures = 0;

  for (const c of CASES) {
    const imagePath = join(dir, `${c.stage}.img`);
    writeFileSync(imagePath, buildMarkerImage(c.stage));

    console.log(`\n[x86-discriminator-selftest] ── ${c.name} ──`);
    const started = Date.now();
    const run = spawnSync(
      "bun",
      [
        BOOT_TEST,
        "--usb-image",
        imagePath,
        "--arch",
        "x86_64",
        "--timeout-seconds",
        String(c.timeoutSeconds),
        "--stall-seconds",
        String(c.stallSeconds),
      ],
      { encoding: "utf8" },
    );
    const elapsed = Math.round((Date.now() - started) / 1000);
    const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;

    if (run.status !== c.expectExit) {
      console.error(`  FAIL exit ${run.status}, expected ${c.expectExit}`);
      console.error(output.slice(-1500));
      failures += 1;
    } else {
      console.log(`  ok   exit ${run.status} in ${elapsed}s`);
    }

    if (elapsed > c.maxSettleSeconds) {
      console.error(
        `  FAIL settled in ${elapsed}s, bound is ${c.maxSettleSeconds}s (budget ${c.timeoutSeconds}s) — ` +
          `this verdict came from the clock, not from evidence`,
      );
      failures += 1;
    }

    for (const needle of c.expectInOutput) {
      if (!output.includes(needle)) {
        console.error(`  FAIL output did not contain ${JSON.stringify(needle)}`);
        failures += 1;
      }
    }
    seen.set(c.name, run.status ?? -1);
  }

  // The property, stated directly rather than implied by the cases: the
  // two verdicts must not be the same number. This is what regressed on
  // aarch64 and what was never true on x86_64 in the first place.
  const codes = new Set(seen.values());
  if (codes.size !== CASES.length) {
    console.error(
      `\n[x86-discriminator-selftest] FAIL — ${CASES.length} cases collapsed onto ${codes.size} exit code(s): ${[...seen].map(([k, v]) => `${k}=${v}`).join(", ")}`,
    );
    failures += 1;
  }

  if (failures > 0) {
    console.error(`\n[x86-discriminator-selftest] ${failures} failure(s)`);
    process.exit(1);
  }
  console.log(
    "\n[x86-discriminator-selftest] BOOT-FAILED and TIMEOUT remain distinguishable on this runner",
  );
  process.exit(0);
}

if (import.meta.main) {
  main();
}
