#!/usr/bin/env bun
// touchid-sudo.ts -- make Touch ID for sudo durable, and detect when it silently reverts.
//
// PLATFORM: macOS only, and this is not a portability gap that will be closed.
// PAM policy files are an OS-specific mechanism; there is no `/etc/pam.d` to
// configure on Linux-with-fprintd or on Windows Hello, and pretending otherwise
// would be worse than saying so. Written in TypeScript because that is the
// repo's one interface (`.ts` over `.sh`), not because it runs anywhere else.
//
// THE DEFECT THIS CLOSES. `auth sufficient pam_tid.so` added to /etc/pam.d/sudo
// works, and macOS REPLACES that file on OS updates. Apple ships
// /etc/pam.d/sudo_local.template for exactly this reason -- its own first line
// reads "local config file which survives system update". A machine configured
// the direct way therefore drops to password-only at some future update with no
// announcement, which is the house failure mode: a protection that stops
// applying without saying so. This tool writes sudo_local and NEVER touches
// /etc/pam.d/sudo.
//
// IF SUDO EVER BREAKS (once, plainly -- this is not a ritual). --apply holds the
// root it was already given and validates before letting go, removing the file
// itself if anything is wrong, so it does not hand the machine back broken. If
// you still need to undo it by hand and sudo will not authenticate: keep any
// already-authenticated root shell open (`sudo -s` in another tab) and run
// `rm /etc/pam.d/sudo_local`. Last resort, rarely needed: boot to Recovery
// (hold power -> Options -> Utilities -> Terminal) and delete the same file.
//
// WHY LOCKOUT IS NOT THE DESIGN PROBLEM IT LOOKS LIKE. Every line this tool
// writes uses `optional` or `sufficient`. Per pam.conf(5) a failed `sufficient`
// module falls through to the rest of the chain and `optional` is ignored
// entirely, so nothing in this file can DENY authentication -- pam_opendirectory
// (your password) stays reachable whatever happens to it. And a missing
// sudo_local is tolerated by the include: Apple ships `auth include sudo_local`
// in the stock /etc/pam.d/sudo while shipping NO sudo_local, only the template,
// and stock macOS sudo authenticates fine. So both "file is wrong" and "file is
// gone" degrade to password-only, never to locked-out.
//
// THE CONSTRAINT THAT MAKES ANY OF THIS MEAN ANYTHING. PAM is consulted by the
// real /usr/bin/sudo. A caller that invokes `sudo` BY NAME can be intercepted by
// a PATH entry before PAM is ever reached, and then none of this applies -- that
// is live P1 in docs/BUGS.md ("The biometric approval gate is forgeable by a
// PATH entry"), fixed by resolving every privilege elevator absolutely (PR
// #14727). This tool and that fix are two halves of one property: PAM
// enforcement is only real if the binary is the real one. Accordingly, the one
// place this file elevates uses the absolute /usr/bin/sudo.
//
// HONEST LIMIT ON THE WORD "ENFORCED". `auth sufficient pam_tid.so` makes Touch
// ID ACCEPTED, not REQUIRED: the chain continues to pam_opendirectory, so a
// password still authenticates and sudo never reports which module satisfied it
// (see the 2026-08-17 correction in the ADR). This tool verifies that the Touch
// ID factor is available and DURABLE. It does not, and cannot at this layer,
// prove a given sudo invocation was satisfied biometrically.

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import {
  assess,
  brewManifestDeclares,
  denyingControlLines,
  hasActiveAuthModule,
  includesSudoLocal,
  renderSudoLocal,
  type Assessment,
  type TouchIdEnv,
} from "./touchid-sudo-config.ts";

/**
 * TEST SEAM. When set, every system path below is read and written under this
 * prefix instead of `/`. It exists so the proofs in the PR run against a fixture
 * tree -- idempotency by `cmp`, and the OS-update revert -- without going near a
 * real `/etc/pam.d`. When it is set the tool NEVER elevates: a sandbox root is
 * writable by the user already, so there is no privileged write to redirect.
 * That is the property that keeps this seam from being an escalation surface.
 */
const PAM_ROOT = process.env.ZETA_TOUCHID_PAM_ROOT ?? "";
const SANDBOXED = PAM_ROOT !== "";

const PAM_DIR = `${PAM_ROOT}/etc/pam.d`;
const PAM_SUDO = `${PAM_ROOT}/etc/pam.d/sudo`;
const PAM_SUDO_LOCAL = `${PAM_ROOT}/etc/pam.d/sudo_local`;
const PAM_TID_MODULE = `${PAM_ROOT}/usr/lib/pam/pam_tid.so.2`;
/** Absolute, never resolved through PATH -- see the PR #14727 note in the header. */
const SUDO_BIN = "/usr/bin/sudo";
/** The declarative manifest that OWNS the pam-reattach dependency. */
const BREW_MANIFEST = `${repoRootFromHere()}/tools/setup/manifests/brew`;
const REATTACH_CANDIDATES = [
  `${PAM_ROOT}/opt/homebrew/lib/pam/pam_reattach.so`, // Apple Silicon Homebrew
  `${PAM_ROOT}/usr/local/lib/pam/pam_reattach.so`, // Intel Homebrew
];

/** Repo root, derived from this file's own location (tools/setup/ -> ../..). */
function repoRootFromHere(): string {
  return join(import.meta.dir, "..", "..");
}

function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** Read at most `bytes` from the head of a file. THROWS when absent -- the door contract. */
function readBytesHead(path: string, bytes: number): Uint8Array {
  const fd = openSync(path, "r");
  try {
    const buf = new Uint8Array(bytes);
    const n = readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n);
  } finally {
    closeSync(fd);
  }
}

/**
 * The live environment, as READ DOORS only.
 *
 * No command is executed to build this, and that is the point rather than an
 * accident: a verifier that raises a prompt trains the operator to approve
 * prompts reflexively, which is the exact habit the biometric gate depends on
 * NOT existing. The standard published recipes for "is Touch ID sudo on?" --
 * `sudo -n true`, `bioutil -r`, `sfltool dumpbtm` -- are all refused on that
 * ground. A command is judged by what it REQUIRES, not by what it reads.
 */
export function liveEnv(): TouchIdEnv {
  return {
    platform: process.platform,
    arch: process.arch,
    read: (path) => readFileSync(path, "utf8"),
    readBytes: (path) => readBytesHead(path, 4096),
    pamDir: PAM_DIR,
    pamTidModulePath: PAM_TID_MODULE,
    reattachCandidates: REATTACH_CANDIDATES,
    reattachDeclared: brewManifestDeclares(readIfPresent(BREW_MANIFEST) ?? "", "pam-reattach"),
    insideMultiplexer: Boolean(process.env.TMUX) || (process.env.TERM ?? "").startsWith("screen"),
  };
}

const SEVERITY_GLYPH: Record<string, string> = { error: "x", warn: "!", info: "-" };

function printAssessment(a: Assessment): void {
  console.log(`Touch ID for sudo: ${a.status.toUpperCase()}${a.red ? " (RED)" : " (GREEN)"}`);
  console.log(`  /etc/pam.d/sudo_local     : ${a.sudoLocalPresent ? "present" : "absent"}`);
  console.log(`  include in /etc/pam.d/sudo: ${a.sudoLocalIncluded ? "yes" : "NO"}`);
  console.log(`  pam_reattach (tmux)       : ${a.reattachModulePath ?? "not installed"}`);
  console.log(`  Touch ID works in tmux    : ${a.multiplexerReady ? "yes" : "NO"}`);
  for (const f of a.findings) console.log(`  [${SEVERITY_GLYPH[f.severity] ?? "-"}] ${f.message}`);
}

/** Write `content` to `path` atomically: a reader sees the old file or the new one, never a partial one. */
function writeAtomic(path: string, content: string): void {
  const tmp = `${path}.zeta-tmp-${String(process.pid)}`;
  writeFileSync(tmp, content, { mode: 0o644 });
  chmodSync(tmp, 0o644);
  renameSync(tmp, path); // same directory => same filesystem => atomic
}

/**
 * Validate what we just wrote, WITHOUT authenticating.
 *
 * What this proves: the bytes landed, every active line parses, no line uses a
 * control that could deny, every referenced module exists, and the include is
 * still in place.
 *
 * What it does NOT prove: that PAM will authenticate. The only way to test that
 * is to authenticate, which raises the prompt this whole tool exists to keep
 * honest. `pam_start(3)` looked like a way out and is not: measured on macOS
 * 26.5.2, `pam_start("sudo", ...)` and `pam_start("a_service_that_does_not_exist", ...)`
 * BOTH return PAM_SUCCESS, because OpenPAM parses the policy lazily at dispatch.
 * A check that returns 0 for a service that does not exist is a check that
 * cannot fail, so it is not used here. Saying "structural validation only" is
 * worth more than a validation step that quietly proves nothing.
 */
function validateWritten(path: string): string[] {
  const problems: string[] = [];
  const readBack = readIfPresent(path);
  if (readBack === null) {
    problems.push(`${path} could not be read back after writing.`);
    return problems;
  }
  if (!hasActiveAuthModule(readBack, "pam_tid.so")) {
    problems.push("the file has no active pam_tid.so auth line after writing.");
  }
  for (const line of denyingControlLines(readBack)) {
    problems.push(`line uses a control that can DENY authentication: "${line.raw.trim()}"`);
  }
  for (const line of readBack.split("\n")) {
    const t = line.trim();
    if (t.startsWith("#") || t.length === 0) continue;
    const mod = t.split(/\s+/u)[2];
    if (mod !== undefined && mod.startsWith("/") && !existsSync(mod)) {
      problems.push(`references a module that does not exist: ${mod}`);
    }
  }
  if (!includesSudoLocal(readIfPresent(PAM_SUDO))) {
    problems.push(`${PAM_SUDO} does not include sudo_local, so this file would be inert.`);
  }
  return problems;
}

function apply(env: TouchIdEnv): number {
  const pre = assess(env);
  if (pre.status === "unsupported") {
    printAssessment(pre);
    console.error("Refusing to apply: this machine does not support sudo_local. Nothing was changed.");
    return 2;
  }

  const existing = readIfPresent(PAM_SUDO_LOCAL);
  const desired = renderSudoLocal({ reattachModulePath: pre.reattachModulePath });

  // Idempotency (manifesto §12): apply-N-times == apply-once. Byte-compare first
  // and return without writing, so a second run does not even touch mtime.
  if (existing === desired) {
    console.log("already correct -- /etc/pam.d/sudo_local matches the desired content byte for byte.");
    printAssessment(pre);
    return 0;
  }

  if (!SANDBOXED && process.getuid?.() !== 0) {
    // Re-exec once under the ABSOLUTE sudo path, so the operator sees exactly one
    // prompt and is told what it is for before it appears.
    console.log("About to write /etc/pam.d/sudo_local to enable Touch ID for sudo.");
    console.log("This needs root once. You will be asked to authenticate now.");
    console.log("It does not modify /etc/pam.d/sudo, and it is undone with: sudo rm /etc/pam.d/sudo_local");
    if (!existsSync(SUDO_BIN)) {
      console.error(`${SUDO_BIN} not found; cannot elevate.`);
      return 2;
    }
    const r = spawnSync(SUDO_BIN, [process.execPath, import.meta.path, "--apply"], { stdio: "inherit" });
    return r.status ?? 1;
  }

  writeAtomic(PAM_SUDO_LOCAL, desired);

  // Still root here. If the result is not sound, undo it NOW rather than handing
  // the machine back in a state the operator has to diagnose. This is the whole
  // reason apply does its own checking: it already holds the authenticated
  // session, so the revert cannot fail for want of privilege.
  const problems = validateWritten(PAM_SUDO_LOCAL);
  if (problems.length > 0) {
    if (existing === null) unlinkSync(PAM_SUDO_LOCAL);
    else writeAtomic(PAM_SUDO_LOCAL, existing);
    console.error("Validation failed after writing; reverted while still elevated. Problems:");
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }

  console.log(`wrote ${PAM_SUDO_LOCAL} (${existing === null ? "created" : "updated"}).`);
  printAssessment(assess(env));
  console.log("Touch ID for sudo is now configured durably. Undo with: sudo rm /etc/pam.d/sudo_local");
  return 0;
}

function main(argv: readonly string[]): number {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: bun tools/setup/touchid-sudo.ts [--verify|--apply] [--json]");
    console.log("  --verify  (default) read-only; reports whether Touch ID sudo is DURABLE. Raises no prompt.");
    console.log("  --apply   write /etc/pam.d/sudo_local; needs root once. Idempotent.");
    return 0;
  }
  const env = liveEnv();
  if (args.includes("--apply")) return apply(env);

  const a = assess(env);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ status: a.status, red: a.red, findings: a.findings }, null, 2));
  } else {
    printAssessment(a);
  }
  return a.red ? 1 : 0;
}

if (import.meta.main) process.exit(main(process.argv));
