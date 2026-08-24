#!/usr/bin/env bun
// Tests for the pure core of the Touch ID sudo installer/verifier.
//
// These run on ubuntu in CI (installer-unit-tests.yml), and that is the whole
// reason `assess()` takes injected READ DOORS rather than touching /etc: the
// LIVE check only means anything on a Mac, but the brain that decides RED vs
// GREEN is a total function, so the OS-update-revert case can be pinned as a
// fixture here instead of only becoming observable on a Mac after an update.
//
// Shape borrowed from src/Core.TypeScript/pam/auth-chain.test.ts, whose `read`
// door this ultimately feeds.

import { describe, expect, test } from "bun:test";
import {
  assess,
  brewManifestDeclares,
  denyingControlLines,
  hasActiveAuthModule,
  includesSudoLocal,
  machoArchs,
  moduleBasename,
  parsePamFile,
  renderSudoLocal,
  type TouchIdEnv,
} from "./touchid-sudo-config.ts";

/** Apple's stock /etc/pam.d/sudo on macOS 14+ -- verbatim, including the include line. */
const STOCK_SUDO = `# sudo: auth account password session
auth       include        sudo_local
auth       sufficient     pam_smartcard.so
auth       required       pam_opendirectory.so
account    required       pam_permit.so
password   required       pam_deny.so
session    required       pam_permit.so
`;

/** The fragile shape MEASURED on the fleet Mac 2026-08-24: pam_tid edited into /etc/pam.d/sudo. */
const DIRECT_EDIT_SUDO = `auth       sufficient     pam_tid.so\n${STOCK_SUDO}`;

/** Apple's shipped template -- the pam_tid line is present but COMMENTED OUT. */
const TEMPLATE_CONTENT = `# sudo_local: local config file which survives system update and is included for sudo
# uncomment following line to enable Touch ID for sudo
#auth       sufficient     pam_tid.so
`;

const PAM_TID = "/usr/lib/pam/pam_tid.so.2";
const REATTACH = "/opt/homebrew/lib/pam/pam_reattach.so";

/** A thin arm64 Mach-O header, so arch checks run on realistic bytes. */
function machoHeader(cpuType: number): Uint8Array {
  const b = new Uint8Array(16);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0xcffaedfe, false); // little-endian MH_MAGIC_64
  v.setUint32(4, cpuType, true);
  return b;
}
const ARM64_MACHO = machoHeader(0x0100000c);
const X64_MACHO = machoHeader(0x01000007);

/**
 * Build an env over a DESCRIBED filesystem. Absent paths THROW, exactly as the
 * real doors do -- so "unreadable" stays UNKNOWN and never degrades to "empty".
 */
function envOver(
  files: Readonly<Record<string, string>>,
  bins: Readonly<Record<string, Uint8Array>> = { [PAM_TID]: ARM64_MACHO, [REATTACH]: ARM64_MACHO },
  over: Partial<TouchIdEnv> = {},
): TouchIdEnv {
  return {
    platform: "darwin",
    arch: "arm64",
    read: (path) => {
      const t = files[path];
      if (t === undefined) throw new Error(`ENOENT: ${path}`);
      return t;
    },
    readBytes: (path) => {
      const b = bins[path];
      if (b === undefined) throw new Error(`ENOENT: ${path}`);
      return b;
    },
    pamDir: "/etc/pam.d",
    pamTidModulePath: PAM_TID,
    reattachCandidates: [REATTACH, "/usr/local/lib/pam/pam_reattach.so"],
    reattachDeclared: true,
    insideMultiplexer: false,
    ...over,
  };
}

const DURABLE_FILES = {
  "/etc/pam.d/sudo": STOCK_SUDO,
  "/etc/pam.d/sudo_local.template": TEMPLATE_CONTENT,
  "/etc/pam.d/sudo_local": renderSudoLocal({ reattachModulePath: REATTACH }),
};

describe("literal-line helpers (a different question from chain resolution)", () => {
  test("comments and blanks are inactive; real lines are parsed", () => {
    expect(parsePamFile(STOCK_SUDO).filter((l) => l.active).length).toBe(6);
  });
  test("a COMMENTED module does not count as configured", () => {
    expect(hasActiveAuthModule(TEMPLATE_CONTENT, "pam_tid.so")).toBe(false);
  });
  test("module comparison is by basename, so bare and absolute forms agree", () => {
    expect(moduleBasename("/opt/homebrew/lib/pam/pam_reattach.so")).toBe("pam_reattach.so");
    expect(hasActiveAuthModule("auth optional /x/y/pam_reattach.so", "pam_reattach.so")).toBe(true);
  });
  test("Apple's stock sudo includes sudo_local; a pre-Sonoma one does not", () => {
    expect(includesSudoLocal(STOCK_SUDO)).toBe(true);
    expect(includesSudoLocal(STOCK_SUDO.replace("auth       include        sudo_local\n", ""))).toBe(false);
  });
});

describe("assess -- the four machine states", () => {
  test("durable: sudo_local carries pam_tid and the chain reaches it", () => {
    const a = assess(envOver(DURABLE_FILES));
    expect(a.status).toBe("durable");
    expect(a.red).toBe(false);
  });

  test("fragile: Touch ID only via a direct edit to /etc/pam.d/sudo -- RED", () => {
    const a = assess(
      envOver({
        "/etc/pam.d/sudo": DIRECT_EDIT_SUDO,
        "/etc/pam.d/sudo_local.template": TEMPLATE_CONTENT,
      }),
    );
    expect(a.status).toBe("fragile");
    expect(a.red).toBe(true);
    expect(a.findings.some((f) => f.message.includes("replaces that file on OS updates"))).toBe(true);
  });

  test("absent: nothing configured anywhere -- RED", () => {
    const a = assess(
      envOver({
        "/etc/pam.d/sudo": STOCK_SUDO,
        "/etc/pam.d/sudo_local.template": TEMPLATE_CONTENT,
      }),
    );
    expect(a.status).toBe("absent");
    expect(a.red).toBe(true);
  });

  test("unsupported: no include and no template -- refuses rather than half-applying", () => {
    const a = assess(
      envOver({
        "/etc/pam.d/sudo": STOCK_SUDO.replace("auth       include        sudo_local\n", ""),
      }),
    );
    expect(a.status).toBe("unsupported");
    expect(a.findings[0]?.message).toContain("refuses");
  });

  test("unsupported: not macOS, and it says so rather than implying portability", () => {
    const a = assess(envOver(DURABLE_FILES, undefined, { platform: "linux" }));
    expect(a.status).toBe("unsupported");
    expect(a.red).toBe(false);
    expect(a.findings[0]?.message).toContain("macOS-only");
  });

  test("pam_tid module missing: cannot be durable however the file reads", () => {
    const a = assess(envOver(DURABLE_FILES, {}));
    expect(a.red).toBe(true);
    expect(a.findings.some((f) => f.message.includes("cannot do Touch ID sudo at all"))).toBe(true);
  });
});

describe("assess -- the OS-update revert, which is the reason this exists", () => {
  test("update DELETES sudo_local: durable -> RED", () => {
    expect(assess(envOver(DURABLE_FILES)).red).toBe(false);
    const after = assess(
      envOver({
        "/etc/pam.d/sudo": STOCK_SUDO,
        "/etc/pam.d/sudo_local.template": TEMPLATE_CONTENT,
      }),
    );
    expect(after.status).toBe("absent");
    expect(after.red).toBe(true);
  });

  test("update CLOBBERS sudo_local back to the shipped template: RED, and named as such", () => {
    const after = assess(
      envOver({
        "/etc/pam.d/sudo": STOCK_SUDO,
        "/etc/pam.d/sudo_local.template": TEMPLATE_CONTENT,
        "/etc/pam.d/sudo_local": TEMPLATE_CONTENT,
      }),
    );
    expect(after.status).toBe("absent");
    expect(after.red).toBe(true);
    expect(after.findings.some((f) => f.message.includes("silent OS-update revert"))).toBe(true);
  });

  test("update strips the FRAGILE direct edit but sudo_local survives -- correctly still GREEN", () => {
    // This is the case the whole design is for: the machine is updated, the hand
    // edit to /etc/pam.d/sudo is gone, and Touch ID keeps working.
    expect(assess(envOver(DURABLE_FILES)).status).toBe("durable");
  });

  test("a correct sudo_local is NOT green if the include vanished -- inert is not configured", () => {
    const a = assess(
      envOver({
        "/etc/pam.d/sudo": STOCK_SUDO.replace("auth       include        sudo_local\n", ""),
        "/etc/pam.d/sudo_local.template": TEMPLATE_CONTENT,
        "/etc/pam.d/sudo_local": renderSudoLocal({}),
      }),
    );
    expect(a.red).toBe(true);
  });
});

describe("renderSudoLocal", () => {
  test("deterministic -- identical inputs give byte-identical output (idempotency rests on it)", () => {
    expect(renderSudoLocal({ reattachModulePath: REATTACH })).toBe(renderSudoLocal({ reattachModulePath: REATTACH }));
  });
  test("pam_reattach is emitted BEFORE pam_tid, or the tmux prompt cannot appear", () => {
    const out = renderSudoLocal({ reattachModulePath: REATTACH });
    expect(out.indexOf("pam_reattach.so")).toBeLessThan(out.indexOf("pam_tid.so"));
  });
  test("pam_reattach is omitted entirely when not installed -- never referenced blind", () => {
    expect(renderSudoLocal({ reattachModulePath: null })).not.toContain("pam_reattach");
  });
  test("LOCKOUT IMPOSSIBILITY: no rendering ever emits a control that can DENY auth", () => {
    for (const p of [null, REATTACH, "/usr/local/lib/pam/pam_reattach.so"]) {
      expect(denyingControlLines(renderSudoLocal({ reattachModulePath: p }))).toEqual([]);
    }
  });
  test("and that check is not vacuous -- a `required` line IS caught", () => {
    expect(denyingControlLines("auth required pam_tid.so").length).toBe(1);
    expect(denyingControlLines("auth requisite pam_tid.so").length).toBe(1);
    expect(denyingControlLines("auth sufficient pam_tid.so").length).toBe(0);
    expect(denyingControlLines("auth optional pam_reattach.so").length).toBe(0);
  });
});

describe("machoArchs -- 'present' is not 'loadable'", () => {
  test("thin arm64 / thin x86_64", () => {
    expect(machoArchs(ARM64_MACHO)).toEqual(["arm64"]);
    expect(machoArchs(X64_MACHO)).toEqual(["x64"]);
  });
  test("universal binary reports both slices", () => {
    const b = new Uint8Array(8 + 20 * 2);
    const v = new DataView(b.buffer);
    v.setUint32(0, 0xcafebabe, false);
    v.setUint32(4, 2, false);
    v.setUint32(8, 0x01000007, false);
    v.setUint32(28, 0x0100000c, false);
    expect(machoArchs(b)).toEqual(["x64", "arm64"]);
  });
  test("unrecognised bytes stay UNKNOWN rather than becoming a false verdict", () => {
    expect(machoArchs(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toEqual([]);
  });
  test("an x86_64-only pam_reattach on an arm64 Mac is reported as unloadable", () => {
    const a = assess(
      envOver(
        { ...DURABLE_FILES, "/etc/pam.d/sudo_local": renderSudoLocal({ reattachModulePath: REATTACH }) },
        { [PAM_TID]: ARM64_MACHO, [REATTACH]: X64_MACHO },
      ),
    );
    expect(a.findings.some((f) => f.message.includes("PAM cannot load it"))).toBe(true);
  });
  test("a matching-arch pam_reattach raises no arch complaint", () => {
    const a = assess(
      envOver(
        { ...DURABLE_FILES, "/etc/pam.d/sudo_local": renderSudoLocal({ reattachModulePath: REATTACH }) },
        { [PAM_TID]: ARM64_MACHO, [REATTACH]: ARM64_MACHO },
      ),
    );
    expect(a.findings.some((f) => f.message.includes("PAM cannot load it"))).toBe(false);
    expect(a.status).toBe("durable");
  });
});

describe("no-prompt guarantee -- structural, not observational", () => {
  // "It did not prompt when I ran it" is a weak claim: a cached sudo timestamp
  // produces exactly that observation on a machine where the check DOES prompt.
  // The claim made here is stronger and does not depend on any run -- the module
  // holds no capability to prompt, because a prompt needs an exec port or a
  // LocalAuthentication binding and it imports neither.
  test("the pure core's only import is the shared PAM chain parser", async () => {
    const src = await Bun.file(new URL("./touchid-sudo-config.ts", import.meta.url)).text();
    const imports = src.split("\n").filter((l) => /^\s*import\s/u.test(l));
    expect(imports).toEqual(['import { analyzePamAuthChain } from "../../src/Core.TypeScript/pam/auth-chain.ts";']);
  });

  test("and it cannot acquire an exec capability dynamically", async () => {
    const src = await Bun.file(new URL("./touchid-sudo-config.ts", import.meta.url)).text();
    for (const forbidden of ["Bun.spawn", "spawnSync", "execSync", "child_process", "dlopen", "require("]) {
      expect(src.includes(forbidden)).toBe(false);
    }
  });

  test("the LIVE adapter's env builder spawns nothing and names no auth-requiring command", async () => {
    const src = await Bun.file(new URL("./touchid-sudo.ts", import.meta.url)).text();
    const builder = src.slice(src.indexOf("export function liveEnv"), src.indexOf("const SEVERITY_GLYPH"));
    expect(builder.length).toBeGreaterThan(100); // the slice actually found the function
    // The one exec in the file is the deliberate elevation inside apply(); it
    // must not be reachable from the verify path.
    expect(builder).not.toContain("spawnSync");
    for (const forbidden of ["sudo -n", "sfltool", "bioutil", "osascript", "security "]) {
      expect(builder.includes(forbidden)).toBe(false);
    }
  });
});

describe("pam_reattach -- the declared dependency, and the tmux half-truth", () => {
  const BASE = {
    "/etc/pam.d/sudo": STOCK_SUDO,
    "/etc/pam.d/sudo_local.template": TEMPLATE_CONTENT,
    "/etc/pam.d/sudo_local": renderSudoLocal({ reattachModulePath: REATTACH }),
  };

  test("DECLARED and MISSING is drift -- RED even though sudo_local is perfect", () => {
    // This is the state measured on the maintainer's host 2026-08-24: pam_tid
    // configured, no pam_reattach .so at either Homebrew prefix. Touch ID sudo
    // is silently inert in tmux, which is where agent work runs.
    const a = assess(envOver(BASE, { [PAM_TID]: ARM64_MACHO }));
    expect(a.status).toBe("durable");
    expect(a.red).toBe(true);
    expect(a.multiplexerReady).toBe(false);
    expect(
      a.findings.some((f) => f.severity === "error" && f.message.includes("DECLARED in tools/setup/manifests/brew")),
    ).toBe(true);
  });

  test("UNDECLARED and missing is only an observation -- not RED", () => {
    // Nothing promised the module would be there, so its absence is not drift.
    const a = assess(envOver(BASE, { [PAM_TID]: ARM64_MACHO }, { reattachDeclared: false }));
    expect(a.red).toBe(false);
    expect(a.multiplexerReady).toBe(false);
    expect(a.findings.some((f) => f.severity === "error")).toBe(false);
  });

  test("installed AND wired -> multiplexerReady, GREEN", () => {
    const a = assess(envOver(BASE));
    expect(a.status).toBe("durable");
    expect(a.red).toBe(false);
    expect(a.multiplexerReady).toBe(true);
  });

  test("installed but NOT wired into sudo_local -> not ready, and says re-run --apply", () => {
    const a = assess(envOver({ ...BASE, "/etc/pam.d/sudo_local": renderSudoLocal({}) }));
    expect(a.multiplexerReady).toBe(false);
    expect(a.findings.some((f) => f.message.includes("not referenced in sudo_local"))).toBe(true);
  });

  test("wrong-arch module is present but unloadable -> not ready", () => {
    const a = assess(envOver(BASE, { [PAM_TID]: ARM64_MACHO, [REATTACH]: X64_MACHO }));
    expect(a.multiplexerReady).toBe(false);
    expect(a.findings.some((f) => f.message.includes("PAM cannot load it"))).toBe(true);
  });
});

describe("brewManifestDeclares -- parsed the way macos.sh parses it", () => {
  test("matches a bare row, ignores comments, and drops a tier= token", () => {
    const manifest = [
      "# a comment mentioning pam-reattach should NOT count",
      "",
      "opam tier=standard  # OCaml package manager",
      "pam-reattach  # PAM module: re-attach to the Aqua session",
    ].join("\n");
    expect(brewManifestDeclares(manifest, "pam-reattach")).toBe(true);
    expect(brewManifestDeclares(manifest, "opam")).toBe(true);
    expect(brewManifestDeclares(manifest, "never-declared")).toBe(false);
  });

  test("a commented-out row does not count as declared", () => {
    expect(brewManifestDeclares("# pam-reattach", "pam-reattach")).toBe(false);
  });

  test("THE REAL MANIFEST declares pam-reattach -- the row and the verifier agree", async () => {
    // Parity: if someone deletes the manifest row, this fails rather than the
    // verifier quietly downgrading drift to an observation.
    const text = await Bun.file(new URL("./manifests/brew", import.meta.url)).text();
    expect(brewManifestDeclares(text, "pam-reattach")).toBe(true);
  });
});
