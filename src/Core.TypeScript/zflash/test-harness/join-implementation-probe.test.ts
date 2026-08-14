/**
 * 081KSNY2Z0008QG0R0008PN7RQ scenario 5 — FIRST-blocker probe tests.
 *
 * The load-bearing test here is the LAST one: it runs the probe against the
 * real guest tree and pins that no join is implemented yet. When that test
 * fails, the blocker has cleared and the scenario gets promoted. Every test
 * above it drives the probe from injected fixtures, so the probe itself is
 * falsified independently of the repository's current state.
 */

import { describe, expect, test } from "bun:test";

import {
  GUEST_SOURCE_ROOTS,
  defaultJoinProbeFileSystem,
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

  test("describePromotionSignal names both blockers, in order", () => {
    const message = describePromotionSignal([{ filePath: "guest/join.txt", marker: "m" }]);

    expect(message).toContain("PROMOTION SIGNAL");
    expect(message).toContain("FIRST blocker");
    expect(message).toContain("SECOND blocker");
    expect(message).toContain("SLIRP NAT");
    expect(message).toContain("Do not dispatch it before both are done");
  });
});

describe("081KSNY2Z0008QG0R0008PN7RQ scenario 5 first-blocker tripwire", () => {
  test("the guest does not yet emit cluster-join markers (fails when the join lands)", () => {
    const result = probeJoinImplementation(defaultJoinProbeFileSystem());

    if (result.kind === "join-markers-emitted") {
      throw new Error(describePromotionSignal(result.sightings));
    }

    expect(result.rootsScanned).toEqual(GUEST_SOURCE_ROOTS);
    expect(result.filesScanned).toBeGreaterThan(10);
  });
});
