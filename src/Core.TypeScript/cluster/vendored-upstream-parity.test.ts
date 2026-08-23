/**
 * Falsifiers for vendored-upstream-parity.ts.
 *
 * Every finding class below is reached by MUTATING a scratch tree, never by
 * constructing a Finding by hand -- a test that asserts on a value it built
 * itself proves the assertion, not the check. The one test that reads the LIVE
 * tree asserts it is clean, which is the claim the module exists to make.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  checkClassificationCoverage,
  checkRoster,
  checkUpstreamStillMatches,
  fileSha256,
  formatReport,
  OUR_FILES,
  pinIsImmutable,
  UPSTREAM_FILES,
  type Finding,
  type OurFile,
  type UpstreamFile,
} from "./vendored-upstream-parity.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

const APP_DIR = "full-ai-cluster/k8s/applications/demo";
const UPSTREAM_PATH = `${APP_DIR}/demo-operator.yaml`;
const OURS_PATH = `${APP_DIR}/demo-cr.yaml`;

const UPSTREAM_BYTES = "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: demo\n";
const UPSTREAM_DIGEST = createHash("sha256").update(UPSTREAM_BYTES).digest("hex");

const APPLICATION_YAML = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: demo
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/Lucent-Financial-Group/Zeta
    targetRevision: main
    path: ${APP_DIR}
    directory:
      include: '{demo-operator,demo-cr}.yaml'
  destination:
    server: https://kubernetes.default.svc
    namespace: demo
`;

const ROSTER: readonly UpstreamFile[] = [
  {
    path: UPSTREAM_PATH,
    upstreamUrl: "https://github.com/example/thing/releases/download/v1.2.3/demo-operator.yaml",
    sha256: UPSTREAM_DIGEST,
  },
];
const OURS: readonly OurFile[] = [{ path: OURS_PATH, why: "ours, for the test" }];

let root = "";

function write(rel: string, text: string): void {
  const abs = join(root, rel);
  mkdirSync(abs.slice(0, abs.lastIndexOf("/")), { recursive: true });
  writeFileSync(abs, text, "utf8");
}

function kinds(findings: readonly Finding[]): string[] {
  return findings.map((f) => f.kind).sort();
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vendored-parity-"));
  write(`${APP_DIR}/Application.yaml`, APPLICATION_YAML);
  write(UPSTREAM_PATH, UPSTREAM_BYTES);
  write(OURS_PATH, "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: ours\n");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("the scratch tree is clean before any mutation", () => {
  test("no findings — otherwise every mutation below proves nothing", () => {
    expect(kinds([...checkRoster(root, ROSTER), ...checkClassificationCoverage(root, ROSTER, OURS)])).toEqual([]);
  });
});

describe("pinIsImmutable", () => {
  test("accepts a versioned release-asset URL", () => {
    expect(pinIsImmutable("https://github.com/kubevirt/kubevirt/releases/download/v1.8.4/kubevirt-operator.yaml")).toBe(
      true,
    );
  });

  test("accepts a 40-hex commit", () => {
    expect(
      pinIsImmutable("https://raw.githubusercontent.com/o/r/0123456789abcdef0123456789abcdef01234567/x.yaml"),
    ).toBe(true);
  });

  test.each([
    ["a branch", "https://raw.githubusercontent.com/o/r/main/x.yaml"],
    ["master", "https://raw.githubusercontent.com/o/r/master/x.yaml"],
    ["latest", "https://github.com/o/r/releases/latest/download/x.yaml"],
    ["HEAD", "https://example.com/o/r/HEAD/x.yaml"],
    ["a bare named branch", "https://raw.githubusercontent.com/o/r/release-1.x/x.yaml"],
  ])("refuses %s", (_label, url) => {
    expect(pinIsImmutable(url)).toBe(false);
  });

  test("an unpinned roster URL is a finding, not a warning", () => {
    const moving = [{ ...ROSTER[0]!, upstreamUrl: "https://raw.githubusercontent.com/o/r/main/demo-operator.yaml" }];
    expect(kinds(checkRoster(root, moving))).toEqual(["unpinned-upstream-url"]);
  });
});

describe("checkRoster — the bytes", () => {
  test("ONE BYTE changed in the committed copy goes red", () => {
    write(UPSTREAM_PATH, UPSTREAM_BYTES.replace("name: demo", "name: demX"));
    const findings = checkRoster(root, ROSTER);
    expect(kinds(findings)).toEqual(["committed-bytes-differ-from-pin"]);
    expect(findings[0]?.detail).toContain(UPSTREAM_DIGEST);
  });

  test("the exact edit this whole thread wanted — lowering a cpu request — goes red", () => {
    write(UPSTREAM_PATH, `${UPSTREAM_BYTES}data:\n  cpu: 25m\n`);
    expect(kinds(checkRoster(root, ROSTER))).toEqual(["committed-bytes-differ-from-pin"]);
  });

  test("a deleted copy is named, never silently skipped", () => {
    rmSync(join(root, UPSTREAM_PATH));
    expect(kinds(checkRoster(root, ROSTER))).toEqual(["committed-file-missing"]);
  });

  test("fileSha256 returns null for an absent file rather than throwing", () => {
    expect(fileSha256(join(root, "nope.yaml"))).toBeNull();
  });
});

describe("checkClassificationCoverage — the roster cannot drift from the glob", () => {
  test("a THIRD file added to the include glob is unclassified until someone says what it is", () => {
    write(`${APP_DIR}/demo-extra.yaml`, "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: extra\n");
    write(
      `${APP_DIR}/Application.yaml`,
      APPLICATION_YAML.replace("{demo-operator,demo-cr}", "{demo-operator,demo-cr,demo-extra}"),
    );
    const findings = checkClassificationCoverage(root, ROSTER, OURS);
    expect(kinds(findings)).toEqual(["unclassified-synced-file"]);
    expect(findings[0]?.path).toBe(`${APP_DIR}/demo-extra.yaml`);
  });

  test("a file in the directory the glob EXCLUDES is not a finding — the glob decides, not the listing", () => {
    write(`${APP_DIR}/README.yaml`, "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: readme\n");
    expect(kinds(checkClassificationCoverage(root, ROSTER, OURS))).toEqual([]);
  });

  test("the mirror image: a rostered path the glob does NOT select prices a file the cluster never gets", () => {
    write(`${APP_DIR}/Application.yaml`, APPLICATION_YAML.replace("{demo-operator,demo-cr}", "{demo-cr}"));
    expect(kinds(checkClassificationCoverage(root, ROSTER, OURS))).toEqual(["rostered-file-not-synced"]);
  });

  test("dropping the OUR_FILES entry makes the file it covered unclassified", () => {
    expect(kinds(checkClassificationCoverage(root, ROSTER, []))).toEqual(["unclassified-synced-file"]);
  });
});

describe("checkUpstreamStillMatches — the release asset re-uploaded in place", () => {
  test("upstream serving different bytes under the same URL goes red", async () => {
    const findings = await checkUpstreamStillMatches(ROSTER, async () => new TextEncoder().encode("tampered"));
    expect(kinds(findings)).toEqual(["upstream-bytes-moved"]);
    expect(findings[0]?.detail).toContain("replaced in place");
  });

  test("upstream serving the pinned bytes is clean", async () => {
    expect(await checkUpstreamStillMatches(ROSTER, async () => new TextEncoder().encode(UPSTREAM_BYTES))).toEqual([]);
  });

  test("a fetch that FAILS is a finding, never a pass — an unavailable check must not read as a passing one", async () => {
    const findings = await checkUpstreamStillMatches(ROSTER, async () => {
      throw new Error("network is unreachable");
    });
    expect(kinds(findings)).toEqual(["upstream-bytes-moved"]);
    expect(findings[0]?.detail).toContain("network is unreachable");
  });
});

describe("formatReport", () => {
  test("an offline clean run SAYS the network half did not run", () => {
    expect(formatReport([], false)).toContain("--fetch was not passed");
  });

  test("a fetched clean run does not claim an offline caveat", () => {
    expect(formatReport([], true)).not.toContain("--fetch was not passed");
  });
});

describe("the LIVE tree", () => {
  // EXPLICIT TIMEOUT, and generous on purpose. The work here is ~160ms measured
  // (checkRoster 1.3ms, checkClassificationCoverage 155ms over the whole
  // applications tree), so 30s is not slack for a slow check -- it is headroom
  // for a loaded machine, where bun's 5s default turns a passing check into a
  // red that says nothing about the tree. A genuine hang still fails.
  test("both vendored operator manifests reproduce their pinned upstream digest, and every synced file is classified", () => {
    expect(kinds([...checkRoster(REPO_ROOT), ...checkClassificationCoverage(REPO_ROOT)])).toEqual([]);
  }, 30_000);

  test("the roster is not empty — a vacuously-passing parity check is the failure it exists to catch", () => {
    expect(UPSTREAM_FILES.length).toBeGreaterThan(0);
    expect(OUR_FILES.length).toBeGreaterThan(0);
  });

  test("every rostered URL is immutably pinned", () => {
    for (const entry of UPSTREAM_FILES) expect(pinIsImmutable(entry.upstreamUrl)).toBe(true);
  });

  test("the pinned digest is the digest of the file that is actually in the tree", () => {
    for (const entry of UPSTREAM_FILES) {
      expect(fileSha256(join(REPO_ROOT, entry.path))).toBe(entry.sha256);
    }
  }, 30_000);
});
