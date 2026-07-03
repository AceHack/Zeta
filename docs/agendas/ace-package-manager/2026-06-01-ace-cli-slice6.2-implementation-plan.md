# Ace CLI slice 6.2 — publish enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three deferred `ace registry publish` enhancements — per-package `url` override,
comma-separated multi-directory `--packages`, and explicit `--sequence` — per
`2026-06-01-ace-cli-slice6.2-publish-enhancements-design.md`.

**Architecture:** `buildIndexDoc` (pure, `registry-publish.ts`) changes its input shape to
carry an optional per-package url; `ace.ts` parse gains comma-split `--packages` + `--sequence`;
the `ace.ts` publish handler scans multiple dirs, reads+validates a top-level `url` per package
(skipping the filename guard when present), and threads the sequence override. ETag sidecar
dropped.

**Tech stack:** TypeScript on Bun. Tests `bun test tools/ace/`. Strict
`bun --bun tsc --noEmit -p tsconfig.json` (exactOptionalPropertyTypes + noUnusedLocals).
Markdownlint on `SKILL.md`. Harness: NO Edit tool — new files via Write, edits via
Python/bun patch-scripts with exact-occurrence asserts (rm before commit, never commit
`_patch_*`). LF only — verify CR=0 with Python `open(f,'rb').read().count(b'\r')` (Git-Bash
`grep $'\r'` is unreliable on this box). Canary `git ls-tree HEAD | wc -l` = 67 (no
added/removed tracked files; the plan + spec docs already exist or land via their own PR).
Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

**File-boundary task groups (sequential):** T1 = `registry-publish.ts` (+test); T2 = `ace.ts`
(parse + handler) + `ace.test.ts`; T3 = `SKILL.md`. T1 before T2 (T2's handler calls the new
`buildIndexDoc` shape).

---

## Task 1: `buildIndexDoc` per-entry `{ pkg, url? }` input

**Files:**

- Modify: `tools/ace/registry-publish.ts` (`buildIndexDoc`)
- Test: `tools/ace/registry-publish.test.ts`

Current `buildIndexDoc` takes `packages: AcePackage[]`, sorts by `(name, version)`, and per
package sets each entry's `url` to the joined base-url + name-version filename and its
`package_hash` to `packageHash(pkg)`. Change the input to
`ReadonlyArray<{ pkg: AcePackage; url?: string }>` and use `entry.url` when present.

- [ ] **Step 1: Update existing tests to the new input shape + add url tests (RED)**

In `tools/ace/registry-publish.test.ts`, every `buildIndexDoc({ packages: [X], ... })` call
becomes `buildIndexDoc({ packages: [{ pkg: X }], ... })` (wrap each `AcePackage` as `{ pkg }`).
Then add to the `describe("buildIndexDoc", ...)` block (reuse `pkg`/`kp`/`issuedAt`):

```ts
  test("per-package url override is used; absent falls back to base-url", () => {
    const a = pkg("alpha", "1.0.0");
    const b = pkg("beta", "1.0.0");
    const doc = buildIndexDoc({
      packages: [{ pkg: a, url: "https://cdn.example/alpha-v1.json" }, { pkg: b }],
      baseUrl: "https://pkgs", sequence: 1, issuedAt, privatePem: kp.privatePem,
    });
    expect("error" in doc).toBe(false);
    if ("error" in doc) return;
    expect(doc.packages.alpha!["1.0.0"]!.url).toBe("https://cdn.example/alpha-v1.json");
    expect(doc.packages.beta!["1.0.0"]!.url).toBe("https://pkgs/beta-1.0.0.json");
  });

  test("url override does not change package_hash", () => {
    const a = pkg("alpha", "1.0.0");
    const withUrl = buildIndexDoc({ packages: [{ pkg: a, url: "https://cdn/x.json" }], baseUrl: "https://pkgs", sequence: 1, issuedAt, privatePem: kp.privatePem });
    const without = buildIndexDoc({ packages: [{ pkg: a }], baseUrl: "https://pkgs", sequence: 1, issuedAt, privatePem: kp.privatePem });
    if ("error" in withUrl || "error" in without) throw new Error("unexpected");
    expect(withUrl.packages.alpha!["1.0.0"]!.package_hash).toBe(without.packages.alpha!["1.0.0"]!.package_hash);
  });
```

Run `bun test tools/ace/registry-publish.test.ts` → FAILS to compile/run (old call sites + new
shape mismatch).

- [ ] **Step 2: Change `buildIndexDoc` input shape (GREEN)**

Patch `buildIndexDoc` in `tools/ace/registry-publish.ts`:

```ts
export function buildIndexDoc(args: {
  packages: ReadonlyArray<{ pkg: AcePackage; url?: string }>; baseUrl: string; sequence: number; issuedAt: string; privatePem: string;
}): IndexDoc | { error: string } {
  const packages: Record<string, Record<string, RegistryEntry>> = Object.create(null);
  const sorted = [...args.packages].sort((a, b) =>
    a.pkg.manifest.name.localeCompare(b.pkg.manifest.name) || a.pkg.manifest.version.localeCompare(b.pkg.manifest.version));
  for (const entry of sorted) {
    const pkg = entry.pkg;
    const name = pkg.manifest.name;
    const version = pkg.manifest.version;
    const versions = packages[name] ?? (Object.create(null) as Record<string, RegistryEntry>);
    if (RESERVED_IDENTITY_KEYS.has(name) || RESERVED_IDENTITY_KEYS.has(version)) {
      return { error: `reserved package identity not allowed: ${name}@${version}` };
    }
    if (versions[version] !== undefined) return { error: `duplicate package ${name}@${version}` };
    const url = entry.url ?? joinUrl(args.baseUrl, `${name}-${version}.json`);
    versions[version] = { url, package_hash: packageHash(pkg) };
    packages[name] = versions;
  }
  const content: IndexSignableContent = { format_version: 1, sequence: args.sequence, issued_at: args.issuedAt, packages };
  const signature = signIndex(content, args.privatePem);
  return { ...content, signature };
}
```

(Module-level `RESERVED_IDENTITY_KEYS`, `nextSequence`, `joinUrl` unchanged.)

- [ ] **Step 3: Verify (GREEN)** — `bun test tools/ace/registry-publish.test.ts` all pass;
  `bun --bun tsc --noEmit -p tsconfig.json` exit 0. (ace.ts's existing call site will be
  red until T2 — that's expected; T1's own file + test must be green, but the full `tsc` may
  show ace.ts's old call site mismatch. Note it; T2 fixes it. If the controller wants a green
  tsc after T1, T1 may stub the ace.ts call site to the new shape minimally — but cleaner to
  do ace.ts fully in T2. Mark tsc "green except the ace.ts call site addressed in T2".)

- [ ] **Step 4: Commit** — `git add tools/ace/registry-publish.ts tools/ace/registry-publish.test.ts`

---

## Task 2: `ace.ts` parse (`--packages` comma-split + `--sequence`) + handler (multi-dir, url, sequence) + e2e

**Files:**

- Modify: `tools/ace/ace.ts` (RegistryArgs type, parse, publish handler, usage text)
- Test: `tools/ace/ace.test.ts`

Read first: `RegistryArgs` type (~line 110), the `registry publish` parse branch (~255-265),
the publish handler (~547-603), the slice-6.1 publish e2e block in `ace.test.ts`
(`describe("ace registry publish (slice 6.1)"` ~1356, helper `writeSignedPkg`).

- [ ] **Step 1: e2e tests for the three enhancements (RED)**

Add to the publish describe block in `tools/ace/ace.test.ts` (reuse `writeSignedPkg`,
`main`, `parseIndex`, `parseArgs`, `mkdtempSync`, `tmpdir`, `join`, `writeFileSync`,
`readFileSync`, `contentHash`, `signManifest`, `generateKeypair`, `tempHome`). Helper for a
url-bearing package written under an arbitrary basename:

```ts
  function writeUrlPkg(dir: string, file: string, name: string, version: string, url: unknown) {
    const files = { [`${name}.txt`]: "hi" };
    const ch = contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const kp = generateKeypair();
    const m = { format_version: 1, name, version, content_hash: ch };
    const pkg = { manifest: { ...m, signature: signManifest(m, kp.privatePem) }, files, url };
    writeFileSync(join(dir, file), JSON.stringify(pkg));
  }
```

Tests:

```ts
  test("per-package url override is honored; absent derives from base-url", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-url-"));
    writeUrlPkg(pkgDir, "leaf.json", "leaf", "1.0.0", "https://cdn/leaf-v1.json"); // NOT canonical basename
    writeSignedPkg(pkgDir, "other", "2.0.0");                                       // canonical, no url
    const keyPath = join(tempHome, "r-url.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "i-url.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(0);
    const doc = parseIndex(readFileSync(outPath, "utf8"));
    if ("error" in doc) throw new Error(doc.error);
    expect(doc.packages.leaf!["1.0.0"]!.url).toBe("https://cdn/leaf-v1.json");
    expect(doc.packages.other!["2.0.0"]!.url).toBe("https://pkgs/other-2.0.0.json");
  });

  test("non-canonical filename WITHOUT url is skipped; WITH url is indexed", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-fn-"));
    // bad: leaf.json, no url → filename guard skips it
    const files = { "leaf.txt": "hi" }; const ch = contentHash(new TextEncoder().encode(JSON.stringify(files)));
    const kp = generateKeypair(); const m = { format_version: 1, name: "leaf", version: "1.0.0", content_hash: ch };
    writeFileSync(join(pkgDir, "leaf.json"), JSON.stringify({ manifest: { ...m, signature: signManifest(m, kp.privatePem) }, files }));
    const keyPath = join(tempHome, "r-fn.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const out1 = join(tempHome, "i-fn1.json");
    const c1 = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", out1]);
    expect(c1).toBe(1); // no valid packages (leaf.json skipped by filename guard)
    // now add url → indexed
    writeUrlPkg(pkgDir, "leaf.json", "leaf", "1.0.0", "https://cdn/leaf.json");
    const out2 = join(tempHome, "i-fn2.json");
    const c2 = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", out2]);
    expect(c2).toBe(0);
    const doc = parseIndex(readFileSync(out2, "utf8"));
    if ("error" in doc) throw new Error(doc.error);
    expect(doc.packages.leaf!["1.0.0"]!.url).toBe("https://cdn/leaf.json");
  });

  test("invalid url (not an absolute URL) is skipped", async () => {
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-badurl-"));
    writeUrlPkg(pkgDir, "leaf-1.0.0.json", "leaf", "1.0.0", "leaf#x"); // not absolute
    const keyPath = join(tempHome, "r-bu.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "i-bu.json");
    const code = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(1); // only package skipped → no valid packages
  });

  test("comma-separated --packages indexes both dirs; cross-dir duplicate errors", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const dirA = mkdtempSync(join(tmpdir(), "ace-pub-a-"));
    const dirB = mkdtempSync(join(tmpdir(), "ace-pub-b-"));
    writeSignedPkg(dirA, "aa", "1.0.0");
    writeSignedPkg(dirB, "bb", "1.0.0");
    const keyPath = join(tempHome, "r-md.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "i-md.json");
    const code = await main(["registry", "publish", "--packages", `${dirA},${dirB}`, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(0);
    const doc = parseIndex(readFileSync(outPath, "utf8"));
    if ("error" in doc) throw new Error(doc.error);
    expect(doc.packages.aa).toBeDefined();
    expect(doc.packages.bb).toBeDefined();
    // cross-dir duplicate
    writeSignedPkg(dirB, "aa", "1.0.0");
    const out2 = join(tempHome, "i-md2.json");
    const dup = await main(["registry", "publish", "--packages", `${dirA},${dirB}`, "--base-url", "https://pkgs", "--key", keyPath, "--out", out2]);
    expect(dup).toBe(1);
  });

  test("unreadable listed dir is a hard error", async () => {
    const idxKp = generateKeypair();
    const dirA = mkdtempSync(join(tmpdir(), "ace-pub-ok-"));
    writeSignedPkg(dirA, "aa", "1.0.0");
    const keyPath = join(tempHome, "r-ud.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "i-ud.json");
    const code = await main(["registry", "publish", "--packages", `${dirA},/no/such/dir/xyz`, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath]);
    expect(code).toBe(1);
  });

  test("--sequence sets the sequence; rollback is refused; bad value is a parse error", async () => {
    const { parseIndex } = await import("./registry-remote.ts");
    const idxKp = generateKeypair();
    const pkgDir = mkdtempSync(join(tmpdir(), "ace-pub-seq-"));
    writeSignedPkg(pkgDir, "leaf", "1.0.0");
    const keyPath = join(tempHome, "r-seq.pem"); writeFileSync(keyPath, idxKp.privatePem);
    const outPath = join(tempHome, "i-seq.json");
    const c1 = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath, "--sequence", "5"]);
    expect(c1).toBe(0);
    const doc = parseIndex(readFileSync(outPath, "utf8"));
    if ("error" in doc) throw new Error(doc.error);
    expect(doc.sequence).toBe(5);
    // rollback against prev (5)
    const c2 = await main(["registry", "publish", "--packages", pkgDir, "--base-url", "https://pkgs", "--key", keyPath, "--out", outPath, "--sequence", "3"]);
    expect(c2).toBe(1);
    // bad values → parse error
    expect("error" in parseArgs(["registry", "publish", "--packages", "d", "--base-url", "https://x", "--key", "k", "--sequence", "0"])).toBe(true);
    expect("error" in parseArgs(["registry", "publish", "--packages", "d", "--base-url", "https://x", "--key", "k", "--sequence", "abc"])).toBe(true);
  });
```

Run `bun test tools/ace/ace.test.ts` → these FAIL on current code.

- [ ] **Step 2: Parse — `RegistryArgs.pubSequence` + `--sequence` + keep `--packages` raw (GREEN)**

In `tools/ace/ace.ts`: add `readonly pubSequence?: number;` to the `RegistryArgs` interface
(near `pubOut`). In the `registry publish` parse branch, add a `seq` local + a `--sequence`
arm; reject non-positive-integer:

```ts
        else if (argv[i] === "--sequence") {
          const sv = argv[++i];
          const n = Number(sv);
          if (!sv || !Number.isInteger(n) || n <= 0) return { error: "--sequence requires a positive integer" };
          seq = n;
        }
```

Declare `let seq: number | undefined;` alongside the existing `dir`/`base`/`key`/`out` locals.
Build the result carrying `pubSequence` when set:

```ts
      let r: RegistryArgs = { command: "registry", sub: "publish", pubPackagesDir: dir, pubBaseUrl: base, pubKeyPath: key };
      if (out !== undefined) r = { ...r, pubOut: out };
      if (seq !== undefined) r = { ...r, pubSequence: seq };
      return r;
```

(`pubPackagesDir` keeps the raw comma value; the handler splits. Do NOT assign `undefined` to
optional props — exactOptionalPropertyTypes. Use the spread-conditional form above.)

- [ ] **Step 3: Handler — multi-dir scan, url read+validate, filename-guard skip, sequence override (GREEN)**

In the publish handler:

- Split dirs (replace the single `readdirSync(parsed.pubPackagesDir!)`):

```ts
      const dirs = parsed.pubPackagesDir!.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      if (dirs.length === 0) { console.error("ace: publish refused: --packages requires at least one directory"); return 1; }
      const packages: { pkg: AcePackage; url?: string }[] = [];
      for (const d of dirs) {
        let entries: string[];
        try { entries = readdirSync(d).filter((f) => f.endsWith(".json")); }
        catch (e) { console.error(`ace: publish: cannot read dir ${d}: ${(e as Error).message}`); return 1; }
        for (const f of entries) {
          const full = join(d, f);
          // ... existing per-file scan body, with the two changes below ...
        }
      }
```

(The per-file scan body — JSON parse, shape guard, content_hash checks, deps/file-value/path
guards, URL-unsafe identity guard — is unchanged EXCEPT the two changes below. `full` uses `d`
not the old single dir.)

- Read + validate the optional `url`, and make the filename guard conditional. After the

content_hash-match check and before/around the filename guard:

```ts
          let urlOverride: string | undefined;
          const rawUrl = (obj as { url?: unknown }).url;
          if (rawUrl !== undefined) {
            if (typeof rawUrl !== "string" || rawUrl.length === 0) { console.error(`ace: publish: skip ${f} — url must be a non-empty string`); continue; }
            try { new URL(rawUrl); } catch { console.error(`ace: publish: skip ${f} — url is not an absolute URL: ${rawUrl}`); continue; }
            urlOverride = rawUrl;
          }
          // filename guard applies ONLY when there is no url override
          if (urlOverride === undefined) {
            const expectedFile = `${(obj as AcePackage).manifest.name}-${(obj as AcePackage).manifest.version}.json`;
            if (f !== expectedFile) { console.error(`ace: publish: skip ${f} — filename must be ${expectedFile} to match its derived consumer URL`); continue; }
          }
```

(Remove the old unconditional filename-guard block; the URL-unsafe-identity, deps, file-value,
and `validatePackagePaths` guards stay, applied to both cases.)

- Push the entry:

```ts
          packages.push(urlOverride !== undefined ? { pkg: obj as AcePackage, url: urlOverride } : { pkg: obj as AcePackage });
```

- Generalize the empty + sequence:

```ts
      if (packages.length === 0) { console.error(`ace: publish refused: no valid packages in ${dirs.join(", ")}`); return 1; }
      // ... outPath + prev read (unchanged) ...
      const seq = parsed.pubSequence ?? nextSequence(prev);
      if (prev && seq <= prev.sequence) { console.error(`ace: publish refused: sequence ${seq} <= prev ${prev.sequence}`); return 1; }
```

- `buildIndexDoc({ packages, baseUrl: parsed.pubBaseUrl!, sequence: seq, ... })` — `packages`
   is now `{ pkg, url? }[]`, matching the T1 signature.

- [ ] **Step 4: Usage text** — update the `registry publish` usage line to
  `--packages <dir>[,<dir>...] ... [--sequence <n>]`.

- [ ] **Step 5: Verify (GREEN)** — `bun test tools/ace/` all pass; `bun --bun tsc --noEmit -p tsconfig.json`
  exit 0; Python CR=0 on `ace.ts` + `ace.test.ts`; canary 67; no `_patch_*`.

- [ ] **Step 6: Commit** — `git add tools/ace/ace.ts tools/ace/ace.test.ts`

---

## Task 3: `SKILL.md` — document the three enhancements

**Files:**

- Modify: `.claude/skills/ace/SKILL.md` (publish section)

- [ ] **Step 1: Document** — in the `ace registry publish` section, add: the optional
  top-level `url` field (publish-only; sibling of manifest/files; outside the signed manifest;
  overrides the derived URL; excluded from `package_hash`; relaxes the `<name>-<version>.json`
  filename requirement for that package; must be an absolute URL); comma-separated
  `--packages a,b,c` (scan + merge multiple dirs); and `--sequence <n>` (explicit positive
  integer, anti-rollback-gated). Keep the existing slice-6.1 content.

- [ ] **Step 2: Verify** — `bunx markdownlint-cli2 .claude/skills/ace/SKILL.md` exit 0;
  Python CR=0; canary 67.

- [ ] **Step 3: Commit** — `git add .claude/skills/ace/SKILL.md`

---

## Final holistic review

After T1-T3, dispatch a final reviewer over `git diff origin/main..HEAD -- tools/ace/
.claude/skills/ace/SKILL.md` checking: buildIndexDoc shape change is consistent at all call
sites; url override correctly bypasses the filename guard but NOT the other guards;
package_hash excludes the url; sequence override is anti-rollback-gated; multi-dir per-dir
error handling; `bun test tools/ace/` + strict tsc + markdownlint all green; CR=0; canary 67.
Then the controller opens the impl PR + runs the PR-gate loop.
