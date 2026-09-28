/**
 * discovery-nonresult-shell-parity.test.ts — 081M3HP7KKH087G0R0011NQAKF.
 *
 * On an undeclared-role box, a discovery probe that COULD NOT RUN
 * (probe-failed, dwell-too-short, missing binary, unexpected exit) used to fall
 * back to the ISO default role, control-plane — i.e. FOUND a cluster on a
 * segment nobody observed. On a second machine that is split-brain. The default
 * is now to HALT and ask for c/w; `ZETA_DISCOVERY_REQUIRED=0` restores the old
 * fallback, and `ZETA_DISCOVERY=off` (an operator's choice) still falls back.
 *
 * The two pure decisions are extracted VERBATIM from zeta-first-boot.sh
 * (ZETA-DISCOVERY-NONRESULT-BEGIN/END) and run under a real bash; the call-site
 * wiring is pinned as text with comments stripped.
 */

import { describe, expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const SRC = readFileSync(join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh"), "utf8");
const BEGIN = "# ZETA-DISCOVERY-NONRESULT-BEGIN";
const END = "# ZETA-DISCOVERY-NONRESULT-END";

function code(text: string): string {
  return text
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
}

function call(fn: string, args: readonly string[]): string {
  const b = SRC.indexOf(BEGIN);
  const e = SRC.indexOf(END);
  if (b < 0 || e < b) throw new Error("ZETA-DISCOVERY-NONRESULT markers missing or out of order in zeta-first-boot.sh");
  const workdir = mkdtempSync(join(tmpdir(), "zeta-discovery-nonresult-"));
  writeFileSync(join(workdir, "block.sh"), SRC.slice(b, e + END.length) + "\n", "utf8");
  const quoted = args.map((a) => `'${a}'`).join(" ");
  writeFileSync(join(workdir, "runner.sh"), `set -euo pipefail\nsource ./block.sh\n${fn} ${quoted}\n`, "utf8");
  const r = spawnSync("bash", ["runner.sh"], { cwd: workdir, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`bash exited ${String(r.status)}: ${r.stderr}`);
  return r.stdout.trim();
}

describe("zeta_discovery_nonresult_decision — executed", () => {
  it("DEFAULT (required=1): a probe that could not run ASKS, it does not found a cluster", () => {
    expect(call("zeta_discovery_nonresult_decision", ["1", "probe"])).toBe("ask");
  });

  it("required=0 keeps the old fallback (the named escape hatch)", () => {
    expect(call("zeta_discovery_nonresult_decision", ["0", "probe"])).toBe("fallback");
  });

  it("ZETA_DISCOVERY=off was the operator's choice: it falls back even when required", () => {
    expect(call("zeta_discovery_nonresult_decision", ["1", "off"])).toBe("fallback");
  });
});

describe("zeta_discovery_key_decision — executed", () => {
  it("c founds, w joins, either case", () => {
    expect(call("zeta_discovery_key_decision", ["c"])).toBe("control-plane");
    expect(call("zeta_discovery_key_decision", ["C"])).toBe("control-plane");
    expect(call("zeta_discovery_key_decision", ["w"])).toBe("worker");
    expect(call("zeta_discovery_key_decision", ["W"])).toBe("worker");
  });

  it("anything else — including no key at all (EOF, no terminal) — is a shell, never a default", () => {
    expect(call("zeta_discovery_key_decision", ["x"])).toBe("shell");
    expect(call("zeta_discovery_key_decision", [""])).toBe("shell");
  });
});

describe("zeta-first-boot.sh — wiring", () => {
  const src = code(SRC);

  it("the default is REQUIRED=1", () => {
    expect(src).toContain('ZETA_DISCOVERY_REQUIRED="${ZETA_DISCOVERY_REQUIRED:-1}"');
  });

  it("the off arm passes kind=off, so the operator's choice is not halted on", () => {
    expect(src).toContain('zeta_discovery_could_not_run "disabled by ZETA_DISCOVERY=off" off');
  });

  it("the ask reads ONE key with NO timeout — a timeout would be a default, and the default is the split-brain", () => {
    const fn = src.slice(src.indexOf("zeta_discovery_could_not_run() {"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    expect(body).toContain('zeta_discovery_nonresult_decision "${ZETA_DISCOVERY_REQUIRED}"');
    expect(body).toMatch(/read -n 1 -s key/);
    expect(body).not.toMatch(/read [^\n]*-t /);
    expect(body).toContain('ZETA_ROLE_SOURCE="keystroke:c"');
    expect(body).toContain('ZETA_ROLE_SOURCE="keystroke:w"');
    expect(body).toContain("drop_to_shell");
    expect(body).toContain("[zeta-discovery] HALTED");
  });
});
