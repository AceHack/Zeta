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
//   2. VALUE — the four sites that restate the pin version must agree. The
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
];

/** Reads the version a single site declares. `null` = the pattern did not match. */
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
    const found = readPinAt(repoRoot, site, read);
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
  process.stdout.write("mise pin parity OK: one installer definition, one pin value.\n");
}
