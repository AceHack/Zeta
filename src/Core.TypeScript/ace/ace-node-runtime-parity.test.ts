// ace-node-runtime-parity.test.ts — the falsifier for "ace runs on plain node".
//
// WHY THIS FILE EXISTS. `ace` is the one-liner installer's payload. Aaron's runtime
// ladder puts *recompile-from-source* above *download a trusted binary*, because
// "source you recompile is source you can verify; a prebuilt binary is bytes you must
// trust" (docs/DECISIONS/2026-08-24-ace-runtime-selection-is-a-declared-cost-model-not-a-preference-list.md).
// Today the only shippable ace artifact is a 61 MiB `bun build --compile` binary. A
// host that already has node can instead run the source it already cloned — but only
// while node's ESM resolver can resolve every specifier in ace's runtime closure.
//
// Node's ESM resolver requires an EXPLICIT file extension on relative specifiers.
// Bun's does not. So `import { x } from "./y"` runs fine under bun and dies under node
// with ERR_MODULE_NOT_FOUND — and nothing in the bun-only test suite notices. That is
// the exact shape of a check that cannot fail: the node rung would silently rot back
// to broken on the next extensionless import anyone adds.
//
// TWO GUARDS, deliberately not one:
//   (1) STATIC  — no relative specifier in ace's runtime closure may be extensionless.
//                 Names the offending file:specifier, so a regression is a one-line fix.
//   (2) DYNAMIC — the same ace commands, run under bun and under node, must produce
//                 BYTE-IDENTICAL stdout and the same exit code. "node runs it" is worth
//                 much less than "node produces identical output" — the second is what
//                 makes the source rung a substitute for the binary rung rather than a
//                 second, differently-behaving ace.
//
// NODE IS REQUIRED, NOT OPTIONAL. `.mise.toml` pins Node 24 as a first-class toolchain
// and `package.json`'s `typecheck` script executes `node` directly. So a missing node is
// a broken environment, and this test FAILS rather than skipping: a check that did not
// run must never look like one that passed.

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ACE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(ACE_DIR, "..", "..", "..");
const ACE_ENTRY = join(ACE_DIR, "ace.ts");

/** `node` resolved from PATH. Absent = broken environment, not a reason to skip. */
function nodeBin(): string {
  const r = spawnSync("sh", ["-c", "command -v node"], { encoding: "utf8" });
  const path = r.stdout.trim();
  if (r.status !== 0 || path.length === 0) {
    throw new Error(
      "node is not on PATH. It is a pinned toolchain in .mise.toml and package.json's " +
        "`typecheck` script runs it directly, so this is a broken environment — not a skip.",
    );
  }
  return path;
}

// ---------------------------------------------------------------- (1) static guard

const SPECIFIER =
  /(?:^|\n)\s*(?:import|export)\s[\s\S]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;

const CANDIDATE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".mts"] as const;

interface Source {
  readonly path: string;
  readonly text: string;
}

/**
 * Read a file, or null if it is absent / a directory / unreadable.
 *
 * Deliberately ONE syscall with a catch, never `existsSync` followed by `readFileSync`:
 * that pair is check-then-use (CWE-367) and `lint-check-then-use-file-races.ts` refuses it
 * repo-wide. The `catch` is not swallowing an error — "cannot be read as a file" IS the
 * answer this resolver wants, and it is the same answer for every reason it might hold.
 */
function tryRead(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** Resolve one relative specifier the way bun would, returning its contents. */
function loadSpecifier(fromDir: string, spec: string): Source | null {
  const base = resolve(fromDir, spec);
  const candidates = [base, ...CANDIDATE_EXTENSIONS.map((e) => base + e), join(base, "index.ts")];
  for (const path of candidates) {
    const text = tryRead(path);
    if (text !== null) return { path, text };
  }
  return null;
}

interface ClosureReport {
  readonly files: readonly string[];
  readonly extensionless: readonly string[];
  readonly bare: readonly string[];
}

/** Walk the static import closure from `entry`, reporting extensionless relative specifiers. */
function walkClosure(entry: string): ClosureReport {
  const seenFiles = new Set<string>();
  const extensionless: string[] = [];
  const bare = new Set<string>();
  const entryText = tryRead(entry);
  if (entryText === null) throw new Error(`ace entry point is unreadable: ${entry}`);
  const queue: Source[] = [{ path: entry, text: entryText }];

  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined || seenFiles.has(current.path)) continue;
    seenFiles.add(current.path);
    SPECIFIER.lastIndex = 0;
    const seenHere = new Set<string>();
    let m: RegExpExecArray | null = SPECIFIER.exec(current.text);
    while (m !== null) {
      const spec = m[1] ?? m[2] ?? m[3];
      m = SPECIFIER.exec(current.text);
      if (spec === undefined || seenHere.has(spec)) continue;
      seenHere.add(spec);
      if (spec.startsWith("node:")) continue;
      if (!spec.startsWith(".") && !spec.startsWith("/")) {
        bare.add(spec);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs|cjs|mts|json)$/.test(spec)) {
        extensionless.push(`${relative(REPO_ROOT, current.path)} :: "${spec}"`);
      }
      const target = loadSpecifier(dirname(current.path), spec);
      if (target !== null) queue.push(target);
    }
  }
  return {
    files: [...seenFiles].map((f) => relative(REPO_ROOT, f)).sort(),
    extensionless: extensionless.sort(),
    bare: [...bare].sort(),
  };
}

describe("ace runtime closure is node-ESM-resolvable", () => {
  test("no relative import specifier in ace's closure is extensionless", () => {
    const report = walkClosure(ACE_ENTRY);
    // Reported as the full list, not a count: a regression must name its own file.
    expect(report.extensionless).toEqual([]);
  });

  test("the closure is non-trivial — guards against a walker that silently found nothing", () => {
    // Without this the assertion above passes vacuously if the walker breaks.
    const report = walkClosure(ACE_ENTRY);
    expect(report.files.length).toBeGreaterThanOrEqual(20);
    expect(report.files).toContain("src/Core.TypeScript/ace/store.ts");
  });

  test("ace's npm footprint is exactly one package — the source rung's measured cost", () => {
    // ace needs @noble/hashes and nothing else. This is NOT node-specific: bun fails
    // identically without it, so it is a cost of the *source* rung, not of the node rung.
    // If this list grows, the one-liner installer's dependency story changed and the
    // runtime cost model in docs/DECISIONS/2026-08-24-ace-runtime-selection-*.md is stale.
    const report = walkClosure(ACE_ENTRY);
    expect(report.bare).toEqual(["@noble/hashes/blake3.js"]);
  });
});

// --------------------------------------------------------------- (2) dynamic guard

/** Node's advisory about a `type`-less package.json. Informational, stderr-only. */
const NODE_TYPELESS_ADVISORY =
  /^.*(MODULE_TYPELESS_PACKAGE_JSON|Reparsing as ES module|To eliminate this warning|trace-warnings).*$\n?/gm;

interface RunOutcome {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Run an ace command list under `bin`, in `sandbox`, with `sandbox/home` as HOME.
 * The sandbox path is IDENTICAL for both runtimes (reset between them) so that any
 * path appearing in the output is the same string for both — a byte comparison that
 * differed only by tmpdir name would be a false red.
 */
function runAce(bin: string, sandbox: string, commands: readonly (readonly string[])[]): RunOutcome {
  rmSync(sandbox, { recursive: true, force: true });
  mkdirSync(join(sandbox, "home"), { recursive: true });
  seedSandbox(sandbox);
  let stdout = "";
  let stderr = "";
  let status = 0;
  for (const argv of commands) {
    const r = spawnSync(bin, [ACE_ENTRY, ...argv], {
      cwd: sandbox,
      encoding: "utf8",
      env: { ...process.env, HOME: join(sandbox, "home") },
    });
    stdout += r.stdout + `rc=${r.status}\n`;
    stderr += r.stderr;
    status = r.status ?? -1;
  }
  return { status, stdout, stderr };
}

/** files hash is over JSON.stringify(files) only, so the manifest may carry extra keys. */
const PKG_FILES = { "README.md": "hello ace\n", "bin/run.sh": "#!/bin/sh\necho hi\n" } as const;
const PKG_HASH = "blake3:3630696ecfdda908313eb3bf86130d0b7ccfdca071cdef07346d4ce2e2687cfd";

/**
 * A dependency graph inside the hand-rolled YAML subset (`yaml/reader.ts`): block
 * mappings and block sequences only, no flow style, no block scalars, no anchors.
 * Chosen deliberately — see the `ace deps` boundary test below.
 */
const SUBSET_GRAPH = [
  "apiVersion: ace.zeta/v1",
  "kind: AppDependencyGraph",
  "metadata:",
  "  name: subset-demo",
  "spec:",
  "  dependsOn:",
  "    - chart: alpha",
  "      needs:",
  "        - beta",
  "    - chart: beta",
  "      needs:",
  "",
].join("\n");

function seedSandbox(sandbox: string): void {
  writeFileSync(join(sandbox, "graph.yaml"), SUBSET_GRAPH);
  writeFileSync(
    join(sandbox, "pkg.json"),
    JSON.stringify({
      manifest: { format_version: 1, name: "demo", version: "1.0.0", content_hash: PKG_HASH },
      files: PKG_FILES,
    }),
  );
}

describe("ace produces byte-identical output under bun and under node", () => {
  const scenarios: readonly { readonly name: string; readonly commands: readonly (readonly string[])[] }[] = [
    { name: "help", commands: [["help"]] },
    { name: "empty store", commands: [["list"], ["list", "--json"], ["trust", "list"], ["registry", "list"]] },
    {
      name: "error paths",
      commands: [["frobnicate"], ["list", "--nope"], ["verify", PKG_HASH]],
    },
    {
      name: "install + list + verify (exercises BLAKE3 on the write and read paths)",
      commands: [
        ["install", "./pkg.json", "--allow-no-signature"],
        ["list", "--json"],
        ["verify", PKG_HASH],
        ["registry", "add", "demo", "1.0.0", "https://example.invalid/demo.json", "--hash", PKG_HASH],
        ["registry", "list"],
      ],
    },
    {
      name: "deps validate on subset YAML (exercises the hand-rolled reader + DAG resolver)",
      commands: [["deps", "validate", "--graph", "./graph.yaml"]],
    },
  ];

  for (const scenario of scenarios) {
    test(`${scenario.name} — stdout identical, same exit code`, () => {
      const node = nodeBin();
      const sandbox = mkdtempSync(join(tmpdir(), "ace-parity-"));
      try {
        const bunRun = runAce(process.execPath, sandbox, scenario.commands);
        const nodeRun = runAce(node, sandbox, scenario.commands);
        // stdout is compared RAW — no normalisation, no filtering.
        expect(nodeRun.stdout).toBe(bunRun.stdout);
        expect(nodeRun.status).toBe(bunRun.status);
        // stderr differs only by node's own advisory about the type-less package.json.
        expect(nodeRun.stderr.replace(NODE_TYPELESS_ADVISORY, "")).toBe(bunRun.stderr);
      } finally {
        rmSync(sandbox, { recursive: true, force: true });
      }
    });
  }

  test("the parity comparison is not vacuous — a real transcript was compared", () => {
    const node = nodeBin();
    const sandbox = mkdtempSync(join(tmpdir(), "ace-parity-"));
    try {
      const commands = [
        ["install", "./pkg.json", "--allow-no-signature"],
        ["list", "--json"],
      ] as const;
      const nodeRun = runAce(node, sandbox, commands);
      // A comparison of two empty strings would pass every assertion above.
      expect(nodeRun.stdout.length).toBeGreaterThan(200);
      expect(nodeRun.stdout).toContain(PKG_HASH);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});

// ------------------------------------------------------- the ONE measured divergence

describe("ace deps + out-of-subset YAML is the node rung's honest boundary", () => {
  // FOUND BY MEASUREMENT, not predicted. `ace deps` on a graph that uses flow sequences
  // (`needs: [cilium]`) or folded block scalars (`>-`) falls out of the hand-rolled subset
  // reader and into `yaml/vendor.ts`, whose adapter is **`Bun.YAML`** — a Bun built-in with
  // no node equivalent. So on node that path REFUSES.
  //
  // This is not a regression and not a bug: the adapter probes for the built-in and returns
  // a NAMED refusal rather than a TypeError, which is the behaviour `yaml/vendor.ts` was
  // written to have. It is recorded here because a rung's limits must be as legible as its
  // capabilities — "ace runs on node" would otherwise read as a promise this one command
  // does not keep, and silence about it is how the next reader gets surprised in production.
  //
  // Widening the subset to close the gap is explicitly forbidden unilaterally: the six-oracle
  // byte-lock rests on every oracle declining the SAME inputs (081KT7YW00008QG0R002T1XNWT).
  // Closing it properly means a node-side vendor adapter, which is a separate decision.
  const OUT_OF_SUBSET_GRAPH = [
    "apiVersion: ace.zeta/v1",
    "kind: AppDependencyGraph",
    "metadata:",
    "  name: flow-demo",
    "spec:",
    "  dependsOn:",
    "    - chart: alpha",
    "      needs: [beta]",
    "    - chart: beta",
    "      needs:",
    "",
  ].join("\n");

  test("bun parses it via the Bun.YAML adapter; node refuses BY NAME rather than crashing", () => {
    const node = nodeBin();
    const sandbox = mkdtempSync(join(tmpdir(), "ace-parity-yaml-"));
    try {
      const write = (): void => {
        writeFileSync(join(sandbox, "flow.yaml"), OUT_OF_SUBSET_GRAPH);
      };
      mkdirSync(join(sandbox, "home"), { recursive: true });
      write();
      const argv = [ACE_ENTRY, "deps", "validate", "--graph", "./flow.yaml"];
      const opts = { cwd: sandbox, encoding: "utf8" as const, env: { ...process.env, HOME: join(sandbox, "home") } };

      const underBun = spawnSync(process.execPath, argv, opts);
      const underNode = spawnSync(node, argv, opts);

      // bun: the vendor adapter answers, so the graph validates.
      expect(underBun.status).toBe(0);

      // node: a NAMED refusal on stderr, not a stack trace and not a silent wrong answer.
      expect(underNode.status).toBe(1);
      expect(underNode.stderr).toContain("Bun.YAML is unavailable on this runtime");
      expect(underNode.stderr).not.toContain("TypeError");
      expect(underNode.stdout).toBe("");
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});

// ------------------------------------------------- the highest-stakes surface: signing

describe("ace's Ed25519 signing path is byte-identical across runtimes", () => {
  // The integrity gate (BLAKE3) is covered by the install/list transcript above. The
  // AUTHENTICITY gate is separate and is the one an attacker cares about, so it gets its
  // own falsifier: if node and bun derived different key ids, or produced different
  // signature bytes for the same key and payload, a package signed on one runtime would
  // fail verification on the other — and the byte-identity claim would be false exactly
  // where it matters most.
  //
  // Ed25519 signatures are deterministic by construction (RFC 8032 §5.1.6: the nonce is
  // derived from the key and message, never from an RNG). That is what makes this a
  // legitimate byte comparison rather than a comparison of two random draws — and it is
  // also why a divergence here would be a real defect rather than expected noise.
  test("same key + same payload -> identical key id and identical signature bytes", () => {
    const node = nodeBin();
    const sandbox = mkdtempSync(join(tmpdir(), "ace-parity-sign-"));
    try {
      const home = join(sandbox, "home");
      mkdirSync(home, { recursive: true });
      seedSandbox(sandbox);
      const opts = { cwd: sandbox, encoding: "utf8" as const, env: { ...process.env, HOME: home } };

      // The keypair is generated ONCE (it is genuinely random), then both runtimes sign
      // with it. Generating one per runtime would compare two different keys and prove
      // nothing — the vacuity class wearing a crypto test's clothes.
      const keygen = spawnSync(process.execPath, [ACE_ENTRY, "keygen", "--out", "demo"], opts);
      expect(keygen.status).toBe(0);

      // BOTH write to the SAME `--out` path, and the first result is read before the second
      // run overwrites it. Giving each runtime its own filename would put that filename in
      // the success message and make stdout differ for a reason that has nothing to do with
      // the runtimes — a false red that hides a real one. (Caught by exactly that.)
      const signArgv = [ACE_ENTRY, "sign", "./pkg.json", "--key", "./demo.key", "--out", "./sig.json"];

      const bunSign = spawnSync(process.execPath, signArgv, opts);
      expect(bunSign.status).toBe(0);
      const fromBun = readFileSync(join(sandbox, "sig.json"), "utf8");

      const nodeSign = spawnSync(node, signArgv, opts);
      expect(nodeSign.status).toBe(0);
      const fromNode = readFileSync(join(sandbox, "sig.json"), "utf8");

      // stdout carries the derived key id — identical means both runtimes agree on identity.
      expect(nodeSign.stdout).toBe(bunSign.stdout);
      expect(fromNode).toBe(fromBun);

      // Not vacuous: a signature was actually produced, over the payload we meant.
      const signed = JSON.parse(fromBun) as { manifest?: { signature?: { algo?: string; sig?: string } } };
      expect(signed.manifest?.signature?.algo).toBe("ed25519");
      expect((signed.manifest?.signature?.sig ?? "").length).toBeGreaterThan(60);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
