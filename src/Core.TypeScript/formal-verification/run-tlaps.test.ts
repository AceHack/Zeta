// Falsifier for the vacuity that let `tlaps-proof` report a verified toolchain
// it did not have.
//
// Run 28619870340 (2026-07-02, `main`): the toolchain build failed, linux.sh
// swallowed it (`|| echo "⚠ from-opam-git failed … continuing"`), and the
// dedicated "Verify TLAPS toolchain" step printed `OK: TLAPS toolchain ready`
// anyway — because `checkToolchain` returned an `opam exec` command line
// whenever *opam* was on PATH, without ever asking whether tlapm was behind
// it. One step later every spec failed with exit 127 (command not found).
//
// A check that cannot fail is not a check. This test is the one that fails.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const posix = process.platform !== "win32";
const runner = join(import.meta.dir, "run-tlaps.ts");

/** A PATH holding an `opam` that resolves nothing, and no `tlapm` at all. */
function sandbox(): { readonly env: Record<string, string> } {
  const dir = mkdtempSync(join(tmpdir(), "tlaps-toolchain-"));
  const home = mkdtempSync(join(tmpdir(), "tlaps-home-"));
  const fakeOpam = join(dir, "opam");
  // Exactly the observed reality: opam is installed, `opam exec … tlapm` is not.
  writeFileSync(fakeOpam, "#!/bin/sh\nexit 127\n", "utf8");
  chmodSync(fakeOpam, 0o755);
  return { env: { PATH: `${dir}:/usr/bin:/bin`, HOME: home } };
}

describe("run-tlaps --check-toolchain", () => {
  test("the runner exists where the workflow invokes it", () => {
    // tlaps-proof.yml runs this exact path; a rename that misses the workflow
    // is the other way this lane goes dark.
    expect(existsSync(runner)).toBe(true);
  });

  test.if(posix)("refuses to report ready when opam is present but tlapm is not", () => {
    const { env } = sandbox();
    const result = spawnSync(process.execPath, [runner, "--check-toolchain"], {
      encoding: "utf8",
      env,
      cwd: join(import.meta.dir, "..", "..", ".."),
    });
    const combined = `${result.stdout}\n${result.stderr}`;
    expect(combined).not.toContain("OK: TLAPS toolchain ready");
    expect(combined).toContain("TLAPS toolchain not ready");
    // Exit 2 is the documented "toolchain not ready" code — orthogonal to 1
    // (unproved obligation), so CI can tell a dark lane from a failed proof.
    expect(result.status).toBe(2);
  }, 60_000);

  test.if(posix)("--all also refuses, rather than dying at exit 127 per spec", () => {
    const { env } = sandbox();
    const result = spawnSync(process.execPath, [runner, "--all"], {
      encoding: "utf8",
      env,
      cwd: join(import.meta.dir, "..", "..", ".."),
    });
    expect(`${result.stdout}\n${result.stderr}`).toContain("TLAPS toolchain not ready");
    expect(result.status).toBe(2);
  }, 60_000);
});
