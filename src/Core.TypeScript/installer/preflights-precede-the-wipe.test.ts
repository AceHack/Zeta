import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

const INSTALL_SH = join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh");
const lines = readFileSync(INSTALL_SH, "utf8").split("\n");

/**
 * 1-based line of the first line that EXECUTES something matching `re`.
 *
 * Comments are skipped, and so are lines whose first token is `bail` or `echo` --
 * those MENTION a command inside a message rather than running it. A first draft
 * without that second filter reported the `git ls-remote` inside the bail text as
 * the probe, so removing the actual probe still "found" one and the ordering
 * assertion passed. Mutation testing surfaced it: deleting the command killed only
 * one of the two tests that should have died.
 */
function firstCodeLine(re: RegExp): number {
  const idx = lines.findIndex((l) => {
    const t = l.trimStart();
    if (t.startsWith("#")) return false;
    if (/^(bail|echo|printf)\b/.test(t)) return false;
    return re.test(l);
  });
  return idx === -1 ? Number.POSITIVE_INFINITY : idx + 1;
}

describe("installer preflights run BEFORE anything is destroyed", () => {
  // The recurring defect class in this installer: a HARD REQUIREMENT checked only
  // at the moment it is used, which is after the disks are gone. Two instances so
  // far, both real:
  //
  //   B3  UEFI. Surfaced at `bootctl install` -- after wipe, partition, format
  //       and the full closure download. Previous OS gone, nothing bootable.
  //   B4  Network. `git clone` sits ~190 lines below the wipe, so a machine with
  //       no working network was wiped first and then failed to fetch the thing
  //       it was being installed from.
  //
  // Both are now preflights. This pins the ORDERING rather than their existence,
  // because a preflight that drifts below the wipe is worse than none: it reads
  // as protection while providing none.
  const wipe = firstCodeLine(/\bwipefs\s+-af\b/);

  it("the wipe is actually present, so this test cannot pass vacuously", () => {
    expect(wipe).toBeLessThan(Number.POSITIVE_INFINITY);
  });

  it("B3: the UEFI check precedes the wipe", () => {
    const uefi = firstCodeLine(/\/sys\/firmware\/efi/);
    expect(uefi).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(uefi).toBeLessThan(wipe);
  });

  it("B4: the repository-reachability check precedes the wipe", () => {
    const probe = firstCodeLine(/git\s+ls-remote/);
    expect(probe).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(probe).toBeLessThan(wipe);
  });

  it("B4: the hazard is real — the clone it protects is still AFTER the wipe", () => {
    // If the clone were ever moved above the wipe the preflight would be
    // redundant rather than wrong, but the reason it exists would have changed
    // and this comment would be stale. Assert the shape the reasoning rests on.
    const clone = firstCodeLine(/git\s+clone\b/);
    expect(clone).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(clone).toBeGreaterThan(wipe);
  });

  it("the network probe cannot hang the zero-typing path", () => {
    // A black-hole route that accepts SYN and never replies, or a credential
    // prompt on a private URL, would otherwise stall here forever -- on the
    // zero-typing path that is a machine which never finishes and never says why.
    const probeLine = lines.find((l) => {
      const t = l.trimStart();
      return !t.startsWith("#") && !/^(bail|echo|printf)\b/.test(t) && /git\s+ls-remote/.test(l);
    });
    expect(probeLine).toBeDefined();
    expect(probeLine ?? "").toMatch(/\btimeout\s+\d+/);
    expect(probeLine ?? "").toMatch(/GIT_TERMINAL_PROMPT=0/);
  });
});
