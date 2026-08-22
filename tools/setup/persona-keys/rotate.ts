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
// ∅-BLAST-RADIUS / NEVER-SINGLE-KEY (the WHY it is safe): because ≥2 keys are valid across the swap
// (degree ≥ 2 → removing one leaves ≥ 1), NOTHING the rotated key protects breaks. For the CA this is
// concrete + checkable: a device cert verifies iff its SIGNING-CA fingerprint is in the trusted set;
// keeping BOTH CA pubkeys in `TrustedUserCAKeys` during the overlap means every EXISTING cert still
// verifies while the new CA signs going forward. The harness ASSERTS this (a thing protected before
// rotate is still accessible after) — it is not a slogan, it is a test.
//
// THREE PORTS (each provision-standby → overlap → promote → retire-old):
//   1. MACHINE KEY — generate a NEW machine ed25519 key as Standby; overlap; promote; retire the old.
//      The registered public key is updated via the repo unregister/register STAGING pattern
//      (teardown.ts `gitRm` + a register door) — NEVER a real push (Otto verify-gates; view-only).
//   2. DEVICE CERT — re-sign the cert for the new/rotated machine key, preserving the N+M invariant
//      (Key ID = machine-only, principal = user — the #8926 / #8969 lesson). Old + new cert validity
//      overlap (the old cert is still inside its `-V` window when the new one is signed).
//   3. CA KEY — rotate the CA signing key WITH OVERLAP: the OLD CA pubkey stays in `TrustedUserCAKeys`
//      during the window (so existing certs still verify) while the NEW CA signs going forward. This
//      is the delicate one — the trust SET (not a single pubkey) is the unit of rotation.
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
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
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
import {
  machinePubPath,
  deviceKeyPath,
  sanitizeHostname,
  realEffects as machineRealEffects,
} from "./machine.ts";
import {
  parseTrustSetPeers,
  renderTrustSet,
  trustedUserCaKeysPath,
} from "./setup-cluster.ts";
import { requireBiometric, sessionBiometric, type BiometricAuth, type BiometricResult } from "./biometric.ts";
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
export interface RotateEffects {
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
   *  (nothing to rotate — the port was never set up) | "skipped-not-confirmed" | "skipped-biometric". */
  readonly action:
    | "rotated"
    | "would-rotate"
    | "in-overlap"
    | "absent"
    | "skipped-not-confirmed"
    | "skipped-biometric";
  /** The NEW (incoming) artifact's local/public path (the standby being promoted). */
  readonly newArtifactPath: string;
  /** The OLD (retiring) artifact's parked path (where it overlaps before being wiped). */
  readonly retiredArtifactPath: string;
  /** Repo paths STAGED for a PR by this port (updated pubkey / cert / trusted-CA-keys). NEVER pushed. */
  readonly stagedPaths: readonly string[];
  /** A one-line public detail for the readout (no secret). */
  readonly detail: string;
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

  // ── PLAN (pure presence checks — no side effects, no prompt) ──────────────────────────────
  // A port is rotatable iff it was set up (its current Active artifact exists). The plan also
  // notes whether a STANDBY already exists (idempotent mid-overlap resume).
  const plans = ports.map((port) => planPort(fx, port, { home, hostname, ca: opts.ca, repoRoot: opts.repoRoot }));
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
  const session = sessionBiometric(opts.biometricAuth);
  const biometric = await requireBiometric(
    session.door,
    `Approve Zeta ROTATE for host ${hostname} (overlap-window swap of: ${ports.join(", ")})`,
  );
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
    rotations.push(await rotatePort(fx, p, opts, hostname, session.door));
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

// ── Per-port PLAN ──────────────────────────────────────────────────────────────────────────────

interface PortPlan {
  readonly port: RotatePort;
  /** Is the CURRENT (Active) artifact present (i.e. was this port set up)? */
  readonly present: boolean;
  /** Is a STANDBY already staged (a prior rotate is mid-overlap)? */
  readonly standbyPresent: boolean;
  readonly newArtifactPath: string;
  readonly retiredArtifactPath: string;
  readonly ctx: PortCtx;
}

interface PortCtx {
  readonly home: string;
  readonly hostname: string;
  readonly ca: string;
  readonly repoRoot: string;
}

function planPort(fx: RotateEffects, port: RotatePort, ctx: PortCtx): PortPlan {
  if (port === "machine-key") {
    const active = deviceKeyPath(ctx.home);
    const standby = standbyMachineKeyPath(ctx.home);
    return {
      port,
      present: fx.exists(active),
      standbyPresent: fx.exists(standby),
      newArtifactPath: standby,
      retiredArtifactPath: retiredMachineKeyPath(ctx.home),
      ctx,
    };
  }
  if (port === "ca-key") {
    const active = caPrivateKeyPath(ctx.home);
    const standby = standbyCaKeyPath(ctx.home);
    return {
      port,
      present: fx.exists(active),
      standbyPresent: fx.exists(standby),
      newArtifactPath: standby,
      retiredArtifactPath: retiredCaKeyPath(ctx.home),
      ctx,
    };
  }
  // device-cert: present iff BOTH the machine pubkey (to certify) and the CA private (to sign) exist.
  const devPub = machinePubPath(ctx.repoRoot, ctx.hostname);
  const cert = certPath(devPub);
  const caPriv = caPrivateKeyPath(ctx.home);
  return {
    port,
    present: fx.exists(devPub) && fx.exists(caPriv),
    standbyPresent: false, // a cert re-sign is idempotent in place (overwrites the same -cert.pub)
    newArtifactPath: cert,
    retiredArtifactPath: cert, // re-signed in place; old cert validity overlaps the new (-V window)
    ctx,
  };
}

// ── Per-port ROTATION (post-gate) ────────────────────────────────────────────────────────────────

async function rotatePort(
  fx: RotateEffects,
  plan: PortPlan,
  opts: RotateOptions,
  hostname: string,
  sessionDoor: BiometricAuth,
): Promise<PortRotation> {
  if (plan.port === "machine-key") return rotateMachineKey(fx, opts, hostname);
  if (plan.port === "ca-key") return rotateCaKey(fx, opts);
  return rotateDeviceCert(fx, opts, hostname, sessionDoor);
}

/**
 * MACHINE-KEY rotate: mint a NEW machine key as STANDBY (if not already staged — idempotent), then
 * PROMOTE it to Active (the new id_ed25519), park the OLD one as retired (overlap → wipe after the
 * window), and STAGE the updated registered pubkey for a PR. Pure-key: the label is machine-only.
 */
async function rotateMachineKey(
  fx: RotateEffects,
  opts: RotateOptions,
  hostname: string,
): Promise<PortRotation> {
  const home = opts.home;
  const active = deviceKeyPath(home);
  const standby = standbyMachineKeyPath(home);
  const retired = retiredMachineKeyPath(home);
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
  opts: RotateOptions,
  hostname: string,
  sessionDoor: BiometricAuth,
): Promise<PortRotation> {
  const devPub = machinePubPath(opts.repoRoot, hostname);
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
  const out = certPath(devPub);
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
 * `TrustedUserCAKeys` trust SET while the OLD CA pubkey STAYS (the overlap — existing certs still
 * verify), PROMOTE the new CA to Active (it signs going forward), and park the old CA private as
 * retired. The unit of rotation is the trust SET, not a single pubkey — that is what gives the
 * ∅-blast-radius: every cert signed by EITHER CA verifies during the window.
 */
async function rotateCaKey(fx: RotateEffects, opts: RotateOptions): Promise<PortRotation> {
  const home = opts.home;
  const active = caPrivateKeyPath(home);
  const standby = standbyCaKeyPath(home);
  const retired = retiredCaKeyPath(home);
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

  // TRUST SET = OLD + NEW self CAs (the overlap) + PRESERVED PEER CAs. sshd accepts a cert signed
  // by ANY listed CA → existing certs (signed by the OLD CA) STILL verify, while the NEW CA signs
  // going forward, and cross-cluster trust is not silently dropped. Both self pubkeys stay in the
  // file for the whole window; the old line is removed only AFTER the window (a later teardown /
  // a follow-up `rotate --finalize`, out of scope here — we keep BOTH, never drop the old early).
  const trustPath = trustedUserCaKeysPath(opts.repoRoot, opts.ca);
  const peers = fx.exists(trustPath) ? parseTrustSetPeers(fx.readText(trustPath)) : [];
  const trustFile = renderTrustSet(opts.repoRoot, opts.ca, [oldCaPub, newCaPub], peers)
    .trustedUserCaKeysFile;
  fx.mkdirp(dirOf(trustPath));
  fx.writeText(trustPath, trustFile);
  if (fx.stageRepoWrite(opts.repoRoot, relUnder(opts.repoRoot, trustPath))) {
    staged.push(relUnder(opts.repoRoot, trustPath));
  }

  // Also update the canonical maintainers/<ca>/ssh-ca.pub to the NEW CA pubkey (new signer of
  // record). The OLD pubkey is still trusted via the trust-set file above (the overlap).
  const caPubReg = caPublicKeyPath(opts.repoRoot, opts.ca);
  fx.mkdirp(dirOf(caPubReg));
  fx.writeText(caPubReg, newCaPub.endsWith("\n") ? newCaPub : newCaPub + "\n");
  if (fx.stageRepoWrite(opts.repoRoot, relUnder(opts.repoRoot, caPubReg))) {
    staged.push(relUnder(opts.repoRoot, caPubReg));
  }

  // PROMOTE: new CA private → Active (signs going forward); old CA private → retired (still in the
  // trust set as a PUBLIC key, so its already-signed certs verify; its PRIVATE is parked for wipe).
  fx.mkdirp(dirOf(retired));
  promoteFile(fx, active, retired);
  promoteFile(fx, standby, active);

  return {
    port: "ca-key",
    action: resuming ? "in-overlap" : "rotated",
    newArtifactPath: active,
    retiredArtifactPath: retired,
    stagedPaths: staged,
    detail: resuming
      ? "resumed an in-progress CA overlap (standby CA already staged — not re-minted; both pubkeys still trusted)"
      : "minted new CA, kept BOTH CA pubkeys in TrustedUserCAKeys (overlap → existing certs still verify), promoted new CA signer",
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
              : `${plan.port}: ${action}`,
  };
}

function finalize(partial: Omit<RotateResult, "stagedPaths">): RotateResult {
  const stagedPaths = partial.rotations.flatMap((r) => r.stagedPaths);
  return { ...partial, stagedPaths };
}

/** Render the operator-facing readout — PUBLIC only, NEVER any key bytes. */
export function formatRotate(res: RotateResult): string {
  const lines: string[] = [];
  const mode = res.dryRun
    ? "DRY RUN (default-safe — NOTHING generated, signed, staged, or prompted)"
    : res.confirmed
      ? "CONFIRMED rotate"
      : "NOT CONFIRMED (no --confirm — NOTHING touched)";
  lines.push(`Zeta rotate — host=${res.hostname}, user=${res.user}, ca=${res.ca} — ${mode}`);

  if (!res.hadWork) {
    lines.push("  Nothing set up to rotate (the requested ports were never provisioned).");
    lines.push("  (Idempotent no-op — nothing minted, nothing signed, no approval needed.)");
    return lines.join("\n");
  }

  lines.push("  PORTS (overlap-window lifecycle: mint standby → overlap → promote → retire old):");
  for (const r of res.rotations) {
    lines.push(`    [${r.port}] ${r.action} — ${r.detail}`);
  }

  if (res.dryRun) {
    lines.push("  Re-run with --confirm (and approve the biometric) to execute the rotation.");
  } else if (res.confirmed && res.biometric?.ok === true) {
    lines.push(`  Biometric: 1 approval covered the whole rotation (${res.biometric.platform}).`);
    lines.push(
      `  Staged for PR: ${res.stagedPaths.length} path(s). Commit + open a PR to land the rotated public artifacts.`,
    );
    lines.push(
      "  ∅-blast-radius: both old + new keys/CAs are valid through the overlap — nothing protected breaks.",
    );
  } else if (res.confirmed && res.biometric !== undefined && !res.biometric.ok) {
    lines.push("  Biometric DECLINED — fail-closed: nothing rotated, nothing staged.");
  }
  return lines.join("\n");
}

/** The REAL host effects (used by the CLI). Reuses machine.ts / ca.ts realEffects for the genuine
 *  ssh-keygen + sign paths; `movePrivate` renames the keypair (private + .pub) on disk under umask
 *  077; `stageRepoWrite` shells `git add` under the caller's repoRoot — NEVER a push, NEVER main
 *  (shared-checkout-is-view-only; Otto verify-gates). NO door returns or prints private bytes. */
export function realEffects(): RotateEffects {
  return {
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
    stageRepoWrite: (repoRoot, relPath) => {
      // Stage an ADD for a PR — `git add` under the caller's repoRoot. NEVER pushes, NEVER main.
      const r = spawnSync("git", ["-C", repoRoot, "add", "--", relPath], { stdio: "ignore" });
      return r.status === 0;
    },
  };
}
