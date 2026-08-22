/**
 * 081KSNY2Z0008QG0R0008PN7RQ scenario 5 — join marker-emission probe tests.
 *
 * The load-bearing tests are in the LAST describe block: they run the probe
 * against the real guest tree. Every test above them drives the probe from
 * injected fixtures, so the probe itself is falsified independently of the
 * repository's current state.
 *
 * The real-tree assertion INVERTED on 2026-08-13 and the inversion is the
 * point. It landed asserting absence (no join existed to observe) and was
 * built to fail the day one arrived. Aaron answered the open question — "k3s's
 * join is the join, don't invent our own" — k3s-join-observer.nix landed, and
 * it fired. It now asserts presence, and keeps earning its place by being the
 * only check standing between the Nix marker literals and the TypeScript
 * constants they must match byte for byte.
 */

import { describe, expect, test } from "bun:test";

import {
  GUEST_SOURCE_ROOTS,
  defaultJoinProbeFileSystem,
  describeEmitterRegression,
  describePromotionSignal,
  probeJoinImplementation,
  type JoinProbeFileSystem,
} from "./join-implementation-probe";
import { B0891_CLUSTER_JOIN_SERIAL_MARKERS } from "./serial-markers";

function fixtureFileSystem(files: Record<string, string>): JoinProbeFileSystem {
  return {
    listFilesRecursively: (root: string) => Object.keys(files).filter((path) => path.startsWith(root)),
    readFile: (path: string) => files[path] ?? "",
  };
}

const JOIN_MARKER = B0891_CLUSTER_JOIN_SERIAL_MARKERS[0] ?? "";

describe("probeJoinImplementation", () => {
  test("reports absent when the guest carries no join marker", () => {
    const reader = fixtureFileSystem({ "guest/one.txt": "hostname node-a", "guest/two.txt": "k3s enable" });

    const result = probeJoinImplementation(reader, ["guest"]);

    expect(result.kind).toBe("join-markers-absent");
    if (result.kind === "join-markers-absent") {
      expect(result.filesScanned).toBe(2);
    }
  });

  test("reports emitted, with provenance, once the guest carries a marker", () => {
    expect(JOIN_MARKER.length).toBeGreaterThan(0);
    const reader = fixtureFileSystem({ "guest/join.txt": JOIN_MARKER });

    const result = probeJoinImplementation(reader, ["guest"]);

    expect(result.kind).toBe("join-markers-emitted");
    if (result.kind === "join-markers-emitted") {
      expect(result.sightings).toHaveLength(1);
      expect(result.sightings[0]?.filePath).toBe("guest/join.txt");
      expect(result.sightings[0]?.marker).toBe(JOIN_MARKER);
    }
  });

  test("a marker outside the guest roots is not an implementation", () => {
    const reader = fixtureFileSystem({ "harness/mock.txt": JOIN_MARKER, "guest/one.txt": "nothing here" });

    const result = probeJoinImplementation(reader, ["guest"]);

    expect(result.kind).toBe("join-markers-absent");
  });

  test("describePromotionSignal names the blockers that actually remain", () => {
    const message = describePromotionSignal([{ filePath: "guest/join.txt", marker: "m" }]);

    expect(message).toContain("PROMOTION SIGNAL");
    expect(message).toContain("FIRST blocker");
    // The SLIRP isolation is cleared: the planner now emits a shared socket
    // segment. Asserting it as an open blocker would pin a false statement.
    expect(message).toContain("no longer what stops this");
    // What genuinely remains, and the message must keep saying so.
    expect(message).toContain("serially");
    // Was `toContain("control-plane")`, pinning "a zflash-prepared image still
    // installs HOST=control-plane". That statement became FALSE on 2026-08-17
    // when zflash gained a role carrier, so the assertion moved to the claim
    // that is now true and is the one worth guarding: the carrier exists and
    // has never been exercised. Rounding that up to "role provisioning works"
    // is the failure this line exists to catch.
    expect(message).toContain("unexercised rather than working");
    expect(message).toContain("Not before");
  });
});

describe("081KSNY2Z0008QG0R0008PN7RQ scenario 5 marker-emission contract", () => {
  // THE TRIPWIRE FIRED, AND THIS IS WHAT IT TURNED INTO.
  //
  // Landed 2026-08-13 (PR #10493) pointing the other way: it asserted the
  // guest emitted NOTHING and was to fail the day a join landed, because a
  // failure there was good news. Aaron then answered the question the whole
  // thing was waiting on — "k3s's join is the join, don't invent our own" —
  // k3s-join-observer.nix landed, and the tripwire fired as designed.
  //
  // It is now inverted rather than deleted, because the same scan answers a
  // second, permanent question: Nix cannot import serial-markers.ts, so the
  // marker literals live in two files with no compiler between them. This is
  // the only thing that notices when they drift apart.
  //
  // WHAT THIS CHECK CANNOT DO — measured by mutation, not assumed:
  //
  //   mutation                              caught here?
  //   drop one space from a marker          YES (the pair no longer matches)
  //   delete k3s-join-observer.nix          YES (regression message)
  //   keep the literal, delete the          NO  — the probe reads FILE TEXT,
  //     `log_join "${marker...}"` call            and the `let` binding still
  //                                               contains the string
  //
  // That third row is the honest limit of a string scan, and it is why
  // `full-ai-cluster/nixos/tests/k3s-agent-join.nix` exists: it boots the
  // module and waits for the markers on the actual serial console, so
  // "declared but never emitted" fails THERE. Neither check subsumes the
  // other — this one guards the cross-language contract, that one guards the
  // behaviour. Do not read a green here as "the node announces its join".
  test("the guest emits BOTH cluster-join markers, byte-identical to the TS contract", () => {
    const result = probeJoinImplementation(defaultJoinProbeFileSystem());

    if (result.kind === "join-markers-absent") {
      throw new Error(describeEmitterRegression(result.rootsScanned, result.filesScanned));
    }

    // Both markers, not just one. A partial emitter would satisfy a
    // sightings.length > 0 check while leaving the harness unable to conclude
    // anything — the contract is the pair.
    const emittedMarkers = new Set(result.sightings.map((sighting) => sighting.marker));
    expect([...emittedMarkers].sort()).toEqual([...B0891_CLUSTER_JOIN_SERIAL_MARKERS].sort());

    // And they come from the guest module that ships, not from a stray
    // comment or a doc: the emitter must be a NixOS module under the guest
    // tree, since only a module reaches a booted node's serial port.
    const emittingFiles = new Set(result.sightings.map((sighting) => sighting.filePath));
    expect([...emittingFiles].some((path) => path.endsWith("nixos/modules/k3s-join-observer.nix"))).toBe(true);
  });

  test("the promotion-signal message is retained and still names its ordering", () => {
    // Kept as a live check because describePromotionSignal is the message a
    // REPEAT promotion (a second guest surface starting to emit) would carry.
    const message = describePromotionSignal([{ filePath: "guest/join.txt", marker: "m" }]);

    expect(message).toContain("PROMOTION SIGNAL");
    expect(message).toContain("FIRST blocker");
  });

  test("the regression message names the byte-identical requirement, not just the absence", () => {
    const message = describeEmitterRegression(["full-ai-cluster/nixos"], 45);

    expect(message).toContain("REGRESSION");
    expect(message).toContain("k3s-join-observer.nix");
    expect(message).toContain("byte-identical");
    expect(message).toContain("do NOT relax the marker set");
    // The count is reported, so a "scanned zero files" tree move is legible
    // as a tree move rather than as a real regression.
    expect(message).toContain("45 files");
  });

  test("the scan is not vacuous — it really read the guest tree", () => {
    // Guards the failure mode where a moved or renamed tree makes every
    // assertion above trivially unreachable.
    const result = probeJoinImplementation(defaultJoinProbeFileSystem(), GUEST_SOURCE_ROOTS);
    const filesScanned =
      result.kind === "join-markers-absent" ? result.filesScanned : countFiles(defaultJoinProbeFileSystem());

    expect(filesScanned).toBeGreaterThan(10);
  });
});

/** File count for the vacuity guard, using the same injected reader shape. */
function countFiles(fileSystem: JoinProbeFileSystem): number {
  return GUEST_SOURCE_ROOTS.reduce((total, root) => total + fileSystem.listFilesRecursively(root).length, 0);
}
