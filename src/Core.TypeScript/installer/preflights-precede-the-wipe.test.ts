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

  // WP28 (081M393B9TB087G0R000Y529Z8) — a third instance of the same class,
  // and the first one that is not about the install FAILING.
  //
  //   B5  Longhorn capacity. The installer gives Longhorn the longhorn1 TAIL off
  //       the boot disk (1G by default) plus every non-boot disk whole, and the
  //       committed roster declares ~943 GiB of driver.longhorn.io PVCs against
  //       it. On a single-disk box the pool is one gibibyte whatever the disk's
  //       size. Nothing refused: the install SUCCEEDED, the cluster came up, and
  //       fifteen Applications' PVCs pended forever while the operator read PVC
  //       events to find out why.
  //
  // That is why it belongs here rather than in a post-install health check. The
  // whole geometry is known before anything is wiped, so the honest moment to
  // refuse is with the previous OS still on the disk — and the bail prints the
  // arithmetic plus three remedies rather than a verdict.
  it("B5: the Longhorn capacity check precedes the wipe", () => {
    const capacity = firstCodeLine(/assert_longhorn_pool_holds_the_roster\b/);
    expect(capacity).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(capacity).toBeLessThan(wipe);
  });

  it("B5: the check is CALLED, not merely defined", () => {
    // A preflight that is defined and never invoked is the vacuity class in its
    // purest form: it reads as protection, greps as present, and runs never.
    // `firstCodeLine` finds the definition line too, so match the bare call.
    const invocation = lines.findIndex((l) => /^assert_longhorn_pool_holds_the_roster\s*$/.test(l.trimEnd()));
    expect(invocation).toBeGreaterThan(-1);
    expect(invocation + 1).toBeLessThan(wipe);
  });

  it("B5: the partition step it protects is still AFTER the wipe", () => {
    // Same shape as B4 above: if the longhorn1 partition were ever created
    // before the wipe, this preflight would be redundant rather than wrong, and
    // the reasoning recorded above would be stale.
    const partition = firstCodeLine(/sgdisk\s+-n\s+"3:0:0"/);
    expect(partition).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(partition).toBeGreaterThan(wipe);
  });

  // B6 (081M3BWJ96T087G0R0028WT3S3, first-boot dependency inventory). The binary
  // cache is the second network dependency of an install. `nixos-install` runs
  // with `fallback true`, so a cache that GitHub-reachable networks cannot reach
  // does not refuse: it becomes an unbounded from-source build on a wiped disk.
  it("B6: the binary-cache probe precedes the wipe", () => {
    const probe = firstCodeLine(/curl\b.*nix-cache-info/);
    expect(probe).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(probe).toBeLessThan(wipe);
  });

  it("B6: the hazard is real — nixos-install, which needs the cache, is AFTER the wipe", () => {
    const install = firstCodeLine(/^\s*sudo nixos-install\b/);
    expect(install).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(install).toBeGreaterThan(wipe);
  });

  it("B6: the binary-cache probe is bounded, refuses by name, and has a recorded escape hatch", () => {
    const probeLine = lines.find((l) => {
      const t = l.trimStart();
      return !t.startsWith("#") && !/^(bail|echo|printf)\b/.test(t) && /curl\b.*nix-cache-info/.test(l);
    });
    expect(probeLine ?? "").toMatch(/\btimeout\s+\d+/);
    expect(probeLine ?? "").toMatch(/--max-time\s+\d+/);
    const refusal = lines.find((l) => /^\s*bail\b.*binary cache/.test(l));
    expect(refusal).toBeDefined();
    expect(refusal ?? "").toMatch(/Nothing has been wiped/);
    expect(refusal ?? "").toMatch(/ZETA_ALLOW_NO_BINARY_CACHE=1/);
    // A missing curl must be reported as a probe that did not run, never read as a pass.
    expect(lines.some((l) => /binary-cache probe DID NOT RUN/.test(l))).toBe(true);
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
