#!/usr/bin/env bun
// zeta-creds-restore.ts — read encrypted cred-blob from ESP + restore to disk.
// B-0852.2b CLI sibling to zeta-creds-persist.ts.
//
// Composes:
//   - tools/installer/zeta-creds-crypto.ts (B-0852.1; decrypt)
//   - tools/installer/zeta-creds-manifest.ts (B-0852.5; cred catalog → paths)
//   - tools/installer/zeta-creds-envelope.ts (B-0852.2a; wire format + bundle)
//
// Usage:
//   bun tools/installer/zeta-creds-restore.ts \
//     --usb-uuid <uuid> \
//     --input /esp/zeta-creds.enc \
//     ( --passphrase-file <path> | --passphrase-env <VAR> ) \
//     [--persona <name>] \
//     [--target-root /  (default: filesystem root; for tests use tmp dir)] \
//     [--dry-run]  (print what would be written; don't write)
//
// Interactive passphrase prompts are NOT implemented in this CLI — caller
// must supply --passphrase-file or --passphrase-env. Interactive prompting
// is the wrapping NixOS module's responsibility (B-0852.4).
//
// Exit codes:
//   0 success
//   2 arg parse error
//   3 file read failure
//   4 envelope parse failure
//   5 decrypt failure (wrong passphrase / wrong UUID / tampered blob)
//   6 bundle decode failure
//   7 manifest missing cred id present in blob (mismatch)
//
// Per .claude/rules/non-coercion-invariant.md HC-8: operator authority over
// own creds; passphrase NEVER logged; required-cred write failure surfaces
// the failure rather than silently degrading.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { decrypt } from "./zeta-creds-crypto";
import { decodeBundle, parseEnvelope } from "./zeta-creds-envelope";
import { DEFAULT_MANIFEST } from "./zeta-creds-manifest";
/**
 * Parse CLI args. Reads filesystem ONLY for --passphrase-file. Returns
 * Args OR structured error message.
 *
 * SECURITY: Error messages NEVER include the passphrase value itself, AND
 * the env-var NAME passed as --passphrase-env value is not echoed back in
 * error strings (CodeQL clear-text-logging finding on PR #5422 — see
 * sibling note in zeta-creds-persist.ts).
 */
export function parseArgs(argv, env) {
    let usbUuid = null;
    let input = null;
    let passphraseFile = null;
    let passphraseEnv = null;
    let persona = null;
    let targetRoot = "/";
    let dryRun = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = () => {
            if (i + 1 >= argv.length)
                throw new Error(`${arg} requires a value`);
            return argv[++i];
        };
        try {
            if (arg === "--usb-uuid")
                usbUuid = next();
            else if (arg === "--input")
                input = next();
            else if (arg === "--passphrase-file")
                passphraseFile = next();
            else if (arg === "--passphrase-env")
                passphraseEnv = next();
            else if (arg === "--persona")
                persona = next();
            else if (arg === "--target-root")
                targetRoot = next();
            else if (arg === "--dry-run")
                dryRun = true;
            else
                return { error: `unknown flag: ${arg}` };
        }
        catch (err) {
            return { error: err instanceof Error ? err.message : String(err) };
        }
    }
    if (!usbUuid)
        return { error: "--usb-uuid required" };
    if (!input)
        return { error: "--input required" };
    let passphrase = null;
    if (passphraseFile) {
        if (!existsSync(passphraseFile))
            return { error: `--passphrase-file not found: ${passphraseFile}` };
        try {
            passphrase = readFileSync(passphraseFile, "utf8").replace(/\r?\n$/, "");
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { error: `--passphrase-file read failed: ${msg}` };
        }
        if (passphrase.length === 0)
            return { error: "--passphrase-file is empty" };
    }
    else if (passphraseEnv) {
        const v = env[passphraseEnv];
        if (v === undefined || v === null || v === "") {
            // SECURITY: omit env-var name from error (CodeQL taint via passphraseEnv)
            return { error: "--passphrase-env target var is not set or is empty" };
        }
        passphrase = v;
    }
    if (passphrase === null)
        return {
            error: "passphrase source required: pass --passphrase-file <path> or --passphrase-env <VAR>",
        };
    return { usbUuid, input, passphrase, persona, targetRoot, dryRun };
}
/** Resolve manifest entry's paths relative to target-root + ~ expansion. */
export function resolveCredPaths(entry, targetRoot) {
    return entry.paths.map((p) => {
        if (p.startsWith("~/")) {
            // ~ refers to caller's home (root user during install); restore happens
            // pre-user-home so ~ resolution is best-effort here.
            return resolve(targetRoot, homedir().replace(/^\//, ""), p.slice(2));
        }
        if (p.startsWith("/")) {
            return resolve(targetRoot, p.slice(1));
        }
        return resolve(targetRoot, p);
    });
}
function pushWriteUnlessAlreadyPresent(writes, skipped, id, path, value) {
    if (existsSync(path)) {
        try {
            const current = readFileSync(path);
            if (current.equals(value)) {
                skipped.push({ id, reason: "already-present" });
                return;
            }
        }
        catch {
            // Fall through: applyPlan will attempt the restore write and surface
            // any persistent filesystem failure at the write boundary.
        }
    }
    writes.push({ path, bytes: value.length, value });
}
/**
 * Decrypt + decode the blob + plan writes per manifest. Single decrypt
 * (scrypt is expensive — per Copilot review on PR #5422 the prior split
 * planRestore+applyPlan doubled scrypt cost). applyPlan() now takes a
 * RestorePlan rather than re-decrypting.
 */
export function planRestore(blob, usbUuid, passphrase, persona, targetRoot) {
    const env = parseEnvelope(blob);
    if ("error" in env)
        return { error: `envelope parse: ${env.error}`, code: 4 };
    const plaintext = decrypt(env, usbUuid, passphrase);
    if ("error" in plaintext)
        return { error: `decrypt: ${plaintext.error}`, code: 5 };
    const bundle = decodeBundle(plaintext);
    if ("error" in bundle)
        return { error: `bundle decode: ${bundle.error}`, code: 6 };
    const writes = [];
    const skipped = [];
    const errors = [];
    // Global creds
    for (const [id, value] of Object.entries(bundle.globalCreds)) {
        const entry = DEFAULT_MANIFEST.credentials.find((c) => c.id === id);
        if (!entry) {
            errors.push(`blob contains unknown cred id "${id}" (not in default manifest)`);
            continue;
        }
        if (entry.personaScoped) {
            skipped.push({ id, reason: `manifest declares personaScoped:true but blob put in globalCreds` });
            continue;
        }
        const paths = resolveCredPaths(entry, targetRoot);
        // Write to FIRST path only (canonical); other paths are alternates the caller may symlink
        pushWriteUnlessAlreadyPresent(writes, skipped, id, paths[0], value);
    }
    // Persona creds (only restore the requested persona's section)
    if (persona) {
        const personaSection = bundle.personaCreds[persona];
        if (personaSection) {
            for (const [id, value] of Object.entries(personaSection)) {
                const entry = DEFAULT_MANIFEST.credentials.find((c) => c.id === id);
                if (!entry) {
                    errors.push(`blob persona ${persona} contains unknown cred id "${id}"`);
                    continue;
                }
                if (!entry.personaScoped) {
                    skipped.push({
                        id,
                        reason: `manifest declares personaScoped:false but blob put in personaCreds[${persona}]`,
                    });
                    continue;
                }
                const paths = resolveCredPaths(entry, targetRoot);
                pushWriteUnlessAlreadyPresent(writes, skipped, id, paths[0], value);
            }
        }
        else if (Object.keys(bundle.personaCreds).length > 0) {
            skipped.push({
                id: `(persona-section)`,
                reason: `requested persona "${persona}" not in blob; available: ${Object.keys(bundle.personaCreds).join(", ")}`,
            });
        }
    }
    else if (Object.keys(bundle.personaCreds).length > 0) {
        for (const personaName of Object.keys(bundle.personaCreds)) {
            for (const id of Object.keys(bundle.personaCreds[personaName])) {
                skipped.push({ id: `${personaName}/${id}`, reason: `persona-scoped cred; --persona not specified` });
            }
        }
    }
    if (errors.length > 0)
        return { error: errors.join("; "), code: 7 };
    return { writes, skipped, errors: [] };
}
/**
 * Apply a plan returned by planRestore. NO re-decrypt (per Copilot review
 * on PR #5422 — the prior implementation re-decrypted, doubling scrypt
 * cost + extending passphrase-derived-key lifetime in memory). Returns
 * the count of writes performed.
 */
export function applyPlan(plan) {
    let writeCount = 0;
    for (const w of plan.writes) {
        mkdirSync(dirname(w.path), { recursive: true });
        writeFileSync(w.path, w.value);
        writeCount++;
    }
    return writeCount;
}
async function main() {
    const argv = process.argv.slice(2);
    const parsed = parseArgs(argv, process.env);
    if ("error" in parsed) {
        console.error(`zeta-creds-restore: ${parsed.error}`);
        return 2;
    }
    if (!existsSync(parsed.input)) {
        console.error(`zeta-creds-restore: input file not found: ${parsed.input}`);
        return 3;
    }
    let blob;
    try {
        blob = readFileSync(parsed.input);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`zeta-creds-restore: input file read failed: ${msg}`);
        return 3;
    }
    const plan = planRestore(blob, parsed.usbUuid, parsed.passphrase, parsed.persona, parsed.targetRoot);
    if ("error" in plan) {
        console.error(`zeta-creds-restore: ${plan.error}`);
        return plan.code;
    }
    if (parsed.dryRun) {
        console.log(`zeta-creds-restore (DRY RUN; ${plan.writes.length} writes would happen):`);
        for (const w of plan.writes)
            console.log(`  WRITE ${w.path} (${w.bytes} bytes)`);
        for (const s of plan.skipped)
            console.log(`  SKIP  ${s.id}: ${s.reason}`);
        return 0;
    }
    const written = applyPlan(plan);
    if (written === 0 && plan.skipped.some((entry) => entry.reason === "already-present")) {
        console.log("zeta-creds-restore: already-present, skipping credential rewrite");
    }
    else {
        console.log(`zeta-creds-restore: wrote ${written} creds (target-root: ${parsed.targetRoot})`);
    }
    for (const s of plan.skipped)
        console.log(`  SKIP ${s.id}: ${s.reason}`);
    return 0;
}
if (import.meta.main) {
    main().then((code) => process.exit(code));
}
