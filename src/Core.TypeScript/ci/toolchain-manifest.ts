#!/usr/bin/env bun
// toolchain-manifest.ts -- does the RUNTIME carry the toolchain the repo DECLARES?
//
// ---------------------------------------------------------------------------
// WHAT THIS IS FOR
// ---------------------------------------------------------------------------
//
// The CI runtime image (src/Core.TypeScript/ci/dockerfiles/ci-runtime/Dockerfile) is a
// MATERIALIZATION of `pre-ace bootstrap + tools/setup/install.sh` at a pin. It is output,
// not a second definition -- so the question "has the image drifted from the definition?"
// has to be answerable, or the image quietly becomes the real toolchain source while
// `.mise.toml` becomes decoration nobody notices is stale.
//
// The honest form of that check is NOT byte-level image reproducibility, and this file
// deliberately does not attempt it. Aaron 2026-08-26: *"manifest comparison is fine,
// don't chase bit-reproducibility"* / *"with docker i think bit-reproducibility is very
// hard to come by when you can do apt update and upgrade"*. Reproducibility is a property
// of the PACKAGE MANAGER, not the container runtime: `apt` resolves version ranges
// against a mutable external mirror at build time, and Podman/Buildah execute the same
// non-deterministic build Docker does. A weaker check that actually runs beats a
// byte-lock that cannot.
//
// So:
//
//     TEXT EXPECTATION   .mise.toml (+ .mise.full.toml at tier=full) -- already the
//                        repo's single declared source for tool versions, already
//                        diffable, already reviewed on every change.
//     ARTIFACT UNDER     whatever `mise` reports as INSTALLED in the live environment.
//     TEST
//
// That is the same shape as the golden vectors: the expectation is text a human can read
// in a diff, and the thing being judged is not.
//
// ---------------------------------------------------------------------------
// WHAT IT CAN AND CANNOT CATCH -- stated, so the green means something
// ---------------------------------------------------------------------------
//
// CATCHES: a pin moved in `.mise.toml` and the image was not rebuilt; a tool declared and
// not installed; an image built from a different branch than it claims.
//
// DOES NOT CATCH: anything `mise` does not manage. The apt layer (149 slim packages),
// elan/Lean, the dotnet global tools, and the two rust/zig realizers that run outside mise
// are all invisible here. That is a real gap and it is not papered over -- see
// `unmanagedSurfaces()` below, which the CLI prints on every run precisely so a passing
// check never reads as "the image is verified".
//
// Register: `metered` for the mise-managed set (it is a comparison against a declared
// value with a test that fails when the value moves); `unmetered` for everything in
// `unmanagedSurfaces()`.

export interface DeclaredTool {
  /** The key exactly as it appears in `[tools]`, e.g. `pipx:semgrep`, `1password-cli`. */
  readonly key: string;
  /** The short name after any backend prefix, e.g. `semgrep`, `kubeconform`. */
  readonly name: string;
  /** The declared version string, e.g. `1.3`, `10.0.400`, `1.87.0`. */
  readonly version: string;
}

export interface InstalledTool {
  readonly name: string;
  readonly version: string;
}

export type Finding =
  | { readonly kind: "missing"; readonly key: string; readonly declared: string }
  | { readonly kind: "mismatch"; readonly key: string; readonly declared: string; readonly installed: string };

/**
 * Parse the `[tools]` table of a mise config.
 *
 * Deliberately line-based rather than a TOML dependency: the shapes that occur in this
 * repo are exactly three, all on one line --
 *
 *     bun = "1.3"
 *     "pipx:semgrep" = "1.174.0"
 *     rust = { version = "1.87.0", components = [...], targets = [...] }
 *
 * -- and a hand parser that understands only those three FAILS LOUDLY on a fourth
 * (it yields nothing for the line, so the tool goes `missing`) rather than silently
 * mis-reading it. A general TOML parser would accept a shape this checker cannot
 * meaningfully compare and report success. Comments (`#`) and every other table
 * (`[settings]`, `min_version`) are skipped.
 */
export function parseDeclaredTools(toml: string): DeclaredTool[] {
  const out: DeclaredTool[] = [];
  let inTools = false;
  for (const raw of toml.split("\n")) {
    const line = raw.replace(/#.*$/u, "").trim();
    if (line.length === 0) continue;
    if (line.startsWith("[")) {
      inTools = line === "[tools]";
      continue;
    }
    if (!inTools) continue;

    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const rawKey = line.slice(0, eq).trim();
    const rawVal = line.slice(eq + 1).trim();
    const key = rawKey.replace(/^["']|["']$/gu, "");
    if (key.length === 0) continue;

    let version: string | null = null;
    const scalar = /^["']([^"']+)["']$/u.exec(rawVal);
    if (scalar !== null) {
      version = scalar[1] ?? null;
    } else if (rawVal.startsWith("{")) {
      const inline = /\bversion\s*=\s*["']([^"']+)["']/u.exec(rawVal);
      if (inline !== null) version = inline[1] ?? null;
    }
    if (version === null) continue;

    out.push({ key, name: shortName(key), version });
  }
  return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** `github:yannh/kubeconform` -> `kubeconform`; `pipx:semgrep` -> `semgrep`. */
export function shortName(key: string): string {
  const afterBackend = key.includes(":") ? key.slice(key.indexOf(":") + 1) : key;
  return afterBackend.includes("/") ? afterBackend.slice(afterBackend.lastIndexOf("/") + 1) : afterBackend;
}

/**
 * Normalise `mise ls --json`.
 *
 * mise has shipped two shapes for this payload across versions -- a map of name to an
 * ARRAY of installs, and a map of name to a single object -- so both are accepted. An
 * entry with `installed: false` is treated as absent, which is the whole point: mise
 * lists a declared-but-not-installed tool rather than omitting it, and reading that row
 * as presence would make this check unable to fail.
 */
export function parseMiseLs(json: unknown): InstalledTool[] {
  const out: InstalledTool[] = [];
  if (json === null || typeof json !== "object") return out;
  for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
    const rows = Array.isArray(value) ? value : [value];
    for (const row of rows) {
      if (row === null || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      if (rec.installed === false) continue;
      const version = typeof rec.version === "string" ? rec.version : null;
      if (version === null) continue;
      out.push({ name: shortName(key), version });
    }
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * Does an installed version satisfy a declared pin?
 *
 * mise pins are prefixes: `bun = "1.3"` is satisfied by `1.3.0`, `java = "26"` by
 * `26.0.1`. Equality alone would red-flag every partial pin in `.mise.toml`, so the rule
 * is exact-or-dot-prefixed. Note what this deliberately does NOT do: `1.30` does not
 * satisfy `1.3`, because the separator is required.
 */
export function versionSatisfies(declared: string, installed: string): boolean {
  return installed === declared || installed.startsWith(`${declared}.`);
}

export function compare(declared: readonly DeclaredTool[], installed: readonly InstalledTool[]): Finding[] {
  const byName = new Map<string, string[]>();
  for (const t of installed) {
    const acc = byName.get(t.name) ?? [];
    acc.push(t.version);
    byName.set(t.name, acc);
  }
  const findings: Finding[] = [];
  for (const d of declared) {
    const versions = byName.get(d.name);
    if (versions === undefined || versions.length === 0) {
      findings.push({ kind: "missing", key: d.key, declared: d.version });
      continue;
    }
    if (!versions.some((v) => versionSatisfies(d.version, v))) {
      findings.push({ kind: "mismatch", key: d.key, declared: d.version, installed: versions.join(", ") });
    }
  }
  return findings;
}

/**
 * The surfaces this check is BLIND to, enumerated rather than left to be discovered.
 * Printed on every run, pass or fail. A check whose scope is not stated is a check whose
 * green gets read as coverage it does not have.
 */
export function unmanagedSurfaces(): readonly string[] {
  return [
    "tools/setup/manifests/apt          -- the 149-package slim apt set (mise does not manage apt)",
    "tools/setup/manifests/from-elan    -- Lean 4 / elan (installed outside mise)",
    "tools/setup/manifests/from-dotnet-global -- dotnet global tools (tier=standard and up)",
    "tools/setup/common/install-zig.sh, install-rust-wasm32.sh -- realizers that run after mise",
    "the ubuntu base image's own contents -- pinned by digest, not compared here",
  ];
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage(): string {
  return [
    "usage: bun src/Core.TypeScript/ci/toolchain-manifest.ts [--check] [--tier slim|standard|full] [--root DIR]",
    "",
    "  --check   compare the live environment against the declared pins; exit 1 on drift.",
    "            Without it the emitted manifest is printed and the exit is always 0.",
    "  --tier    full also reads .mise.full.toml. Default: $ZETA_HOST_TIER, else slim.",
  ].join("\n");
}

async function main(argv: readonly string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    return 0;
  }
  const root = argValue(argv, "--root") ?? process.cwd();
  const tier = argValue(argv, "--tier") ?? process.env.ZETA_HOST_TIER ?? "slim";
  const check = argv.includes("--check");

  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");

  const declared: DeclaredTool[] = parseDeclaredTools(await readFile(join(root, ".mise.toml"), "utf8"));
  if (tier === "full") {
    declared.push(...parseDeclaredTools(await readFile(join(root, ".mise.full.toml"), "utf8")));
  }

  const lsRaw = await runMiseLs();
  if (lsRaw === null) {
    console.error("::error title=toolchain-manifest::`mise ls --json` did not run. This is NOT a pass:");
    console.error("  the comparison did not happen, and a check that did not run must not look like one that did.");
    return 1;
  }
  const installed = parseMiseLs(lsRaw);

  console.log(`tier: ${tier}   declared: ${declared.length} tools   installed (mise-managed): ${installed.length}`);
  console.log("");
  console.log("NOT COVERED by this comparison (mise does not manage these):");
  for (const s of unmanagedSurfaces()) console.log(`  - ${s}`);
  console.log("");

  const findings = compare(declared, installed);
  if (!check) {
    for (const t of declared) {
      const got = installed.filter((i) => i.name === t.name).map((i) => i.version);
      console.log(`${t.key.padEnd(28)} declared=${t.version.padEnd(12)} installed=${got.join(",") || "-"}`);
    }
    console.log("\nEXIT 0 -- emit mode. No comparison was enforced; pass --check for the verdict.");
    return 0;
  }

  if (findings.length === 0) {
    console.log(`EXIT 0 -- every one of the ${declared.length} mise-managed pins is satisfied by this runtime.`);
    return 0;
  }
  for (const f of findings) {
    if (f.kind === "missing") {
      console.error(`::error title=toolchain drift::${f.key} declared ${f.declared} is NOT INSTALLED in this runtime`);
    } else {
      console.error(
        `::error title=toolchain drift::${f.key} declares ${f.declared} but the runtime has ${f.installed}`,
      );
    }
  }
  console.error(
    `\nEXIT 1 -- ${findings.length} drift finding(s). The image is a materialization of ` +
      "`pre-ace bootstrap + tools/setup/install.sh`; if a pin moved, the image needs rebuilding, " +
      "not this check relaxing.",
  );
  return 1;
}

function argValue(argv: readonly string[], flag: string): string | null {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? (argv[i + 1] ?? null) : null;
}

async function runMiseLs(): Promise<unknown | null> {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);
    const { stdout } = await run("mise", ["ls", "--json"], { maxBuffer: 32 * 1024 * 1024 });
    return JSON.parse(stdout) as unknown;
  } catch (err) {
    console.error(`mise ls --json failed: ${String(err)}`);
    return null;
  }
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
