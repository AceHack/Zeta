/**
 * wp11-lbpool-shell-parity.test.ts - the guest-side `lb-pool:` note of
 * `zeta-first-boot-k3s-verify.nix`.
 *
 * Extracts the two pure decision functions VERBATIM from the real module (between
 * ZETA-WP11-LBPOOL-BEGIN/END) and runs them under bash, the same harness and reason as
 * wp11-nobadpods-shell-parity.test.ts: the surrounding unit only evaluates inside a Nix build,
 * so this is the only thing that can execute the real decision logic.
 *
 * THE LOAD-BEARING DISTINCTION: a probe that could not ASK (API unreachable, timeout, a missing
 * binary) is UNKNOWN; only an API that ANSWERED "not found" is a miss. Folding the first into the
 * second is the failed-probe-reported-as-negative defect that verdict 7's own collection shipped
 * once (081M3BP768B087G0R0010C6GPR).
 *
 * PATHS: bare relative names under `cwd: workdir`; see wp11-nobadpods-shell-parity.test.ts for the
 * Windows backslash incident that rule exists for.
 */

import { describe, expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const SRC = readFileSync(join(REPO_ROOT, "full-ai-cluster/nixos/modules/zeta-first-boot-k3s-verify.nix"), "utf8");
const BEGIN = "# ZETA-WP11-LBPOOL-BEGIN";
const END = "# ZETA-WP11-LBPOOL-END";

function extractBlock(): string {
  const b = SRC.indexOf(BEGIN);
  const e = SRC.indexOf(END);
  if (b < 0) throw new Error(`${BEGIN} marker missing from zeta-first-boot-k3s-verify.nix`);
  if (e < 0) throw new Error(`${END} marker missing from zeta-first-boot-k3s-verify.nix`);
  if (e < b) throw new Error("ZETA-WP11-LBPOOL markers out of order in zeta-first-boot-k3s-verify.nix");
  // Undo exactly the Nix indented-string escape for a shell variable, and nothing else.
  return SRC.slice(b, e + END.length).replaceAll("''${", "${");
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-wp11-lbpool-"));
writeFileSync(join(workdir, "block.sh"), `${extractBlock()}\n`, "utf8");

function runShell(script: string): string {
  writeFileSync(join(workdir, "runner.sh"), `set -uo pipefail\nsource ./block.sh\n${script}\n`, "utf8");
  const r = spawnSync("bash", ["runner.sh"], { cwd: workdir, encoding: "utf8" });
  if (r.error !== undefined) throw r.error;
  if (r.status !== 0) throw new Error(`bash exited ${String(r.status)}: ${r.stderr}`);
  return r.stdout;
}

/** POSIX single-quote a value for a bash script string. */
const shq = (v: string): string => `'${v.replaceAll("'", `'\\''`)}'`;

const cls = (rc: number, stderr: string): string => runShell(`zeta_wp11_lb_probe_class ${rc} ${shq(stderr)}`).trim();

const RANGE = "10.0.2.240-10.0.2.250";

function verdict(expected: string, app: string, pool: string, blocks: string): { state: string; detail: string } {
  const out = runShell(
    `zeta_wp11_lb_pool_verdict ${shq(expected)} ${shq(app)} ${shq(pool)} ${shq(blocks)}`,
  ).replace(/\n$/u, "");
  const [state = "", ...rest] = out.split("\t");
  return { state, detail: rest.join("\t") };
}

describe("zeta_wp11_lb_probe_class: ASKED and answered vs could not ask", () => {
  it("exit 0 is present", () => {
    expect(cls(0, "")).toBe("present");
  });

  it("an API that answered NotFound is absent", () => {
    expect(cls(1, 'Error from server (NotFound): applications.argoproj.io "cilium-lb-ipam-pool" not found')).toBe("absent");
  });

  it("a missing CRD is an answer too: the type does not exist, so the object cannot", () => {
    expect(cls(1, 'error: the server doesn\'t have a resource type "ciliumloadbalancerippools"')).toBe("absent");
    expect(cls(1, 'error: no matches for kind "CiliumLoadBalancerIPPool" in version "cilium.io/v2alpha1"')).toBe("absent");
  });

  it("an unreachable API is UNKNOWN, never absent", () => {
    expect(cls(1, "The connection to the server 127.0.0.1:6443 was refused - did you specify the right host or port?")).toBe("unknown");
    expect(cls(1, "Unable to connect to the server: net/http: request canceled (Client.Timeout exceeded while awaiting headers)")).toBe("unknown");
    expect(cls(1, "error: You must be logged in to the server (Unauthorized)")).toBe("unknown");
  });

  it("a MISSING BINARY is UNKNOWN: `command not found` must not read as `object not found`", () => {
    expect(cls(127, "/nix/store/x/bin/k3s: line 1: kubectl: command not found")).toBe("unknown");
  });

  it("empty stderr with a failing exit is UNKNOWN", () => {
    expect(cls(1, "")).toBe("unknown");
  });
});

describe("zeta_wp11_lb_pool_verdict: ok | fail | unknown | not-configured", () => {
  it("ok only when the Application exists AND the pool lists exactly the installed range", () => {
    expect(verdict(RANGE, "present", "present", RANGE).state).toBe("ok");
  });

  it("no /etc/zeta/lb-pool is its own state, not a pass and not a probe result", () => {
    expect(verdict("", "absent", "absent", "").state).toBe("not-configured");
    expect(verdict("", "present", "present", RANGE).state).toBe("not-configured");
  });

  it("FAIL: the API answered and the Application is absent", () => {
    const v = verdict(RANGE, "absent", "unknown", "");
    expect(v.state).toBe("fail");
    expect(v.detail).toContain("cilium-lb-ipam-pool");
  });

  it("FAIL: the API answered and the pool is absent", () => {
    const v = verdict(RANGE, "present", "absent", "");
    expect(v.state).toBe("fail");
    expect(v.detail).toContain("zeta-lb-pool");
  });

  it("FAIL: the pool exists but lists no block (the range never reached it)", () => {
    expect(verdict(RANGE, "present", "present", "").state).toBe("fail");
  });

  it("FAIL: the pool lists a different block than the installer wrote", () => {
    const v = verdict(RANGE, "present", "present", "192.168.1.240-192.168.1.250");
    expect(v.state).toBe("fail");
    expect(v.detail).toContain("192.168.1.240-192.168.1.250");
  });

  it("UNKNOWN when the API could not be asked on either object, and it SAYS it is neither pass nor miss", () => {
    const v = verdict(RANGE, "unknown", "unknown", "");
    expect(v.state).toBe("unknown");
    expect(v.detail).toContain("NOT a pass and NOT a miss");
  });

  it("a definite miss on one object wins over UNKNOWN on the other: an answered API is evidence", () => {
    expect(verdict(RANGE, "unknown", "absent", "").state).toBe("fail");
    expect(verdict(RANGE, "absent", "unknown", "").state).toBe("fail");
  });

  it("UNKNOWN on the Application alone does not hide a verified pool, but is still not ok", () => {
    expect(verdict(RANGE, "unknown", "present", RANGE).state).toBe("unknown");
  });
});

describe("the unit wires the block in", () => {
  it("calls collect_lb_pool_facts, logs the note, and carries it in the verdict JSON", () => {
    expect(SRC).toContain("collect_lb_pool_facts");
    expect(SRC).toContain("[wp11-k3s-verify] lb-pool: state=");
    expect(SRC).toContain("--arg lbPoolState");
  });

  it("does not renumber the verdicts: it is a note beside verdict 7, not an eighth verdict", () => {
    expect(SRC).not.toContain("verdict 8/");
    expect(SRC).toContain("verdict 7/7");
  });
});
