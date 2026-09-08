import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { INSTALL_SUBSTRATE_FILES } from "./install-substrate-files.ts";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

describe("zflash freshness gate watches paths that can actually change", () => {
  // B1a. The gate runs `git diff --quiet HEAD origin/main -- <path>` and reads
  // exit 0 as "clean". A pathspec matching NOTHING also exits 0 -- measured, not
  // assumed, in the sibling test below. So a watched path that does not exist is
  // not a weak check; it is a check that cannot fail, and it reports the
  // reassuring answer forever.
  //
  // The list named `full-ai-cluster/usb-nixos-installer/flake.nix`, retired under
  // work-item 081KZKS9A6B08QG0R0008EG72M, while the flake the ISO is actually
  // built from -- `full-ai-cluster/flake.nix` -- was not watched at all.
  it("every watched file exists in the repository", () => {
    const missing = INSTALL_SUBSTRATE_FILES.filter(
      (file) => !existsSync(join(REPO_ROOT, file)),
    );
    expect(missing).toEqual([]);
  });

  it("a pathspec matching nothing exits 0, which is why the above matters", () => {
    // The property that makes a missing entry vacuous rather than noisy. If git
    // ever started erroring on an unmatched pathspec, the guard above would be
    // redundant -- so pin the behaviour the guard is compensating for.
    let status = -1;
    try {
      execFileSync(
        "git",
        ["-C", REPO_ROOT, "diff", "--quiet", "HEAD", "HEAD", "--", "no/such/path/here.txt"],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      status = 0;
    } catch (e: unknown) {
      status = e && typeof e === "object" && "status" in e ? Number((e as { status: number }).status) : -1;
    }
    expect(status).toBe(0);
  });

  it("watches the flake the ISO is actually built from", () => {
    // build-ai-cluster-iso.yml builds full-ai-cluster/flake.nix and filters on it
    // plus its lock. Anything the ISO's content depends on must be diffable here,
    // or an operator can flash a stick built from a stale flake and be told the
    // checkout is fresh.
    expect(INSTALL_SUBSTRATE_FILES).toContain("full-ai-cluster/flake.nix");
    expect(INSTALL_SUBSTRATE_FILES).toContain("full-ai-cluster/flake.lock");
  });
});
