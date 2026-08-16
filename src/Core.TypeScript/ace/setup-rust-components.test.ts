import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const COMPONENTS_SCRIPT = join(REPO_ROOT, "tools", "setup", "common", "ensure-rust-components.sh");
const WASM_SCRIPT = join(REPO_ROOT, "tools", "setup", "common", "install-rust-wasm32.sh");

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

describe("Rust setup stays offline when the cache is complete", () => {
  test("installed rustfmt and clippy skip rustup component add", () => {
    withFakeCommands((bin, home, log) => {
      writeCommand(bin, "rustc", 'echo "rustc 1.87.0"');
      writeCommand(bin, "rustfmt", 'echo "rustfmt 1.8.0"');
      writeCommand(bin, "cargo", 'test "${1:-}" = "clippy" && echo "clippy 0.1.87"');
      writeCommand(bin, "rustup", 'echo "$*" >> "$RUSTUP_CALL_LOG"; exit 99');

      const result = runScript(COMPONENTS_SCRIPT, bin, home, log);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("rustfmt and clippy already available");
      expect(existsSync(log)).toBe(false);
    });
  });

  test("a missing component installs against the exact rustc toolchain", () => {
    withFakeCommands((bin, home, log) => {
      writeCommand(
        bin,
        "rustc",
        'if [ "${1:-}" = "-vV" ]; then printf "release: 1.87.0\\nhost: x86_64-unknown-linux-gnu\\n"; else echo "rustc 1.87.0"; fi',
      );
      writeCommand(bin, "rustfmt", "exit 1");
      writeCommand(bin, "cargo", 'test "${1:-}" = "clippy" && echo "clippy 0.1.87"');
      writeCommand(bin, "rustup", 'echo "$*" >> "$RUSTUP_CALL_LOG"');

      const result = runScript(COMPONENTS_SCRIPT, bin, home, log);
      expect(result.status).toBe(0);
      expect(readFileSync(log, "utf8").trim()).toBe(
        "component add --toolchain 1.87.0-x86_64-unknown-linux-gnu rustfmt clippy",
      );
    });
  });

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
