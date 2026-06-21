// Zeta key-onboarding ORCHESTRATOR — the one-command "clean + smooth + automatic"
// payoff slice of the unified key-onboarding flow (workitem 081KVM1TK3Z08QG0R0002959G6
// §"First-run auto-provisioning" + §"Trust distribution"). Aaron (2026-06-21):
// *"clean and smooth and automatic."*
//
// This module CHAINS three already-shipped, already-verified sub-modules end-to-end and
// produces a clean per-step readout. It is a COORDINATOR, not an implementor:
//
//   1. STATUS        — machine.ts  `checkPresence`     (the two-part user × machine probe)
//   2. USER KEYRING  — keyring.sh INSTRUCTION ONLY     (seed custody is human-held; the
//                       orchestrator PRINTS the exact `keyring.sh generate|rotate` step,
//                       it NEVER runs seed-gen — the seed never crosses this boundary)
//   3. MACHINE KEY   — machine.ts  `ensureMachineKey`  (this host's device key)
//   4. PUBLISH       — publish.ts  `publishKey`        (biometric-gated, fail-closed,
//                       PUBLIC-only — the orchestrator goes THROUGH the gate, never around)
//   5. TRUST RESOLVE — github-trust.ts `resolveTrustSet` (produce/print the trust set)
//   6. READOUT       — a clean numbered summary of present / created / operator-still-to-do.
//
// SECURITY INVARIANTS (security-sensitive slice — honesty over green):
//  1. NO secret handling, NO biometric logic, NO `gh` logic, NO seed-gen lives here. ALL
//     of it is DELEGATED to the sub-modules through their injected-effects doors. The
//     orchestrator contains nothing that could emit, derive, or print private material —
//     it never imports the seed/keyring derivation (derive.ts / bip39) at all.
//  2. The PUBLISH step MUST go through publish.ts `publishKey` — the biometric gate is
//     never bypassed and there is NO direct `gh` call here. (publish.ts is fail-closed;
//     the orchestrator only calls it and narrates the typed result.)
//  3. A MISSING user keyring yields an INSTRUCTION, never a silent seed-gen. Seed custody
//     is the operator's; the orchestrator instructs (`keyring.sh generate|rotate`), it
//     does not run `keyring.sh` and never touches a mnemonic.
//  4. `--dry-run` is end-to-end: no prompts, no writes, no keygen, no network — the plan
//     is printed and NOTHING is done. Each delegated call receives `dryRun: true`.
//
// Noninterference (manifesto §13): every ambient influence (hostname, filesystem,
// biometric prompt, `gh` write, GitHub fetch) enters ONLY through the three injected
// sub-module effects bundles — so the whole flow is deterministic + testable against
// fakes, and `--dry-run` is provably side-effect-free.
//
// Anchors (Beacon): the chained modules' own anchors hold — ed25519 device keys
// (Bernstein et al. 2011), Touch ID PAM (`pam_tid.so`) / Windows Hello UserConsentVerifier,
// `gh ssh-key add` (GitHub CLI), GitHub `.keys`/`.gpg` public endpoints + `ssh-import-id`
// (Canonical), SSH authorized_keys (`sshd(8)`). Orchestration as a thin coordinator over
// idempotent steps — the workitem's "one command … idempotent (re-running … is a no-op)".
import { checkPresence, ensureMachineKey, publishPubPath, sanitizeHostname } from "./machine.js";
import { publishKey } from "./publish.js";
import { resolveIdentities, resolveTrustSet } from "./github-trust.js";
import { signMachineCert } from "./ca.js";
/** The exact `keyring.sh` instruction the operator must run when the user keyring is
 *  missing. GENERATE-THEN-ROTATE per the keyring.sh blueprint (Aaron 2026-06-09): Otto
 *  runs `generate` (does the hard bits), then the operator runs `rotate` to take a seed
 *  they pick and hold. The orchestrator NEVER runs this — seed custody is the human's. */
export function keyringInstruction(user) {
    return [
        `the user keyring for '${user}' is MISSING — seed custody is yours, so the orchestrator`,
        "will NOT generate it. Run the seed-gen step yourself (GENERATE-THEN-ROTATE blueprint):",
        `    tools/setup/persona-keys/keyring.sh generate ${user} --out maintainers/${user}`,
        `    tools/setup/persona-keys/keyring.sh rotate   ${user} --out maintainers/${user}`,
        "  (`generate` does the hard bits fast; `rotate` lets you pick + write down a seed you hold.)",
    ].join("\n");
}
/**
 * Run the end-to-end first-run onboarding flow as a CHAIN over the three sub-modules.
 *
 * Order is the security contract: STATUS → (user-keyring instruction if missing) →
 * MACHINE-KEY → PUBLISH (biometric-gated, only after the prior steps) → TRUST-RESOLVE.
 * Every effect is delegated; the orchestrator adds no secret/biometric/gh/seed logic.
 *
 * On `dryRun`: every delegated call receives `dryRun: true`, so NOTHING is prompted,
 * written, generated, or fetched — the readout reports intent only.
 *
 * PURE over the injected `OnboardEffects` — deterministic + testable against fakes.
 */
export async function onboard(fx, opts) {
    const dryRun = opts.dryRun === true;
    const home = opts.home;
    const keyType = opts.keyType ?? "authentication";
    const steps = [];
    // ── Step 1: STATUS — the two-part (user × machine) presence check (machine.ts) ──────
    const presence = checkPresence(fx.machine, {
        user: opts.user,
        repoRoot: opts.repoRoot,
        ...(home !== undefined ? { home } : {}),
    });
    const hostname = opts.hostname !== undefined ? sanitizeHostname(opts.hostname) : presence.hostname;
    steps.push({
        kind: "status",
        headline: "status",
        detail: `user=${opts.user} keyring ${presence.userKeyPresent ? "PRESENT" : "MISSING"}; ` +
            `machine=${hostname} device key ${presence.machineKeyPresentLocal ? "PRESENT" : "MISSING"}` +
            ` (published=${presence.machineKeyPublished ? "y" : "n"})`,
        pending: false,
    });
    // ── Step 2: USER KEYRING — INSTRUCTION ONLY when missing (NEVER a silent seed-gen) ──
    if (presence.userKeyPresent) {
        steps.push({
            kind: "user-keyring",
            headline: "present",
            detail: `user keyring already registered at ${presence.userKeyringPath} — no action.`,
            pending: false,
        });
    }
    else {
        // Missing → emit the operator INSTRUCTION; do NOT run keyring.sh / touch a seed.
        steps.push({
            kind: "user-keyring",
            headline: "instruction",
            detail: keyringInstruction(opts.user),
            pending: true, // operator must run the seed-gen themselves
        });
    }
    // ── Step 3: MACHINE KEY — generate this host's device key if missing (machine.ts) ───
    // Delegated: machine.ts owns ssh-keygen + umask + the public-only read-back. publish:true
    // writes the PUBLIC device key to maintainers/<user>/machines/<host>.pub — the registry path
    // step 4's publish reads from. (With publish:false the GitHub-publish step finds no pubkey at
    // the conventional path and blocks; public-only write, the keygen is the gated act.) Idempotent:
    // an existing key is a no-op. Gated: the agent runs the keygen, the operator's biometric approves.
    const machine = await ensureMachineKey(fx.machine, {
        user: opts.user,
        repoRoot: opts.repoRoot,
        publish: true,
        ...(home !== undefined ? { home } : {}),
        ...(fx.biometricAuth !== undefined ? { biometricAuth: fx.biometricAuth } : {}),
        dryRun,
    });
    steps.push({
        kind: "machine-key",
        headline: machine.action === "generated"
            ? "created"
            : machine.action === "would-generate"
                ? "would-create"
                : machine.action === "aborted-biometric"
                    ? "blocked"
                    : "present",
        detail: machine.action === "exists"
            ? `device key already present (local, private) at ${machine.devicePrivatePath} — no action.`
            : machine.action === "would-generate"
                ? `[dry-run] would generate this host's device key at ${machine.devicePrivatePath} (NOTHING generated).`
                : machine.action === "aborted-biometric"
                    ? `blocked: biometric ${machine.biometric?.reason ? `failed: ${machine.biometric.reason}` : "not approved"} — NO device key generated (fail-closed).`
                    : `generated this host's device key at ${machine.devicePrivatePath} (private, local, umask 077).`,
        pending: false,
    });
    // ── Step 4: PUBLISH — biometric-gated, PUBLIC-only (publish.ts owns the gate) ────────
    // The orchestrator goes THROUGH publish.ts `publishKey`; it never invokes `gh` or a
    // biometric prompt itself. The conventional pubkey path is machine.ts's publishPubPath.
    const pubPath = publishPubPath(opts.repoRoot, opts.user, hostname);
    const publish = await publishKey(fx.publish, {
        user: opts.user,
        repoRoot: opts.repoRoot,
        hostname,
        keyType,
        keyPath: pubPath,
        dryRun,
    });
    // Dry-run sequencing: publish.ts checks the pubkey EXISTS before its dry-run branch, so on a
    // fresh box (no key yet) a standalone publish dry-run returns aborted-no-key. But in THIS
    // sequence step 3 (machine-key, publish:true) would create + publish the pubkey first, so the
    // honest dry-run label is "would-publish (after keygen)", not "blocked".
    const publishWouldFollowKeygen = dryRun && publish.action === "aborted-no-key" && machine.action === "would-generate";
    steps.push({
        kind: "publish",
        headline: publish.action === "published"
            ? "published"
            : publish.action === "would-publish" || publishWouldFollowKeygen
                ? "would-publish"
                : "blocked",
        detail: publishWouldFollowKeygen
            ? "[dry-run] would publish this host's device key to GitHub (biometric-gated) after step 3 creates it."
            : publishStepDetail(publish),
        // Pending iff the operator must still confirm the biometric (would-publish), or a recoverable
        // abort needs operator action (no-key in a NON-sequenced context → run machine step first).
        pending: publish.action === "would-publish" || (publish.action === "aborted-no-key" && !publishWouldFollowKeygen),
    });
    // ── Step 5: TRUST RESOLVE — produce/print the trust set (github-trust.ts) ────────────
    // Delegated read-only resolve. Identities are sourced by github-trust (explicit arg /
    // allowlist / maintainers dirs). On dry-run NO network is touched (the module enforces it).
    const idRes = resolveIdentities(fx.trust, {
        repoRoot: opts.repoRoot,
        ...(opts.trustIdentities !== undefined && opts.trustIdentities.length > 0
            ? { identities: opts.trustIdentities }
            : {}),
    });
    const trust = await resolveTrustSet(fx.trust, {
        identities: idRes.identities,
        ...(opts.includeGpg !== undefined ? { includeGpg: opts.includeGpg } : {}),
        dryRun,
    });
    steps.push({
        kind: "trust-resolve",
        headline: trust.dryRun ? "would-resolve" : "resolved",
        detail: trust.dryRun
            ? `[dry-run] would resolve trust set for ${idRes.identities.length} identit(ies)` +
                ` (${idRes.sourceKind}): ${idRes.identities.join(", ") || "(none)"} — NO network.`
            : `resolved trust set: ${trust.trustSet.length} authorized-keys line(s) from` +
                ` ${idRes.identities.length} identit(ies) (${idRes.sourceKind}) — PRODUCED, not installed.`,
        pending: false,
    });
    // ── Step 6 (OPTIONAL): CERT-SIGN — flash-time CA tie-in (delegated to ca.ts) ──────────
    // Reuse-only + gated: runs ONLY when the operator opted in (`signWithCa`) AND a CA door
    // was provided (`fx.ca`). Skips CLEANLY when no CA is configured or the CA private key is
    // absent (ca.ts returns `no-ca`) — a freshly-flashed box with no CA is the normal case,
    // not an error. The orchestrator adds NO signing logic; ca.ts owns ssh-keygen -s. The cert
    // (public) is the only artifact; no secret crosses this boundary. NOT run on dry-run-sign
    // beyond ca.ts's own `would-sign` (dryRun is threaded through).
    let cert;
    if (opts.signWithCa === true && fx.ca !== undefined) {
        // Gated: the agent runs ssh-keygen -s, the operator's biometric is the approval. Signing
        // consumes the CA private key, so it is fail-closed behind the shared gate.
        const certRes = await signMachineCert(fx.ca, {
            user: opts.user,
            machineId: hostname,
            devicePubPath: publishPubPath(opts.repoRoot, opts.user, hostname),
            ...(home !== undefined ? { home } : {}),
            ...(opts.certValidity !== undefined ? { validity: opts.certValidity } : {}),
            ...(fx.biometricAuth !== undefined ? { biometricAuth: fx.biometricAuth } : {}),
            dryRun,
        });
        cert = certRes;
        steps.push({
            kind: "cert-sign",
            headline: certRes.action === "signed"
                ? "signed"
                : certRes.action === "would-sign"
                    ? "would-sign"
                    : certRes.action === "aborted-biometric"
                        ? "blocked"
                        : "skipped",
            detail: certStepDetail(certRes),
            // No-CA / no-device-key are clean skips (operator may add a CA later); never block.
            pending: false,
        });
    }
    return { dryRun, user: opts.user, hostname, steps, presence, machine, publish, trust, ...(cert !== undefined ? { cert } : {}) };
}
/** The operator-facing detail line for the OPTIONAL cert-sign step (narrates ca.ts's typed
 *  result without re-implementing any signing logic). Public only — no secrets ever appear. */
function certStepDetail(res) {
    switch (res.action) {
        case "would-sign":
            return (`[dry-run] would sign ${res.devicePubPath} into ${res.certPath} ` +
                `(id=${res.certId} principal=${res.principal} validity=${res.validity}) — NOTHING signed.`);
        case "signed":
            return `signed device key into cert ${res.certPath} (principal=${res.principal}, validity=${res.validity}).`;
        case "no-ca":
            return `skipped: no CA configured (no CA private key at ${res.caPrivatePath}) — present a bare key, sign later.`;
        case "no-device-key":
            return `skipped: no device pubkey at ${res.devicePubPath} — run the machine step (with --publish) first.`;
        case "aborted-biometric":
            return `blocked: biometric ${res.biometric?.reason ? `failed: ${res.biometric.reason}` : "not approved"} — NO cert signed (fail-closed).`;
    }
}
/** The operator-facing detail line for the publish step (mirrors publish.ts's outcomes
 *  without re-implementing any of its logic — it only narrates the typed result). */
function publishStepDetail(res) {
    switch (res.action) {
        case "would-publish":
            return (`[dry-run] would publish ${res.fingerprint ?? "(key)"} to github:${res.user} (${res.keyType}) ` +
                "AFTER a biometric confirm — NO prompt + NO GitHub write performed.");
        case "published":
            return `biometric -> ok -> published ${res.fingerprint ?? "(key)"} to github:${res.user} (${res.keyType}).`;
        case "aborted-biometric":
            return `blocked: ${res.error ?? "biometric not granted"} (GitHub NOT written — fail-closed).`;
        case "aborted-no-key":
            return `blocked: no public key to publish — run the machine step (with --publish) first.`;
        case "aborted-private-material":
            return `blocked: refused PRIVATE-key material (PUBLIC-only invariant; GitHub NOT written).`;
    }
}
/** Render the clean numbered readout (step 6). A per-step summary + a trailing
 *  "operator must still do" list of the pending items (seed-gen, gated biometric confirm).
 *  Safe to print: public only, no secrets ever appear. */
export function formatOnboard(res) {
    const lines = [];
    lines.push(res.dryRun
        ? `Zeta key onboarding — DRY RUN (nothing prompted, written, generated, or fetched)`
        : `Zeta key onboarding — user=${res.user}, machine=${res.hostname}`);
    res.steps.forEach((s, i) => {
        lines.push(`  ${i + 1}. [${s.kind}] ${s.headline}`);
        for (const dl of s.detail.split("\n"))
            lines.push(`       ${dl}`);
    });
    const pending = res.steps.filter((s) => s.pending);
    lines.push("");
    if (pending.length === 0) {
        lines.push("Operator action still required: none.");
    }
    else {
        lines.push(`Operator action still required (${pending.length}):`);
        pending.forEach((s, i) => lines.push(`  ${i + 1}. [${s.kind}] ${s.detail.split("\n")[0] ?? s.headline}`));
    }
    return lines.join("\n");
}
