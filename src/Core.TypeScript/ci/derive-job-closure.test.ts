import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  binaryIndex,
  declaredMiseTools,
  deriveClosure,
  invokedBinaries,
  parseGateJobs,
  scanSpawns,
  type DeriveInputs,
} from "./derive-job-closure.ts";

const repoRoot = join(import.meta.dir, "..", "..", "..");

function realInputs(): DeriveInputs {
  return {
    gateYml: readFileSync(join(repoRoot, ".github", "workflows", "gate.yml"), "utf8"),
    miseToml: readFileSync(join(repoRoot, ".mise.toml"), "utf8"),
    readScript: (rel) => {
      try {
        return readFileSync(join(repoRoot, rel), "utf8");
      } catch {
        return null;
      }
    },
  };
}

// ── POSITIVE: the surface this file was written to measure ──────────────────

test("lint (Go) derives exactly bun + go + golangci-lint from the repo itself", () => {
  const closure = deriveClosure("lint (Go)", realInputs());
  expect(closure.tools).toEqual(["bun", "go", "golangci-lint"]);
  expect(closure.unresolved).toEqual([]);
});

test("a Go lint job needs bun — the cross-dependency, asserted so it cannot be forgotten", () => {
  // The job is named for Go and its entry point is a Bun script. If someone rewrites
  // lint-go.ts as a shell script this assertion fails, which is the correct signal:
  // the surface's closure changed.
  expect(deriveClosure("lint (Go)", realInputs()).tools).toContain("bun");
});

// ── NEGATIVE: the deriver must FAIL where reading cannot decide ─────────────

test("a dynamic spawn is reported unresolved, never silently dropped", () => {
  const scan = scanSpawns(`const bin = pick(); spawnSync(bin, args, {});`);
  expect(scan.literals).toEqual([]);
  expect(scan.dynamic).toEqual(["spawnSync(bin)"]);
});

test("a literal binary no declared tool provides is unresolved, not accepted", () => {
  const inputs: DeriveInputs = {
    gateYml: [
      "jobs:",
      "  fake:",
      "    name: lint (Fake)",
      "    steps:",
      "      - name: run",
      "        run: bun scripts/fake.ts",
      "",
    ].join("\n"),
    miseToml: '[tools]\nbun = "1.3"\ngo = "1.26.4"\n',
    readScript: (rel) => (rel === "scripts/fake.ts" ? `spawnSync("eprover", []);` : null),
  };
  const closure = deriveClosure("lint (Fake)", inputs);
  expect(closure.tools).toEqual(["bun"]);
  expect(closure.unresolved).toEqual([
    "scripts/fake.ts spawns 'eprover' — provided by no declared mise tool",
  ]);
});

test("an unreadable second hop is reported, not treated as needing nothing", () => {
  const inputs: DeriveInputs = {
    gateYml: "jobs:\n  fake:\n    name: lint (Fake)\n    steps:\n      - run: bun scripts/gone.ts\n",
    miseToml: '[tools]\nbun = "1.3"\n',
    readScript: () => null,
  };
  expect(deriveClosure("lint (Fake)", inputs).unresolved).toEqual([
    "unreadable second hop: scripts/gone.ts",
  ]);
});

test("an unknown job name throws rather than returning an empty closure", () => {
  expect(() => deriveClosure("lint (Nonexistent)", realInputs())).toThrow(/no job named/u);
});

// ── The measured LIMIT of mechanical derivation, pinned as a falsifier ──────

test("lint (Python) under-derives — a tool invoked THROUGH another tool is invisible", () => {
  // `docs/research/2026-08-19-repo-split-round-3-*.md` lists this job's need as
  // `bun, python, uv, ruff, mypy`. Reading gets `bun, uv`: `ruff` and `mypy` are
  // ARGUMENTS to `uv run`, and `python` is never named at all — `uv sync` implies it.
  //
  // This test asserts the SHORTFALL on purpose. If a future deriver resolves the
  // arguments, this fails and must be updated deliberately — which is the only way a
  // limit stays honest instead of quietly becoming a claim.
  const closure = deriveClosure("lint (Python)", realInputs());
  expect(closure.tools).toEqual(["bun", "uv"]);
  expect(closure.tools).not.toContain("ruff");
  expect(closure.tools).not.toContain("mypy");
  expect(closure.unresolved).toContain(
    "src/Core.TypeScript/lint/lint-python.ts: spawnSync(bin)",
  );
});

// ── Parser units ───────────────────────────────────────────────────────────

test("invokedBinaries sees through `mise exec --` and env prefixes", () => {
  expect(invokedBinaries("mise exec -- markdownlint-cli2 '**/*.md'")).toEqual(["markdownlint-cli2"]);
  expect(invokedBinaries("CGO_ENABLED=0 go vet ./...")).toEqual(["go"]);
  expect(invokedBinaries("# go build ./...")).toEqual([]);
});

test("declaredMiseTools strips backend prefixes and skips non-[tools] sections", () => {
  const tools = declaredMiseTools(readFileSync(join(repoRoot, ".mise.toml"), "utf8"));
  expect(tools).toContain("golangci-lint");
  expect(tools).toContain("semgrep"); // declared as `pipx:semgrep`
  expect(tools).toContain("markdownlint-cli2"); // declared as `npm:markdownlint-cli2`
  expect(tools).not.toContain("python.compile"); // a [settings] key, not a tool
});

test("binaryIndex maps gofmt to go — a binary name is a fact about the package, not the pin", () => {
  expect(binaryIndex(["go"]).get("gofmt")).toBe("go");
  expect(binaryIndex(["golangci-lint"]).get("gofmt")).toBeUndefined();
});

test("parseGateJobs finds every per-language lint job by its display name", () => {
  const names = parseGateJobs(realInputs().gateYml).map((j) => j.name);
  for (const n of ["lint (Go)", "lint (Python)", "lint (Rust)", "lint (TS)", "lint (F#)", "lint (C#)"]) {
    expect(names).toContain(n);
  }
});
