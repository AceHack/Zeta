# Ace CLI MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** distribute the existing `list`-only Ace CLI as an agent skill + a human command via `install.sh` (slice 1), then build the `install` + `verify` integrity path (slice 2).

**Architecture:** Two slices over the existing `tools/ace/` (TS/bun, `list`-only). Slice 1 is pure distribution wiring over what already works (zero new CLI logic). Slice 2 adds the download + content-hash-integrity-verify + extract path. Runtime-portable (Node-floor; bun is the dev runtime); follows the repo's `parseArgs`→discriminated-union, `main`→exit-code, and `bun:test` patterns.

**Tech Stack:** TypeScript on Bun; `bun:test`; `node:fs` / `node:crypto`; the `tools/setup/` install graph (`common/*.sh` + `install.ps1`); `.claude/skills/` router.

**Design doc:** [`2026-06-01-ace-cli-distribution-dx-design.md`](2026-06-01-ace-cli-distribution-dx-design.md) (decisions §8: install.sh-sibling first; skill-installer-only MVP; Node-floor portable).

**Scope guard (YAGNI):** signature/**authenticity** verification (key management) is **NOT** in this plan — slice 2 does **integrity** (content-hash) only, and `install` prints an explicit "integrity-verified, NOT authenticity-verified" line so it is not a green-by-skip (per design §5). Authenticity is a named follow-on (slice 3, out of scope here). The standalone `bunx`/bare-machine bootstrap and the manifest-driving layer are also out of scope (design §8).

---

## File structure

| File | Responsibility | Slice |
|---|---|---|
| `package.json` (modify `bin`) | expose `ace` → `tools/ace/ace.ts` (mirrors the `zeta-shadow` precedent) | 1 |
| `tools/setup/common/repo-bins.sh` (create) | best-effort `bun link` in repo root so `ace` (+ `zeta-shadow`) land on PATH; ensure bun's global bin dir is on the managed PATH | 1 |
| `tools/setup/macos.sh`, `tools/setup/linux.sh` (modify) | source `common/repo-bins.sh` after `agent-clis.sh` | 1 |
| `tools/setup/install.ps1` (modify) | Windows equivalent: `bun link` in repo root, best-effort | 1 |
| `.claude/skills/ace/SKILL.md` (create) | agent surface — router-discovered; verb grammar + invocation + Node-floor precondition | 1 |
| `tools/ace/store.ts` (modify) | add `contentHash()` + `installPackage()` (download→verify→extract) | 2 |
| `tools/ace/store.test.ts` (create) | unit tests for `contentHash` + `installPackage` (store.ts has no test file today; `ace.test.ts` covers `listInstalled`) | 2 |
| `tools/ace/ace.ts` (modify) | wire `install <url>` + `verify <hash>` verbs into `parseArgs` + `main`; drop their stub branches | 2 |
| `tools/ace/ace.test.ts` (modify) | add `parseArgs`/`main` cases for `install`/`verify` | 2 |
| `.claude/skills/ace/SKILL.md` (modify) | mark `install`/`verify` live | 2 |

---

# SLICE 1 — list-only-as-skill + install.sh-sibling

## Task 1: Expose `ace` as a package bin

**Files:**

- Modify: `package.json` (the `"bin"` object)

- [ ] **Step 1: Add the bin entry**

In `package.json`, the `"bin"` object currently is:

```json
  "bin": {
    "zeta-shadow": "tools/shadow/zeta-shadow.ts"
  },
```

Change it to (alphabetical, mirroring the existing precedent):

```json
  "bin": {
    "ace": "tools/ace/ace.ts",
    "zeta-shadow": "tools/shadow/zeta-shadow.ts"
  },
```

- [ ] **Step 2: Verify package.json still parses + the bin is present**

Run: `bun -e "const p=require('./package.json'); if(p.bin.ace!=='tools/ace/ace.ts') process.exit(1); console.log('bin.ace OK')"`
Expected: prints `bin.ace OK`, exit 0.

- [ ] **Step 3: Verify the existing test suite is unaffected**

Run: `bun test tools/ace/`
Expected: PASS (all existing `ace.test.ts` tests; no behavior change).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "feat(ace): expose ace as a package bin (tools/ace/ace.ts), mirroring zeta-shadow"
```

## Task 2: `common/repo-bins.sh` — `bun link` the repo on Unix

**Files:**

- Create: `tools/setup/common/repo-bins.sh`
- Modify: `tools/setup/macos.sh`, `tools/setup/linux.sh`

- [ ] **Step 1: Create the repo-bins step**

Create `tools/setup/common/repo-bins.sh`:

```bash
#!/usr/bin/env bash
#
# tools/setup/common/repo-bins.sh — expose the repo's package bins (ace, zeta-shadow)
# on PATH via `bun link`. The package.json `bin` map declares them; `bun link` in the
# repo root registers the package globally so its bins resolve on PATH (same mechanism
# tools/shadow/README.md documents for zeta-shadow). Best-effort: a failure WARNS and
# continues — these are convenience commands, NOT hard deps; never brick install
# (mirrors common/agent-clis.sh + common/local-llm.sh exceptions-as-signals discipline).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

if ! command -v mise >/dev/null 2>&1; then
  echo "warn: mise not on PATH; skipping repo-bins (bun comes from mise)" >&2
  exit 0
fi

# `bun link` in the repo root registers package bins globally (into bun's global bin dir).
echo "↓ bun link (repo root) → exposes ace + zeta-shadow on PATH (best-effort)..."
if ! (cd "$REPO_ROOT" && mise exec -- bun link); then
  echo "warn: 'bun link' failed; ace/zeta-shadow not globally linked (run 'bun link' in the repo root manually); continuing" >&2
  exit 0
fi

# bun's global bin dir must be on PATH for the linked bins to resolve. `bun pm bin -g`
# prints it; surface it for THIS process + note it for the managed shellenv.
BUN_GLOBAL_BIN="$(cd "$REPO_ROOT" && mise exec -- bun pm bin -g 2>/dev/null || true)"
if [ -n "$BUN_GLOBAL_BIN" ] && [ -d "$BUN_GLOBAL_BIN" ]; then
  case ":${PATH:-}:" in
    *":$BUN_GLOBAL_BIN:"*) : ;;
    *) export PATH="$BUN_GLOBAL_BIN:$PATH" ;;
  esac
  echo "✓ ace linked; bun global bin: $BUN_GLOBAL_BIN (shellenv adds it to PATH for new shells)"
else
  echo "warn: could not resolve bun global bin dir; 'ace' may need a new shell or manual PATH add" >&2
fi
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x tools/setup/common/repo-bins.sh`

- [ ] **Step 3: Wire it into macos.sh after agent-clis**

In `tools/setup/macos.sh`, find the line that runs agent-clis (`"$SETUP_DIR/common/agent-clis.sh"`) and add immediately after it:

```bash
# Expose repo package bins (ace, zeta-shadow) on PATH via `bun link`. Best-effort.
"$SETUP_DIR/common/repo-bins.sh"
```

- [ ] **Step 4: Wire it into linux.sh after agent-clis**

In `tools/setup/linux.sh`, find `"$SETUP_DIR/common/agent-clis.sh"` and add immediately after it the identical two lines from Step 3.

- [ ] **Step 5: Lint the new shell script**

Run: `shellcheck tools/setup/common/repo-bins.sh`
Expected: no errors (warnings about `mise exec` subshells are acceptable; fix any SC2086/quoting errors).

- [ ] **Step 6: Verify the bash-retirement inventory still passes (new .sh under tools/setup/ is allowed)**

Run: `bun tools/hygiene/check-bash-retirement-inventory.ts`
Expected: PASS — `tools/setup/**` shell scripts are allowed (install-graph); if the checker has an explicit allowlist, add `tools/setup/common/repo-bins.sh` to it (category `setup/bootstrap`) and update any hardcoded count the same way the prior shields did.

- [ ] **Step 7: Commit**

```bash
git add tools/setup/common/repo-bins.sh tools/setup/macos.sh tools/setup/linux.sh tools/hygiene/check-bash-retirement-inventory.ts
git commit -m "feat(install): repo-bins.sh — bun link exposes ace + zeta-shadow on PATH (Unix; best-effort)"
```

## Task 3: `install.ps1` — `bun link` the repo on Windows

**Files:**

- Modify: `tools/setup/install.ps1`

- [ ] **Step 1: Add a repo-bins step after the agent-clis / claude-code step**

In `tools/setup/install.ps1`, after the claude-code install step (the `Invoke-Tool { mise exec -- bun install --global '@anthropic-ai/claude-code' }` line) and before the local-LLM step, add:

```powershell
# Expose the repo's package bins (ace, zeta-shadow) on PATH via `bun link` (the package.json
# `bin` map declares them). Best-effort + GRACEFUL (Invoke-ToolSoft): a failure WARNS and
# continues — convenience commands, not hard deps; never brick install. Parity with
# common/repo-bins.sh on Unix.
$rbCode = Invoke-ToolSoft { mise exec -- bun link }
if ($rbCode -eq 0) { Write-Host "ok bun link — ace + zeta-shadow linked (open a new shell to pick up bun's global bin on PATH)" }
else { Write-Host "warn: 'bun link' failed (exit $rbCode); run it in the repo root manually; continuing" }
```

(`install.ps1` already `Push-Location $RepoRoot` for `mise install`; this step runs after that block returns, so add a `Push-Location $RepoRoot` / `Pop-Location` around it, mirroring the existing mise block.)

```powershell
Push-Location $RepoRoot
try {
  $rbCode = Invoke-ToolSoft { mise exec -- bun link }
  if ($rbCode -eq 0) { Write-Host "ok bun link — ace + zeta-shadow linked (open a new shell to pick up bun's global bin on PATH)" }
  else { Write-Host "warn: 'bun link' failed (exit $rbCode); run it in the repo root manually; continuing" }
} finally { Pop-Location }
```

- [ ] **Step 2: PowerShell AST syntax check**

Run: `pwsh -NoProfile -Command '$e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path tools/setup/install.ps1),[ref]$null,[ref]$e); if($e){$e|%{Write-Host $_.Message}; exit 1} else {Write-Host "PS syntax OK"}'`
Expected: `PS syntax OK`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add tools/setup/install.ps1
git commit -m "feat(install.ps1): bun link the repo — expose ace + zeta-shadow on PATH (Windows; best-effort, parity with repo-bins.sh)"
```

## Task 4: `.claude/skills/ace/SKILL.md` — the agent surface

**Files:**

- Create: `.claude/skills/ace/SKILL.md`

- [ ] **Step 1: Create the skill**

Create `.claude/skills/ace/SKILL.md`:

````markdown
---
name: ace
description: Ace DLC package manager — list (and, when built, install/verify) content-addressed packages from the local ~/.ace store. Run via bun; Node-floor portable.
record_source: "081KR2E4K0008QG0R002YE3MMD + ace-package-manager agenda; distribution per 2026-06-01 design"
load_datetime: "2026-06-01"
last_updated: "2026-06-01"
status: active
---

# Ace — DLC package manager (skill surface)

Ace is the repo's package manager (`tools/ace/ace.ts`). This skill is the agent
surface; the human surface is the `ace` command (exposed by `install.sh` via
`bun link`).

## Runtime precondition (load-bearing)

Ace is TS run on **bun** in-repo: `bun tools/ace/ace.ts <verb>`. The floor is a JS
runtime — **Node ≥ 22.5 or bun**. Harnesses with a JS runtime (Claude Code, Cursor,
Gemini CLI) run it directly. A pure-Rust harness with **no** JS runtime (e.g. OpenAI
Codex CLI) must first install bun/Node (run the repo `install.sh`) — Ace cannot run
without one.

## Verb grammar

Today (`list`-only slice):

| Verb | Form | What |
|---|---|---|
| `list` | `bun tools/ace/ace.ts list [--store <path>] [--json]` | List installed packages from `~/.ace/store` |
| `help` | `bun tools/ace/ace.ts help` | Usage |

(Coming in slice 2: `install <url>` + `verify <hash>` — integrity-verified.)

## Invocation

```bash
bun tools/ace/ace.ts list --json
```

Exit codes: `0` ok · `64` usage error.

## Where the deep substrate lives (one Read away)

- Distribution + DX design: `docs/agendas/ace-package-manager/2026-06-01-ace-cli-distribution-dx-design.md`
- Agenda: `docs/agendas/ace-package-manager/AGENDA.md`
- The bus↔Ace one-substrate synthesis: PR #6284 (G-Set ⊂ bag ⊂ Z-set; shared 081KSXN940008QG0R0033T2BQT fold engine)
````

- [ ] **Step 2: Verify the skill is well-formed (frontmatter + markdownlint)**

Run: `bunx --bun markdownlint-cli2 .claude/skills/ace/SKILL.md`
Expected: exit 0 (clean). Confirm the frontmatter has `name:` + `description:` (the router-match field).

- [ ] **Step 3: Smoke the documented invocation**

Run: `bun tools/ace/ace.ts list --json`
Expected: `[]` (empty store) or a JSON array; exit 0. Confirms the SKILL.md's documented command is accurate.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/ace/SKILL.md
git commit -m "feat(ace): .claude/skills/ace — agent surface over the list-only CLI (router-discovered)"
```

---

# SLICE 2 — install + verify (integrity)

> Integrity (content-hash) only. Authenticity (signatures) is slice 3 (out of scope). `install` prints an explicit "integrity-verified, NOT authenticity-verified" line so it is not a false-green.

## Task 5: `contentHash()` in store.ts

**Files:**

- Modify: `tools/ace/store.ts`
- Create: `tools/ace/store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tools/ace/store.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { contentHash } from "./store.ts";

describe("contentHash", () => {
  test("sha256 of known bytes matches the sha256:<hex> form", () => {
    // sha256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    const h = contentHash(new TextEncoder().encode("hello"));
    expect(h).toBe("sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  test("empty input has the known empty-sha256", () => {
    const h = contentHash(new Uint8Array(0));
    expect(h).toBe("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test tools/ace/store.test.ts`
Expected: FAIL — `contentHash` is not exported from `./store.ts`.

- [ ] **Step 3: Implement `contentHash`**

In `tools/ace/store.ts`, add this import at the top (next to the existing `node:fs` import):

```typescript
import { createHash } from "node:crypto";
```

And add the exported function (after `defaultStorePath`):

```typescript
/** Content hash of raw bytes, in the `sha256:<hex>` form Ace manifests use. */
export function contentHash(bytes: Uint8Array): string {
  return "sha256:" + createHash("sha256").update(bytes).digest("hex");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test tools/ace/store.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/ace/store.ts tools/ace/store.test.ts
git commit -m "feat(ace): contentHash(bytes) -> sha256:<hex> (store.ts) + unit tests"
```

## Task 6: `installPackage()` — verify-before-extract

**Files:**

- Modify: `tools/ace/store.ts`, `tools/ace/store.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tools/ace/store.test.ts`:

```typescript
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installPackage } from "./store.ts";

describe("installPackage", () => {
  // A package is a JSON file: { manifest: AceManifest, files: {relpath: contents} }.
  // content_hash is the sha256 of the canonical JSON of `files`.
  function makePkg(files: Record<string, string>, name = "demo") {
    const filesJson = JSON.stringify(files);
    const content_hash =
      "sha256:" +
      require("node:crypto").createHash("sha256").update(new TextEncoder().encode(filesJson)).digest("hex");
    return {
      pkg: { manifest: { format_version: 1, name, version: "1.0.0", content_hash }, files },
      content_hash,
    };
  }

  test("installs a package whose content_hash matches, extracting files under <store>/<hash>", () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkg, content_hash } = makePkg({ "readme.txt": "hi" });
    const result = installPackage(store, pkg);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const dir = join(store, content_hash.replace(":", "-"));
      expect(existsSync(join(dir, "manifest.json"))).toBe(true);
      expect(readFileSync(join(dir, "readme.txt"), "utf8")).toBe("hi");
    }
  });

  test("rejects a package whose content_hash does NOT match the files (no extraction)", () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkg } = makePkg({ "a.txt": "x" });
    const tampered = { ...pkg, files: { "a.txt": "TAMPERED" } }; // hash no longer matches
    const result = installPackage(store, tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("content hash mismatch");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test tools/ace/store.test.ts`
Expected: FAIL — `installPackage` is not exported.

- [ ] **Step 3: Implement `installPackage`**

In `tools/ace/store.ts`, add to the imports:

```typescript
import { mkdirSync, writeFileSync } from "node:fs";
```

Add the package type + function:

```typescript
export interface AcePackage {
  readonly manifest: AceManifest;
  readonly files: Readonly<Record<string, string>>;
}

export type InstallResult = { ok: true; dir: string } | { ok: false; error: string };

/**
 * Verify-before-extract: recompute the content hash of `pkg.files` and refuse to
 * extract unless it matches `pkg.manifest.content_hash` (integrity). Extracts to
 * `<storePath>/<hash-with-':'-as-'-'>/` with a `manifest.json`. INTEGRITY ONLY —
 * authenticity (signatures) is a separate concern (slice 3).
 */
export function installPackage(storePath: string, pkg: AcePackage): InstallResult {
  const filesJson = JSON.stringify(pkg.files);
  const actual = contentHash(new TextEncoder().encode(filesJson));
  if (actual !== pkg.manifest.content_hash) {
    return { ok: false, error: `content hash mismatch: manifest says ${pkg.manifest.content_hash}, computed ${actual}` };
  }
  const dir = join(storePath, pkg.manifest.content_hash.replace(":", "-"));
  try {
    mkdirSync(dir, { recursive: true });
    for (const [rel, contents] of Object.entries(pkg.files)) {
      // Guard against path traversal: reject any '..' or absolute path component.
      if (rel.includes("..") || rel.startsWith("/") || rel.startsWith("\\")) {
        return { ok: false, error: `unsafe file path in package: ${rel}` };
      }
      const dest = join(dir, rel);
      mkdirSync(join(dest, ".."), { recursive: true });
      writeFileSync(dest, contents);
    }
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(pkg.manifest, null, 2));
    return { ok: true, dir };
  } catch (e) {
    return { ok: false, error: `extract failed: ${(e as Error).message}` };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tools/ace/store.test.ts`
Expected: PASS (4 tests total).

- [ ] **Step 5: Add a path-traversal test to lock the guard**

Append to the `installPackage` describe block:

```typescript
  test("rejects a package with a path-traversal file path", () => {
    const store = mkdtempSync(join(tmpdir(), "ace-store-"));
    const { pkg } = makePkg({ "../escape.txt": "x" });
    const result = installPackage(store, pkg);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unsafe file path");
  });
```

Run: `bun test tools/ace/store.test.ts`
Expected: PASS (5 tests). Note the traversal package's hash matches its (traversal) files, so this asserts the guard fires AFTER the hash check.

- [ ] **Step 6: Commit**

```bash
git add tools/ace/store.ts tools/ace/store.test.ts
git commit -m "feat(ace): installPackage — verify-before-extract (content-hash integrity + path-traversal guard)"
```

## Task 7: wire `install <url>` + `verify <hash>` into the CLI

**Files:**

- Modify: `tools/ace/ace.ts`, `tools/ace/ace.test.ts`

- [ ] **Step 1: Write the failing parseArgs tests**

In `tools/ace/ace.test.ts`, replace the `"unimplemented commands return error"` test with:

```typescript
  test("install requires a url/path argument", () => {
    const result = parseArgs(["install"]);
    expect("error" in result).toBe(true);
  });

  test("install <url> parses", () => {
    const result = parseArgs(["install", "https://example.com/p.json"]);
    expect("error" in result).toBe(false);
    if (!("error" in result) && result.command === "install") {
      expect(result.source).toBe("https://example.com/p.json");
    }
  });

  test("verify requires a hash argument", () => {
    const result = parseArgs(["verify"]);
    expect("error" in result).toBe(true);
  });

  test("remove + inspect are still unimplemented", () => {
    for (const cmd of ["remove", "inspect"]) {
      expect("error" in parseArgs([cmd])).toBe(true);
    }
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tools/ace/ace.test.ts`
Expected: FAIL — `install`/`verify` still return the "not yet implemented" error.

- [ ] **Step 3: Implement the verbs in parseArgs + main**

In `tools/ace/ace.ts`, add to the type union + `parseArgs`:

```typescript
interface InstallArgs {
  readonly command: "install";
  readonly source: string;
  readonly storePath: string;
}
interface VerifyArgs {
  readonly command: "verify";
  readonly hash: string;
  readonly storePath: string;
}
type ParsedArgs = ListArgs | HelpArgs | InstallArgs | VerifyArgs;
```

In `parseArgs`, BEFORE the `const known = [...]` block, add:

```typescript
  if (command === "install") {
    const source = argv[1];
    if (!source || source.startsWith("-")) return { error: "install requires a <url-or-path> argument" };
    return { command: "install", source, storePath: defaultStorePath() };
  }

  if (command === "verify") {
    const hash = argv[1];
    if (!hash || hash.startsWith("-")) return { error: "verify requires a <hash> argument" };
    return { command: "verify", hash, storePath: defaultStorePath() };
  }
```

And narrow the still-unimplemented list:

```typescript
  const known = ["remove", "inspect"];
```

In `main`, add handlers before the final `return 1;`. Add the imports first:

```typescript
import { defaultStorePath, listInstalled, installPackage, type AcePackage } from "./store";
import { readFileSync } from "node:fs";
```

Then in `main`:

```typescript
  if (parsed.command === "install") {
    let raw: string;
    try {
      raw = parsed.source.startsWith("http")
        ? await (await fetch(parsed.source)).text()
        : readFileSync(parsed.source, "utf8");
    } catch (e) {
      console.error(`ace: download/read failed: ${(e as Error).message}`);
      return 1;
    }
    let pkg: AcePackage;
    try { pkg = JSON.parse(raw) as AcePackage; }
    catch { console.error("ace: package is not valid JSON"); return 65; }
    const result = installPackage(parsed.storePath, pkg);
    if (!result.ok) { console.error(`ace: install refused: ${result.error}`); return 1; }
    console.log(`ace: installed ${pkg.manifest.name}@${pkg.manifest.version} -> ${result.dir}`);
    console.log("ace: integrity-verified (content hash). NOT authenticity-verified (no signature check yet).");
    return 0;
  }

  if (parsed.command === "verify") {
    const pkgs = listInstalled(parsed.storePath);
    const found = pkgs.find((p) => p.hash === parsed.hash || p.manifest.content_hash === parsed.hash);
    if (!found) { console.error(`ace: no installed package with hash ${parsed.hash}`); return 1; }
    console.log(`ace: ${found.manifest.name}@${found.manifest.version} present (manifest hash ${found.manifest.content_hash})`);
    return 0;
  }
```

> Note: `main` now uses `await`, so change its signature to `export async function main(argv: readonly string[]): Promise<number>` and update the entry point to `if (import.meta.main) { main(process.argv.slice(2)).then((c) => process.exit(c)); }`. Update the existing `ace.test.ts` `main` tests to `await main([...])`.

- [ ] **Step 4: Update the existing main() tests to await**

In `tools/ace/ace.test.ts`, the `describe("main")` block calls `main([...])` synchronously. Change each to `await`, e.g.:

```typescript
  test("help returns 0", async () => {
    expect(await main(["help"])).toBe(0);
  });
```

Apply `async` + `await` to all five `main` tests.

- [ ] **Step 5: Update printUsage**

In `printUsage()`, move `install` + `verify` out of "Future commands" into the live `Usage:` block:

```
  ace install <url-or-path>             Download/read a package, verify integrity, install
  ace verify <hash>                     Confirm an installed package is present
```

Leave `remove` + `inspect` under "Future commands (not yet implemented)".

- [ ] **Step 6: Run the full ace suite**

Run: `bun test tools/ace/`
Expected: PASS (all `ace.test.ts` + `store.test.ts`).

- [ ] **Step 7: tsc check**

Run: `bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "tools/ace" || echo "no tsc errors in tools/ace"`
Expected: `no tsc errors in tools/ace`.

- [ ] **Step 8: Commit**

```bash
git add tools/ace/ace.ts tools/ace/ace.test.ts
git commit -m "feat(ace): install <url> (verify-before-extract integrity) + verify <hash> verbs"
```

## Task 8: mark install/verify live in the skill

**Files:**

- Modify: `.claude/skills/ace/SKILL.md`

- [ ] **Step 1: Move install/verify into the live verb table**

Update the verb-grammar table to add:

```
| `install` | `bun tools/ace/ace.ts install <url-or-path>` | Download/read a package, verify content-hash integrity, install to `~/.ace/store` |
| `verify` | `bun tools/ace/ace.ts verify <hash>` | Confirm an installed package is present |
```

And replace the "(Coming in slice 2…)" line with a note: "`install` verifies **integrity** (content hash). Authenticity (signatures) is not yet checked — slice 3."

- [ ] **Step 2: markdownlint**

Run: `bunx --bun markdownlint-cli2 .claude/skills/ace/SKILL.md`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/ace/SKILL.md
git commit -m "docs(ace): skill — install/verify now live (integrity-only; authenticity is slice 3)"
```

---

## Self-review (against the design spec)

- **Spec §2 channel A (skill)** → Task 4 + Task 8. ✓
- **Spec §2 channel B (install.sh-sibling, human)** → Tasks 1–3 (bin + `bun link` Unix + Windows). ✓ (standalone `bunx`/bootstrap explicitly deferred per §8.)
- **Spec §3 runtime (Node-floor portable)** → SKILL.md precondition (Task 4) names Node ≥22.5/bun + the Codex no-JS fallback; no bun-only API used. ✓
- **Spec §4 verb grammar (small)** → `list`/`help` (slice 1) + `install`/`verify` (slice 2); `remove`/`inspect` stay stubbed; no 081KSGS9H0008QG0R0031PBNGA meta-PM verbs. ✓
- **Spec §5 provenance** → Task 6 verify-before-extract (integrity) + explicit "NOT authenticity-verified" line (no green-by-skip); authenticity carved to slice 3. ✓ (honest partial — the spec wanted signature-verify; this plan ships integrity + names the gap loudly rather than faking it.)
- **Spec §6 one core** → all channels run the same `tools/ace/ace.ts`. ✓
- **Spec §7 abstract layer (bus↔Ace one substrate)** → out of scope (MVP non-goal); SKILL.md points at #6284. ✓
- **Decisions §8** → install.sh-sibling first (slice 1), skill-installer-only (no manifest-driving), Node-floor (resolved). ✓

**Type consistency:** `AcePackage`/`InstallResult`/`contentHash`/`installPackage` defined in Task 5–6 and consumed identically in Task 7; `ParsedArgs` union extended with `InstallArgs`/`VerifyArgs` used in `parseArgs` + `main`. ✓

**Open follow-ons (NOT this plan):** slice 3 = authenticity/signature verify + key management; standalone `bunx`/bare-machine bootstrap; the manifest-driving layer; the bus↔Ace shared-fold-engine refactor (#6284 / 081KSXN940008QG0R0033T2BQT, routes through product-team agreement).
