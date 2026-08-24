#!/usr/bin/env bun
// touchid-sudo-config.ts -- the PURE core of the Touch ID sudo installer/verifier.
//
// THE VERIFIER MUST NOT BE ABLE TO RAISE A SUDO OR TOUCH ID PROMPT, and the way
// that is guaranteed is structural rather than observational: `assess()` is
// handed two READ doors (`read`, `readBytes`) and nothing else. A prompt needs
// an exec port or a LocalAuthentication binding; neither is in this file's
// signature, so no run of it can produce one (manifesto §13, noninterference --
// influence only through declared channels). "It did not prompt when I ran it"
// would be a weak claim, because a cached sudo timestamp produces exactly that
// observation on a machine where the check DOES prompt. So that claim is not the
// one being made.
//
// WHY THIS FILE EXISTS. `pam_tid.so` on this fleet is configured by a direct edit
// to `/etc/pam.d/sudo`, which macOS REPLACES on OS updates. Apple ships
// `/etc/pam.d/sudo_local.template` precisely so the customisation survives -- its
// own first line reads "local config file which survives system update". So the
// configuration in force today reverts to password-only after some future update,
// silently and with no announcement: a protection that stops applying without
// saying so. `assess()` is the machine that notices.
//
// CHAIN RESOLUTION IS NOT REIMPLEMENTED HERE. `src/Core.TypeScript/pam/auth-chain.ts`
// already resolves a PAM `auth` chain through includes over an injected read door,
// in both OpenPAM and Linux-PAM dialects, and it exists because a copied macOS-only
// parser silently mis-read Debian's `@include` and produced a false attribution.
// This file asks it the chain questions. The few line-level helpers below answer a
// DIFFERENT question -- "what does this one file literally say?" -- which is what
// distinguishes a durable `sudo_local` from a fragile edit to `sudo`, and what
// validates the bytes we ourselves write. That distinction is deliberate.

import { analyzePamAuthChain } from "../../src/Core.TypeScript/pam/auth-chain.ts";

/** A single parsed line of a PAM policy file, as literally written. */
export interface PamLine {
  readonly raw: string;
  readonly active: boolean;
  readonly facility: string;
  readonly control: string;
  readonly module: string;
}

/**
 * Controls that can never turn a working sudo into a broken one.
 *
 * Per `pam.conf(5)`: a failed `sufficient` module falls through and the chain
 * continues; `optional` is ignored either way. Neither can DENY, so the chain's
 * real authenticator (`pam_opendirectory.so`, i.e. your password) stays reachable
 * no matter what this tool writes. `required` and `requisite` CAN deny, which is
 * why this installer never emits them -- and `denyingControlLines` is the check
 * that keeps that true rather than merely intended.
 */
export const NON_DENYING_CONTROLS: readonly string[] = ["optional", "sufficient"];

export type TouchIdStatus =
  /** `sudo_local` carries an active pam_tid and the chain reaches it. Survives OS updates. */
  | "durable"
  /** Touch ID works today, but only via a direct edit to `/etc/pam.d/sudo`, which updates replace. */
  | "fragile"
  /** No effective Touch ID configuration. */
  | "absent"
  /** Not macOS, or a macOS too old for `sudo_local`. Refuse rather than half-apply. */
  | "unsupported";

/**
 * The environment, as DOORS rather than capabilities.
 *
 * `read` and `readBytes` throw on an absent path -- the same contract
 * `analyzePamAuthChain` already relies on, so an unreadable file is UNKNOWN and
 * never silently treated as empty.
 */
export interface TouchIdEnv {
  readonly platform: string;
  readonly arch: string;
  readonly read: (path: string) => string;
  readonly readBytes: (path: string) => Uint8Array;
  readonly pamDir: string;
  /** Absolute path of the system pam_tid module. */
  readonly pamTidModulePath: string;
  /** Absolute paths where a Homebrew pam_reattach may live, most-preferred first. */
  readonly reattachCandidates: readonly string[];
  /**
   * Whether `tools/setup/manifests/brew` DECLARES pam-reattach.
   *
   * This is what turns the manifest row from a hope into a check. Declared-and-
   * missing is install drift and goes RED; undeclared-and-missing is only an
   * observation, because nothing promised it would be there.
   */
  readonly reattachDeclared: boolean;
  readonly insideMultiplexer: boolean;
}

export interface Finding {
  readonly severity: "error" | "warn" | "info";
  readonly message: string;
}

export interface Assessment {
  readonly status: TouchIdStatus;
  /** True when the durable configuration is NOT in place. */
  readonly red: boolean;
  readonly findings: readonly Finding[];
  /** Resolved pam_reattach module path, or null when none is installed. */
  readonly reattachModulePath: string | null;
  /** True when /etc/pam.d/sudo carries `auth include sudo_local`. */
  readonly sudoLocalIncluded: boolean;
  /** True when /etc/pam.d/sudo_local exists at all. */
  readonly sudoLocalPresent: boolean;
  /**
   * True when a Touch ID prompt can actually appear inside tmux/screen -- i.e.
   * pam_reattach is installed AND wired into sudo_local ahead of pam_tid.
   *
   * Reported separately from `status` on purpose. A machine can be perfectly
   * durable and still have Touch ID do nothing in the shell agent work runs in,
   * and a verdict that collapses those two into one word tells half the truth.
   */
  readonly multiplexerReady: boolean;
}

const WS = /\s+/u;

/** Parse a PAM file's literal lines. Total: never throws; unparseable lines come back inactive. */
export function parsePamFile(content: string): readonly PamLine[] {
  return content.split("\n").map((raw) => {
    const stripped = raw.trim();
    if (stripped.length === 0 || stripped.startsWith("#")) {
      return { raw, active: false, facility: "", control: "", module: "" };
    }
    const f = stripped.split(WS);
    if (f.length < 3) return { raw, active: false, facility: f[0] ?? "", control: f[1] ?? "", module: "" };
    return { raw, active: true, facility: f[0] ?? "", control: f[1] ?? "", module: f[2] ?? "" };
  });
}

/** Basename of a module reference, so `pam_tid.so` and `/usr/lib/pam/pam_tid.so` compare equal. */
export function moduleBasename(module: string): string {
  const slash = module.lastIndexOf("/");
  return slash === -1 ? module : module.slice(slash + 1);
}

/** True when an active `auth` line in THIS FILE loads the named module. */
export function hasActiveAuthModule(content: string | null, basename: string): boolean {
  if (content === null) return false;
  return parsePamFile(content).some((l) => l.active && l.facility === "auth" && moduleBasename(l.module) === basename);
}

/**
 * True when `/etc/pam.d/sudo` includes `sudo_local`.
 *
 * The load-bearing precondition: without the include, a perfectly written
 * `sudo_local` is inert. Apple added it in macOS 14 (Sonoma).
 */
export function includesSudoLocal(sudoContent: string | null): boolean {
  if (sudoContent === null) return false;
  return parsePamFile(sudoContent).some(
    (l) => l.active && l.control === "include" && moduleBasename(l.module) === "sudo_local",
  );
}

/** Every active line whose control could DENY authentication. Must always be empty in our file. */
export function denyingControlLines(content: string): readonly PamLine[] {
  return parsePamFile(content).filter((l) => l.active && !NON_DENYING_CONTROLS.includes(l.control));
}

/**
 * Does `tools/setup/manifests/brew` declare pam-reattach?
 *
 * Parsed the SAME way tools/setup/macos.sh parses it -- strip an inline `#`
 * comment, trim, take the first whitespace-delimited field (which drops any
 * `tier=` token). Reading the manifest with a different parser than the
 * installer uses would be two views of one fact that can silently disagree.
 */
export function brewManifestDeclares(manifestText: string, formula: string): boolean {
  return manifestText.split("\n").some((line) => {
    // indexOf/slice rather than /#.*$/ -- a greedy `.*$` backtracks, and a
    // linter that flags super-linear regexes is right to: this parses a file
    // whose length is not bounded by anything we control.
    const hash = line.indexOf("#");
    const withoutComment = (hash === -1 ? line : line.slice(0, hash)).trim();
    if (withoutComment.length === 0) return false;
    return withoutComment.split(WS)[0] === formula;
  });
}

export const MANAGED_MARKER = "# Managed by Zeta: tools/setup/touchid-sudo.ts";

/**
 * Render the canonical `sudo_local`. Pure and deterministic -- byte-identical for
 * identical inputs, which is exactly what makes `--apply` idempotent: the
 * installer compares this string to the file and writes nothing when they match.
 *
 * `pam_reattach` MUST precede `pam_tid`: it re-attaches the process to the user's
 * GUI session so the Touch ID prompt can appear at all inside tmux or screen, and
 * it has to do so before pam_tid runs. It is `optional`, so a missing or broken
 * module changes nothing about whether you can authenticate.
 */
export function renderSudoLocal(opts: { readonly reattachModulePath?: string | null }): string {
  const lines: string[] = [
    MANAGED_MARKER,
    "# Touch ID for sudo. THIS file survives macOS updates; /etc/pam.d/sudo does not.",
    "# Re-run `bun tools/setup/touchid-sudo.ts --apply` to restore; --verify to check.",
    "# Every control here is optional/sufficient, so no line in this file can deny",
    "# authentication -- the password path stays reachable regardless.",
  ];
  if (opts.reattachModulePath !== null && opts.reattachModulePath !== undefined) {
    lines.push(
      "# pam_reattach must come first: it re-attaches to the GUI session so the",
      "# Touch ID prompt can appear inside tmux/screen.",
      `auth       optional       ${opts.reattachModulePath}`,
    );
  }
  lines.push("auth       sufficient     pam_tid.so", "");
  return lines.join("\n");
}

function tryRead(env: TouchIdEnv, path: string): string | null {
  try {
    return env.read(path);
  } catch {
    return null;
  }
}

function pamTidConfiguredIn(env: TouchIdEnv, service: string): boolean {
  return analyzePamAuthChain(env.read, {
    service,
    targetModule: "pam_tid.so",
    syntax: "openpam",
    pamDir: env.pamDir,
  }).targetConfigured;
}

function unsupported(message: string, red: boolean): Assessment {
  return {
    status: "unsupported",
    red,
    findings: [{ severity: red ? "error" : "info", message }],
    reattachModulePath: null,
    sudoLocalIncluded: false,
    sudoLocalPresent: false,
    multiplexerReady: false,
  };
}

interface StatusInputs {
  readonly durableTid: boolean;
  readonly directTid: boolean;
  readonly effectiveTid: boolean;
  readonly included: boolean;
  readonly pamTidModuleExists: boolean;
}

/** The status decision, lifted out of `assess` so each half stays readable. */
function classifyStatus(i: StatusInputs): TouchIdStatus {
  if (i.durableTid && i.included && i.pamTidModuleExists) return "durable";
  if (i.directTid || (i.effectiveTid && !i.durableTid)) return "fragile";
  return "absent";
}

function statusFinding(status: TouchIdStatus, sudoLocalPresent: boolean): Finding {
  if (status === "durable") {
    return {
      severity: "info",
      message: "Touch ID for sudo is configured in /etc/pam.d/sudo_local, which survives macOS updates.",
    };
  }
  if (status === "fragile") {
    return {
      severity: "error",
      message:
        "Touch ID works right now ONLY because pam_tid.so was added directly to /etc/pam.d/sudo. macOS replaces that file on OS updates, so this reverts to password-only silently. Fix: bun tools/setup/touchid-sudo.ts --apply",
    };
  }
  return sudoLocalPresent
    ? {
        severity: "error",
        message:
          "/etc/pam.d/sudo_local exists but has no active pam_tid.so line. This is the shape a silent OS-update revert leaves behind, or a hand-edit that commented the line out.",
      }
    : {
        severity: "error",
        message: "Touch ID for sudo is not configured. Fix: bun tools/setup/touchid-sudo.ts --apply",
      };
}

/** Classify the machine. Pure over the injected doors. This is the verifier's whole brain. */
export function assess(env: TouchIdEnv): Assessment {
  if (env.platform !== "darwin") {
    return unsupported(
      `Touch ID sudo is macOS-only; this is ${env.platform}. PAM policy files are not portable and this tool does not pretend otherwise.`,
      false,
    );
  }

  const sudoContent = tryRead(env, `${env.pamDir}/sudo`);
  if (sudoContent === null) return unsupported(`${env.pamDir}/sudo could not be read.`, true);

  const included = includesSudoLocal(sudoContent);
  const templateExists = tryRead(env, `${env.pamDir}/sudo_local.template`) !== null;
  if (!included && !templateExists) {
    return unsupported(
      `${env.pamDir}/sudo has no \`auth include sudo_local\` and no sudo_local.template exists. This macOS predates sudo_local (macOS 14 Sonoma). Writing the file would be inert, so this tool refuses rather than half-applying it.`,
      true,
    );
  }

  const sudoLocalContent = tryRead(env, `${env.pamDir}/sudo_local`);
  const findings: Finding[] = [];
  if (!included) {
    findings.push({
      severity: "error",
      message: `${env.pamDir}/sudo does not include sudo_local, so sudo_local is INERT even if correct.`,
    });
  }

  // The chain questions go to the shared resolver; the file questions do not.
  const durableTid = pamTidConfiguredIn(env, "sudo_local");
  const effectiveTid = pamTidConfiguredIn(env, "sudo");
  const directTid = hasActiveAuthModule(sudoContent, "pam_tid.so");

  let pamTidModuleExists = true;
  try {
    env.readBytes(env.pamTidModulePath);
  } catch {
    pamTidModuleExists = false;
    findings.push({
      severity: "error",
      message: `${env.pamTidModulePath} is missing; this machine cannot do Touch ID sudo at all.`,
    });
  }

  const status = classifyStatus({ durableTid, directTid, effectiveTid, included, pamTidModuleExists });
  findings.push(statusFinding(status, sudoLocalContent !== null));

  if (status === "durable" && directTid) {
    findings.push({
      severity: "warn",
      message:
        "A redundant pam_tid.so line also sits in /etc/pam.d/sudo. Harmless (sufficient, and the durable copy covers it) and it disappears at the next OS update. Left alone deliberately: this tool never edits /etc/pam.d/sudo.",
    });
  }

  const reattachModulePath = resolveReattach(env);
  const multiplexerReady = addReattachFindings(env, findings, status, reattachModulePath, sudoLocalContent);

  // RED is not only about sudo_local. A declared-and-missing pam_reattach means
  // the gate does nothing in tmux, which is a real failure of the property the
  // operator believes they have -- so it fails the check rather than warning.
  const declaredButMissing = env.reattachDeclared && reattachModulePath === null;

  return {
    status,
    red: status !== "durable" || declaredButMissing,
    findings,
    reattachModulePath,
    sudoLocalIncluded: included,
    sudoLocalPresent: sudoLocalContent !== null,
    multiplexerReady,
  };
}

function resolveReattach(env: TouchIdEnv): string | null {
  for (const p of env.reattachCandidates) {
    try {
      env.readBytes(p);
      return p;
    } catch {
      /* not installed here; try the next candidate */
    }
  }
  return null;
}

function addReattachFindings(
  env: TouchIdEnv,
  findings: Finding[],
  status: TouchIdStatus,
  reattachModulePath: string | null,
  sudoLocalContent: string | null,
): boolean {
  if (reattachModulePath === null) {
    // DECLARED-AND-MISSING IS DRIFT, and drift is an error rather than a note.
    // tools/setup/manifests/brew declares pam-reattach, so the host is supposed
    // to have it; not having it means the declarative setup has not been run or
    // has drifted, and Touch ID sudo is silently inert in tmux/screen -- the
    // shell agent work actually runs in. Certifying sudo_local as durable while
    // saying nothing about that is telling half the truth.
    findings.push(
      env.reattachDeclared
        ? {
            severity: "error",
            message:
              "pam_reattach is DECLARED in tools/setup/manifests/brew and is NOT installed. Touch ID cannot prompt inside tmux/screen without it -- sudo silently falls back to the password there. Fix by re-running the declarative setup: tools/setup/install.sh",
          }
        : {
            severity: env.insideMultiplexer ? "warn" : "info",
            message:
              "pam_reattach is not installed and not declared, so the Touch ID prompt will not appear inside tmux or screen.",
          },
    );
    return false;
  }

  let archs: readonly string[];
  try {
    archs = machoArchs(env.readBytes(reattachModulePath));
  } catch {
    archs = [];
  }
  if (archs.length > 0 && !archs.includes(env.arch)) {
    findings.push({
      severity: "warn",
      message: `pam_reattach at ${reattachModulePath} is built for [${archs.join(", ")}] but this machine is ${env.arch}; PAM cannot load it. It is optional, so sudo still works -- but tmux gets no Touch ID prompt.`,
    });
    return false;
  }

  if (!hasActiveAuthModule(sudoLocalContent, "pam_reattach.so")) {
    findings.push({
      severity: status === "durable" ? "warn" : "info",
      message: `pam_reattach is installed at ${reattachModulePath} but is not referenced in sudo_local. Re-run --apply to wire it.`,
    });
    return false;
  }

  findings.push({
    severity: "info",
    message: `pam_reattach wired from ${reattachModulePath}; the Touch ID prompt works inside tmux/screen.`,
  });
  return true;
}

// ---------------------------------------------------------------------------
// Mach-O architecture, parsed from bytes.
// This exists because "pam_reattach.so is present" is not the same claim as
// "PAM can load it": an x86_64 module on an arm64 Mac is present and unusable.
// ---------------------------------------------------------------------------

const CPU_TYPE_X86_64 = 0x01000007;
const CPU_TYPE_ARM64 = 0x0100000c;

function archName(cpuType: number): string | null {
  if (cpuType === CPU_TYPE_X86_64) return "x64";
  if (cpuType === CPU_TYPE_ARM64) return "arm64";
  return null;
}

/**
 * Architectures present in a Mach-O header, named with `process.arch` spelling so
 * the comparison is direct. Handles thin (LE magic) and universal/fat (BE magic).
 * Returns [] for anything unrecognised -- an unknown answer stays unknown rather
 * than becoming a false verdict.
 */
function fatArchs(view: DataView, header: Uint8Array, magic: number): readonly string[] {
  const count = view.getUint32(4, false);
  if (count > 32) return [];
  const entrySize = magic === 0xcafebabf ? 32 : 20;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const off = 8 + i * entrySize;
    if (off + 4 > header.length) break;
    const a = archName(view.getUint32(off, false));
    if (a !== null && !out.includes(a)) out.push(a);
  }
  return out;
}

export function machoArchs(header: Uint8Array): readonly string[] {
  if (header.length < 8) return [];
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const magic = view.getUint32(0, false);

  // Thin Mach-O: the magic reads little-endian (0xfeedfacf / 0xfeedface).
  if (magic === 0xcffaedfe || magic === 0xcefaedfe) {
    const a = archName(view.getUint32(4, true));
    return a === null ? [] : [a];
  }
  // Universal ("fat") binary: big-endian magic, then a big-endian arch count.
  if (magic === 0xcafebabe || magic === 0xcafebabf) return fatArchs(view, header, magic);
  return [];
}
