/**
 * iso-discovery.test.ts
 *
 * The falsifier for zflash's bootstrap: `zflash` with no arguments, on a
 * machine that has never flashed before.
 *
 * MEASURED ON main BEFORE THIS FILE EXISTED (e15299e0): cli.ts's autoDiscoverIso
 * called bail(2, "no Zeta installer ISO found under ~/Downloads/...") and
 * exited, and it ran BEFORE autoDownloadFreshIsoIfNeeded. So the auto-pull was
 * unreachable for the one operator it exists for — the bare `zflash` form both
 * metal runbooks recommend could not bootstrap itself.
 *
 * WHY THIS FILE, AND NOT A SOURCE-STRING ASSERTION. A test that greps cli.ts for
 * the signature `discoverLocalIso(...): ... | null` passes unchanged when a
 * bail() is put back INSIDE the body: the signature stays honest while the body
 * stops being. Mutation testing said so out loud — that assertion SURVIVED the
 * bails-again mutation. So the property is asserted behaviourally instead: point
 * the function at a directory and check what it RETURNS. A reintroduced
 * process.exit takes the test runner down with it, which is a kill, not a pass.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, utimesSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { discoverLocalIso, NO_LOCAL_ISO_HELP, ISO_GLOB_PREFIX } from "./iso-discovery.ts";

const root = mkdtempSync(join(tmpdir(), "zflash-discovery-"));
let n = 0;

/** Build a Downloads folder containing the named files, oldest-first by mtime. */
function downloadsWith(files: readonly string[]): string {
  n += 1;
  const dir = join(root, "dl" + String(n));
  mkdirSync(dir, { recursive: true });
  let t = 1_700_000_000;
  for (const f of files) {
    const p = join(dir, f);
    writeFileSync(p, "iso");
    utimesSync(p, t, t);
    t += 3600;
  }
  return dir;
}

describe("the bootstrap case: nothing on disk must not be an exit", () => {
  test("an EMPTY Downloads folder returns `none` — it does not exit the process", () => {
    // If this ever bails again, the process dies here and the whole run fails.
    const r = discoverLocalIso("x86_64", downloadsWith([]));
    expect(r.kind).toBe("none");
  });

  test("a Downloads folder that does not exist returns `none`", () => {
    const r = discoverLocalIso("x86_64", join(root, "definitely-not-here"));
    expect(r.kind).toBe("none");
  });

  test("a Downloads folder with unrelated files returns `none`", () => {
    const r = discoverLocalIso("x86_64", downloadsWith(["ubuntu.iso", "notes.txt", "photo.jpg"]));
    expect(r.kind).toBe("none");
  });

  test("`none` is distinct from `refused` — only one of them may reach the pull", () => {
    const none = discoverLocalIso("x86_64", downloadsWith([]));
    const refused = discoverLocalIso("x86_64", downloadsWith([`${ISO_GLOB_PREFIX}25.11-ci1-2026-08-20-aarch64.iso`]));
    expect(none.kind).toBe("none");
    expect(refused.kind).toBe("refused");
  });
});

describe("a positively-wrong arch is still REFUSED, never downgraded to `none`", () => {
  test("only wrong-arch ISOs present => refused, with the reason preserved", () => {
    const r = discoverLocalIso("x86_64", downloadsWith([`${ISO_GLOB_PREFIX}25.11-ci1-2026-08-20-aarch64.iso`]));
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.error.length).toBeGreaterThan(0);
  });

  test("refusing here is what stops a download from papering over a mismatch", () => {
    // `refused` must NOT be reachable as `none`: the caller routes `none` to the
    // CI pull, and a pull that hides a real arch mismatch produces a stick that
    // simply will not boot on the target board.
    const r = discoverLocalIso("aarch64", downloadsWith([`${ISO_GLOB_PREFIX}25.11-ci1-2026-08-20-x86_64.iso`]));
    expect(r.kind).not.toBe("none");
  });
});

describe("when there IS a usable ISO, discovery still picks the right one", () => {
  test("the matching arch wins over a newer wrong-arch ISO", () => {
    const dir = downloadsWith([
      `${ISO_GLOB_PREFIX}25.11-ci1-2026-08-01-x86_64.iso`,
      `${ISO_GLOB_PREFIX}25.11-ci2-2026-08-20-aarch64.iso`, // newer, wrong arch
    ]);
    const r = discoverLocalIso("x86_64", dir);
    expect(r.kind).toBe("found");
    if (r.kind === "found") expect(r.path).toContain("x86_64");
  });

  test("newest wins among same-arch candidates", () => {
    const dir = downloadsWith([
      `${ISO_GLOB_PREFIX}25.11-ci1-2026-08-01-x86_64.iso`,
      `${ISO_GLOB_PREFIX}25.11-ci9-2026-08-20-x86_64.iso`,
    ]);
    const r = discoverLocalIso("x86_64", dir);
    expect(r.kind).toBe("found");
    if (r.kind === "found") expect(r.path).toContain("ci9");
  });

  test("a directory named like an ISO is not returned as one", () => {
    const dir = downloadsWith([]);
    mkdirSync(join(dir, `${ISO_GLOB_PREFIX}25.11-ci1-2026-08-20-x86_64.iso`), { recursive: true });
    expect(discoverLocalIso("x86_64", dir).kind).toBe("none");
  });
});

describe("the operator-facing refusal text still exists for the caller to use", () => {
  test("it names the glob it searched and both escape hatches", () => {
    expect(NO_LOCAL_ISO_HELP).toContain(ISO_GLOB_PREFIX);
    expect(NO_LOCAL_ISO_HELP).toContain("build-ai-cluster-iso");
    expect(NO_LOCAL_ISO_HELP).toContain("zflash <path/to/iso>");
  });
});

process.on("exit", () => {
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});
