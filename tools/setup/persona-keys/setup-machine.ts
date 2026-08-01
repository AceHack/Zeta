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
//   2. AUTO-CERT + REALIZE-CA-WHEN-MISSING — if a CA is configured on this host (the CA private
//      key exists), it sets `signWithCa` so the freshly-registered machine key is signed into a
//      cert (the user × machine binding) with NO extra flag. If NO local CA exists, instead of
//      skipping the cert, it REALIZES one (`ensureCa`, under the SAME session approval already in
//      scope — NO second prompt) and then signs — so a fresh host ends with CA + machine key +
//      cert under ONE fingerprint (the solo / first-node / CA-holder case). Idempotent: an
//      existing CA is a no-op (ca.ts returns `exists`, no prompt).
//
//   3. CLUSTER-MEMBERSHIP ROUTING (closes the previously-deferred join case) — "no local CA ⇒
//      realize one" is WRONG for a host JOINING a cluster whose CA lives elsewhere: it mints an
//      UNATTESTED CA. Zeta is fully decentralized — every node is its own CA, so a second CA is
//      not itself a fault (there is NO single trust root to "split"; an earlier comment here said
//      otherwise and was wrong — Aaron 2026-08-01). What makes a CA usable is that its PUBLIC key
//      was ATTESTED by committing `maintainers/<ca>/ssh-ca.pub` to the repo (git-native; who may
//      commit is a swappable forge-host plugin concern, NEVER GitHub-specific). A CA minted on
//      join is a key nobody attested, so
//      no peer can verify certs it signs — an orphan identity, and silently so.
//      The caller may now supply a `caDisposition` (ca.ts `resolveCaDisposition`, a pure function
//      of local CA-private presence + the committed bootstrap anchors). On "route" we realize
//      NOTHING and sign NOTHING here — the cert is routed to the anchor's holder with an exact
//      instruction. Omitting `caDisposition` preserves the legacy present/realize behaviour exactly.
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
import { ensureCa, type CaDisposition, type CaDispositionResult, type CaResult } from "./ca.ts";
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
  /** True iff a CA private key is ALREADY present on THIS host. When true the device cert is
   *  auto-signed against it (no flag). When false, setup REALIZES a new local CA (under the same
   *  session approval) then signs — see SetupMachineResult.caRealized. */
  readonly caConfigured: boolean;
  /** OPTIONAL cluster-membership resolution (ca.ts `resolveCaDisposition`) — closes the
   *  previously-deferred JOIN case. When supplied it DECIDES the CA path:
   *    - "present" → sign here (equivalent to caConfigured: true);
   *    - "realize" → no CA anywhere yet ⇒ create one here (equivalent to caConfigured: false);
   *    - "route"   → a committed trust root exists but the CA PRIVATE lives on ANOTHER host ⇒
   *                  do NOT fabricate a second CA (that would SPLIT the trust root) and do NOT
   *                  sign here; the cert is routed to the CA holder (see `caRouted`).
   *  When OMITTED the legacy behaviour is preserved exactly: `caConfigured` alone decides
   *  present-vs-realize, and "route" can never be selected. */
  readonly caDisposition?: CaDispositionResult;
}

/** The route outcome — emitted ONLY when the CA lives on another host (disposition "route").
 *  Public only: the trust-root identities + the operator instruction. No key material. */
export interface CaRouted {
  /** The committed CA PUBLIC trust roots that prove a CA already exists elsewhere. */
  readonly trustRoots: readonly string[];
  /** The exact operator instruction to get this machine's cert signed by the CA holder. */
  readonly instruction: string;
}

/** The exact instruction to route a device cert to the CA holder when the CA lives elsewhere
 *  (disposition "route"). We print this rather than fabricate a second CA. */
function routeCertInstruction(user: string, hostname: string, holders: readonly string[]): string {
  return [
    `the CA for this cluster lives on ANOTHER host (trust root: ${holders.join(", ")}) and no CA`,
    "private key is present here — so this host CANNOT sign the cert (fabricating a 2nd CA would",
    "split the trust root). ROUTE: have the CA holder sign this machine's key into a cert:",
    `    bun tools/setup/persona-keys/ca-cli.ts cert --user ${user} --machine ${hostname}   # on the CA holder`,
    `  then commit machines/${hostname}.pub here and place the returned ${hostname}-cert.pub next to it.`,
  ].join("\n");
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
  /** True iff the auto-cert step was requested (a CA is now available — pre-existing or realized
   *  — and not a dry-run pure-skip). */
  readonly certRequested: boolean;
  /** The realize-CA-when-missing result, present ONLY when no local CA pre-existed so setup
   *  realized one (or, on dry-run, WOULD realize one — `action: "would-generate"`). Absent when a
   *  CA was already configured (nothing realized). ca.ts is idempotent: an existing CA never
   *  reaches here. No secret — public CA fields only. */
  readonly caRealized?: CaResult;
  /** The resolved CA disposition, when the caller supplied one (auditable: the facts + rationale). */
  readonly caDisposition?: CaDispositionResult;
  /** Present ONLY on the "route" path: the CA lives elsewhere, so NOTHING was realized or signed
   *  here and the operator must get the cert signed by the CA holder. */
  readonly caRouted?: CaRouted;
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
  // REALIZE-CA-WHEN-MISSING: a cert can always be produced as long as a CA door is wired —
  // either a CA is already configured, or we realize one below. So the cert is requested on any
  // real run that has a CA door (`fx.ca`), not only when a CA pre-existed. (No `fx.ca` ⇒ cannot
  // realize or sign ⇒ clean skip, the legacy behaviour.)
  const canProvideCa = fx.ca !== undefined;
  // CLUSTER-MEMBERSHIP (ca.ts `resolveCaDisposition`) — supplied by the CLI, which probes the
  // local CA private + the committed trust roots. When OMITTED we fall back to the legacy
  // caConfigured boolean, which yields exactly the previous present/realize behaviour and can
  // never select "route".
  const disp: CaDisposition = opts.caDisposition?.disposition ?? (opts.caConfigured ? "present" : "realize");
  // A CA is usable for signing HERE iff it is already present or we will realize it here. On
  // "route" the CA private lives on another host: we neither fabricate one nor sign.
  const caUsable = disp === "present" || disp === "realize";
  const willRealizeCa = canProvideCa && disp === "realize" && !dryRun;
  const certRequested = canProvideCa && caUsable && !dryRun;

  // ── ONE-FINGERPRINT APPROVAL (up front) ─────────────────────────────────────────────────
  // On a real run we trigger the SINGLE human approval here, through the session door. Every
  // gated sub-op below — machine keygen, the realize-CA `ensureCa`, AND cert-sign — is wired to
  // the SAME session door, so it replays this one decision and never re-prompts. FAIL-CLOSED: if
  // declined, the cached ok:false flows to every sub-op (incl. ensureCa), so NOTHING runs — no CA,
  // no key, no cert. On --dry-run we do NOT prompt (every gated op skips on dry-run anyway).
  if (!dryRun) {
    await requireBiometric(
      session.door,
      `Approve Zeta machine setup for ${opts.user} (one approval covers: machine key` +
        (willRealizeCa ? " + realize CA + cert-sign)" : certRequested ? " + cert-sign)" : ")"),
    );
  }

  // ── REALIZE-CA-WHEN-MISSING (under the SAME approval) ────────────────────────────────────
  // No local CA on this host (the solo / first-node / CA-holder case) ⇒ realize one rather than
  // skip the cert. ensureCa rides `session.door` (the one approval already decided above; FAIL-
  // CLOSED if it was declined) and is IDEMPOTENT — if a CA somehow already exists it is a no-op
  // (`exists`, no prompt). On --dry-run we still call it (dryRun:true) so the plan shows "would
  // realize CA" while generating/prompting NOTHING. commitPub writes ONLY the CA PUBLIC key (the
  // git-distributed trust root); the CA private key stays local (ca.ts, never committed here).
  // CLUSTER-MEMBERSHIP (was deferred; now closed by ca.ts `resolveCaDisposition`): when the
  // caller supplies a disposition of "route" — a committed trust root exists but the CA private
  // does NOT live here — we take NEITHER branch: no CA is realized (fabricating a 2nd CA would
  // SPLIT the cluster's trust root) and no cert is signed here. The cert is routed to the CA
  // holder instead (see `caRouted`). With no disposition supplied the legacy "no local CA ⇒
  // realize one" behaviour is unchanged.
  let caRealized: CaResult | undefined;
  if (canProvideCa && disp === "realize" && fx.ca !== undefined) {
    caRealized = await ensureCa(fx.ca, {
      ca: opts.user, // the maintainers/<user>/ trust root the CA public key lands under
      repoRoot: opts.repoRoot,
      ...(opts.home !== undefined ? { home: opts.home } : {}),
      commitPub: true,
      dryRun,
      biometricAuth: session.door,
    });
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
    // AUTO-CERT: sign the device key whenever a CA door is available — no operator flag. The CA
    // is either pre-configured OR realized above, so any host with a CA door ends with a cert.
    // onboard runs the cert step only when BOTH signWithCa is set AND fx.ca is provided, and
    // ca.ts is fail-closed: if the realize was declined (no CA private), signMachineCert returns
    // a clean `no-ca`/`aborted-biometric` skip — never a spurious or partial sign. No CA door at
    // all ⇒ signWithCa unset ⇒ the cert step is omitted entirely (the legacy clean skip).
    // On the "route" path caUsable is false ⇒ signWithCa is unset ⇒ we do NOT sign here.
    ...(canProvideCa && caUsable ? { signWithCa: true } : {}),
  };

  const res = await onboard(fx, onboardOpts);

  const decision = session.decision();
  const caRouted: CaRouted | undefined =
    disp === "route"
      ? {
          trustRoots: opts.caDisposition?.committedTrustRoots ?? [],
          instruction: routeCertInstruction(
            opts.user,
            res.hostname,
            opts.caDisposition?.committedTrustRoots ?? [],
          ),
        }
      : undefined;
  return {
    onboard: res,
    biometricApprovals: session.underlyingCalls(),
    ...(decision !== undefined ? { approval: decision } : {}),
    certRequested,
    ...(caRealized !== undefined ? { caRealized } : {}),
    ...(opts.caDisposition !== undefined ? { caDisposition: opts.caDisposition } : {}),
    ...(caRouted !== undefined ? { caRouted } : {}),
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
  // Dry-run coherence: on a fresh box the dry-run evaluates the cert step BEFORE the
  // realize-CA decision, so onboard reports cert-sign "skipped: no CA". But a CA WOULD be
  // realized this run (caRealized=would-generate), and the real flow is realize-CA → sign.
  // Relabel the cert step so the readout isn't self-contradictory ("skipped" vs "would realize").
  const certWouldFollowRealize =
    res.onboard.dryRun && res.caRealized?.action === "would-generate";
  res.onboard.steps.forEach((s, i) => {
    if (certWouldFollowRealize && s.kind === "cert-sign") {
      lines.push(`  ${i + 1}. [cert-sign] would-sign`);
      lines.push(
        `       [dry-run] would sign this machine's cert AFTER realizing the CA below` +
          ` (principal=${res.onboard.user}) — not skipped; the CA is realized first.`,
      );
      return;
    }
    lines.push(`  ${i + 1}. [${s.kind}] ${s.headline}`);
    for (const dl of s.detail.split("\n")) lines.push(`       ${dl}`);
  });
  lines.push("");
  // REALIZE-CA-WHEN-MISSING readout: present only when no local CA pre-existed so setup realized
  // (or, on dry-run, WOULD realize) one. Names the deferred join case so the operator can re-home.
  if (res.caRealized !== undefined) {
    const r = res.caRealized;
    if (r.action === "would-generate") {
      lines.push(`CA: [dry-run] would realize a new local CA at ${r.caPrivatePath} (NOTHING generated).`);
    } else if (r.action === "generated") {
      lines.push(`CA: realized a new local CA at ${r.caPrivatePath} (public key → ${r.caPublicPath}).`);
    } else if (r.action === "exists") {
      lines.push(`CA: local CA already present at ${r.caPrivatePath} — not re-created (idempotent).`);
    } else if (r.action === "aborted-biometric") {
      lines.push("CA: NOT realized — approval declined (fail-closed; no CA, no key, no cert).");
    }
    if (r.action === "would-generate" || r.action === "generated") {
      lines.push(
        "    Note: realized a NEW local CA (solo / first-node). If this host is JOINING an existing" +
          " cluster, sign via the CA holder instead and remove this local CA.",
      );
    }
  }
  // ROUTE readout: the CA lives on ANOTHER host, so NOTHING was realized or signed here. Print
  // the exact instruction to get the cert signed by the CA holder (we never fabricate a 2nd CA).
  if (res.caRouted !== undefined) {
    lines.push(
      `CA: NOT realized here — a committed trust root already exists (${res.caRouted.trustRoots.join(", ")})` +
        " but the CA private key lives on ANOTHER host. Fabricating a 2nd CA would SPLIT the trust root.",
    );
    for (const dl of res.caRouted.instruction.split("\n")) lines.push(`    ${dl}`);
  }
  lines.push(
    res.onboard.dryRun
      ? "Biometric: not invoked (dry-run). On a real run: ONE approval covers the whole sequence."
      : `Biometric: ${res.biometricApprovals} human approval(s) for the whole run (one-fingerprint).`,
  );
  const pending: { kind: string; detail: string }[] = res.onboard.steps
    .filter((s) => s.pending)
    .map((s) => ({ kind: s.kind, detail: s.detail.split("\n")[0] ?? s.headline }));
  // On the route path the cert step never ran (signWithCa unset), so it cannot appear in
  // onboard.steps — surface it explicitly as the operator action it is.
  if (res.caRouted !== undefined) {
    pending.push({
      kind: "cert-sign",
      detail: `routed: have the CA holder sign this machine's cert (trust root: ${res.caRouted.trustRoots.join(", ")}).`,
    });
  }
  if (pending.length === 0) {
    lines.push("Operator action still required: none.");
  } else {
    lines.push(`Operator action still required (${pending.length}):`);
    pending.forEach((s, i) => lines.push(`  ${i + 1}. [${s.kind}] ${s.detail}`));
  }
  return lines.join("\n");
}
