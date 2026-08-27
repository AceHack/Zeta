// lint-k3s-join-intent-preflight.test.ts
//
// EXECUTES `full-ai-cluster/nixos/modules/k3s-join-intent-preflight.sh` over
// fixtures, rather than reading it.
//
// WHAT IT IS FOR. `injected-server-join.nix` names this failure in its own
// header and calls it the worst in the family: `builtins.pathExists` returns
// FALSE under pure eval, so a rebuild without `--impure` reverts a JOINING
// server to a FOUNDING one — re-founding a sovereign cluster on a node that was
// a member. Every surface stays green while it happens.
//
// WHY A NEW GUARD RATHER THAN TRUSTING THE TWO THAT EXIST:
//
//   * `lint-nixos-rebuild-needs-impure.ts` is a lint over DOCUMENTED rebuild
//     strings. It cannot see a human typing the command or a tool composing it.
//   * `k3s-datastore-preflight.sh` states its own boundary: "On a genuinely
//     from-scratch flash that is fine — there is no datastore, so nothing is
//     ignored." A freshly formatted machine is exactly the uncovered case, and
//     exactly the one an operator performs on purpose.
//
// WHY IT LIVES HERE AND NOT ONLY IN NIX. `nix flake check` on
// `full-ai-cluster/flake.nix` is run by NO workflow in this repository, so a
// Nix-only check would be one nothing executes. `bun test
// src/Core.TypeScript/hygiene/` IS run by the gate.
//
// TWO PROPERTIES CARRY THE WEIGHT:
//
//   1. **The refusal must be reachable AND the pass must be reachable.** A
//      preflight that always refuses bricks every legitimate founding node; one
//      that never refuses is the vacuity class. Both directions are fixed here
//      with the other variable held constant.
//   2. **It must DELETE NOTHING.** Same reason as the sibling: a boot-path
//      cleanup would be confiscation we introduced (manifesto §5). Every fixture
//      is inventoried before and after and compared.

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const SCRIPT = join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-join-intent-preflight.sh");
const MODULE = join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-join-intent-preflight.nix");

const MARKER_REVERTED = "REFUSED: provisioned to JOIN but resolved to FOUND";
const MARKER_HALF = "REFUSED: provisioned to join with an unusable endpoint";
const MARKER_CLEAR = "clear: resolved configuration agrees with the disk";

interface Resolved {
  readonly clusterInit: string;
  readonly serverAddr: string;
  readonly role?: string;
}

/** The disk half of the comparison. `endpoint: null` means the file is absent. */
function fixture(endpoint: string | null): { root: string; joinUrlFile: string } {
  const root = mkdtempSync(join(tmpdir(), "zeta-join-intent-"));
  const joinUrlFile = join(root, "etc/zeta/cluster-join-server-url");
  mkdirSync(join(root, "etc/zeta"), { recursive: true });
  if (endpoint !== null) writeFileSync(joinUrlFile, endpoint);
  return { root, joinUrlFile };
}

function inventory(dir: string): readonly string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        out.push(`${p}/`);
        walk(p);
      } else out.push(`${p}:${String(statSync(p).size)}`);
    }
  };
  walk(dir);
  return out.sort();
}

function run(endpoint: string | null, resolved: Resolved): { code: number; out: string; root: string } {
  const f = fixture(endpoint);
  const before = inventory(f.root);
  const r = spawnSync("bash", [SCRIPT], {
    encoding: "utf8",
    env: {
      ...process.env,
      ZETA_JOIN_URL_FILE: f.joinUrlFile,
      ZETA_JOIN_TOKEN_FILE: join(f.root, "etc/zeta/k3s-join-token"),
      ZETA_RESOLVED_CLUSTER_INIT: resolved.clusterInit,
      ZETA_RESOLVED_SERVER_ADDR: resolved.serverAddr,
      ZETA_ROLE: resolved.role ?? "server",
      // A path that cannot exist, so the serial branch is exercised as
      // "not writable" rather than skipped by luck.
      ZETA_SERIAL_DEVICE: join(f.root, "no-such-serial"),
    },
  });
  // The negative property, checked on EVERY run rather than in one test: a
  // script that deleted something on the refusal path only would slip past a
  // single dedicated case.
  expect(inventory(f.root)).toEqual(before);
  return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}`, root: f.root };
}

describe("the reversion is caught — provisioned to JOIN, resolved to FOUND", () => {
  test("THE LIVE SHAPE: join intent on disk, pure-eval founding config => REFUSED", () => {
    const r = run("https://control-plane:6443\n", { clusterInit: "true", serverAddr: "" });
    expect(r.code).toBe(1);
    expect(r.out).toContain(MARKER_REVERTED);
    expect(r.out).toContain("https://control-plane:6443");
  });

  test("the refusal NAMES the likely cause, so the operator is not left guessing", () => {
    const r = run("https://control-plane:6443\n", { clusterInit: "true", serverAddr: "" });
    expect(r.out).toMatch(/--impure/);
    expect(r.out).toMatch(/pathExists/);
  });

  test("the refusal offers BOTH ways forward, including founding on purpose", () => {
    const r = run("https://control-plane:6443\n", { clusterInit: "true", serverAddr: "" });
    expect(r.out).toMatch(/nixos-rebuild switch --impure/);
    expect(r.out).toMatch(/FOUND deliberately/);
  });

  test("the refusal reports whether the TOKEN is staged, and never its content", () => {
    // The option's description promises this file is "reported in the refusal
    // for diagnosis"; shellcheck caught that it was declared and never used, so
    // the description was a claim nothing honoured. Presence is the diagnostic
    // fact — a missing token and a missing URL are different repairs — and the
    // CONTENT must never reach console or serial.
    const r = run("https://control-plane:6443\n", { clusterInit: "true", serverAddr: "" });
    expect(r.out).toMatch(/join token .*ABSENT/);
    expect(r.out).toMatch(/content never read/);
  });

  test("an EMPTY serverAddr alone convicts, even with clusterInit already false", () => {
    // The half-applied case: something set `clusterInit = false` but the address
    // never landed. `clusterInit=false` with no address is worse than founding —
    // k3s has nothing to join and no mandate to start a cluster.
    const r = run("https://control-plane:6443\n", { clusterInit: "false", serverAddr: "" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("serverAddr resolved EMPTY");
  });

  test("the clusterInit branch is REACHABLE — address landed, override did not", () => {
    // Without this case the `clusterInit` check is dead code: every other
    // conviction here has an empty `serverAddr`, so the EARLIER branch fires and
    // deleting the clusterInit check breaks no test. Measured by mutation — it
    // was the one surviving mutant.
    //
    // The state is real, not synthetic. `injected-server-join.nix` sets
    // `clusterInit = lib.mkOverride 50 false` alongside `serverAddr`; a
    // half-applied module (a competing higher-priority definition, a partial
    // refactor) can land the address while leaving `clusterInit` true. k3s with
    // both is contradictory, and a server that still believes it may found is
    // the dangerous half of that contradiction.
    const r = run("https://control-plane:6443\n", { clusterInit: "true", serverAddr: "https://control-plane:6443" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("clusterInit resolved TRUE");
    expect(r.out).not.toContain("serverAddr resolved EMPTY");
  });

  test("the SAME half-applied state on an AGENT is clear — clusterInit is not an agent's field", () => {
    // The scope of the clusterInit branch is load-bearing in the other
    // direction: convicting an agent for a field it never sets would refuse
    // every legitimate joining worker.
    const r = run("https://cp:6443\n", { clusterInit: "true", serverAddr: "https://cp:6443", role: "agent" });
    expect(r.code).toBe(0);
  });

  test("an AGENT is convicted by the same branch — serverAddr, not clusterInit", () => {
    const r = run("https://control-plane:6443\n", { clusterInit: "true", serverAddr: "", role: "agent" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("role            : agent");
    // clusterInit is meaningless for an agent, so the conviction must not cite it.
    expect(r.out).toContain("serverAddr resolved EMPTY");
  });
});

describe("the pass is reachable — this must not brick a legitimate node", () => {
  test("NO join intent on disk => clear, and founding is left alone", () => {
    const r = run(null, { clusterInit: "true", serverAddr: "" });
    expect(r.code).toBe(0);
    expect(r.out).toContain(MARKER_CLEAR);
    expect(r.out).toMatch(/founding behaviour unchanged/);
  });

  test("join intent AND a joining config => clear", () => {
    const r = run("https://control-plane:6443\n", { clusterInit: "false", serverAddr: "https://control-plane:6443" });
    expect(r.code).toBe(0);
    expect(r.out).toContain(MARKER_CLEAR);
  });

  test("a joining AGENT is clear — agents never set clusterInit false", () => {
    const r = run("https://cp:6443\n", { clusterInit: "true", serverAddr: "https://cp:6443", role: "agent" });
    expect(r.code).toBe(0);
    expect(r.out).toContain(MARKER_CLEAR);
  });

  test("joining by IP is clear — the script never parses the endpoint's shape", () => {
    // Whether an IP endpoint's TLS SAN covers it is a REAL question and a
    // different one (see the hardware-remainder doc §4.3). This unit must not
    // pre-judge it by refusing an address form.
    const r = run("https://192.168.4.152:6443\n", { clusterInit: "false", serverAddr: "https://192.168.4.152:6443" });
    expect(r.code).toBe(0);
  });
});

describe("a half-provisioned endpoint refuses on its own terms", () => {
  test("an EMPTY url file refuses with a DISTINCT marker, not the reversion one", () => {
    const r = run("", { clusterInit: "false", serverAddr: "https://cp:6443" });
    expect(r.code).toBe(1);
    expect(r.out).toContain(MARKER_HALF);
    expect(r.out).not.toContain(MARKER_REVERTED);
  });

  test("a WHITESPACE-ONLY url file is not an endpoint", () => {
    const r = run("   \n\t\n", { clusterInit: "false", serverAddr: "https://cp:6443" });
    expect(r.code).toBe(1);
    expect(r.out).toContain(MARKER_HALF);
  });

  test("a trailing newline is NORMAL staging and must not read as unusable", () => {
    const r = run("https://cp:6443\n", { clusterInit: "false", serverAddr: "https://cp:6443" });
    expect(r.code).toBe(0);
  });
});

describe("the markers are greppable and distinct", () => {
  test("no marker is a prefix of another — an operator grepping one cannot match another", () => {
    const all = [MARKER_REVERTED, MARKER_HALF, MARKER_CLEAR];
    for (const a of all) {
      for (const b of all) {
        if (a !== b) expect(a.startsWith(b)).toBe(false);
      }
    }
  });
});

describe("the unit is wired FAIL CLOSED and carries the resolved values", () => {
  const module = readFileSync(MODULE, "utf8");

  test("`before` + `requiredBy` — `wantedBy` would let k3s start anyway", () => {
    expect(module).toMatch(/before\s*=\s*\[\s*"k3s\.service"\s*\]/);
    expect(module).toMatch(/requiredBy\s*=\s*\[\s*"k3s\.service"\s*\]/);
    expect(module).not.toMatch(/wantedBy\s*=\s*\[\s*"k3s\.service"\s*\]/);
  });

  test("the OUTCOME is read from the resolved config, not recomputed from the lost inputs", () => {
    // This is the whole mechanism. Recomputing `pathExists` here would re-run
    // the read that already failed and agree with itself — a check that cannot
    // fail in the condition it exists to catch.
    //
    // Matched against CODE only. The header quotes `builtins.pathExists` when
    // explaining the failure, and a whole-file match fired on that prose — a
    // check that convicts its own documentation is measuring the wrong thing,
    // and it would have had to be deleted rather than fixed if left that way.
    const code = module
      .split("\n")
      .filter((l) => !/^\s*#/.test(l))
      .join("\n");
    expect(code).toMatch(/config\.services\.k3s\.clusterInit/);
    expect(code).toMatch(/config\.services\.k3s\.serverAddr/);
    expect(code).not.toMatch(/builtins\.pathExists/);
    // The prose SHOULD still name it — that is where the reader learns why.
    expect(module).toMatch(/builtins\.pathExists/);
  });

  test("every environment variable the script reads is supplied by the unit", () => {
    const script = readFileSync(SCRIPT, "utf8");
    const read = [...script.matchAll(/\$\{(ZETA_[A-Z_]+):-/g)].map((m) => m[1]);
    expect(read.length).toBeGreaterThan(0);
    for (const v of new Set(read)) expect(module).toContain(`${v} =`);
  });
});

describe("the guard is ENROLLED — a module nothing imports is a check that never runs", () => {
  // The unit tests above prove the script DECIDES correctly. None of them prove
  // any host actually runs it, which is the same vacuity one level up: a
  // perfectly-tested preflight that no role module enables protects nothing.
  const ROLES = ["k3s-server.nix", "k3s-agent.nix"] as const;

  for (const role of ROLES) {
    test(`${role} imports the definer AND enables it`, () => {
      const text = readFileSync(join(REPO_ROOT, "full-ai-cluster/nixos/modules", role), "utf8");
      // Import and enable are separate failures. Setting an option without
      // importing its definer is a hard evaluation error in every VM test that
      // imports the role module directly — the discipline the sibling modules
      // already spell out — and importing without enabling is a silent no-op.
      expect(text).toContain("./k3s-join-intent-preflight.nix");
      expect(text).toMatch(/zeta\.k3sJoinIntentPreflight\.enable\s*=/);
    });
  }

  test("each role declares the ROLE the check is scoped by", () => {
    const server = readFileSync(join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-server.nix"), "utf8");
    const agent = readFileSync(join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-agent.nix"), "utf8");
    expect(server).toMatch(/k3sJoinIntentPreflight\.role\s*=\s*lib\.mkDefault\s*"server"/);
    expect(agent).toMatch(/k3sJoinIntentPreflight\.role\s*=\s*lib\.mkDefault\s*"agent"/);
  });
});
