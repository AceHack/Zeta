// mise-pin-parity.test.ts — 081KZKS9A6B08QG0R0008EG72M
//
// Two layers, deliberately:
//   - fixture tests prove the checker GOES RED when a pin is mutated or an
//     un-overlaid installer flake is re-added (a check that cannot fail is not
//     a check — toy-is-free-metered-must-be-earned);
//   - live-repo tests prove main is actually clean right now.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CANONICAL_PIN_FILE,
  INSTALLER_CONFIG_MARKER,
  MISE_PIN_OVERLAY_MARKER,
  PIN_SITES,
  allViolations,
  installerOverlayViolations,
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
