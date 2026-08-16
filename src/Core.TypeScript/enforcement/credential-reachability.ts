/**
 * credential-reachability.ts — measure who can reach a credential, and report the FACT.
 *
 * Written for the enforcement-substrate survey
 * (docs/research/2026-08-14-what-can-actually-be-the-enforcer-...md), which established by
 * measurement that the one real credential on the Mac Studio is readable by any process
 * running as that user, with no prompt. That was previously an inherited assumption. This
 * module turns it into something a machine re-measures instead of something a doc asserts.
 *
 * TWO RULES SHAPE THE API.
 *
 * 1. Dual-use / neutral verdict (.claude/rules/dual-use-detection-is-neutral-oracle-decides.md).
 *    The verdicts name the FACT -- "reachable-without-authentication" -- never the reading.
 *    "Leaked", "insecure" and "compromised" are policy words and are absent on purpose:
 *    a credential deliberately shared by four cooperating cells is the SAME fact as one
 *    exposed by accident, and this module is not allowed to pick between those.
 *
 * 2. Noninterference (dv2 discipline #7). Nothing here reads a keychain, spawns a process,
 *    or looks at a clock. The probing is an injected effect; the classification below is
 *    pure, total, and therefore testable without a machine that has the credential on it.
 */

/**
 * What a probe observed. A record of an attempt, with no judgement attached.
 */
export interface CredentialReadOutcome {
  /** An item with this name exists in the store. */
  readonly present: boolean;
  /** The secret bytes were obtained. */
  readonly read: boolean;
  /** The store challenged the caller (ACL prompt, biometric, PIN) before answering. */
  readonly authenticationRequired: boolean;
}

/**
 * The neutral fact. Not a verdict about whether it is acceptable.
 */
export type CredentialReachability =
  /** No such item. Says nothing about whether one should exist. */
  | "absent"
  /** Any caller meeting the store's ambient conditions gets the bytes. No challenge. */
  | "reachable-without-authentication"
  /** The bytes came only after a challenge the caller could satisfy. */
  | "reachable-after-authentication"
  /** The store refused this caller. */
  | "unreachable";

/**
 * Total function from an observation to the fact it establishes.
 *
 * `present` is checked first and independently of `read`, because "absent" and "refused"
 * are different facts that an enforcement design must not conflate: the first says the
 * boundary was never tested, the second says it held.
 */
export function classifyReachability(outcome: CredentialReadOutcome): CredentialReachability {
  if (!outcome.present) return "absent";
  if (!outcome.read) return "unreachable";
  return outcome.authenticationRequired
    ? "reachable-after-authentication"
    : "reachable-without-authentication";
}

/**
 * A cell as `tools/setup/manifests/cluster-cells` declares it, plus the uid it actually
 * runs under. The uid is the load-bearing field and it is NOT derivable from the manifest:
 * the manifest names a slot and an agent, while the uid comes from how the cell is
 * provisioned. On the Mac Studio every cell is a launchd USER agent
 * (`$HOME/Library/LaunchAgents`, `gui/$(id -u)`), so all four share one uid.
 */
export interface CellOccupant {
  /** Stable slot id. Survives agent rotation -- cell-0 outlives whoever occupies it. */
  readonly cellId: string;
  /** Current occupant. Rotates by editing the manifest, so this is the fast-changing field. */
  readonly agent: string;
  /** The uid the cell's processes actually run as. */
  readonly uid: number;
}

export interface CellIsolationAssessment {
  readonly reachability: CredentialReachability;
  /** Slot ids that can obtain this credential. Slots, not agents -- see `rotationCaveat`. */
  readonly cellsWithAccess: readonly string[];
  /** True when at most one cell can reach it. */
  readonly isolated: boolean;
  /**
   * True when access follows the SLOT rather than the occupant, so an agent rotating out
   * of a cell leaves its access behind for the next occupant. This is the property that
   * makes uid-based separation weaker than it looks on a fleet whose agents rotate.
   */
  readonly rotationCaveat: boolean;
}

/**
 * Which cells can reach a credential owned by `ownerUid`.
 *
 * The rule, stated so it can be argued with: a credential that answers without a challenge
 * answers to the AMBIENT identity of the caller, and on a POSIX system run as a user that
 * ambient identity is the uid. So every cell sharing `ownerUid` reaches it, and no cell
 * with a different uid does. When the store challenges the caller, uid alone no longer
 * decides and this function reports no cells -- the challenge, not the uid, is the gate,
 * and this module cannot see who can satisfy it.
 */
export function assessCellIsolation(
  cells: readonly CellOccupant[],
  ownerUid: number,
  reachability: CredentialReachability,
): CellIsolationAssessment {
  const cellsWithAccess =
    reachability === "reachable-without-authentication"
      ? cells.filter((c) => c.uid === ownerUid).map((c) => c.cellId)
      : [];

  return {
    reachability,
    cellsWithAccess,
    isolated: cellsWithAccess.length <= 1,
    rotationCaveat: cellsWithAccess.length > 0,
  };
}

/**
 * Does binding a key policy to a code signature distinguish these cells from each other?
 *
 * This is the survey's central negative result made checkable. A signature-bound ACL
 * (macOS keychain trusted-application ACL, an LSM label on a binary path, an IMA/EVM
 * appraisal) names an EXECUTABLE. It can only separate two cells if the two cells present
 * different executable identities. On this fleet they do not: every cell is a shell script
 * -- unsigned, and therefore identified as its interpreter -- driving `bun`, which carries
 * one upstream Developer ID shared by all four cells and by everyone else who downloaded
 * the same build.
 *
 * Returns the set of code identities that map to more than one cell. Non-empty means a
 * signature-bound policy CANNOT separate those cells, whatever else it does.
 */
export function codeIdentityCollisions(
  cells: readonly CellOccupant[],
  codeIdentityOf: (cell: CellOccupant) => string,
): ReadonlyMap<string, readonly string[]> {
  const byIdentity = new Map<string, string[]>();
  for (const cell of cells) {
    const id = codeIdentityOf(cell);
    const existing = byIdentity.get(id);
    if (existing) existing.push(cell.cellId);
    else byIdentity.set(id, [cell.cellId]);
  }

  const collisions = new Map<string, readonly string[]>();
  for (const [id, cellIds] of byIdentity) {
    if (cellIds.length > 1) collisions.set(id, cellIds);
  }
  return collisions;
}
