// system-tool.ts — admit a SYSTEM tool from an allowlisted ABSOLUTE path, or refuse.
//
// This is the sibling of `elevator.ts`, generalised to system binaries that are NOT
// setuid. `elevator.ts` closed the `sudo` hole (docs/BUGS.md P1, 2026-08-24) and its
// admission test hardcodes `setuid`, which is correct for a privilege elevator and wrong
// for everything else: `/bin/launchctl` is mode 0755, root:wheel, and not setuid. Reusing
// the elevator check would have rejected the real binary; loosening the elevator check
// would have weakened the `sudo` gate. So the shape is shared and the PREDICATE is a
// parameter.
//
// WHAT THIS IS FOR. `launchctl` installs and starts LaunchAgents — code that runs at every
// login. A forged `launchctl` earlier on `PATH` does not need root to be interesting: it
// can exit 0 on `bootstrap` so a service reports installed and never runs (a check that did
// not run, reading as one that passed), or exit 0 on `bootout` so an uninstall silently
// leaves the agent live. Neither leaves a git diff.
//
// ---------------------------------------------------------------------------
// WHAT THE IDENTITY IS, AND WHAT IT DOES NOT PROVE. Read this before calling it a
// fingerprint, because on its own it is not one.
//
// `toolIdentity()` records (realpath, dev, ino, size, mode, uid, sha256). MEASURED cost on
// this host (macOS 26.5.2, Bun 1.3.14, 2026-08-25), median of 5 after warm:
//     /bin/launchctl   0.4 MB   sha256 =  0.36 ms
//     bun              63.1 MB  sha256 = 31.75 ms
//     statSync                          =  0.0036 ms
// So a content hash is affordable for launchctl ONCE per process and is NOT affordable
// per-invocation for a 63 MB runtime. That measurement — not a preference — is why the
// hash is computed here and why this module is not proposed for the `bun`/`git` sites.
//
// A hash detects substitution ONLY against a recorded baseline. With no pin, `identity` is
// an OBSERVATION, not a check: it reports what is there and can refuse nothing. Called
// with `expect`, it becomes a real substitution detector for any change to the bytes.
// Nothing here establishes that the bytes are APPLE'S bytes — there is no signature
// verification, no notarisation check, no trust root. A root-authored replacement with a
// matching pin is undetectable, and a first-run pin records whatever is already there.
//
// SIP IS ASSERTED, NOT VERIFIED. `/bin/launchctl` carries `SF_RESTRICTED` (measured:
// `ls -lO /bin/launchctl` -> `restricted,compressed`, `csrutil status` -> enabled), which
// is the property that actually makes the absolute path meaningful. Bun's `statSync`
// exposes dev,ino,mode,nlink,uid,gid,rdev,size,blksize,blocks and the times — and NO
// `st_flags`. So this module CANNOT read the restricted flag and does not claim to. The
// allowlist encodes a measured OS property; it does not re-verify it at run time.
//
// Anchors (Beacon): CWE-426 / CWE-427 (untrusted search path). Saltzer & Schroeder (1975),
// fail-safe defaults + complete mediation. Apple, System Integrity Protection
// (`SF_RESTRICTED`, `csrutil(8)`).
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { platform as osPlatform } from "node:os";

/** Facts about a candidate file that decide admission. `null` from the door = absent. */
export interface ToolFileFacts {
  readonly isFile: boolean;
  readonly uid: number;
  readonly mode: number;
  readonly size: number;
  readonly dev: number;
  readonly ino: number;
}

/** The observed identity of an admitted tool. An observation unless compared to a pin. */
export interface ToolIdentity {
  readonly realpath: string;
  readonly dev: number;
  readonly ino: number;
  readonly size: number;
  readonly mode: number;
  readonly uid: number;
  /** sha256 of the file contents, or `null` when hashing was not requested/possible. */
  readonly sha256: string | null;
}

/** The ONLY door to the host (§13 noninterference) so tests drive real logic, not a mock. */
export interface SystemToolEffects {
  readonly platform: () => string;
  /** Facts, or `null` when absent/unreadable. MUST NOT throw. */
  readonly stat: (path: string) => ToolFileFacts | null;
  /** Resolved real path, or `null`. MUST NOT throw. */
  readonly realpath: (path: string) => string | null;
  /** sha256 hex of file contents, or `null` when unreadable. MUST NOT throw. */
  readonly sha256: (path: string) => string | null;
}

/** A tool this repo knows how to admit. Paths are ABSOLUTE and allowlisted per platform. */
export interface SystemToolSpec {
  readonly name: string;
  readonly darwin: readonly string[];
  readonly linux: readonly string[];
  readonly win32: readonly string[];
  /** Elevators need setuid; ordinary system tools must NOT be required to have it. */
  readonly requireSetuid: boolean;
  /** Compute + return the content hash on admission. Only sane for small binaries. */
  readonly hashContents: boolean;
}

export interface ToolRejection {
  readonly path: string;
  readonly why: string;
}

export type ToolResolution =
  | { readonly ok: true; readonly path: string; readonly identity: ToolIdentity; readonly rejected: readonly ToolRejection[] }
  | { readonly ok: false; readonly reason: string; readonly rejected: readonly ToolRejection[] };

/**
 * `launchctl` — the launchd control surface.
 *
 * darwin: exactly `/bin/launchctl`. Measured on macOS 26.5.2: it is the only location
 * (`which -a launchctl` -> one hit), it is `restricted,compressed` root:wheel 0755, and
 * Homebrew ships no `launchctl` formula, so there is no legitimate second location to be
 * portable towards. Any OTHER path on macOS is user- or root-writable and admitting one
 * would reintroduce the hole in a smaller form.
 *
 * linux/win32: EMPTY ON PURPOSE. launchd is Apple-only; there is no launchctl to find.
 * An empty allowlist yields a refusal that names the platform, which is the honest answer
 * and is what fail-closed means here.
 */
export const LAUNCHCTL_SPEC: SystemToolSpec = {
  name: "launchctl",
  darwin: ["/bin/launchctl"],
  linux: [],
  win32: [],
  requireSetuid: false,
  hashContents: true,
};

export function toolCandidates(spec: SystemToolSpec, plat: string): readonly string[] {
  if (plat === "darwin") return spec.darwin;
  if (plat === "win32") return spec.win32;
  return spec.linux;
}

/**
 * Why a candidate is not admissible, or `null` when it is. Exported so each refusal can be
 * pinned separately rather than only the aggregate.
 *
 * `0o022` is group-write|other-write. A root-owned file that group or others may write is
 * exactly as forgeable as a PATH entry, so it is refused even though it is root-owned.
 */
export function toolRejectReason(facts: ToolFileFacts | null, spec: SystemToolSpec): string | null {
  if (facts === null) return "absent or unreadable";
  if (!facts.isFile) return "not a regular file";
  if (facts.uid !== 0) return `not root-owned (uid ${String(facts.uid)})`;
  if (spec.requireSetuid && (facts.mode & 0o4000) === 0) return "not setuid";
  if ((facts.mode & 0o022) !== 0) {
    return `group- or other-writable (mode ${(facts.mode & 0o7777).toString(8)})`;
  }
  return null;
}

/** Compare an observed identity against a pin. `null` when they agree. */
export function identityMismatch(seen: ToolIdentity, pin: Partial<ToolIdentity>): string | null {
  const keys = ["realpath", "dev", "ino", "size", "mode", "uid", "sha256"] as const;
  for (const k of keys) {
    const want = pin[k];
    if (want === undefined) continue;
    if (seen[k] !== want) return `${k}: expected ${String(want)}, saw ${String(seen[k])}`;
  }
  return null;
}

export function realSystemToolEffects(): SystemToolEffects {
  return {
    platform: () => osPlatform(),
    stat: (p) => {
      try {
        const s = statSync(p);
        return { isFile: s.isFile(), uid: s.uid, mode: s.mode, size: s.size, dev: s.dev, ino: s.ino };
      } catch {
        return null;
      }
    },
    realpath: (p) => {
      try {
        return realpathSync(p);
      } catch {
        return null;
      }
    },
    sha256: (p) => {
      try {
        return createHash("sha256").update(readFileSync(p)).digest("hex");
      } catch {
        return null;
      }
    },
  };
}

/**
 * Admit a system tool at an allowlisted absolute path, or REFUSE. There is no fallback to
 * `PATH`, ever. A refusal names every candidate it rejected and why, because a refusal
 * with no reason is indistinguishable from a check that never ran.
 *
 * `pin`, when supplied, turns the recorded identity into an actual substitution check:
 * a byte, size, inode or realpath change becomes a refusal.
 */
/** Admit ONE candidate, or say why not. Split out of `resolveSystemTool` so each refusal
 *  is a single early return rather than a branch in a loop. */
function admitOne(
  path: string,
  spec: SystemToolSpec,
  fx: SystemToolEffects,
  pin: Partial<ToolIdentity> | undefined,
): { readonly identity: ToolIdentity } | { readonly why: string } {
  const facts = fx.stat(path);
  const why = toolRejectReason(facts, spec);
  if (why !== null) return { why };
  if (facts === null) return { why: "absent or unreadable" };
  const real = fx.realpath(path);
  if (real === null) return { why: "realpath failed" };
  const sha256 = spec.hashContents ? fx.sha256(path) : null;
  if (spec.hashContents && sha256 === null) {
    return { why: "contents unreadable — cannot record identity" };
  }
  const identity: ToolIdentity = {
    realpath: real,
    dev: facts.dev,
    ino: facts.ino,
    size: facts.size,
    mode: facts.mode,
    uid: facts.uid,
    sha256,
  };
  const bad = pin === undefined ? null : identityMismatch(identity, pin);
  if (bad !== null) return { why: `identity pin mismatch — ${bad}` };
  return { identity };
}

export function resolveSystemTool(
  spec: SystemToolSpec,
  fx: SystemToolEffects = realSystemToolEffects(),
  pin?: Partial<ToolIdentity>,
): ToolResolution {
  const plat = fx.platform();
  const candidates = toolCandidates(spec, plat);
  const rejected: ToolRejection[] = [];
  for (const path of candidates) {
    const outcome = admitOne(path, spec, fx, pin);
    if ("identity" in outcome) return { ok: true, path, identity: outcome.identity, rejected };
    rejected.push({ path, why: outcome.why });
  }
  const detail =
    rejected.length === 0
      ? `no allowlisted location for '${spec.name}' on platform '${plat}'`
      : rejected.map((r) => `${r.path} (${r.why})`).join(", ");
  return {
    ok: false,
    reason:
      `no usable '${spec.name}' at an allowlisted absolute path — ${detail}. ` +
      "PATH is deliberately NOT consulted: a tool resolved by name is forgeable by any " +
      "writable directory earlier on PATH (CWE-426).",
    rejected,
  };
}
