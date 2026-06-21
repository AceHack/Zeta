// zeta-creds-manifest.ts — declarative credential-manifest schema for B-0852.
//
// B-0852 sub-row .5 (smallest pure-data substrate slice). No runtime deps;
// pure types + parser + validator. Composes with:
//   - tools/installer/zeta-creds-crypto.ts (B-0852.1; cipher layer)
//   - tools/installer/zeta-creds-persist.ts (B-0852.2; consumes manifest)
//   - tools/installer/zeta-creds-restore.ts (B-0852.2; consumes manifest)
//   - full-ai-cluster/usb-nixos-installer/zeta-creds-manifest.yaml (canonical deployed copy)
//
// The discipline (Aaron 2026-05-27): "the keep credentials options we should
// declare each credential we need and save and restore so it's not so
// imparative too." Adding a new credential type = manifest edit, NOT a code
// change. Persist/restore code reads the manifest + iterates.
/** The default manifest shipped with B-0852 Phase 1. */
export const DEFAULT_MANIFEST = {
    schemaVersion: 1,
    credentials: [
        {
            id: "gh-cli",
            paths: ["~/.config/gh/hosts.yml"],
            personaScoped: false,
            required: true,
            notes: "GitHub CLI token + host config. Per-AI identity (B-0847) future may flip personaScoped:true.",
        },
        {
            id: "claude",
            paths: ["~/.config/claude/credentials.json", "~/.claude/.credentials.json"],
            personaScoped: true,
            required: true,
            notes: "Anthropic Claude Code CLI credentials. Per-persona slot.",
        },
        {
            id: "gemini",
            paths: ["~/.gemini/oauth_creds.json"],
            personaScoped: true,
            required: true,
            notes: "Google Gemini CLI OAuth creds. Per-persona slot.",
        },
        {
            id: "codex",
            paths: ["~/.codex/auth.json"],
            personaScoped: true,
            required: true,
            notes: "OpenAI Codex CLI auth. Per-persona slot.",
        },
        {
            id: "ssh-host-keys",
            paths: [
                "/etc/ssh/ssh_host_ed25519_key",
                "/etc/ssh/ssh_host_ed25519_key.pub",
                "/etc/ssh/ssh_host_rsa_key",
                "/etc/ssh/ssh_host_rsa_key.pub",
            ],
            personaScoped: false,
            required: false,
            notes: "Optional. Regen on fresh installs is acceptable; persist for SSH-known-hosts continuity across re-installs.",
        },
        {
            id: "ssh-operator-pubkey",
            paths: ["/etc/zeta/operator-authorized-keys", "/etc/ssh/authorized_keys.d/zeta-operator"],
            personaScoped: false,
            required: true,
            notes: "Operator's SSH pubkey injected by iter-4.2 ESP write. Composes with that channel.",
        },
        {
            id: "wifi",
            paths: ["/etc/NetworkManager/system-connections"],
            personaScoped: false,
            required: false,
            notes: "WiFi credentials (Aaron 2026-06-07): NetworkManager .nmconnection files (SSID + PSK under [wifi]/" +
                "[wifi-security]). Host-level network config, not per-AI. Optional (re-enter acceptable), but persisting " +
                "means you don't re-type WiFi every install. Reformat-from-scratch ('fresh') re-enters.",
        },
        {
            id: "install-answers",
            paths: ["/etc/zeta/install-answers.json"],
            personaScoped: false,
            required: false,
            notes: "Saved answers to install prompts (Aaron 2026-06-07): reused across installs so previously-answered " +
                "questions are NOT re-asked — UNLESS a new question appears, or the operator chooses to reanswer / a " +
                "'fresh' reformat-from-scratch is selected (B-0891 scenario). Retention ties to install mode: " +
                "Live/retain reuses; fresh/Erase re-prompts.",
        },
    ],
};
/**
 * Validate a parsed manifest object. Pure function; no I/O.
 *
 * Checks:
 *   - schemaVersion is the supported value
 *   - credentials is non-empty array
 *   - each entry has all required fields with correct types
 *   - id values are unique across the manifest
 *   - paths is non-empty
 *
 * @param raw - any value (typically from YAML.parse / JSON.parse)
 * @returns ValidateResult
 */
export function validateManifest(raw) {
    const errors = [];
    if (!isObject(raw)) {
        return { error: ["manifest must be an object"] };
    }
    if (raw.schemaVersion !== 1) {
        errors.push(`schemaVersion must be 1; got ${JSON.stringify(raw.schemaVersion)}`);
    }
    if (!Array.isArray(raw.credentials)) {
        errors.push("credentials must be an array");
        return { error: errors };
    }
    if (raw.credentials.length === 0) {
        errors.push("credentials array must be non-empty");
    }
    const seenIds = new Set();
    raw.credentials.forEach((entry, i) => {
        if (!isObject(entry)) {
            errors.push(`credentials[${i}] must be an object`);
            return;
        }
        if (typeof entry.id !== "string" || entry.id.length === 0) {
            errors.push(`credentials[${i}].id must be a non-empty string`);
        }
        else if (seenIds.has(entry.id)) {
            errors.push(`credentials[${i}].id "${entry.id}" duplicates an earlier entry`);
        }
        else {
            seenIds.add(entry.id);
        }
        if (!Array.isArray(entry.paths) || entry.paths.length === 0) {
            errors.push(`credentials[${i}].paths must be a non-empty array`);
        }
        else if (!entry.paths.every((p) => typeof p === "string" && p.length > 0)) {
            errors.push(`credentials[${i}].paths must contain only non-empty strings`);
        }
        if (typeof entry.personaScoped !== "boolean") {
            errors.push(`credentials[${i}].personaScoped must be a boolean`);
        }
        if (typeof entry.required !== "boolean") {
            errors.push(`credentials[${i}].required must be a boolean`);
        }
        if (entry.notes !== undefined && typeof entry.notes !== "string") {
            errors.push(`credentials[${i}].notes must be a string if present`);
        }
    });
    if (errors.length > 0) {
        return { error: errors };
    }
    return { ok: raw };
}
/** Type guard for plain object (non-array, non-null). */
function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
