/**
 * wp11-pressure-shell-parity.test.ts — 081M3K1K1XV087G0R002A6YFRS.
 *
 * WP11 run 36364782876 lost its API server at ~157 pods (14 of 62 roster probes
 * failed, then `connection refused` on 6443 while k3s.service stayed active),
 * and its serial log carried no journal or kernel lines — so a k3s restart
 * loop, an etcd stall, an OOM kill and reclaim thrash all read the same.
 * `zeta-first-boot-k3s-verify.nix` now captures, the first time the API stops
 * answering and again at the end: k3s NRestarts, `free -m`, PSI for
 * cpu/memory/io, kernel OOM lines, the live cgroup protection, and the last 200
 * k3s journal lines.
 *
 * THE LOAD-BEARING PROPERTY IS THE THIRD STATE. A capture has three outcomes —
 * `captured`, `failed` (named, with its exit status), `did-not-run` — and a
 * capture that FAILED must never read as one that found nothing. The sharp case
 * is the OOM section: "no OOM line" is evidence only when the kernel log was
 * actually read; a journalctl that failed has measured nothing.
 *
 * Same harness as `wp11-roster-shell-parity.test.ts`: the functions are
 * extracted VERBATIM from between the ZETA-WP11-PRESSURE-BEGIN/END markers of
 * the real module and run under real bash, with the system tools replaced by
 * fakes through the same variables the unit binds them to. Filenames inside
 * scripts are bare relative names (Windows paths carry backslashes).
 */

import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Each case forks bash a dozen times; on a Windows runner that alone measured >5 s.
setDefaultTimeout(60_000);

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const MODULE_PATH = join(REPO_ROOT, "full-ai-cluster/nixos/modules/zeta-first-boot-k3s-verify.nix");
const SRC = readFileSync(MODULE_PATH, "utf8");
const BEGIN = "# ZETA-WP11-PRESSURE-BEGIN";
const END = "# ZETA-WP11-PRESSURE-END";

function extractBlock(): string {
  const b = SRC.indexOf(BEGIN);
  const e = SRC.indexOf(END);
  if (b < 0 || e < 0 || e < b) throw new Error("ZETA-WP11-PRESSURE-BEGIN/END markers missing or out of order");
  const block = SRC.slice(b, e + END.length).replaceAll("''${", "${");
  if (/\$\{pkgs\./.test(block)) throw new Error("pressure block must not reference a Nix interpolation");
  return block;
}

/** Everything outside comments, so rationale can never satisfy a wiring check. */
const CODE = SRC.split("\n")
  .filter((l) => !/^\s*#/.test(l))
  .join("\n");

const FAKE_SYSTEMCTL = `#!/usr/bin/env bash
echo "NRestarts=4"
echo "ActiveState=active"
echo "SubState=running"
`;
const FAKE_FREE = `#!/usr/bin/env bash
echo "Mem:  12000  11800  200"
`;
/** `-k` reads the kernel log; KERNEL_LOG selects a readable log, one without OOM lines, or a failure. */
const FAKE_JOURNALCTL = `#!/usr/bin/env bash
case " $* " in
  *" -k "*)
    case "\${KERNEL_LOG:-oom}" in
      fail) echo "Failed to open journal" >&2; exit 1 ;;
      clean) echo "kernel: eth0: link up" ;;
      *) echo "kernel: eth0: link up"
         echo "kernel: Out of memory: Killed process 4242 (gitaly) total-vm:4GB"
         echo "kernel: oom_reaper: reaped process 4242 (gitaly)" ;;
    esac ;;
  *) echo "k3s[123]: level=error msg=\\"etcd apply took too long\\"" ;;
esac
`;

function makeWorkdir(opts: { psiMemory?: boolean; cgroup?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "zeta-wp11-pressure-"));
  writeFileSync(join(dir, "block.sh"), `${extractBlock()}\n`, "utf8");
  writeFileSync(join(dir, "fake-systemctl"), FAKE_SYSTEMCTL, "utf8");
  writeFileSync(join(dir, "fake-free"), FAKE_FREE, "utf8");
  writeFileSync(join(dir, "fake-journalctl"), FAKE_JOURNALCTL, "utf8");
  mkdirSync(join(dir, "psi"));
  writeFileSync(join(dir, "psi", "cpu"), "some avg10=1.00 avg60=0.50 avg300=0.10 total=100\n", "utf8");
  if (opts.psiMemory !== false) {
    writeFileSync(join(dir, "psi", "memory"), "some avg10=42.00 avg60=30.00 avg300=9.00 total=900\n", "utf8");
  }
  writeFileSync(join(dir, "psi", "io"), "full avg10=12.00 avg60=8.00 avg300=2.00 total=500\n", "utf8");
  if (opts.cgroup !== false) {
    for (const cg of ["system.slice", "system.slice/k3s.service", "kubepods.slice"]) {
      mkdirSync(join(dir, "cg", cg), { recursive: true });
      for (const f of ["cpu.weight", "memory.low", "memory.min", "memory.current"]) {
        writeFileSync(join(dir, "cg", cg, f), `${f === "cpu.weight" ? "1000" : "0"}\n`, "utf8");
      }
    }
  }
  return dir;
}

interface Run {
  readonly stdout: string;
  readonly vars: Record<string, string>;
}

function run(dir: string, script: string, env: Record<string, string> = {}): Run {
  const runner = [
    "set -uo pipefail",
    'log() { echo "$1"; }',
    "elapsed() { echo 0; }",
    'MKTEMP="$(command -v mktemp)"; RM="$(command -v rm)"; CAT="$(command -v cat)"',
    'GREP="$(command -v grep)"; TAIL="$(command -v tail)"',
    // The block quotes "$SYSTEMCTL" etc., so each fake is one executable path.
    "chmod +x ./fake-systemctl ./fake-free ./fake-journalctl",
    "SYSTEMCTL=./fake-systemctl; FREE=./fake-free; JOURNALCTL=./fake-journalctl",
    "PSI_DIR=./psi; CGROUP_ROOT=./cg",
    "source ./block.sh",
    script,
    'echo "::STATE=$PRESSURE_LAST_STATE"',
    'echo "::DETAIL=$PRESSURE_LAST_DETAIL"',
    'echo "::UNREACHABLE=$PRESSURE_UNREACHABLE_STATE"',
    'echo "::END=$PRESSURE_END_STATE"',
  ].join("\n");
  writeFileSync(join(dir, "runner.sh"), `${runner}\n`, "utf8");
  const r = spawnSync("bash", ["runner.sh"], { cwd: dir, encoding: "utf8", env: { ...process.env, ...env } });
  if (r.error !== undefined) throw r.error;
  if (r.status !== 0) throw new Error(`bash exited ${String(r.status)}: ${r.stderr}`);
  const vars: Record<string, string> = {};
  for (const line of r.stdout.split("\n")) {
    const m = /^::([A-Z]+)=(.*)$/.exec(line);
    if (m?.[1] !== undefined) vars[m[1]] = m[2] ?? "";
  }
  return { stdout: r.stdout, vars };
}

describe("WP11 pressure diagnostics: three states, never two", () => {
  it("did-not-run until something triggers it", () => {
    const r = run(makeWorkdir(), ":");
    expect(r.vars.STATE).toBe("did-not-run");
    expect(r.vars.UNREACHABLE).toBe("did-not-run");
    expect(r.vars.END).toBe("did-not-run");
  });

  it("captured: every section ran, and the evidence that separates the causes is on the log", () => {
    const r = run(makeWorkdir(), 'zeta_wp11_pressure_diag "api-unreachable"');
    expect(r.vars.STATE).toBe("captured");
    expect(r.vars.DETAIL).toBe("");
    expect(r.stdout).toContain("[wp11-pressure] k3s-restarts | NRestarts=4");
    expect(r.stdout).toContain("[wp11-pressure] psi-memory | some avg10=42.00");
    expect(r.stdout).toContain("[wp11-pressure] psi-io | full avg10=12.00");
    expect(r.stdout).toContain("Killed process 4242 (gitaly)");
    expect(r.stdout).toContain("kernel OOM line(s) this boot: 2");
    expect(r.stdout).toContain("[wp11-pressure] cgroup-protection | system.slice/k3s.service cpu.weight=1000");
    expect(r.stdout).toContain("etcd apply took too long");
    expect(r.stdout).toContain("[wp11-pressure] result (api-unreachable): captured");
  });

  it("a readable kernel log with no OOM line is a FINDING (zero), not a failure", () => {
    const r = run(makeWorkdir(), 'zeta_wp11_pressure_diag "end"', { KERNEL_LOG: "clean" });
    expect(r.vars.STATE).toBe("captured");
    expect(r.stdout).toContain("kernel OOM line(s) this boot: 0");
  });

  it("an UNREADABLE kernel log is failed, never 'no OOM found'", () => {
    const r = run(makeWorkdir(), 'zeta_wp11_pressure_diag "end"', { KERNEL_LOG: "fail" });
    expect(r.vars.STATE).toBe("failed");
    expect(r.vars.DETAIL).toContain("kernel-oom(exit 1)");
    expect(r.stdout).not.toContain("kernel OOM line(s) this boot");
  });

  it("a missing PSI file fails its own section and names it", () => {
    const r = run(makeWorkdir({ psiMemory: false }), 'zeta_wp11_pressure_diag "end"');
    expect(r.vars.STATE).toBe("failed");
    expect(r.vars.DETAIL).toContain("psi-memory(exit");
    expect(r.vars.DETAIL).not.toContain("psi-cpu");
  });

  it("unreadable cgroup files fail the protection section (a missing value is not a zero)", () => {
    const r = run(makeWorkdir({ cgroup: false }), 'zeta_wp11_pressure_diag "end"');
    expect(r.vars.STATE).toBe("failed");
    expect(r.vars.DETAIL).toContain("cgroup-protection(exit 1)");
    expect(r.stdout).toContain("kubepods.slice cpu.weight=UNREADABLE");
  });
});

describe("the unit calls it where the API goes away, and at the end", () => {
  it("on the first failed roster probe", () => {
    const probe = CODE.indexOf("ROSTER_PROBE_FAILURES=$(( ROSTER_PROBE_FAILURES + 1 ))");
    expect(probe).toBeGreaterThan(-1);
    const next = CODE.indexOf("continue", probe);
    expect(CODE.slice(probe, next)).toContain('zeta_wp11_pressure_diag "api-unreachable"');
  });

  it("on the first pod listing that did not answer (`pods -/-`)", () => {
    const pods = CODE.indexOf('ROSTER_POD_RUNNING="$(zeta_wp11_count_or_unknown');
    expect(pods).toBeGreaterThan(-1);
    const window = CODE.slice(pods, pods + 600);
    expect(window).toContain("_pods_all_rc");
    expect(window).toContain('zeta_wp11_pressure_diag "api-unreachable"');
  });

  it("always at the end, before the verdict JSON, and both states reach the JSON", () => {
    const end = CODE.indexOf('zeta_wp11_pressure_diag "end"');
    const json = CODE.indexOf('VERDICT_JSON="$("$JQ" -n');
    expect(end).toBeGreaterThan(-1);
    expect(end).toBeLessThan(json);
    const jq = CODE.slice(json);
    expect(jq).toContain('--arg pressureOnApiUnreachable "$PRESSURE_UNREACHABLE_STATE"');
    expect(jq).toContain('--arg pressureAtEnd "$PRESSURE_END_STATE"');
    expect(jq).toContain("pressureDiagnostics:");
  });
});
