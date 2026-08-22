import { describe, expect, test } from "bun:test";

import {
  assessCellIsolation,
  classifyReachability,
  codeIdentityCollisions,
  type CellOccupant,
} from "./credential-reachability";

/**
 * The Mac Studio as measured on 2026-08-14: four launchd USER agents, one uid.
 * `launchctl list | grep lucent.zeta` showed com.lucent.zeta.{otto,vera,lior,alexa};
 * host-loop-bootstrap.sh installs each into $HOME/Library/LaunchAgents and boots it
 * into gui/$(id -u), so the shared uid is a property of the provisioning path.
 */
const MAC_STUDIO_CELLS: readonly CellOccupant[] = [
  { cellId: "cell-0", agent: "otto", uid: 501 },
  { cellId: "cell-1", agent: "vera", uid: 501 },
  { cellId: "cell-2", agent: "lior", uid: 501 },
  { cellId: "cell-3", agent: "alexa", uid: 501 },
];

/** The same four cells under the per-cell-user proposal (option 4 in the survey). */
const SEPARATED_CELLS: readonly CellOccupant[] = [
  { cellId: "cell-0", agent: "otto", uid: 601 },
  { cellId: "cell-1", agent: "vera", uid: 602 },
  { cellId: "cell-2", agent: "lior", uid: 603 },
  { cellId: "cell-3", agent: "alexa", uid: 604 },
];

describe("classifyReachability reports the fact, and keeps absent distinct from refused", () => {
  test("CR-1: read with no challenge is reachable-without-authentication", () => {
    expect(
      classifyReachability({ present: true, read: true, authenticationRequired: false }),
    ).toBe("reachable-without-authentication");
  });

  test("CR-2: read after a challenge is a DIFFERENT fact from read without one", () => {
    expect(
      classifyReachability({ present: true, read: true, authenticationRequired: true }),
    ).toBe("reachable-after-authentication");
  });

  test("CR-3: present but refused is 'unreachable' -- the boundary held", () => {
    expect(
      classifyReachability({ present: true, read: false, authenticationRequired: true }),
    ).toBe("unreachable");
  });

  test("CR-4: absent is NOT unreachable -- an untested boundary is not a holding one", () => {
    // The conflation this guards against is the reason nine could-not-fail checks were
    // found in this repo: "nothing came back" read as "the check passed".
    expect(
      classifyReachability({ present: false, read: false, authenticationRequired: false }),
    ).toBe("absent");
    expect(
      classifyReachability({ present: false, read: false, authenticationRequired: true }),
    ).toBe("absent");
  });
});

describe("assessCellIsolation -- the measured Mac Studio baseline", () => {
  test("CI-1: an unchallenged credential is reachable by ALL FOUR cells, not one", () => {
    // This is the empirical result the survey rests on: `security find-generic-password
    // -w -s zeta-op-service-account` returned 852 bytes to an arbitrary bash process with
    // no prompt. Under one uid, that is every cell.
    const a = assessCellIsolation(MAC_STUDIO_CELLS, 501, "reachable-without-authentication");
    expect(a.cellsWithAccess).toEqual(["cell-0", "cell-1", "cell-2", "cell-3"]);
    expect(a.isolated).toBe(false);
    expect(a.rotationCaveat).toBe(true);
  });

  test("CI-2: distinct uids per cell reduce access to the owning cell alone", () => {
    const a = assessCellIsolation(SEPARATED_CELLS, 601, "reachable-without-authentication");
    expect(a.cellsWithAccess).toEqual(["cell-0"]);
    expect(a.isolated).toBe(true);
  });

  test("CI-3: separation binds the SLOT, so the rotation caveat survives isolation", () => {
    // Option 4's real defect, and the answer to open question 5. cell-0's uid is stable
    // across `agent=` edits, so isolating by uid isolates the slot; the next occupant
    // inherits every key the previous one left addressable by that uid. isolated=true and
    // rotationCaveat=true hold SIMULTANEOUSLY -- that pair is the finding.
    const a = assessCellIsolation(SEPARATED_CELLS, 601, "reachable-without-authentication");
    expect(a.isolated).toBe(true);
    expect(a.rotationCaveat).toBe(true);
  });

  test("CI-4: a challenged credential is not decided by uid, so no cell is granted", () => {
    const a = assessCellIsolation(MAC_STUDIO_CELLS, 501, "reachable-after-authentication");
    expect(a.cellsWithAccess).toEqual([]);
    expect(a.rotationCaveat).toBe(false);
  });

  test("CI-5: an absent credential grants nobody", () => {
    expect(assessCellIsolation(MAC_STUDIO_CELLS, 501, "absent").cellsWithAccess).toEqual([]);
    expect(assessCellIsolation(MAC_STUDIO_CELLS, 501, "unreachable").cellsWithAccess).toEqual([]);
  });

  test("CI-6: cells on OTHER uids are excluded -- the uid is doing real work here", () => {
    // Without this, `isolated` could pass by ignoring uid entirely.
    const mixed: readonly CellOccupant[] = [
      { cellId: "cell-0", agent: "otto", uid: 501 },
      { cellId: "cell-1", agent: "vera", uid: 999 },
    ];
    expect(
      assessCellIsolation(mixed, 501, "reachable-without-authentication").cellsWithAccess,
    ).toEqual(["cell-0"]);
  });
});

describe("codeIdentityCollisions -- why a signature-bound ACL cannot separate these cells", () => {
  test("CID-1: the measured fleet collides on ONE identity, so the ACL separates nothing", () => {
    // Measured: every cell's ProgramArguments is a .sh wrapper (unsigned -> identified as
    // its interpreter), driving bun, signed "Developer ID Application: Jarred Sumner
    // (7FRXF46ZSN)". One identity, four cells.
    const collisions = codeIdentityCollisions(MAC_STUDIO_CELLS, () => "teamid:7FRXF46ZSN/bun");
    expect(collisions.size).toBe(1);
    expect(collisions.get("teamid:7FRXF46ZSN/bun")).toEqual([
      "cell-0",
      "cell-1",
      "cell-2",
      "cell-3",
    ]);
  });

  test("CID-2: per-cell signed binaries would collide on nothing", () => {
    const collisions = codeIdentityCollisions(MAC_STUDIO_CELLS, (c) => `zeta:${c.cellId}`);
    expect(collisions.size).toBe(0);
  });

  test("CID-3: a PARTIAL split still reports exactly the colliding pair", () => {
    // Guards the shape of the answer, not just its emptiness: two cells given their own
    // signed shim and two left on shared bun must name the two that still collide.
    const collisions = codeIdentityCollisions(MAC_STUDIO_CELLS, (c) =>
      c.cellId === "cell-0" || c.cellId === "cell-1" ? `zeta:${c.cellId}` : "teamid:7FRXF46ZSN/bun",
    );
    expect(collisions.size).toBe(1);
    expect(collisions.get("teamid:7FRXF46ZSN/bun")).toEqual(["cell-2", "cell-3"]);
  });

  test("CID-4: identity is keyed by signature, NOT by the agent occupying the cell", () => {
    // Rotation does not change the code identity, which is exactly why a code-bound policy
    // is stable under rotation where a uid-bound one is not.
    const rotated: readonly CellOccupant[] = MAC_STUDIO_CELLS.map((c) => ({
      ...c,
      agent: `${c.agent}-successor`,
    }));
    const before = codeIdentityCollisions(MAC_STUDIO_CELLS, () => "teamid:7FRXF46ZSN/bun");
    const after = codeIdentityCollisions(rotated, () => "teamid:7FRXF46ZSN/bun");
    expect(after).toEqual(before);
  });
});
