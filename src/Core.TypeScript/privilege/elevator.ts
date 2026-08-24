// Zeta privilege-elevator resolution — the ONE place a privilege elevator's program path
// is decided. Every `sudo` / `doas` / `pkexec` spawn in live TypeScript resolves here.
//
// WHY THIS MODULE EXISTS (docs/BUGS.md, P1 2026-08-24, found by Mateo, fixed by Nazar):
// `tools/setup/persona-keys/biometric.ts` established the operator-approval gate as
// `spawnSync("sudo", ["-p","","true"]).status === 0` — with `sudo` resolved through `PATH`.
// A file named `sudo` earlier on `PATH`, executing nothing and exiting 0, returned
// `{ok:true, ...,"Approval established"}` with no Touch ID prompt and no human. It needed
// no root and it left NO GIT DIFF, so code review, AgencySignature and byte-lock — all of
// which watch the repo — could not see it. `realBiometric()` is, in `publish.ts`'s own
// words, "the one gate every op shares": CA creation, Shamir custody, onboarding,
// rotation, revocation, publish. Every one of them inherited the forgery.
//
// WHAT AN ABSOLUTE PATH BUYS, MEASURED — not asserted (macOS 26.5.2, 2026-08-24):
//   $ ls -lO /usr/bin/sudo
//   -r-s--x--x  1 root  wheel  restricted,compressed 1580368 Jun 24 22:29 /usr/bin/sudo
//   $ csrutil status
//   System Integrity Protection status: enabled.
//   $ brew info sudo   ->  Error: No available formula with the name "sudo".
// `restricted` is `SF_RESTRICTED`: with SIP enabled the file cannot be replaced by anything
// outside a SIP-entitled installer — not by the operator, not by root. So on darwin the
// allowlist is the single entry `/usr/bin/sudo` and nothing else: any OTHER location on
// macOS is user-or-root-writable, and accepting one would reintroduce the same hole in a
// smaller form. Homebrew ships no `sudo` formula, so the portability premise the old
// suppression in `zflash/setup.ts` rested on ("/opt/homebrew/bin/sudo on others") is false.
//
// On Linux the location genuinely does vary, so the allowlist is a short list of
// root-owned system locations. Portability there is bought with an ALLOWLIST, never with
// PATH: the difference is that every candidate is a path an unprivileged process cannot
// write, whereas `PATH` is a value the attacker already controls.
//
// THE STRUCTURAL CHECK, not just the string. An absolute path in the source is a claim;
// what makes it load-bearing is that the file at it is root-owned, setuid, and not
// group/other-writable. `/usr/local/bin` is group-writable on some hosts, and a
// non-setuid file named `sudo` cannot be the real one. Fail closed on every doubt: an
// unreadable, absent, or non-conforming candidate is REJECTED with its reason recorded,
// never silently skipped into a weaker fallback.
//
// WHAT THIS DOES NOT BUY — say it out loud (docs/BUGS.md fix (b), Aminata + Kenji):
// `status === 0` from a child process is not proof that a human was present, and
// absolute-pathing does not make it one. A caller with code execution in THIS process can
// still stub the injected effects door. This module closes the leaves-no-diff channel —
// the one that needed no code in the repo at all. It does not turn an exit status into an
// attestation.
//
// Anchors (Beacon): Apple, *System Integrity Protection* (`SF_RESTRICTED`, `csrutil(8)`) —
// the property that makes one absolute path meaningfully stronger than another. Saltzer &
// Schroeder (1975), *The Protection of Information in Computer Systems* — fail-safe
// defaults and complete mediation: one door, refusing by default. CWE-426 (Untrusted
// Search Path) / CWE-427 (Uncontrolled Search Path Element) — the class this closes.
import { statSync } from "node:fs";
import { platform as osPlatform } from "node:os";

/** The privilege elevators this repo knows how to spawn. */
export type ElevatorName = "sudo" | "doas" | "pkexec";

/** The facts about a candidate file that decide whether it may be spawned as an elevator. */
export interface ElevatorFileFacts {
  /** It is a regular file (a directory or dangling symlink is not an elevator). */
  readonly isFile: boolean;
  /** Owning uid. Anything but 0 is refused. */
  readonly uid: number;
  /** POSIX mode bits, including setuid (0o4000) and the write bits. */
  readonly mode: number;
}

/** The ONLY door through which this module touches the host (§13 noninterference), so a
 *  test can describe any machine's filesystem and get a deterministic resolution. */
export interface ElevatorEffects {
  /** `process.platform`-shaped string. */
  readonly platform: () => string;
  /** Facts about a path, or `null` when it is absent or unreadable. NEVER throws. */
  readonly stat: (path: string) => ElevatorFileFacts | null;
}

/** A rejected candidate and why — carried on both outcomes so a failure names what it
 *  looked at. A refusal with no reason is indistinguishable from a check that never ran. */
export interface ElevatorRejection {
  readonly path: string;
  readonly why: string;
}

export type ElevatorResolution =
  | { readonly ok: true; readonly path: string; readonly rejected: readonly ElevatorRejection[] }
  | { readonly ok: false; readonly reason: string; readonly rejected: readonly ElevatorRejection[] };

/**
 * Absolute candidate paths per platform, in preference order.
 *
 * darwin: exactly one entry, and that is the point — `/usr/bin/sudo` is SIP-`restricted`
 * (measured above) and no other macOS location is. `doas`/`pkexec` are not shipped by
 * Apple and are deliberately empty rather than pointed at a writable Homebrew prefix.
 *
 * linux: `/run/wrappers/bin` first because on NixOS that is where the setuid wrapper lives
 * and `/usr/bin/sudo` does not exist at all.
 */
export const ELEVATOR_ALLOWLIST: Readonly<Record<ElevatorName, readonly string[]>> = {
  sudo: ["/run/wrappers/bin/sudo", "/usr/bin/sudo", "/bin/sudo", "/usr/local/bin/sudo"],
  doas: ["/run/wrappers/bin/doas", "/usr/bin/doas", "/usr/local/bin/doas"],
  pkexec: ["/run/wrappers/bin/pkexec", "/usr/bin/pkexec"],
};

/** darwin narrows the list to the SIP-protected path only — see the header. */
export const DARWIN_ELEVATOR_ALLOWLIST: Readonly<Record<ElevatorName, readonly string[]>> = {
  sudo: ["/usr/bin/sudo"],
  doas: [],
  pkexec: [],
};

/** The candidate list for a platform. Anything that is not darwin gets the general list —
 *  fail-closed still applies, because every candidate is checked before it is returned. */
export function elevatorCandidates(name: ElevatorName, plat: string): readonly string[] {
  return plat === "darwin" ? DARWIN_ELEVATOR_ALLOWLIST[name] : ELEVATOR_ALLOWLIST[name];
}

/** Why a candidate is not acceptable, or `null` when it is. Exported so the test can pin
 *  each refusal separately rather than only the aggregate. */
export function rejectReason(facts: ElevatorFileFacts | null): string | null {
  if (facts === null) return "absent or unreadable";
  if (!facts.isFile) return "not a regular file";
  if (facts.uid !== 0) return `not root-owned (uid ${String(facts.uid)})`;
  if ((facts.mode & 0o4000) === 0) return "not setuid — cannot be the real elevator";
  if ((facts.mode & 0o022) !== 0) {
    return `group- or other-writable (mode ${(facts.mode & 0o7777).toString(8)})`;
  }
  return null;
}

/** The real host door. `statSync` follows symlinks on purpose: `/usr/bin/sudo` may be a
 *  link and what matters is the ownership and mode of the file that actually executes. */
export function realElevatorEffects(): ElevatorEffects {
  return {
    platform: () => osPlatform(),
    stat: (p) => {
      try {
        const s = statSync(p);
        return { isFile: s.isFile(), uid: s.uid, mode: s.mode };
      } catch {
        return null;
      }
    },
  };
}

/**
 * Resolve a privilege elevator to an absolute, root-owned, setuid, non-world-writable
 * path — or refuse. FAIL-CLOSED: there is no fallback to `PATH`, ever. A host with no
 * conforming elevator gets a refusal naming every candidate it rejected and why.
 */
export function resolveElevator(name: ElevatorName, fx: ElevatorEffects = realElevatorEffects()): ElevatorResolution {
  const plat = fx.platform();
  const candidates = elevatorCandidates(name, plat);
  const rejected: ElevatorRejection[] = [];
  for (const path of candidates) {
    const why = rejectReason(fx.stat(path));
    if (why === null) return { ok: true, path, rejected };
    rejected.push({ path, why });
  }
  const detail =
    rejected.length === 0
      ? `no allowlisted location for '${name}' on platform '${plat}'`
      : rejected.map((r) => `${r.path} (${r.why})`).join(", ");
  return {
    ok: false,
    reason:
      `no usable '${name}' found at an allowlisted absolute path — ${detail}. ` +
      "PATH is deliberately NOT consulted: a privilege elevator resolved by name is " +
      "forgeable by any writable directory earlier on PATH (docs/BUGS.md 2026-08-24).",
    rejected,
  };
}

/** Resolve or throw — for the many call sites whose only correct response to "no usable
 *  elevator" is to stop. The message names the candidates, so an operator on an unusual
 *  host can see exactly which allowlist entry to add rather than being told "not found". */
export function resolveElevatorPathOrThrow(name: ElevatorName, fx: ElevatorEffects = realElevatorEffects()): string {
  const r = resolveElevator(name, fx);
  if (!r.ok) throw new Error(r.reason);
  return r.path;
}
