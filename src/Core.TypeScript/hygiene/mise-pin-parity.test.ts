// mise-pin-parity.test.ts — 081KZKS9A6B08QG0R0008EG72M
//
// Two layers, deliberately:
//   - fixture tests prove the checker GOES RED when a pin is mutated or an
//     un-overlaid installer flake is re-added (a check that cannot fail is not
//     a check — toy-is-free-metered-must-be-earned);
//   - live-repo tests prove main is actually clean right now.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CANONICAL_PIN_FILE,
  INSTALLER_CONFIG_MARKER,
  MISE_PIN_OVERLAY_MARKER,
  PIN_SITES,
  allViolations,
  installerOverlayViolations,
  pendingAbsentSites,
  pinValueViolations,
  readPinAt,
  trackedFlakes,
} from "./mise-pin-parity";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");

/** In-memory filesystem so the mutation tests never touch the working tree. */
function fakeRead(files: Record<string, string>) {
  return (absolutePath: string): string | null => {
    for (const [rel, text] of Object.entries(files)) {
      if (absolutePath.endsWith(rel)) return text;
    }
    return null;
  };
}

const PIN = "2026.6.12";

function inParityFixture(): Record<string, string> {
  return {
    ".mise.toml": `min_version = "${PIN}"\n[tools]\nbun = "1.3"\n`,
    "tools/setup/linux.sh": `#!/usr/bin/env bash\nMISE_PIN_VERSION="${PIN}"\nMISE_VERSION="v\${MISE_PIN_VERSION}"\n`,
    "tools/setup/macos.sh": `#!/usr/bin/env bash\nMISE_MIN_VERSION="${PIN}"\n`,
    "full-ai-cluster/nixos/overlays/mise-pin.nix": `final: prev:\nlet\n  version = "${PIN}";\nin\n{}\n`,
    // The fifth site, written as it will exist once the Cursor cloud-agent
    // environment lands. Its presence in this fixture is what proves the site is
    // CHECKED and not merely listed — the absence case gets its own describe below.
    ".cursor/install.sh": `#!/usr/bin/env bash\nset -euo pipefail\nMISE_PIN_VERSION="${PIN}"\n`,
  };
}

describe("pin value parity", () => {
  test("agreeing sites produce no violations", () => {
    expect(pinValueViolations("/repo", fakeRead(inParityFixture()))).toEqual([]);
  });

  // MUTATION PROOF, one per non-canonical site: bump exactly one pin, expect red.
  for (const site of PIN_SITES.slice(1)) {
    test(`goes RED when ${site.file} drifts from ${CANONICAL_PIN_FILE}`, () => {
      const files = inParityFixture();
      files[site.file] = files[site.file]!.replaceAll(PIN, "2026.7.1");
      const violations = pinValueViolations("/repo", fakeRead(files));
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain(site.file);
      expect(violations[0]).toContain("2026.7.1");
    });
  }

  test("goes RED when the canonical pin itself moves and the others do not", () => {
    const files = inParityFixture();
    files[CANONICAL_PIN_FILE] = `min_version = "2026.7.1"\n`;
    // Every other site now disagrees — all three must be reported.
    expect(pinValueViolations("/repo", fakeRead(files))).toHaveLength(PIN_SITES.length - 1);
  });

  test("a renamed/removed declaration is a FAILURE, not a silent skip", () => {
    const files = inParityFixture();
    files["tools/setup/linux.sh"] = `#!/usr/bin/env bash\nMISE_RENAMED_VERSION="${PIN}"\n`;
    const violations = pinValueViolations("/repo", fakeRead(files));
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("no `MISE_PIN_VERSION` declaration found");
  });

  test("an unreadable .mise.toml fails loudly rather than passing vacuously", () => {
    expect(pinValueViolations("/repo", fakeRead({}))[0]).toContain(
      "could not read the canonical mise pin",
    );
  });
});

describe("the fifth site: .cursor/install.sh", () => {
  // The Cursor cloud-agent environment restates MISE_PIN_VERSION a fifth time,
  // held to the other four today only by a comment reading "bump in lockstep".
  // These are the falsifiers for replacing that comment with a mechanism.

  const CURSOR = ".cursor/install.sh";
  const site = PIN_SITES.find((s) => s.file === CURSOR);

  test("the site is declared, and declared as PENDING with a stated reason", () => {
    expect(site).toBeDefined();
    expect(site?.label).toBe("MISE_PIN_VERSION");
    // A pending site with no reason is an exception nobody can retire.
    expect(site?.pendingReason ?? "").not.toBe("");
  });

  test("...and pending is the EXCEPTION — the other four sites are required", () => {
    // The paired negative computed from the same roster. If `pendingReason`
    // spread to the canonical file, absence would stop being checkable anywhere.
    const pending = PIN_SITES.filter((s) => s.pendingReason !== undefined).map((s) => s.file);
    expect(pending).toEqual([CURSOR]);
  });

  test("goes RED when .cursor/install.sh drifts from the other four", () => {
    const files = inParityFixture();
    files[CURSOR] = `#!/usr/bin/env bash\nMISE_PIN_VERSION="2026.7.1"\n`;
    const violations = pinValueViolations("/repo", fakeRead(files));
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain(CURSOR);
    expect(violations[0]).toContain("2026.7.1");
  });

  test("...and stays GREEN when it agrees — the same fixture, one value changed", () => {
    expect(pinValueViolations("/repo", fakeRead(inParityFixture()))).toEqual([]);
  });

  test("a PRESENT file whose declaration was renamed is still a FAILURE", () => {
    // Pending buys "not yet", never "not checked". Once the file exists it is
    // held to the same standard as every other site.
    const files = inParityFixture();
    files[CURSOR] = `#!/usr/bin/env bash\nCURSOR_MISE_VERSION="${PIN}"\n`;
    const violations = pinValueViolations("/repo", fakeRead(files));
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("no `MISE_PIN_VERSION` declaration found");
  });

  test("the pattern reads the declaration however it is reasonably spelled", () => {
    for (const spelling of [
      `MISE_PIN_VERSION="${PIN}"`,
      `  MISE_PIN_VERSION="${PIN}"`,
      `readonly MISE_PIN_VERSION="${PIN}"`,
      `export MISE_PIN_VERSION="${PIN}"`,
    ]) {
      const files = inParityFixture();
      files[CURSOR] = `#!/usr/bin/env bash\n${spelling}\n`;
      expect(pinValueViolations("/repo", fakeRead(files))).toEqual([]);
    }
  });
});

describe("a pin site that has not landed yet degrades without going silent", () => {
  const CURSOR = ".cursor/install.sh";

  function without(file: string): Record<string, string> {
    return Object.fromEntries(Object.entries(inParityFixture()).filter(([key]) => key !== file));
  }

  const withoutCursor = (): Record<string, string> => without(CURSOR);

  test("its absence is NOT a violation", () => {
    expect(pinValueViolations("/repo", fakeRead(withoutCursor()))).toEqual([]);
  });

  test("...but its absence IS reported, so it is never mistaken for a checked site", () => {
    const absent = pendingAbsentSites("/repo", fakeRead(withoutCursor())).map((s) => s.file);
    expect(absent).toEqual([CURSOR]);
  });

  test("...and once present it drops out of the pending report entirely", () => {
    expect(pendingAbsentSites("/repo", fakeRead(inParityFixture()))).toEqual([]);
  });

  test("an absent REQUIRED site is still a hard failure", () => {
    // The property that makes the tolerance narrow rather than a hole: deleting
    // a non-pending site goes red, whereas deleting the pending one does not.
    const files = Object.fromEntries(
      Object.entries(withoutCursor()).filter(([key]) => key !== "tools/setup/macos.sh"),
    );
    const violations = pinValueViolations("/repo", fakeRead(files));
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("tools/setup/macos.sh");
    expect(violations[0]).toContain("file not found");
  });
});

describe("installer flakes must apply the mise-pin overlay", () => {
  // Fixtures are written as LITERAL flake text, never interpolated from the
  // markers under test. Interpolating is how the first version of this check
  // passed vacuously: the fixture matched my marker by construction while the
  // real retired flake did not match it at all.

  /** The shape full-ai-cluster/flake.nix has: overlay applied via mkSystem. */
  const overlaid = [
    "      mkSystem = { system ? \"x86_64-linux\", modules }: nixpkgs.lib.nixosSystem {",
    "        modules = [",
    "          ({ nixpkgs.overlays = [ (import ./nixos/overlays/mise-pin.nix) ]; })",
    "        ] ++ modules;",
    "      };",
    "        installer = mkSystem {",
    "          modules = [ ./usb-nixos-installer/nixos/installer/configuration.nix ];",
    "        };",
  ].join("\n");

  /**
   * The shape the RETIRED usb-nixos-installer/flake.nix had, verbatim in the
   * part that matters: same configuration, relative path, no overlay.
   */
  const retiredDuplicate = [
    "      nixosConfigurations.installer = nixpkgs.lib.nixosSystem {",
    "        system = \"x86_64-linux\";",
    "        specialArgs = { inherit inputs stateVersion; };",
    "        modules = [",
    "          ./nixos/installer/configuration.nix",
    "        ];",
    "      };",
  ].join("\n");

  /** A flake that builds host systems, not the installer. */
  const unrelated = [
    "      nixosConfigurations = {",
    "        control-plane = mkSystem {",
    "          modules = [ ./infra/nixos/hosts/control-plane/configuration.nix ];",
    "        };",
    "      };",
  ].join("\n");

  test("markers are the substrings they claim to be", () => {
    // Guards the vacuity directly: both spellings of the installer reference
    // must be recognised, and the overlay marker must match the real import.
    expect(overlaid.includes(INSTALLER_CONFIG_MARKER)).toBe(true);
    expect(retiredDuplicate.includes(INSTALLER_CONFIG_MARKER)).toBe(true);
    expect(overlaid.includes(MISE_PIN_OVERLAY_MARKER)).toBe(true);
    expect(unrelated.includes(INSTALLER_CONFIG_MARKER)).toBe(false);
  });

  test("a flake that builds the installer WITH the overlay is clean", () => {
    expect(
      installerOverlayViolations(
        "/repo",
        ["full-ai-cluster/flake.nix"],
        fakeRead({ "full-ai-cluster/flake.nix": overlaid }),
      ),
    ).toEqual([]);
  });

  // MUTATION PROOF: the retired duplicate, re-added, must go red.
  test("goes RED when a flake builds the installer WITHOUT the overlay", () => {
    const violations = installerOverlayViolations(
      "/repo",
      ["full-ai-cluster/usb-nixos-installer/flake.nix"],
      fakeRead({ "full-ai-cluster/usb-nixos-installer/flake.nix": retiredDuplicate }),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("does not apply");
    expect(violations[0]).toContain("full-ai-cluster/usb-nixos-installer/flake.nix");
  });

  test("a flake that does not build the installer at all is not implicated", () => {
    expect(
      installerOverlayViolations("/repo", ["flake.nix"], fakeRead({ "flake.nix": unrelated })),
    ).toEqual([]);
  });
});

describe("the live repo", () => {
  test("the pin is the same value at every site", () => {
    expect(pinValueViolations(REPO_ROOT)).toEqual([]);
  });

  test("every tracked flake that builds the installer applies the overlay", () => {
    expect(installerOverlayViolations(REPO_ROOT, trackedFlakes(REPO_ROOT))).toEqual([]);
  });

  test("exactly ONE tracked flake defines the installer ISO", () => {
    const defining = trackedFlakes(REPO_ROOT).filter((flakePath) =>
      readFileSync(resolve(REPO_ROOT, flakePath), "utf8").includes(INSTALLER_CONFIG_MARKER),
    );
    expect(defining).toEqual(["full-ai-cluster/flake.nix"]);
  });

  test("the fifth site is either absent-and-reported or present-and-in-parity", () => {
    // Written to stay true ACROSS the merge of the Cursor cloud-agent PR, so it
    // is a standing invariant rather than a snapshot that goes red on landing.
    // Both arms assert something: absence must be REPORTED (not merely tolerated),
    // presence must AGREE with `.mise.toml`.
    const cursorSite = PIN_SITES.find((s) => s.file === ".cursor/install.sh");
    expect(cursorSite).toBeDefined();
    if (cursorSite === undefined) return;
    const canonical = readPinAt(REPO_ROOT, PIN_SITES[0]!);
    if (existsSync(resolve(REPO_ROOT, cursorSite.file))) {
      expect(readPinAt(REPO_ROOT, cursorSite)).toBe(canonical);
      expect(pendingAbsentSites(REPO_ROOT)).toEqual([]);
    } else {
      expect(pendingAbsentSites(REPO_ROOT).map((s) => s.file)).toContain(cursorSite.file);
    }
    expect(pinValueViolations(REPO_ROOT)).toEqual([]);
  });

  test("full-ai-cluster/usb-nixos-installer carries no flake of its own", () => {
    expect(trackedFlakes(REPO_ROOT)).not.toContain("full-ai-cluster/usb-nixos-installer/flake.nix");
  });

  test("the canonical pin is readable and well-formed", () => {
    const canonical = readPinAt(REPO_ROOT, PIN_SITES[0]!);
    expect(canonical).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("allViolations is empty on main", () => {
    expect(allViolations(REPO_ROOT)).toEqual([]);
  });
});
