/**
 * observe/room/ — Room framework barrel.
 *
 * Split mirrors the codebase's git/forge-host boundary:
 *   git/   — trust-based rooms (work against any remote)
 *   forge/ — ceremony rooms (only when the host requires it)
 */
export { scopeWorld, tickRooms, type Room, type RoomState, type ScopePredicate, type RoomTickResult } from "./room";
export { createBacklogRoom, createShadowRoom, type BacklogRoomState, type ShadowRoomState } from "./git/rooms";
export { createPrRoom, createMergeRoom, type PrRoomState, type MergeRoomState } from "./forge/rooms";
