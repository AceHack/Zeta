/**
 * forge-host/index.ts — barrel export for the ForgeHost abstraction layer.
 */
// Result helpers
export { ok, err, forgeError } from "./result";
// Detection
export { detectForgeFromRemote, classifyHost, parseRemoteUrl } from "./detect";
// Registry
export { resolveForgeHost, resolveHostFromRemote, registerAdapter, clearRegistrations } from "./registry";
