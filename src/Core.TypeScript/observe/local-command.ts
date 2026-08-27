/**
 * Local-first commands. Remote is a background ν refresh of World channels
 * from preexisting DUs (`NextAction`, `ForgeState`), not a second controller.
 *
 * Aaron 2026-08-26: commands must work locally; background checks sync them
 * with remote. Same shape as Meijer μ (local fold / `simulate`) ⇄ ν (standing
 * remote query). The local event log is not rewritten when remote arrives —
 * only the *reading* of remote channels moves (generator-reinterpret; the
 * +1/−1 connection is `ZSetRx.connectQuery` on the algebra side).
 *
 * DST: the only network door is the injected `RemoteSyncDoor`. `runLocal`
 * has none.
 */

import { observe, simulate, type NextAction, type World } from "./observe.ts";
import type { ForgeState } from "./observe.ts";

/** Apply a chosen action to a local World. No network. */
export function runLocal(world: World, action: NextAction): World {
  return simulate(world, action);
}

export function observeLocal(world: World): NextAction {
  return observe(world);
}

/** Remote channels that may refresh. Absent keys stay local (exact optional). */
export type RemoteChannels = {
  readonly forgeState?: ForgeState;
};

/**
 * Merge a remote snapshot into a local World without rewriting `history`.
 * A missing remote field leaves the local value in place.
 */
export function mergeRemoteChannels(local: World, remote: RemoteChannels): World {
  if (remote.forgeState === undefined) return local;
  return { ...local, forgeState: remote.forgeState };
}

export type RemoteSyncDoor = {
  readonly fetch: () => Promise<RemoteChannels>;
};

/** Background ν: pull remote DUs through an injected door, then merge. */
export async function backgroundSync(local: World, door: RemoteSyncDoor): Promise<World> {
  const remote = await door.fetch();
  return mergeRemoteChannels(local, remote);
}

/** Observe the preexisting NextAction DU after a remote channel refresh. */
export function observeAfterRemote(local: World, remote: RemoteChannels): NextAction {
  return observe(mergeRemoteChannels(local, remote));
}
