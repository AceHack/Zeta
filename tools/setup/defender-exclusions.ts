#!/usr/bin/env bun
// defender-exclusions.ts -- propose antivirus scan exclusions for the build trees.
//
// WHY TYPESCRIPT. This was written as `defender-exclusions.sh` first and the
// bash-retirement guard refused it: 33 non-Lean shell files against an expected
// 32. The guard was right and the fix is not to widen its allowlist. `.ts` over
// `.sh` is the repo's one interface, and this directory already carries three
// privileged setup tools written that way -- `touchid-sudo.ts`,
// `touchid-sudo-config.ts`, `op-token-setup.ts`. Adding a 34th shell script for
// a job with three TypeScript precedents beside it would have been debt chosen
// over convention.
//
// WHY A COMMITTED TOOL AND NOT A COMMAND HANDED OVER IN CHAT. Adding an AV
// exclusion is a privileged, security-REDUCING change to the host. Privileged
// operations here are committed, tested, reviewable code, never ad-hoc `sudo`
// pasted into a terminal -- a one-liner in a transcript is not readable before it
// runs, diffable when it changes, or auditable after.
//
// IT DOES NOTHING BY DEFAULT. Invoked bare it PRINTS what it would exclude and
// exits. `--apply` is required to act, and `--apply` is the operator's call.
//
// THE HONEST COST, stated first, because an exclusion list that advertises only
// its speed benefit is a security change wearing a performance costume:
//
//   An excluded path is NOT SCANNED. Anything malicious landing inside one of
//   these directories -- a compromised dependency, a poisoned cache entry, a
//   hostile PR checked out locally -- will not be caught by real-time
//   protection. These trees are exactly where untrusted third-party code
//   arrives, which is what makes the exclusion both effective and genuinely
//   risky.
//
// Defensible for build/cache trees on a developer workstation whose supply chain
// is checked elsewhere (lockfiles, pinned toolchains, CI attestation). NOT
// defensible on a server or a shared host. If you are unsure which you are on,
// do not run this.
//
// PLATFORM DETECTION IS EXPLICIT AND FAILS CLOSED. Two unrelated products are
// called "Defender": Microsoft Defender for Endpoint on macOS/Linux (`mdatp`)
// and Microsoft Defender Antivirus on Windows (`Get-MpPreference`). This handles
// the FORMER only. With no `mdatp` present it says so and exits 0 without
// touching anything -- a no-op is correct when the thing being configured is
// absent, and announcing it is what stops a silent success from reading as a
// completed change. The Windows variant is deliberately NOT stubbed: an empty
// branch printing "TODO" is a step that cannot fail, which looks like coverage
// and provides none.
//
// EVERY EXTERNAL EFFECT IS INJECTED. `mdatp` invocation and directory existence
// both arrive through `Host`, so the tests drive real cases without a fake PATH
// and without ever touching the developer's endpoint configuration
// (§13 noninterference).

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** The injected view of the machine. Every effect this tool has goes through here. */
export interface Host {
  /** `true` when the path exists and is a directory. */
  readonly isDir: (path: string) => boolean;
  /** Immediate entry names of a directory, or `[]` when unreadable. */
  readonly list: (path: string) => readonly string[];
  /** `null` when `mdatp` is not installed; otherwise runs it and returns stdout + success. */
  readonly mdatp: ((args: readonly string[]) => { readonly ok: boolean; readonly stdout: string }) | null;
}

export interface Candidate {
  readonly path: string;
  readonly reason: string;
  /** A glob is proposed without existence-checking; a literal path is skipped when absent. */
  readonly isGlob: boolean;
}

/**
 * The trees, each with WHY it is here.
 *
 * A bare path list rots into a set nobody can audit -- the reader cannot tell an
 * exclusion still earning its keep from one added for a toolchain since removed.
 */
export function candidates(home: string, host: Host): readonly Candidate[] {
  const out: Candidate[] = [
    {
      path: join(home, "Documents/src/repos"),
      reason:
        "the working trees. Thousands of small files rewritten per build; real-time scanning of every write dominates build time.",
      isGlob: false,
    },
    {
      path: join(home, ".nuget/packages"),
      reason: "NuGet package cache -- extracted archives, read constantly during restore, immutable once written.",
      isGlob: false,
    },
    {
      path: join(home, ".dotnet"),
      reason: "dotnet SDK + tool cache. Rescanned on every invocation; contents pinned by global.json / dotnet-tools.",
      isGlob: false,
    },
    {
      path: join(home, ".bun/install/cache"),
      reason: "bun module cache. Content-addressed and immutable; rescanning re-reads bytes that cannot have changed.",
      isGlob: false,
    },
    {
      path: join(home, ".local/share/mise"),
      reason: "mise toolchain installs. Large, pinned, rewritten only on an explicit toolchain change.",
      isGlob: false,
    },
    {
      path: join(home, ".cargo/registry"),
      reason: "cargo registry cache -- same immutability argument as bun's.",
      isGlob: false,
    },
  ];

  // The `zeta-wt-*` worktrees are the hot path for agent work, and there are ~99
  // of them on this host. Enumerating them was the first version and was wrong
  // twice over: 99 literal entries are not reviewable, and the set churns every
  // time a worktree is created or removed, so the list would be stale within a
  // day.
  //
  // One wildcard instead. Microsoft documents glob support for `mdatp` folder
  // exclusions -- but this does not TRUST that, because a wildcard the product
  // silently declines to expand would leave every worktree unscanned-in-intent
  // and scanned-in-fact, the worst of both. The read-back in `apply` settles it:
  // if the pattern does not land, verification reports it rather than the tool
  // claiming success.
  const worktrees = host.list(home).filter((e) => e.startsWith("zeta-wt-") && host.isDir(join(home, e)));
  if (worktrees.length > 0) {
    out.push({
      path: join(home, "zeta-wt-*"),
      reason: `agent worktrees (${worktrees.length} present) -- same write profile as the main checkout. One wildcard, not ${worktrees.length} literal entries: the set churns constantly.`,
      isGlob: true,
    });
  }
  return out;
}

/** A glob is always proposed; a literal path only when it exists. */
export function isProposable(c: Candidate, host: Host): boolean {
  return c.isGlob || host.isDir(c.path);
}

export function renderProposal(cs: readonly Candidate[], host: Host): string {
  const lines: string[] = [
    "Zeta -- proposed antivirus scan exclusions",
    "",
    "COST: an excluded path is NOT scanned. These trees are where third-party",
    "code arrives, which is what makes the exclusion both effective and risky.",
    "Defensible on a developer workstation; NOT on a server or shared host.",
    "",
  ];
  let absent = 0;
  for (const c of cs) {
    if (isProposable(c, host)) lines.push(`  ${c.path}`, `      ${c.reason}`);
    else {
      lines.push(`  ${c.path}  [ABSENT -- will be skipped]`);
      absent += 1;
    }
  }
  lines.push("", `  ${cs.length} candidate path(s), ${absent} absent.`);
  return lines.join("\n");
}

export interface ApplyResult {
  readonly applied: number;
  readonly failed: readonly string[];
  /** Paths confirmed present in mdatp's OWN listing after the adds. */
  readonly verified: readonly string[];
  /** Proposed, added without error, and still not in the listing. The interesting failure. */
  readonly unverified: readonly string[];
}

/**
 * Add the exclusions, then READ BACK.
 *
 * The add's exit status reports what the command CLAIMED. `verified` reports what
 * the product actually holds. A configuration step that trusts its own return
 * value is an assertion, and an assertion is not a measurement -- which matters
 * most here, because on a managed host a local add can be silently overridden by
 * policy and still exit 0.
 */
export function apply(cs: readonly Candidate[], host: Host): ApplyResult {
  if (host.mdatp === null) return { applied: 0, failed: [], verified: [], unverified: [] };
  const proposable = cs.filter((c) => isProposable(c, host));
  const failed: string[] = [];
  let applied = 0;
  for (const c of proposable) {
    // A duplicate add is a no-op in mdatp, so re-running is safe (idempotency,
    // discipline #6). A failure is collected rather than thrown: one rejected
    // path must not leave the rest unconfigured.
    if (host.mdatp(["exclusion", "folder", "add", "--path", c.path]).ok) applied += 1;
    else failed.push(c.path);
  }
  const listing = host.mdatp(["exclusion", "list"]).stdout;
  const verified = proposable.filter((c) => listing.includes(c.path)).map((c) => c.path);
  const unverified = proposable.filter((c) => !listing.includes(c.path)).map((c) => c.path);
  return { applied, failed, verified, unverified };
}

/** The real machine. Constructed only in `main`, never at import time. */
export function realHost(): Host {
  const probe = spawnSync("mdatp", ["--help"], { encoding: "utf8" });
  const available = probe.error === undefined;
  return {
    isDir: (p) => {
      try {
        return existsSync(p);
      } catch {
        return false;
      }
    },
    list: (p) => {
      try {
        return readdirSync(p);
      } catch {
        return [];
      }
    },
    mdatp: available
      ? (args) => {
          const r = spawnSync("mdatp", [...args], { encoding: "utf8" });
          return { ok: r.status === 0, stdout: r.stdout ?? "" };
        }
      : null,
  };
}

export function main(argv: readonly string[], home: string, host: Host, log: (s: string) => void): number {
  let doApply = false;
  for (const a of argv) {
    if (a === "--apply") doApply = true;
    else if (a === "--dry-run") doApply = false;
    else if (a === "-h" || a === "--help") {
      log("usage: bun tools/setup/defender-exclusions.ts [--apply | --dry-run]");
      return 0;
    } else {
      // Silently ignoring `--aply` would run the dry path while the operator
      // believed they had applied -- a typo becoming a false report of a
      // completed change.
      log(`unknown argument: ${a} (accepted: --apply, --dry-run, --help)`);
      return 2;
    }
  }

  const cs = candidates(home, host);
  // Printed BEFORE detection, so reviewing the proposal does not require the
  // product to be installed.
  log(renderProposal(cs, host));

  if (host.mdatp === null) {
    log("");
    log("mdatp NOT FOUND -- Microsoft Defender for Endpoint is not installed here.");
    log("Nothing to do. (Windows hosts use Defender Antivirus, a different product;");
    log("this tool does not handle it -- see the header.)");
    return 0;
  }

  if (!doApply) {
    log("");
    log("DRY RUN -- nothing changed. Re-run with --apply to add these exclusions.");
    log("  bun tools/setup/defender-exclusions.ts --apply");
    return 0;
  }

  const r = apply(cs, host);
  log("");
  log(`  applied=${r.applied} failed=${r.failed.length} verified-present=${r.verified.length}`);
  for (const p of r.failed) log(`  FAILED: ${p}`);
  for (const p of r.unverified) log(`  NOT PRESENT after apply: ${p}`);
  if (r.failed.length > 0 || r.verified.length === 0) {
    log("  Exclusions are typically managed by policy on a managed host; a local add");
    log("  can be silently overridden. Check with your endpoint administrator.");
    return 1;
  }
  log("  Done. Re-running is safe and idempotent.");
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2), homedir(), realHost(), (s) => console.log(s)));
}
