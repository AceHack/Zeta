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
 *   4. CALIBRATION LEDGER — SEPARATE FROM PEER RECORD (PR #9901, 2026-08-01):
 *      - `unboltTaskHierarchy` accepts an optional `CalibrationLedger` and passes it through UNCHANGED.
 *      - The ledger is NOT stored in `FlatSocietyBase.peers` — it lives outside so the wholesale
 *        restore from `base.peers` cannot erase it. See `calibration-ledger.ts`.
 */

import type { CalibrationLedger } from "./calibration-ledger.js";

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
  if (!noPeerDisempowered(Array.from(base.peers.values()), Array.from(activePeers.values()))) {
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
 * Result of unboltTaskHierarchy — the restored FlatSocietyBase plus the
 * calibration ledger passed through UNCHANGED.
 *
 * The ledger is returned alongside (not embedded in) the state so that
 * callers can thread it through without risk of it being erased by a
 * future wholesale restore from base.peers.
 */
export interface UnboltResult {
  readonly state: FlatSocietyBase;
  /** Calibration ledger — passed through from input, never modified by unbolt. */
  readonly calibrationLedger: CalibrationLedger | undefined;
}

/**
 * Dissolves the ephemeral task hierarchy, strips conferred task capabilities,
 * and asserts zero residual hat leakage.
 *
 * The optional `calibrationLedger` is passed through UNCHANGED in the result.
 * It is NOT restored from base.peers — this is the storage-location fix for
 * the defect described in PR #9901 §3.1.
 */
export function unboltTaskHierarchy(
  baseOrBolted: FlatSocietyBase | BoltedSocietyState,
  hierarchyInput?: EphemeralMetaHierarchy,
  calibrationLedger?: CalibrationLedger,
): UnboltResult {
  const base = "activePeers" in baseOrBolted ? baseOrBolted.base : baseOrBolted;
  const hierarchy = "activePeers" in baseOrBolted ? baseOrBolted.hierarchy : hierarchyInput;

  const restoredPeers = new Map<string, TravelerPeer>();

  for (const [zid, origPeer] of base.peers.entries()) {
    // Completely restore original peer state (strip temporary hats & conferred actions)
    restoredPeers.set(zid, {
      zid: origPeer.zid,
      name: origPeer.name,
      hat: origPeer.hat,
      availableActions: [...origPeer.availableActions],
    });
  }

  // Verify non-vacuous dissolution invariant: zero residual hat leakage per peer
  for (const [zid, origPeer] of base.peers.entries()) {
    const restoredPeer = restoredPeers.get(zid)!;
    const conferred = hierarchy?.conferredActionsPerPeer?.get(zid) ?? [];
    const ledger: HatLedger = { wearCount: 1, accumulated: Array.from(conferred) };

    if (!hatAccumulationDidNotTransfer(origPeer, restoredPeer, ledger)) {
      throw new Error(
        `unboltTaskHierarchy: Hat accumulation leakage detected on peer ${zid} for task ${hierarchy?.taskId ?? "unknown"}`,
      );
    }
  }

  const state: FlatSocietyBase = {
    peers: restoredPeers,
    mutualEmpowermentScore: computeMutualEmpowerment(Array.from(restoredPeers.values())),
    empowermentFloor: computeEmpowermentFloor(Array.from(restoredPeers.values())),
  };
  return { state, calibrationLedger };
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
  const afterByZid = new Map(after.map((p) => [p.zid, p.availableActions.length]));
  for (const p of before) {
    const now = afterByZid.get(p.zid);
    if (now === undefined || now < p.availableActions.length) return false;
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
