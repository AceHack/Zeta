// Execute the reviewed emitter through a finite dependency/capability fixture.
// node:vm is NOT a security boundary for untrusted code. These tests cover the
// named mutations and exact exercised I/O, not arbitrary JavaScript escape paths.
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import {
  createSourceFile,
  forEachChild,
  isCallExpression,
  ModuleKind,
  ScriptTarget,
  SyntaxKind,
  transpileModule,
} from "typescript";
import type { Node } from "typescript";
import type { NciWitnessOutcome } from "./nci-witness-receipt";

const SOURCE = "src/Core.TypeScript/formal-verification/nci-witness-receipt.ts";
const SUBJECT = "nci-capability-fixture";
const EXECUTABLE = "nci-fixture-runtime";
const SUBJECT_FILES = [
  "src/Core.TLA/specs/NciNonUrgency.tla",
  "src/Core.TLA/specs/NciNonUrgency.cfg",
  "registry/tlc-models.json",
  "src/Core.TLA/tla2tools.jar",
] as const;
const IMPORTS = ["node:crypto", "node:fs", "node:path", "node:child_process"];
const ARGV = ["src/Core.TypeScript/formal-verification/run-tlc.ts", "NciNonUrgency"];
const ORACLE = "src/Core.Python/src/zeta/nci_witness_receipt_oracle.py";
const SOURCE_BYTES = readFileSync(SOURCE, "utf8");
const EXPECTED = readFileSync("docs/research/data/2026-09-06-nci-witness-v1-typescript.json", "utf8");
const HISTORICAL_REGISTRY = "docs/research/data/2026-09-06-nci-witness-v1-registry.json";
const HISTORICAL_JAR = "src/Core.TLA/tla2tools.jar";

/**
 * The historical subject's JAR, by git blob id.
 *
 * The 2026-09-06 witness is pinned to TLC2 2026.05.18.174321. The tree stopped
 * carrying those bytes when the jar was de-vendored onto the rolling from-url
 * row (081M23ESC5B087G0R002HJ39DG), and this tier is HERMETIC -- it never runs
 * install.sh, so even the current jar is absent here. Upstream cannot return the
 * historical bytes either: tlaplus re-uploads the v1.8.0 asset in place.
 *
 * git can. A blob stays reachable from the commits that carried it, so
 * `git cat-file` is a permanent, content-addressed source for exactly the bytes
 * the receipt names. CI checks out at the default `fetch-depth: 1`, so the
 * object is not in the clone and the one commit that carries it is fetched
 * first; `--depth` bounds history, not tree contents.
 */
const HISTORICAL_JAR_BLOB = "2fb671d8be5a1e137f001965d0246509e882aed3";
const HISTORICAL_JAR_COMMIT = "c6f83e35e20f8648a8a408d23f13ea3e42927264";

function git(args: readonly string[]): { status: number | null; stdout: Buffer } {
  const result = spawnSync("git", args, { maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout };
}

function historicalJarBytes(): Buffer {
  const direct = git(["cat-file", "blob", HISTORICAL_JAR_BLOB]);
  if (direct.status === 0) return direct.stdout;
  git(["fetch", "--depth", "1", "--no-tags", "origin", HISTORICAL_JAR_COMMIT]);
  const retry = git(["cat-file", "blob", HISTORICAL_JAR_BLOB]);
  if (retry.status === 0) return retry.stdout;
  // RAISE rather than skip: a silently-skipped historical witness is the exact
  // vacuity this file exists to prevent. This cannot tell "wrong bytes" from
  // "git could not answer", and says so rather than picking one.
  throw new Error(
    `cannot obtain historical tla2tools blob ${HISTORICAL_JAR_BLOB}, even after` +
      ` fetching ${HISTORICAL_JAR_COMMIT} -- that is an UNKNOWN, not a mismatch`,
  );
}

function subjectBytes(path: string): Buffer {
  if (path === "registry/tlc-models.json") return readFileSync(HISTORICAL_REGISTRY);
  if (path === HISTORICAL_JAR) return historicalJarBytes();
  return readFileSync(path);
}
const READ_TRACE = [...SUBJECT_FILES.map((path) => `read:${path}:bytes`), "read:registry/tlc-models.json:utf8"];

interface Emitter {
  renderCanonicalReceipt(root: string): string;
  runNciWitness(root: string): NciWitnessOutcome;
}

/** Real source/type erasure; module linking and effects are supplied by this fixture. */
async function loadEmitter(source = SOURCE_BYTES, status = 0) {
  const trace: string[] = [];
  const dependencies: string[] = [];
  const denials: string[] = [];
  // The registry is the exact historical subject. Remaining current files must
  // still satisfy the emitter's original model/config/jar pins on every call.
  const files = new Map(
    SUBJECT_FILES.map((path) => [join(SUBJECT, path), subjectBytes(path)]),
  );
  const deny = (detail: string): never => {
    denials.push(detail);
    throw new Error(`capability denied: ${detail}`);
  };
  // No dynamic imports are needed by this emitter. Refuse the actual syntax
  // before VM execution: Bun 1.3.13 crashes when exercising that VM callback.
  // This is an admission restriction, not a regex/substring independence proof.
  const syntax = createSourceFile(SOURCE, source, ScriptTarget.ES2022, true);
  const admit = (node: Node): void => {
    if (isCallExpression(node) && node.expression.kind === SyntaxKind.ImportKeyword) deny("dynamic-import-site");
    forEachChild(node, admit);
  };
  admit(syntax);
  const context = createContext({
    process: Object.freeze({ execPath: EXECUTABLE, cwd: () => SUBJECT }),
  });
  const modules: Record<string, Record<string, unknown>> = {
    "node:crypto": { createHash },
    "node:path": { join },
    "node:fs": {
      readFileSync(path: string, encoding?: string) {
        const bytes = files.get(path);
        if (bytes === undefined || (encoding !== undefined && encoding !== "utf8")) return deny(`read:${path}`);
        const relative = SUBJECT_FILES.find((candidate) => join(SUBJECT, candidate) === path);
        trace.push(`read:${relative}:${encoding ?? "bytes"}`);
        return encoding === "utf8" ? bytes.toString("utf8") : Buffer.from(bytes);
      },
    },
    "node:child_process": {
      spawnSync(command: string, args: unknown, options: unknown) {
        if (
          command !== EXECUTABLE ||
          JSON.stringify(args) !== JSON.stringify(ARGV) ||
          JSON.stringify(options) !== JSON.stringify({ cwd: SUBJECT, encoding: "utf8" })
        )
          return deny(`spawn:${command}`);
        trace.push(`spawn:${command}:${JSON.stringify(args)}`);
        // This is an admitted checker-result input, not an executed TLC result.
        return {
          status,
          stdout: status === 0 ? "controlled checker success" : "controlled checker refusal",
          stderr: "",
        };
      },
    },
  };
  const transformed = transpileModule(source, {
    compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ESNext },
    fileName: SOURCE,
  });
  const module = new SourceTextModule(transformed.outputText, {
    context,
    identifier: SOURCE,
    initializeImportMeta(meta) {
      meta.main = false;
    },
    importModuleDynamically(specifier) {
      return deny(`dynamic-import:${specifier}`);
    },
  });
  await module.link((specifier) => {
    dependencies.push(specifier);
    const values = modules[specifier];
    if (!Object.hasOwn(modules, specifier) || values === undefined) return deny(`import:${specifier}`);
    return new SyntheticModule(
      Object.keys(values),
      function () {
        for (const [key, value] of Object.entries(values)) this.setExport(key, value);
      },
      { context },
    );
  });
  await module.evaluate();
  const emitter = module.namespace as unknown as Emitter;
  function checked<T>(operation: () => T): T {
    try {
      return operation();
    } finally {
      // On these synchronous calls, the ledger also detects caught refusals.
      if (denials.length > 0) throw new Error(`capability denied: ${denials.join(", ")}`);
    }
  }
  return {
    dependencies,
    trace,
    render: () => checked(() => emitter.renderCanonicalReceipt(SUBJECT)),
    run: () => checked(() => emitter.runNciWitness(SUBJECT)),
  };
}

function beforeReceipt(statement: string): string {
  const marker = "export function canonicalReceipt(repoRoot: string): NciWitnessReceipt {\n";
  if (SOURCE_BYTES.split(marker).length !== 2) throw new Error("mutation anchor must occur exactly once");
  return SOURCE_BYTES.replace(marker, marker + statement + "\n");
}

describe("NCI emitter exercised dependency and capability boundary", () => {
  test("renders the pinned bytes from the four subject files with an exact read trace", async () => {
    expect(Buffer.byteLength(EXPECTED)).toBe(920);
    expect(createHash("sha256").update(EXPECTED).digest("hex")).toBe(
      "d5e89f5675f478f3dbfe3ff633bc69f4f8b848ceeac15e5383730120a59a173e",
    );
    const fixture = await loadEmitter();
    expect(fixture.dependencies).toEqual(IMPORTS);
    expect(fixture.render()).toBe(EXPECTED);
    expect(fixture.trace).toEqual(READ_TRACE);
  });

  test("runs only the declared checker command and emits exact receipt bytes on its controlled success", async () => {
    const fixture = await loadEmitter();
    expect(fixture.run()).toEqual({ kind: "witness-observed", receipt: EXPECTED });
    expect(fixture.trace).toEqual([...READ_TRACE, `spawn:${EXECUTABLE}:${JSON.stringify(ARGV)}`, ...READ_TRACE]);
  });

  test("a controlled checker failure refuses before receipt revalidation", async () => {
    const fixture = await loadEmitter(SOURCE_BYTES, 1);
    expect(fixture.run()).toEqual({ kind: "refuse-verdict-mismatch", detail: "controlled checker refusal" });
    expect(fixture.trace).toEqual([...READ_TRACE, `spawn:${EXECUTABLE}:${JSON.stringify(ARGV)}`]);
  });

  test("a static checker import is refused by the actual module linker", async () => {
    await expect(loadEmitter(`import "./renamed-checker";\n${SOURCE_BYTES}`)).rejects.toThrow(
      "capability denied: import:./renamed-checker",
    );
  });

  test("a computed dynamic import is refused by syntax admission before VM execution", async () => {
    await expect(loadEmitter(`await import(["node:", "fs/promises"].join(""));\n${SOURCE_BYTES}`)).rejects.toThrow(
      "capability denied: dynamic-import-site",
    );
  });

  test.each([
    ["direct checker read", `readFileSync(join(repoRoot, ${JSON.stringify(ORACLE)}), "utf8");`, "read:"],
    [
      "aliased checker read",
      `const read = readFileSync; read(join(repoRoot, ${JSON.stringify(ORACLE)}), "utf8");`,
      "read:",
    ],
    [
      "computed Python subprocess",
      `spawnSync(["py", "thon3"].join(""), [${JSON.stringify(ORACLE)}]);`,
      "spawn:python3",
    ],
    [
      "different runtime arguments",
      `spawnSync(process.execPath, ["-e", "checker()"], {cwd: repoRoot, encoding: "utf8"});`,
      `spawn:${EXECUTABLE}`,
    ],
    [
      "caught checker-read refusal",
      `try { readFileSync(join(repoRoot, ${JSON.stringify(ORACLE)})); } catch {}`,
      "read:",
    ],
  ])("%s is refused even with the unchanged static import roster", async (_label, statement, error) => {
    const fixture = await loadEmitter(beforeReceipt(statement));
    expect(fixture.dependencies).toEqual(IMPORTS);
    expect(() => fixture.render()).toThrow(`capability denied: ${error}`);
  });
});
