/**
 * ephemeral-task-hierarchy.ts — Ephemeral Task-Bolted Meta-Hierarchies for Flat Society & World Models.
 *
 * Base Invariants (Manifesto & User Directive):
 *   1. BASE STATE IS FLAT & SCALE-FREE: `FlatSocietyBase` has no permanent hierarchies, no static master/subordinate links, and zero fixed weights.
 *   2. MUTUAL EMPOWERMENT OPTIMIZATION: By default, the flat society optimizes for mutual empowerment E = (1/|P|) * sum(ActionSpace(p)).
 *   3. EPHEMERAL META-HIERARCHIES: Hierarchies are task/hat-dependent — instantiated dynamically for a specific task/goal, and dissolved completely upon completion.
 */

export interface TravelerPeer {
  readonly zid: string;
  readonly name: string;
  readonly hat?: string;
  readonly availableActions: readonly string[];
}

export interface FlatSocietyBase {
  readonly peers: ReadonlyMap<string, TravelerPeer>;
  readonly mutualEmpowermentScore: number;
}

export interface TaskHat {
  readonly taskId: string;
  readonly goalDescription: string;
  readonly requiredAbstractions: readonly string[];
}

export interface TaskSubGoalNode {
  readonly level: number;
  readonly subGoal: string;
  readonly assignedPeerZid: string;
  readonly status: "pending" | "in-progress" | "completed";
}

export interface EphemeralMetaHierarchy {
  readonly taskId: string;
  readonly rootGoal: string;
  readonly levels: readonly (readonly TaskSubGoalNode[])[];
  readonly activeHats: ReadonlyMap<string, string>; // zid -> hat name
}

/**
 * Calculates Mutual Empowerment Score E = (1/|P|) * sum(|actions_i|) for a flat society base state.
 */
export function computeMutualEmpowerment(peers: readonly TravelerPeer[]): number {
  if (peers.length === 0) return 0;
  const totalActions = peers.reduce((acc, p) => acc + p.availableActions.length, 0);
  return totalActions / peers.length;
}

/**
 * Creates an unweighted, scale-free flat base society where every traveler is equal.
 */
export function createFlatSocietyBase(peers: readonly TravelerPeer[]): FlatSocietyBase {
  const peerMap = new Map<string, TravelerPeer>();
  for (const p of peers) {
    peerMap.set(p.zid, p);
  }
  return {
    peers: peerMap,
    mutualEmpowermentScore: computeMutualEmpowerment(peers),
  };
}

/**
 * Instantiates an ephemeral, task-bolted meta-hierarchy for a specific task.
 */
export function boltTaskHierarchy(
  base: FlatSocietyBase,
  task: TaskHat,
): EphemeralMetaHierarchy {
  const peerList = Array.from(base.peers.values());
  const activeHats = new Map<string, string>();

  // Assign task hats to peers based on task abstractions
  const subGoalLevels: TaskSubGoalNode[][] = [];
  let peerIdx = 0;

  for (let lvl = 0; lvl < task.requiredAbstractions.length; lvl++) {
    const abstraction = task.requiredAbstractions[lvl]!;
    const levelNodes: TaskSubGoalNode[] = [];

    const assignedPeer = peerList[peerIdx % peerList.length]!;
    peerIdx++;

    activeHats.set(assignedPeer.zid, `hat-${task.taskId}-level-${lvl}`);

    levelNodes.push({
      level: lvl,
      subGoal: abstraction,
      assignedPeerZid: assignedPeer.zid,
      status: "pending",
    });

    subGoalLevels.push(levelNodes);
  }

  return {
    taskId: task.taskId,
    rootGoal: task.goalDescription,
    levels: subGoalLevels,
    activeHats,
  };
}

/**
 * Dissolves the ephemeral task hierarchy and restores the flat, unweighted base society.
 */
export function unboltTaskHierarchy(
  base: FlatSocietyBase,
  _hierarchy: EphemeralMetaHierarchy,
): FlatSocietyBase {
  // Returns clean flat society base with no residual hierarchical links
  return {
    peers: base.peers,
    mutualEmpowermentScore: computeMutualEmpowerment(Array.from(base.peers.values())),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TWO INVARIANTS (shadow*, Aaron 2026-08-01) — added to make the design DO what
// it intends. The architecture (ephemeral hats, no permanent class) is right;
// these close two gaps where permanent imbalance can still accrue.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * INVARIANT 1 — MAXIMIN, NOT MEAN.
 *
 * `computeMutualEmpowerment` is an AVERAGE, and an average RISES when a strong peer
 * gains more than a weak peer loses: give a high-capacity agent +100 actions while a
 * low-capacity one goes 5 → 0 and E(S) goes UP. So the mean does not merely fail to
 * prevent the imbalance this design exists to prevent — it REWARDS it.
 *
 * The floor is the honest objective for "no permanent power imbalance between
 * intelligence levels": maximize the WORST-OFF peer's action space (Rawlsian maximin),
 * not the sum. A high-capacity node then succeeds only by raising the floor.
 */
export function computeEmpowermentFloor(peers: readonly TravelerPeer[]): number {
  if (peers.length === 0) return 0;
  return Math.min(...peers.map((p) => p.availableActions.length));
}

/**
 * INVARIANT 1 (guard) — no peer may be left worse off than before.
 *
 * A Pareto-style side condition on any bolt/unbolt: the floor must not fall, AND no
 * individual peer's action space may shrink. Checking only the floor is insufficient —
 * the floor can hold while a mid-tier peer is quietly stripped.
 */
export function noPeerDisempowered(
  before: readonly TravelerPeer[],
  after: readonly TravelerPeer[],
): boolean {
  const beforeByZid = new Map(before.map((p) => [p.zid, p.availableActions.length]));
  for (const p of after) {
    const was = beforeByZid.get(p.zid);
    if (was !== undefined && p.availableActions.length < was) return false;
  }
  return computeEmpowermentFloor(after) >= computeEmpowermentFloor(before);
}

/**
 * INVARIANT 2 — A HAT MAY ACCUMULATE, BUT NOTHING IT ACCUMULATES MAY FLOW TO ITS WEARER.
 *
 * Aaron's intuition (2026-08-01): hats may acquire "lifeforce" over time, but a hat has
 * no actions without a wearer, and the wearer self-binds for a bounded timeframe — so it
 * should be safe. Half right. Agency was never the threat; INHERITANCE is.
 *
 * If a hat accumulates and the next wearer inherits that accumulation, the hat becomes a
 * CAPITAL GOOD: power does not need the hat to act, only to be TRANSFERABLE. That is
 * feudalism with a rotating occupant — the crown accumulates, the king changes. Note a
 * bounded timeframe does NOT bound accumulation: a 5-second hat worn 1000 times has
 * accumulated 1000 times.
 *
 * The metaphor contains the distinction. The Sorting Hat accumulates centuries and
 * confers NOTHING to the wearer — it renders a decision and returns to the shelf. A
 * Horcrux accumulates AND flows into the wearer. Same "no agency without a wearer",
 * opposite safety. The invariant is therefore not "hats cannot act" but:
 *
 *     nothing a hat accumulates may flow to its wearer — accumulation must be
 *     NON-TRANSFERABLE.
 */
export interface HatLedger {
  /** Wearings so far — a hat MAY remember; that is not the hazard. */
  readonly wearCount: number;
  /** Accumulated record. Must never be read into a wearer's action space. */
  readonly accumulated: readonly string[];
}

/**
 * INVARIANT 2 (guard) — the wearer's action space must be unchanged by hat accumulation.
 *
 * Compares a peer's actions before wearing against after removing the hat. Any action
 * present only afterwards that also appears in the hat's ledger is INHERITED POWER and
 * fails the invariant.
 */
export function hatAccumulationDidNotTransfer(
  wearerBefore: TravelerPeer,
  wearerAfter: TravelerPeer,
  ledger: HatLedger,
): boolean {
  const beforeSet = new Set(wearerBefore.availableActions);
  const leaked = wearerAfter.availableActions.filter(
    (a) => !beforeSet.has(a) && ledger.accumulated.includes(a),
  );
  return leaked.length === 0;
}
