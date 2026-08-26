// lint-k3s-datastore-preflight.test.ts
//
// EXECUTES `full-ai-cluster/nixos/modules/k3s-datastore-preflight.sh` over
// fixture directories, rather than reading it.
//
// WHAT IT IS FOR. k3s IGNORES `--cluster-init` / `--server` / `--token-file`
// when a datastore already exists on disk (k3s docs, verbatim). Every option
// `injected-server-join.nix` sets is a datastore argument, so a declarative
// join on a dirty disk is a SILENT no-op — the unit starts, the flags parse,
// the disk wins, and the node quietly resumes being the cluster it already
// was, with `systemctl status k3s` green throughout. On a from-scratch flash
// that never happens; this is the guard for every other case.
//
// WHY IT LIVES HERE AND NOT ONLY IN NIX. `nix flake check` on
// `full-ai-cluster/flake.nix` is run by NO workflow in this repository. A
// check that nothing executes is a check that never runs. `bun test
// src/Core.TypeScript/hygiene/` IS run by the gate, so this is where the
// behaviour is actually pinned.
//
// THE PROPERTY THAT MATTERS MOST is the negative one: the script must DELETE
// NOTHING. A boot-path wipe would "fix" the dirty-disk case in one line and
// would be confiscation we introduced (manifesto §5 memory preservation), so
// every fixture is inventoried before and after and compared.

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const SCRIPT = join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-datastore-preflight.sh");
const MODULE = join(REPO_ROOT, "full-ai-cluster/nixos/modules/k3s-datastore-preflight.nix");

const MARKER_REFUSED = "REFUSED: provisioned to JOIN but a k3s datastore already exists";
const MARKER_CLEAR = "clear: no conflicting datastore";

interface Fixture {
  readonly root: string;
  readonly joinUrlFile: string;
  readonly datastoreDir: string;
}

/** Build a fixture with the two facts the script branches on, independently. */
function fixture(opts: { readonly provisionedToJoin: boolean; readonly datastoreExists: boolean }): Fixture {
  const root = mkdtempSync(join(tmpdir(), "zeta-preflight-"));
  const joinUrlFile = join(root, "etc/zeta/cluster-join-server-url");
  const datastoreDir = join(root, "var/lib/rancher/k3s/server/db/etcd");
  if (opts.provisionedToJoin) {
    mkdirSync(join(root, "etc/zeta"), { recursive: true });
    writeFileSync(joinUrlFile, "https://control-plane:6443\n");
  }
  if (opts.datastoreExists) {
    mkdirSync(datastoreDir, { recursive: true });
    writeFileSync(join(datastoreDir, "member-marker"), "pretend etcd state\n");
  }
  return { root, joinUrlFile, datastoreDir };
}

function inventory(dir: string): readonly string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) {
        out.push(`${p}/`);
        walk(p);
      } else {
        out.push(`${p}:${String(statSync(p).size)}`);
      }
    }
  };
  walk(dir);
  return out.sort();
}

function run(f: Fixture): { readonly status: number; readonly stdout: string } {
  const result = spawnSync("bash", [SCRIPT], {
    env: {
      ...process.env,
      ZETA_JOIN_URL_FILE: f.joinUrlFile,
      ZETA_DATASTORE_DIR: f.datastoreDir,
      // A path that cannot exist, so the `-w` guard takes its false branch and
      // the "no serial port" machine is the case under test. The serial write
      // must never be what decides the exit status.
      ZETA_SERIAL_DEVICE: join(f.root, "no-such-serial-device"),
    },
    encoding: "utf8",
  });
  return { status: result.status ?? -1, stdout: `${result.stdout}${result.stderr}` };
}

describe("k3s datastore preflight — the four states", () => {
  test("not provisioned to join, no datastore -> clear (exit 0)", () => {
    const r = run(fixture({ provisionedToJoin: false, datastoreExists: false }));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(MARKER_CLEAR);
    expect(r.stdout).not.toContain(MARKER_REFUSED);
  });

  test("not provisioned to join, datastore present -> clear (exit 0)", () => {
    // A founding node that has founded. This is the normal steady state of the
    // control plane and it must NOT be refused; a guard that fires here would
    // brick every reboot of a healthy cluster.
    const r = run(fixture({ provisionedToJoin: false, datastoreExists: true }));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(MARKER_CLEAR);
    expect(r.stdout).not.toContain(MARKER_REFUSED);
  });

  test("provisioned to join, no datastore -> clear (exit 0) — the from-scratch flash", () => {
    const r = run(fixture({ provisionedToJoin: true, datastoreExists: false }));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(MARKER_CLEAR);
    expect(r.stdout).toContain("https://control-plane:6443");
  });

  test("provisioned to join, datastore present -> REFUSED (exit 1)", () => {
    const r = run(fixture({ provisionedToJoin: true, datastoreExists: true }));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(MARKER_REFUSED);
    // The refusal must name BOTH facts it is refusing on, or an operator has to
    // guess which one to change.
    expect(r.stdout).toContain("https://control-plane:6443");
    expect(r.stdout).toContain("db/etcd");
    // ...and both ways forward, including that (b) is irreversible.
    expect(r.stdout).toContain("NOTHING HAS BEEN DELETED");
    expect(r.stdout).toContain("irreversible");
  });

  test("the refusal marker is not a prefix of the clear marker (greppable apart)", () => {
    expect(MARKER_REFUSED.startsWith(MARKER_CLEAR)).toBe(false);
    expect(MARKER_CLEAR.startsWith(MARKER_REFUSED)).toBe(false);
  });
});

describe("the negative property: it deletes nothing, ever", () => {
  test("every fixture is byte-for-byte identical after the run", () => {
    for (const provisionedToJoin of [true, false]) {
      for (const datastoreExists of [true, false]) {
        const f = fixture({ provisionedToJoin, datastoreExists });
        const before = inventory(f.root);
        run(f);
        expect({ provisionedToJoin, datastoreExists, files: inventory(f.root) }).toEqual({
          provisionedToJoin,
          datastoreExists,
          files: before,
        });
      }
    }
  });

  test("the script contains no destructive verb", () => {
    // Belt to the braces above: the inventory check proves the CURRENT script
    // deletes nothing on these four paths; this refuses the edit that would
    // introduce a wipe under some fifth condition the fixtures do not reach.
    const text = readFileSync(SCRIPT, "utf8");
    const body = text
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("#"))
      .join("\n");
    for (const verb of ["rm ", "rm -", "rmdir", "shred", "mkfs", "dd if=", "truncate", "wipefs"]) {
      expect({ verb, present: body.includes(verb) }).toEqual({ verb, present: false });
    }
  });
});

describe("unit wiring — fail closed, not fail open", () => {
  const moduleText = readFileSync(MODULE, "utf8");

  test("requiredBy k3s.service, not wantedBy", () => {
    // `wantedBy` would let k3s start even when this unit fails, which is the
    // vacuity class in unit-file form: a guard that is present, runs, reports,
    // and gates nothing.
    expect(moduleText).toContain('requiredBy = [ "k3s.service" ]');
    expect(moduleText).toContain('before = [ "k3s.service" ]');
    expect(moduleText).not.toContain('wantedBy = [ "k3s.service" ]');
  });

  test("the unit passes the script the environment the script reads", () => {
    // A rename on either side silently reverts the script to its defaults —
    // which are absolute production paths, so under test it would look fine and
    // in production it would read the wrong files.
    for (const key of ["ZETA_JOIN_URL_FILE", "ZETA_DATASTORE_DIR", "ZETA_SERIAL_DEVICE"]) {
      expect({ key, inModule: moduleText.includes(key), inScript: readFileSync(SCRIPT, "utf8").includes(key) }).toEqual({
        key,
        inModule: true,
        inScript: true,
      });
    }
  });

  test("the datastore path names the etcd directory, not its parent", () => {
    // `/var/lib/rancher/k3s/server` is created by k3s' own tmpfiles rule and by
    // a partial install, with no cluster state in it. Checking the parent would
    // refuse boots that are perfectly fine — the cry-wolf failure that gets a
    // guard disabled.
    expect(moduleText).toContain('"/var/lib/rancher/k3s/server/db/etcd"');
  });

  test("both role modules enable it", () => {
    for (const rel of [
      "full-ai-cluster/nixos/modules/k3s-server.nix",
      "full-ai-cluster/nixos/modules/k3s-agent.nix",
    ]) {
      expect({ rel, enabled: readFileSync(join(REPO_ROOT, rel), "utf8").includes("zeta.k3sDatastorePreflight.enable") }).toEqual({
        rel,
        enabled: true,
      });
    }
  });
});
