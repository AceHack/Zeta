// mise-pin-parity.ts — the mise pin has ONE value and the installer ISO has ONE definition.
//
// Work-item 081KZKS9A6B08QG0R0008EG72M. `full-ai-cluster/usb-nixos-installer/flake.nix`
// built `nixosConfigurations.installer` from the SAME
// `usb-nixos-installer/nixos/installer/configuration.nix` as
// `full-ai-cluster/flake.nix`, but applied no overlays — so it shipped nixpkgs'
// `mise` (2025.11.7 at the locked rev b77b3de) where CI shipped the pinned,
// autoPatchelfHook'd 2026.6.12. Both flakes locked the same nixpkgs rev, so the
// overlay was the ONLY difference: one declared artifact, two ISOs, and the
// "obvious" build path (documented in the root flake, infra/README.md and
// infra/nix-darwin/README.md) was the wrong one. An unpinned mise is below
// `.mise.toml`'s `min_version`, fails the check in tools/setup/linux.sh, and
// falls into a tarball branch that is deliberately fatal on NixOS — so the
// divergence surfaced only at first boot.
//
// Two checks, because there are two ways to re-diverge:
//
//   1. STRUCTURAL — any flake that builds the installer configuration must apply
//      the mise-pin overlay. Discovered by `git ls-files`, not by a hardcoded
//      list, so a *newly added* flake is covered the moment it exists. This is
//      what catches a re-added duplicate.
//
//   2. VALUE — every site that restates the pin version must agree. The
//      canonical value is read from `.mise.toml` (`min_version`); every other
//      site is compared against it rather than against a list maintained here.
//      A second hand-maintained list would be the defect wearing a fix's
//      clothes, so this file holds no expected version.
//
// Honest limit on (2): `full-ai-cluster/nixos/overlays/mise-pin.nix` cannot
// *read* `.mise.toml` — `.mise.toml` sits at the repo root, outside the
// `full-ai-cluster/` flake root, and Nix flakes cannot reference paths above
// their own root. The restatement is therefore structural to Nix, and this
// check is the binding that makes it safe. That is a real gap, named rather
// than hidden: the pin is derived-by-check, not derived-by-construction.
//
// Run: bun run hygiene:mise-pin-parity

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Suffix identifying a reference to the installer's NixOS configuration.
 *
 * Deliberately the SUFFIX, not the repo-relative path. The retired duplicate
 * flake lived *inside* `usb-nixos-installer/` and referenced its config as
 * `./nixos/installer/configuration.nix`, so a marker of
 * `usb-nixos-installer/nixos/installer/configuration.nix` does not occur in
 * that text at all — the structural check would have passed on the very bug it
 * exists to catch. Found by mutation-testing this checker against the real
 * retired file instead of against a fixture written to match my own marker.
 * A check that cannot fail is not a check.
 */
export const INSTALLER_CONFIG_MARKER = "nixos/installer/configuration.nix";

/** Path fragment identifying the mise-pin overlay import. */
export const MISE_PIN_OVERLAY_MARKER = "overlays/mise-pin.nix";

/** The file the canonical pin value is read FROM. Never restate its value here. */
export const CANONICAL_PIN_FILE = ".mise.toml";

export interface PinSite {
  /** Repo-relative path. */
  readonly file: string;
  /** Human-readable name of the declaration inside that file. */
  readonly label: string;
  /** Pattern whose first capture group is the version. */
  readonly pattern: RegExp;
  /**
   * Set ONLY for a site whose file is not on `main` yet. It is the documented
   * reason absence is tolerated — same habit as `WINDOWS_EXCEPTIONS` in
   * `src/Core.TypeScript/ci/manifest-symmetry.test.ts`: an exception with no
   * stated reason is an exception nobody can retire.
   *
   * The tolerance is narrow and worth stating precisely, because the whole
   * value of this checker is that it does not skip:
   *
   *   - file ABSENT      → not a violation (the surface has not landed)
   *   - file PRESENT, pattern does not match → VIOLATION, exactly as for any
   *     other site (a rename must go red, never quietly drop the site)
   *   - file PRESENT, pin disagrees          → VIOLATION
   *
   * So this field buys "not yet", never "not checked" — and an absent pending
   * site is REPORTED by the CLI rather than passing invisibly.
   */
  readonly pendingReason?: string;
}

/**
 * Every site that restates the mise pin. `.mise.toml` is first and is the
 * canonical source; the rest are compared against it.
 *
 * A site whose pattern does not match is a FAILURE, not a skip — renaming the
 * variable must go red rather than silently drop the site from the check.
 */
export const PIN_SITES: readonly PinSite[] = [
  { file: CANONICAL_PIN_FILE, label: "min_version", pattern: /^min_version\s*=\s*"([^"]+)"/m },
  { file: "tools/setup/linux.sh", label: "MISE_PIN_VERSION", pattern: /^MISE_PIN_VERSION="([^"]+)"/m },
  { file: "tools/setup/macos.sh", label: "MISE_MIN_VERSION", pattern: /^MISE_MIN_VERSION="([^"]+)"/m },
  {
    file: "full-ai-cluster/nixos/overlays/mise-pin.nix",
    label: "version",
    pattern: /^\s*version\s*=\s*"([^"]+)"\s*;/m,
  },
  {
    // The Cursor cloud-agent environment restates the pin a fifth time. Today the
    // ONLY thing holding it to the other four is a comment reading "bump in
    // lockstep" — which is not a mechanism, it is a hope with a code font. Adding
    // the site here BEFORE the file lands is the cheap half: the moment
    // `.cursor/install.sh` exists, its pin is compared like every other site, and
    // there is no window in which the fifth copy is unguarded.
    file: ".cursor/install.sh",
    label: "MISE_PIN_VERSION",
    // Tolerant about `readonly`/`export` and leading whitespace so a reasonable
    // spelling of the same declaration is still READ. An unreasonable one is not
    // silently skipped — it fails with the "update PIN_SITES" message below.
    pattern: /^[ \t]*(?:readonly |export )?MISE_PIN_VERSION="([^"]+)"/m,
    pendingReason:
      "Cursor cloud-agent environment (PR #12876) is not merged to main yet; the file's absence " +
      "is expected, its presence is checked. Delete this field once the PR lands.",
  },
];

/**
 * Reads the version a single site declares. `null` = the file is unreadable OR
 * the pattern did not match. `pinValueViolations` deliberately does NOT use this
 * for non-canonical sites: it needs those two cases apart, because a
 * not-yet-landed file and a renamed declaration deserve opposite verdicts.
 */
export function readPinAt(repoRoot: string, site: PinSite, read = defaultRead): string | null {
  const text = read(join(repoRoot, site.file));
  if (text === null) return null;
  const match = site.pattern.exec(text);
  return match?.[1] ?? null;
}

function defaultRead(absolutePath: string): string | null {
  if (!existsSync(absolutePath)) return null;
  return readFileSync(absolutePath, "utf8");
}

/**
 * Compares every pin site against `.mise.toml`. Returns one message per
 * disagreement or unreadable site; empty means parity.
 */
export function pinValueViolations(repoRoot: string, read = defaultRead): string[] {
  const violations: string[] = [];
  const canonical = readPinAt(repoRoot, PIN_SITES[0]!, read);
  if (canonical === null) {
    return [
      `${CANONICAL_PIN_FILE}: could not read the canonical mise pin (\`min_version\`). ` +
        `Every other site is compared against it, so this check cannot run.`,
    ];
  }
  for (const site of PIN_SITES.slice(1)) {
    const text = read(join(repoRoot, site.file));
    if (text === null) {
      // ABSENT file. Separated from "present but unparseable" on purpose: those
      // used to collapse into one message, which meant a not-yet-landed surface
      // could not be declared here at all without going red on main.
      if (site.pendingReason !== undefined) continue;
      violations.push(
        `${site.file}: file not found. A required pin site vanished — restore it, or, if it moved, ` +
          `update PIN_SITES in src/Core.TypeScript/hygiene/mise-pin-parity.ts — do not drop the site.`,
      );
      continue;
    }
    const found = site.pattern.exec(text)?.[1] ?? null;
    if (found === null) {
      violations.push(
        `${site.file}: no \`${site.label}\` declaration found. If it moved or was renamed, ` +
          `update PIN_SITES in src/Core.TypeScript/hygiene/mise-pin-parity.ts — do not drop the site.`,
      );
      continue;
    }
    if (found !== canonical) {
      violations.push(
        `${site.file}: ${site.label} = "${found}" but ${CANONICAL_PIN_FILE} min_version = "${canonical}". ` +
          `The mise pin is one value across all sites (GOVERNANCE §24 three-way parity).`,
      );
    }
  }
  return violations;
}

/**
 * Any flake that builds the installer NixOS configuration must also apply the
 * mise-pin overlay. Returns one message per offending flake; empty means every
 * definition of the installer ISO carries the pin.
 */
export function installerOverlayViolations(
  repoRoot: string,
  flakePaths: readonly string[],
  read = defaultRead,
): string[] {
  const violations: string[] = [];
  for (const flakePath of flakePaths) {
    const text = read(join(repoRoot, flakePath));
    if (text === null) continue;
    if (!text.includes(INSTALLER_CONFIG_MARKER)) continue;
    if (text.includes(MISE_PIN_OVERLAY_MARKER)) continue;
    violations.push(
      `${flakePath}: builds ${INSTALLER_CONFIG_MARKER} but does not apply ${MISE_PIN_OVERLAY_MARKER}. ` +
        `Such a flake produces an ISO carrying nixpkgs' unpinned mise, which is below ` +
        `${CANONICAL_PIN_FILE}'s min_version and is fatal at first boot on NixOS. ` +
        `Build the installer from full-ai-cluster/flake.nix (081KZKS9A6B08QG0R0008EG72M).`,
    );
  }
  return violations;
}

/** Tracked `flake.nix` paths, repo-relative. */
export function trackedFlakes(repoRoot: string): string[] {
  const result = spawnSync("git", ["ls-files", "--", "*flake.nix"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed (exit ${String(result.status)}): ${result.stderr ?? ""}`);
  }
  return result.stdout.split("\n").filter((line) => line.length > 0);
}

/**
 * Pending sites whose file is not present. Not violations — but printed, so a
 * declared-and-absent site is visible rather than indistinguishable from a
 * checked one. Silence is what makes a skip dangerous; this removes the silence
 * without inventing a failure.
 */
export function pendingAbsentSites(repoRoot: string, read = defaultRead): readonly PinSite[] {
  return PIN_SITES.filter(
    (site) => site.pendingReason !== undefined && read(join(repoRoot, site.file)) === null,
  );
}

/** Both checks against a real repo. Empty result = clean. */
export function allViolations(repoRoot: string): string[] {
  return [
    ...installerOverlayViolations(repoRoot, trackedFlakes(repoRoot)),
    ...pinValueViolations(repoRoot),
  ];
}

if (import.meta.main) {
  const repoRoot = resolve(import.meta.dir, "..", "..", "..");
  const violations = allViolations(repoRoot);
  if (violations.length > 0) {
    process.stderr.write("mise pin parity FAILED:\n");
    for (const violation of violations) process.stderr.write(`  - ${violation}\n`);
    process.exit(1);
  }
  for (const site of pendingAbsentSites(repoRoot)) {
    process.stdout.write(`mise pin parity: PENDING site absent — ${site.file} (${site.pendingReason ?? ""})\n`);
  }
  process.stdout.write("mise pin parity OK: one installer definition, one pin value.\n");
}
