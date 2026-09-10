// from-zip.test.ts — the falsifiers for the pinned-release-ZIP mechanism.
//
// The expensive half of this mechanism (fetch 400 MB, verify, extract, swap) cannot run in a
// unit test, so what is tested is every DECISION it makes before and around that: the pin, the
// two independent gates, the receipt comparison that decides whether a re-run is a no-op, and
// the extraction itself against a real ZIP built here. The manifest is checked as data.

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseMechanismManifest } from "../setup-manifest.ts";
import {
  extractZip,
  optInSatisfied,
  realizeFromZip,
  receiptSatisfies,
  RECEIPT_BASENAME,
  readReceipt,
} from "./from-zip.ts";
import { createContext, type RealizeContext } from "./shared.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..", "..");
const MANIFEST = join(repoRoot, "tools/setup/manifests/from-zip");
const SHA256_HEX = /^[0-9a-f]{64}$/u;

function rows() {
  return parseMechanismManifest(readFileSync(MANIFEST, "utf8"));
}

describe("the from-zip manifest, as data", () => {
  test("every row is HTTPS, digest-pinned, opt-in gated, and names its binary", () => {
    const entries = rows();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      const [dest, url] = entry.tokens;
      expect(url ?? "").toStartWith("https://");
      expect(entry.attrs.sha256 ?? "").toMatch(SHA256_HEX);
      // `opt-in=` is what stands between this mechanism and hundreds of megabytes on every
      // laptop, runner and devcontainer layer that runs install.sh. Its absence is a manifest
      // defect the realizer throws on; this is the same refusal stated as data.
      expect(entry.attrs["opt-in"] ?? "").not.toBe("");
      expect(entry.attrs.bin ?? "").not.toBe("");
      expect(dest ?? "").not.toBe("");
    }
  });

  test("the CodeQL rows cover four platforms and agree on version, dest and opt-in", () => {
    const codeql = rows().filter((e) => (e.tokens[1] ?? "").includes("codeql-cli-binaries"));
    expect(codeql.length).toBe(4);
    expect(new Set(codeql.map((e) => e.tokens[0]))).toEqual(new Set(["~/.zeta/codeql-cli"]));
    expect(new Set(codeql.map((e) => e.attrs["opt-in"]))).toEqual(new Set(["ZETA_INSTALL_CODEQL"]));
    // ONE version across all four. A per-platform version skew would mean two developers on
    // two operating systems reproduce the same PR's alert with two different analysers and
    // read the difference as a finding.
    const versions = new Set(codeql.map((e) => /\/download\/(v[^/]+)\//u.exec(e.tokens[1] ?? "")?.[1]));
    expect(versions.size).toBe(1);
    expect(new Set(codeql.map((e) => e.attrs.when))).toEqual(
      new Set(["darwin", "linux,amd64", "linux,arm64", "windows"]),
    );
    // Distinct digests: four different assets. Equal digests would mean a copy-paste that
    // pinned one platform's bytes for every platform, which fails only at install time.
    expect(new Set(codeql.map((e) => e.attrs.sha256)).size).toBe(4);
  });

  test("the pinned version is the one run-codeql resolves against", () => {
    // The wrapper looks for ~/.zeta/codeql-cli/codeql/codeql; the row must put it there.
    const mac = rows().find((e) => e.attrs.when === "darwin");
    expect(mac?.tokens[0]).toBe("~/.zeta/codeql-cli");
    expect(mac?.attrs.bin).toBe("codeql/codeql");
    expect(mac?.attrs.shim).toBe("codeql");
  });
});

describe("the opt-in gate", () => {
  test("an undeclared opt-in is REFUSED, never defaulted to install", () => {
    expect(optInSatisfied(undefined, {}).ok).toBe(false);
    expect(optInSatisfied("  ", {}).ok).toBe(false);
    expect(optInSatisfied(undefined, {}).reason).toContain("must be opt-in");
  });

  test("only the literal 1 opens the gate", () => {
    expect(optInSatisfied("ZETA_INSTALL_CODEQL", { ZETA_INSTALL_CODEQL: "1" }).ok).toBe(true);
    expect(optInSatisfied("ZETA_INSTALL_CODEQL", { ZETA_INSTALL_CODEQL: "true" }).ok).toBe(false);
    expect(optInSatisfied("ZETA_INSTALL_CODEQL", { ZETA_INSTALL_CODEQL: "0" }).ok).toBe(false);
    expect(optInSatisfied("ZETA_INSTALL_CODEQL", {}).ok).toBe(false);
  });
});

describe("the receipt — what makes a re-run a no-op, and what must NOT", () => {
  const pin = { kind: "digest", sha256: "a".repeat(64) } as const;
  const url = "https://example.invalid/tool.zip";

  test("same url + same digest is satisfied", () => {
    expect(receiptSatisfies({ url, sha256: "A".repeat(64) }, url, pin)).toBe(true);
  });

  test("A MOVED PIN IS NOT SATISFIED — the case that makes a bump reach the machine", () => {
    expect(receiptSatisfies({ url, sha256: "b".repeat(64) }, url, pin)).toBe(false);
  });

  test("a different url is not satisfied even at the same digest", () => {
    expect(receiptSatisfies({ url: "https://elsewhere.invalid/t.zip", sha256: "a".repeat(64) }, url, pin)).toBe(
      false,
    );
  });

  test("NO receipt is not satisfied — a hand-placed tree is re-installed, not adopted", () => {
    expect(receiptSatisfies(null, url, pin)).toBe(false);
  });

  test("readReceipt returns null for absent, non-JSON and wrong-shaped files", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-from-zip-receipt-"));
    try {
      expect(readReceipt(dir)).toBeNull();
      writeFileSync(join(dir, RECEIPT_BASENAME), "{ not json");
      expect(readReceipt(dir)).toBeNull();
      writeFileSync(join(dir, RECEIPT_BASENAME), JSON.stringify({ url: 1, sha256: [] }));
      expect(readReceipt(dir)).toBeNull();
      writeFileSync(join(dir, RECEIPT_BASENAME), JSON.stringify({ url, sha256: "a".repeat(64) }));
      expect(readReceipt(dir)).toEqual({ url, sha256: "a".repeat(64) });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("extraction", () => {
  test("a real zip round-trips, and a non-zip fails loudly rather than silently", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-from-zip-extract-"));
    try {
      const src = join(dir, "src");
      mkdirSync(join(src, "nested"), { recursive: true });
      writeFileSync(join(src, "nested", "hello.txt"), "hello\n");
      const zipPath = join(dir, "a.zip");
      // eslint-disable-next-line sonarjs/no-os-command-from-path
      const zipped = spawnSync("zip", ["-q", "-r", zipPath, "nested"], { cwd: src, encoding: "utf8" });
      if (zipped.status !== 0) {
        // `zip` is not universally present. A test that cannot build its input has not
        // measured anything, and saying so beats an assertion that passes vacuously.
        process.stderr.write("from-zip.test: `zip` unavailable; extraction round-trip NOT RUN\n");
        return;
      }
      const out = join(dir, "out");
      mkdirSync(out);
      extractZip(zipPath, out);
      expect(readFileSync(join(out, "nested", "hello.txt"), "utf8")).toBe("hello\n");

      const notAZip = join(dir, "not.zip");
      writeFileSync(notAZip, "this is not a zip archive");
      const out2 = join(dir, "out2");
      mkdirSync(out2);
      expect(() => {
        extractZip(notAZip, out2);
      }).toThrow(/could not extract/u);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the realizer's refusals and skips (no network)", () => {
  function stageManifest(body: string): string {
    const root = mkdtempSync(join(tmpdir(), "zeta-from-zip-root-"));
    mkdirSync(join(root, "tools", "setup", "manifests"), { recursive: true });
    writeFileSync(join(root, "tools", "setup", "manifests", "from-zip"), body);
    return root;
  }

  test("a row with no opt-in= THROWS — the defect is in the manifest, not the network", async () => {
    const root = stageManifest(
      "~/.zeta/x  https://example.invalid/x.zip  sha256=" + "a".repeat(64) + "  bin=x/x\n",
    );
    try {
      const ctx = createContext({ repoRoot: root, dryRun: true });
      await expect(realizeFromZip(ctx)).rejects.toThrow(/opt-in=<ENV_VAR> is required/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a row with no pin THROWS with the declared vocabulary in the message", async () => {
    const root = stageManifest(
      "~/.zeta/x  https://example.invalid/x.zip  bin=x/x  opt-in=ZETA_TEST_NEVER_SET\n",
    );
    try {
      const ctx = createContext({ repoRoot: root, dryRun: true });
      await expect(realizeFromZip(ctx)).rejects.toThrow(/sha256= pin required/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  /** A context whose log is captured, so a skip REASON can be asserted rather than inferred. */
  function capturingContext(): { readonly ctx: RealizeContext; readonly lines: string[] } {
    const lines: string[] = [];
    return {
      ctx: {
        repoRoot,
        dryRun: true,
        actions: [],
        log: (message) => lines.push(message),
        warn: (message) => lines.push(`WARN ${message}`),
      },
      lines,
    };
  }

  test("the shipped manifest installs NOTHING when the opt-in is unset", async () => {
    // The default path on every host that has not asked. Empty `actions` is the claim: no
    // fetch was even planned. The reason is asserted too, so the test cannot pass because some
    // OTHER gate (when=, tier=) happened to close first.
    const previous = process.env.ZETA_INSTALL_CODEQL;
    delete process.env.ZETA_INSTALL_CODEQL;
    try {
      const { ctx, lines } = capturingContext();
      const result = await realizeFromZip(ctx);
      expect(result.actions).toEqual([]);
      expect(lines.some((l) => l.includes("ZETA_INSTALL_CODEQL is not 1"))).toBe(true);
    } finally {
      if (previous !== undefined) process.env.ZETA_INSTALL_CODEQL = previous;
    }
  });

  test("with the opt-in set, EXACTLY ONE row is selected for this host", async () => {
    // The mutation check on the test above: if the opt-in skip were unconditional, that test
    // would pass for the wrong reason. Exactly one `when=` clause can match a given host, so
    // exactly one row must get past every gate.
    //
    // What that row then DOES is host-state-dependent and deliberately not asserted here: on a
    // machine that already carries the pinned tree it logs "already installed from this pin"
    // and plans nothing, and on a fresh one it plans the fetch. Pinning either would make this
    // test pass or fail on whether the author had run the installer, which is not a property
    // of the code.
    const previous = process.env.ZETA_INSTALL_CODEQL;
    process.env.ZETA_INSTALL_CODEQL = "1";
    try {
      const { ctx, lines } = capturingContext();
      const result = await realizeFromZip(ctx);
      const skipped = lines.filter((l) => l.includes("skipping")).length;
      const rowCount = rows().length;
      expect(skipped).toBe(rowCount - 1);
      const planned = result.actions.length;
      const alreadyThere = lines.filter((l) => l.includes("already installed from this pin")).length;
      expect(planned + alreadyThere).toBe(1);
    } finally {
      if (previous === undefined) delete process.env.ZETA_INSTALL_CODEQL;
      else process.env.ZETA_INSTALL_CODEQL = previous;
    }
  });
});
