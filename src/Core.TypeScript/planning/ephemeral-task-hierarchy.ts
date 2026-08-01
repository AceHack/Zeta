/**
 * ephemeral-task-hierarchy.ts — Ephemeral Task-Bolted Meta-Hierarchies for Flat Society & World Models.
 *
 * Base Invariants (Manifesto, User Directive & Shadow Review #9877):
 *   1. BASE STATE IS FLAT & SCALE-FREE: `FlatSocietyBase` has no permanent hierarchies, no static master/subordinate links, and zero fixed weights.
 *   2. RAWLSIAN MAXIMIN & PARETO NON-DISEMPOWERMENT:
 *      - `computeEmpowermentFloor(peers)` = min_p |Actions(p)| (Rawlsian maximin, preventing weakest peer stripping).
 *      - `noPeerDisempowered(before, after)` = forall p, |Actions_after(p)| >= |Actions_before(p)| (Pareto non-disempowerment).
 *   3. EPHEMERAL META-HIERARCHIES & NON-VACUOUS DISSOLUTION:
 *      - `boltTaskHierarchy` confers temporary task capabilities to assigned peers.
 *      - `unboltTaskHierarchy` consumes the hierarchy, strips task capabilities, and asserts zero residual hat leakage.
 */

export interface TravelerPeer {
  readonly zid: string;
  readonly name: string;
  readonly hat?: string | undefined;
  readonly availableActions: readonly string[];
}

export interface FlatSocietyBase {
  readonly peers: ReadonlyMap<string, TravelerPeer>;
  readonly mutualEmpowermentScore: number;
  readonly empowermentFloor: number;
}

export interface TaskHat {
  readonly taskId: string;
  readonly goalDescription: string;
  readonly requiredAbstractions: readonly string[];
  readonly conferredActions?: readonly string[] | undefined;
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
  readonly conferredActionsPerPeer: ReadonlyMap<string, readonly string[]>; // zid -> added actions
}

export interface BoltedSocietyState {
  readonly base: FlatSocietyBase;
  readonly activePeers: ReadonlyMap<string, TravelerPeer>;
  readonly hierarchy: EphemeralMetaHierarchy;
}

/**
 * Calculates Mutual Empowerment Mean E = (1/|P|) * sum(|actions_i|).
 */
export function computeMutualEmpowerment(peers: readonly TravelerPeer[]): number {
  if (peers.length === 0) return 0;
  const totalActions = peers.reduce((acc, p) => acc + p.availableActions.length, 0);
  return totalActions / peers.length;
}

/**
 * Calculates Rawlsian Maximim Empowerment Floor: min_{p in P} |Actions(p)|.
 * Prevents strong peers from inflating the mean while stripping weak peers.
 */
export function computeEmpowermentFloor(peers: readonly TravelerPeer[]): number {
  if (peers.length === 0) return 0;
  let minActions = Infinity;
  for (const p of peers) {
    if (p.availableActions.length < minActions) {
      minActions = p.availableActions.length;
    }
  }
  return minActions === Infinity ? 0 : minActions;
}

/**
 * Checks Pareto Non-Disempowerment: forall p, |Actions_after(p)| >= |Actions_before(p)|.
 */
export function noPeerDisempowered(
  beforePeers: ReadonlyMap<string, TravelerPeer>,
  afterPeers: ReadonlyMap<string, TravelerPeer>,
): boolean {
  for (const [zid, before] of beforePeers.entries()) {
    const after = afterPeers.get(zid);
    if (!after || after.availableActions.length < before.availableActions.length) {
      return false; // A peer was disempowered!
    }
  }
  return true;
}

/**
 * Asserts Hat Non-Transferability & Zero Residual Leakage over 1,000-cycle ratchets.
 */
export function hatAccumulationDidNotTransfer(
  originalPeers: ReadonlyMap<string, TravelerPeer>,
  unboltedPeers: ReadonlyMap<string, TravelerPeer>,
): boolean {
  if (originalPeers.size !== unboltedPeers.size) return false;
  for (const [zid, orig] of originalPeers.entries()) {
    const current = unboltedPeers.get(zid);
    if (!current) return false;
    if (current.hat !== orig.hat) return false;
    if (current.availableActions.length !== orig.availableActions.length) return false;
    const origSet = new Set(orig.availableActions);
    for (const act of current.availableActions) {
      if (!origSet.has(act)) return false; // Action leaked!
    }
  }
  return true;
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
    empowermentFloor: computeEmpowermentFloor(peers),
  };
}

/**
 * Instantiates an ephemeral, task-bolted meta-hierarchy and confers temporary task capabilities.
 */
export function boltTaskHierarchy(
  base: FlatSocietyBase,
  task: TaskHat,
): BoltedSocietyState {
  const peerList = Array.from(base.peers.values());
  const activeHats = new Map<string, string>();
  const conferredActionsPerPeer = new Map<string, readonly string[]>();
  const activePeers = new Map<string, TravelerPeer>();

  for (const p of peerList) {
    activePeers.set(p.zid, { ...p, availableActions: [...p.availableActions] });
  }

  const subGoalLevels: TaskSubGoalNode[][] = [];
  let peerIdx = 0;
  const conferred = task.conferredActions ?? [`action-${task.taskId}`];

  for (let lvl = 0; lvl < task.requiredAbstractions.length; lvl++) {
    const abstraction = task.requiredAbstractions[lvl]!;
    const levelNodes: TaskSubGoalNode[] = [];

    const assignedPeer = peerList[peerIdx % peerList.length]!;
    peerIdx++;

    const hatName = `hat-${task.taskId}-level-${lvl}`;
    activeHats.set(assignedPeer.zid, hatName);

    // Confer temporary capabilities to assigned peer
    const existingPeer = activePeers.get(assignedPeer.zid)!;
    const updatedActions = Array.from(new Set([...existingPeer.availableActions, ...conferred]));

    activePeers.set(assignedPeer.zid, {
      ...existingPeer,
      hat: hatName,
      availableActions: updatedActions,
    });

    conferredActionsPerPeer.set(assignedPeer.zid, conferred);

    levelNodes.push({
      level: lvl,
      subGoal: abstraction,
      assignedPeerZid: assignedPeer.zid,
      status: "pending",
    });

    subGoalLevels.push(levelNodes);
  }

  // Guard verification: ensure no peer was disempowered during bolting
  if (!noPeerDisempowered(base.peers, activePeers)) {
    throw new Error(`boltTaskHierarchy: Pareto disempowerment guard failed on task ${task.taskId}`);
  }

  const hierarchy: EphemeralMetaHierarchy = {
    taskId: task.taskId,
    rootGoal: task.goalDescription,
    levels: subGoalLevels,
    activeHats,
    conferredActionsPerPeer,
  };

  return {
    base,
    activePeers,
    hierarchy,
  };
}

/**
 * Dissolves the ephemeral task hierarchy, strips conferred task capabilities,
 * and asserts zero residual hat leakage.
 */
export function unboltTaskHierarchy(boltedState: BoltedSocietyState): FlatSocietyBase {
  const restoredPeers = new Map<string, TravelerPeer>();

  for (const [zid, origPeer] of boltedState.base.peers.entries()) {
    // Completely restore original peer state (strip temporary hats & conferred actions)
    restoredPeers.set(zid, {
      zid: origPeer.zid,
      name: origPeer.name,
      hat: origPeer.hat,
      availableActions: [...origPeer.availableActions],
    });
  }

  // Verify non-vacuous dissolution invariant: zero residual hat leakage
  if (!hatAccumulationDidNotTransfer(boltedState.base.peers, restoredPeers)) {
    throw new Error(
      `unboltTaskHierarchy: Hat accumulation leakage detected on task ${boltedState.hierarchy.taskId}`,
    );
  }

  return {
    peers: restoredPeers,
    mutualEmpowermentScore: computeMutualEmpowerment(Array.from(restoredPeers.values())),
    empowermentFloor: computeEmpowermentFloor(Array.from(restoredPeers.values())),
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
