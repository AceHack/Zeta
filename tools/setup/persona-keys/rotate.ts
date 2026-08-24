// Zeta PER-PORT `rotate` — the missing "rotate" corner of the generate·rotate·teardown lifecycle
// triad (workitem 081KVP2M1QS008QG0R000JSXE1E; the onboarding round-trip harness #9016 named the
// gap). setup ✅ (setup-machine.ts) and teardown ✅ (teardown.ts) exist + are round-trip tested;
// rotate was the hole. Aaron (2026-06-21): *"force rotation support on everything from the
// beginning and make it easy so people can't get it wrong"* + *"make this [round-trip] part tight."*
//
// THE MODEL — OVERLAP-WINDOW DUAL-KEY ROTATION (the 2026-06-15 KeyState decision; Itron KeyState
// lifecycle). Every port rotates the SAME way: a NEW key is provisioned as STANDBY; for an OVERLAP
// WINDOW the old (Active) AND the new (Standby) are BOTH valid; `rotate` then PROMOTES Standby→Active
// and DEMOTES the old Active→PendingInactive→Inactive (retired after the window). This is the SAME
// gapless treaty keyset.rotate enforces for the dual-key SET — lifted to the per-PORT artifacts
// (machine key, device cert, CA key) that setup-machine / ca / teardown actually manage on disk.
//
// ∅-BLAST-RADIUS / NEVER-SINGLE-KEY (the WHY it is safe): a device cert verifies iff its SIGNING-CA
// fingerprint is in the trusted set, so a rotation is safe exactly when the trusted set AFTER is a
// SUPERSET of the trusted set BEFORE. That is now the definition, it is MEASURED on every run, and
// the operator readout states the measurement instead of the claim.
//
// IT WAS NOT TRUE BEFORE 2026-08-23, AND THE READOUT SAID IT WAS. `rotateCaKey` wrote the trust set
// as literally `[currentActive, new]`, never unioning with the CA lines already in the file: rotation
// #1 gave `[CA1, CA2]` (correct) and rotation #2 gave `[CA2, CA3]`, evicting CA1 while certs it
// signed were still inside their `-V` window — reachable from the shipped CLI by running it twice.
// Found by Mateo 2026-08-23 (docs/BUGS.md, pinned by rotate-refusals.test.ts RR-4/RR-5). Two things
// changed here, and BOTH were needed:
//
//   (a) ROTATION IS NOW ADDITIVE, ALWAYS. `rotateCaKey` unions the incoming pair with every self CA
//       line already present, and preserves peer + unrecognised lines verbatim. A rotation can no
//       longer remove a trust root — not as a side effect, not under any flag.
//   (b) A CLOSING BOUND, BECAUSE (a) ALONE TRADES THE DEFECT FOR A SLOWER ONE. Union-forever makes
//       every retired CA a PERMANENT trust root, which is worse. So a CA leaves the set only through
//       `--finalize`: a SEPARATE, operator-approved sweep that drops a retired CA only when a
//       CERTIFICATE CENSUS (ssh-cert-census.ts) proves no unexpired certificate still names it.
//
// WHY NARROWING IS NOT AUTOMATIC. The census reads the certificates committed under `<repo>/machines`
// in the CALLER's clone. A stale clone and an estate with nothing left to protect look identical from
// inside the process, and guessing wrong re-creates the P0 in slow motion. Rotation therefore never
// narrows on inference; it reports which CAs LOOK closed and leaves the act to a human — the standing
// position that the agent executes and the operator authorizes (Aaron 2026-06-21), applied to the one
// step here that is consumer-visible and hard to reverse.
//
// THREE PORTS (each provision-standby → overlap → promote → retire-old):
//   1. MACHINE KEY — generate a NEW machine ed25519 key as Standby; overlap; promote; retire the old.
//      The registered public key is updated via the repo unregister/register STAGING pattern
//      (teardown.ts `gitRm` + a register door) — NEVER a real push (Otto verify-gates; view-only).
//   2. DEVICE CERT — re-sign the cert for the new/rotated machine key, preserving the N+M invariant
//      (Key ID = machine-only, principal = user — the #8926 / #8969 lesson). Old + new cert validity
//      overlap (the old cert is still inside its `-V` window when the new one is signed).
//   3. CA KEY — rotate the CA signing key WITH OVERLAP: EVERY CA pubkey already in `TrustedUserCAKeys`
//      stays (so every existing cert still verifies) while the NEW CA signs going forward. This is
//      the delicate one — the trust SET (not a single pubkey) is the unit of rotation, and the set
//      only ever GROWS here. It shrinks only under `--finalize`, on census evidence, with approval.
//
// SECURITY INVARIANTS (security-class — honesty over green; same discipline as teardown.ts):
//  1. `--dry-run` is the DEFAULT-safe path: report exactly what WOULD rotate (the plan), touch
//     NOTHING, NEVER prompt. A real rotate requires `confirm:true` AND ONE passing biometric.
//  2. FAIL-CLOSED: a declined / absent biometric ⇒ NOTHING is generated, signed, staged, or retired.
//     The gate fires EXACTLY ONCE for the whole rotation (one fingerprint), via the shared
//     biometric.ts session gate (the same one-fingerprint property setup-machine proves).
//  3. IDEMPOTENT-AWARE: re-running MID-OVERLAP is safe. A rotation is keyed by the new artifact's
//     presence; if the new Standby already exists (a prior rotate ran), we do NOT mint a second one —
//     we resume the SAME overlap (apply-N == apply-once effect; manifesto §12). The old key is
//     retired only ONCE.
//  4. NO secret bytes EVER cross this boundary or get printed. The generate/sign doors return only
//     PUBLIC text; the private material is written locally by the runner (umask 077) and never read.
//  5. PURE-KEY MODEL preserved: a machine key is machine-independent; the cert is N+M (Key ID =
//     machine, principal = user) — rotation re-signs, it NEVER bakes a user into the Key ID.
//
// Noninterference (manifesto §13): every ambient influence (keygen, sign, filesystem, the biometric
// prompt, repo staging) enters ONLY through the injected `RotateEffects` doors — so the whole flow is
// deterministic + sandbox-testable against fakes, and the overlap/∅-blast-radius property is provable.
//
// Anchors (Beacon): OpenSSH user-CA certs (`ssh-keygen -s` / `TrustedUserCAKeys` multi-CA trust file;
// `sshd_config(5)`); ed25519 (Bernstein et al. 2011). Overlap-window dual-key rotation = the
// make-before-break / KeyState lifecycle (PKCS#11 CKA_*; NIST SP 800-57 key-states pre-activation →
// active → deactivated → destroyed; the rolling-keys discipline). Keeping BOTH trust roots valid
// across a swap so dependents never see a gap = zero-downtime key rollover (Vault / cert-manager
// issuer rotation, BLESS-style short-lived certs). `gen(gen)==gen`-style idempotent re-apply.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  signMachineCert,
  caPrivateKeyPath,
  caPublicKeyPath,
  certPath,
  realEffects as caRealEffects,
  type CaEffects,
  type CertResult,
} from "./ca.ts";
import { machinePubPath, deviceKeyPath, sanitizeHostname, realEffects as machineRealEffects } from "./machine.ts";
import { parseTrustSet, renderTrustSet, trustedUserCaKeysPath } from "./setup-cluster.ts";
import { censusOfCertificates, sshPublicKeyFingerprint, type CertificateCensus } from "./ssh-cert-census.ts";
import {
  establishedFactor,
  requireBiometric,
  sessionBiometric,
  type BiometricAuth,
  type BiometricResult,
} from "./biometric.ts";
import {
  ceremonyPromptLine,
  realBriefEffects,
  renderCeremonyBrief,
  requestedBy,
  type CeremonyBrief,
  type CeremonyBriefEffects,
} from "./ceremony-brief.ts";
export type { BiometricAuth, BiometricResult } from "./biometric.ts";

/** The ports a per-port rotate covers. Each rotates on the SAME overlap-window lifecycle. */
export type RotatePort = "machine-key" | "device-cert" | "ca-key";
export const ROTATE_PORTS: readonly RotatePort[] = ["machine-key", "device-cert", "ca-key"];

/** The overlap-window lifecycle states (Itron KeyState; NIST SP 800-57 key-states). During a
 *  rotation the OLD artifact is `active`→`pending-inactive` (still valid through the window) while
 *  the NEW one is `standby`→`active`. After the window the old is `inactive` (retired). */
export type KeyLifecycle = "active" | "standby" | "pending-inactive" | "inactive";

/**
 * The host-environment doors — the ONLY channel for ambient influence (noninterference §13). Every
 * door is PUBLIC-safe by construction: NO door returns or prints private key BYTES. Keygen/sign
 * doors return only PUBLIC text; the private material is written locally by the runner (umask 077).
 *
 * Composed from the existing port modules' effects so a rotate reuses the SAME genuine ssh-keygen
 * paths (machine.ts / ca.ts realEffects) — it does not re-implement key generation or signing.
 */
export interface RotateEffects extends CeremonyBriefEffects {
  /** True iff a path exists (presence checks — never reads the contents of a secret). */
  readonly exists: (path: string) => boolean;
  /** Read a PUBLIC text artifact (a pubkey / cert / the trusted-CA-keys file). Never a private path. */
  readonly readText: (path: string) => string;
  /** Write a PUBLIC text artifact (a registered pubkey, a cert, the trusted-CA-keys file). */
  readonly writeText: (path: string, content: string) => void;
  /** Create a directory (recursive). */
  readonly mkdirp: (path: string) => void;
  /**
   * Generate an ed25519 keypair at `keyPath` (private) + `keyPath.pub` (public). The runner writes
   * the PRIVATE key under umask 077; this returns ONLY the PUBLIC key text. Used to mint the new
   * STANDBY machine key and the new STANDBY CA key (a CA key is also just an ed25519 keypair).
   */
  readonly genEd25519: (keyPath: string, comment: string) => string;
  /**
   * MOVE a keypair (the private key at `from` + its `from.pub`) to `to` (+ `to.pub`) — the
   * promotion/retirement filesystem op. The private bytes are relocated by the runner; they are
   * NEVER read into this process. Idempotent: moving an absent source is a no-op. This is the ONLY
   * door that touches private material, and it does so opaquely (paths in, nothing secret out).
   */
  readonly movePrivate: (from: string, to: string) => void;
  /**
   * List the certificate files a CENSUS may stand on (`<repoRoot>/machines/*-cert.pub`). A
   * certificate is PUBLIC; nothing secret crosses here. OPTIONAL, and its absence is meaningful:
   * with no census door there is NO evidence a retired CA is unneeded, so `--finalize` drops
   * NOTHING (fail-closed — absence of evidence never licenses narrowing trust).
   */
  readonly listCerts?: (repoRoot: string) => readonly string[];
  /**
   * The instant expiry is judged against, unix seconds. Injected, never ambient (§13
   * noninterference). This is a LOCAL decision — "is this certificate stale TO ME" — which is
   * exactly the use `local-time-never-enters-the-shared-fold` permits a wall clock; no shared
   * fold consumes it. OPTIONAL; without it no census can be built and nothing is dropped.
   */
  readonly nowEpochSeconds?: () => number;
  /** The ca.ts CertEffects subset needed to RE-SIGN a cert (the device-cert port). Reuses ca.ts
   *  `signMachineCert` so the N+M invariant (Key ID = machine, principal = user) is enforced there,
   *  not re-implemented here. */
  readonly ca: CaEffects;
  /**
   * STAGE a repo change for a PR — NEVER pushes, NEVER touches main directly (shared-checkout is
   * view-only; Otto verify-gates). Used to update the registered machine pubkey + cert + the
   * trusted-CA-keys file in the CALLER's clone. Mirrors teardown.ts `gitRm` (the unregister half);
   * here it is the register/update half. Returns true iff staged. Operates ONLY under `repoRoot`.
   */
  readonly stageRepoWrite: (repoRoot: string, relPath: string) => boolean;
}

/** Where the RETIRING (old) machine private key is parked during the overlap window so it can be
 *  wiped after the window (teardown.ts wipes ~/.config/zeta/machine; the retired key goes to a
 *  sibling `machine/retired/` so the new Active is the canonical id_ed25519). Path only — never read. */
export function retiredMachineKeyPath(home: string): string {
  return join(zetaMachineDir(home), "retired", "id_ed25519.previous");
}

/** Where a NEW STANDBY machine key is staged before promotion (so old + new coexist = overlap). */
export function standbyMachineKeyPath(home: string): string {
  return join(zetaMachineDir(home), "standby", "id_ed25519.next");
}

/** Where a NEW STANDBY CA key is staged before promotion (old CA still signs/verifies meanwhile). */
export function standbyCaKeyPath(home: string): string {
  return join(zetaCaDir(home), "standby", "ssh_ca_ed25519.next");
}

/** Where the RETIRING (old) CA private key is parked during overlap (wiped after the window). */
export function retiredCaKeyPath(home: string): string {
  return join(zetaCaDir(home), "retired", "ssh_ca_ed25519.previous");
}

/**
 * The retired slot for GENERATION `n` (1 = the base path above). Retirement used to write ONE fixed
 * path and `movePrivate` renamed onto it, so rotation #2 destroyed rotation #1's retired private key
 * — irreversibly, unattended, with no ceremony, while `ceremony-gate.ts` classifies
 * `export-or-destroy-key` as `biometric-ceremony` and manifesto §5 forbids an identity transition
 * silently destroying memory (docs/BUGS.md, pinned by rotate-refusals.test.ts RR-6).
 *
 * Generation-suffixing is deliberately the boring fix: content-addressing a retired PRIVATE key
 * would require reading its bytes, and no door here is allowed to.
 */
export function retiredKeyPathForGeneration(base: string, generation: number): string {
  return generation <= 1 ? base : `${base}.${generation}`;
}

/** The maximum retired generations kept before a rotation REFUSES. A refusal is the correct end of
 *  this road: the alternative is choosing which retired key to destroy, which is a gated act. */
export const MAX_RETIRED_GENERATIONS = 64;

/**
 * The FIRST FREE retired slot for `base` — never an occupied one. A slot counts as occupied if
 * EITHER the private path or its `.pub` exists (presence only; no byte is read). Throws once
 * `MAX_RETIRED_GENERATIONS` slots are full rather than clobbering: destroying retired key material
 * is `export-or-destroy-key`, a ceremony this module does not perform.
 */
export function allocateRetiredSlot(fx: RotateEffects, base: string): string {
  for (let generation = 1; generation <= MAX_RETIRED_GENERATIONS; generation++) {
    const candidate = retiredKeyPathForGeneration(base, generation);
    if (!fx.exists(candidate) && !fx.exists(candidate + ".pub")) return candidate;
  }
  throw new Error(
    `retired-key archive is full (${MAX_RETIRED_GENERATIONS} generations under ${dirOf(base)}). ` +
      "Refusing to overwrite retired key material: destroying a key is a ceremony " +
      "(ceremony-gate.ts `export-or-destroy-key`), not a side effect of a rotation.",
  );
}

function zetaMachineDir(home: string): string {
  return join(home, ".config", "zeta", "machine");
}
function zetaCaDir(home: string): string {
  return join(home, ".config", "zeta", "ca");
}

/** One port's rotation outcome (or, on dry-run, what WOULD happen). PUBLIC only — no secret bytes. */
export interface PortRotation {
  readonly port: RotatePort;
  /** "rotated" (real swap done) | "would-rotate" (dry-run) | "in-overlap" (idempotent resume:
   *  a prior rotate already staged the standby; this run did not mint a second) | "absent"
   *  (nothing to rotate — the port was never set up) | "skipped-not-confirmed" | "skipped-biometric"
   *  | the `--finalize` family: "finalized" (retired CA line(s) dropped on census evidence) |
   *  "would-finalize" (dry-run of the sweep) | "finalize-noop" (nothing was eligible) |
   *  "finalize-refused" (eligible-looking, but the evidence does not support dropping) |
   *  "skipped-finalize" (this port has no finalize meaning — only the CA trust SET does). */
  readonly action:
    | "rotated"
    | "would-rotate"
    | "in-overlap"
    | "absent"
    | "skipped-not-confirmed"
    | "skipped-biometric"
    | "finalized"
    | "would-finalize"
    | "finalize-noop"
    | "finalize-refused"
    | "skipped-finalize";
  /** The NEW (incoming) artifact's local/public path (the standby being promoted). */
  readonly newArtifactPath: string;
  /** The OLD (retiring) artifact's parked path (where it overlaps before being wiped). */
  readonly retiredArtifactPath: string;
  /** Repo paths STAGED for a PR by this port (updated pubkey / cert / trusted-CA-keys). NEVER pushed. */
  readonly stagedPaths: readonly string[];
  /** A one-line public detail for the readout (no secret). */
  readonly detail: string;
  /** MEASURED trust-set movement — present only on the `ca-key` port, only when the trust file was
   *  actually written. This is what makes the ∅-blast-radius line in the readout a measurement
   *  rather than a slogan; `formatRotate` prints the claim ONLY from this. PUBLIC (fingerprints). */
  readonly trust?: TrustSetDelta;
}

/** What actually happened to the set `sshd` consults, in fingerprints. No key bytes. */
export interface TrustSetDelta {
  /** Every trusted CA fingerprint BEFORE this run (self + peer + unrecognised lines alike). */
  readonly before: readonly string[];
  /** Every trusted CA fingerprint AFTER this run. */
  readonly after: readonly string[];
  /** Fingerprints present before and NOT after. Non-empty ⇒ certs signed by them now FAIL. */
  readonly dropped: readonly string[];
  /** Fingerprints present after and not before. */
  readonly added: readonly string[];
  /** True iff `after ⊇ before` — the ∅-blast-radius property, measured. */
  readonly supersetOfBefore: boolean;
  /** SELF CA fingerprints the census says nothing unexpired needs any more — the `--finalize`
   *  candidates. Empty when no census could be built. */
  readonly closedWindows: readonly string[];
  /** The evidence the two fields above stand on. Absent ⇒ no census door was wired. */
  readonly census?: CensusSummary;
}

/** The census, reduced to what an operator readout should state. */
export interface CensusSummary {
  readonly certificatesFound: number;
  readonly complete: boolean;
  /** Paths whose certificate could not be parsed (each one blocks every drop). */
  readonly unparseable: readonly string[];
}

/** The full rotate result — auditable, public-only (the same shape discipline as TeardownResult). */
export interface RotateResult {
  readonly dryRun: boolean;
  readonly confirmed: boolean;
  readonly home: string;
  readonly repoRoot: string;
  readonly user: string;
  readonly hostname: string;
  readonly ca: string;
  /** Which ports were requested this run. */
  readonly ports: readonly RotatePort[];
  readonly rotations: readonly PortRotation[];
  /** True iff there was anything to rotate at all (any requested port was set up). When false the
   *  run is a clean no-op and the gate is never fired. */
  readonly hadWork: boolean;
  /** The biometric approval outcome — present ONLY when the gate was actually invoked (a confirmed,
   *  non-dry-run with work to do). Absent on dry-run / non-confirmed / nothing-to-do. No secret. */
  readonly biometric?: BiometricResult;
  /** Every repo path staged for a PR across all ports (the PR's change set). NEVER pushed. */
  readonly stagedPaths: readonly string[];
}

/** Options for a rotation. `dryRun` defaults TRUE at the CLI; here the explicit value governs.
 *  A real rotate requires `dryRun:false` AND `confirm:true` AND a passing biometric. */
export interface RotateOptions {
  /** The user the device cert binds to (the `-n` principal — N+M: principal = user). */
  readonly user: string;
  /** The CA identity (`maintainers/<ca>/`; the trust root whose pubkey set is rotated). */
  readonly ca: string;
  readonly repoRoot: string;
  readonly home: string;
  /** This host's name (the machine-only Key ID + the `machines/<host>.pub` registry key). */
  readonly hostname: string;
  /** Which ports to rotate. Defaults to ALL (`ROTATE_PORTS`). */
  readonly ports?: readonly RotatePort[];
  /** Validity window for the re-signed device cert (OpenSSH `-V`). Defaults in ca.ts. */
  readonly certValidity?: string;
  /** A DETERMINISTIC suffix so two distinct rotations stage distinct registry filenames in a test
   *  (DST-replayable). Optional; production omits it (timestamps/serials live in the cert itself). */
  readonly rotationTag?: string;
  /** When true (default at CLI), NOTHING is generated/signed/staged/prompted — report "would-*". */
  readonly dryRun?: boolean;
  /** Explicit destructive confirmation. WITHOUT it (on a non-dry-run) every step is
   *  "skipped-not-confirmed". WITH it (+ biometric) the real swap happens. */
  readonly confirm?: boolean;
  /**
   * FINALIZE mode — the CLOSING BOUND, and the ONLY path by which a CA leaves the trust set.
   *
   * A finalize run rotates NOTHING. It sweeps the `TrustedUserCAKeys` self lines and drops each one
   * that a CERTIFICATE CENSUS proves is no longer needed: not the active signer, and named by ZERO
   * unexpired certificates. Every other candidate is REFUSED with its reason. Requires the same
   * `confirm:true` + ONE biometric as a rotation, and the prompt NAMES each CA it would drop —
   * because this is the direction that can break something, so it is the direction a human approves.
   */
  readonly finalize?: boolean;
  /** SHARED biometric approval door — required for the real rotate path (fail-closed). */
  readonly biometricAuth?: BiometricAuth;
}

/**
 * Run the per-port rotation on the overlap-window lifecycle. DEFAULT-safe: on `dryRun` (or a
 * non-dry-run WITHOUT `confirm`) it reports exactly what WOULD rotate and touches NOTHING and NEVER
 * prompts. A real rotate requires `dryRun:false` AND `confirm:true` AND ONE passing biometric (fired
 * exactly once for the whole run). Idempotent-aware: re-running mid-overlap RESUMES the same overlap
 * (a standby already present is not re-minted; the old key is retired only once).
 *
 * The plan is computed FIRST (pure presence checks) so the readout is honest on every path; the
 * generate/sign/stage doors fire ONLY after the confirm + biometric gate.
 */
export async function rotate(fx: RotateEffects, opts: RotateOptions): Promise<RotateResult> {
  const home = opts.home;
  const hostname = sanitizeHostname(opts.hostname);
  const dryRun = opts.dryRun !== false; // DEFAULT-safe: anything but an explicit false is dry-run
  const confirmed = opts.confirm === true;
  const ports = opts.ports ?? ROTATE_PORTS;

  // ── ROSTER CHECK — in the MECHANISM, not in two copies in two CLIs ────────────────────
  // The dispatch below is TOTAL over `RotatePort` (two `default`-less switches), so an UNCLASSIFIED
  // member is a compile error. That closes the TYPE; it cannot close the VALUES. A value cast into
  // the union (`"ca_key" as RotatePort`) matches no case and would fall out of a total switch as
  // `undefined` — so the two guards are complements, and neither substitutes for the other.
  // `rotate-cli.ts` and `rotate-cluster-cli.ts` each carried their own copy of this filter; the
  // mechanism carried none, so every programmatic caller ran unguarded.
  //
  // The WHOLE RUN is refused, never just the offending port: a run that silently dropped one
  // requested port would raise one prompt for an act and perform a smaller one — the same
  // approval/action mismatch this refusal exists to prevent. Fail-closed and BEFORE the plan, so on
  // an input we cannot name nothing is read, nothing is staged, and no prompt is ever raised.
  const unknownPorts = ports.filter((p) => !ROTATE_PORTS.includes(p));
  if (unknownPorts.length > 0) {
    throw new Error(
      `unknown rotate port(s): ${unknownPorts.join(", ")}. Known ports: ${ROTATE_PORTS.join(", ")}. ` +
        "Refusing the WHOLE run: dispatching an unrecognised port to a different one would report a " +
        "rotation that did not happen, under a biometric approval naming the port that did not move.",
    );
  }

  // ── PLAN (pure presence checks — no side effects, no prompt) ──────────────────────────────
  // A port is rotatable iff it was set up (its current Active artifact exists). The plan also
  // notes whether a STANDBY already exists (idempotent mid-overlap resume).
  const plans = ports.map((port) => planPort(fx, port, { home, hostname, ca: opts.ca, repoRoot: opts.repoRoot }));

  // ── FINALIZE MODE — the CLOSING BOUND. A separate act with a separate readout and a separate
  // prompt: it rotates nothing and it is the ONLY path that can remove a CA from the trust set.
  // The plan is computed HERE, before the gate, so the approval prompt can name every drop.
  const finalizing = opts.finalize === true;
  if (finalizing) {
    return await runFinalize(fx, opts, plans, ports, hostname, dryRun, confirmed);
  }

  const hadWork = plans.some((p) => p.present);

  // ── DRY-RUN (default-safe) — report would-*; NOTHING touched, NEVER prompt ─────────────────
  if (dryRun) {
    return finalize({
      dryRun: true,
      confirmed,
      home,
      repoRoot: opts.repoRoot,
      user: opts.user,
      hostname,
      ca: opts.ca,
      ports,
      rotations: plans.map((p) => emptyRotation(p, p.present ? "would-rotate" : "absent")),
      hadWork,
    });
  }

  // ── REAL RUN, NOT CONFIRMED — skip everything (fail-safe), NEVER prompt ────────────────────
  if (!confirmed) {
    return finalize({
      dryRun: false,
      confirmed: false,
      home,
      repoRoot: opts.repoRoot,
      user: opts.user,
      hostname,
      ca: opts.ca,
      ports,
      rotations: plans.map((p) => emptyRotation(p, p.present ? "skipped-not-confirmed" : "absent")),
      hadWork,
    });
  }

  // ── IDEMPOTENT CLEAN NO-OP — nothing set up, so nothing to rotate; NEVER prompt ────────────
  if (!hadWork) {
    return finalize({
      dryRun: false,
      confirmed: true,
      home,
      repoRoot: opts.repoRoot,
      user: opts.user,
      hostname,
      ca: opts.ca,
      ports,
      rotations: plans.map((p) => emptyRotation(p, "absent")),
      hadWork: false,
    });
  }

  // ── BIOMETRIC GATE — fired EXACTLY ONCE for the whole rotation (fail-closed, one-fingerprint) ─
  // Wrap the injected door in a SESSION gate (biometric.ts): the up-front approval here is the ONE
  // human prompt; every gated sub-op (the device-cert re-sign in ca.ts `signMachineCert`) rides the
  // SAME `session.door`, replaying this decision — so the whole rotation is ONE fingerprint, never
  // N. FAIL-CLOSED: a declined approval poisons the session, so the cert sub-op aborts too.
  //
  // THE PROMPT NAMES WHAT WILL BE PERFORMED, NOT WHAT WAS REQUESTED. It used to render
  // `opts.ports` — the REQUEST — which is a second, independent derivation of "which port", and two
  // derivations can disagree. They did: an unrecognised port was requested, `device-cert` was
  // performed, and the prompt named the request. Under the standing position that the biometric IS
  // the authorization, an approval whose text describes a different act is not an authorization for
  // the act performed (`describeFinalizePlan` says exactly this on the finalize side).
  //
  // `performing` is read off the SAME classified `plans` the dispatcher consumes below, so there is
  // now ONE derivation feeding both. It also drops absent ports, which the old text kept: rotating
  // `--ports machine-key,ca-key` on a host with no CA set up used to prompt for a CA swap that
  // never happened. `hadWork` above guarantees this list is non-empty here.
  const session = sessionBiometric(opts.biometricAuth);
  const performing = plans.filter((p) => p.present).map((p) => p.port);
  //
  // THE BRIEF derives from `performing` — the SAME array the dispatcher consumes below, and
  // the same one the paragraph above explains. The operation id is chosen by what is
  // ACTUALLY being swapped: a rotation that includes `ca-key` moves the trust anchor
  // (`rotate-node-root-key`, gated); one that does not is leaf work
  // (`rotate-leaf-signing-key`, which `ceremony-gate.ts` classifies UNATTENDED — and the
  // brief will say so on the prompt rather than let a routine approval pass for a root one).
  // Reading the id off `performing` keeps the ONE-derivation property this block already
  // earned: there is still no path by which the request could name the operation while the
  // dispatcher performs another.
  const rotateBrief: CeremonyBrief = {
    operation: performing.includes("ca-key") ? "rotate-node-root-key" : "rotate-leaf-signing-key",
    summary: "Rotate this host's keys on the overlap window (mint standby, promote, retire old)",
    subjects: [
      { label: "host", value: hostname },
      { label: "user", value: opts.user },
      { label: "CA", value: opts.ca },
      { label: "swapping", value: performing.join(", ") },
    ],
    ifDeclined:
      "nothing is swapped, minted, promoted or retired; the keys currently in use stay in " +
      "use and this command exits reporting the rotation as not confirmed. Declining is " +
      "safe at this point precisely because no port has been touched yet.",
    ...requestedBy(fx.requester),
  };
  fx.notify?.(renderCeremonyBrief(rotateBrief));
  const biometric = await requireBiometric(session.door, ceremonyPromptLine(rotateBrief));
  if (!biometric.ok) {
    return finalize({
      dryRun: false,
      confirmed: true,
      home,
      repoRoot: opts.repoRoot,
      user: opts.user,
      hostname,
      ca: opts.ca,
      ports,
      biometric,
      rotations: plans.map((p) => emptyRotation(p, p.present ? "skipped-biometric" : "absent")),
      hadWork,
    });
  }

  // ── REAL ROTATION (approved) ───────────────────────────────────────────────────────────────
  // Order matters for the CA port's ∅-blast-radius: a CA rotate must ADD the new CA pubkey to the
  // trusted set BEFORE retiring the old (the old stays during overlap). Each port handler does its
  // own overlap-correct sequencing; we run them in declared order (machine → cert → ca by default,
  // but each is independent and idempotent so order is not load-bearing across ports).
  const rotations: PortRotation[] = [];
  for (const p of plans) {
    if (!p.present) {
      rotations.push(emptyRotation(p, "absent"));
      continue;
    }
    rotations.push(await rotatePort(fx, p, opts, session.door));
  }

  return finalize({
    dryRun: false,
    confirmed: true,
    home,
    repoRoot: opts.repoRoot,
    user: opts.user,
    hostname,
    ca: opts.ca,
    ports,
    biometric,
    rotations,
    hadWork: true,
  });
}

// ── TRUST SET + CENSUS (the evidence the closing bound stands on) ────────────────────────────────

/** The trust set as it exists on disk, classified and fingerprinted. PUBLIC throughout. */
interface TrustSetSnapshot {
  readonly path: string;
  readonly present: boolean;
  readonly self: readonly string[];
  readonly peers: readonly { readonly name: string; readonly publicKey: string }[];
  readonly unclassified: readonly string[];
  /** Every trusted line, fingerprinted — the set `sshd` effectively compares against. */
  readonly fingerprints: readonly string[];
}

function readTrustSet(fx: RotateEffects, repoRoot: string, ca: string): TrustSetSnapshot {
  const path = trustedUserCaKeysPath(repoRoot, ca);
  if (!fx.exists(path)) {
    return { path, present: false, self: [], peers: [], unclassified: [], fingerprints: [] };
  }
  const parsed = parseTrustSet(fx.readText(path));
  const all = [...parsed.self, ...parsed.peers.map((x) => x.publicKey), ...parsed.unclassified];
  return {
    path,
    present: true,
    self: parsed.self,
    peers: parsed.peers,
    unclassified: parsed.unclassified,
    fingerprints: all.map(safeFingerprint),
  };
}

/** Fingerprint a public-key line, or return a stable marker if it is not key material. Never
 *  throws into the rotation path: an unreadable line is still PRESERVED, just not identified. */
function safeFingerprint(line: string): string {
  try {
    return sshPublicKeyFingerprint(line);
  } catch {
    return "UNFINGERPRINTABLE";
  }
}

/**
 * Build the certificate census, or `undefined` when the doors to build one were not wired. The
 * distinction matters and is preserved all the way to the readout: an EMPTY census ("we looked and
 * found nothing") and NO census ("we could not look") license completely different actions, and
 * conflating them is how an inference becomes an eviction.
 */
function buildCensus(fx: RotateEffects, repoRoot: string): CertificateCensus | undefined {
  const list = fx.listCerts;
  const now = fx.nowEpochSeconds;
  if (list === undefined || now === undefined) return undefined;
  const texts = list(repoRoot).map((path) => {
    try {
      return { path, text: fx.readText(path) };
    } catch {
      // Unreadable is NOT absent. An empty text fails to parse, which makes the census INCOMPLETE,
      // which blocks every drop — the fail-closed direction.
      return { path, text: "" };
    }
  });
  return censusOfCertificates(texts, now());
}

function summarizeCensus(census: CertificateCensus | undefined): CensusSummary | undefined {
  if (census === undefined) return undefined;
  return {
    certificatesFound: census.certificatesFound,
    complete: census.complete,
    unparseable: census.entries.filter((e) => !e.parsed).map((e) => e.path),
  };
}

/** SELF CA fingerprints that no unexpired certificate names — the `--finalize` candidates. Empty
 *  whenever the census is missing, incomplete or empty, because each of those is a reason to keep
 *  every line rather than a reason to drop one. */
function closedWindowFingerprints(
  selfLines: readonly string[],
  activeFingerprint: string | undefined,
  census: CertificateCensus | undefined,
): readonly string[] {
  if (census === undefined || !census.complete || census.certificatesFound === 0) return [];
  const needed = new Set(census.unexpiredSigners);
  const out: string[] = [];
  for (const line of selfLines) {
    const fp = safeFingerprint(line);
    if (fp === "UNFINGERPRINTABLE" || fp === activeFingerprint || needed.has(fp)) continue;
    if (!out.includes(fp)) out.push(fp);
  }
  return out;
}

// ── FINALIZE: the closing bound ─────────────────────────────────────────────────────────────────

/** One self-CA line's verdict under a finalize sweep. `eligible:false` carries the reason it is
 *  kept, so a refusal is never silent. */
export interface FinalizeCandidate {
  readonly fingerprint: string;
  readonly eligible: boolean;
  readonly reason: string;
}

/** The whole sweep, computed BEFORE the biometric gate so the prompt can name what it approves. */
export interface FinalizePlan {
  readonly trustSetPath: string;
  readonly candidates: readonly FinalizeCandidate[];
  /** The lines (verbatim) that would be dropped. */
  readonly dropLines: readonly string[];
  readonly dropFingerprints: readonly string[];
  readonly census?: CensusSummary;
  /** The active signer, which is never a candidate. Undefined when the CA private is absent. */
  readonly activeFingerprint?: string;
}

/**
 * Compute the finalize sweep. PURE over the injected doors: reads the trust set, the CA public half
 * and the committed certificates; writes nothing, prompts for nothing.
 *
 * A self CA line is ELIGIBLE to drop only when EVERY one of these holds:
 *   1. it is not the ACTIVE signer (never drop the key that signs going forward);
 *   2. a census could be built at all (both doors wired) — no doors, no drops;
 *   3. the census is COMPLETE — one unparseable certificate could be the one that names it;
 *   4. the census found at least ONE certificate — zero is indistinguishable from a wrong
 *      `--repo-root`, and "I found nothing" is not "there is nothing";
 *   5. no UNEXPIRED certificate in the census names it as signer.
 * Peer CAs and unrecognised lines are NEVER candidates: this cluster did not issue them and cannot
 * reason about what they protect.
 */
export function planFinalize(fx: RotateEffects, opts: RotateOptions): FinalizePlan {
  const snapshot = readTrustSet(fx, opts.repoRoot, opts.ca);
  const activePub = caPrivateKeyPath(opts.home) + ".pub";
  const activeFingerprint = fx.exists(activePub) ? safeFingerprint(fx.readText(activePub)) : undefined;
  const census = buildCensus(fx, opts.repoRoot);
  const summary = summarizeCensus(census);

  const candidates: FinalizeCandidate[] = [];
  const dropLines: string[] = [];
  for (const line of snapshot.self) {
    const fp = safeFingerprint(line);
    const verdict = judgeFinalizeCandidate(fp, activeFingerprint, census, opts.repoRoot);
    candidates.push({ fingerprint: fp, ...verdict });
    if (verdict.eligible) dropLines.push(line);
  }
  return {
    trustSetPath: snapshot.path,
    candidates,
    dropLines,
    dropFingerprints: dropLines.map(safeFingerprint),
    ...(summary !== undefined ? { census: summary } : {}),
    ...(activeFingerprint !== undefined ? { activeFingerprint } : {}),
  };
}

function judgeFinalizeCandidate(
  fingerprint: string,
  activeFingerprint: string | undefined,
  census: CertificateCensus | undefined,
  repoRoot: string,
): { readonly eligible: boolean; readonly reason: string } {
  if (fingerprint === "UNFINGERPRINTABLE") {
    return { eligible: false, reason: "line is not identifiable as a public key — preserved, never dropped" };
  }
  if (activeFingerprint === undefined) {
    return {
      eligible: false,
      reason:
        "the ACTIVE CA private key is absent on this host, so the signer of record cannot be excluded from the sweep",
    };
  }
  if (fingerprint === activeFingerprint) {
    return { eligible: false, reason: "this is the ACTIVE signer — never a candidate" };
  }
  if (census === undefined) {
    return {
      eligible: false,
      reason:
        "no certificate census available (no listCerts/nowEpochSeconds door wired) — trust is never narrowed on absent evidence",
    };
  }
  if (!census.complete) {
    const bad = census.entries.filter((e) => !e.parsed).length;
    return {
      eligible: false,
      reason: `census INCOMPLETE — ${bad} certificate(s) could not be parsed, and any one of them could name this CA`,
    };
  }
  if (census.certificatesFound === 0) {
    return {
      eligible: false,
      reason: `census found NO certificates under ${repoRoot}/machines — an empty estate and a wrong --repo-root are indistinguishable from here`,
    };
  }
  if (census.unexpiredSigners.includes(fingerprint)) {
    return { eligible: false, reason: "an UNEXPIRED certificate still names this CA as its signer" };
  }
  return {
    eligible: true,
    reason: `no unexpired certificate names this CA (census: ${census.certificatesFound} certificate(s), complete)`,
  };
}

/** The one-line human-facing summary of a sweep, used verbatim inside the biometric prompt. A
 *  prompt that does not name what it destroys is not an authorization for it. */
export function describeFinalizePlan(plan: FinalizePlan): string {
  if (plan.dropFingerprints.length === 0) {
    return "DROP nothing (no retired CA has a provably closed window)";
  }
  return `DROP ${plan.dropFingerprints.length} retired CA(s) from the trust set [${plan.dropFingerprints.join(", ")}] — certificates signed by them will STOP verifying`;
}

/**
 * Run a FINALIZE sweep — the closing bound, as its own act.
 *
 * DEFAULT-SAFE exactly like a rotation: no `dryRun:false` + `confirm:true` + passing biometric ⇒
 * nothing is written. The difference is the PROMPT, which names each CA that would leave the trust
 * set and says plainly that certificates signed by them stop verifying. Under the standing position
 * that the biometric IS the authorization, an approval whose text does not describe the act is not
 * an authorization for that act — so this prompt is not the rotation prompt with a flag appended.
 *
 * Ports other than `ca-key` are reported `skipped-finalize`: finalizing is a property of the trust
 * SET, and a machine key or a device cert has no equivalent.
 */
async function runFinalize(
  fx: RotateEffects,
  opts: RotateOptions,
  plans: readonly PortPlan[],
  ports: readonly RotatePort[],
  hostname: string,
  dryRun: boolean,
  confirmed: boolean,
): Promise<RotateResult> {
  const plan = planFinalize(fx, opts);
  const caPlan = plans.find((p) => p.port === "ca-key");
  const base = {
    home: opts.home,
    repoRoot: opts.repoRoot,
    user: opts.user,
    hostname,
    ca: opts.ca,
    ports,
  };
  const others = plans.filter((p) => p.port !== "ca-key").map((p) => emptyRotation(p, "skipped-finalize"));
  const hadWork = caPlan !== undefined && plan.candidates.length > 0;

  // Nothing to sweep, or the CA port was not requested: a clean, prompt-free no-op.
  if (caPlan === undefined || !hadWork) {
    return finalize({
      ...base,
      dryRun,
      confirmed,
      hadWork: false,
      rotations: [...(caPlan !== undefined ? [finalizeReport(caPlan, plan, "finalize-noop")] : []), ...others],
    });
  }

  const nothingEligible = plan.dropLines.length === 0;

  if (dryRun) {
    return finalize({
      ...base,
      dryRun: true,
      confirmed,
      hadWork,
      rotations: [finalizeReport(caPlan, plan, nothingEligible ? "finalize-refused" : "would-finalize"), ...others],
    });
  }
  if (!confirmed) {
    return finalize({
      ...base,
      dryRun: false,
      confirmed: false,
      hadWork,
      rotations: [finalizeReport(caPlan, plan, "skipped-not-confirmed"), ...others],
    });
  }
  // Nothing is eligible ⇒ there is nothing to authorize, so the operator is NEVER prompted. A gate
  // fired for a no-op trains people to approve without reading, which is how a gate stops working.
  if (nothingEligible) {
    return finalize({
      ...base,
      dryRun: false,
      confirmed: true,
      hadWork,
      rotations: [finalizeReport(caPlan, plan, "finalize-refused"), ...others],
    });
  }

  const session = sessionBiometric(opts.biometricAuth);
  const biometric = await requireBiometric(
    session.door,
    `Approve Zeta trust-set FINALIZE for ca ${opts.ca} on host ${hostname}: ${describeFinalizePlan(plan)}`,
  );
  if (!biometric.ok) {
    return finalize({
      ...base,
      dryRun: false,
      confirmed: true,
      biometric,
      hadWork,
      rotations: [finalizeReport(caPlan, plan, "skipped-biometric"), ...others],
    });
  }
  return finalize({
    ...base,
    dryRun: false,
    confirmed: true,
    biometric,
    hadWork,
    rotations: [finalizeCaTrustSet(fx, opts, plan, caPlan), ...others],
  });
}

// ── Per-port PLAN ──────────────────────────────────────────────────────────────────────────────

interface PortPlanFields {
  /** Is the CURRENT (Active) artifact present (i.e. was this port set up)? */
  readonly present: boolean;
  /** Is a STANDBY already staged (a prior rotate is mid-overlap)? */
  readonly standbyPresent: boolean;
  readonly newArtifactPath: string;
  readonly retiredArtifactPath: string;
  readonly ctx: PortCtx;
}

/**
 * A plan, DISCRIMINATED by the port it was classified as. The union member — not a `RotatePort`
 * field — is what lets `rotatePort` hand each handler a plan only that handler accepts, so wiring
 * `case "ca-key"` to the device-cert handler is a TYPE ERROR rather than the silent wrong-port
 * rotation this file used to allow. `port` is written as a LITERAL at each classification site in
 * `planPort`, never echoed from the parameter: the plan states what was CLASSIFIED, not what was
 * ASKED FOR, and the biometric prompt is rendered from these.
 */
interface MachineKeyPlan extends PortPlanFields {
  readonly port: "machine-key";
}
interface DeviceCertPlan extends PortPlanFields {
  readonly port: "device-cert";
}
interface CaKeyPlan extends PortPlanFields {
  readonly port: "ca-key";
}
type PortPlan = MachineKeyPlan | DeviceCertPlan | CaKeyPlan;

/** A rotation outcome pinned to ONE port — the return type that binds a handler to its case. */
type RotationOf<P extends RotatePort> = PortRotation & { readonly port: P };

interface PortCtx {
  readonly home: string;
  readonly hostname: string;
  readonly ca: string;
  readonly repoRoot: string;
}

/**
 * TOTAL classifier — the pattern `ceremony-gate.ts` `ceremonyRequirementFor` already earns in this
 * codebase, applied to its sibling. The `switch` has NO `default`, and the declared return type is
 * not `undefined`-inhabited, so a new `RotatePort` member is a TYPE ERROR (TS2366, "function lacks
 * ending return statement") until it is classified here. It used to be an if-chain whose fallthrough
 * was `device-cert`: a fourth member would have silently inherited device-cert behaviour in both
 * this function and `rotatePort` with no type error anywhere — that was the defect, and the
 * not-reachable-from-the-CLIs `"ca_key"` typo was only its most visible symptom.
 *
 * Each case writes its `port` as a LITERAL rather than passing the narrowed parameter through, so
 * the plan carries what the classifier DECIDED. The prompt and the dispatch both read that.
 */
function planPort(fx: RotateEffects, port: RotatePort, ctx: PortCtx): PortPlan {
  switch (port) {
    case "machine-key": {
      const active = deviceKeyPath(ctx.home);
      const standby = standbyMachineKeyPath(ctx.home);
      return {
        port: "machine-key",
        present: fx.exists(active),
        standbyPresent: fx.exists(standby),
        newArtifactPath: standby,
        retiredArtifactPath: retiredMachineKeyPath(ctx.home),
        ctx,
      };
    }
    case "ca-key": {
      const active = caPrivateKeyPath(ctx.home);
      const standby = standbyCaKeyPath(ctx.home);
      return {
        port: "ca-key",
        present: fx.exists(active),
        standbyPresent: fx.exists(standby),
        newArtifactPath: standby,
        retiredArtifactPath: retiredCaKeyPath(ctx.home),
        ctx,
      };
    }
    case "device-cert": {
      // present iff BOTH the machine pubkey (to certify) and the CA private (to sign) exist.
      const devPub = machinePubPath(ctx.repoRoot, ctx.hostname);
      const cert = certPath(devPub);
      const caPriv = caPrivateKeyPath(ctx.home);
      return {
        port: "device-cert",
        present: fx.exists(devPub) && fx.exists(caPriv),
        standbyPresent: false, // a cert re-sign is idempotent in place (overwrites the same -cert.pub)
        newArtifactPath: cert,
        retiredArtifactPath: cert, // re-signed in place; old cert validity overlaps the new (-V window)
        ctx,
      };
    }
  }
}

// ── Per-port ROTATION (post-gate) ────────────────────────────────────────────────────────────────

/**
 * TOTAL dispatcher, and it is total in BOTH directions.
 *
 * DOWN — no `default`: a new `RotatePort` member is a type error here too, so it cannot inherit
 * device-cert behaviour by falling off the end of an if-chain.
 *
 * ACROSS — each handler takes the NARROWED plan type and returns `RotationOf<its own port>`, so
 * `case "ca-key": return rotateDeviceCert(...)` does not compile. Exhaustiveness alone would NOT
 * have caught that mis-wiring: a `default`-less switch whose cases point at the wrong handlers
 * type-checks perfectly and rotates the wrong thing under an approval that named the right one.
 *
 * The handlers read their paths from `plan` — the object the biometric prompt was rendered from —
 * so the act performed is the act that was named, by construction rather than by agreement between
 * two independent computations.
 */
async function rotatePort(
  fx: RotateEffects,
  plan: PortPlan,
  opts: RotateOptions,
  sessionDoor: BiometricAuth,
): Promise<PortRotation> {
  switch (plan.port) {
    case "machine-key":
      return await rotateMachineKey(fx, plan, opts);
    case "ca-key":
      return await rotateCaKey(fx, plan, opts);
    case "device-cert":
      return await rotateDeviceCert(fx, plan, opts, sessionDoor);
  }
}

/**
 * MACHINE-KEY rotate: mint a NEW machine key as STANDBY (if not already staged — idempotent), then
 * PROMOTE it to Active (the new id_ed25519), park the OLD one as retired (overlap → wipe after the
 * window), and STAGE the updated registered pubkey for a PR. Pure-key: the label is machine-only.
 */
async function rotateMachineKey(
  fx: RotateEffects,
  plan: MachineKeyPlan,
  opts: RotateOptions,
): Promise<RotationOf<"machine-key">> {
  const home = plan.ctx.home;
  const hostname = plan.ctx.hostname;
  const active = deviceKeyPath(home);
  // The APPROVED plan's paths, not a second computation of them. The prompt the operator answered
  // was rendered from this object; re-deriving here would reopen the two-derivations gap.
  const standby = plan.newArtifactPath;
  // FIRST FREE retired slot — never onto an occupied one. Rotation #2 used to rename over rotation
  // #1's retired private key (docs/BUGS.md; rotate-refusals.test.ts RR-6).
  const retired = allocateRetiredSlot(fx, plan.retiredArtifactPath);
  const staged: string[] = [];

  // OVERLAP: mint the new STANDBY key beside the active one (idempotent: do NOT re-mint if present).
  const resuming = fx.exists(standby);
  if (!resuming) {
    fx.mkdirp(dirOf(standby));
    fx.genEd25519(standby, `${hostname} (zeta-machine)`); // machine-only label (pure-key, no user@)
  }
  // Read the NEW public key (public only — never the private bytes).
  const newPub = fx.readText(standby + ".pub").trim();

  // PROMOTE: the new key becomes the canonical Active; the old is parked retired (still on disk
  // through the overlap so an in-flight session using it is not cut off — ∅-blast-radius locally).
  fx.mkdirp(dirOf(retired));
  promoteFile(fx, active, retired); // old Active → retired (private + .pub)
  promoteFile(fx, standby, active); // new Standby → Active (private + .pub)

  // STAGE the updated registered pubkey for a PR (register half; mirrors teardown's unregister).
  const devPubReg = machinePubPath(opts.repoRoot, hostname);
  fx.mkdirp(dirOf(devPubReg));
  fx.writeText(devPubReg, newPub.endsWith("\n") ? newPub : newPub + "\n");
  if (fx.stageRepoWrite(opts.repoRoot, relUnder(opts.repoRoot, devPubReg))) {
    staged.push(relUnder(opts.repoRoot, devPubReg));
  }

  return {
    port: "machine-key",
    action: resuming ? "in-overlap" : "rotated",
    newArtifactPath: active,
    retiredArtifactPath: retired,
    stagedPaths: staged,
    detail: resuming
      ? "resumed an in-progress machine-key overlap (standby already staged — not re-minted)"
      : "minted new machine key, promoted to Active, parked old as retired, staged updated pubkey",
  };
}

/**
 * DEVICE-CERT rotate: RE-SIGN the cert for the (possibly just-rotated) machine key, preserving the
 * N+M invariant (Key ID = machine-only, principal = user). The old cert's `-V` window overlaps the
 * new one's, so a node accepting the old cert keeps accepting it until expiry while the new cert is
 * already valid. Delegates to ca.ts `signMachineCert` so the N+M shape is enforced there (not here).
 */
async function rotateDeviceCert(
  fx: RotateEffects,
  plan: DeviceCertPlan,
  opts: RotateOptions,
  sessionDoor: BiometricAuth,
): Promise<RotationOf<"device-cert">> {
  const hostname = plan.ctx.hostname;
  const devPub = machinePubPath(plan.ctx.repoRoot, hostname);
  const res: CertResult = await signMachineCert(fx.ca, {
    user: opts.user, // N+M: principal = USER (the user × machine pair lives in the principal)
    machineId: hostname, // N+M: Key ID = MACHINE only (never user@machine)
    devicePubPath: devPub,
    home: opts.home,
    ...(opts.certValidity !== undefined ? { validity: opts.certValidity } : {}),
    dryRun: false,
    biometricAuth: sessionDoor, // rides the SAME session approval (one fingerprint)
  });

  const staged: string[] = [];
  const out = plan.newArtifactPath; // the cert path the plan named and the prompt was rendered from
  if (res.action === "signed") {
    if (fx.stageRepoWrite(opts.repoRoot, relUnder(opts.repoRoot, out))) {
      staged.push(relUnder(opts.repoRoot, out));
    }
  }
  return {
    port: "device-cert",
    action: res.action === "signed" ? "rotated" : "absent",
    newArtifactPath: out,
    retiredArtifactPath: out,
    stagedPaths: staged,
    detail:
      res.action === "signed"
        ? `re-signed device cert (Key ID=${res.certId} [machine-only], principal=${res.principal} [user]) — N+M preserved, old -V window overlaps`
        : `cert not re-signed (${res.action})`,
  };
}

/**
 * CA-KEY rotate (the delicate one): mint a NEW CA key as STANDBY (idempotent), ADD its pubkey to the
 * `TrustedUserCAKeys` trust SET while EVERY CA pubkey already there STAYS (the overlap — existing
 * certs still verify), PROMOTE the new CA to Active (it signs going forward), and park the old CA
 * private in the FIRST FREE retired slot. The unit of rotation is the trust SET, not a single
 * pubkey, and the operation on that set is UNION — never replacement.
 *
 * THE FIX (2026-08-23). This used to write the set as literally `[oldCaPub, newCaPub]`, so the
 * second rotation evicted CA1 while certs it signed were still valid. It now unions with every self
 * line already present and preserves peer + unrecognised lines verbatim, and it MEASURES the result:
 * `trust.supersetOfBefore` is the ∅-blast-radius property as a fact, not a sentence.
 *
 * The set therefore only GROWS here. It shrinks only under `--finalize`, on census evidence, with
 * an approval that names each CA it drops.
 */
async function rotateCaKey(fx: RotateEffects, plan: CaKeyPlan, opts: RotateOptions): Promise<RotationOf<"ca-key">> {
  const home = plan.ctx.home;
  const active = caPrivateKeyPath(home);
  const standby = plan.newArtifactPath; // the approved plan's path, not a re-derivation
  const staged: string[] = [];

  // Read the OLD CA pubkey BEFORE promotion (it must remain in the trust set through the overlap).
  const oldCaPub = fx.readText(active + ".pub").trim();

  // OVERLAP: mint the new STANDBY CA key (idempotent: do NOT re-mint if present).
  const resuming = fx.exists(standby);
  if (!resuming) {
    fx.mkdirp(dirOf(standby));
    fx.genEd25519(standby, `${opts.ca} (zeta-ssh-ca)`);
  }
  const newCaPub = fx.readText(standby + ".pub").trim();

  // TRUST SET = UNION(every self CA line already trusted, the outgoing Active, the incoming new)
  //           + PRESERVED peer CAs + PRESERVED unrecognised lines.
  // sshd accepts a cert signed by ANY listed CA, so a set that only grows cannot break a cert that
  // verified a moment ago. The union is what makes that true across the SECOND rotation and every
  // one after it; `renderTrustSet` de-duplicates while preserving order.
  const before = readTrustSet(fx, opts.repoRoot, opts.ca);
  const selfKeys = [...before.self, oldCaPub, newCaPub];
  const trustFile = renderTrustSet(
    opts.repoRoot,
    opts.ca,
    selfKeys,
    before.peers,
    before.unclassified,
  ).trustedUserCaKeysFile;
  const trustPath = before.path;
  fx.mkdirp(dirOf(trustPath));
  fx.writeText(trustPath, trustFile);
  if (fx.stageRepoWrite(opts.repoRoot, relUnder(opts.repoRoot, trustPath))) {
    staged.push(relUnder(opts.repoRoot, trustPath));
  }

  // MEASURE what just happened to the set sshd consults. This is the only source the readout is
  // allowed to make an ∅-blast-radius claim from.
  const after = readTrustSet(fx, opts.repoRoot, opts.ca);
  const census = buildCensus(fx, opts.repoRoot);
  const dropped = before.fingerprints.filter((fp) => !after.fingerprints.includes(fp));
  const added = after.fingerprints.filter((fp) => !before.fingerprints.includes(fp));
  const censusSummary = summarizeCensus(census);
  const trust: TrustSetDelta = {
    before: before.fingerprints,
    after: after.fingerprints,
    dropped,
    added,
    supersetOfBefore: dropped.length === 0,
    closedWindows: closedWindowFingerprints(after.self, safeFingerprint(newCaPub), census),
    ...(censusSummary !== undefined ? { census: censusSummary } : {}),
  };

  // Also update the canonical maintainers/<ca>/ssh-ca.pub to the NEW CA pubkey (new signer of
  // record). Every prior pubkey is still trusted via the trust-set file above (the overlap).
  const caPubReg = caPublicKeyPath(opts.repoRoot, opts.ca);
  fx.mkdirp(dirOf(caPubReg));
  fx.writeText(caPubReg, newCaPub.endsWith("\n") ? newCaPub : newCaPub + "\n");
  if (fx.stageRepoWrite(opts.repoRoot, relUnder(opts.repoRoot, caPubReg))) {
    staged.push(relUnder(opts.repoRoot, caPubReg));
  }

  // PROMOTE: new CA private → Active (signs going forward); old CA private → the FIRST FREE retired
  // slot (never onto an occupied one — a previously retired key is memory, and destroying it is a
  // ceremony, not a rename).
  const retired = allocateRetiredSlot(fx, plan.retiredArtifactPath);
  fx.mkdirp(dirOf(retired));
  promoteFile(fx, active, retired);
  promoteFile(fx, standby, active);

  return {
    port: "ca-key",
    action: resuming ? "in-overlap" : "rotated",
    newArtifactPath: active,
    retiredArtifactPath: retired,
    stagedPaths: staged,
    trust,
    detail: `${resuming ? "resumed an in-progress CA overlap (standby CA already staged — not re-minted)" : "minted new CA and promoted it to signer of record"}; trusted CA set ${trust.before.length} -> ${trust.after.length}, ${trust.dropped.length} dropped`,
  };
}

/**
 * CA trust-set FINALIZE — the closing bound. Rotates NOTHING; drops exactly the self CA lines the
 * census proved are no longer needed, preserving peers, unrecognised lines and the active signer.
 * The plan was computed and NAMED in the approval prompt before this ran.
 */
function finalizeCaTrustSet(
  fx: RotateEffects,
  opts: RotateOptions,
  plan: FinalizePlan,
  planned: PortPlan,
): PortRotation {
  const before = readTrustSet(fx, opts.repoRoot, opts.ca);
  const dropped = new Set(plan.dropLines);
  const keptSelf = before.self.filter((line) => !dropped.has(line));
  const trustFile = renderTrustSet(
    opts.repoRoot,
    opts.ca,
    keptSelf,
    before.peers,
    before.unclassified,
  ).trustedUserCaKeysFile;
  fx.writeText(before.path, trustFile);
  const staged: string[] = [];
  if (fx.stageRepoWrite(opts.repoRoot, relUnder(opts.repoRoot, before.path))) {
    staged.push(relUnder(opts.repoRoot, before.path));
  }
  const after = readTrustSet(fx, opts.repoRoot, opts.ca);
  const censusSummary = plan.census;
  const trust: TrustSetDelta = {
    before: before.fingerprints,
    after: after.fingerprints,
    dropped: before.fingerprints.filter((fp) => !after.fingerprints.includes(fp)),
    added: [],
    supersetOfBefore: false, // a finalize NARROWS on purpose; saying otherwise would be the old lie
    closedWindows: [],
    ...(censusSummary !== undefined ? { census: censusSummary } : {}),
  };
  return {
    port: "ca-key",
    action: "finalized",
    newArtifactPath: before.path,
    retiredArtifactPath: planned.retiredArtifactPath,
    stagedPaths: staged,
    trust,
    detail: `finalized: dropped ${trust.dropped.length} retired CA(s) [${trust.dropped.join(", ")}] on census evidence; ${after.fingerprints.length} CA(s) remain trusted`,
  };
}

/** The PortRotation for a finalize run that did NOT drop anything (dry-run, refusal, or no-op). */
function finalizeReport(planned: PortPlan, plan: FinalizePlan, action: PortRotation["action"]): PortRotation {
  const refusals = plan.candidates.filter((c) => !c.eligible);
  const detail =
    action === "would-finalize"
      ? `would ${describeFinalizePlan(plan)}`
      : plan.candidates.length === 0
        ? "no self CA lines in the trust set — nothing to finalize"
        : `kept every CA: ${refusals.map((r) => `${r.fingerprint} (${r.reason})`).join("; ")}`;
  return {
    port: planned.port,
    action,
    newArtifactPath: plan.trustSetPath,
    retiredArtifactPath: planned.retiredArtifactPath,
    stagedPaths: [],
    detail,
  };
}

// ── small helpers ────────────────────────────────────────────────────────────────────────────────

/** MOVE a keypair (private + .pub) from `from` to `to` via the PUBLIC doors. The private file is
 *  relocated by the runner's filesystem door — its bytes are NEVER read into this process; we only
 *  copy the PUBLIC half's text through readText/writeText and signal the private move via stageMove.
 *  In tests the fake fs door performs the real rename; in production realEffects shells the move. */
function promoteFile(fx: RotateEffects, from: string, to: string): void {
  // The private key + its .pub are moved together. We never read the private bytes; the move is a
  // filesystem operation exposed through the effects (movePrivate). The .pub text we DO carry
  // (it is public) so a reader can confirm the promotion without a second fs round-trip.
  fx.movePrivate(from, to);
}

function dirOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(0, i) : ".";
}

function relUnder(repoRoot: string, path: string): string {
  const prefix = repoRoot.endsWith("/") ? repoRoot : repoRoot + "/";
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function emptyRotation(plan: PortPlan, action: PortRotation["action"]): PortRotation {
  return {
    port: plan.port,
    action,
    newArtifactPath: plan.newArtifactPath,
    retiredArtifactPath: plan.retiredArtifactPath,
    stagedPaths: [],
    detail:
      action === "absent"
        ? `${plan.port}: not set up — nothing to rotate`
        : action === "would-rotate"
          ? `${plan.port}: would rotate on the overlap-window lifecycle (mint standby → promote → retire old)`
          : action === "skipped-not-confirmed"
            ? `${plan.port}: present — skipped (no --confirm)`
            : action === "skipped-biometric"
              ? `${plan.port}: present — skipped (biometric declined)`
              : action === "skipped-finalize"
                ? `${plan.port}: --finalize applies to the CA trust SET only — this port was not touched`
                : `${plan.port}: ${action}`,
  };
}

function finalize(partial: Omit<RotateResult, "stagedPaths">): RotateResult {
  const stagedPaths = partial.rotations.flatMap((r) => r.stagedPaths);
  return { ...partial, stagedPaths };
}

/**
 * Render the operator-facing readout — PUBLIC only (fingerprints, counts, paths), NEVER key bytes.
 *
 * THE ∅-BLAST-RADIUS LINE IS COMPUTED, NOT PRINTED. It used to be emitted unconditionally and
 * byte-identically on every approved run, including the second CA rotation, which was the run that
 * falsified it (docs/BUGS.md; pinned by rotate-refusals.test.ts RR-5). An assertion that cannot be
 * false is not an assertion, and one on an operator surface is worse than silence: it is the
 * vacuity class in the place a human decides whether to trust the system.
 *
 * So the line now has three mutually exclusive forms, chosen from the MEASURED `TrustSetDelta`:
 * VERIFIED (with the counts it was verified from), NOT ESTABLISHED (naming every CA that left), or
 * — when no CA port ran — no line at all, because a run that did not touch the trust set has
 * nothing to say about it.
 */
export function formatRotate(res: RotateResult): string {
  const lines: string[] = [];
  const finalizing = res.rotations.some((r) => r.action.startsWith("finalize") || r.action === "would-finalize");
  const mode = res.dryRun
    ? "DRY RUN (default-safe — NOTHING generated, signed, staged, or prompted)"
    : res.confirmed
      ? finalizing
        ? "CONFIRMED trust-set finalize"
        : "CONFIRMED rotate"
      : "NOT CONFIRMED (no --confirm — NOTHING touched)";
  lines.push(`Zeta rotate — host=${res.hostname}, user=${res.user}, ca=${res.ca} — ${mode}`);

  if (!res.hadWork) {
    lines.push(
      finalizing
        ? "  Nothing to finalize (no self CA lines in the trust set, or the ca-key port was not requested)."
        : "  Nothing set up to rotate (the requested ports were never provisioned).",
    );
    lines.push("  (Idempotent no-op — nothing minted, nothing signed, no approval needed.)");
    return lines.join("\n");
  }

  lines.push(
    finalizing
      ? "  PORTS (finalize: drop retired CA lines whose windows the certificate census proves are closed):"
      : "  PORTS (overlap-window lifecycle: mint standby → overlap → promote → retire old):",
  );
  for (const r of res.rotations) {
    lines.push(`    [${r.port}] ${r.action} — ${r.detail}`);
  }

  if (res.dryRun) {
    lines.push(
      finalizing
        ? "  Re-run with --confirm (and approve the biometric) to drop the CA(s) listed above."
        : "  Re-run with --confirm (and approve the biometric) to execute the rotation.",
    );
    return lines.join("\n");
  }
  if (res.confirmed && res.biometric !== undefined && !res.biometric.ok) {
    lines.push("  Biometric DECLINED — fail-closed: nothing rotated, nothing staged.");
    return lines.join("\n");
  }
  if (!res.confirmed) return lines.join("\n");

  if (res.biometric?.ok === true) {
    lines.push(
      `  Operator approval: 1 approval covered the whole ${finalizing ? "finalize" : "rotation"} ` +
        `(mechanism ${res.biometric.platform}, factor established: ${establishedFactor(res.biometric)}).`,
    );
  }
  if (res.stagedPaths.length > 0) {
    lines.push(
      `  Staged for PR: ${res.stagedPaths.length} path(s). Commit + open a PR to land the changed public artifacts.`,
    );
  } else {
    lines.push("  Nothing staged — no public artifact changed on this run.");
  }
  lines.push(...trustSetLines(res));
  return lines.join("\n");
}

/** The MEASURED trust-set report. Returns NOTHING when no port measured the trust set — a run that
 *  did not touch it makes no claim about it. */
function trustSetLines(res: RotateResult): readonly string[] {
  const measured = res.rotations.filter((r) => r.trust !== undefined);
  if (measured.length === 0) return [];
  const out: string[] = [];
  for (const r of measured) {
    const t = r.trust!;
    if (r.action === "finalized") {
      out.push(
        `  Trust set NARROWED on purpose: ${t.before.length} -> ${t.after.length} CA(s); dropped ` +
          `[${t.dropped.join(", ")}]. Certificates signed by those CAs no longer verify.`,
      );
      // State the evidence the narrowing stood on, NOT the forward-looking advisory — a finalize
      // that just dropped CAs has no closed windows left to report, and printing the advisory's
      // "nothing to finalize yet" wording here would describe the run that just did.
      out.push(
        t.census === undefined
          ? "  Evidence: NONE — this should be unreachable; a finalize without a census cannot drop."
          : `  Evidence: census of ${t.census.certificatesFound} certificate(s), complete — none of them ` +
              "unexpired and naming a dropped CA.",
      );
      continue;
    }
    if (t.supersetOfBefore) {
      out.push(
        `  ∅-blast-radius VERIFIED (measured, not asserted): trusted CA set ${t.before.length} -> ` +
          `${t.after.length}; every CA trusted before this run is still trusted (0 dropped), so every ` +
          `certificate that verified before it still verifies.`,
      );
    } else {
      out.push(
        `  ∅-blast-radius NOT ESTABLISHED: ${t.dropped.length} CA(s) LEFT the trusted set ` +
          `[${t.dropped.join(", ")}]. Any certificate signed by them is now REJECTED. Investigate ` +
          `before relying on this run.`,
      );
    }
    out.push(...censusLines(t));
  }
  return out;
}

/** What the closing bound currently knows — including, loudly, when it knows nothing. */
function censusLines(t: TrustSetDelta): readonly string[] {
  if (t.census === undefined) {
    return [
      "  Closing bound: NO certificate census (no listCerts/nowEpochSeconds door wired). The trusted " +
        "CA set can only grow on this path — run `--finalize` from a host that can read the committed " +
        "certificates to close retired windows.",
    ];
  }
  const out: string[] = [];
  if (!t.census.complete) {
    out.push(
      `  Closing bound: census INCOMPLETE — ${t.census.unparseable.length} of ${t.census.certificatesFound} ` +
        `certificate(s) could not be parsed (${t.census.unparseable.join(", ")}). No CA can be retired ` +
        "until every certificate is readable.",
    );
    return out;
  }
  if (t.closedWindows.length === 0) {
    out.push(
      `  Closing bound: census of ${t.census.certificatesFound} certificate(s) — every trusted CA is ` +
        "still named by an unexpired certificate. Nothing to finalize yet.",
    );
    return out;
  }
  out.push(
    `  Closing bound: ${t.closedWindows.length} retired CA(s) have CLOSED windows ` +
      `[${t.closedWindows.join(", ")}] — no unexpired certificate names them. Run ` +
      "`rotate-cli.ts --ports ca-key --finalize --confirm` to retire them (one approval, names each drop).",
  );
  return out;
}

/** The REAL host effects (used by the CLI). Reuses machine.ts / ca.ts realEffects for the genuine
 *  ssh-keygen + sign paths; `movePrivate` renames the keypair (private + .pub) on disk under umask
 *  077; `stageRepoWrite` shells `git add` under the caller's repoRoot — NEVER a push, NEVER main
 *  (shared-checkout-is-view-only; Otto verify-gates). NO door returns or prints private bytes. */
export function realEffects(): RotateEffects {
  return {
    ...realBriefEffects(),
    exists: (p) => existsSync(p),
    readText: (p) => readFileSync(p, "utf8"),
    writeText: (p, c) => writeFileSync(p, c, { mode: 0o644 }),
    mkdirp: (p) => mkdirSync(p, { recursive: true, mode: 0o700 }),
    genEd25519: (keyPath, comment) => machineRealEffects().genEd25519(keyPath, comment),
    movePrivate: (from, to) => {
      // Move the private key + its .pub together (the runner's filesystem op). Private bytes are
      // never read here. Idempotent: an absent source is a no-op. umask 077 on the dir already set.
      for (const suffix of ["", ".pub"]) {
        const src = from + suffix;
        const dst = to + suffix;
        if (existsSync(src)) {
          mkdirSync(dirOf(dst), { recursive: true, mode: 0o700 });
          renameSync(src, dst);
        }
      }
    },
    ca: caRealEffects(),
    // The CENSUS doors — PUBLIC artifacts only. `machines/<host>-cert.pub` is a committed public
    // certificate; nothing here opens a private path. A missing directory yields an EMPTY list,
    // which the finalize rules treat as "found nothing", never as "there is nothing".
    listCerts: (repoRoot) => {
      const dir = join(repoRoot, "machines");
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((f) => f.endsWith("-cert.pub"))
        .sort()
        .map((f) => join(dir, f));
    },
    nowEpochSeconds: () => Math.floor(Date.now() / 1000),
    stageRepoWrite: (repoRoot, relPath) => {
      // Stage an ADD for a PR — `git add` under the caller's repoRoot. NEVER pushes, NEVER main.
      const r = spawnSync("git", ["-C", repoRoot, "add", "--", relPath], { stdio: "ignore" });
      return r.status === 0;
    },
  };
}
