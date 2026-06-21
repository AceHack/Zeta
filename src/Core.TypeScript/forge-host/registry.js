/**
 * forge-host/registry.ts — ForgeHost registry and adapter resolution.
 *
 * Detects the forge from git remote URLs and instantiates the correct adapter.
 * Single entry point for the core loop: `resolveForgeHost(repoRoot)`.
 *
 * Supports custom adapter registrations for self-hosted forge instances.
 */
import { detectForgeFromRemote, classifyHost, parseRemoteUrl } from "./detect";
import { ok, err, forgeError } from "./result";
const registrations = [];
/**
 * Register a custom adapter factory for a host pattern.
 * Patterns are checked in registration order (first match wins).
 */
export function registerAdapter(pattern, factory) {
    registrations.push({ pattern, factory });
}
/**
 * Resolve a ForgeHost adapter from a raw remote URL string.
 * Parses the URL, classifies the host, and finds a matching adapter.
 */
export function resolveHostFromRemote(remoteUrl) {
    const parsed = parseRemoteUrl(remoteUrl);
    if (!parsed) {
        return err(forgeError("parse-failure", `cannot parse remote URL: ${remoteUrl}`));
    }
    // Check custom registrations first (user-registered patterns win)
    for (const reg of registrations) {
        if (reg.pattern.test(parsed.host)) {
            return ok(reg.factory(parsed.owner, parsed.repo, parsed.host));
        }
    }
    // Check built-in forge classification
    const forge = classifyHost(parsed.host);
    if (forge === "unknown") {
        return err(forgeError("not-found", `no adapter registered for host: ${parsed.host}`));
    }
    // Look for a registered adapter matching the forge type name
    for (const reg of registrations) {
        if (reg.pattern.test(forge)) {
            return ok(reg.factory(parsed.owner, parsed.repo, parsed.host));
        }
    }
    return err(forgeError("not-found", `forge '${forge}' detected for ${parsed.host} but no adapter registered`));
}
/**
 * Resolve a ForgeHost adapter from a repo root directory.
 * Reads the git remote 'origin', detects the forge, instantiates the adapter.
 *
 * This is the primary entry point for consumers.
 */
export function resolveForgeHost(repoRoot) {
    const detected = detectForgeFromRemote(repoRoot);
    if (!detected.ok)
        return detected;
    const { forge, owner, repo, host } = detected.value;
    // Check custom registrations first
    for (const reg of registrations) {
        if (reg.pattern.test(host)) {
            return ok(reg.factory(owner, repo, host));
        }
    }
    // Check by forge type name
    for (const reg of registrations) {
        if (reg.pattern.test(forge)) {
            return ok(reg.factory(owner, repo, host));
        }
    }
    if (forge === "unknown") {
        return err(forgeError("not-found", `no adapter registered for host: ${host}`));
    }
    return err(forgeError("not-found", `forge '${forge}' detected for ${host} but no adapter registered`));
}
/**
 * Clear all registered adapters. Useful for testing.
 */
export function clearRegistrations() {
    registrations.length = 0;
}
