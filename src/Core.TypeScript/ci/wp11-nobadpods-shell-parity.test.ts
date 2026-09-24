/**
 * wp11-nobadpods-shell-parity.test.ts — 081M39T5661087G0R001FTJ78W.
 *
 * `noBadPods` (verdict 6/6 of `zeta-first-boot-k3s-verify.nix`, the WP11
 * lane) used to be a single `kubectl get pods` snapshot fired the instant
 * `rootLanded` resolved -- MEASURED run 35996447262: one second after
 * rootLanded, before ArgoCD had any real time to converge, catching
 * spire-agent mid ordinary startup-ordering churn (a DaemonSet racing a
 * StatefulSet it has no readiness dependency on) and reporting it as a
 * failure. Fixed with a bounded soak: a pod counts as settled only once
 * TWO CONSECUTIVE samples agree it is neither in the bad-phase set nor
 * still accumulating restarts -- never a single all-clear snapshot, since a
 * genuinely crash-looping container can read "Running" for one sample
 * between crashes.
 *
 * This file proves the two pure decision functions
 * (`zeta_wp11_snapshot_restarts`, `zeta_wp11_unsettled_pods`) by extracting
 * them VERBATIM out of the real `.nix` module (between the
 * ZETA-WP11-NOBADPODS-BEGIN/END markers) and running them under a real
 * bash+awk -- same harness and same reason as
 * `longhorn-capacity-preflight-shell-parity.test.ts` and
 * `repo-pin-shell-parity.test.ts`: this is the ONLY thing that can execute
 * the real logic, since the surrounding module only evaluates inside a Nix
 * build.
 *
 * THE LOAD-BEARING CASE: a pod that never settles must still fail at the
 * deadline. A soak that can only ever turn a FAIL into a PASS (i.e. cannot
 * itself fail) would swap a false red for a false green, which is strictly
 * worse than the snapshot it replaces on a lane whose first green must mean
 * something -- see "never settles" below, run across five simulated samples
 * with the restart count climbing every time.
 *
 * PATHS: every filename referenced INSIDE a bash script string is a bare
 * relative name under `cwd: workdir`, never an absolute path interpolated
 * into the script text -- on Windows an absolute path carries backslashes,
 * which bash reads as escapes, silently mangling the path into one that
 * does not exist (`repo-pin-shell-parity.test.ts` names the incident this
 * discipline exists to prevent; `longhorn-capacity-preflight-shell-
 * parity.test.ts` applies it only to the `source` line -- this file needed
 * it for every fixture file argument too).
 */

import { describe, expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const MODULE_PATH = join(REPO_ROOT, "full-ai-cluster/nixos/modules/zeta-first-boot-k3s-verify.nix");
const SRC = readFileSync(MODULE_PATH, "utf8");
const BEGIN = "# ZETA-WP11-NOBADPODS-BEGIN";
const END = "# ZETA-WP11-NOBADPODS-END";

function extractParityBlock(): string {
  const b = SRC.indexOf(BEGIN);
  const e = SRC.indexOf(END);
  if (b < 0) throw new Error("ZETA-WP11-NOBADPODS-BEGIN marker missing from zeta-first-boot-k3s-verify.nix");
  if (e < 0) throw new Error("ZETA-WP11-NOBADPODS-END marker missing from zeta-first-boot-k3s-verify.nix");
  if (e < b) throw new Error("ZETA-WP11-NOBADPODS markers out of order in zeta-first-boot-k3s-verify.nix");
  // Every literal-`${...}` occurrence in this block would be the Nix
  // indented-string escape `''${` for a shell variable -- undo exactly that
  // escape, and nothing else, so the extracted text is the same bash the
  // real unit runs, not Nix source. (None occur in THIS block today; kept
  // for the same reason the guard below checks for unresolved interpolation
  // rather than assuming there is none.)
  return SRC.slice(b, e + END.length).replaceAll("''${", "${");
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-wp11-nobadpods-"));
writeFileSync(join(workdir, "parity-block.sh"), extractParityBlock() + "\n", "utf8");

/** Writes `content` as `name` under `workdir` and returns `name` -- a bare relative filename safe to interpolate into a bash script string. */
function fixture(name: string, content: string): string {
  writeFileSync(join(workdir, name), content, "utf8");
  return name;
}

/**
 * Runs `script` with the parity block sourced and `$AWK` pointed at a real
 * awk. `cwd: workdir` plus relative names throughout (see the file header)
 * is what keeps this safe on Windows.
 */
function runShell(script: string): string {
  const runner = join(workdir, "runner.sh");
  writeFileSync(runner, `set -uo pipefail\nAWK="$(command -v awk)"\nsource ./parity-block.sh\n${script}\n`, "utf8");
  const result = spawnSync("bash", ["runner.sh"], { cwd: workdir, encoding: "utf8" });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) throw new Error(`bash exited ${String(result.status)}: ${result.stderr}`);
  return result.stdout;
}

/** `kubectl get pods -A --no-headers` column order: NAMESPACE NAME READY STATUS RESTARTS AGE. */
function podsFixture(rows: readonly { ns: string; name: string; status: string; restarts: number }[]): string {
  return rows.map((r) => `${r.ns} ${r.name} 1/1 ${r.status} ${r.restarts} 5m`).join("\n") + "\n";
}

describe("the parity block is extractable and self-contained", () => {
  it("both markers are present and carry both functions, no unresolved Nix interpolation", () => {
    const block = extractParityBlock();
    expect(block).toContain("zeta_wp11_snapshot_restarts()");
    expect(block).toContain("zeta_wp11_unsettled_pods()");
    expect(block).not.toContain("${pkgs.");
  });

  it("sources cleanly on its own with $AWK set — no dependency on the rest of the unit", () => {
    expect(runShell("echo sourced").trim()).toBe("sourced");
  });
});

describe("zeta_wp11_snapshot_restarts", () => {
  it("extracts namespace, name, and restarts (numeric) from a pods listing", () => {
    const podsFile = fixture(
      "pods1.txt",
      podsFixture([
        { ns: "spire", name: "spire-agent-jl9fg", status: "CrashLoopBackOff", restarts: 1 },
        { ns: "kube-system", name: "cilium-abcde", status: "Running", restarts: 0 },
      ]),
    );
    const result = runShell(`zeta_wp11_snapshot_restarts ${podsFile} snap1.txt\ncat snap1.txt`);
    expect(result.trim().split("\n").sort()).toEqual(["kube-system cilium-abcde 0", "spire spire-agent-jl9fg 1"].sort());
  });
});

describe("zeta_wp11_unsettled_pods — the settle decision", () => {
  it("first sample: a healthy, never-before-seen pod is still UNSETTLED (nothing to compare against yet)", () => {
    const podsFile = fixture("pods-healthy.txt", podsFixture([{ ns: "kube-system", name: "cilium-abcde", status: "Running", restarts: 0 }]));
    const emptyPrev = fixture("empty-prev.txt", "");
    const out = runShell(`zeta_wp11_unsettled_pods ${podsFile} ${emptyPrev}`);
    expect(out.trim()).toBe("kube-system cilium-abcde Running 0");
  });

  it("a CrashLoopBackOff pod is unsettled regardless of restart-count history", () => {
    const podsFile = fixture("pods-bad.txt", podsFixture([{ ns: "spire", name: "spire-agent-jl9fg", status: "CrashLoopBackOff", restarts: 5 }]));
    // same restart count as now -- status alone still fails it
    const prev = fixture("prev-same.txt", "spire spire-agent-jl9fg 5\n");
    const out = runShell(`zeta_wp11_unsettled_pods ${podsFile} ${prev}`);
    expect(out.trim()).toBe("spire spire-agent-jl9fg CrashLoopBackOff 5");
  });

  it("SETTLES LATE: bad on sample 1, Running with the SAME restart count on sample 2 -> settled", () => {
    const sample1 = fixture("settle-s1.txt", podsFixture([{ ns: "spire", name: "spire-agent-jl9fg", status: "CrashLoopBackOff", restarts: 1 }]));
    const sample2 = fixture("settle-s2.txt", podsFixture([{ ns: "spire", name: "spire-agent-jl9fg", status: "Running", restarts: 1 }]));
    const emptyPrev = fixture("settle-empty-prev.txt", "");

    const out = runShell(
      [
        `zeta_wp11_unsettled_pods ${sample1} ${emptyPrev}`, // sample 1: unsettled (no prior)
        `echo ---`,
        `zeta_wp11_snapshot_restarts ${sample1} settle-snap1.txt`,
        `zeta_wp11_unsettled_pods ${sample2} settle-snap1.txt`, // sample 2: compares against sample 1's snapshot
        `echo ---`,
      ].join("\n"),
    );
    const [sample1Unsettled, sample2Unsettled] = out.split("---\n").map((s) => s.trim());
    expect(sample1Unsettled).toBe("spire spire-agent-jl9fg CrashLoopBackOff 1");
    expect(sample2Unsettled).toBe(""); // EMPTY -- settled. This is the PASS path.
  });

  it("NEVER SETTLES: restart count climbs on every one of 5 samples -> unsettled at every sample, including the last", () => {
    // The load-bearing case: a genuine crash loop must still fail once the
    // soak's deadline is reached, not just "eventually stop looking".
    let prevSnapshot = fixture("never-empty-prev.txt", "");
    const results: string[] = [];
    for (let sampleNum = 1; sampleNum <= 5; sampleNum++) {
      // status oscillates (as a real crash loop does) but restarts always climb.
      const status = sampleNum % 2 === 0 ? "Running" : "CrashLoopBackOff";
      const podsFile = fixture(`never-s${String(sampleNum)}.txt`, podsFixture([{ ns: "orleans", name: "orleans-silo-0", status, restarts: sampleNum }]));
      const nextSnapshot = `never-snap${String(sampleNum)}.txt`;
      const out = runShell(
        [`zeta_wp11_unsettled_pods ${podsFile} ${prevSnapshot}`, `echo ---SEP---`, `zeta_wp11_snapshot_restarts ${podsFile} ${nextSnapshot}`].join(
          "\n",
        ),
      );
      results.push(out.split("---SEP---")[0]!.trim());
      prevSnapshot = nextSnapshot;
    }
    // EVERY sample, including the one taken at what would be the soak
    // deadline, still names the pod unsettled -- a real crash loop is never
    // read as settled just because the soak ran out of time to look again.
    for (const [i, r] of results.entries()) {
      expect(r, `sample ${String(i + 1)}`).toBe("orleans orleans-silo-0 " + (i % 2 === 0 ? "CrashLoopBackOff" : "Running") + " " + String(i + 1));
    }
  });

  it("a settled pod that later regresses (restarts climb again) is unsettled again", () => {
    const s1 = fixture("regress-s1.txt", podsFixture([{ ns: "ns", name: "p", status: "Running", restarts: 2 }]));
    const s2 = fixture("regress-s2.txt", podsFixture([{ ns: "ns", name: "p", status: "Running", restarts: 3 }])); // climbed
    const out = runShell(`zeta_wp11_snapshot_restarts ${s1} regress-snap1.txt\nzeta_wp11_unsettled_pods ${s2} regress-snap1.txt`);
    expect(out.trim()).toBe("ns p Running 3");
  });
});
