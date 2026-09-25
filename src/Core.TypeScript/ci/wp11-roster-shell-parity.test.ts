/**
 * wp11-roster-shell-parity.test.ts — 081M3BEGSQR087G0R003610CGB (WP31).
 *
 * Verdict 7/7 of `zeta-first-boot-k3s-verify.nix` — `rosterConverged` — asks
 * the question verdicts 1-6 stop short of: do the ~48 Applications the
 * app-of-apps root deploys actually reach Synced+Healthy on a real installed
 * disk? Verdict 4 covers SEVEN bootstrap charts and verdict 5 only proves the
 * ROOT object landed, so nothing in that lane had ever looked at the roster.
 *
 * THE LOAD-BEARING CASE IS THAT IT CAN GO RED. A "wait for everything to be
 * Healthy" verdict is trivially satisfiable by writing it so that nothing can
 * fail it — an empty roster reading `0 unconverged`, an exclusion bucket wide
 * enough to swallow every real failure, a soak that only ever turns a FAIL
 * into a PASS. This repo has now found NINE separate instances of a check
 * whose failure and whose absence look identical, three of them inside
 * machinery written to catch exactly that. So the tests below are organised
 * around what must still FAIL:
 *
 *   - an Application stuck Progressing past the bound            -> unconverged
 *   - a DECLARED manual-sync app whose comparison never completed -> unconverged
 *   - a DECLARED manual-sync app that is Degraded                 -> unconverged
 *   - a MALFORMED manual-sync declaration                         -> full contract
 *   - a Pending pod whose nodeSelector IS satisfiable             -> NOT excluded
 *   - a provably unschedulable pod nobody owns                    -> unattributed-pod
 *   - an empty roster                                             -> zero rows, zero counts
 *
 * It proves the pure decision functions (`zeta_wp11_classify_roster`,
 * `zeta_wp11_roster_counts`) by extracting them VERBATIM out of the real
 * `.nix` module (between the ZETA-WP11-ROSTER-BEGIN/END markers) and running
 * them under a real bash+awk — same harness and same reason as
 * `wp11-nobadpods-shell-parity.test.ts`: this is the ONLY thing that can
 * execute the real logic, since the surrounding module only evaluates inside
 * a Nix build.
 *
 * PATHS: every filename referenced INSIDE a bash script string is a bare
 * relative name under `cwd: workdir`, never an absolute path interpolated
 * into the script text — on Windows an absolute path carries backslashes,
 * which bash reads as escapes. `wp11-nobadpods-shell-parity.test.ts` names
 * the incident that discipline exists to prevent.
 */

import { describe, expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const MODULE_PATH = join(REPO_ROOT, "full-ai-cluster/nixos/modules/zeta-first-boot-k3s-verify.nix");
const SRC = readFileSync(MODULE_PATH, "utf8");
const BEGIN = "# ZETA-WP11-ROSTER-BEGIN";
const END = "# ZETA-WP11-ROSTER-END";

function extractParityBlock(): string {
  const b = SRC.indexOf(BEGIN);
  const e = SRC.indexOf(END);
  if (b < 0) throw new Error("ZETA-WP11-ROSTER-BEGIN marker missing from zeta-first-boot-k3s-verify.nix");
  if (e < 0) throw new Error("ZETA-WP11-ROSTER-END marker missing from zeta-first-boot-k3s-verify.nix");
  if (e < b) throw new Error("ZETA-WP11-ROSTER markers out of order in zeta-first-boot-k3s-verify.nix");
  const block = SRC.slice(b, e + END.length);
  // Undo exactly the Nix indented-string escape for a shell `${...}`, and
  // nothing else, so the extracted text is the same bash the real unit runs.
  const unescaped = block.replaceAll("''${", "${");
  // A Nix interpolation left in the block would mean the block is NOT
  // self-contained bash — it would only run inside a Nix build, and this test
  // would be silently exercising something the unit does not.
  if (/\$\{pkgs\./.test(unescaped)) {
    throw new Error("parity block references a Nix interpolation (${pkgs...}); it must use only $AWK and its arguments");
  }
  return unescaped;
}

const workdir = mkdtempSync(join(tmpdir(), "zeta-wp11-roster-"));
writeFileSync(join(workdir, "parity-block.sh"), extractParityBlock() + "\n", "utf8");

const TAB = "\t";

/** Writes `content` as `name` under `workdir` and returns `name` — a bare relative filename safe to interpolate into a bash script string. */
function fixture(name: string, content: string): string {
  writeFileSync(join(workdir, name), content, "utf8");
  return name;
}

function runShell(script: string): string {
  const runner = join(workdir, "runner.sh");
  writeFileSync(runner, `set -uo pipefail\nAWK="$(command -v awk)"\nsource ./parity-block.sh\n${script}\n`, "utf8");
  const result = spawnSync("bash", ["runner.sh"], { cwd: workdir, encoding: "utf8" });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) throw new Error(`bash exited ${String(result.status)}: ${result.stderr}`);
  return result.stdout;
}

interface Row {
  readonly bucket: string;
  readonly name: string;
  readonly detail: string;
}

/** Runs the real classifier over a facts fixture and parses its TSV output. */
function classify(facts: string, fixtureName: string): readonly Row[] {
  const file = fixture(fixtureName, facts);
  const out = runShell(`zeta_wp11_classify_roster "${file}" "zeta-root"`);
  return out
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split(TAB);
      return { bucket: parts[0] ?? "", name: parts[1] ?? "", detail: parts[2] ?? "" };
    });
}

function counts(facts: string, fixtureName: string): readonly number[] {
  const file = fixture(fixtureName, facts);
  const classFile = `${fixtureName}.classified`;
  const out = runShell(
    `zeta_wp11_classify_roster "${file}" "zeta-root" > "${classFile}"\nzeta_wp11_roster_counts "${classFile}"`,
  );
  return out.trim().split(/\s+/).map(Number);
}

/** One `A` record. `-` is the empty sentinel in every field, exactly as the jq flattener emits it. */
function app(
  name: string,
  sync: string,
  health: string,
  opts: { annotation?: string; automated?: boolean; reason?: string; message?: string } = {},
): string {
  return [
    "A",
    name,
    sync,
    health,
    opts.annotation ?? "-",
    (opts.automated ?? true) ? "true" : "false",
    opts.reason ?? "-",
    opts.message ?? "-",
  ].join(TAB);
}

const ns = (name: string, namespace: string): string => ["N", name, namespace].join(TAB);
const label = (pair: string): string => ["L", pair].join(TAB);
const pendingPod = (
  namespace: string,
  name: string,
  opts: { instance?: string; affinity?: boolean; selKey?: string; selValue?: string } = {},
): string =>
  [
    "P",
    namespace,
    name,
    opts.instance ?? "-",
    (opts.affinity ?? false) ? "true" : "false",
    opts.selKey ?? "-",
    opts.selValue ?? "-",
  ].join(TAB);

const NODE_LABELS = [
  label("kubernetes.io/arch=amd64"),
  label("kubernetes.io/hostname=node-aaaaaa"),
  label("node-role.kubernetes.io/control-plane=true"),
].join("\n");

describe("zeta_wp11_classify_roster — the full Synced+Healthy contract", () => {
  it("Synced + Healthy is converged", () => {
    const rows = classify([app("redis", "Synced", "Healthy"), ns("redis", "redis"), NODE_LABELS].join("\n"), "conv.tsv");
    expect(rows).toEqual([{ bucket: "converged", name: "redis", detail: "sync=Synced health=Healthy" }]);
  });

  /**
   * THE case the whole verdict exists for. An Application that never leaves
   * Progressing must produce a RED verdict at the bound — a soak that cannot
   * fail is a false green, which is strictly worse than the false red it
   * replaces.
   */
  it("an Application still Progressing at the bound is UNCONVERGED, and says what it was", () => {
    const rows = classify(
      [
        app("temporal", "OutOfSync", "Progressing", { message: "waiting for rollout" }),
        ns("temporal", "temporal"),
        NODE_LABELS,
      ].join("\n"),
      "progressing.tsv",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.bucket).toBe("unconverged");
    expect(rows[0]?.name).toBe("temporal");
    expect(rows[0]?.detail).toContain("sync=OutOfSync");
    expect(rows[0]?.detail).toContain("health=Progressing");
    expect(rows[0]?.detail).toContain("waiting for rollout");
  });

  it("Degraded is unconverged, not merely 'not converged yet'", () => {
    const rows = classify([app("loki", "Synced", "Degraded"), ns("loki", "loki"), NODE_LABELS].join("\n"), "degraded.tsv");
    expect(rows[0]?.bucket).toBe("unconverged");
  });

  it("the root Application is not part of the roster — verdict 5 owns it", () => {
    const rows = classify(
      [app("zeta-root", "OutOfSync", "Progressing"), app("redis", "Synced", "Healthy"), ns("redis", "redis")].join("\n"),
      "rootexcluded.tsv",
    );
    expect(rows.map((r) => r.name)).toEqual(["redis"]);
  });
});

describe("zeta_wp11_classify_roster — declared manual-sync (manual-sync-policy.ts's convention)", () => {
  const CDI_REASON = "Adopts a CDI operator installed by hand on node-5b2dfa";

  it("a well-formed declaration that passes the WEAKER contract is excluded, with its reason on the line", () => {
    const rows = classify(
      [
        app("cdi", "OutOfSync", "Missing", { annotation: "manual", automated: false, reason: CDI_REASON }),
        ns("cdi", "cdi"),
        NODE_LABELS,
      ].join("\n"),
      "manual-ok.tsv",
    );
    expect(rows[0]?.bucket).toBe("excluded-manual-sync");
    expect(rows[0]?.name).toBe("cdi");
    // An exclusion nobody can see is how a verdict becomes decorative.
    expect(rows[0]?.detail).toContain(CDI_REASON);
    expect(rows[0]?.detail).toContain("sync=OutOfSync");
  });

  it("Synced+Healthy also satisfies it — the same app hand-synced on a real cluster", () => {
    const rows = classify(
      [
        app("kubevirt", "Synced", "Healthy", { annotation: "manual", automated: false, reason: "live guests" }),
        ns("kubevirt", "kubevirt"),
      ].join("\n"),
      "manual-healthy.tsv",
    );
    expect(rows[0]?.bucket).toBe("excluded-manual-sync");
  });

  /**
   * The exclusion is NOT a pass. `Unknown` means ArgoCD never completed a
   * comparison — a ComparisonError: a wrong git path, an include glob that
   * matches nothing, a vendored manifest that does not parse. For an app
   * nothing ever syncs, THIS is the check that still bites.
   */
  it("FAILS a declared manual-sync app whose comparison never completed", () => {
    const rows = classify(
      [
        app("cdi", "Unknown", "Missing", { annotation: "manual", automated: false, reason: CDI_REASON, message: "rpc error" }),
        ns("cdi", "cdi"),
      ].join("\n"),
      "manual-unknown.tsv",
    );
    expect(rows[0]?.bucket).toBe("unconverged");
    expect(rows[0]?.detail).toContain("never COMPLETED a comparison");
    expect(rows[0]?.detail).toContain("rpc error");
  });

  it("FAILS a declared manual-sync app that is Degraded", () => {
    const rows = classify(
      [
        app("cdi", "OutOfSync", "Degraded", { annotation: "manual", automated: false, reason: CDI_REASON }),
        ns("cdi", "cdi"),
      ].join("\n"),
      "manual-degraded.tsv",
    );
    expect(rows[0]?.bucket).toBe("unconverged");
    expect(rows[0]?.detail).toContain("health=Degraded");
  });

  /**
   * FAIL-CLOSED, straight out of `manual-sync-policy.ts`: a malformed
   * declaration must never be cheaper to satisfy than a correct one, or the
   * malformed form becomes the preferred way to quiet a lane.
   */
  it("the annotation WITH an automated block is MALFORMED — full contract, and it says so", () => {
    const rows = classify(
      [
        app("sneaky", "OutOfSync", "Missing", { annotation: "manual", automated: true, reason: "because" }),
        ns("sneaky", "sneaky"),
      ].join("\n"),
      "manual-both.tsv",
    );
    expect(rows[0]?.bucket).toBe("unconverged");
    expect(rows[0]?.detail).toContain("MALFORMED");
  });

  it("the annotation with NO reason is MALFORMED — a declaration without a why is a mute button", () => {
    const rows = classify(
      [app("silent", "OutOfSync", "Missing", { annotation: "manual", automated: false }), ns("silent", "silent")].join("\n"),
      "manual-noreason.tsv",
    );
    expect(rows[0]?.bucket).toBe("unconverged");
    expect(rows[0]?.detail).toContain("MALFORMED");
    expect(rows[0]?.detail).toContain("reason=absent");
  });

  it("a non-exact annotation value is MALFORMED — not case-folded into acceptance", () => {
    const rows = classify(
      [app("Manualish", "OutOfSync", "Missing", { annotation: "Manual", automated: false, reason: "x" })].join("\n"),
      "manual-case.tsv",
    );
    expect(rows[0]?.bucket).toBe("unconverged");
    expect(rows[0]?.detail).toContain("MALFORMED");
  });

  it("an omitted automated block with NO annotation is the full contract, and the omission is named", () => {
    const rows = classify(
      [app("forgot", "Synced", "Healthy", { automated: false }), ns("forgot", "forgot")].join("\n"),
      "manual-omitted.tsv",
    );
    // Still converged — it IS Synced+Healthy — but the unclaimed omission is
    // printed rather than silently accepted as a declaration.
    expect(rows[0]?.bucket).toBe("converged");
    expect(rows[0]?.detail).toContain("indistinguishable from a forgotten one");
  });
});

describe("zeta_wp11_classify_roster — schedulability, decided the way Kubernetes decides it", () => {
  it("a Pending pod demanding a label NO Node carries excludes its Application, naming the label", () => {
    const rows = classify(
      [
        app("ollama", "Synced", "Progressing"),
        ns("ollama", "ollama"),
        NODE_LABELS,
        pendingPod("ollama", "ollama-0", { selKey: "zeta.io/gpu", selValue: "nvidia" }),
      ].join("\n"),
      "unsched.tsv",
    );
    expect(rows[0]?.bucket).toBe("excluded-unschedulable");
    expect(rows[0]?.detail).toContain("zeta.io/gpu=nvidia");
    expect(rows[0]?.detail).toContain("ollama/ollama-0");
  });

  /**
   * The acquitting direction is the one this must never be wrong in. A
   * selector the fleet CAN satisfy buys no exclusion — the app is simply not
   * converged, and a slow pull or a broken image stays a failure.
   */
  it("a SATISFIABLE nodeSelector buys no exclusion", () => {
    const rows = classify(
      [
        app("weaviate", "Synced", "Progressing"),
        ns("weaviate", "weaviate"),
        NODE_LABELS,
        pendingPod("weaviate", "weaviate-0", { selKey: "kubernetes.io/arch", selValue: "amd64" }),
      ].join("\n"),
      "sched.tsv",
    );
    expect(rows[0]?.bucket).toBe("unconverged");
  });

  it("a Pending pod with NO nodeSelector buys no exclusion", () => {
    const rows = classify(
      [app("nats", "Synced", "Progressing"), ns("nats", "nats"), NODE_LABELS, pendingPod("nats", "nats-0")].join("\n"),
      "nosel.tsv",
    );
    expect(rows[0]?.bucket).toBe("unconverged");
  });

  it("a pod is attributed by the app.kubernetes.io/instance label when its namespace has several claimants", () => {
    const rows = classify(
      [
        app("ollama", "Synced", "Progressing"),
        app("vllm", "Synced", "Progressing"),
        ns("ollama", "models"),
        ns("vllm", "models"),
        NODE_LABELS,
        pendingPod("models", "vllm-0", { instance: "vllm", selKey: "zeta.io/gpu", selValue: "nvidia" }),
      ].join("\n"),
      "instance.tsv",
    );
    const byName = new Map(rows.map((r) => [r.name, r.bucket]));
    expect(byName.get("vllm")).toBe("excluded-unschedulable");
    expect(byName.get("ollama")).toBe("unconverged");
  });

  /**
   * An unschedulable pod nobody owns is REPORTED, never dropped. The shell
   * fails the verdict on a non-zero count of these, because a pod that cannot
   * be attributed is evidence this classifier did not fully understand the
   * cluster it was judging.
   */
  it("an unattributable unschedulable pod gets its own row rather than vanishing", () => {
    const rows = classify(
      [
        app("ollama", "Synced", "Healthy"),
        app("vllm", "Synced", "Healthy"),
        ns("ollama", "models"),
        ns("vllm", "models"),
        NODE_LABELS,
        pendingPod("models", "orphan-0", { selKey: "zeta.io/gpu", selValue: "nvidia" }),
      ].join("\n"),
      "orphan.tsv",
    );
    const orphan = rows.find((r) => r.bucket === "unattributed-pod");
    expect(orphan).toBeDefined();
    expect(orphan?.name).toBe("models/orphan-0");
    expect(orphan?.detail).toContain("zeta.io/gpu=nvidia");
    expect(orphan?.detail).toContain("claimed by 2 Applications");
  });

  it("a pod in a namespace no Application claims is also reported, with that reason", () => {
    const rows = classify(
      [
        app("redis", "Synced", "Healthy"),
        ns("redis", "redis"),
        NODE_LABELS,
        pendingPod("stray", "stray-0", { selKey: "zeta.io/gpu", selValue: "nvidia" }),
      ].join("\n"),
      "stray.tsv",
    );
    const orphan = rows.find((r) => r.bucket === "unattributed-pod");
    expect(orphan?.detail).toContain("no Application claims namespace stray");
  });
});

describe("zeta_wp11_classify_roster — undecidable is said out loud, never assumed either way", () => {
  it("required nodeAffinity makes its Application undecidable, naming the pod and the limitation", () => {
    const rows = classify(
      [
        app("arc-runner-set", "Synced", "Progressing"),
        ns("arc-runner-set", "arc-runners"),
        NODE_LABELS,
        pendingPod("arc-runners", "runner-0", { affinity: true }),
      ].join("\n"),
      "affinity.tsv",
    );
    expect(rows[0]?.bucket).toBe("undecidable");
    expect(rows[0]?.detail).toContain("nodeAffinity");
    expect(rows[0]?.detail).toContain("arc-runners/runner-0");
  });

  it("a PROVEN unschedulable selector wins over undecidable nodeAffinity on the same app", () => {
    const rows = classify(
      [
        app("ollama", "Synced", "Progressing"),
        ns("ollama", "ollama"),
        NODE_LABELS,
        pendingPod("ollama", "affinity-0", { affinity: true }),
        pendingPod("ollama", "gpu-0", { selKey: "zeta.io/gpu", selValue: "nvidia" }),
      ].join("\n"),
      "both.tsv",
    );
    expect(rows[0]?.bucket).toBe("excluded-unschedulable");
  });

  it("a CONVERGED app is never re-classified by a stray Pending pod in its namespace", () => {
    const rows = classify(
      [
        app("redis", "Synced", "Healthy"),
        ns("redis", "redis"),
        NODE_LABELS,
        pendingPod("redis", "redis-backup-0", { affinity: true }),
      ].join("\n"),
      "converged-pending.tsv",
    );
    expect(rows[0]?.bucket).toBe("converged");
  });
});

describe("zeta_wp11_roster_counts", () => {
  it("counts each bucket, and EXCLUDES unattributed pods from the Application total", () => {
    const facts = [
      app("redis", "Synced", "Healthy"),
      app("loki", "Synced", "Progressing"),
      app("cdi", "OutOfSync", "Missing", { annotation: "manual", automated: false, reason: "hand-installed" }),
      app("ollama", "Synced", "Progressing"),
      app("vllm", "Synced", "Healthy"),
      app("arc-runner-set", "Synced", "Progressing"),
      ns("redis", "redis"),
      ns("loki", "loki"),
      ns("cdi", "cdi"),
      ns("ollama", "ollama"),
      ns("vllm", "models"),
      ns("arc-runner-set", "arc-runners"),
      NODE_LABELS,
      pendingPod("ollama", "ollama-0", { selKey: "zeta.io/gpu", selValue: "nvidia" }),
      pendingPod("arc-runners", "runner-0", { affinity: true }),
      pendingPod("nowhere", "orphan-0", { selKey: "zeta.io/gpu", selValue: "nvidia" }),
    ].join("\n");
    // converged unconverged excluded undecidable unattributed applications
    expect(counts(facts, "counts.tsv")).toEqual([2, 1, 2, 1, 1, 6]);
  });

  /**
   * "0 unconverged out of 0 Applications" is the exact false-green shape this
   * effort keeps finding. The counts function must report the empty roster AS
   * empty so the shell's `appCount -gt 0` guard has something real to refuse.
   */
  it("an empty roster counts zero Applications, not zero failures", () => {
    expect(counts("", "empty.tsv")).toEqual([0, 0, 0, 0, 0, 0]);
    expect(classify("", "empty2.tsv")).toEqual([]);
  });

  it("node labels and pods with no Applications at all still yield zero Applications", () => {
    const facts = [NODE_LABELS, pendingPod("x", "y")].join("\n");
    expect(counts(facts, "nodesonly.tsv")).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
