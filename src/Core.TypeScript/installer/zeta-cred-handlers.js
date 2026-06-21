// zeta-cred-handlers.ts — per-cred-type value-source handlers for B-0852.
//
// B-0852 sub-row .10 (pure functions; unit-tested independently of zflash).
// Composes with:
//   - tools/installer/zeta-creds-manifest.ts (B-0852.5; declares cred types)
//   - tools/installer/zeta-creds-crypto.ts (B-0852.1; cipher layer for blob)
//   - src/Core.TypeScript/zflash/cli.ts (B-0852.9 future; consumes via --bake-cred)
//
// CLI-override design (operator-named; substrate-anchor in B-0852 row body
// Phase-split section "CLI override > prompt loop"): `zflash --bake-cred
// <id>=<value>` where <value> uses these conventions:
//   - <literal>     : direct string value
//   - @<path>       : read file contents (curl/git @file convention)
//   - env:<VAR>     : read from env var (avoid PAT in shell history)
//
// Each cred type in the manifest has a per-type handler that knows:
//   - Which value-source syntaxes are supported
//   - What VALUE SHAPE to expect after source resolution
//   - What VALIDATION to apply at parse time
//
// Pure functions; structured Result types; no I/O at the parsing layer
// (file reads happen in resolveValueSource, kept narrow).
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
/** Handler for gh-cli — PAT string; any non-empty content acceptable. */
export const GH_CLI_HANDLER = {
    id: "gh-cli",
    supportedSources: ["literal", "file", "env"],
    validateValue(value) {
        if (value.length === 0)
            return "gh-cli value must be non-empty";
        const s = value.toString("utf8").trim();
        if (s.length === 0)
            return "gh-cli value must be non-whitespace";
        // Soft-check: warn if value doesn't look like a GitHub PAT or hosts.yml
        // (don't reject — operator may have valid host config we don't recognize).
        return null;
    },
};
/** Handler for JSON-cred files (claude / gemini / codex). */
function makeJsonHandler(id) {
    return {
        id,
        supportedSources: ["literal", "file"],
        validateValue(value) {
            if (value.length === 0)
                return `${id} value must be non-empty`;
            try {
                const parsed = JSON.parse(value.toString("utf8"));
                if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
                    return `${id} value must be a JSON object (got ${typeof parsed === "object" ? "null/array" : typeof parsed})`;
                }
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return `${id} value must be valid JSON: ${msg}`;
            }
            return null;
        },
    };
}
export const CLAUDE_HANDLER = makeJsonHandler("claude");
export const GEMINI_HANDLER = makeJsonHandler("gemini");
export const CODEX_HANDLER = makeJsonHandler("codex");
/** Handler for ssh-operator-pubkey — OpenSSH pubkey text. */
export const SSH_OPERATOR_PUBKEY_HANDLER = {
    id: "ssh-operator-pubkey",
    supportedSources: ["literal", "file"],
    validateValue(value) {
        if (value.length === 0)
            return "ssh-operator-pubkey value must be non-empty";
        const s = value.toString("utf8").trim();
        // OpenSSH pubkey format: <key-type> <base64-blob> [comment]
        // Accept any line starting with a known key-type prefix.
        const validPrefixes = [
            "ssh-rsa ",
            "ssh-ed25519 ",
            "ssh-dss ",
            "ecdsa-sha2-nistp256 ",
            "ecdsa-sha2-nistp384 ",
            "ecdsa-sha2-nistp521 ",
            "sk-ssh-ed25519@openssh.com ",
            "sk-ecdsa-sha2-nistp256@openssh.com ",
        ];
        const firstLine = s.split("\n")[0];
        if (!validPrefixes.some((p) => firstLine.startsWith(p))) {
            return `ssh-operator-pubkey must start with a known OpenSSH key-type prefix (ssh-rsa / ssh-ed25519 / ecdsa-sha2-* / sk-ssh-ed25519@openssh.com / etc.); got: ${firstLine.slice(0, 40)}...`;
        }
        return null;
    },
};
/** Handler for ssh-host-keys — multi-file; TBD (Phase 1 deferred). */
export const SSH_HOST_KEYS_HANDLER = {
    id: "ssh-host-keys",
    supportedSources: [], // No bake-in at Phase 1 (multi-file; regenerated on first boot acceptable)
    validateValue(_value) {
        return "ssh-host-keys does not support --bake-cred in Phase 1 (multi-file; regen on fresh install acceptable per manifest required:false flag)";
    },
};
/**
 * Handler for wifi — NetworkManager .nmconnection content (SSID + PSK). Aaron 2026-06-07: zflash should also
 * save WiFi credentials. Accept either a JSON object `{ssid, psk}` or raw .nmconnection / wpa_supplicant text;
 * require that it references an SSID so we don't silently bake junk. SECURITY: never echo the value (the PSK)
 * in error messages — reference the id only.
 */
export const WIFI_HANDLER = {
    id: "wifi",
    supportedSources: ["literal", "file", "env"],
    validateValue(value) {
        if (value.length === 0)
            return "wifi value must be non-empty";
        const s = value.toString("utf8");
        if (s.trim().length === 0)
            return "wifi value must be non-whitespace";
        // JSON form: must be an object carrying an ssid. Text form: must mention an SSID (.nmconnection has
        // `ssid=` under [wifi]; wpa_supplicant has `ssid="..."`). Either way require an SSID reference.
        try {
            const parsed = JSON.parse(s);
            if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
                return "wifi JSON value must be an object with at least an 'ssid' field";
            }
            if (typeof parsed.ssid !== "string") {
                return "wifi JSON value must include a string 'ssid' field";
            }
            return null;
        }
        catch {
            // Not JSON — accept as raw connection text iff it references an SSID.
            if (!/(^|\n)\s*ssid\s*=/i.test(s)) {
                return "wifi text value must be a .nmconnection / wpa_supplicant blob containing an 'ssid=' line (or JSON with an 'ssid' field)";
            }
            return null;
        }
    },
};
/** Handler for install-answers — saved answers to install prompts; JSON object (Aaron 2026-06-07). */
export const INSTALL_ANSWERS_HANDLER = makeJsonHandler("install-answers");
/** Default registry of handlers, keyed by manifest id. */
export const DEFAULT_HANDLERS = {
    "gh-cli": GH_CLI_HANDLER,
    claude: CLAUDE_HANDLER,
    gemini: GEMINI_HANDLER,
    codex: CODEX_HANDLER,
    "ssh-operator-pubkey": SSH_OPERATOR_PUBKEY_HANDLER,
    "ssh-host-keys": SSH_HOST_KEYS_HANDLER,
    wifi: WIFI_HANDLER,
    "install-answers": INSTALL_ANSWERS_HANDLER,
};
/**
 * Parse one --bake-cred CLI arg: `<id>=<value-source>`.
 *
 * Returns the id + raw value-source string for a follow-up resolveValueSource
 * call. Pure parser; no I/O.
 */
export function parseBakeCredArg(arg) {
    // SECURITY: error messages must NEVER include the raw value-source portion
    // — the value-source may be a literal PAT / JSON cred / SSH key. Echoing
    // the full arg to stderr/logs on a typo would leak the secret. Errors
    // include only the id portion (operator-controlled name) or describe the
    // source-kind without quoting its contents.
    const eq = arg.indexOf("=");
    if (eq < 0) {
        return {
            error: "--bake-cred requires <id>=<value-source> (no = found in arg; value-source omitted from error to avoid secret leak)",
        };
    }
    const id = arg.slice(0, eq).trim();
    const source = arg.slice(eq + 1);
    if (id.length === 0) {
        return { error: "--bake-cred id must be non-empty (value-source omitted from error to avoid secret leak)" };
    }
    if (source.length === 0) {
        return { error: `--bake-cred value-source must be non-empty for id "${id}"` };
    }
    return { id, source };
}
/**
 * Resolve a value-source string to its bytes per the convention:
 *   <literal>     : direct string (returned as utf8 bytes)
 *   @<path>       : read file contents (~ expanded; absolute paths kept)
 *   env:<VAR>     : read from env var (validated non-empty)
 *
 * Local-only side effects: file read + env access. No network. Not pure
 * (was previously documented as "pure" — corrected per Copilot P2 review
 * on PR #5418).
 */
export function resolveValueSource(source, env = process.env) {
    if (source.startsWith("@")) {
        let path = source.slice(1);
        if (path.length === 0) {
            return { error: "@-prefixed value-source requires a path after @" };
        }
        // Expand ~ to home dir (canonical shell behavior).
        if (path === "~" || path.startsWith("~/")) {
            path = homedir() + path.slice(1);
        }
        if (!existsSync(path)) {
            return { error: `file not found: ${path}` };
        }
        try {
            return readFileSync(path);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { error: `failed to read ${path}: ${msg}` };
        }
    }
    if (source.startsWith("env:")) {
        const name = source.slice(4);
        if (name.length === 0) {
            return { error: "env:-prefixed value-source requires a variable name after env:" };
        }
        const value = env[name];
        if (value === undefined || value === null) {
            return { error: `env var not set: ${name}` };
        }
        if (value.length === 0) {
            return { error: `env var is empty: ${name}` };
        }
        return Buffer.from(value, "utf8");
    }
    // Literal value.
    return Buffer.from(source, "utf8");
}
/**
 * Full pipeline: parse a --bake-cred arg + resolve its source + validate
 * via the per-cred-type handler registered for that manifest id.
 *
 * @param arg - the raw CLI arg (e.g., `gh-cli=ghp_xxxx` or `claude=@~/.config/claude/credentials.json`)
 * @param handlers - registry of per-cred handlers (default exported above; allow injection for tests)
 * @param env - process env (allow injection for tests)
 * @returns CredResolveResult — { ok: { id, value: Buffer } } | { error: string }
 */
export function resolveBakeCred(arg, handlers = DEFAULT_HANDLERS, env = process.env) {
    const parsed = parseBakeCredArg(arg);
    if ("error" in parsed)
        return { error: parsed.error };
    const handler = handlers[parsed.id];
    if (handler === undefined) {
        return {
            error: `no handler registered for cred id "${parsed.id}"; check manifest declares this id + handler is exported from zeta-cred-handlers.ts`,
        };
    }
    // Detect source type to gate against handler's supportedSources.
    let sourceType = "literal";
    if (parsed.source.startsWith("@"))
        sourceType = "file";
    else if (parsed.source.startsWith("env:"))
        sourceType = "env";
    if (!handler.supportedSources.includes(sourceType)) {
        return {
            error: `cred "${parsed.id}" does not support ${sourceType} source (supported: ${handler.supportedSources.join(", ") || "(none — Phase 1 deferred)"})`,
        };
    }
    const value = resolveValueSource(parsed.source, env);
    if ("error" in value) {
        return { error: `${parsed.id}: ${value.error}` };
    }
    const validationError = handler.validateValue(value);
    if (validationError !== null) {
        return { error: `${parsed.id}: ${validationError}` };
    }
    return { ok: { id: parsed.id, value } };
}
