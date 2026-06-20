/**
 * load-node-session.ts — read the first-session channel for observe World snapshots.
 *
 * Slice 4: nodeSession is an optional World channel. Absent when the adventure
 * is complete (marker exists); present + incomplete when cred setup is pending.
 */

import { existsSync } from "node:fs";
import { defaultShellRunner } from "./first-session-executor";
import { sessionFromProbe, DEFAULT_MARKER_PATH } from "./first-session-run";
import { defaultNodeSession, type NodeSessionState } from "./first-session";

export interface LoadNodeSessionOptions {
  readonly markerPath?: string;
  readonly home?: string;
  /** Inject for tests; default probes live creds via gh auth status + manifest paths. */
  readonly session?: NodeSessionState;
}

/**
 * Load the nodeSession channel. Returns undefined when first-session is finished
 * (marker on disk) — the channel is unwired, same as operator absent.
 */
export function loadNodeSession(opts: LoadNodeSessionOptions = {}): NodeSessionState | undefined {
  if (opts.session !== undefined) return opts.session;

  const markerPath = opts.markerPath ?? process.env.ZETA_FIRST_SESSION_MARKER ?? DEFAULT_MARKER_PATH;
  if (existsSync(markerPath)) return undefined;

  const home = opts.home ?? process.env.HOME ?? "/home/zeta";
  return sessionFromProbe(defaultShellRunner(), home);
}

/** Convenience: default incomplete session (all creds missing) for tests/DST. */
export function pendingNodeSession(): NodeSessionState {
  return defaultNodeSession();
}
