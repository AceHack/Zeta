import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claimGeneration } from "./exclusive-lock.ts";

// ─────────────────────────────────────────────────────────────────────────────
// THE FALSIFIER FOR STAGE-THEN-LINK, which shipped without one and said so.
//
// `claimGeneration` used to `open(path,"wx")` and write the owner one syscall later. O_EXCL is
// atomic about the NAME and silent about the CONTENT, so between those calls the generation
// existed and was unparseable -- and this module's own rule is that an unparseable generation
// is not-held and gets SUPERSEDED. Live cost: three of eight processes holding one exclusive
// lock (081M2E7ZHYC087G0R000NDNQ2F).
//
// THE FIX SHIPPED UNFALSIFIED AND I SAID SO AT THE TIME: reverting it left the whole suite at
// 21 pass / 0 fail. Three approaches were tried before this one worked, and they are recorded
// because each is a plausible thing for the next person to reach for:
//
//   fs.watch on the lock directory      macOS coalesces; 10/10 trials reported only `0.lock`,
//                                       never the staging file. Not an observer.
//   spin-reader doing readdir           scanning a growing directory is microseconds per pass
//                                       while the window is nanoseconds: 0 hits in 28,018
//                                       claims against the DEFECTIVE build. False green.
//   plant a zero-byte generation        tests the tolerated case (corrupt => supersede), which
//                                       is unchanged by the fix. Passes either way.
//
// WHAT WORKS: a second process spinning on ONE FIXED PATH with no readdir, while this process
// claims the same generation over and over. Measured:
//
//   create-then-write (defective)   empty=6981   full=48267   over 32,005 claims
//   stage-then-link   (fixed)       empty=0      full=15845   over  6,142 claims
//
// `empty` is the defect being observed directly -- the generation existing with no content.
//
// BOUNDED BY A CLAIM COUNT, NOT BY A CLOCK. The reader stops when this process drops a sentinel
// file, so nothing here asserts on elapsed time and `audit-ambient-time-in-tests` has nothing
// to allowlist. The one `full > 0` assertion is the control that keeps the whole thing honest:
// a reader that never managed to open the file would report `empty = 0` and pass vacuously,
// which is exactly how the readdir attempt above fooled me for one run.

const READER = `
const { readFileSync, existsSync } = require("node:fs");
const target = process.argv[2];
const sentinel = process.argv[3];
let empty = 0, full = 0, missing = 0;
process.stdout.write("ready\\n");
while (!existsSync(sentinel)) {
  try {
    const s = readFileSync(target, "utf8");
    if (s.length === 0) empty++; else full++;
  } catch { missing++; }
}
process.stdout.write(JSON.stringify({ empty, full, missing }) + "\\n");
`;

interface RaceResult { readonly empty: number; readonly full: number; readonly missing: number; readonly claims: number; }

async function observeClaims(claims: number): Promise<RaceResult> {
  const root = mkdtempSync(join(tmpdir(), "gcdl-window-"));
  const lockRoot = join(root, "run.lock.d");
  mkdirSync(lockRoot, { recursive: true });
  const target = join(lockRoot, "0.lock");
  const sentinel = join(root, "DONE");

  // `process.execPath`, never the string "node". Resolving a program name through PATH
  // means whatever PATH happens to hold runs -- which `sonarjs/no-os-command-from-path`
  // flags, correctly, and which this file's own sibling `exclusive-lock.test.ts` already
  // avoids by spawning a script FILE with the current runtime. Same shape here. The file
  // also costs the child one argv slot, which is why READER reads argv[2]/[3] above.
  const readerPath = join(root, "reader.cjs");
  writeFileSync(readerPath, READER);
  const child = spawn(process.execPath, [readerPath, target, sentinel], { stdio: ["ignore", "pipe", "inherit"] });
  let out = "";
  child.stdout.on("data", (d: Buffer) => { out += String(d); });

  // HANDSHAKE, not a sleep: the reader announces itself, so the observation window is defined
  // by the reader being up rather than by a timer nobody can justify.
  await new Promise<void>((resolve) => {
    const onData = (): void => { if (out.includes("ready")) { child.stdout.off("data", onData); resolve(); } };
    child.stdout.on("data", onData);
    onData();
  });

  for (let i = 0; i < claims; i++) {
    claimGeneration(lockRoot, 0, { pid: 1, startedAt: "2026-09-17T00:00:00.000Z" });
    rmSync(target, { force: true }); // free the same path for the next claim
  }
  writeFileSync(sentinel, "");
  await new Promise<void>((resolve) => { child.on("close", () => { resolve(); }); });

  const line = out.split("\n").filter((l) => l.trim().startsWith("{")).at(-1) ?? "{}";
  const parsed = JSON.parse(line) as { empty?: number; full?: number; missing?: number };
  rmSync(root, { recursive: true, force: true });
  return { empty: parsed.empty ?? -1, full: parsed.full ?? -1, missing: parsed.missing ?? -1, claims };
}

describe("exclusive-lock — a claim is never OBSERVABLE half-written", () => {
  test("a concurrent reader never sees the generation exist with no content", async () => {
    const r = await observeClaims(20_000);

    // THE CONTROL, and it is not optional. Without it a reader that never opened the file
    // reports empty=0 and this test passes while observing nothing -- the exact false green
    // that made the readdir version look like a working detector for one run.
    expect(r.full).toBeGreaterThan(0);

    // THE PROPERTY. Measured at 6,981 hits against create-then-write; 0 against stage-then-link.
    expect({ empty: r.empty }).toEqual({ empty: 0 });
  }, 120_000);
});
