/**
 * observe/room/ — Room framework barrel.
 *
 * Split mirrors the codebase's git/forge-host boundary:
 *   git/   — trust-based rooms (work against any remote)
 *   forge/ — ceremony rooms (only when the host requires it)
 */
export { scopeWorld, tickRooms } from "./room";
export { createBacklogRoom, createShadowRoom } from "./git/rooms";
export { createPrRoom, createMergeRoom } from "./forge/rooms";
