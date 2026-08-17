/**
 * src/Core.TypeScript/zflash/test-harness/join-implementation-probe.ts
 *
 * 081KSNY2Z0008QG0R0008PN7RQ scenario 5 (cluster-joining) — FIRST-blocker probe.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `cluster-joining` has been recorded everywhere as
 * `blocked-on-multi-vm-orchestration` — as if the only thing standing between
 * us and a real join test were QEMU networking (two VMs on `-netdev user`
 * SLIRP NAT cannot see each other) plus serial boot ordering.
 *
 * That is a real blocker. It is the SECOND one.
 *
 * The FIRST blocker is that **there is no join to observe**. The success
 * contract for the scenario is `B0891_CLUSTER_JOIN_SERIAL_MARKERS` in
 * `serial-markers.ts`, and as of this file's landing those two strings are
 * produced by exactly one thing in the repository: a mock serial log inside
 * `multi-vm.test.ts`. No guest artifact emits them — not `zeta-install.sh`,
 * not any module under `full-ai-cluster/nixos/`. The guest's own cluster
 * config says so out loud (`k3s-server.nix`: "MULTI-NODE TODO: workers").
 *
 * That ordering matters operationally, because it changes what a fix buys.
 * Give the VMs a shared L2 segment and boot them concurrently, and the
 * joining node would boot, emit nothing, and time out — the scenario would
 * report `failed` rather than `skipped`. The networking work is necessary and
 * not sufficient, and building it first would produce a harness that looks
 * finished while testing nothing.
 *
 * WHAT THIS PROBE IS
 * ------------------
 * A promotion tripwire, not a prohibition. It pins the *current* fact so the
 * claim stops being folklore in a comment and becomes something CI rechecks.
 * The day someone implements the join and emits the markers from the guest,
 * this probe flips to `join-markers-emitted` and the accompanying test fails
 * with an instruction to PROMOTE the scenario. A failure here is good news.
 *
 * Per `.claude/rules/interfaces-free-classes-earned-under-rules.md` the probe
 * takes its file access through an injected reader interface (no ambient I/O,
 * so it is DST-replayable per §7 / §13 noninterference); the default reader is
 * supplied at the call site, never captured here.
 */

import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { B0891_CLUSTER_JOIN_SERIAL_MARKERS } from "./serial-markers";

/**
 * The guest-side trees a real join implementation would have to live in for a
 * booted node to announce itself on serial. Deliberately NOT the whole repo:
 * the harness's own TypeScript defines and mocks these markers by design, and
 * a probe that counted those would never be able to report absence.
 */
export const GUEST_SOURCE_ROOTS: readonly string[] = ["full-ai-cluster/nixos", "full-ai-cluster/usb-nixos-installer"];

/** Injected file access — keeps the probe free of ambient I/O. */
export interface JoinProbeFileSystem {
  readonly listFilesRecursively: (root: string) => readonly string[];
  readonly readFile: (path: string) => string;
}

export interface JoinMarkerSighting {
  readonly filePath: string;
  readonly marker: string;
}

/**
 * Neutral fact, per `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`:
 * the probe reports what it observed, never a verdict about whether that is
 * good. `absent` is today's expected reading and `emitted` is the promotion
 * signal — the caller's policy decides which is which.
 */
export type JoinImplementationProbeResult =
  | { readonly kind: "join-markers-absent"; readonly rootsScanned: readonly string[]; readonly filesScanned: number }
  | { readonly kind: "join-markers-emitted"; readonly sightings: readonly JoinMarkerSighting[] };

/** Default reader. Bounded to the named roots; never walks `references/prior-art`. */
export function createDefaultJoinProbeFileSystem(repoRoot: string): JoinProbeFileSystem {
  return {
    listFilesRecursively: (root: string): readonly string[] => {
      const absoluteRoot = join(repoRoot, root);
      const found: string[] = [];
      const walk = (dir: string): void => {
        let entries: Dirent[];
        try {
          entries = readdirSync(dir, { withFileTypes: true });
        } catch {
          // A missing guest root is itself an honest "nothing here to emit".
          return;
        }
        for (const entry of entries) {
          const entryPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(entryPath);
          } else if (entry.isFile()) {
            found.push(entryPath);
          }
        }
      };
      walk(absoluteRoot);
      return found;
    },
    readFile: (path: string): string => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return "";
      }
    },
  };
}

/**
 * Scan the guest source roots for the cluster-join serial markers.
 *
 * Returns the neutral fact. See {@link JoinImplementationProbeResult}.
 */
export function probeJoinImplementation(
  fileSystem: JoinProbeFileSystem,
  roots: readonly string[] = GUEST_SOURCE_ROOTS,
  markers: readonly string[] = B0891_CLUSTER_JOIN_SERIAL_MARKERS,
): JoinImplementationProbeResult {
  const sightings: JoinMarkerSighting[] = [];
  let filesScanned = 0;

  for (const root of roots) {
    for (const filePath of fileSystem.listFilesRecursively(root)) {
      filesScanned += 1;
      const contents = fileSystem.readFile(filePath);
      if (contents.length === 0) {
        continue;
      }
      for (const marker of markers) {
        if (contents.includes(marker)) {
          sightings.push({ filePath, marker });
        }
      }
    }
  }

  if (sightings.length > 0) {
    return { kind: "join-markers-emitted", sightings };
  }
  return { kind: "join-markers-absent", rootsScanned: roots, filesScanned };
}

/**
 * The message a promotion failure should carry. Kept next to the probe so the
 * instruction cannot drift away from the check that triggers it.
 *
 * HISTORICAL NOTE — this direction has FIRED. When this function landed the
 * expected reading was `absent`, and `emitted` was the promotion signal. On
 * 2026-08-13 Aaron answered the question the signal was waiting on ("k3s's
 * join is the join, don't invent our own"), `k3s-join-observer.nix` landed,
 * and the guest started emitting. The tripwire in the accompanying test now
 * points the OTHER way — see {@link describeEmitterRegression}. This function
 * is kept because it is the message a REPEAT promotion would carry (a second
 * guest surface starting to emit), and because deleting the record of a check
 * that did its job is how the record stops being trustworthy.
 */
export function describePromotionSignal(sightings: readonly JoinMarkerSighting[]): string {
  const where = sightings.map((s) => `${s.filePath} emits ${JSON.stringify(s.marker)}`).join("; ");
  return (
    "PROMOTION SIGNAL (this failure is good news): the guest now emits the " +
    "cluster-join serial markers, so the FIRST blocker on scenario 5 " +
    "(cluster-joining) has cleared. " +
    `Observed: ${where}. ` +
    "Next: buildQemuSystemBootArgs now accepts injected netdev specs and " +
    "planMultiVMRuntime puts the two VMs on one QEMU socket L2 segment with " +
    "distinct MACs, so the SLIRP NAT isolation is no longer what stops this. " +
    "Still open: no frame has EVER crossed that segment, because " +
    "executeMultiVMRuntimePlan boots the VMs serially and terminates each on " +
    "marker match -- the listener is dead before the connector starts. Role " +
    "provisioning now has a carrier (zflash writes /zeta-firstboot.conf and " +
    "/zeta-join-token; zeta-first-boot.sh prefers the ESP copy), and so does " +
    "ADDRESSING (cluster-address.ts derives a static address from the role, " +
    "zeta-install.sh stages it, injected-cluster-address.nix applies it plus " +
    "the control-plane /etc/hosts entry -- the segment has no DHCP and no DNS, " +
    "and mDNS was already recorded as not resolving on this stack). But no " +
    "guest has booted from a joiner-flashed image, so both are unexercised " +
    "rather than working. Give the VMs a DoP-knobbed concurrent boot and " +
    "OBSERVE a booted joiner reaching the founder, THEN dispatch. Not before."
  );
}

/**
 * The message the tripwire carries NOW that the guest emits.
 *
 * Two ways to trip it, and they are the same defect wearing different clothes:
 * someone deletes the emitter, or someone edits one of the marker strings on
 * only one side of the TypeScript↔Nix boundary. Nix cannot import
 * `serial-markers.ts`, so this string comparison IS the contract between them
 * — there is no compiler that will catch a drifted space.
 */
export function describeEmitterRegression(rootsScanned: readonly string[], filesScanned: number): string {
  return (
    "REGRESSION: the guest no longer emits B0891_CLUSTER_JOIN_SERIAL_MARKERS. " +
    `Scanned ${String(filesScanned)} files across ${rootsScanned.join(", ")} and found none. ` +
    "Either full-ai-cluster/nixos/modules/k3s-join-observer.nix lost its emitter, or a " +
    "marker string changed on ONE side of the TypeScript-to-Nix boundary — the literals in " +
    "that module must stay byte-identical to B0891_CLUSTER_JOIN_SERIAL_MARKERS in " +
    "serial-markers.ts, five-space runs included, and nothing but this check enforces it. " +
    "Fix the emitter or update both sides together; do NOT relax the marker set."
  );
}

/**
 * Repo-root-bound reader, so callers need no path arithmetic of their own.
 * The root is derived by trimming the known source subpath off this module's
 * own location — no relative-segment walking, which keeps the derivation
 * legible and independent of how deep this file sits.
 */
export function defaultJoinProbeFileSystem(): JoinProbeFileSystem {
  const here = typeof import.meta.dir === "string" ? import.meta.dir : fileURLToPath(new URL(".", import.meta.url));
  const marker = "/src/Core.TypeScript/";
  const cut = here.indexOf(marker);
  const repoRoot = cut < 0 ? process.cwd() : here.slice(0, cut);
  return createDefaultJoinProbeFileSystem(repoRoot);
}
