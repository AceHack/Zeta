/**
 * observe/room/git/ — git-native rooms (trust-based, work against any remote).
 *
 * These rooms exist because the WORK is real:
 *   - BacklogRoom: bounded scope over a work item, tick-surviving progress cursor
 *   - ShadowRoom: observe for drift across the system, commit findings
 *
 * Git-native rooms push directly when done. No forge ceremony required.
 */
import type { World, BacklogItem } from "../../observe";
import type { ChooserResult } from "../../chooser";
import { choose } from "../../chooser";
import { unmeteredDefaultComposer } from "../../composer";
import type { Room, RoomState } from "../room";

export interface BacklogRoomState extends RoomState {
  step: "not-started" | "in-progress" | "blocked" | "done";
  ticksInStep: number;
  lastAction?: string;
}

export function createBacklogRoom(item: BacklogItem): Room {
  const state: BacklogRoomState = { step: "not-started", ticksInStep: 0 };
  return {
    id: `backlog-${item.id}`,
    scope: { backlogIds: new Set([item.id]), prNumbers: new Set(), operatorAccess: false, writeAccess: true },
    state,
    tick: async (scopedWorld: World): Promise<ChooserResult> => {
      const result = await choose(scopedWorld, { composer: unmeteredDefaultComposer });
      const s = state as BacklogRoomState;
      s.ticksInStep++;
      s.lastAction = result.action.kind;
      if (result.action.kind === "do_item" || result.action.kind === "decompose") s.step = "in-progress";
      else if (s.ticksInStep > 3) s.step = "blocked";
      return result;
    },
  };
}

export interface ShadowRoomState extends RoomState {
  ticksSinceReport: number;
  driftSignals: string[];
}

export function createShadowRoom(): Room {
  const state: ShadowRoomState = { ticksSinceReport: 0, driftSignals: [] };
  return {
    id: "shadow-observer",
    scope: { backlogIds: new Set(), prNumbers: new Set(), operatorAccess: false, writeAccess: false },
    state,
    tick: async (): Promise<ChooserResult> => {
      (state as ShadowRoomState).ticksSinceReport++;
      return { action: { kind: "explore", reason: "shadow observation" }, tier: "oracle", confidence: 1.0 };
    },
  };
}
