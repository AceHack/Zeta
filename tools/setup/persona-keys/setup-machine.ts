// Zeta ONE-FINGERPRINT machine setup — the top-level "one command, one biometric" payoff
// for onboarding a new dev machine / maintainer onto an EXISTING cluster (workitem
// 081KVM1TK3Z08QG0R0002959G6 §"First-run auto-provisioning"). Aaron (2026-06-21):
// *"should be ONE like fingerprint and then setup new machine/maintainer … too many steps
// and easy to get wrong."*
//
// WHAT IT IS — a THIN orchestrator over the already-shipped, already-verified `onboard.ts`
// chain (status → user-keyring instruction → machine-key → trust-resolve → OPTIONAL cert-sign).
// PURE-KEY MODEL (onboard.ts): a machine key is a host identity, NOT a user GitHub auth key, so
// there is NO GitHub-publish in the chain; the (user × machine) binding is the CA cert. This
// adds exactly TWO things and NO new key/biometric/seed logic:
//
//   1. ONE-FINGERPRINT SESSION APPROVAL — it does ONE up-front `requireBiometric` through a
//      `sessionBiometric` door (biometric.ts), then hands that SAME session door to every
//      gated sub-op (machine keygen, cert-sign). The human presses Touch ID ONCE; the session
//      replays that one approval to the rest of the sequence (NO re-prompts). FAIL-CLOSED: a
//      declined approval poisons the session, so NOTHING runs.
//
//   2. AUTO-CERT — if a CA is configured on this host (the CA private key exists), it sets
//      `signWithCa` so the freshly-registered machine key is signed into a cert (the user ×
//      machine binding) with NO extra flag. No CA ⇒ the cert step is simply omitted (a clean
//      skip, not an error) — exactly the normal case on a box joining a cluster whose CA lives
//      elsewhere.
//
// SECURITY INVARIANTS (security-class — honesty over green):
//  - The session is ONE *human* approval, not zero: every sub-op still calls `requireBiometric`
//    and aborts on a declined/absent result. We never bypass a gate; we share ONE approval.
//  - NO secret / seed / CA-private handling here — ALL delegated to onboard.ts's sub-modules.
//    A missing user keyring yields an INSTRUCTION (onboard.ts), never a silent seed-gen.
//  - `--dry-run` is end-to-end inert (threaded into onboard): NO prompt, NO keygen, NO write,
//    NO network — the session door is NEVER called on dry-run (onboard's dry-run branches skip
//    every gated op before the door).
//
// Noninterference (manifesto §13): every ambient influence (biometric prompt, filesystem, gh,
// network, the CA-presence probe) enters ONLY through the injected effects — so the whole flow
// is deterministic + testable against fakes, and the one-approval property is provable.
//
// Anchors (Beacon): the onboard.ts chain's anchors hold (ed25519 device keys — Bernstein et al.
// 2011; Touch ID PAM / Windows Hello UserConsentVerifier; `gh ssh-key add`; OpenSSH SSH-CA).
// Session approval (one consent covering a bounded op sequence) — the FIDO/WebAuthn
// user-verification "transaction" model + sudo's timestamp cache, but bounded to ONE run and
// FAIL-CLOSED rather than time-windowed.

import { onboard, type OnboardEffects, type OnboardOptions, type OnboardResult } from "./onboard.ts";
import { requireBiometric, type BiometricResult, type SessionGate } from "./biometric.ts";

/** Options for a one-fingerprint machine setup — the operator identity + repo root, plus the
 *  knobs onboard needs. `dryRun` is end-to-end inert. `caConfigured` is whether THIS host has
 *  a CA private key (probed by the CLI via ca.ts `caPrivateKeyPath`); when true the cert step
 *  runs with the SAME session approval, when false it is cleanly omitted. */
export interface SetupMachineOptions {
  readonly user: string;
  readonly repoRoot: string;
  readonly home?: string;
  readonly hostname?: string;
  readonly dryRun?: boolean;
  readonly trustIdentities?: readonly string[];
  readonly includeGpg?: boolean;
  readonly keyType?: "authentication" | "signing";
  /** Validity window for the auto-signed device cert (OpenSSH `-V`); defaults in ca.ts. */
  readonly certValidity?: string;
  /** True iff a CA private key is present on THIS host → auto-sign the device cert (no flag). */
  readonly caConfigured: boolean;
}

/** The result of a one-fingerprint setup: the full onboard trace + the proof fields that make
 *  the one-approval property auditable (how many times the HUMAN gate fired; the one decision). */
export interface SetupMachineResult {
  readonly onboard: OnboardResult;
  /** Times the underlying (human-facing) biometric door fired. One-fingerprint ⇒ 0 (dry-run /
   *  nothing gated) or 1 (the single approval). NEVER > 1. */
  readonly biometricApprovals: number;
  /** The single session decision (undefined if nothing gated ran — e.g. dry-run). No secret. */
  readonly approval?: BiometricResult;
  /** True iff the auto-cert step was requested (CA configured + not dry-run pure-skip). */
  readonly certRequested: boolean;
}

/**
 * Run the one-fingerprint machine setup: ONE biometric approval up front (through the injected
 * session gate), then the full onboard chain with that SAME approval shared by every gated
 * sub-op, plus auto-cert when a CA is configured.
 *
 * The caller (CLI) builds `fx` with the session door already woven into EVERY gated effect
 * (machine + ca both carry `session.door`), and passes the `session` so this function can (a)
 * trigger the one up-front approval and (b) report the audit counts. On `--dry-run` the up-front
 * approval is SKIPPED (nothing will run, so nothing is approved) and onboard runs inert.
 *
 * PURE over the injected effects + session — deterministic + testable against fakes.
 */
export async function setupMachine(
  fx: OnboardEffects,
  session: SessionGate,
  opts: SetupMachineOptions,
): Promise<SetupMachineResult> {
  const dryRun = opts.dryRun === true;
  const certRequested = opts.caConfigured && !dryRun;

  // ── ONE-FINGERPRINT APPROVAL (up front) ─────────────────────────────────────────────────
  // On a real run we trigger the SINGLE human approval here, through the session door. Every
  // gated sub-op below is wired to the SAME session door, so it replays this one decision and
  // never re-prompts. FAIL-CLOSED: if declined, the cached ok:false flows to every sub-op, so
  // nothing runs. On --dry-run we do NOT prompt (onboard's dry-run skips every gated op anyway).
  if (!dryRun) {
    await requireBiometric(
      session.door,
      `Approve Zeta machine setup for ${opts.user} (one approval covers: machine key` +
        (certRequested ? " + cert-sign)" : ")"),
    );
  }

  const onboardOpts: OnboardOptions = {
    user: opts.user,
    repoRoot: opts.repoRoot,
    dryRun,
    ...(opts.home !== undefined ? { home: opts.home } : {}),
    ...(opts.hostname !== undefined ? { hostname: opts.hostname } : {}),
    ...(opts.trustIdentities !== undefined && opts.trustIdentities.length > 0
      ? { trustIdentities: opts.trustIdentities }
      : {}),
    ...(opts.includeGpg !== undefined ? { includeGpg: opts.includeGpg } : {}),
    ...(opts.keyType !== undefined ? { keyType: opts.keyType } : {}),
    ...(opts.certValidity !== undefined ? { certValidity: opts.certValidity } : {}),
    // AUTO-CERT: sign the device key when a CA is configured — no operator flag. onboard runs
    // the cert step only when BOTH signWithCa is set AND fx.ca is provided (the CLI provides
    // fx.ca only when the CA exists), so this is a clean skip when no CA is present.
    ...(opts.caConfigured ? { signWithCa: true } : {}),
  };

  const res = await onboard(fx, onboardOpts);

  const decision = session.decision();
  return {
    onboard: res,
    biometricApprovals: session.underlyingCalls(),
    ...(decision !== undefined ? { approval: decision } : {}),
    certRequested,
  };
}

/** Render the operator-facing readout: the full onboard summary + a one-line confirmation of
 *  the one-fingerprint property (how many times the human gate fired). Public only — no secrets. */
export function formatSetupMachine(res: SetupMachineResult): string {
  const lines: string[] = [];
  lines.push(
    res.onboard.dryRun
      ? "Zeta setup-machine — DRY RUN (one command; nothing prompted, generated, written, or fetched)"
      : `Zeta setup-machine — user=${res.onboard.user}, machine=${res.onboard.hostname} (one fingerprint)`,
  );
  res.onboard.steps.forEach((s, i) => {
    lines.push(`  ${i + 1}. [${s.kind}] ${s.headline}`);
    for (const dl of s.detail.split("\n")) lines.push(`       ${dl}`);
  });
  lines.push("");
  lines.push(
    res.onboard.dryRun
      ? "Biometric: not invoked (dry-run). On a real run: ONE approval covers the whole sequence."
      : `Biometric: ${res.biometricApprovals} human approval(s) for the whole run (one-fingerprint).`,
  );
  const pending = res.onboard.steps.filter((s) => s.pending);
  if (pending.length === 0) {
    lines.push("Operator action still required: none.");
  } else {
    lines.push(`Operator action still required (${pending.length}):`);
    pending.forEach((s, i) => lines.push(`  ${i + 1}. [${s.kind}] ${s.detail.split("\n")[0] ?? s.headline}`));
  }
  return lines.join("\n");
}
