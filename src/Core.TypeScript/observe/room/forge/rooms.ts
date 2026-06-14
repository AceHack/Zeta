/**
 * observe/room/forge/ — forge-host rooms (host-specific ceremony).
 *
 * These rooms exist ONLY because the forge requires ceremony:
 *   - PrRoom: manage a PR lifecycle — GitHub-specific
 *   - MergeRoom: handle merge queue — GitHub-specific
 *
 * Disappear entirely on hosts that allow direct push.
 */
import type { World } from "../../observe";
import type { ChooserResult } from "../../chooser";
import type { Room, RoomState } from "../room";

export interface PrRoomState extends RoomState {
  prNumber: number;
  unresolvedThreads: number;
  ciStatus: "pending" | "green" | "red" | "unknown";
  autoMergeArmed: boolean;
}

export function createPrRoom(prNumber: number): Room {
  const state: PrRoomState = { prNumber, unresolvedThreads: 0, ciStatus: "unknown", autoMergeArmed: false };
  return {
    id: `pr-${prNumber}`,
    scope: { backlogIds: new Set(), prNumbers: new Set([prNumber]), operatorAccess: false, writeAccess: true },
    state,
    tick: async (scopedWorld: World): Promise<ChooserResult> => {
      const isClean = scopedWorld.forgeState?.cleanPrNumbers.includes(prNumber) ?? false;
      if (isClean && !(state as PrRoomState).autoMergeArmed) {
        return {
          action: { kind: "do_item", item: { id: `merge-pr-${prNumber}`, title: `Merge PR #${prNumber}`, ready: true, ambiguous: false } },
          tier: "oracle", confidence: 1.0,
        };
      }
      return { action: { kind: "explore", reason: `PR #${prNumber} not ready` }, tier: "oracle", confidence: 0.9 };
    },
  };
}

export interface MergeRoomState extends RoomState {
  queueDepth: number;
  lastArmedPr?: number;
}

export function createMergeRoom(): Room {
  const state: MergeRoomState = { queueDepth: 0 };
  return {
    id: "merge-queue",
    scope: { backlogIds: new Set(), prNumbers: new Set(), operatorAccess: false, writeAccess: true },
    state,
    tick: async (scopedWorld: World): Promise<ChooserResult> => {
      const cleanPrs = scopedWorld.forgeState?.cleanPrNumbers ?? [];
      (state as MergeRoomState).queueDepth = cleanPrs.length;
      if (cleanPrs.length > 0) {
        const pr = cleanPrs[0]!;
        (state as MergeRoomState).lastArmedPr = pr;
        return {
          action: { kind: "do_item", item: { id: `merge-pr-${pr}`, title: `Merge PR #${pr}`, ready: true, ambiguous: false } },
          tier: "oracle", confidence: 1.0,
        };
      }
      return { action: { kind: "explore", reason: "merge queue empty" }, tier: "oracle", confidence: 1.0 };
    },
  };
}
