/**
 * wp11-ci-envelope.test.ts — 081M3K1K1XV087G0R002A6YFRS.
 *
 * The WP11 installed-disk guest (4 vCPU / 12288 MiB) lost its API server in run
 * 36364782876 the day #17711 (gitlab), #17718 (temporal + CNPG Postgres) and
 * #17708 (gmod SteamCMD) landed. `k8s/wp11-ci-envelope.json` names what that
 * guest does not deploy and why, and `zeta-wp11-ci-envelope.nix` enforces it
 * on the marker-carrying guest ONLY, by swapping the root Application for a
 * copy with `directory.exclude`.
 *
 * What must hold, and what each test here would catch:
 *   - the envelope's numbers are the snapshot's numbers (they cannot drift
 *     into a story);
 *   - every excluded dir is a real Application dir, and one the dev/CI kind
 *     lanes already exclude for the same substrate reason (one list of
 *     "too heavy for a hosted runner", not two);
 *   - the injection, run VERBATIM from the module under real bash, produces a
 *     root Application whose exclude is exactly the glob and whose include is
 *     untouched; without the marker it writes nothing and removes only its own
 *     files; on a root manifest it cannot anchor it fails and writes nothing;
 *   - the verdict prints the exclusion (an exclusion nobody can see is how a
 *     verdict becomes decorative).
 */

import { YAML } from "bun";
import { describe, expect, it, setDefaultTimeout } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_ROOT_DEV_CATALOG, excludeGlobDirs } from "../cluster/ports.ts";

// Each parity case forks bash several times; slow on a Windows runner.
setDefaultTimeout(60_000);

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const ENVELOPE_PATH = join(REPO_ROOT, "full-ai-cluster/k8s/wp11-ci-envelope.json");
const MODULE_PATH = join(REPO_ROOT, "full-ai-cluster/nixos/modules/zeta-wp11-ci-envelope.nix");
const VERIFY_PATH = join(REPO_ROOT, "full-ai-cluster/nixos/modules/zeta-first-boot-k3s-verify.nix");
const ROOT_MANIFEST_PATH = join(REPO_ROOT, "full-ai-cluster/k8s/bootstrap/root-application.yaml");
const SNAPSHOT_PATH = join(REPO_ROOT, "src/Core.TypeScript/cluster/rendered-resource-requests.snapshot.json");

interface Excluded {
  readonly dir: string;
  readonly reason: string;
  readonly memoryMib: number;
  readonly cpuMillis: number;
  readonly pods: number;
}
interface Envelope {
  readonly evidence: string;
  readonly liftsWhen: string;
  readonly excluded: readonly Excluded[];
}
interface SnapshotApp {
  readonly appId: string;
  readonly cpuMillis: number;
  readonly memoryMib: number;
  readonly pods: number;
}
interface Snapshot {
  readonly profiles: readonly { readonly profile: string; readonly apps: readonly SnapshotApp[] }[];
}

const ENVELOPE = JSON.parse(readFileSync(ENVELOPE_PATH, "utf8")) as Envelope;
const SNAPSHOT = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as Snapshot;
/** The glob exactly as the Nix module builds it: "{" + dir + "/**" joined by "," + "}". */
const GLOB = `{${ENVELOPE.excluded.map((e) => `${e.dir}/**`).join(",")}}`;

const stripNixComments = (text: string): string =>
  text
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");

describe("k8s/wp11-ci-envelope.json is measured, not asserted", () => {
  it("excludes something, and says why and when it lifts", () => {
    expect(ENVELOPE.excluded.length).toBeGreaterThan(0);
    expect(ENVELOPE.evidence).toContain("36364782876");
    expect(ENVELOPE.liftsWhen.length).toBeGreaterThan(0);
    for (const e of ENVELOPE.excluded) expect(e.reason.length).toBeGreaterThan(20);
  });

  it("every entry's numbers equal the METAL rung of the rendered-requests snapshot", () => {
    const metal = SNAPSHOT.profiles.find((p) => p.profile === "metal");
    expect(metal).toBeDefined();
    for (const e of ENVELOPE.excluded) {
      const prefix = `full-ai-cluster/${e.dir}`;
      const apps = (metal?.apps ?? []).filter((a) => a.appId === prefix || a.appId.startsWith(`${prefix}/`));
      expect(apps.length).toBeGreaterThan(0);
      const sum = (f: (a: SnapshotApp) => number) => apps.reduce((n, a) => n + f(a), 0);
      expect({ dir: e.dir, memoryMib: e.memoryMib, cpuMillis: e.cpuMillis, pods: e.pods }).toEqual({
        dir: e.dir,
        memoryMib: sum((a) => a.memoryMib),
        cpuMillis: sum((a) => a.cpuMillis),
        pods: sum((a) => a.pods),
      });
    }
  });

  it("every excluded dir is a real Application dir that the dev/CI kind lanes also exclude", () => {
    const devExcluded = excludeGlobDirs(DEFAULT_ROOT_DEV_CATALOG.excludeGlob);
    for (const e of ENVELOPE.excluded) {
      expect(existsSync(join(REPO_ROOT, "full-ai-cluster/k8s/applications", e.dir, "Application.yaml"))).toBe(true);
      expect(devExcluded).toContain(e.dir);
    }
  });
});

describe("the Nix module builds the same glob and reads the same JSON", () => {
  const code = stripNixComments(readFileSync(MODULE_PATH, "utf8"));
  it("reads k8s/wp11-ci-envelope.json and joins dirs as {dir/**,...}", () => {
    expect(code).toContain("builtins.fromJSON (builtins.readFile ../../k8s/wp11-ci-envelope.json)");
    expect(code).toContain('"{" + lib.concatMapStringsSep "," (e: "${e.dir}/**") envelope.excluded + "}"');
  });
  it("runs before k3s and is gated on the WP11 marker the verify unit uses", () => {
    expect(code).toContain('before = [ "k3s.service" ];');
    const verify = readFileSync(VERIFY_PATH, "utf8");
    const marker = /markerFile = "([^"]+)";/.exec(verify)?.[1];
    expect(marker).toBeDefined();
    expect(code).toContain(`markerFile = "${marker ?? "?"}";`);
  });
});

function extractBlock(): string {
  const src = readFileSync(MODULE_PATH, "utf8");
  const b = src.indexOf("# ZETA-WP11-ENVELOPE-BEGIN");
  const e = src.indexOf("# ZETA-WP11-ENVELOPE-END");
  if (b < 0 || e < b) throw new Error("ZETA-WP11-ENVELOPE-BEGIN/END markers missing or out of order");
  const block = src.slice(b, e).replaceAll("''${", "${");
  if (/\$\{/.test(block)) throw new Error("envelope block must be plain bash (no Nix interpolation)");
  return block;
}

interface Outcome {
  readonly dir: string;
  readonly rc: number;
  readonly stdout: string;
  readonly state: string;
}

function apply(opts: { marker: boolean; rootManifest?: string; preexisting?: Record<string, string> }): Outcome {
  const dir = mkdtempSync(join(tmpdir(), "zeta-wp11-envelope-"));
  writeFileSync(join(dir, "block.sh"), `${extractBlock()}\n`, "utf8");
  writeFileSync(join(dir, "root-src.yaml"), opts.rootManifest ?? readFileSync(ROOT_MANIFEST_PATH, "utf8"), "utf8");
  mkdirSync(join(dir, "manifests"));
  for (const [name, content] of Object.entries(opts.preexisting ?? {})) {
    writeFileSync(join(dir, "manifests", name), content, "utf8");
  }
  if (opts.marker) writeFileSync(join(dir, "marker"), "", "utf8");
  const runner = [
    "set -uo pipefail",
    'log() { echo "$1"; }',
    'AWK="$(command -v awk)"; GREP="$(command -v grep)"; MV="$(command -v mv)"; RM="$(command -v rm)"; MKDIR="$(command -v mkdir)"',
    "source ./block.sh",
    `zeta_wp11_envelope_apply ./marker ./manifests ./root-src.yaml '${GLOB}' ./state`,
  ].join("\n");
  writeFileSync(join(dir, "runner.sh"), `${runner}\n`, "utf8");
  const r = spawnSync("bash", ["runner.sh"], { cwd: dir, encoding: "utf8" });
  if (r.error !== undefined) throw r.error;
  return { dir, rc: r.status ?? -1, stdout: r.stdout, state: readOrEmpty(join(dir, "state", "state")) };
}

/** One read; a missing file is "", anything else is a real error. */
function readOrEmpty(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw e;
  }
}

const TAG = "# zeta-wp11-ci-envelope";

describe("the injection, run verbatim from the module", () => {
  it("WP11 guest: the copy excludes exactly the glob, keeps include, and the original is skipped", () => {
    const o = apply({ marker: true });
    expect(o.rc).toBe(0);
    const override = readFileSync(join(o.dir, "manifests", "zeta-root-wp11-ci-envelope.yaml"), "utf8");
    const original = YAML.parse(readFileSync(ROOT_MANIFEST_PATH, "utf8")) as {
      metadata: { name: string };
      spec: { source: { directory: Record<string, unknown> } };
    };
    const parsed = YAML.parse(override) as typeof original;
    expect(parsed.metadata.name).toBe(original.metadata.name);
    expect(parsed.spec.source.directory).toEqual({ ...original.spec.source.directory, exclude: GLOB });
    expect(readFileSync(join(o.dir, "manifests", "root-application.yaml.skip"), "utf8").trim()).toBe(TAG);
    expect(o.state).toBe(`applied\t${GLOB}\tk8s/wp11-ci-envelope.json\n`);
    expect(o.stdout).toContain(`does NOT deploy ${GLOB}`);
  });

  it("real install (no marker): writes nothing, removes only files carrying its own tag", () => {
    const o = apply({
      marker: false,
      preexisting: {
        "zeta-root-wp11-ci-envelope.yaml": `${TAG}\nkind: Application\n`,
        "root-application.yaml.skip": `${TAG}\n`,
        "traefik.yaml.skip": "", // an operator's own skip: not ours, must survive
      },
    });
    expect(o.rc).toBe(0);
    expect(existsSync(join(o.dir, "manifests", "zeta-root-wp11-ci-envelope.yaml"))).toBe(false);
    expect(existsSync(join(o.dir, "manifests", "root-application.yaml.skip"))).toBe(false);
    expect(existsSync(join(o.dir, "manifests", "traefik.yaml.skip"))).toBe(true);
    expect(o.state.startsWith("not-applicable\t")).toBe(true);
  });

  it("a root manifest it cannot anchor on: FAILS and writes nothing, so the full roster deploys", () => {
    const two = "spec:\n  source:\n    directory:\n      include: 'a'\n      include: 'b'\n";
    const o = apply({ marker: true, rootManifest: two });
    expect(o.rc).not.toBe(0);
    expect(existsSync(join(o.dir, "manifests", "zeta-root-wp11-ci-envelope.yaml"))).toBe(false);
    expect(existsSync(join(o.dir, "manifests", "root-application.yaml.skip"))).toBe(false);
    expect(o.state.startsWith("failed\t")).toBe(true);
  });
});

describe("the verdict names the exclusion", () => {
  const code = stripNixComments(readFileSync(VERIFY_PATH, "utf8"));
  it("imports the envelope module, prints its state, and carries it in the JSON", () => {
    expect(code).toContain("imports = [ ./zeta-wp11-ci-envelope.nix ];");
    expect(code).toContain("/run/zeta-wp11-ci-envelope/state");
    expect(code).toContain("CI_ENVELOPE_STATE=did-not-run");
    expect(code).toContain("ciEnvelope: {state: $ciEnvelopeState, excludeGlob: $ciEnvelopeExclude");
  });
});
