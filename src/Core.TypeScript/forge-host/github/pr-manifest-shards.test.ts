// pr-manifest-shards.test.ts — the acceptance criteria for 081KZYMY46P087G0R003S64V2B,
// stated as falsifiers rather than assertions.
//
// The load-bearing ones are the two that DEMONSTRATE rather than assert:
//   • `git merge` of two branches that each archived a different PR — with the shard store
//     it merges clean; with the old single-file manifest the SAME scenario conflicts. The
//     control is what makes the first result mean something.
//   • re-archiving one PR is an upsert (one file, not two).

import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MANIFEST_RELATIVE,
  SHARD_ROOT_RELATIVE,
  deriveManifest,
  loadAllShards,
  parseManifest,
  prNumberOfShardId,
  serializeManifestEntry,
  serializeUnparseable,
  shardPathFor,
  shardZetaId,
  validateEntry,
  writeShard,
  type ManifestEntry,
} from "./pr-manifest-shards.ts";
import { runMigration } from "./migrate-pr-manifest-to-shards.ts";
import { runDerive } from "./derive-pr-manifest.ts";

function entry(pr: number, over: Partial<ManifestEntry> = {}): ManifestEntry {
  return {
    pr_number: pr,
    archive_path: `docs/history/pr-reviews/PR-${String(pr)}-x.md`,
    source_ids: [`thread:T${String(pr)}`],
    fetched_at: "2026-08-13T00:00:00.000Z",
    schema_version: "v1",
    commit_sha: "0".repeat(40),
    title: `PR ${String(pr)}`,
    state: "MERGED",
    merged_at: "2026-08-12T00:00:00Z",
    head_ref: `feat/pr-${String(pr)}`,
    ...over,
  };
}

function tmpRoot(tag: string): string {
  return mkdtempSync(join(tmpdir(), `pr-shards-${tag}-`));
}

// ── Identity ──────────────────────────────────────────────────────────────

describe("shard identity", () => {
  test("the ZetaId is a pure, invertible function of pr_number", () => {
    for (const pr of [1, 671, 6247, 10414, 999999]) {
      expect(prNumberOfShardId(shardZetaId(pr))).toBe(pr);
    }
  });

  test("distinct PRs get distinct ids; the same PR always gets the same id", () => {
    const ids = new Set<string>();
    for (let pr = 1; pr <= 5000; pr++) ids.add(shardZetaId(pr).toString(16));
    expect(ids.size).toBe(5000);
    expect(shardZetaId(10414)).toBe(shardZetaId(10414));
  });

  test("the id takes no clock and no randomness — two mints are equal across time", () => {
    const a = shardZetaId(4242);
    const b = shardZetaId(4242);
    expect(a).toBe(b);
    // and the path with it
    expect(shardPathFor(4242, "/r")).toBe(shardPathFor(4242, "/r"));
  });

  test("path buckets by thousand and names by 32-hex ZetaId", () => {
    expect(shardPathFor(671, "root")).toMatch(/^root\/000\/[0-9a-f]{32}\.json$/);
    expect(shardPathFor(10414, "root")).toMatch(/^root\/010\/[0-9a-f]{32}\.json$/);
  });

  test("rejects a non-positive or non-integer key rather than minting nonsense", () => {
    expect(() => shardZetaId(0)).toThrow();
    expect(() => shardZetaId(-1)).toThrow();
    expect(() => shardZetaId(1.5)).toThrow();
  });
});

// ── §12 idempotency ───────────────────────────────────────────────────────

describe("idempotency (§12) — re-archiving is an upsert", () => {
  test("writing the same PR twice leaves ONE file and reports noop", () => {
    const root = tmpRoot("upsert");
    const first = writeShard(entry(10414), root);
    const second = writeShard(entry(10414), root);
    expect(first.classification).toBe("added");
    expect(second.classification).toBe("noop");
    expect(second.changed).toBe(false);
    expect(second.path).toBe(first.path);
    expect(readdirSync(join(root, "010")).length).toBe(1);
    expect(loadAllShards(root).entries.length).toBe(1);
  });

  test("a re-run that only advanced the wall clock is a NOOP, not a rewrite", () => {
    // The live failure this locks: re-archiving PR #10413 on 2026-08-13 reported
    // `manifest=noop, shard=replaced`, because `updateManifest` excludes `fetched_at` +
    // `commit_sha` from its equality check and `writeShard` did not. Two writers, two
    // idempotency rules — so every re-run would churn a shard AND drift the derived index
    // off the manifest it is supposed to reproduce.
    const root = tmpRoot("noise");
    const first = writeShard(entry(10414), root);
    const bytesBefore = readFileSync(first.path, "utf8");
    const later = writeShard(
      entry(10414, { fetched_at: "2026-09-01T12:34:56.000Z", commit_sha: "f".repeat(40) }),
      root,
    );
    expect(later.classification).toBe("noop");
    expect(later.changed).toBe(false);
    expect(readFileSync(first.path, "utf8")).toBe(bytesBefore);
  });

  test("re-archiving with CHANGED content replaces in place — still one file", () => {
    const root = tmpRoot("replace");
    writeShard(entry(10414), root);
    const again = writeShard(entry(10414, { title: "retitled", source_ids: ["thread:T2"] }), root);
    expect(again.classification).toBe("replaced");
    expect(readdirSync(join(root, "010")).length).toBe(1);
    const loaded = loadAllShards(root);
    expect(loaded.entries.length).toBe(1);
    expect(loaded.entries[0]!.title).toBe("retitled");
  });
});

// ── §2 lock-free: the conflict class, demonstrated against a control ───────

function git(cwd: string, args: string[]): { status: number; out: string } {
  try {
    const out = execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { status: 0, out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, out: (e.stdout ?? "") + (e.stderr ?? "") };
  }
}

function initRepo(): string {
  const root = tmpRoot("git");
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "shadow@example.invalid"]);
  git(root, ["config", "user.name", "shadow"]);
  git(root, ["config", "commit.gpgsign", "false"]);
  writeFileSync(join(root, "README.md"), "seed\n");
  git(root, ["add", "-A"]);
  git(root, ["commit", "-qm", "seed"]);
  return root;
}

describe("§2 lock-free — two concurrent archives, demonstrated with real git", () => {
  test("SHARDS: two branches archiving different PRs merge with NO conflict", () => {
    const root = initRepo();
    const shardRoot = join(root, SHARD_ROOT_RELATIVE);

    git(root, ["checkout", "-q", "-b", "archive-a"]);
    writeShard(entry(10500), shardRoot);
    git(root, ["add", "-A"]);
    git(root, ["commit", "-qm", "archive PR 10500"]);

    git(root, ["checkout", "-q", "main"]);
    git(root, ["checkout", "-q", "-b", "archive-b"]);
    writeShard(entry(10501), shardRoot);
    git(root, ["add", "-A"]);
    git(root, ["commit", "-qm", "archive PR 10501"]);

    git(root, ["checkout", "-q", "main"]);
    const mergeA = git(root, ["merge", "--no-edit", "-q", "archive-a"]);
    const mergeB = git(root, ["merge", "--no-edit", "-q", "archive-b"]);
    expect(mergeA.status).toBe(0);
    expect(mergeB.status).toBe(0); // ← the whole point: the second merge does not conflict

    const loaded = loadAllShards(shardRoot);
    expect(loaded.entries.map((e) => e.pr_number)).toEqual([10500, 10501]);
    expect(loaded.rejected).toEqual([]);
    expect(loaded.duplicates).toEqual([]);
  });

  test("CONTROL: the same scenario against the single-file manifest DOES conflict", () => {
    const root = initRepo();
    const manifestPath = join(root, MANIFEST_RELATIVE);
    mkdirSync(join(manifestPath, ".."), { recursive: true });
    // Pre-existing manifest, exactly as on main.
    writeFileSync(manifestPath, deriveManifest([entry(10400), entry(10401)]), "utf8");
    git(root, ["add", "-A"]);
    git(root, ["commit", "-qm", "manifest"]);

    // Each branch does a read-modify-write append — the old `updateManifest` shape.
    const appendOnBranch = (branch: string, pr: number): void => {
      git(root, ["checkout", "-q", "-b", branch, "main"]);
      const cur = readFileSync(manifestPath, "utf8");
      writeFileSync(manifestPath, cur + serializeManifestEntry(entry(pr)) + "\n", "utf8");
      git(root, ["add", "-A"]);
      git(root, ["commit", "-qm", `manifest PR ${String(pr)}`]);
      git(root, ["checkout", "-q", "main"]);
    };
    appendOnBranch("m-a", 10500);
    appendOnBranch("m-b", 10501);

    const mergeA = git(root, ["merge", "--no-edit", "-q", "m-a"]);
    const mergeB = git(root, ["merge", "--no-edit", "-q", "m-b"]);
    expect(mergeA.status).toBe(0);
    expect(mergeB.status).not.toBe(0); // ← the defect this work removes, reproduced
    expect(mergeB.out).toContain("CONFLICT");
    git(root, ["merge", "--abort"]);
  });
});

// ── The derived index ─────────────────────────────────────────────────────

describe("derived manifest", () => {
  test("ordering is pr_number ASCENDING by INTEGER compare — not string order", () => {
    const derived = deriveManifest([entry(10394), entry(671), entry(6247)]);
    const prs = derived
      .trim()
      .split("\n")
      .map((l) => (JSON.parse(l) as ManifestEntry).pr_number);
    expect(prs).toEqual([671, 6247, 10394]);
    // Falsifier for the rule: string collation would have produced this instead.
    const stringOrder = [10394, 671, 6247].map(String).sort();
    expect(stringOrder).toEqual(["10394", "6247", "671"]);
  });

  test("round trip: entries -> shards -> derived index is byte-identical", () => {
    const root = tmpRoot("roundtrip");
    const entries = [entry(671), entry(6247), entry(10394)];
    for (const e of entries) writeShard(e, root);
    expect(deriveManifest(loadAllShards(root).entries)).toBe(deriveManifest(entries));
  });

  test("the three real-world escaping hazards survive the round trip byte-for-byte", () => {
    // PRs 6247 / 6521 / 7865 are the ONLY three manifest entries whose title contains a
    // backslash or a control character (CHECKED against the 6338-entry manifest on
    // 2026-08-13). They are valid JSON — a line/regex-oriented reader is what misreads
    // them — so the migration must move them without re-escaping drift.
    const hazards = [
      entry(6247, { title: "test(ci): option B — relocate docker data-root to D:\\ so Windows-CI can install ollama" }),
      entry(6521, { title: "fix(DynamicValue): C# JSON \\uXXXX uses AllowHexSpecifier not HexNumber" }),
      entry(7865, { title: "fix(setup): skip idle \nSkipping NuGet package signature verification.\nUpdated" }),
    ];
    const root = tmpRoot("escape");
    for (const e of hazards) writeShard(e, root);
    const derived = deriveManifest(loadAllShards(root).entries);
    expect(derived).toBe(deriveManifest(hazards));
    const back = parseManifest(derived);
    expect(back.unparseable).toEqual([]);
    expect(back.entries.map((e) => e.title)).toEqual(hazards.map((e) => e.title));
  });

  test("a misfiled shard is REPORTED, never silently folded in", () => {
    const root = tmpRoot("misfiled");
    writeShard(entry(10414), root);
    // Same content, wrong path (the id no longer encodes the pr_number).
    const wrong = join(root, "000", "0".repeat(32) + ".json");
    mkdirSync(join(wrong, ".."), { recursive: true });
    writeFileSync(wrong, readFileSync(shardPathFor(10414, root), "utf8"));
    const loaded = loadAllShards(root);
    expect(loaded.misfiled.length).toBe(1);
    expect(loaded.entries.length).toBe(1);
  });

  test("an unreadable shard is REPORTED, never silently dropped", () => {
    const root = tmpRoot("unreadable");
    writeShard(entry(10414), root);
    writeFileSync(join(root, "010", "1".repeat(32) + ".json"), "{ not json", "utf8");
    const loaded = loadAllShards(root);
    expect(loaded.rejected.length).toBe(1);
    expect(loaded.rejected[0]!.reason).toContain("JSON.parse failed");
  });
});

// ── Validation + quarantine ───────────────────────────────────────────────

describe("validation and quarantine", () => {
  test("validateEntry names the reason instead of throwing", () => {
    expect(validateEntry(null)).toEqual({ ok: false, reason: "not a JSON object" });
    expect(validateEntry({ ...entry(1), state: "WEIRD" }).ok).toBe(false);
    expect(validateEntry({ ...entry(1), pr_number: "1" }).ok).toBe(false);
    expect(validateEntry({ ...entry(1), merged_at: null }).ok).toBe(true);
  });

  test("unparseable manifest lines are carried out with their reason and line number", () => {
    const blob =
      [serializeManifestEntry(entry(1)), "=======", "{}", serializeManifestEntry(entry(2))].join("\n") + "\n";
    const parsed = parseManifest(blob);
    expect(parsed.entries.map((e) => e.pr_number)).toEqual([1, 2]);
    expect(parsed.unparseable.length).toBe(2);
    expect(parsed.unparseable[0]!.lineNumber).toBe(2);
    expect(parsed.unparseable[0]!.raw).toBe("=======");
    const sidecar = serializeUnparseable(parsed.unparseable);
    expect(sidecar.trim().split("\n").length).toBe(2);
    expect(JSON.parse(sidecar.split("\n")[0]!).reason).toContain("JSON.parse failed");
  });
});

// ── Migration + drift gate, end to end ────────────────────────────────────

describe("migration and drift gate", () => {
  function seedRepo(lines: string[]): string {
    const root = tmpRoot("migrate");
    mkdirSync(join(root, "docs", "github", "prs"), { recursive: true });
    writeFileSync(join(root, MANIFEST_RELATIVE), lines.join("\n") + "\n", "utf8");
    return root;
  }

  test("migration is re-runnable: second run is all-noop and still verifies", () => {
    const root = seedRepo([entry(671), entry(6247), entry(10394)].map(serializeManifestEntry));
    const first = runMigration({ root, dryRun: false, verifyOnly: false, writeManifest: true });
    expect(first.code).toBe(0);
    expect(first.lines.join("\n")).toContain("BYTE-IDENTICAL");
    const second = runMigration({ root, dryRun: false, verifyOnly: false, writeManifest: true });
    expect(second.code).toBe(0);
    expect(second.lines.join("\n")).toContain("added=0 replaced=0 noop=3");
  });

  test("migration quarantines a corrupt line to the sidecar instead of losing it", () => {
    const root = seedRepo([serializeManifestEntry(entry(671)), "=======", serializeManifestEntry(entry(700))]);
    const res = runMigration({ root, dryRun: false, verifyOnly: false, writeManifest: false });
    expect(res.code).toBe(0);
    const sidecar = join(root, "docs", "github", "prs", "unparseable.jsonl");
    expect(existsSync(sidecar)).toBe(true);
    expect(readFileSync(sidecar, "utf8")).toContain("=======");
  });

  test("drift gate: clean after migration, exit 1 once a shard changes, 0 again after --write", () => {
    const root = seedRepo([entry(671), entry(6247)].map(serializeManifestEntry));
    runMigration({ root, dryRun: false, verifyOnly: false, writeManifest: true });
    expect(runDerive({ root, write: false }).code).toBe(0);

    writeShard(entry(9999), join(root, SHARD_ROOT_RELATIVE));
    const drifted = runDerive({ root, write: false });
    expect(drifted.code).toBe(1);
    expect(drifted.lines.join("\n")).toContain("has drifted");

    expect(runDerive({ root, write: true }).code).toBe(0);
    expect(runDerive({ root, write: false }).code).toBe(0);
    const prs = parseManifest(readFileSync(join(root, MANIFEST_RELATIVE), "utf8")).entries.map((e) => e.pr_number);
    expect(prs).toEqual([671, 6247, 9999]);
  });

  test("drift gate exits 2 (not 0) when the shard store itself is broken", () => {
    const root = seedRepo([serializeManifestEntry(entry(671))]);
    runMigration({ root, dryRun: false, verifyOnly: false, writeManifest: true });
    writeFileSync(join(root, SHARD_ROOT_RELATIVE, "000", "2".repeat(32) + ".json"), "{ nope", "utf8");
    expect(runDerive({ root, write: false }).code).toBe(2);
  });
});
