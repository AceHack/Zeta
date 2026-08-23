#!/usr/bin/env bun
/**
 * tools/setup/op-token-setup.ts — securely capture a 1Password SERVICE-ACCOUNT
 * token (`ops_…`) into the macOS Keychain. The TypeScript retirement of
 * `tools/setup/op-token-setup.sh` (081M00VNHB3087G0R001WHTKTH, the shell
 * deprecation umbrella; sequenced #3 in `docs/SHELL-DEPRECATION-SEQUENCE.md`).
 *
 * Aaron 2026-06-21: "make some reusable workflow/blueprint … pop up a secure
 * window for me to type it in and you do everything."
 *
 * WHY A `.ts` AND NOT A `.sh` — OS CLOSURE, NOT LANGUAGE PREFERENCE
 * ------------------------------------------------------------------------
 * Aaron 2026-08-22: *"rewrite .sh files into .ts files allows the developer to
 * have one interface, the same interface for every operating system. One of the
 * overarching goals of Zeta is to completely close over the OS, like an
 * interpreter closing over a compiler, and make every OS look the same."*
 *
 * A `.sh` file IS an OS-specific interface: invoking it already commits the
 * caller to a POSIX shell. The `.ts` entry point is the closure layer — one
 * command, one argument grammar, one result shape, on every host.
 *
 * WHAT IS STILL NOT CLOSED HERE, NAMED EXACTLY
 * ------------------------------------------------------------------------
 * The closure is a LAYER, not a completion, and this file closes less than it
 * looks like it does. Three macOS-specific calls remain, all of them behind the
 * injected `OpTokenSetupEffects` door rather than inlined:
 *
 *   1. `osascript` — the native secure dialog. Closing it needs a per-OS secure
 *      prompt port: Windows `CredUIPromptForWindowsCredentials`, Linux
 *      `systemd-ask-password` / a `zenity --password` fallback.
 *   2. `security -i` — the Keychain write. Closing it needs the keystore port
 *      already scoped in `081KVNRSGVR08QG0R003R3RNJX` (libsecret / Credential
 *      Manager) and the in-process `SecItemAdd` re-store from
 *      `081M00VN3FX087G0R0006ZGRWG`.
 *   3. `pbpaste` — clipboard read. `wl-paste` / `xclip` / `Get-Clipboard`.
 *
 * So on Linux and Windows this command does not degrade — it REFUSES, loudly
 * and specifically, naming the port that is missing. A setup step that quietly
 * does nothing is the vacuity class; a refusal that names its own gap is not.
 *
 * SECURITY MODEL — every property the `.sh` header claimed, preserved
 * ------------------------------------------------------------------------
 *   - Captured via a native macOS secure dialog (hidden answer) or the
 *     clipboard. It NEVER passes through this process's stdout/stderr, terminal
 *     echo, or an agent transcript.
 *   - At REST it is ENCRYPTED in the login Keychain, not a plaintext dotfile.
 *   - It is NOT hoisted into any shell environment. The `.sh` header's sentence
 *     is the whole reason and is preserved verbatim: *"'The env file holds only
 *     the fetch command, not the value' was true and beside the point: after the
 *     fetch runs, the VALUE is in the environment, and an environment variable
 *     crosses `exec` regardless of the child's code identity. A signature, a
 *     keychain ACL, an IMA appraisal and a TPM seal each bind a secret to a
 *     CALLER; an inherited variable has already escaped the question of who the
 *     caller is."* Removed 2026-08-14 (081M00VMWTB087G0R0026XSWT6); §13
 *     noninterference.
 *   - Read at POINT OF USE via `src/Core.TypeScript/secrets/credential.ts`:
 *       withCredential("zeta-op-service-account", async (token, use) => …)
 *
 * AND ONE PROPERTY THE `.sh` DID NOT HAVE
 * ------------------------------------------------------------------------
 *   - The token never reaches an ARGV. The shell ran
 *     `security add-generic-password … -w "$TOKEN"`, putting the token in `ps`
 *     output for the life of the call. That was measured, not suspected —
 *     `docs/SHELL-DEPRECATION-SEQUENCE.md` scores the line `argv-secret@83` and
 *     tells any conversion to fix it. Here the value crosses on stdin.
 *
 * WHAT THE CONVERSION DOES NOT BUY. It does not remove `osascript` or
 * `security`; it moves who spawns them. This is still macOS-only for those two
 * calls. Saying otherwise would be the vacuity this repo is built against.
 *
 * TEACHING-SHAPED REFUSALS
 * ------------------------------------------------------------------------
 * Aaron 2026-08-22: the CLI should give *"teaching and potential generator
 * function updates in -1 zsets"* rather than *"louder limit erasure"* on errors.
 * Every refusal below states ASSUMED / OBSERVED / BELIEVE-NOW, so the caller
 * learns which belief was wrong rather than only that something failed. The
 * `-1` z-set half — an error emitting a retraction against the prior that
 * produced it — is DESIGNED, NOT BUILT: see the design note and work-item named
 * in the pointers. Registered `toy` per `toy-is-free-metered-must-be-earned`.
 *
 * Usage:
 *   bun tools/setup/op-token-setup.ts               # secure GUI dialog
 *   bun tools/setup/op-token-setup.ts --clipboard   # read from the clipboard
 *   bun tools/setup/op-token-setup.ts --service <name>
 *   bun tools/setup/op-token-setup.ts --check       # presence + length, no write
 *
 * Idempotent: re-running updates the Keychain item in place (`-U`).
 */

import {
  storeGenericPassword,
  probeGenericPassword,
  type KeychainWrite,
} from "../../src/Core.TypeScript/secrets/keychain-macos.ts";

export const DEFAULT_SERVICE = "zeta-op-service-account";
export const SERVICE_ACCOUNT_TOKEN_PREFIX = "ops_";
/** The ambient hoist a previous run of the `.sh` may have left behind. */
export const AMBIENT_HOIST_RELATIVE_PATH = ".config/zeta/secrets-env.sh";

/**
 * A refusal that teaches. `assumed` names the belief the caller was operating
 * on, `observed` the fact that contradicts it, `believeNow` the corrected
 * belief. The failure is not "louder"; it is more INFORMATIVE.
 *
 * None of these fields may be built from secret material — the falsifier in
 * `op-token-setup.test.ts` runs the whole flow with a known token and asserts no
 * emitted byte contains it.
 */
export interface Teaching {
  readonly assumed: string;
  readonly observed: string;
  readonly believeNow: string;
  readonly nextStep?: string;
}

export function renderTeaching(headline: string, t: Teaching): readonly string[] {
  const lines = [
    `✗ ${headline}`,
    `  assumed:     ${t.assumed}`,
    `  observed:    ${t.observed}`,
    `  believe now: ${t.believeNow}`,
  ];
  if (t.nextStep !== undefined) lines.push(`  next:        ${t.nextStep}`);
  return lines;
}

/** A capture attempt. `secret` is present only on success and is never logged. */
export type Capture =
  | { readonly ok: true; readonly secret: string }
  | { readonly ok: false; readonly why: "cancelled" | "empty" | "unavailable"; readonly detail: string };

/**
 * Every OS-specific act this command performs, behind one door (§13
 * noninterference). Tests inject fakes; nothing in a test run reaches a real
 * dialog, a real clipboard, or a real Keychain.
 */
export interface OpTokenSetupEffects {
  readonly platform: string;
  readonly account: string;
  readonly captureFromDialog: (service: string) => Capture;
  readonly captureFromClipboard: () => Capture;
  readonly store: (account: string, service: string, secret: string) => KeychainWrite;
  readonly probe: (service: string) => { readonly present: boolean; readonly length: number };
  readonly removeAmbientHoist: () => { readonly removed: boolean; readonly path: string };
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

export interface Options {
  readonly source: "dialog" | "clipboard";
  readonly service: string;
  readonly check: boolean;
  readonly help: boolean;
  readonly error?: string;
}

export function parseArgs(argv: readonly string[]): Options {
  let source: Options["source"] = "dialog";
  let service = DEFAULT_SERVICE;
  let check = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--clipboard") { source = "clipboard"; continue; }
    if (arg === "--check") { check = true; continue; }
    if (arg === "-h" || arg === "--help") return { source, service, check, help: true };
    if (arg === "--service") {
      const next = argv[i + 1];
      if (next === undefined) return { source, service, check, help: false, error: "--service needs a name" };
      service = next;
      i += 1;
      continue;
    }
    return { source, service, check, help: false, error: `unknown arg: ${String(arg)}` };
  }
  return { source, service, check, help: false };
}

export function usage(): readonly string[] {
  return [
    "Usage:",
    "  bun tools/setup/op-token-setup.ts               # native secure dialog (hidden input)",
    "  bun tools/setup/op-token-setup.ts --clipboard   # read the token from the clipboard",
    "  bun tools/setup/op-token-setup.ts --service <name>",
    "  bun tools/setup/op-token-setup.ts --check       # report presence + length only",
    "",
    "The token goes window/clipboard -> Keychain. It never reaches this process's",
    "stdout, an argv, or any environment variable. macOS only; on other hosts this",
    "refuses and names the missing port rather than doing nothing.",
  ];
}

/** Exit codes, named so a caller can branch on WHY rather than on "nonzero". */
export const EXIT_OK = 0;
export const EXIT_REFUSED = 1;
export const EXIT_USAGE = 2;
export const EXIT_UNSUPPORTED_PLATFORM = 3;

const PORTS_BY_PLATFORM: Readonly<Record<string, string>> = {
  linux: "libsecret (`secret-tool`) + `systemd-ask-password` — 081KVNRSGVR08QG0R003R3RNJX",
  win32: "Credential Manager / DPAPI + `CredUIPromptForWindowsCredentials` — 081KVNRSGVR08QG0R003R3RNJX",
};

/**
 * Each refusal is its own function so the shape stays legible and so a reader can
 * see, per failure, exactly what belief is being corrected. `main` is then a
 * sequence of guarded steps rather than a nest.
 */
function emit(fx: OpTokenSetupEffects, headline: string, t: Teaching): void {
  for (const line of renderTeaching(headline, t)) fx.err(line);
}

function refuseUsage(fx: OpTokenSetupEffects, error: string): number {
  emit(fx, error, {
    assumed: "the flags given name an option this command has",
    observed: "one of them does not",
    believeNow: "the flag set is --clipboard | --service <name> | --check | --help, and nothing else",
    nextStep: "bun tools/setup/op-token-setup.ts --help",
  });
  return EXIT_USAGE;
}

function refusePlatform(fx: OpTokenSetupEffects): number {
  const port = PORTS_BY_PLATFORM[fx.platform] ?? "no keystore port is scoped for this platform yet";
  emit(fx, `op-token-setup cannot run on ${fx.platform}`, {
    assumed: "a TypeScript entry point is already OS-closed, so it runs anywhere",
    observed:
      "the OS closure is a layer, not a completion — the secure-prompt and keystore ports are macOS-only today",
    believeNow: `on ${fx.platform} the missing port is: ${port}`,
    nextStep:
      "On Linux/CI use a GitHub Actions secret (OP_SERVICE_ACCOUNT_TOKEN) consumed in-step via 1password/load-secrets-action — never base64-printed.",
  });
  return EXIT_UNSUPPORTED_PLATFORM;
}

function reportPresence(fx: OpTokenSetupEffects, service: string): number {
  const p = fx.probe(service);
  fx.out(
    p.present
      ? `✓ '${service}' is present in the Keychain (${String(p.length)} bytes; the value is not printed).`
      : `· '${service}' is not in the Keychain.`,
  );
  return p.present ? EXIT_OK : EXIT_REFUSED;
}

function refuseCapture(fx: OpTokenSetupEffects, source: Options["source"], why: string, detail: string): number {
  const fromClipboard = source === "clipboard";
  emit(fx, `nothing captured (${why}) — nothing stored`, {
    assumed: fromClipboard
      ? "the clipboard holds the service-account token"
      : "the secure dialog would return a typed token",
    observed: detail,
    believeNow:
      "the Keychain is unchanged; this command is idempotent, so re-running after copying/typing the token is safe",
    nextStep: fromClipboard
      ? "copy the ops_… token, then re-run with --clipboard"
      : "re-run and paste into the dialog, or use --clipboard",
  });
  return EXIT_REFUSED;
}

function refusePrefix(fx: OpTokenSetupEffects, length: number): number {
  emit(fx, "that is not a service-account token — nothing stored", {
    assumed: `the captured value is a 1Password SERVICE-ACCOUNT token, which begins '${SERVICE_ACCOUNT_TOKEN_PREFIX}'`,
    observed: `the captured value (${String(length)} bytes) does not begin with that prefix`,
    believeNow:
      "a personal-account session token, an item reference, or a stray clipboard value is not interchangeable with a service-account token — `op` will not authenticate with it",
    nextStep: "1Password → Developer → Service Accounts → create/reveal token (it starts ops_)",
  });
  return EXIT_REFUSED;
}

function refuseWrite(fx: OpTokenSetupEffects, service: string, refusal: string, detail: string): number {
  emit(fx, `the Keychain write was refused (${refusal})`, {
    assumed: "a write that does not report an error has stored the value",
    observed: `${detail}. \`security -i\` exits 0 even when it stores nothing, so success here is decided by reading the item back, never by an exit status`,
    believeNow:
      refusal === "write-not-verified"
        ? "the Keychain does not hold what you just typed; treat the item as absent"
        : "the input was rejected before any write was attempted, so the Keychain is unchanged",
    nextStep: `bun tools/setup/op-token-setup.ts --check --service ${service}`,
  });
  return EXIT_REFUSED;
}

function reportStored(fx: OpTokenSetupEffects, service: string, length: number, via: string): void {
  const hoist = fx.removeAmbientHoist();
  if (hoist.removed) {
    fx.out(`✓ removed the ambient hoist ${hoist.path} (it held a fetch command, not a secret).`);
    fx.out("  Already-running shells keep the token in their environment until they exit;");
    fx.out("  open a new shell (or `unset OP_SERVICE_ACCOUNT_TOKEN`) to clear it.");
  }
  fx.out(`✓ token stored ENCRYPTED in the Keychain (service: ${service}, ${String(length)} bytes) — value never printed.`);
  fx.out(`✓ verified by reading it back (${via}); the exit status of \`security -i\` was not trusted.`);
  fx.out("✓ NOT exported into any shell environment, and never on an argv, by design.");
  fx.out("  Read it at point of use:");
  fx.out(`    withCredential("${service}", async (token, use) => …)   // src/Core.TypeScript/secrets/credential.ts`);
  fx.out(`    spawnWithCredential("${service}", "OP_SERVICE_ACCOUNT_TOKEN", ["op", "whoami"])`);
}

export function main(argv: readonly string[], fx: OpTokenSetupEffects): number {
  const opts = parseArgs(argv);
  if (opts.help) {
    for (const line of usage()) fx.out(line);
    return EXIT_OK;
  }
  if (opts.error !== undefined) return refuseUsage(fx, opts.error);
  if (fx.platform !== "darwin") return refusePlatform(fx);
  if (opts.check) return reportPresence(fx, opts.service);

  const capture = opts.source === "clipboard" ? fx.captureFromClipboard() : fx.captureFromDialog(opts.service);
  if (!capture.ok) return refuseCapture(fx, opts.source, capture.why, capture.detail);
  if (!capture.secret.startsWith(SERVICE_ACCOUNT_TOKEN_PREFIX)) return refusePrefix(fx, capture.secret.length);

  const write = fx.store(fx.account, opts.service, capture.secret);
  if (!write.ok) return refuseWrite(fx, opts.service, write.refusal, write.detail);

  reportStored(fx, opts.service, write.length, write.via);
  return EXIT_OK;
}

// ── the real effects: every OS-specific call in this file lives below ────────

function runCapture(command: string, args: readonly string[], stdin?: string): Capture {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { spawnSync } = require("node:child_process") as typeof import("node:child_process");
  const r = spawnSync(command, [...args], { input: stdin ?? "", encoding: "utf8", timeout: 300_000 });
  if (r.error !== undefined) {
    return { ok: false, why: "unavailable", detail: `${command} could not be started: ${r.error.message}` };
  }
  const out = (typeof r.stdout === "string" ? r.stdout : "").replace(/\r?\n$/, "");
  if (r.status !== 0) {
    const stderr = (typeof r.stderr === "string" ? r.stderr : "").trim();
    const cancelled = /User canceled|user cancelled|-128/i.test(stderr);
    return {
      ok: false,
      why: cancelled ? "cancelled" : "unavailable",
      detail: cancelled ? `${command} reported the dialog was cancelled` : `${command} exited ${String(r.status)}`,
    };
  }
  if (out.length === 0) return { ok: false, why: "empty", detail: `${command} returned nothing` };
  return { ok: true, secret: out };
}

const DIALOG_PROMPT =
  "Paste your 1Password service-account token (ops_…). It goes straight to the macOS Keychain — never the terminal or the agent.";

/** The AppleScript is built from constants and the validated service name only. */
export function dialogScript(service: string): string {
  const safeTitle = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(service) ? service : "zeta";
  return `text returned of (display dialog "${DIALOG_PROMPT}" default answer "" with hidden answer buttons {"Cancel", "Store"} default button "Store" with title "Zeta — store ${safeTitle}")`;
}

export function realEffects(): OpTokenSetupEffects {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { rmSync, existsSync } = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { homedir, userInfo } = require("node:os") as typeof import("node:os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require("node:path") as typeof import("node:path");

  return {
    platform: process.platform,
    account: process.env.USER ?? userInfo().username,
    // `osascript -` reads the SCRIPT from stdin; the token comes back on the
    // child's stdout into this process and goes no further.
    captureFromDialog: (service) => runCapture("osascript", ["-"], dialogScript(service)),
    captureFromClipboard: () => runCapture("pbpaste", []),
    store: (account, service, secret) => storeGenericPassword(account, service, secret),
    probe: (service) => {
      const p = probeGenericPassword(service);
      return { present: p.present, length: p.length };
    },
    removeAmbientHoist: () => {
      const path = join(homedir(), AMBIENT_HOIST_RELATIVE_PATH);
      if (!existsSync(path)) return { removed: false, path };
      rmSync(path, { force: true });
      return { removed: true, path };
    },
    out: (line) => { process.stdout.write(`${line}\n`); },
    err: (line) => { process.stderr.write(`${line}\n`); },
  };
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2), realEffects()));
}
