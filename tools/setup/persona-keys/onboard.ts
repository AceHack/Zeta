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

import type { MachineEffects, MachineResult, PresenceStatus } from "./machine.ts";
import { checkPresence, ensureMachineKey, publishPubPath, sanitizeHostname } from "./machine.ts";
import type { PublishEffects, PublishResult } from "./publish.ts";
import { publishKey } from "./publish.ts";
import type { GithubTrustEffects, TrustResolution } from "./github-trust.ts";
import { resolveIdentities, resolveTrustSet } from "./github-trust.ts";
import type { CaEffects, CertResult } from "./ca.ts";
import { signMachineCert } from "./ca.ts";

/** The sub-module effects bundles — the ONLY doors for ambient influence. Tests inject
 *  fakes; the CLI injects each module's `realEffects()`. The orchestrator never touches the
 *  OS / network / a secret except through these. `ca` is OPTIONAL: present only when the
 *  operator opts into the flash-time "sign this machine's key with the CA" step; absent it,
 *  the cert step skips cleanly (no CA configured → not an error, not a step). */
export interface OnboardEffects {
  readonly machine: MachineEffects;
  readonly publish: PublishEffects;
  readonly trust: GithubTrustEffects;
  /** OPTIONAL CA door — enables the gated, flash-time cert-sign tie-in (delegates to ca.ts). */
  readonly ca?: CaEffects;
}

/** Options for an onboard run — the operator identity + repo root, plus the knobs each
 *  delegated step needs. `dryRun` is end-to-end (every sub-call gets `dryRun: true`). */
export interface OnboardOptions {
  /** The operator/persona identity (the user component of user × machine). */
  readonly user: string;
  /** Repo root (where maintainers/<user>/… trust roots live). */
  readonly repoRoot: string;
  /** Local home override (for the device-key path; defaults to the host home). */
  readonly home?: string;
  /** Hostname override (else the injected machine hostname). */
  readonly hostname?: string;
  /** End-to-end dry-run: NO prompts, NO writes, NO keygen, NO network. Plan only. */
  readonly dryRun?: boolean;
  /** Trust identities to resolve (else sourced from allowlist / maintainers/ by github-trust). */
  readonly trustIdentities?: readonly string[];
  /** Include GPG/signing trust in the resolve step. */
  readonly includeGpg?: boolean;
  /** Publish key type (default authentication). */
  readonly keyType?: "authentication" | "signing";
  /**
   * OPTIONAL flash-time CA tie-in: when true AND `fx.ca` is provided, sign THIS machine's
   * published device key into a cert with the CA (delegates to ca.ts `signMachineCert`), so a
   * freshly-flashed box can present a CERT, not a bare key. Skips cleanly if no CA is
   * configured (`fx.ca` absent → the step is omitted) or the CA private key is absent
   * (ca.ts returns `no-ca` → recorded as a skip, never an error). Reuse-only.
   */
  readonly signWithCa?: boolean;
  /** Validity window for the CA-signed device cert (OpenSSH `-V` form). Defaults in ca.ts. */
  readonly certValidity?: string;
}

/** The kind of a single orchestrated step (for the numbered readout). The OPTIONAL `cert-sign`
 *  step appears only when the operator opts into the CA tie-in (`signWithCa` + `fx.ca`). */
export type StepKind = "status" | "user-keyring" | "machine-key" | "publish" | "trust-resolve" | "cert-sign";

/** A single step's outcome — what it found / did / would do, plus an operator-facing note.
 *  `pending` flags work the OPERATOR must still do (seed-gen, the gated biometric confirm). */
export interface OnboardStep {
  readonly kind: StepKind;
  /** A short, stable headline for this step ("present" / "created" / "instruction" / …). */
  readonly headline: string;
  /** The human-readable detail line (safe to print — public only, no secrets). */
  readonly detail: string;
  /** True iff this step needs operator action that the orchestrator cannot/should-not do. */
  readonly pending: boolean;
}

/** The full onboard result: the per-step trace + the typed sub-results (for assertions). */
export interface OnboardResult {
  readonly dryRun: boolean;
  readonly user: string;
  readonly hostname: string;
  readonly steps: readonly OnboardStep[];
  /** The two-part presence status from step 1 (machine.ts). */
  readonly presence: PresenceStatus;
  /** The machine-key step's typed result (machine.ts). */
  readonly machine: MachineResult;
  /** The publish step's typed result (delegated to publish.ts — gate enforced there). */
  readonly publish: PublishResult;
  /** The trust-resolve step's typed result (delegated to github-trust.ts). */
  readonly trust: TrustResolution;
  /** The OPTIONAL cert-sign step's typed result (delegated to ca.ts). Undefined when the
   *  CA tie-in was not requested or no CA door was provided (the step did not run). */
  readonly cert?: CertResult;
}

/** The exact `keyring.sh` instruction the operator must run when the user keyring is
 *  missing. GENERATE-THEN-ROTATE per the keyring.sh blueprint (Aaron 2026-06-09): Otto
 *  runs `generate` (does the hard bits), then the operator runs `rotate` to take a seed
 *  they pick and hold. The orchestrator NEVER runs this — seed custody is the human's. */
export function keyringInstruction(user: string): string {
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
export async function onboard(fx: OnboardEffects, opts: OnboardOptions): Promise<OnboardResult> {
  const dryRun = opts.dryRun === true;
  const home = opts.home;
  const keyType = opts.keyType ?? "authentication";
  const steps: OnboardStep[] = [];

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
    detail:
      `user=${opts.user} keyring ${presence.userKeyPresent ? "PRESENT" : "MISSING"}; ` +
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
  } else {
    // Missing → emit the operator INSTRUCTION; do NOT run keyring.sh / touch a seed.
    steps.push({
      kind: "user-keyring",
      headline: "instruction",
      detail: keyringInstruction(opts.user),
      pending: true, // operator must run the seed-gen themselves
    });
  }

  // ── Step 3: MACHINE KEY — generate this host's device key if missing (machine.ts) ───
  // Delegated: machine.ts owns ssh-keygen + umask + the public-only read-back. We pass
  // publish:false here (this slice's "publish to GitHub" is the separate biometric-gated
  // step 4, not the maintainers/ pubkey-file write). Idempotent: an existing key is a no-op.
  const machine = ensureMachineKey(fx.machine, {
    user: opts.user,
    repoRoot: opts.repoRoot,
    ...(home !== undefined ? { home } : {}),
    dryRun,
  });
  steps.push({
    kind: "machine-key",
    headline:
      machine.action === "generated"
        ? "created"
        : machine.action === "would-generate"
          ? "would-create"
          : "present",
    detail:
      machine.action === "exists"
        ? `device key already present (local, private) at ${machine.devicePrivatePath} — no action.`
        : machine.action === "would-generate"
          ? `[dry-run] would generate this host's device key at ${machine.devicePrivatePath} (NOTHING generated).`
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
  steps.push({
    kind: "publish",
    headline:
      publish.action === "published"
        ? "published"
        : publish.action === "would-publish"
          ? "would-publish"
          : "blocked",
    detail: publishStepDetail(publish),
    // Pending iff the operator must still confirm the biometric (would-publish), or a
    // recoverable abort needs operator action (no-key → run machine step first).
    pending: publish.action === "would-publish" || publish.action === "aborted-no-key",
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
  let cert: CertResult | undefined;
  if (opts.signWithCa === true && fx.ca !== undefined) {
    const certRes = signMachineCert(fx.ca, {
      user: opts.user,
      machineId: hostname,
      devicePubPath: publishPubPath(opts.repoRoot, opts.user, hostname),
      ...(home !== undefined ? { home } : {}),
      ...(opts.certValidity !== undefined ? { validity: opts.certValidity } : {}),
      dryRun,
    });
    cert = certRes;
    steps.push({
      kind: "cert-sign",
      headline:
        certRes.action === "signed"
          ? "signed"
          : certRes.action === "would-sign"
            ? "would-sign"
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
function certStepDetail(res: CertResult): string {
  switch (res.action) {
    case "would-sign":
      return (
        `[dry-run] would sign ${res.devicePubPath} into ${res.certPath} ` +
        `(id=${res.certId} principal=${res.principal} validity=${res.validity}) — NOTHING signed.`
      );
    case "signed":
      return `signed device key into cert ${res.certPath} (principal=${res.principal}, validity=${res.validity}).`;
    case "no-ca":
      return `skipped: no CA configured (no CA private key at ${res.caPrivatePath}) — present a bare key, sign later.`;
    case "no-device-key":
      return `skipped: no device pubkey at ${res.devicePubPath} — run the machine step (with --publish) first.`;
  }
}

/** The operator-facing detail line for the publish step (mirrors publish.ts's outcomes
 *  without re-implementing any of its logic — it only narrates the typed result). */
function publishStepDetail(res: PublishResult): string {
  switch (res.action) {
    case "would-publish":
      return (
        `[dry-run] would publish ${res.fingerprint ?? "(key)"} to github:${res.user} (${res.keyType}) ` +
        "AFTER a biometric confirm — NO prompt + NO GitHub write performed."
      );
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
export function formatOnboard(res: OnboardResult): string {
  const lines: string[] = [];
  lines.push(
    res.dryRun
      ? `Zeta key onboarding — DRY RUN (nothing prompted, written, generated, or fetched)`
      : `Zeta key onboarding — user=${res.user}, machine=${res.hostname}`,
  );
  res.steps.forEach((s, i) => {
    lines.push(`  ${i + 1}. [${s.kind}] ${s.headline}`);
    for (const dl of s.detail.split("\n")) lines.push(`       ${dl}`);
  });

  const pending = res.steps.filter((s) => s.pending);
  lines.push("");
  if (pending.length === 0) {
    lines.push("Operator action still required: none.");
  } else {
    lines.push(`Operator action still required (${pending.length}):`);
    pending.forEach((s, i) => lines.push(`  ${i + 1}. [${s.kind}] ${s.detail.split("\n")[0] ?? s.headline}`));
  }
  return lines.join("\n");
}
