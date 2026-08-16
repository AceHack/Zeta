/**
 * full-ai-cluster/tools/flash-usb-windows.security.test.ts
 *
 * `full-ai-cluster/tools/flash-usb-windows.ts` is a STALE FORK of
 * `src/Core.TypeScript/zflash/flash-usb-windows.ts`. #8076 copied the flasher into `src/` and fixed
 * its insecure-temp-file finding there, and did not remove the original — the fork has not been
 * touched since #6895. Nothing invokes it: `zeta-flash.ts`, `flash-and-inject.ts`,
 * `audit-installer-substrate.ts` and the flasher's own test all name the `zflash/` copy, and even
 * `README-flash-usb-windows.md`, which sits in the same directory, documents the `zflash/` path.
 *
 * The recommendation is to DELETE it, and that is Aaron's call to make, not this test's. What this
 * file pins is the reversible half: while the fork exists, it must not carry the security defect
 * its canonical twin already fixed. CodeQL alert #173 (`js/insecure-temporary-file`, severity HIGH)
 * has been open against this exact file since 2026-06-07.
 *
 * DELETION-SAFE BY CONSTRUCTION. Every assertion is skipped when the file is absent, so this test
 * does not become a reason to keep the fork alive. If the file goes, the tests quietly stop
 * applying — the pin holds the fix in place, it does not hold the file in place.
 *
 * WHY THIS IS A SOURCE-LEVEL ASSERTION AND NOT A BEHAVIOURAL ONE — stated plainly rather than
 * dressed up as more than it is. The affected function is `realRunner.diskpart`, which is NOT
 * exported (only the pure helpers are), runs `execFileSync("diskpart", …)` so it is Windows-only,
 * and removes its temp directory in a `finally`, leaving nothing to observe afterwards. There is no
 * honest way to drive it from this test host. So the check reads the source — and the detector
 * itself is pinned against a literal copy of the pre-fix code below, so it cannot pass vacuously.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const FORK = resolve(import.meta.dir, "flash-usb-windows.ts");
const CANONICAL = resolve(
  import.meta.dir,
  "../../src/Core.TypeScript/zflash/flash-usb-windows.ts",
);

/** The defect: a temp path assembled from predictable parts in the shared temp dir. */
const PREDICTABLE_TEMP = /join\(\s*tmpdir\(\)\s*,\s*`[^`]*\$\{process\.pid\}[^`]*`\s*\)/;
/** The fix: an exclusively-created temp DIRECTORY, then a fixed name inside it. */
const MKDTEMP = /mkdtempSync\(\s*join\(\s*tmpdir\(\)\s*,\s*"zeta-diskpart-"\s*\)\s*\)/;

/** Verbatim pre-fix code, kept so the detector above is proven non-vacuous. */
const PRE_FIX_SNIPPET =
  "const tmp = join(tmpdir(), `zeta-diskpart-${process.pid}-${Date.now()}.txt`);";

describe("the detector is not vacuous", () => {
  test("PREDICTABLE_TEMP matches the pre-fix code it is meant to catch", () => {
    expect(PREDICTABLE_TEMP.test(PRE_FIX_SNIPPET)).toBe(true);
  });

  test("MKDTEMP does not match the pre-fix code", () => {
    expect(MKDTEMP.test(PRE_FIX_SNIPPET)).toBe(false);
  });

  test("CONTROL — the canonical zflash copy carries the fix", () => {
    const src = readFileSync(CANONICAL, "utf8");
    expect(MKDTEMP.test(src)).toBe(true);
    expect(PREDICTABLE_TEMP.test(src)).toBe(false);
  });
});

describe("the stale fork, while it exists, carries the fix too", () => {
  // The fork is a deletion candidate. These assertions apply only while it is present.
  const present = existsSync(FORK);

  test.skipIf(!present)(
    "no diskpart script is written to a predictable path in the shared temp dir",
    () => {
      // The script this creates is handed straight to `diskpart /s` while the tool runs ELEVATED,
      // so a predictable name in a world-writable directory is a substitutable input to a
      // privileged disk-partitioning command, not merely an untidy filename.
      expect(PREDICTABLE_TEMP.test(readFileSync(FORK, "utf8"))).toBe(false);
    },
  );

  test.skipIf(!present)("the diskpart temp file is created inside an mkdtemp directory", () => {
    expect(MKDTEMP.test(readFileSync(FORK, "utf8"))).toBe(true);
  });

  test.skipIf(!present)("the fix's cleanup removes the directory, not just the file", () => {
    expect(readFileSync(FORK, "utf8")).toContain("rmSync(dir, { recursive: true })");
  });

  test.skipIf(!present)(
    "the fork's ONLY remaining divergence from the canonical copy is self-referential path prose",
    () => {
      // If this ever fails, the fork has grown real divergence and the delete/dedupe question has
      // to be reopened rather than assumed. It is deliberately not a byte-equality assertion:
      // #10853 declined to port its unknown-flag guard here on the grounds that guarding a stale
      // duplicate entrenches it, so the two files are expected to differ in that respect.
      const forkLines = readFileSync(FORK, "utf8").split("\n");
      const canonLines = readFileSync(CANONICAL, "utf8").split("\n");
      const onlyInFork = forkLines.filter((l) => !canonLines.includes(l) && l.trim().length > 0);
      for (const line of onlyInFork) {
        expect(line.trimStart().startsWith("*")).toBe(true);
      }
    },
  );
});
