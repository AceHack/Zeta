// Zeta TEARDOWN / UNREGISTER — the inverse of setup-machine / setup-cluster (ca.ts + machine.ts +
// onboard.ts). DESTRUCTIVE-capable, security-class (workitem 081KVM1TK3Z08QG0R0002959G6 §"clean
// re-onboarding"). Aaron (2026-06-21): *"delete everything including the CA, unregister; start
// writing the unregister scripts too — this is a core primitive, support in all langs eventually,
// save to a resume."* The point is to PROVE clean re-onboarding: teardown → re-run setup → the
// same one-fingerprint UX, from a blank host.
//
// CORE PRIMITIVE — TS NOW, ALL LANGS EVENTUALLY. This is a CORE PRIMITIVE that will be generated
// to every oracle via gen/ (the same shape as setup/onboard). It is built in TypeScript today
// (the persona-keys tooling is TS) and read as the canonical reference for the future generation.
//
// TWO HALVES (both behind the injected-effects pattern — noninterference §13; tests inject fakes):
//
//   1. LOCAL WIPE — securely remove THIS host's PRIVATE material under ~/.config/zeta/
//      ({ca, machine, keyring, keyset} — whatever exists). Each private FILE is `shred`-then-unlink
//      where available (the runner's job, in the injected `securelyRemove` door), falling back to
//      overwrite+unlink, so private bytes don't linger. BIOMETRIC-GATED, FAIL-CLOSED: a destructive
//      wipe needs ONE operator approval (Touch ID / Windows Hello). NEVER echoes key bytes.
//
//   2. REPO UNREGISTER — remove the registered PUBLIC artifacts so they are un-PR'd: the CA pubkey
//      `maintainers/<ca>/ssh-ca.pub`, the machine pubkey `machines/<host>.pub`, and the machine cert
//      `machines/<host>-cert.pub`. This is staged as a `git rm` in the CALLER's repo clone (it
//      produces the removal FOR a PR) — it NEVER pushes to main and respects shared-checkout-is-
//      view-only (it operates ONLY on the `repoRoot` passed in, via the injected `gitRm` door).
//
// SECURITY INVARIANTS (security-class — honesty over green):
//  1. `--dry-run` is the DEFAULT-safe path: report exactly what WOULD be wiped / unregistered,
//     delete/rm NOTHING, and NEVER prompt. A real teardown requires an explicit `confirm` (the CLI
//     `--confirm` / a non-dry-run call) AND the biometric approval. dry-run never calls the gate.
//  2. FAIL-CLOSED: a declined / absent biometric ⇒ NOTHING is deleted, NOTHING is rm'd. The gate is
//     fired EXACTLY ONCE for the whole destructive run (one fingerprint), via the shared
//     biometric.ts gate (reuse `requireBiometric`; the CLI wraps it in `sessionBiometric`).
//  3. IDEMPOTENT: re-run after a teardown is a clean no-op — nothing present ⇒ "already clean", no
//     prompt (nothing destructive will happen, so nothing is approved).
//  4. NO secret bytes EVER cross this boundary or get printed — the wipe door consumes paths and
//     returns only a boolean/typed outcome; we never read private contents into this process.
//
// Anchors (Beacon): secure file erasure — `shred(1)` (GNU coreutils; Gutmann 1996, "Secure Deletion
// of Data from Magnetic and Solid-State Memory") with the SSD/journaling caveat (overwrite-in-place
// is best-effort on copy-on-write/flash — the honest reason the CA private also lives in 1Password,
// the durable backup). Reversible-by-regeneration: a wiped key is recoverable ONLY by re-running
// setup (new keypair) — teardown is destructive, re-onboarding is the inverse, not undo. Touch ID
// PAM / Windows Hello user-verification as the destructive-action floor (biometric.ts). `git rm`
// staging for a removal PR — git as the public-trust distribution channel (ca.ts), removed the
// same way it was added (never a force-push, never a direct main write).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { caPublicKeyPath } from "./ca.ts";
import { machinePubPath, sanitizeHostname } from "./machine.ts";
import { establishedFactor, requireBiometric, type BiometricAuth, type BiometricResult } from "./biometric.ts";
export type { BiometricAuth, BiometricResult } from "./biometric.ts";

/** The host-environment doors — the ONLY channel for ambient influence (noninterference §13).
 *  Every door is PUBLIC-safe by construction: NO door ever returns private key BYTES. The wipe
 *  doors consume PATHS and report success only; nothing reads a secret into this process. */
export interface TeardownEffects {
  /** True iff a path exists (presence checks — never reads the contents of a secret). */
  readonly exists: (path: string) => boolean;
  /** List the files (recursively, leaf paths) under a local dir — used ONLY to count + report
   *  WHICH private files would be / were wiped (paths, never contents). Returns [] if absent. */
  readonly listFiles: (dir: string) => readonly string[];
  /** SECURELY remove ONE local file: shred-then-unlink where available, else overwrite+unlink.
   *  The runner does the erasure; this returns true iff the file is gone afterwards. NEVER reads
   *  or returns the file's bytes. Idempotent: removing an absent file is a no-op true. */
  readonly securelyRemove: (path: string) => boolean;
  /** Remove a now-empty local directory (best-effort; absent ⇒ no-op). Tidies ~/.config/zeta/<d>. */
  readonly removeDir: (dir: string) => void;
  /** Stage a `git rm` of a PUBLIC artifact in the CALLER's repo clone (produces a removal for a
   *  PR — NEVER pushes, NEVER touches main directly). Returns true iff the path was staged for
   *  removal (false if it was not tracked / already gone). Operates ONLY under the given repoRoot. */
  readonly gitRm: (repoRoot: string, relPath: string) => boolean;
}

/** The four local directories that hold THIS host's PRIVATE material (under ~/.config/zeta/). The
 *  whole point of teardown is to remove ALL of these (Aaron: "delete everything including the CA").
 *  ca = the SSH CA private key; machine = this host's device key; keyring/keyset = persona material. */
export const ZETA_LOCAL_DIRS = ["ca", "machine", "keyring", "keyset"] as const;
export type ZetaLocalDir = (typeof ZETA_LOCAL_DIRS)[number];

/** The 1Password items that mirror the local private material — PRINTED (never deleted) by the
 *  optional `--note-1password` flag so the operator can decide to delete the durable backups too.
 *  We NEVER delete from 1Password automatically (the backup is the reversible-by-regeneration
 *  safety net; deleting it is the operator's explicit call). Names are advisory, not load-bearing. */
export const ONEPASSWORD_ITEMS = [
  "zeta-ca-private",
  "zeta-machine-private",
  "zeta-keyring-seed",
  "zeta-keyset",
] as const;

/** The base ~/.config/zeta directory for a given home. */
export function zetaConfigDir(home: string = homedir()): string {
  return join(home, ".config", "zeta");
}

/** The local path for one of the four private dirs. */
export function zetaLocalDirPath(dir: ZetaLocalDir, home: string = homedir()): string {
  return join(zetaConfigDir(home), dir);
}

/** The machine cert public path: `machines/<host>-cert.pub` (next to the machine pubkey). The
 *  cert is PUBLIC (ca.ts) but it is a registered artifact, so unregistering removes it too. */
export function machineCertPath(repoRoot: string, hostname: string): string {
  return join(repoRoot, "machines", `${sanitizeHostname(hostname)}-cert.pub`);
}

/** The repo-root-RELATIVE path of the CA public key — the exact `git rm` argument under
 *  `-C repoRoot` (e.g. `maintainers/<ca>/ssh-ca.pub`). The relative form is what gets staged. */
export function caPublicRel(repoRoot: string, ca: string): string {
  return relUnder(repoRoot, caPublicKeyPath(repoRoot, ca));
}

/** What happened (or, on dry-run, WOULD happen) to one local private dir. No secret bytes. */
export interface LocalWipeEntry {
  readonly dir: ZetaLocalDir;
  readonly path: string;
  /** Whether this dir was present (had any files) before the run. */
  readonly present: boolean;
  /** The leaf file paths under it (the private files) — PATHS only, NEVER contents. */
  readonly files: readonly string[];
  /** "wiped" (real run, files securely removed) | "would-wipe" (dry-run) | "absent" (nothing here)
   *  | "skipped-not-confirmed" (real run but no `confirm`) | "skipped-biometric" (declined gate). */
  readonly action: "wiped" | "would-wipe" | "absent" | "skipped-not-confirmed" | "skipped-biometric";
}

/** What happened (or WOULD happen) to one registered PUBLIC artifact. */
export interface RepoUnregisterEntry {
  readonly kind: "ca-pubkey" | "machine-pubkey" | "machine-cert";
  readonly path: string;
  /** Repo-root-relative path passed to `git rm` (the removal staged for a PR). */
  readonly relPath: string;
  /** Whether the artifact existed in the repo before the run. */
  readonly present: boolean;
  /** "unregistered" (git rm staged) | "would-unregister" (dry-run) | "absent" (not in repo)
   *  | "skipped-not-confirmed" | "skipped-biometric". */
  readonly action:
    | "unregistered"
    | "would-unregister"
    | "absent"
    | "skipped-not-confirmed"
    | "skipped-biometric";
}

/** The full teardown result — auditable, public-only. */
export interface TeardownResult {
  readonly dryRun: boolean;
  /** Whether the caller explicitly confirmed a destructive run (CLI `--confirm` / non-dry-run). */
  readonly confirmed: boolean;
  readonly home: string;
  readonly repoRoot: string;
  readonly hostname: string;
  /** The CA identity whose `maintainers/<ca>/ssh-ca.pub` is unregistered. */
  readonly ca: string;
  readonly localWipe: readonly LocalWipeEntry[];
  readonly repoUnregister: readonly RepoUnregisterEntry[];
  /** True iff there was anything destructive to do at all (any present local dir OR repo artifact).
   *  When false, the run is a clean no-op ("already clean") and the gate is never fired. */
  readonly hadWork: boolean;
  /** The biometric approval outcome — present ONLY when the gate was actually invoked (a confirmed,
   *  non-dry-run with work to do). Absent on dry-run, on a non-confirmed run, and on an already-clean
   *  no-op. NEVER carries a secret. */
  readonly biometric?: BiometricResult;
  /** The list of repo paths actually staged for `git rm` (the PR's removal set) — for the caller. */
  readonly unregisteredPaths: readonly string[];
}

/** Options for a teardown. `dryRun` defaults TRUE at the CLI; here the explicit value governs.
 *  A real (destructive) run requires `dryRun:false` AND `confirm:true` AND a passing biometric. */
export interface TeardownOptions {
  /** The CA identity (the `maintainers/<ca>/` trust root to unregister). Usually the operator. */
  readonly ca: string;
  readonly repoRoot: string;
  readonly home?: string;
  /** Override hostname (else taken from the caller; the CLI passes os.hostname()). */
  readonly hostname: string;
  /** When true, NOTHING is deleted/rm'd/prompted — report "would-*". DEFAULT-safe path. */
  readonly dryRun?: boolean;
  /** Explicit destructive confirmation. WITHOUT it (on a non-dry-run) every step is
   *  "skipped-not-confirmed" — nothing is touched. WITH it (+ biometric) the wipe + rm happen. */
  readonly confirm?: boolean;
  /** SHARED biometric approval door — required for the real destructive path (fail-closed). */
  readonly biometricAuth?: BiometricAuth;
}

/**
 * Run the teardown / unregister — the inverse of setup. DEFAULT-safe: on `dryRun` (or a non-dry-run
 * WITHOUT `confirm`) it reports exactly what WOULD be wiped/unregistered and touches NOTHING and
 * NEVER prompts. A real teardown requires `dryRun:false` AND `confirm:true` AND ONE passing biometric
 * approval (fired exactly once for the whole run). Idempotent: if nothing is present it is a clean
 * no-op ("already clean") with NO prompt.
 *
 * The plan is computed FIRST (pure presence checks) so the readout is honest on every path; the
 * destructive doors fire ONLY after the confirm + biometric gate. The biometric gate is fired once,
 * up front, only when there is real destructive work to do.
 */
export async function teardown(fx: TeardownEffects, opts: TeardownOptions): Promise<TeardownResult> {
  const home = opts.home ?? homedir();
  const hostname = sanitizeHostname(opts.hostname);
  const dryRun = opts.dryRun !== false; // DEFAULT-safe: anything but an explicit false is a dry-run
  const confirmed = opts.confirm === true;

  // ── PLAN (pure presence checks — no side effects, no prompt) ──────────────────────────────
  // LOCAL: each of the four private dirs, the files under it.
  const localPlan = ZETA_LOCAL_DIRS.map((dir) => {
    const path = zetaLocalDirPath(dir, home);
    const present = fx.exists(path);
    const files = present ? fx.listFiles(path) : [];
    return { dir, path, present, files };
  });
  // REPO: the three registered PUBLIC artifacts.
  const repoTargets: readonly { kind: RepoUnregisterEntry["kind"]; path: string }[] = [
    { kind: "ca-pubkey", path: caPublicKeyPath(opts.repoRoot, opts.ca) },
    { kind: "machine-pubkey", path: machinePubPath(opts.repoRoot, hostname) },
    { kind: "machine-cert", path: machineCertPath(opts.repoRoot, hostname) },
  ];
  const repoPlan = repoTargets.map((t) => ({
    ...t,
    relPath: relUnder(opts.repoRoot, t.path),
    present: fx.exists(t.path),
  }));

  const hadWork = localPlan.some((l) => l.present) || repoPlan.some((r) => r.present);

  // ── DRY-RUN (default-safe) — report would-*; NOTHING touched, NEVER prompt ────────────────
  if (dryRun) {
    return finalize({
      dryRun: true,
      confirmed,
      home,
      repoRoot: opts.repoRoot,
      hostname,
      ca: opts.ca,
      localWipe: localPlan.map((l) => ({
        dir: l.dir,
        path: l.path,
        present: l.present,
        files: l.files,
        action: l.present ? ("would-wipe" as const) : ("absent" as const),
      })),
      repoUnregister: repoPlan.map((r) => ({
        kind: r.kind,
        path: r.path,
        relPath: r.relPath,
        present: r.present,
        action: r.present ? ("would-unregister" as const) : ("absent" as const),
      })),
      hadWork,
    });
  }

  // ── REAL RUN, BUT NOT CONFIRMED — skip everything (fail-safe), NEVER prompt ───────────────
  if (!confirmed) {
    return finalize({
      dryRun: false,
      confirmed: false,
      home,
      repoRoot: opts.repoRoot,
      hostname,
      ca: opts.ca,
      localWipe: localPlan.map((l) => ({
        dir: l.dir,
        path: l.path,
        present: l.present,
        files: l.files,
        action: l.present ? ("skipped-not-confirmed" as const) : ("absent" as const),
      })),
      repoUnregister: repoPlan.map((r) => ({
        kind: r.kind,
        path: r.path,
        relPath: r.relPath,
        present: r.present,
        action: r.present ? ("skipped-not-confirmed" as const) : ("absent" as const),
      })),
      hadWork,
    });
  }

  // ── IDEMPOTENT CLEAN NO-OP — nothing present, so nothing destructive; NEVER prompt ────────
  if (!hadWork) {
    return finalize({
      dryRun: false,
      confirmed: true,
      home,
      repoRoot: opts.repoRoot,
      hostname,
      ca: opts.ca,
      localWipe: localPlan.map((l) => ({
        dir: l.dir,
        path: l.path,
        present: false,
        files: [] as readonly string[],
        action: "absent" as const,
      })),
      repoUnregister: repoPlan.map((r) => ({
        kind: r.kind,
        path: r.path,
        relPath: r.relPath,
        present: false,
        action: "absent" as const,
      })),
      hadWork: false,
    });
  }

  // ── BIOMETRIC GATE — fired EXACTLY ONCE for the whole destructive run (fail-closed) ───────
  const biometric = await requireBiometric(
    opts.biometricAuth,
    `Approve Zeta TEARDOWN for host ${hostname} (DESTRUCTIVE: wipe local private keys` +
      ` [${ZETA_LOCAL_DIRS.join(", ")}] + unregister public artifacts for a PR)`,
  );
  if (!biometric.ok) {
    // Declined ⇒ NOTHING deleted, NOTHING rm'd. Every present target is "skipped-biometric".
    return finalize({
      dryRun: false,
      confirmed: true,
      home,
      repoRoot: opts.repoRoot,
      hostname,
      ca: opts.ca,
      biometric,
      localWipe: localPlan.map((l) => ({
        dir: l.dir,
        path: l.path,
        present: l.present,
        files: l.files,
        action: l.present ? ("skipped-biometric" as const) : ("absent" as const),
      })),
      repoUnregister: repoPlan.map((r) => ({
        kind: r.kind,
        path: r.path,
        relPath: r.relPath,
        present: r.present,
        action: r.present ? ("skipped-biometric" as const) : ("absent" as const),
      })),
      hadWork,
    });
  }

  // ── DESTRUCTIVE EXECUTION (approved) ─────────────────────────────────────────────────────
  // LOCAL WIPE: securely remove every private file, then tidy the now-empty dir.
  const localWipe: LocalWipeEntry[] = localPlan.map((l) => {
    if (!l.present) {
      return { dir: l.dir, path: l.path, present: false, files: [], action: "absent" as const };
    }
    for (const f of l.files) fx.securelyRemove(f);
    fx.removeDir(l.path);
    return { dir: l.dir, path: l.path, present: true, files: l.files, action: "wiped" as const };
  });

  // REPO UNREGISTER: stage a `git rm` of each present public artifact (for a PR — never pushed).
  const repoUnregister: RepoUnregisterEntry[] = repoPlan.map((r) => {
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
    hostname,
    ca: opts.ca,
    biometric,
    localWipe,
    repoUnregister,
    hadWork: true,
  });
}

/** Fill the derived fields (`unregisteredPaths`) and return a complete result. */
function finalize(partial: Omit<TeardownResult, "unregisteredPaths">): TeardownResult {
  const unregisteredPaths = partial.repoUnregister
    .filter((r) => r.action === "unregistered")
    .map((r) => r.relPath);
  return { ...partial, unregisteredPaths };
}

/** Repo-root-relative path for a readout / `git rm` argument (POSIX-ish, ordinal). */
function relUnder(repoRoot: string, path: string): string {
  const prefix = repoRoot.endsWith("/") ? repoRoot : repoRoot + "/";
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/** Render the operator-facing readout — PUBLIC only, NEVER any key bytes. */
export function formatTeardown(res: TeardownResult): string {
  const lines: string[] = [];
  const mode = res.dryRun
    ? "DRY RUN (default-safe — NOTHING deleted, rm'd, or prompted)"
    : res.confirmed
      ? "CONFIRMED teardown"
      : "NOT CONFIRMED (no --confirm — NOTHING touched)";
  lines.push(`Zeta teardown — host=${res.hostname}, ca=${res.ca} — ${mode}`);

  if (!res.hadWork) {
    lines.push("  Already clean: no local private material and no registered artifacts found.");
    lines.push("  (Idempotent no-op — nothing to wipe, nothing to unregister, no approval needed.)");
    return lines.join("\n");
  }

  lines.push("  LOCAL WIPE (this host's PRIVATE material under ~/.config/zeta/):");
  for (const l of res.localWipe) {
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
    lines.push(`    [${l.dir}] ${l.path} — ${tag}`);
  }

  lines.push("  REPO UNREGISTER (remove registered PUBLIC artifacts — staged for a PR, NOT pushed):");
  for (const r of res.repoUnregister) {
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
    lines.push("  Re-run with --confirm (and approve the biometric) to execute the teardown.");
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

/** Render the optional 1Password note — PRINTS which items correspond so the operator can decide
 *  to delete the durable backups. NEVER deletes from 1Password (that is the operator's call). */
export function format1PasswordNote(): string {
  const lines: string[] = [];
  lines.push("1Password backups (NOT deleted automatically — your call):");
  for (const item of ONEPASSWORD_ITEMS) {
    lines.push(`    - ${item}`);
  }
  lines.push("  Delete these manually in 1Password ONLY if you want to remove the durable backups too.");
  return lines.join("\n");
}

/** The REAL host effects (used by the CLI). The wipe doors do the secure erasure; the git door
 *  shells `git rm` under the given repoRoot — never a push, never main. NO door returns secret bytes. */
export function realEffects(): TeardownEffects {
  return {
    exists: (p) => existsSync(p),
    listFiles: (dir) => {
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
    },
    securelyRemove: (path) => {
      if (!existsSync(path)) return true; // idempotent: already gone
      // Prefer `shred` (overwrite-then-unlink) where available so private bytes don't linger;
      // fall back to a manual overwrite + unlink. NEVER reads the file's bytes into this process.
      const shredded = spawnSync("shred", ["-u", "-z", path], { stdio: "ignore" });
      if (shredded.status === 0 && !existsSync(path)) return true;
      // Fallback: best-effort overwrite-in-place with zeros, then unlink. (SSD/CoW caveat applies —
      // the durable backup in 1Password is the honest recovery path; see header Beacon note.)
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
