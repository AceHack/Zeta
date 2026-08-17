// Zeta CLUSTER-SCOPED TEARDOWN / UNREGISTER — the exact inverse of setup-cluster.ts (the cluster
// trust-root setup + cross-cluster trust), and the remaining teardown corner of the lifecycle triad.
// DESTRUCTIVE-capable, security-class (workitem 081KVP2M1QS008QG0R000JSXE1E). teardown.ts (#9000)
// covers the MACHINE scope (this host's private material + its machine pubkey/cert); this covers the
// CLUSTER scope (the trust ROOT a cluster is stood up around). Built TS-first; a CORE PRIMITIVE that
// will be generated to every oracle via gen/ (the same shape as setup-cluster / teardown).
//
// WHAT setup-cluster CREATES — and therefore what THIS removes/unregisters, exactly inverted:
//   1. CA PRIVATE key (local) — ~/.config/zeta/ca/ (ensureCa, umask 077). LOCAL WIPE.
//   2. CA PUBLIC key (repo)   — maintainers/<ca>/ssh-ca.pub (the git-distributed trust root). REPO
//                               UNREGISTER (git rm staged for a PR).
//   3. Multi-CA TRUST SET (repo) — maintainers/<ca>/trusted-user-ca-keys.pub (THIS cluster's CA pubkey
//                               + any PEER cluster CA pubkeys; the value sshd's TrustedUserCAKeys points
//                               at). REPO UNREGISTER. This is the cluster-specific artifact teardown.ts
//                               did NOT cover — the clean gap this module closes.
//   (setup-cluster only PRINTS the ssh-ca.nix snippet; it never writes a file, so there is nothing to
//   remove for it. The machine pubkey/cert are the MACHINE scope — teardown.ts owns those.)
//
// TWO HALVES (both behind the injected-effects pattern — noninterference §13; tests inject fakes),
// mirroring teardown.ts exactly:
//   1. LOCAL WIPE — securely remove the CA PRIVATE key dir under ~/.config/zeta/ca/ (shred-then-unlink
//      via the injected `securelyRemove` door). BIOMETRIC-GATED, FAIL-CLOSED. NEVER echoes key bytes.
//   2. REPO UNREGISTER — `git rm` (staged for a PR, NEVER pushed) the CA pubkey + the trusted-user-ca-keys
//      trust set, in the CALLER's own clone only (shared-checkout-is-view-only).
//
// CASCADE WITH WARNINGS (the smart-cascade design, docs/research/2026-06-21-smart-cascading-teardown-…):
//   Tearing down a cluster trust ROOT cascades to everything derived from it — but the cascade is NEVER
//   silent. We enumerate the blast radius FIRST and WARN on the extra-care classes, never blindly
//   destroy:
//     - CROSS-CLUSTER PEER TRUST — the trust set lists PEER cluster CA pubkeys; removing it means those
//       peers no longer trust certs from THIS cluster (a federation effect on OTHER clusters). WARN.
//     - DEPENDENT MACHINE CERTS — any machines/<host>-cert.pub signed by THIS CA become unverifiable
//       once the CA pubkey is unregistered (orphaned trust). WARN with the count (the blast radius).
//     - UNRECOVERABLE — a wiped CA private is recoverable ONLY by the durable 1Password backup +
//       re-running setup (re-onboarding is the inverse, not undo). WARN.
//   The warnings are REPORTED (the plan), never auto-acknowledged; the destructive doors fire only after
//   the confirm + biometric gate. We do NOT auto-delete peer clusters' trust or other users' state.
//
// SECURITY INVARIANTS (security-class — honesty over green), identical to teardown.ts:
//  1. `--dry-run` is the DEFAULT-safe path: report exactly what WOULD be wiped/unregistered + the
//     cascade WARNINGS, delete/rm NOTHING, NEVER prompt. A real teardown needs explicit `confirm` AND
//     the biometric. dry-run never calls the gate.
//  2. FAIL-CLOSED: a declined/absent biometric ⇒ NOTHING deleted, NOTHING rm'd. The gate fires EXACTLY
//     ONCE for the whole destructive run (one fingerprint).
//  3. IDEMPOTENT: a re-run after a teardown is a clean no-op ("already clean"), no prompt.
//  4. NO secret bytes EVER cross this boundary or get printed — the wipe door consumes paths, returns
//     only a boolean; we never read CA-private contents into this process.
//
// Anchors (Beacon): secure file erasure — `shred(1)` (GNU coreutils; Gutmann 1996) with the SSD/CoW
// caveat (the durable 1Password backup is the honest recovery path). OpenSSH `TrustedUserCAKeys`
// multi-CA trust file (`sshd_config(5)`) — the federation artifact being unregistered. `git rm` staging
// for a removal PR — git as the public-trust distribution channel (ca.ts), removed the same way it was
// added (never a force-push, never a direct main write). SQL `ON DELETE CASCADE` — but guarded by
// warnings, unlike silent SQL (the smart-cascade design). Reversible-by-regeneration: re-run
// setup-cluster (new CA + re-rendered trust set) is the inverse.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { caPublicKeyPath } from "./ca.ts";
import { trustedUserCaKeysPath } from "./setup-cluster.ts";
import { establishedFactor, requireBiometric, type BiometricAuth, type BiometricResult } from "./biometric.ts";
export type { BiometricAuth, BiometricResult } from "./biometric.ts";

/** The host-environment doors — the ONLY channel for ambient influence (noninterference §13). Every
 *  door is PUBLIC-safe by construction: NO door ever returns private key BYTES. The wipe door consumes
 *  PATHS and reports success only; `readPublic` is used ONLY for PUBLIC artifacts (the trust set, to
 *  enumerate the peer-CA blast radius) — never a private key. */
export interface ClusterTeardownEffects {
  /** True iff a path exists (presence checks — never reads the contents of a secret). */
  readonly exists: (path: string) => boolean;
  /** List leaf file paths under a local dir (PATHS only, never contents). Returns [] if absent. */
  readonly listFiles: (dir: string) => readonly string[];
  /** Read a PUBLIC artifact's text (the trust set — to enumerate peer CAs / blast radius). MUST only
   *  ever be pointed at a PUBLIC file; NEVER the CA private key. Returns "" if absent. */
  readonly readPublic: (path: string) => string;
  /** List the dependent machine certs under the repo (machines/<host>-cert.pub) — the blast radius of
   *  removing the CA pubkey (certs it signed become unverifiable). PATHS only. [] if absent. */
  readonly listMachineCerts: (repoRoot: string) => readonly string[];
  /** SECURELY remove ONE local file: shred-then-unlink where available, else overwrite+unlink. Returns
   *  true iff gone afterwards. NEVER reads/returns the file's bytes. Idempotent (absent ⇒ no-op true). */
  readonly securelyRemove: (path: string) => boolean;
  /** Remove a now-empty local directory (best-effort; absent ⇒ no-op). */
  readonly removeDir: (dir: string) => void;
  /** Stage a `git rm` of a PUBLIC artifact in the CALLER's repo clone (produces a removal FOR a PR —
   *  NEVER pushes, NEVER touches main). Returns true iff staged. Operates ONLY under repoRoot. */
  readonly gitRm: (repoRoot: string, relPath: string) => boolean;
}

/** The 1Password item that mirrors the local CA private — PRINTED (never deleted) by the optional
 *  `--note-1password` flag so the operator can decide to delete the durable backup too. We NEVER delete
 *  from 1Password automatically (the backup is the reversible-by-regeneration safety net). */
export const ONEPASSWORD_CLUSTER_ITEM = "zeta-ca-private" as const;

/** The base ~/.config/zeta directory for a given home. */
export function zetaConfigDir(home: string = homedir()): string {
  return join(home, ".config", "zeta");
}

/** The local CA private dir (~/.config/zeta/ca/) — the cluster trust root's PRIVATE half. */
export function caLocalDirPath(home: string = homedir()): string {
  return join(zetaConfigDir(home), "ca");
}

/** What happened (or, on dry-run, WOULD happen) to the local CA private material. No secret bytes. */
export interface LocalCaWipeEntry {
  readonly path: string;
  /** Whether the CA private dir was present (had any files) before the run. */
  readonly present: boolean;
  /** The leaf file paths under it — PATHS only, NEVER contents. */
  readonly files: readonly string[];
  readonly action: "wiped" | "would-wipe" | "absent" | "skipped-not-confirmed" | "skipped-biometric";
}

/** What happened (or WOULD happen) to one registered PUBLIC cluster artifact. */
export interface ClusterUnregisterEntry {
  readonly kind: "ca-pubkey" | "trust-set";
  readonly path: string;
  /** Repo-root-relative path passed to `git rm` (the removal staged for a PR). */
  readonly relPath: string;
  readonly present: boolean;
  readonly action:
    | "unregistered"
    | "would-unregister"
    | "absent"
    | "skipped-not-confirmed"
    | "skipped-biometric";
}

/** A cascade warning on an extra-care node — REPORTED before any destruction, never auto-acknowledged
 *  (the smart-cascade design). PUBLIC only; no secret bytes. */
export interface CascadeWarning {
  readonly kind: "cross-cluster-peer" | "dependent-machine-certs" | "unrecoverable-private";
  /** Human-readable warning naming the blast radius. */
  readonly message: string;
  /** The count of affected items where countable (peer CAs / dependent certs); else 0. */
  readonly blastRadius: number;
}

/** The full cluster-teardown result — auditable, public-only. Mirrors TeardownResult's shape. */
export interface ClusterTeardownResult {
  readonly dryRun: boolean;
  readonly confirmed: boolean;
  readonly home: string;
  readonly repoRoot: string;
  /** The CA identity whose maintainers/<ca>/ trust root is torn down. */
  readonly ca: string;
  readonly localCaWipe: LocalCaWipeEntry;
  readonly clusterUnregister: readonly ClusterUnregisterEntry[];
  /** The cascade warnings on extra-care nodes (peer trust / dependent certs / unrecoverable private). */
  readonly warnings: readonly CascadeWarning[];
  /** True iff there was anything destructive to do (CA private present OR any repo artifact present).
   *  When false, the run is a clean no-op ("already clean") and the gate is never fired. */
  readonly hadWork: boolean;
  /** The biometric outcome — present ONLY when the gate was actually invoked. NEVER a secret. */
  readonly biometric?: BiometricResult;
  /** The repo paths actually staged for `git rm` (the PR's removal set) — for the caller. */
  readonly unregisteredPaths: readonly string[];
}

/** Options for a cluster teardown. `dryRun` defaults TRUE at the CLI; here the explicit value governs.
 *  A real (destructive) run requires `dryRun:false` AND `confirm:true` AND a passing biometric. */
export interface ClusterTeardownOptions {
  /** The CA identity (the maintainers/<ca>/ trust root to tear down). */
  readonly ca: string;
  readonly repoRoot: string;
  readonly home?: string;
  /** When true, NOTHING is deleted/rm'd/prompted — report "would-*" + the warnings. DEFAULT-safe. */
  readonly dryRun?: boolean;
  /** Explicit destructive confirmation. WITHOUT it (on a non-dry-run) every step is
   *  "skipped-not-confirmed". WITH it (+ biometric) the wipe + rm happen. */
  readonly confirm?: boolean;
  /** SHARED biometric approval door — required for the real destructive path (fail-closed). */
  readonly biometricAuth?: BiometricAuth;
}

/** Repo-root-relative path for a readout / `git rm` argument (POSIX-ish, ordinal). */
function relUnder(repoRoot: string, path: string): string {
  const prefix = repoRoot.endsWith("/") ? repoRoot : repoRoot + "/";
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/** The repo-root-RELATIVE path of the CA public key (the `git rm` argument). */
export function caPublicRel(repoRoot: string, ca: string): string {
  return relUnder(repoRoot, caPublicKeyPath(repoRoot, ca));
}

/** The repo-root-RELATIVE path of the multi-CA trust set (the `git rm` argument). */
export function trustSetRel(repoRoot: string, ca: string): string {
  return relUnder(repoRoot, trustedUserCaKeysPath(repoRoot, ca));
}

/** Count the PEER cluster CA lines in a rendered trust set (the cross-cluster blast radius). The
 *  trust-set file is `# <source> cluster CA` comment lines + one pubkey per line; "self" is THIS
 *  cluster, every other named source is a PEER. PURE: text only, no IO, no secret. */
export function countPeerCas(trustSetText: string): number {
  let peers = 0;
  for (const line of trustSetText.split("\n")) {
    const m = /^#\s+(\S+)\s+cluster CA\s*$/.exec(line.trim());
    if (m && m[1] !== "self") peers += 1;
  }
  return peers;
}

/**
 * Run the cluster-scoped teardown / unregister — the exact inverse of setup-cluster. DEFAULT-safe: on
 * `dryRun` (or a non-dry-run WITHOUT `confirm`) it reports exactly what WOULD be wiped/unregistered +
 * the cascade WARNINGS and touches NOTHING and NEVER prompts. A real teardown requires `dryRun:false`
 * AND `confirm:true` AND ONE passing biometric approval (fired exactly once). Idempotent: nothing
 * present ⇒ a clean no-op ("already clean") with NO prompt.
 *
 * The plan + the cascade blast radius are computed FIRST (pure presence/PUBLIC reads) so the readout +
 * warnings are honest on every path; the destructive doors fire ONLY after the confirm + biometric gate.
 */
export async function teardownCluster(
  fx: ClusterTeardownEffects,
  opts: ClusterTeardownOptions,
): Promise<ClusterTeardownResult> {
  const home = opts.home ?? homedir();
  const dryRun = opts.dryRun !== false; // DEFAULT-safe: anything but an explicit false is a dry-run
  const confirmed = opts.confirm === true;

  // ── PLAN (pure presence checks — no side effects, no prompt) ──────────────────────────────────
  // LOCAL: the CA private dir.
  const caDir = caLocalDirPath(home);
  const caDirPresent = fx.exists(caDir);
  const caFiles = caDirPresent ? fx.listFiles(caDir) : [];

  // REPO: the two registered PUBLIC cluster artifacts (CA pubkey + the multi-CA trust set).
  const caPubPath = caPublicKeyPath(opts.repoRoot, opts.ca);
  const trustSetPath = trustedUserCaKeysPath(opts.repoRoot, opts.ca);
  const repoTargets: readonly { kind: ClusterUnregisterEntry["kind"]; path: string }[] = [
    { kind: "ca-pubkey", path: caPubPath },
    { kind: "trust-set", path: trustSetPath },
  ];
  const repoPlan = repoTargets.map((t) => ({
    ...t,
    relPath: relUnder(opts.repoRoot, t.path),
    present: fx.exists(t.path),
  }));

  const hadWork = caDirPresent || repoPlan.some((r) => r.present);

  // ── CASCADE BLAST RADIUS + WARNINGS (computed FIRST, on every path — never silent) ────────────
  const warnings: CascadeWarning[] = [];
  // Cross-cluster peer trust: how many PEER cluster CAs does the trust set list?
  const trustSetText = repoPlan.find((r) => r.kind === "trust-set")?.present ? fx.readPublic(trustSetPath) : "";
  const peerCount = countPeerCas(trustSetText);
  if (peerCount > 0) {
    warnings.push({
      kind: "cross-cluster-peer",
      blastRadius: peerCount,
      message:
        `CROSS-CLUSTER TRUST: the trust set lists ${peerCount} PEER cluster CA(s). Removing it means ` +
        `those peers no longer trust certs from THIS cluster (a federation effect on OTHER clusters). ` +
        `This teardown removes only THIS cluster's trust set — it does NOT touch the peers' own state.`,
    });
  }
  // Dependent machine certs: certs signed by THIS CA become unverifiable once the CA pubkey is gone.
  const dependentCerts = repoPlan.find((r) => r.kind === "ca-pubkey")?.present
    ? fx.listMachineCerts(opts.repoRoot)
    : [];
  if (dependentCerts.length > 0) {
    warnings.push({
      kind: "dependent-machine-certs",
      blastRadius: dependentCerts.length,
      message:
        `DEPENDENT CERTS: ${dependentCerts.length} machine cert(s) are signed by this CA and become ` +
        `UNVERIFIABLE once the CA pubkey is unregistered (orphaned trust). Re-onboard each machine ` +
        `(re-sign against the new CA) after re-running setup. Machine private keys are NOT touched here.`,
    });
  }
  // Unrecoverable private: a wiped CA private is recoverable only via the durable backup + re-setup.
  if (caDirPresent) {
    warnings.push({
      kind: "unrecoverable-private",
      blastRadius: 0,
      message:
        `UNRECOVERABLE: wiping the CA PRIVATE key is reversible ONLY by re-running setup (a NEW keypair) ` +
        `or restoring the durable 1Password backup (${ONEPASSWORD_CLUSTER_ITEM}). Teardown is destructive, ` +
        `re-onboarding is the inverse — not undo.`,
    });
  }

  const localAbsent: LocalCaWipeEntry = {
    path: caDir,
    present: caDirPresent,
    files: caFiles,
    action: "absent",
  };

  // ── DRY-RUN (default-safe) — report would-* + warnings; NOTHING touched, NEVER prompt ─────────
  if (dryRun) {
    return finalize({
      dryRun: true,
      confirmed,
      home,
      repoRoot: opts.repoRoot,
      ca: opts.ca,
      localCaWipe: {
        ...localAbsent,
        action: caDirPresent ? "would-wipe" : "absent",
      },
      clusterUnregister: repoPlan.map((r) => ({
        kind: r.kind,
        path: r.path,
        relPath: r.relPath,
        present: r.present,
        action: r.present ? ("would-unregister" as const) : ("absent" as const),
      })),
      warnings,
      hadWork,
    });
  }

  // ── REAL RUN, BUT NOT CONFIRMED — skip everything (fail-safe), NEVER prompt ───────────────────
  if (!confirmed) {
    return finalize({
      dryRun: false,
      confirmed: false,
      home,
      repoRoot: opts.repoRoot,
      ca: opts.ca,
      localCaWipe: {
        ...localAbsent,
        action: caDirPresent ? "skipped-not-confirmed" : "absent",
      },
      clusterUnregister: repoPlan.map((r) => ({
        kind: r.kind,
        path: r.path,
        relPath: r.relPath,
        present: r.present,
        action: r.present ? ("skipped-not-confirmed" as const) : ("absent" as const),
      })),
      warnings,
      hadWork,
    });
  }

  // ── IDEMPOTENT CLEAN NO-OP — nothing present, so nothing destructive; NEVER prompt ────────────
  if (!hadWork) {
    return finalize({
      dryRun: false,
      confirmed: true,
      home,
      repoRoot: opts.repoRoot,
      ca: opts.ca,
      localCaWipe: { path: caDir, present: false, files: [], action: "absent" },
      clusterUnregister: repoPlan.map((r) => ({
        kind: r.kind,
        path: r.path,
        relPath: r.relPath,
        present: false,
        action: "absent" as const,
      })),
      warnings: [],
      hadWork: false,
    });
  }

  // ── BIOMETRIC GATE — fired EXACTLY ONCE for the whole destructive run (fail-closed) ───────────
  const biometric = await requireBiometric(
    opts.biometricAuth,
    `Approve Zeta CLUSTER TEARDOWN for ca=${opts.ca} (DESTRUCTIVE: wipe CA private key + unregister ` +
      `the CA pubkey & multi-CA trust set for a PR; ${warnings.length} cascade warning(s))`,
  );
  if (!biometric.ok) {
    return finalize({
      dryRun: false,
      confirmed: true,
      home,
      repoRoot: opts.repoRoot,
      ca: opts.ca,
      biometric,
      localCaWipe: {
        ...localAbsent,
        action: caDirPresent ? "skipped-biometric" : "absent",
      },
      clusterUnregister: repoPlan.map((r) => ({
        kind: r.kind,
        path: r.path,
        relPath: r.relPath,
        present: r.present,
        action: r.present ? ("skipped-biometric" as const) : ("absent" as const),
      })),
      warnings,
      hadWork,
    });
  }

  // ── DESTRUCTIVE EXECUTION (approved) ─────────────────────────────────────────────────────────
  // LOCAL WIPE: securely remove every CA private file, then tidy the now-empty dir.
  let localCaWipe: LocalCaWipeEntry;
  if (caDirPresent) {
    for (const f of caFiles) fx.securelyRemove(f);
    fx.removeDir(caDir);
    localCaWipe = { path: caDir, present: true, files: caFiles, action: "wiped" };
  } else {
    localCaWipe = { path: caDir, present: false, files: [], action: "absent" };
  }

  // REPO UNREGISTER: stage a `git rm` of each present cluster artifact (for a PR — never pushed).
  const clusterUnregister: ClusterUnregisterEntry[] = repoPlan.map((r) => {
    if (!r.present) {
      return { kind: r.kind, path: r.path, relPath: r.relPath, present: false, action: "absent" as const };
    }
    fx.gitRm(opts.repoRoot, r.relPath);
    return { kind: r.kind, path: r.path, relPath: r.relPath, present: true, action: "unregistered" as const };
  });

  return finalize({
    dryRun: false,
    confirmed: true,
    home,
    repoRoot: opts.repoRoot,
    ca: opts.ca,
    biometric,
    localCaWipe,
    clusterUnregister,
    warnings,
    hadWork: true,
  });
}

/** Fill the derived fields (`unregisteredPaths`) and return a complete result. */
function finalize(partial: Omit<ClusterTeardownResult, "unregisteredPaths">): ClusterTeardownResult {
  const unregisteredPaths = partial.clusterUnregister
    .filter((r) => r.action === "unregistered")
    .map((r) => r.relPath);
  return { ...partial, unregisteredPaths };
}

/** Render the operator-facing readout — PUBLIC only, NEVER any key bytes. Leads with the CASCADE
 *  WARNINGS (the blast radius) so the operator sees them before deciding to --confirm. */
export function formatClusterTeardown(res: ClusterTeardownResult): string {
  const lines: string[] = [];
  const mode = res.dryRun
    ? "DRY RUN (default-safe — NOTHING deleted, rm'd, or prompted)"
    : res.confirmed
      ? "CONFIRMED cluster teardown"
      : "NOT CONFIRMED (no --confirm — NOTHING touched)";
  lines.push(`Zeta teardown-cluster — ca=${res.ca} — ${mode}`);

  if (!res.hadWork) {
    lines.push("  Already clean: no CA private material and no registered cluster artifacts found.");
    lines.push("  (Idempotent no-op — nothing to wipe, nothing to unregister, no approval needed.)");
    return lines.join("\n");
  }

  // CASCADE WARNINGS first — never silent (smart-cascade design).
  if (res.warnings.length > 0) {
    lines.push("  ⚠ CASCADE WARNINGS (extra-care nodes — review the blast radius BEFORE --confirm):");
    for (const w of res.warnings) {
      const radius = w.blastRadius > 0 ? ` [blast radius: ${w.blastRadius}]` : "";
      lines.push(`    - ${w.message}${radius}`);
    }
  }

  lines.push("  LOCAL WIPE (this cluster's CA PRIVATE key under ~/.config/zeta/ca/):");
  {
    const l = res.localCaWipe;
    const tag =
      l.action === "would-wipe"
        ? `would wipe ${l.files.length} file(s)`
        : l.action === "wiped"
          ? `WIPED ${l.files.length} file(s)`
          : l.action === "absent"
            ? "absent (nothing to wipe)"
            : l.action === "skipped-not-confirmed"
              ? "present — skipped (no --confirm)"
              : "present — skipped (biometric declined)";
    lines.push(`    [ca] ${l.path} — ${tag}`);
  }

  lines.push("  REPO UNREGISTER (remove registered PUBLIC cluster artifacts — staged for a PR, NOT pushed):");
  for (const r of res.clusterUnregister) {
    const tag =
      r.action === "would-unregister"
        ? "would git rm"
        : r.action === "unregistered"
          ? "git rm STAGED"
          : r.action === "absent"
            ? "absent (not registered)"
            : r.action === "skipped-not-confirmed"
              ? "present — skipped (no --confirm)"
              : "present — skipped (biometric declined)";
    lines.push(`    [${r.kind}] ${r.relPath} — ${tag}`);
  }

  if (res.dryRun) {
    lines.push("  Re-run with --confirm (and approve the biometric) to execute the cluster teardown.");
  } else if (res.confirmed && res.biometric?.ok === true) {
    lines.push(
      `  Operator approval: 1 approval covered the whole destructive run ` +
        `(mechanism ${res.biometric.platform}, factor established: ${establishedFactor(res.biometric)}).`,
    );
    lines.push(
      `  Unregistered (staged for PR): ${res.unregisteredPaths.length} path(s). Commit + open a PR to land the removal.`,
    );
  } else if (res.confirmed && res.biometric !== undefined && !res.biometric.ok) {
    lines.push(`  Biometric DECLINED — fail-closed: nothing deleted, nothing unregistered.`);
  }
  return lines.join("\n");
}

/** Render the optional 1Password note — PRINTS the CA-private item so the operator can decide to delete
 *  the durable backup too. NEVER deletes from 1Password (that is the operator's explicit call). */
export function format1PasswordNote(): string {
  return [
    "1Password backup (NOT deleted automatically — your call):",
    `    - ${ONEPASSWORD_CLUSTER_ITEM}`,
    "  Delete this manually in 1Password ONLY if you want to remove the durable CA-private backup too.",
  ].join("\n");
}

/** The REAL host effects (used by the CLI). The wipe door does the secure erasure; the git door shells
 *  `git rm` under the given repoRoot — never a push, never main. NO door returns secret bytes. */
export function realEffects(): ClusterTeardownEffects {
  const walkFiles = (dir: string): string[] => {
    if (!existsSync(dir)) return [];
    const out: string[] = [];
    const walk = (d: string): void => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const full = join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else out.push(full);
      }
    };
    walk(dir);
    return out;
  };
  return {
    exists: (p) => existsSync(p),
    listFiles: walkFiles,
    readPublic: (p) => (existsSync(p) ? readFileSync(p, "utf8") : ""),
    listMachineCerts: (repoRoot) => {
      const dir = join(repoRoot, "machines");
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((n) => n.endsWith("-cert.pub"))
        .map((n) => join(dir, n));
    },
    securelyRemove: (path) => {
      if (!existsSync(path)) return true; // idempotent: already gone
      // Prefer `shred` (overwrite-then-unlink) where available so private bytes don't linger; fall
      // back to a manual overwrite + unlink. NEVER reads the file's bytes into this process.
      const shredded = spawnSync("shred", ["-u", "-z", path], { stdio: "ignore" });
      if (shredded.status === 0 && !existsSync(path)) return true;
      try {
        const size = statSync(path).size;
        if (size > 0) writeFileSync(path, Buffer.alloc(size, 0));
      } catch {
        // overwrite is best-effort; proceed to unlink regardless
      }
      try {
        unlinkSync(path);
      } catch {
        return false;
      }
      return !existsSync(path);
    },
    removeDir: (dir) => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort tidy of the now-empty dir
      }
    },
    gitRm: (repoRoot, relPath) => {
      // Stage a removal for a PR — `git rm` under the caller's repoRoot. NEVER pushes, NEVER main.
      // --ignore-unmatch keeps it idempotent (an already-removed/untracked path is not an error).
      const r = spawnSync("git", ["-C", repoRoot, "rm", "--ignore-unmatch", "--", relPath], {
        stdio: "ignore",
      });
      return r.status === 0;
    },
  };
}
