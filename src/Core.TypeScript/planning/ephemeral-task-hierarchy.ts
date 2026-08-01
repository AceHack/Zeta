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
