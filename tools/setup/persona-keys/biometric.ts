// Zeta SHARED biometric-approval gate — the ONE physical-presence approval primitive that
// every sensitive key-onboarding op runs through (workitem 081KVM1TK3Z08QG0R0002959G6
// §"agent-run, operator-approved"). Aaron (2026-06-21): *"nothing is operator run, only
// operator approved with hello/biometrics … i'll have you run what you need to for setup."*
//
// The AGENT executes every step (keygen / sign / publish); the HUMAN's Touch ID / Windows
// Hello is the AUTHORIZATION at each sensitive gate. This module is the lift-out of the
// biometric primitive that publish.ts (#8859) originally owned — extracted here so ca.ts,
// machine.ts, and publish.ts share ONE gate, not three copies of the Touch-ID logic.
//
// SECURITY INVARIANTS (security-class — honesty over green):
//  1. FAIL-CLOSED — the gate returns `ok:true` ONLY when an operator approval was
//     established. Absent approval (no pam_tid / declined / unsupported platform / error)
//     ⇒ `ok:false`. A caller MUST abort its sensitive action on `ok:false`; this module
//     never performs the sensitive action itself — it only reports approval.
//  1b. ATTRIBUTION IS SEPARATE FROM APPROVAL (081M06DSQ0Q087G0R000H91391). `ok:true` says
//     an approval happened; `factor` says what it was. On a stock macOS sudo stack the two
//     are NOT the same fact — a fingerprint, a smart-card PIN and a typed password are
//     indistinguishable through `sudo`'s exit status — so `factor` is `unattributed` there
//     and `claimsBiometric()` is false. A caller whose argument needs the biometric
//     SPECIFICALLY gates on `claimsBiometric()`, not on `ok` and not on `platform`.
//  2. NEVER carries a secret — a `BiometricResult` has no key/seed bytes; it is approval-only.
//  3. NONINTERFERENCE (manifesto §13) — the biometric prompt enters a caller ONLY through an
//     injected `biometricAuth(prompt)` door. Tests inject a FAKE (no real prompt); the CLI
//     injects `realBiometric()`. `--dry-run` callers must not call the door at all.
//
// Anchors (Beacon): Touch ID PAM (`pam_tid.so`) biometric sudo — Apple PAM / the repo's
// biometric-sudo ADR (docs/DECISIONS/2026-05-29-biometric-sudo-elevation-via-touch-id-pam.md)
// + zflash's Touch-ID-gated dd. Windows Hello programmatic consent —
// `Windows.Security.Credentials.UI.UserConsentVerifier.RequestVerificationAsync` (Microsoft
// WinRT). Physical-presence consent as an action floor — FIDO/WebAuthn user-verification.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { platform as osPlatform } from "node:os";
import { analyzePamAuthChain } from "../../../src/Core.TypeScript/pam/auth-chain.ts";
import { resolveElevator } from "../../../src/Core.TypeScript/privilege/elevator.ts";

/** The biometric platforms we know how to gate on. `unsupported` ⇒ fail-closed. */
export type BiometricPlatform = "macos-touchid" | "windows-hello" | "unsupported";

/**
 * What the gate actually ESTABLISHED — as distinct from `platform`, which names the
 * mechanism ATTEMPTED. The two were conflated (081M06DSQ0Q087G0R000H91391): a result
 * labelled `macos-touchid` meant "we tried the Touch-ID-shaped path", and every readout
 * printed it as if it meant "a fingerprint was presented".
 *
 * This is the `Evidence` / `supportsClaim` split from `src/Core/DerivationProtocol.fs`
 * carried into TypeScript: `unattributed` is the `AssertedOnly` member — real, useful,
 * and NOT admissible as evidence that a biometric happened.
 */
export type ApprovalFactor =
  /** A biometric was the ONLY factor that could have satisfied the gate. */
  | "biometric"
  /** An operator authentication succeeded and the host cannot say WHICH factor did it —
   *  on a stock macOS sudo stack a fingerprint, a smart-card PIN and a typed account
   *  password are indistinguishable at this seam. A real approval; not a biometric one. */
  | "unattributed"
  /** Nothing was established. */
  | "none";

/** The outcome of a biometric confirmation attempt — never carries a secret. */
export interface BiometricResult {
  /** True ONLY if an operator approval was established. NOTE: `ok` alone does NOT say the
   *  approval was biometric — read `factor` / `claimsBiometric()` for that. */
  readonly ok: boolean;
  /** Which mechanism was ATTEMPTED (for the readout + honest "unsupported" reporting).
   *  Never read this as the factor that succeeded — that is `factor`. */
  readonly platform: BiometricPlatform;
  /** What was actually ESTABLISHED. Absent ⇒ undeclared, and an undeclared factor is
   *  read as `unattributed`, never rounded up to `biometric` (see `establishedFactor`). */
  readonly factor?: ApprovalFactor;
  /** Why: present when ok === false (unsupported platform, declined, timeout, error), and
   *  ALSO present on an `ok:true` result whose factor is weaker than the mechanism
   *  attempted — the caller is entitled to know the approval was not attributable. */
  readonly reason?: string;
}

/**
 * The factor a result may be read as having established. FAIL-SAFE by construction: an
 * `ok:true` result that declares no factor reads as `unattributed`, because an undeclared
 * factor is exactly the state this bug was — a claim nobody measured. Only an explicit
 * `factor: "biometric"` lifts it, and nothing lifts an `ok:false`.
 */
export function establishedFactor(r: BiometricResult): ApprovalFactor {
  if (r.ok !== true) return "none";
  return r.factor === "biometric" ? "biometric" : "unattributed";
}

/**
 * Whether a result may be cited as "the operator confirmed with a BIOMETRIC". This is the
 * `supportsClaim` analogue: `ok:true` is not enough, and neither is
 * `platform: "macos-touchid"`. A caller whose security argument rests on the biometric
 * specifically (rather than on "an operator authenticated") must gate on THIS.
 */
export function claimsBiometric(r: BiometricResult): boolean {
  return establishedFactor(r) === "biometric";
}

/** The injectable biometric door — the ONLY channel for the physical-presence prompt
 *  (noninterference §13). A sensitive op takes this and MUST get `ok:true` before acting.
 *  Tests inject a fake; the CLI injects `realBiometric()`; `--dry-run` never calls it. */
export type BiometricAuth = (prompt: string) => Promise<BiometricResult>;

/**
 * Require an operator approval through the SHARED gate — the one helper every sensitive op
 * calls right before its real action. FAIL-CLOSED by construction: if NO door was injected
 * (`auth === undefined`), this returns `{ ok:false, platform:"unsupported" }` — so a caller
 * that forgot to wire the gate aborts rather than silently acting. Otherwise it delegates to
 * the injected door. NEVER carries a secret.
 */
export async function requireBiometric(
  auth: BiometricAuth | undefined,
  prompt: string,
): Promise<BiometricResult> {
  if (auth === undefined) {
    return {
      ok: false,
      platform: "unsupported",
      reason:
        "no biometric approval door was provided — fail-closed (the sensitive action is " +
        "agent-run but operator-APPROVED; wire the biometric gate before running it).",
    };
  }
  return auth(prompt);
}

/** The outcome of a session-approval factory: the wrapped one-prompt door + a probe that
 *  reports whether the underlying door has been called (the session already decided) and
 *  what it decided. Lets a top-level command prove "the human gate fired exactly once". */
export interface SessionGate {
  /** The wrapped door — prompts the underlying door AT MOST ONCE, then replays its outcome.
   *  Pass this as the `biometricAuth` to every sub-op so they share the ONE approval. */
  readonly door: BiometricAuth;
  /** How many times the UNDERLYING (human-facing) door has been invoked. One-fingerprint
   *  ⇒ this is 0 (nothing gated ran) or 1 (the single up-front approval). NEVER > 1. */
  readonly underlyingCalls: () => number;
  /** The cached session decision, or undefined if the underlying door was never called. */
  readonly decision: () => BiometricResult | undefined;
}

/**
 * SESSION APPROVAL — the one-fingerprint primitive. Wrap an underlying door so the human is
 * prompted AT MOST ONCE: the first `door(prompt)` call delegates to the underlying door and
 * caches its outcome; every subsequent call REPLAYS that cached outcome WITHOUT re-prompting.
 * A top-level command does ONE `requireBiometric(session.door, …)` up front, then passes
 * `session.door` to every sub-op — so the whole sequence rides on ONE physical approval.
 *
 * FAIL-CLOSED + NO BYPASS (security-class):
 *  - The session is NOT zero-approval: if NOTHING ever calls the door, no gated op runs (each
 *    sub-op still calls `requireBiometric` and aborts on the absent/declined result).
 *  - A DECLINED first approval POISONS the session: the cached `ok:false` is replayed to every
 *    later call, so a sub-op can NEVER "retry past" a refusal. One refusal ⇒ nothing runs.
 *  - The cache keys ONLY on having-been-called, never on the prompt text — a later sub-op
 *    cannot smuggle a different prompt to force a fresh approval (that would be re-prompting).
 *  - It NEVER carries a secret (a BiometricResult is approval-only).
 *
 * This is the strange-loop close: the gate completes its approval once, then every later
 * completion is caught by (folded back into) that one fixed-point decision.
 */
export function sessionBiometric(underlying: BiometricAuth | undefined): SessionGate {
  let calls = 0;
  let cached: BiometricResult | undefined;
  const door: BiometricAuth = async (prompt: string): Promise<BiometricResult> => {
    if (cached !== undefined) return cached; // replay the ONE decision — no re-prompt
    calls += 1;
    cached = await requireBiometric(underlying, prompt); // fail-closed if underlying is undefined
    return cached;
  };
  return {
    door,
    underlyingCalls: () => calls,
    decision: () => cached,
  };
}

/** Detect the biometric platform for the current host. macOS = Touch ID; Windows =
 *  Windows Hello (seam); everything else = unsupported (fail-closed). */
export function detectBiometricPlatform(plat: string = osPlatform()): BiometricPlatform {
  if (plat === "darwin") return "macos-touchid";
  if (plat === "win32") return "windows-hello";
  return "unsupported";
}

// ── The sudo PAM chain — what `sudo` exiting 0 does and does not tell us ─────────────────
//
// Anchored to `man pam.conf(5)` on macOS 26.5 (OpenPAM), quoted because the whole
// attribution question turns on this one sentence:
//
//   sufficient — "If this module succeeds, the chain is broken and the result is success.
//                 If it fails, THE REST OF THE CHAIN STILL RUNS, but the final result will
//                 be failure unless a later module succeeds."
//
// So on the stock macOS stack —
//     auth sufficient pam_tid.so / auth include sudo_local /
//     auth sufficient pam_smartcard.so / auth required pam_opendirectory.so
// — declining Touch ID does not end the transaction: it falls through to pam_smartcard
// (per `man pam_smartcard(8)`, satisfied by an appropriate card in an attached reader,
// unlocked with its PIN) and then to pam_opendirectory (the account password). `sudo`
// reports only its own exit status; it never names the module that satisfied PAM.
//
// The sharpest instance, and the reason this is not academic: the FROST hardware lane is
// precisely the flow in which a PIV token is plugged into the machine. The token being
// provisioned could satisfy the gate that is supposed to prove a finger was on a sensor.

/** One `auth` entry of a resolved PAM chain, as `"<control> <module>"`. */
export interface SudoAuthChainAnalysis {
  /** `auth sufficient pam_tid.so` is present in the resolved chain. */
  readonly touchIdConfigured: boolean;
  /** Every OTHER `auth` entry in the resolved chain — each one a module that could have
   *  satisfied the transaction instead of pam_tid, and therefore each one a reason the
   *  success cannot be attributed to the biometric. */
  readonly competingEntries: readonly string[];
  /** `auth include <service>` targets that could not be read. An unreadable chain is an
   *  UNKNOWN chain, and unknown is never treated as empty (fail-closed on attribution). */
  readonly unresolvedIncludes: readonly string[];
  /** True ONLY when pam_tid is configured and nothing else in the chain could have
   *  satisfied it. This — not `touchIdConfigured` — is what licenses the word "biometric". */
  readonly touchIdIsOnlySatisfier: boolean;
}

/**
 * Parse the `auth` chain of a PAM service, resolving `include` entries, and report whether
 * `pam_tid.so` is the only thing in it that could have satisfied a transaction.
 *
 * DELIBERATELY CONSERVATIVE: every non-pam_tid `auth` entry counts as a competing
 * satisfier regardless of its control flag. `pam_deny.so` presumably cannot satisfy
 * anything, but macOS ships no man page for it on this host, so treating it as harmless
 * would be an inference and this module's entire defect was an inference. Over-counting
 * costs an honest `unattributed`; under-counting costs a false `biometric`.
 *
 * `read` is the injected door (§13 noninterference) — it throws when a file is absent, so
 * a test can describe any host's stack without touching /etc.
 */
export function analyzeSudoAuthChain(
  read: (path: string) => string,
  // zeta-elevator-not-argv: a PAM service name (the basename under /etc/pam.d), never a
  // program to spawn. The program this module spawns is resolved by `resolveElevator`.
  service = "sudo",
): SudoAuthChainAnalysis {
  const analysis = analyzePamAuthChain(read, {
    service,
    targetModule: "pam_tid.so",
    // macOS ships OpenPAM: `auth include <service>` only. Reading this host's files with
    // the Linux dialect would honour `@include`/`substack` forms OpenPAM does not define.
    syntax: "openpam",
  });
  return {
    touchIdConfigured: analysis.targetConfigured,
    competingEntries: analysis.competingEntries,
    unresolvedIncludes: analysis.unresolvedIncludes,
    touchIdIsOnlySatisfier: analysis.targetIsOnlySatisfier,
  };
}

/** The elevator this gate will spawn — an absolute, structurally-verified path, or a
 *  refusal carrying the resolver's reason. Injectable so a test can describe a host with a
 *  shimmed / missing / non-setuid elevator without needing one. */
export type ElevatorGate =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly reason: string };

/** The ONLY door through which the macOS gate touches the outside world (§13
 *  noninterference) — so a test can describe a host's PAM stack and sudo outcome and get a
 *  deterministic result, with no real `sudo` and no real fingerprint. */
export interface SudoGateEffects {
  /** Read a file; THROWS when it is absent (an absent policy is an unknown chain). */
  readonly readFile: (path: string) => string;
  /** WHERE the elevator was resolved to, or why it could not be. Checked FIRST, before
   *  anything is spawned — an elevator this process cannot vouch for is not one whose
   *  exit status may be read as an operator approval. */
  readonly elevator: () => ElevatorGate;
  /** Invalidate the cached sudo timestamp so a fresh confirmation is required. */
  readonly invalidateTimestamp: () => void;
  /** Run the no-op sudo transaction; returns its exit status (null on signal). */
  readonly authenticate: () => number | null;
  /** Write the operator-facing prompt line. */
  readonly notify: (line: string) => void;
}

/** The real host — the only place in this module that runs the elevator or reads /etc.
 *
 *  THE ELEVATOR IS RESOLVED ONCE, BY ABSOLUTE PATH, AND THE SAME PATH IS USED FOR BOTH
 *  SPAWNS. Resolving twice would leave a window in which `-k` and the authenticating
 *  transaction ran different programs; resolving by NAME is the P1 this factory was
 *  rewritten to close (docs/BUGS.md 2026-08-24). `resolveElevator` refuses anything that
 *  is not root-owned, setuid and non-world-writable at an allowlisted absolute path, and
 *  never consults `PATH`.
 *
 *  WHY `sudo` AT ALL, GIVEN THE ALTERNATIVE — because the next reader will ask, and the
 *  question was measured rather than waved away (2026-08-24, macOS 26.5.2):
 *
 *  `LAContext.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics)` is the mechanism
 *  that would prove a BIOMETRIC specifically, which `sudo` provably cannot (see the
 *  `unattributed` register below). It is reachable: a Swift CLI built with `/usr/bin/swiftc`
 *  and only ad-hoc/linker-signed reports `canEvaluatePolicy(biometrics) = true`,
 *  `biometryType = 1` (Touch ID) on this host. It was NOT adopted here, for three reasons:
 *
 *   1. IT DOES NOT FIX THIS BUG. LAContext returns its answer through the same in-process
 *      seam as `sudo` does. Both are an injected effect a caller with code execution can
 *      stub. What this P1 was about is the channel that needed NO code in the repo at all —
 *      a file on `PATH`. An absolute, structurally-checked path closes exactly that channel;
 *      LAContext closes none of it.
 *   2. IT WOULD ADD A TOOLCHAIN TO A CEREMONY PATH. There is no stock macOS binary that
 *      evaluates an LAPolicy, so the gate would have to ship or build a helper. Building it
 *      needs a Swift toolchain present at ceremony time; shipping it puts an unsigned
 *      executable in the repo whose integrity has no better guarantee than the
 *      SIP-`restricted` `/usr/bin/sudo` it would replace — and a helper compiled to a
 *      temporary directory is writable by the same attacker who was planting `PATH` shims.
 *      Compare `.claude/rules/clone-at-tag-stays-sufficient.md`: a bootstrap surface that
 *      needs a resolver present is a surface that fails on a host without one.
 *   3. WHAT IT WOULD BUY IS ATTRIBUTION, AND ATTRIBUTION IS A DIFFERENT, ALREADY-TRACKED
 *      ROW (081M06DSQ0Q087G0R000H91391). This module already reports that honestly as
 *      `factor: "unattributed"` instead of claiming a fingerprint it cannot see.
 *
 *  So `sudo` stays, hardened — and the honest register stays with it: this gate proves that
 *  AN OPERATOR FACTOR ANSWERED on this host, never that a human was physically present. The
 *  attested form (LAContext, or a hardware touch on the YubiHSM/FROST lane) is a design row
 *  for Aminata + Kenji, not a patch. */
export function realSudoGateEffects(): SudoGateEffects {
  const resolved = resolveElevator("sudo");
  const gate: ElevatorGate = resolved.ok
    ? { ok: true, path: resolved.path }
    : { ok: false, reason: resolved.reason };
  // A non-conforming host must never reach a spawn at all — `macTouchIdAuth` checks
  // `elevator()` first and returns before `invalidateTimestamp`/`authenticate` are called.
  // These two therefore only ever run with a resolved absolute path; the fallback string is
  // unreachable and is a deliberate non-path ("") so that a future caller that skipped the
  // check fails loudly at spawn rather than silently re-acquiring the PATH lookup.
  const program = resolved.ok ? resolved.path : "";
  return {
    readFile: (p) => readFileSync(p, "utf8"),
    elevator: () => gate,
    invalidateTimestamp: () => {
      spawnSync(program, ["-k"], { stdio: "ignore" });
    },
    // `sudo -p ''` suppresses the prompt text; pam_tid pops the Touch ID dialog out of
    // band. NOTE: stdin being "ignore" does NOT close the password path — `man sudo`
    // documents `-S, --stdin` as "read the password from the standard input INSTEAD OF
    // using the terminal device", i.e. the default path is /dev/tty and closing stdin
    // leaves it open. The gate does fail closed where there is no tty at all (CI, an
    // agent-run shell), which is why the old comment's claim went unnoticed: it was true
    // in exactly the environment nobody was watching.
    authenticate: () => spawnSync(program, ["-p", "", "true"], { stdio: ["ignore", "ignore", "inherit"] }).status,
    notify: (line) => {
      process.stderr.write(line);
    },
  };
}

/** macOS operator-approval gate — a no-op `sudo` goes through PAM, and (when `pam_tid.so`
 *  is configured per the 2026-05-29 ADR) Touch ID is offered. `sudo -k` first invalidates
 *  any cached timestamp so a FRESH confirmation is required every time.
 *
 *  Fail-closed: if `pam_tid.so` is NOT in the chain we do not run sudo at all — a password
 *  prompt is not what this gate exists to offer.
 *
 *  HONEST REGISTER (081M06DSQ0Q087G0R000H91391): sudo exiting 0 proves *an* auth factor in
 *  this host's chain succeeded, never *which*. So the result reports
 *  `factor: "biometric"` only when the parsed chain shows pam_tid is the only module that
 *  could have satisfied it, and `factor: "unattributed"` otherwise — naming the competing
 *  modules in `reason`. The approval is not weakened; only the claim about it is. */
export function macTouchIdAuth(
  prompt: string,
  fx: SudoGateEffects = realSudoGateEffects(),
): BiometricResult {
  // FIRST, before any spawn and before the PAM read: is there an elevator this process is
  // willing to vouch for? A gate that reads the exit status of whichever file happened to
  // be named `sudo` is not a gate — it is a coin flip an attacker owns (docs/BUGS.md P1,
  // 2026-08-24). Fail closed, and say which candidates were rejected and why.
  const elevator = fx.elevator();
  if (!elevator.ok) {
    return {
      ok: false,
      platform: "macos-touchid",
      factor: "none",
      reason: `operator-approval gate refused to run: ${elevator.reason}`,
    };
  }
  const chain = analyzeSudoAuthChain(fx.readFile);
  if (!chain.touchIdConfigured) {
    return {
      ok: false,
      platform: "macos-touchid",
      factor: "none",
      reason:
        "Touch ID for sudo is not configured (pam_tid.so absent from /etc/pam.d/sudo). " +
        "Enable it per docs/DECISIONS/2026-05-29-biometric-sudo-elevation-via-touch-id-pam.md, then retry.",
    };
  }
  fx.invalidateTimestamp();
  fx.notify(`🔐 Touch ID: ${prompt}\n`);
  const status = fx.authenticate();
  if (status !== 0) {
    return {
      ok: false,
      platform: "macos-touchid",
      factor: "none",
      reason: `Touch ID was declined or failed (sudo status ${status ?? "signal"})`,
    };
  }
  if (chain.touchIdIsOnlySatisfier) {
    return { ok: true, platform: "macos-touchid", factor: "biometric" };
  }
  const competing = [
    ...chain.competingEntries,
    ...chain.unresolvedIncludes.map((s) => `include ${s} (unreadable — chain unknown)`),
  ].join(", ");
  return {
    ok: true,
    platform: "macos-touchid",
    factor: "unattributed",
    reason:
      "an operator auth factor satisfied sudo, but pam_tid.so is not the only module in " +
      `/etc/pam.d/sudo that could have done so — ${competing} could equally have satisfied it, ` +
      "and sudo does not report which module succeeded (pam.conf(5): a failed `sufficient` " +
      "module falls through to the rest of the chain). Approval established; that it was a " +
      "BIOMETRIC is not observable at this seam.",
  };
}

/** Windows Hello gate — SEAM (honest-stop, TODO). A clean programmatic Windows Hello
 *  consent is `Windows.Security.Credentials.UI.UserConsentVerifier.RequestVerificationAsync`,
 *  reachable from PowerShell via WinRT projection — but that bridge is NOT cleanly invokable
 *  from this TS CLI today (no WinRT binding shipped here). Rather than fake a biometric or
 *  weaken the fail-closed gate, this returns unsupported with the wiring point named. Wire
 *  `RequestVerificationAsync` (or the elevated-UAC/Hello path that flash-usb-windows.ts uses
 *  for admin elevation) here when the WinRT bridge lands. */
function windowsHelloAuth(_prompt: string): BiometricResult {
  return {
    ok: false,
    platform: "windows-hello",
    reason:
      "Windows Hello programmatic consent is not yet wired from this TS CLI " +
      "(seam: Windows.Security.Credentials.UI.UserConsentVerifier.RequestVerificationAsync via WinRT/PowerShell). " +
      "Wire it in biometric.ts windowsHelloAuth() before running on Windows — fail-closed until then.",
  };
}

/** The REAL biometric door (CLI-only): the per-platform physical-presence gate. macOS =
 *  Touch ID via pam_tid; Windows = Windows Hello (seam); everything else = unsupported
 *  (fail-closed). NEVER carries a secret — it returns approval only. */
export function realBiometric(): BiometricAuth {
  return async (prompt: string): Promise<BiometricResult> => {
    const plat = detectBiometricPlatform();
    if (plat === "macos-touchid") return macTouchIdAuth(prompt);
    if (plat === "windows-hello") return windowsHelloAuth(prompt);
    return {
      ok: false,
      platform: "unsupported",
      reason: `no biometric mechanism on platform '${osPlatform()}' — fail-closed (no approval)`,
    };
  };
}
