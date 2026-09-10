#!/usr/bin/env bun
// audit-mise-lock-coverage.ts — the committed mise digests are OURS, and stay ours.
//
// THE DEFECT THIS CLOSES (081M24MADR2087G0R001FCD8K6, measured 2026-09-10).
// There was no `mise.lock` in the tree, so the `[2/3] checksum` step every `mise install`
// prints was verified against a checksum FETCHED FROM UPSTREAM AT INSTALL TIME. Across the
// ~24 tool pins in `.mise.toml` + `.mise.full.toml`, not one digest was one we owned. The
// day GitHub's attestation service returned 503 (`trust-metadata-api service unavailable`)
// both ARM lanes on `main` died on `kubeconform@0.7.0` — after the checksum step had
// already passed. Integrity was established; the install died on an AVAILABILITY check
// layered over it, because neither of the two trust sources was in this repository.
//
// `mise.lock` / `mise.full.lock` are now committed and this audit is what keeps them
// meaning something. Four things it refuses, each of which was measured to be possible:
//
//   1. A CONFIG PIN THAT MOVED WITHOUT A RE-LOCK. `zig = "0.13.0"` -> `"0.14.0"` with a
//      stale lockfile is a one-line diff that reads as housekeeping. Under `locked = true`
//      it breaks every install in the fleet; without this check it breaks them AFTER merge.
//   2. A TOOL THAT LOST ITS COVERAGE. A platform silently dropping out of the lockfile is
//      invisible in review — the file is 600 lines of generated TOML.
//   3. `locked = true` GOING MISSING from `.mise.toml`. Measured: with `locked = false`
//      (the default) mise still verifies digests it HAS, but silently ADDS a missing
//      platform entry from upstream and rewrites the lockfile in place. A lockfile that
//      repairs itself is not a lock — it is a cache that looks like one.
//   4. THE EXEMPTION ROSTER GROWING. Six backends emit no lockable artifact at all
//      (`core:dotnet`, `core:rust`, `npm:`, `pipx:`) and one emits a URL with no digest
//      (`vfox:1password-cli`). Under `locked = true` those PASS THROUGH — measured, not
//      assumed — so `locked = true` does NOT mean "everything is locked". They are named
//      below with reasons, and this audit fails BOTH ways: a roster tool that is not
//      declared, and a roster tool that has since become lockable and should be dropped
//      from the roster. The exemption set can shrink; it cannot grow without a diff here.
//
// WHAT IT DOES NOT DO: prove the digests are right. Only a real fetch can, and that is
// `.github/workflows/verify-mise-lock.yml` — a re-lock on the PINNED mise compared through
// `--relock-diff` below, plus a tampered-digest run that MUST be refused.
//
// Run:   bun src/Core.TypeScript/hygiene/audit-mise-lock-coverage.ts
//        bun src/Core.TypeScript/hygiene/audit-mise-lock-coverage.ts --relock-diff <a> <b>
// Exit:  0 — every declared tool is locked, or named on the roster with a reason
//        1 — drift, lost coverage, a missing `locked = true`, or a stale roster entry

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The installer that exports the install-time attestation settings the lockfile must agree with. */
export const MISE_SH_PATH = "tools/setup/common/mise.sh";

/** The three installers whose mise version decides whether locked mode is safe. */
export const LINUX_SH_PATH = "tools/setup/linux.sh";
export const MACOS_SH_PATH = "tools/setup/macos.sh";
export const INSTALL_PS1_PATH = "tools/setup/install.ps1";

/** The two config/lockfile pairs. `MISE_ENV=full` merges the second onto the first. */
export const PAIRS: readonly { readonly config: string; readonly lock: string }[] = [
  { config: ".mise.toml", lock: "mise.lock" },
  { config: ".mise.full.toml", lock: "mise.full.lock" },
];

/**
 * The platforms a host in this fleet actually runs on, and therefore the ones a locked
 * tool must carry a digest for. Derived from the runner labels in `.github/workflows/`
 * plus the container images under `src/Core.TypeScript/ci/dockerfiles/`:
 *
 *   ubuntu-24.04 / ubuntu-22.04 / ubuntu-slim / the ubuntu+nixos images -> linux-x64
 *   ubuntu-24.04-arm                                                    -> linux-arm64
 *   macos-26 / macos-15 (and every dev laptop)                          -> macos-arm64
 *   macos-13-class x86 hosts                                            -> macos-x64
 *   windows-2025 / the servercore image                                 -> windows-x64
 *   windows-11-arm                                                      -> windows-arm64
 *
 * The `-musl` variants are locked too where upstream publishes them, but are NOT required:
 * measured 2026-09-10, no runner, container image or cluster node in this repo is musl
 * (every image is glibc — `ubuntu:24.04`, `ubuntu:22.04`, `nixos/nix`, `servercore`). A
 * required platform nothing runs would be a check that can only ever fail for a reason
 * nobody can act on.
 */
export const REQUIRED_PLATFORMS: readonly string[] = [
  "linux-x64",
  "linux-arm64",
  "macos-x64",
  "macos-arm64",
  "windows-x64",
  "windows-arm64",
];

/**
 * Tools whose mise backend produces NOTHING a lockfile can hold, with the reason each.
 *
 * This is not a suppression list. Every entry was measured on 2026-09-10 by running
 * `mise lock` and reading what it emitted, and each one is separately covered — or
 * separately NOT covered, said out loud — somewhere else:
 *
 *   dotnet   `core:dotnet` shells out to Microsoft's `dotnet-install` script, which
 *            resolves and verifies its own payload. mise never sees a URL to lock.
 *   rust     `core:rust` drives rustup. The rustup INSTALLER is digest-pinned by us
 *            (`tools/setup/rustup-pin.json`, verify-rustup-pin.yml); the toolchain it
 *            then fetches is verified by rustup's own signed channel manifests.
 *   npm:*    installs through npm's own resolver. `package.json` + `bun.lock` is that
 *            ecosystem's lock, and mise 2026.6.12+ additionally enforces aube's
 *            publisher-trust policy on the tree (the `fastq@1.20.2` note in `.mise.toml`).
 *   pipx:*   routed through `uv tool install` against PyPI. No single artifact URL exists
 *            to pin — the install is a resolved dependency set, not a download.
 *
 * HONEST STATEMENT OF WHAT THAT COSTS: for these seven tools the digest is still not ours.
 * `locked = true` does not fail closed on them — measured, `mise install` proceeds and
 * installs them unlocked — so the guarantee this file's header claims is a guarantee about
 * the OTHER fourteen. Closing these is separate work per ecosystem, not a mise setting.
 */
export const UNLOCKABLE_BACKENDS: Readonly<Record<string, string>> = {
  dotnet: "core:dotnet delegates to Microsoft's dotnet-install script; mise sees no artifact URL",
  rust: "core:rust drives rustup; the rustup INSTALLER is digest-pinned by tools/setup/rustup-pin.json",
  "npm:markdownlint-cli2": "npm resolver; package.json + bun.lock is that ecosystem's lock",
  "pipx:semgrep": "uv tool install against PyPI; a resolved dependency set, not one artifact",
  "pipx:yamllint": "uv tool install against PyPI; a resolved dependency set, not one artifact",
  "pipx:ruff": "uv tool install against PyPI; a resolved dependency set, not one artifact",
  "pipx:mypy": "uv tool install against PyPI; a resolved dependency set, not one artifact",
};

/**
 * Tools mise DOES lock a URL for but cannot attach a digest to, and single platforms a
 * vendor does not publish. Narrower than the roster above: the lockfile row exists and is
 * checked for drift; only the `checksum` is absent.
 *
 * `1password-cli` — the `vfox:` backend records the download URL and no checksum. So the
 * URL is ours and the bytes are not; that is strictly better than nothing and strictly
 * worse than a digest, and saying which is the point of listing it here.
 *
 * `java` on `windows-arm64` — no vendor ships it. Measured against the vendor APIs
 * 2026-09-09 and recorded independently in `tools/setup/install.ps1`: Adoptium publishes
 * 21 for windows/aarch64 and not 25 or 26; Azul publishes 25 and not 26. install.ps1
 * therefore excludes `java` from the Windows-ARM64 spec list and installs `java@zulu-25`
 * as a best-effort fallback outside the declared graph. Two independent measurements of
 * the same absence, which is why this exemption is a fact and not a shrug.
 *
 * `1password-cli` on `windows-arm64` — likewise absent upstream, and likewise already
 * excluded by install.ps1's `$unsupported` map.
 */
export const PARTIAL_COVERAGE: Readonly<Record<string, string>> = {
  "1password-cli": "vfox backend records the URL and no checksum; upstream publishes no windows-arm64 archive",
  java: "no vendor publishes a Java 26 build for windows-arm64 (install.ps1 measured Adoptium + Azul, 2026-09-09)",
};

export interface Finding {
  readonly ok: boolean;
  readonly message: string;
}

export interface LockedTool {
  readonly versions: string[];
  /** platform -> true when that platform row carries a `checksum`. */
  readonly platforms: Record<string, boolean>;
}

/**
 * The `[tools]` table of a `.mise.toml`, as `name -> version spec`.
 *
 * Deliberately a line parser and not a TOML library: this must run with no dependency on
 * the very toolchain it is auditing, on a machine where `mise install` has not run yet.
 * Both spellings mise accepts are handled — `zig = "0.13.0"` and the inline table
 * `rust = { version = "1.99.0-beta.3", components = [...] }` — because a parser that
 * silently skipped the inline-table form would report FULL coverage for a tool it never
 * looked at, which is the vacuity class wearing a green tick.
 */
export function parseConfigTools(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let inTools = false;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("[")) {
      inTools = line === "[tools]";
      continue;
    }
    if (!inTools || line === "" || line.startsWith("#")) continue;
    const m = /^("[^"]+"|[A-Za-z0-9_.:@/-]+)\s*=\s*(.+)$/.exec(line);
    const rawName = m?.[1];
    const rawRhs = m?.[2];
    if (rawName === undefined || rawRhs === undefined) continue;
    const name = rawName.replace(/^"|"$/g, "");
    const rhs = rawRhs.trim();
    if (rhs.startsWith("{")) {
      const v = /version\s*=\s*"([^"]+)"/.exec(rhs)?.[1];
      if (v !== undefined) out[name] = v;
      continue;
    }
    const s = /^"([^"]*)"/.exec(rhs)?.[1];
    if (s !== undefined) out[name] = s;
  }
  return out;
}

/** A `mise.lock` body, as `name -> { versions, platforms }`. */
export function parseLock(body: string): Record<string, LockedTool> {
  const out: Record<string, LockedTool> = {};
  let current: LockedTool | null = null;
  let platform: string | null = null;
  const entryFor = (rawName: string): LockedTool => {
    const name = rawName.replace(/^"|"$/g, "");
    const existing = out[name];
    if (existing !== undefined) return existing;
    const fresh: LockedTool = { versions: [], platforms: {} };
    out[name] = fresh;
    return fresh;
  };
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    const toolName = /^\[\[tools\.("[^"]+"|[^\]]+)\]\]$/.exec(line)?.[1];
    if (toolName !== undefined) {
      current = entryFor(toolName);
      platform = null;
      continue;
    }
    const platMatch = /^\[tools\.("[^"]+"|[^.\]]+)\."platforms\.([^"]+)"\]$/.exec(line);
    const platTool = platMatch?.[1];
    const platName = platMatch?.[2];
    if (platTool !== undefined && platName !== undefined) {
      current = entryFor(platTool);
      platform = platName;
      current.platforms[platName] = false;
      continue;
    }
    if (line.startsWith("[")) {
      // `[tools.rust.options]` and anything else: still inside the tool, no longer a platform.
      platform = null;
      continue;
    }
    if (current === null) continue;
    if (platform === null) {
      const v = /^version\s*=\s*"([^"]+)"$/.exec(line)?.[1];
      if (v !== undefined) current.versions.push(v);
    } else if (/^checksum\s*=\s*"/.test(line)) {
      current.platforms[platform] = true;
    }
  }
  return out;
}

/**
 * Does `locked` resolve a `spec` from the config?
 *
 * Exact pins must be byte-equal. Fuzzy pins (`node = "24"`, `bun = "1.3"`, `java = "26"`)
 * are satisfied by any version that extends them at a dot boundary, which is exactly what
 * `mise lock` writes when it resolves them. `24` must NOT accept `240.1` — hence the
 * boundary rather than a bare `startsWith`.
 */
export function versionSatisfies(spec: string, locked: string): boolean {
  if (spec === locked) return true;
  return locked.startsWith(`${spec}.`);
}

/**
 * `locked = true` is SAFE ONLY WHEN EVERY INSTALLER PINS THE SAME mise VERSION, and today
 * they do not. This function is the measurement, kept where the decision is made.
 *
 * WHAT WAS MEASURED, 2026-09-10, on this repository's own lockfiles and configs:
 *
 *   lockfile generated by | mise 2026.6.12 resolves | mise 2026.8.14 resolves
 *   ----------------------|------------------------|------------------------
 *   2026.6.12             | all 25 tools           | FAILS: node@24, npm:markdownlint-cli2
 *   2026.8.14             | FAILS: node@24, npm:…  | all 25 tools
 *
 * `mise install` then refuses with "<tool> is not in the lockfile" and installs nothing. The
 * mechanism is a lockfile field: 2026.8.14 writes and matches `specifiers = ["24"]`, and
 * 2026.6.12 does not write it and matches by version prefix. Neither can read the other's
 * answer for a FUZZY pin (`node = "24"`, `bun = "1.3"`, `java = "26"`) or an `npm:` entry.
 * Exact pins are unaffected, which is why a two-tool smoke test of cross-version
 * compatibility passed and hid this.
 *
 * SO THERE IS NO LOCKFILE THAT SATISFIES BOTH, and the fleet runs both:
 *
 *   tools/setup/linux.sh   MISE_PIN_VERSION="2026.6.12"   exact pin
 *   tools/setup/install.ps1 $MisePinVersion = '2026.6.12'  exact pin
 *   tools/setup/macos.sh   MISE_MIN_VERSION="2026.6.12"   a FLOOR — "macOS installs mise via
 *                                                         Homebrew, whose formula advances in
 *                                                         place; accept newer versions"
 *
 * That divergence is pre-existing, deliberate and documented in `macos.sh` and `install.ps1`.
 * `locked = true` would convert it from a documented difference into a fleet-wide install
 * failure on whichever platform did not generate the file — measured on real installs, not
 * inferred. So the lockfile ships WITHOUT locked mode, and the digests are still enforced:
 * a checksum that does not match the bytes refuses on BOTH versions with `locked = false`.
 *
 * THE COST, stated so nobody has to rediscover it: unlocked, a platform row that is MISSING
 * is silently filled from upstream and the lockfile is rewritten in place. Coverage loss is
 * therefore caught by this audit and by verify-mise-lock.yml rather than by the install
 * failing closed. That is a weaker guarantee and it is the one this repo can honestly make
 * today.
 *
 * THIS CHECK IS BIDIRECTIONAL, so it does not become a permanent excuse: once every
 * installer pins the SAME exact version, it REQUIRES `locked = true` and fails if it is
 * missing. Converging the mise versions is the work that unlocks locked mode.
 */
export function checkLockedModeSafety(
  miseToml: string,
  linuxSh: string,
  macosSh: string,
  installPs1: string,
): Finding[] {
  const settings = miseToml.split(/^\[settings\]$/m)[1] ?? "";
  const lockedDeclared = /^\s*locked\s*=\s*true\s*$/m.test(settings);

  const linuxPin = /^MISE_PIN_VERSION="([^"]+)"/m.exec(linuxSh)?.[1];
  const windowsPin = /^\$MisePinVersion\s*=\s*'([^']+)'/m.exec(installPs1)?.[1];
  const macosExactPin = /^MISE_PIN_VERSION="([^"]+)"/m.exec(macosSh)?.[1];
  const macosFloor = /^MISE_MIN_VERSION="([^"]+)"/m.exec(macosSh)?.[1];

  const pins = [linuxPin, windowsPin, macosExactPin];
  const allPinned = pins.every((v) => v !== undefined) && new Set(pins).size === 1;

  if (!allPinned) {
    const detail =
      `linux.sh=${linuxPin ?? "unset"}, install.ps1=${windowsPin ?? "unset"}, ` +
      `macos.sh=${macosExactPin ?? `no exact pin (floor ${macosFloor ?? "unset"})`}`;
    return lockedDeclared
      ? [
          {
            ok: false,
            message:
              "`.mise.toml` declares `locked = true` while the installers do NOT all pin the same " +
              `mise version (${detail}). Measured 2026-09-10: a lockfile written by 2026.6.12 ` +
              "cannot resolve `node@24` or an `npm:` entry under 2026.8.14 and vice versa, so " +
              "locked mode turns that divergence into a fleet-wide install failure. Converge the " +
              "installers first, then re-lock and re-enable.",
          },
        ]
      : [
          {
            ok: true,
            message:
              `locked mode correctly OFF — the installers do not all pin one mise version (${detail}); ` +
              "the committed digests are still enforced, a missing platform row is not",
          },
        ];
  }

  return lockedDeclared
    ? [
        {
          ok: true,
          message: `locked mode ON, and every installer pins mise ${String(linuxPin)} — the lockfile is authoritative`,
        },
      ]
    : [
        {
          ok: false,
          message:
            `every installer now pins mise ${String(linuxPin)}, so the version divergence that forced ` +
            "locked mode off is gone. Re-lock on that version and declare `locked = true` in " +
            "`.mise.toml` [settings] — without it a missing platform row is silently filled from " +
            "upstream and the lockfile rewrites itself, which is a cache, not a lock.",
        },
      ];
}

/**
 * A `provenance` row and the install-time verification setting for that tool must AGREE.
 *
 * MEASURED THE HARD WAY, 2026-09-10. The first version of this change locked with
 * `MISE_PYTHON_GITHUB_ATTESTATIONS=1` while `tools/setup/common/mise.sh` exports `0` at
 * install time, and every containerised `install.sh` lane died — correctly, and with the
 * right diagnosis, which is worth quoting because it is a better error than most:
 *
 *   core:python@3.14.6: Lockfile requires github-attestations provenance for
 *   core:python@3.14.6 but the corresponding verification setting is disabled. This may
 *   indicate a downgrade attack. Enable the setting or update the lockfile.
 *
 * mise will not honour an attestation record it has been told not to check, and it is right
 * not to: silently accepting it would let a lockfile assert a verification that never ran.
 * So the two halves are COUPLED, they live in two different files, and until this check
 * existed nothing held them together — the classic shape of a pin whose restatement drifts.
 *
 * The mapping is derived from `mise.sh`'s own export line, not restated here, so moving the
 * setting moves the check with it. Enabling python attestations and re-locking WITH
 * provenance is a legitimate follow-up (it would remove the live call for those platforms
 * entirely); what is refused is doing one of the two and not the other.
 */
export function checkProvenanceMatchesInstallSettings(miseShBody: string, lockBody: string): Finding[] {
  const disabled = /MISE_PYTHON_GITHUB_ATTESTATIONS="\$\{MISE_PYTHON_GITHUB_ATTESTATIONS:-0\}"/.test(miseShBody);
  const pythonAttested = [...provenanceKeys(lockBody)].filter((k) => k.startsWith("python/")).sort();
  if (!disabled) {
    return [
      {
        ok: true,
        message:
          "tools/setup/common/mise.sh no longer defaults MISE_PYTHON_GITHUB_ATTESTATIONS to 0 — " +
          "python provenance rows are permitted, and re-locking with them is the improvement to make",
      },
    ];
  }
  if (pythonAttested.length === 0) {
    return [
      {
        ok: true,
        message:
          "python carries no provenance row, matching mise.sh's install-time " +
          "MISE_PYTHON_GITHUB_ATTESTATIONS=0 (mise refuses a lockfile that attests what it is told not to check)",
      },
    ];
  }
  return [
    {
      ok: false,
      message:
        `the lockfile attests python on ${pythonAttested.length.toString()} platform(s) ` +
        `(${pythonAttested.join(", ")}) while tools/setup/common/mise.sh disables that check at install time. ` +
        'mise refuses this outright — "Lockfile requires github-attestations provenance ... but the ' +
        'corresponding verification setting is disabled. This may indicate a downgrade attack." — so every ' +
        "install.sh consumer fails closed. Re-lock with MISE_PYTHON_GITHUB_ATTESTATIONS=0, or change mise.sh " +
        "and re-lock with 1. Not one without the other.",
    },
  ];
}

export function checkPair(
  pairLabel: string,
  config: string,
  lock: string,
  requiredPlatforms: readonly string[] = REQUIRED_PLATFORMS,
): Finding[] {
  const out: Finding[] = [];
  const declared = parseConfigTools(config);
  const locked = parseLock(lock);

  if (Object.keys(declared).length === 0) {
    out.push({
      ok: false,
      message: `${pairLabel}: parsed ZERO tools from the config — the parser or the file is wrong`,
    });
    return out;
  }

  for (const [name, spec] of Object.entries(declared)) {
    const entry = locked[name];
    const unlockable = Object.hasOwn(UNLOCKABLE_BACKENDS, name);

    if (entry === undefined) {
      out.push({
        ok: false,
        message: `${pairLabel}: ${name} is declared but has NO entry in the lockfile — run the refresh below`,
      });
      continue;
    }

    // Version agreement. This is the drift that actually happens: a pin is bumped and the
    // lockfile is not regenerated, so the committed digest describes the OLD artifact.
    if (entry.versions.length === 0) {
      out.push({ ok: false, message: `${pairLabel}: ${name} has a lockfile block with no version` });
    } else if (!entry.versions.some((v) => versionSatisfies(spec, v))) {
      out.push({
        ok: false,
        message:
          `${pairLabel}: ${name} is pinned "${spec}" in the config but the lockfile holds ` +
          `${entry.versions.map((v) => `"${v}"`).join(", ")} — the committed digest describes a different artifact`,
      });
    }

    const withDigest = requiredPlatforms.filter((p) => entry.platforms[p] === true);

    if (unlockable) {
      // The roster can shrink, never grow: a tool that has BECOME lockable must leave it,
      // or the roster turns into a place where coverage quietly goes to die.
      if (withDigest.length > 0) {
        out.push({
          ok: false,
          message:
            `${pairLabel}: ${name} is on UNLOCKABLE_BACKENDS but now carries digests for ` +
            `${withDigest.join(", ")} — delete its roster entry, the exemption is stale`,
        });
      } else {
        out.push({ ok: true, message: `${pairLabel}: ${name} unlocked by backend — ${UNLOCKABLE_BACKENDS[name]}` });
      }
      continue;
    }

    const missing = requiredPlatforms.filter((p) => entry.platforms[p] !== true);
    if (missing.length === 0) {
      out.push({
        ok: true,
        message: `${pairLabel}: ${name} digest-locked on all ${String(requiredPlatforms.length)} required platforms`,
      });
      continue;
    }
    const reason = PARTIAL_COVERAGE[name];
    if (reason === undefined) {
      out.push({
        ok: false,
        message: `${pairLabel}: ${name} has NO committed digest for ${missing.join(", ")} — and no PARTIAL_COVERAGE reason on file`,
      });
    } else {
      out.push({
        ok: true,
        message: `${pairLabel}: ${name} partial (${withDigest.length}/${String(requiredPlatforms.length)}; missing ${missing.join(", ")}) — ${reason}`,
      });
    }
  }

  // A roster entry naming a tool nobody declares any more is dead weight that reads as
  // coverage policy. Scoped to the pair that could plausibly declare it: `.mise.full.toml`
  // declares five tools and would otherwise convict every base-tier roster entry.
  for (const name of Object.keys(UNLOCKABLE_BACKENDS)) {
    if (pairLabel === PAIRS[0]?.config && !Object.hasOwn(declared, name)) {
      out.push({
        ok: false,
        message: `${pairLabel}: UNLOCKABLE_BACKENDS names ${name}, which nothing declares — remove the stale roster entry`,
      });
    }
  }

  return out;
}

export function refreshInstructions(): string {
  return [
    "REFRESH (never hand-edit a digest), on the mise version tools/setup/linux.sh pins:",
    "  export MISE_GITHUB_TOKEN=$(gh auth token)   # anonymous release metadata is 60/hr; a run this size exhausts it",
    "  export MISE_PYTHON_GITHUB_ATTESTATIONS=0    # MUST match tools/setup/common/mise.sh (see below)",
    "  MISE_LOCKED=0 mise lock",
    "  MISE_LOCKED=0 mise lock --platform windows-arm64   # not in mise's default platform set",
    "  MISE_LOCKED=0 mise lock                            # again: pass 1 discovers the x86-64 baseline variants",
    "",
    "MISE_LOCKED=0 is required, not cosmetic: with `locked = true` in the config, `mise lock`",
    "cannot resolve a version that is not already in the lockfile and PRUNES the old entry",
    "instead — measured 2026-09-10, it emptied a lockfile that way.",
    "",
    "MISE_PYTHON_GITHUB_ATTESTATIONS must equal what tools/setup/common/mise.sh exports at",
    "INSTALL time. A `provenance` row is an attestation verified at LOCK time and recorded, and",
    "with it present mise SKIPS the live attestation call at install — but mise REFUSES to",
    'install a tool whose lockfile attests a check the settings disable ("This may indicate a',
    "downgrade attack\"), so locking python with 1 against mise.sh's 0 fails every install.sh",
    "consumer closed. checkProvenanceMatchesInstallSettings() holds the two together.",
    "",
    "`mise lock` output differs between mise releases (2026.6.12 vs 2026.8.14 disagree on the",
    "header, `specifiers`, and the baseline platform variants), so a re-lock on the wrong mise",
    "reads as drift that is not there.",
  ].join("\n");
}

// ── RE-LOCK COMPARISON ────────────────────────────────────────────────────────────────────
//
// `provenance = "github-attestations"` is NOT a digest we own. It is the record that mise
// verified an artifact's attestation AT LOCK TIME, and its presence therefore depends on
// GitHub's attestation service being reachable at the moment somebody ran `mise lock`.
//
// Measured 2026-09-10, and this is the discovery that shapes the whole comparison: with the
// row present mise SKIPS the live attestation call on install; with it absent mise makes the
// call. So the row is the RELOCATION of the availability-coupled check into committed text —
// exactly what the 503 that motivated this work argued for.
//
// Which means a byte-for-byte drift gate would be wrong in a specific and ironic way: an
// attestation outage during the weekly re-lock would drop those rows and redden a check whose
// entire purpose is to remove a dependency on that service being up. A failed probe is
// `unknown`, never a negative result.
//
// So: url / checksum / version / platform differences are DRIFT and fail. A provenance row
// that appears or disappears is REPORTED and does not fail.

const PROVENANCE_PREFIX = "provenance = ";

/** The lockfile with provenance rows removed — the part of it we actually own. */
export function withoutProvenance(body: string): string {
  return body
    .split("\n")
    .filter((l) => !l.trimStart().startsWith(PROVENANCE_PREFIX))
    .join("\n");
}

/** `<tool>/<platform>` for every platform row carrying a provenance record. */
export function provenanceKeys(body: string): Set<string> {
  const out = new Set<string>();
  let key: string | null = null;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    const m = /^\[tools\.("[^"]+"|[^.\]]+)\."platforms\.([^"]+)"\]$/.exec(line);
    if (m?.[1] !== undefined && m[2] !== undefined) {
      key = `${m[1].replace(/^"|"$/g, "")}/${m[2]}`;
      continue;
    }
    if (line.startsWith("[")) {
      key = null;
      continue;
    }
    if (key !== null && line.startsWith(PROVENANCE_PREFIX)) out.add(key);
  }
  return out;
}

export interface RelockVerdict {
  /** Differing lines outside `provenance`. Non-empty ⇒ real drift ⇒ exit 1. */
  readonly drift: string[];
  /** Rows the committed file attests and a fresh lock did not — a lock-time `unknown`. */
  readonly provenanceLost: string[];
  /** Rows a fresh lock attests and the committed file does not — a refresh is available. */
  readonly provenanceGained: string[];
}

export function classifyRelock(committed: string, relocked: string): RelockVerdict {
  const a = withoutProvenance(committed).split("\n");
  const b = withoutProvenance(relocked).split("\n");
  const drift: string[] = [];
  for (let i = 0; i < Math.max(a.length, b.length) && drift.length < 40; i++) {
    const l = a[i] ?? "<absent>";
    const r = b[i] ?? "<absent>";
    if (l !== r) drift.push(`line ${String(i + 1)}: committed ${JSON.stringify(l)} vs re-locked ${JSON.stringify(r)}`);
  }
  const ka = provenanceKeys(committed);
  const kb = provenanceKeys(relocked);
  return {
    drift,
    provenanceLost: [...ka].filter((k) => !kb.has(k)).sort(),
    provenanceGained: [...kb].filter((k) => !ka.has(k)).sort(),
  };
}

/** `--relock-diff <committed-file> <relocked-file>`; exit 1 on drift, 0 otherwise. */
function relockDiffMain(argv: readonly string[]): number {
  const committedPath = argv[0];
  const relockedPath = argv[1];
  if (committedPath === undefined || relockedPath === undefined) {
    console.error("[mise-lock-relock] usage: --relock-diff <committed-file> <relocked-file>");
    return 2;
  }
  const v = classifyRelock(readFileSync(committedPath, "utf8"), readFileSync(relockedPath, "utf8"));
  for (const k of v.provenanceLost) {
    console.log(
      `[mise-lock-relock] UNKNOWN: ${k} is attested in the committed lockfile and was not re-attested now. ` +
        "That is the attestation service being unreachable at lock time, not a defect in the pin.",
    );
  }
  for (const k of v.provenanceGained) {
    console.log(`[mise-lock-relock] note: ${k} could now carry an attestation record; a refresh would add it.`);
  }
  if (v.drift.length === 0) {
    console.log(
      `[mise-lock-relock] OK — ${relockedPath} reproduces ${committedPath} in url, checksum, version and platform`,
    );
    return 0;
  }
  for (const d of v.drift) console.error(`[mise-lock-relock] ✗ ${d}`);
  console.error(`\n${refreshInstructions()}`);
  return 1;
}

function main(): void {
  const root = process.cwd();
  const findings: Finding[] = [
    ...checkLockedModeSafety(
      readFileSync(join(root, ".mise.toml"), "utf8"),
      readFileSync(join(root, LINUX_SH_PATH), "utf8"),
      readFileSync(join(root, MACOS_SH_PATH), "utf8"),
      readFileSync(join(root, INSTALL_PS1_PATH), "utf8"),
    ),
  ];
  findings.push(
    ...checkProvenanceMatchesInstallSettings(
      readFileSync(join(root, MISE_SH_PATH), "utf8"),
      readFileSync(join(root, "mise.lock"), "utf8"),
    ),
  );
  for (const pair of PAIRS) {
    let lockBody: string;
    try {
      lockBody = readFileSync(join(root, pair.lock), "utf8");
    } catch {
      // The PRE-FIX state, and the reason it is a named finding rather than an ENOENT
      // stack trace: "there is no lockfile" is the defect this audit exists for, so it
      // has to read as a conviction with the repair attached, not as a crash a reader
      // mistakes for a bug in the audit.
      findings.push({
        ok: false,
        message: `${pair.config}: ${pair.lock} does not exist — not one mise-managed digest in this repo would be one we own`,
      });
      continue;
    }
    findings.push(...checkPair(pair.config, readFileSync(join(root, pair.config), "utf8"), lockBody));
  }
  let failed = false;
  for (const f of findings) {
    if (f.ok) console.log(`[mise-lock-coverage] ${f.message}`);
    else {
      console.error(`[mise-lock-coverage] ✗ ${f.message}`);
      failed = true;
    }
  }
  if (failed) {
    console.error(`\n${refreshInstructions()}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv[0] === "--relock-diff") process.exit(relockDiffMain(argv.slice(1)));
  else main();
}
