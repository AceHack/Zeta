import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const MISE_TOML = join(REPO_ROOT, ".mise.toml");
const MISE_FULL_TOML = join(REPO_ROOT, ".mise.full.toml");
const WASM_SCRIPT = join(REPO_ROOT, "tools", "setup", "common", "install-rust-wasm32.sh");
const RETIRED_COMPONENTS_SCRIPT = join(REPO_ROOT, "tools", "setup", "common", "ensure-rust-components.sh");

interface RustToolDeclaration {
  readonly version?: string;
  readonly components?: readonly string[];
  readonly targets?: readonly string[];
}

function rustDeclarationIn(configPath: string): RustToolDeclaration {
  const parsed = Bun.TOML.parse(readFileSync(configPath, "utf8")) as {
    tools?: Record<string, RustToolDeclaration | string | undefined>;
  };
  const rust = parsed.tools?.rust;
  // TOML has no null, so a non-object here is the bare `rust = "1.87.0"` pin
  // (or a missing entry) — exactly the regression these tests exist to catch.
  if (typeof rust !== "object") {
    throw new Error(
      `${configPath} declares rust as ${JSON.stringify(rust)} — expected a table carrying components + targets`,
    );
  }
  return rust;
}

function rustDeclaration(): RustToolDeclaration {
  return rustDeclarationIn(MISE_TOML);
}

function writeCommand(bin: string, name: string, body: string): void {
  writeFileSync(join(bin, name), `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`, { mode: 0o755 });
}

function runScript(script: string, bin: string, home: string, log: string) {
  return spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      PATH: `${bin}:/usr/bin:/bin`,
      RUSTUP_CALL_LOG: log,
    },
  });
}

function withFakeCommands(run: (bin: string, home: string, log: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "zeta-rust-setup-"));
  const bin = join(root, "bin");
  const log = join(root, "rustup.log");
  mkdirSync(bin);
  try {
    run(bin, root, log);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// 081M05X126V087G0R0014GR9KQ: rustfmt/clippy/wasm32 used to be provisioned by a
// post-`mise install` shell top-up (`ensure-rust-components.sh`) plus a comment
// instructing a human to run `rustup target add`. Both are retired; the single
// declaration in .mise.toml is now the mechanism, and these are its falsifiers —
// they fail if the rust entry is reverted to a bare version string.
describe("Rust toolchain provisioning is DECLARED, not topped up by shell", () => {
  test("the rust entry declares rustfmt and clippy as components", () => {
    expect(rustDeclaration().components).toEqual(["rustfmt", "clippy"]);
  });

  test("the rust entry declares the wasm32-unknown-unknown target", () => {
    expect(rustDeclaration().targets).toEqual(["wasm32-unknown-unknown"]);
  });

  test("the pinned version survives the move from string to table form", () => {
    expect(rustDeclaration().version).toBe("1.87.0");
  });

  // Measured on mise 2026.6.14 while landing this change: `.mise.full.toml` is
  // loaded alongside `.mise.toml` and its `tools.rust` entry WINS. A bare
  // `rust = "1.87.0"` mirror there resolved `mise config get tools.rust` back to
  // the plain string — silently disarming the components/targets below on every
  // host carrying both files. So the mirror must be identical, not merely present.
  test("the full-tier mirror carries the same declaration (a partial mirror OVERRIDES the base)", () => {
    const base = rustDeclaration();
    const full = rustDeclarationIn(MISE_FULL_TOML);
    expect(full.version).toBe(base.version);
    expect(full.components).toEqual(base.components);
    expect(full.targets).toEqual(base.targets);
  });

  test("no post-install shell top-up is reintroduced", () => {
    expect(existsSync(RETIRED_COMPONENTS_SCRIPT)).toBe(false);
    const miseSetup = readFileSync(join(REPO_ROOT, "tools", "setup", "common", "mise.sh"), "utf8");
    const executableLines = miseSetup
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    expect(executableLines).not.toContain("ensure-rust-components.sh");
    expect(executableLines).not.toContain("rustup component add");
    expect(executableLines).not.toContain("rustup target add");
  });
});

describe("Rust setup stays offline when the cache is complete", () => {
  // install-rust-wasm32.sh is RETAINED: tools/setup/linux.sh calls it on the
  // no-mise cluster-bootstrap path, where the .mise.toml declaration cannot run.
  test("installed Rust and wasm target do not mutate the rustup default", () => {
    withFakeCommands((bin, home, log) => {
      writeCommand(bin, "rustc", 'echo "rustc 1.87.0"');
      writeCommand(
        bin,
        "rustup",
        'case "$*" in "--version") echo "rustup 1.28.2" ;; "toolchain list") echo "1.87.0-x86_64-unknown-linux-gnu" ;; "target list --installed") echo "wasm32-unknown-unknown" ;; *) echo "$*" >> "$RUSTUP_CALL_LOG"; exit 99 ;; esac',
      );

      const result = runScript(WASM_SCRIPT, bin, home, log);
      if (result.status !== 0) {
        const rustupCalls = existsSync(log) ? readFileSync(log, "utf8") : "(none)";
        throw new Error(
          `WASM setup failed:\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}\nrustup calls:\n${rustupCalls}`,
        );
      }
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Rust 1.87.0 + wasm32-unknown-unknown ready");
      expect(existsSync(log)).toBe(false);
    });
  });
});
