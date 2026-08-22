// lint-nixos-rebuild-needs-impure.test.ts
//
// A guard that cannot fire is not a guard, so the firing cases come first and the
// silence cases come second. Both halves matter: a lint that flagged every mention
// of the word `nixos-rebuild` would be switched off within a week, and a switched-off
// guard is the silent revert arriving on schedule.
//
// The last block is the one that would have caught the real defect: it runs the lint
// over the ACTUAL tree, so a future `nixos-rebuild --flake` string added anywhere
// under full-ai-cluster/ without `--impure` reds this suite.

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import {
  IMPURE_FLAG,
  NIXOS_REBUILD_FLAKE,
  SCANNED_EXTENSIONS,
  SCANNED_SURFACES,
  scanSurfaces,
  scanText,
} from "./lint-nixos-rebuild-needs-impure.ts";

describe("fires on a flake rebuild with no --impure", () => {
  const cases = [
    "  sudo nixos-rebuild switch --flake /etc/zeta/full-ai-cluster#control-plane",
    'echo "    sudo nixos-rebuild switch --flake /etc/zeta/full-ai-cluster#$HOST"',
    "nixos-rebuild build --flake .#worker-gpu",
    "`nixos-rebuild switch --flake .#<host> --target-host <host>`",
    "# sudo nixos-rebuild switch --flake /etc/zeta/full-ai-cluster#<host>",
    "nixos-rebuild test --flake github:Lucent-Financial-Group/Zeta?dir=full-ai-cluster#control-plane",
  ];
  for (const line of cases) {
    test(`fires on: ${line.trim().slice(0, 60)}`, () => {
      expect(scanText("f.sh", line)).toHaveLength(1);
    });
  }

  test("the exact string the installer used to print is a violation", () => {
    // zeta-install.sh's closing instruction, verbatim as it stood before this change.
    const found = scanText(
      "zeta-install.sh",
      'echo "    sudo nixos-rebuild switch --flake /etc/zeta/full-ai-cluster#$HOST"',
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(1);
    expect(found[0]?.text).toContain("nixos-rebuild");
  });

  test("reports the 1-based line number of the offending line, not the file", () => {
    const found = scanText("m.md", ["intro", "prose", "nixos-rebuild switch --flake .#h", "tail"].join("\n"));
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(3);
  });
});

describe("stays silent where it should", () => {
  const quiet = [
    // The flag present, in either order.
    "sudo nixos-rebuild switch --impure --flake /etc/zeta/full-ai-cluster#control-plane",
    "sudo nixos-rebuild switch --flake /etc/zeta/full-ai-cluster#control-plane --impure",
    // No flake ref: a legacy /etc/nixos rebuild is impure already.
    "sudo nixos-rebuild switch",
    "echo 'run nixos-rebuild after editing configuration.nix'",
    // Prose about the module, not a command.
    "# Subsequent nixos-rebuilds (file persists; activation re-applies)",
    // A different tool entirely.
    "nix build .#installer-iso",
    "nixos-install --impure --flake /mnt/etc/zeta/full-ai-cluster#$HOST",
    "",
  ];
  for (const line of quiet) {
    test(`silent on: ${line.trim().slice(0, 60) || "(empty line)"}`, () => {
      expect(scanText("f.sh", line)).toHaveLength(0);
    });
  }
});

describe("the matchers themselves", () => {
  test("NIXOS_REBUILD_FLAKE needs both the tool and a flake ref", () => {
    expect(NIXOS_REBUILD_FLAKE.test("nixos-rebuild switch --flake .#h")).toBe(true);
    expect(NIXOS_REBUILD_FLAKE.test("nixos-rebuild switch")).toBe(false);
    expect(NIXOS_REBUILD_FLAKE.test("nix build --flake .#h")).toBe(false);
  });

  test("IMPURE_FLAG does not match a longer lookalike flag", () => {
    expect(IMPURE_FLAG.test("--impure")).toBe(true);
    expect(IMPURE_FLAG.test("--impureish")).toBe(false);
  });

  test("scanned extensions cover the surfaces that carry copyable commands", () => {
    for (const f of ["a.sh", "b.nix", "c.md", "d.txt", "e.yml", "f.yaml", "g.ps1"]) {
      expect(SCANNED_EXTENSIONS.test(f)).toBe(true);
    }
    expect(SCANNED_EXTENSIONS.test("h.png")).toBe(false);
  });
});

describe("the real tree", () => {
  test("full-ai-cluster/ exists, so the scan below is not vacuous", () => {
    expect(SCANNED_SURFACES.some((s) => existsSync(s))).toBe(true);
  });

  // THE FALSIFIER. Not a fixture: the shipped tree. Before this change it reported
  // EIGHT violations: README.md:90 and :258, PROVISIONING.md:316, flake.nix:369,
  // operator-ssh-keys.txt:13, and zeta-install.sh:1165/:1381/:2813 -- i.e. every
  // rebuild command the installer itself prints when it finishes.
  //
  // THE BUDGET IS DECLARED BECAUSE A BREACH HERE LIES. `scanSurfaces()` walks the shipped
  // tree, and bun's per-test cap is 5,000 ms that nobody chose -- `bunfig.toml` documents at
  // length that its `[test] timeout` key is inert. A timed-out test is reported by its NAME,
  // so a slow host prints
  //
  //     (fail) no flake rebuild command in the shipped tree omits --impure
  //
  // which states the exact opposite of what happened: it reads as a rebuild command missing
  // `--impure`, and sends a reader hunting a violation that is not there. MEASURED
  // 2026-08-22: this line timed out at 6473 ms on the fleet's machine in a full-suite run
  // while the tree was clean. The cause is the host, not the tree -- Microsoft Defender
  // real-time protection authorises every file open per (process, file), so the first pass
  // over the tree in a fresh process costs seconds there and ~350 ms after. CI has no such
  // scanner. 120,000 ms is inherited from `lint-no-culture-sensitive-collation.test.ts` for
  // the same whole-tree class, not tuned to a host.
  test(
    "no flake rebuild command in the shipped tree omits --impure",
    () => {
      const found = scanSurfaces();
      expect(found.map((v) => `${v.file}:${String(v.line)} ${v.text}`)).toEqual([]);
    },
    120_000,
  );
});
