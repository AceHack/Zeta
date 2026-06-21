/**
 * load-node-session.ts — read the first-session channel for observe World snapshots.
 *
 * Slice 4: nodeSession is an optional World channel. Absent when the adventure
 * is complete (marker exists); present + incomplete when cred setup is pending.
 */
import { existsSync } from "node:fs";
import { defaultShellRunner } from "./first-session-executor";
import { sessionFromProbe, DEFAULT_MARKER_PATH } from "./first-session-run";
import { defaultNodeSession } from "./first-session";
/**
 * Load the nodeSession channel. Returns undefined when first-session is finished
 * (marker on disk) — the channel is unwired, same as operator absent.
 */
export function loadNodeSession(opts = {}) {
    if (opts.session !== undefined)
        return opts.session;
    const markerPath = opts.markerPath ?? process.env.ZETA_FIRST_SESSION_MARKER ?? DEFAULT_MARKER_PATH;
    if (existsSync(markerPath))
        return undefined;
    const home = opts.home ?? process.env.HOME ?? "/home/zeta";
    return sessionFromProbe(defaultShellRunner(), home);
}
/** Convenience: default incomplete session (all creds missing) for tests/DST. */
export function pendingNodeSession() {
    return defaultNodeSession();
}
