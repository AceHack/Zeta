/**
 * disposition.ts — how Zeta says "this capability, on that OS" as a MODELLED FACT.
 *
 * THE DEFECT THIS REPLACES (measured on main @8a8d011de, 2026-08-24).
 * `src/Core.TypeScript/ci/manifest-symmetry.test.ts` requires every apt/brew tool to
 * appear in `manifests/windows` or in `WINDOWS_EXCEPTIONS`, a hand-written map of
 * English sentences: 35 entries, 7134 bytes of prose, against 48 Unix tools of which
 * only 13 have a literal Windows twin. Classified by what each sentence actually says,
 * 25 of the 35 are facts a data model could carry (10 Windows built-ins, 7 package-name
 * aliases, 3 provided inside the WSL2 nested host, 3 installed by a non-system channel,
 * 1 role-scoped and not a platform question at all, 1 dead entry whose tool is ALSO in
 * manifests/windows so its reason can never be read). The other 10 are decisions nobody
 * has made, and exactly one of those names a work-item. NONE of the 35 is a capability
 * that genuinely does not exist on Windows.
 *
 * The cost of prose is that the only way to be green is to WRITE A SENTENCE. The map
 * records that pressure against itself: three YubiKey entries claimed no Windows id
 * "was verifiable from the host this was authored on", and when the check was finally
 * run "all three resolve" in Scoop and winget. The check did not ask for a fact it could
 * verify, so it got a plausible sentence instead. That is coercion of the author, and
 * it is the failure this module is built to make structurally impossible.
 *
 * THE MODEL. POSIX.1-2024 §2.1.6 already solved the shape: an option is advertised as
 * `-1` (not supported), `0` (supported for compilation, might not be supported at
 * runtime -- probe it), or `> 0` (always supported). Zeta takes the tri-state and
 * REJECTS one thing POSIX does: POSIX says "leaving [the constant] undefined has the
 * same meaning as defining it as -1", i.e. silence means absent. Silence is exactly what
 * the symmetry check exists to refuse, so here an undeclared cell is a GAP that fails
 * the check -- never a quiet `unsupported`. Aaron 2026-08-24: unknown include is better
 * than unknown exclude; fail on an unknown dependency from code rather than miss one.
 * That cut is safe only because the factory has an immune system of standardized math
 * (laws, tests, verification, retraction) -- without it, extras would be something to
 * fear, and silence-as-absent would look prudent. PowerBuilder is the degenerate
 * case of the same cut in TIME: ancestor vs descendant scripts override each other
 * without disclosing which ran. Last-wins without naming the discarded side is
 * that defect; a duplicate capability row is a collision, never a Map overwrite.
 *
 * Anchors (Beacon), each checked against what it actually says:
 *  - Cockburn, "Hexagonal Architecture" (ports & adapters, 2005). Stated intent: run the
 *    application "decoupled from external databases using an in-memory oracle", so that
 *    "any device that adheres to the protocols of a port can be plugged into it". That
 *    entails the port/adapter/swap shape used here. It says NOTHING about representing
 *    an absent capability -- the `unsupported` arm below is not Cockburn's and is not
 *    claimed as his.
 *  - GNU Autoconf manual, Introduction: configure scripts "individually test for the
 *    presence of each feature that the software package they are for might need" rather
 *    than keying on system identity. That entails "ask for the capability, not the OS
 *    name". Its LIMIT matters as much: autoconf probes the host it runs on, and a CI job
 *    on Linux cannot probe Windows. Cross-platform symmetry therefore needs a DECLARED
 *    table, which is what this module is; runtime probing is the `probe` arm, not the
 *    whole answer.
 *  - IEEE Std 1003.1-2024 §2.1.6 -- the tri-state above, quoted rather than paraphrased.
 */

import type { KnownOs } from "./host-os.ts";
import { DECLARED_OSES } from "./host-os.ts";

/** How a capability reaches a host when it is provided. Names the CHANNEL, so the
 *  provisioning port can dispatch on it without re-deriving it from the OS. */
export type Channel =
  /** an OS package manager row (apt / brew / scoop / winget) */
  | "system-package"
  /** a pinned, hash-checked artifact fetched by us (`ace/install-pinned-artifact.ts`) */
  | "pinned-artifact"
  /** a language/runtime manager we already pin (`mise`, `uv`, `bun`) */
  | "runtime-manager"
  /** the vendor's own installer (MSI, .pkg, curl|sh) */
  | "vendor-installer"
  /** present, but inside a nested host on this OS (Windows podman's WSL2 VM) */
  | "nested-host";

/**
 * Why a capability is absent. ONE variant, because the corpus contains one absence
 * shape: the OS has no mechanism of that kind at all. A second variant must be earned
 * by a measured instance -- a taxonomy with more arms than the data has shapes is the
 * same failure as the prose map, wearing a type.
 */
export interface Absence {
  readonly kind: "no-mechanism";
  /** The mechanism class that does not exist here, in the OS's OWN vocabulary
   *  (e.g. "PAM stack"). Naming it here is honest; naming it in the CAPABILITY is
   *  what coerces the reader of another platform. */
  readonly mechanism: string;
}

/**
 * The disposition of one capability on one OS. Five arms; four of them are GREEN
 * (a settled fact), and the fifth is honest, owned debt.
 *
 * There is deliberately NO arm meaning "I could not check, here is a sentence".
 * That arm is what `WINDOWS_EXCEPTIONS` is made of.
 */
export type Disposition =
  /** POSIX `> 0`. We install it; `by` is the id in that channel's own namespace. */
  | { readonly kind: "provided"; readonly by: string; readonly channel: Channel }
  /** POSIX `> 0`, nothing to install: the OS ships it. `component` names the OS's own
   *  component (curl.exe, SCardSvr, Schannel) so the claim is checkable. */
  | { readonly kind: "builtin"; readonly component: string }
  /** POSIX `0`. Declared possible, must be probed on the host. `probe` names the
   *  in-repo probe that answers it -- a probe nobody wrote is not this arm. */
  | { readonly kind: "probe"; readonly probe: string }
  /** POSIX `-1`. Genuinely not available, and that is a COMPLETE answer, not a debt. */
  | { readonly kind: "unsupported"; readonly absence: Absence }
  /** Not yet decided. Costs an owner, a work-item, and what evidence would settle it --
   *  never an essay. This is the only arm the check counts as debt. */
  | {
      readonly kind: "undetermined";
      readonly owner: string;
      /** A ZetaId. `.claude/rules/workitems-mint-with-zetaid.md`: never a B-NNNN. */
      readonly workitem: string;
      readonly settledBy: string;
    };

/** One capability, named for what the HUMAN gets, with a per-OS disposition map.
 *  `Partial` is load-bearing: a missing key is an UNDECLARED cell, and undeclared
 *  fails the check. It is not silently `unsupported` (POSIX's default, rejected above). */
export interface CapabilityRow {
  /** Capability name. Platform-neutral by lint -- see `mechanismNounIn`. */
  readonly capability: string;
  /** What the operator gets, stated without naming any OS's mechanism. */
  readonly intent: string;
  readonly by: Readonly<Partial<Record<KnownOs, Disposition>>>;
}

/** A cell the model does not answer. The check's only failure mode. */
export interface Gap {
  readonly capability: string;
  readonly os: KnownOs;
  readonly why: "undeclared" | "undetermined-without-workitem";
}

/** Resolve one cell. `null` means UNDECLARED -- distinct from `unsupported`, which is
 *  an answer. Callers must handle both; collapsing them is the original defect. */
export function dispositionOn(row: CapabilityRow, os: KnownOs): Disposition | null {
  return row.by[os] ?? null;
}

/** A ZetaId as minted by `new-workitem.ts`: 26 Crockford-base32 characters. */
const ZETAID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * THE CHECK. Every declared capability must answer for every declared OS, and every
 * `undetermined` must name a real work-item. Both failures name the exact cell, so the
 * cheapest way to green is to state a fact -- not to compose a paragraph.
 */
export function symmetryGaps(rows: readonly CapabilityRow[], oses: readonly KnownOs[] = DECLARED_OSES): readonly Gap[] {
  const gaps: Gap[] = [];
  for (const row of rows) {
    for (const os of oses) {
      const d = dispositionOn(row, os);
      if (d === null) {
        gaps.push({ capability: row.capability, os, why: "undeclared" });
        continue;
      }
      if (d.kind === "undetermined" && !ZETAID.test(d.workitem)) {
        gaps.push({ capability: row.capability, os, why: "undetermined-without-workitem" });
      }
    }
  }
  return gaps;
}

/**
 * PowerBuilder's visual inheritance is unknown-exclude in time: earlier silently
 * replaces later, or later replaces earlier, and the reader cannot see which
 * script ran. Two rows with the same capability are that collision. Report BOTH
 * indices -- a Map last-wins or first-wins would drop one without disclosure.
 */
export interface SilentOverride {
  readonly capability: string;
  readonly earlierIndex: number;
  readonly laterIndex: number;
}

export function silentOverrides(rows: readonly CapabilityRow[]): readonly SilentOverride[] {
  const firstAt = new Map<string, number>();
  const out: SilentOverride[] = [];
  for (let i = 0; i < rows.length; i++) {
    const cap = rows[i]?.capability;
    if (cap === undefined) continue;
    const earlier = firstAt.get(cap);
    if (earlier === undefined) {
      firstAt.set(cap, i);
      continue;
    }
    out.push({ capability: cap, earlierIndex: earlier, laterIndex: i });
  }
  return out;
}

/**
 * The non-coercion lint. A capability may not be named after any OS's mechanism: a
 * Windows operator should not have to learn "PAM" to read their own row, and a macOS
 * operator should not have to learn "UAC" to read theirs. Adapters name mechanisms --
 * that is their job. Capabilities name outcomes.
 *
 * The noun list is drawn from the mechanisms actually present in this repo's platform
 * branches, not from imagination; it grows when a new adapter lands.
 */
const MECHANISM_NOUNS: readonly string[] = [
  "pam",
  "uac",
  "launchd",
  "systemd",
  "keychain",
  "scoop",
  "winget",
  "brew",
  "apt",
  "hello",
  "touchid",
  "touch-id",
  "wsl",
  "aqua",
  "registry",
];

/** The offending noun, or `null` when the name is platform-neutral. */
export function mechanismNounIn(capability: string): string | null {
  const parts = capability.toLowerCase().split(/[^a-z0-9]+/u);
  for (const noun of MECHANISM_NOUNS) {
    if (parts.includes(noun)) return noun;
    if (noun.includes("-") && capability.toLowerCase().includes(noun)) return noun;
  }
  return null;
}
