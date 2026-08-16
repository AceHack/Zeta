#!/usr/bin/env bun
// src/Core.TypeScript/cluster/deregister-node.ts
//
// Remove a registered cluster-node from git: deletes
// maintainers/<operator>/cluster-nodes/<hostname>/ + commits + opens
// PR. Sibling to the iter-5.4.1 (081KSGS9H0008QG0R0037H3W4T) self-registration flow that
// CREATES that tree.
//
// The maintainer 2026-05-26: "lets make a ts file for removing
// machines from git too cause i'm going to delete clusters a lot lol".
// Tracks as 081KSGS9H0008QG0R000EPPQTR; this tool is the implementation.
//
// Usage:
//   bun src/Core.TypeScript/cluster/deregister-node.ts --host <hostname> \
//       [--maintainer <name>] [--reason "..."] [--push-direct]
//
// Defaults:
//   --maintainer: derived from `gh api /user --jq .login`
//   --push-direct: false (default opens PR; safer; ArgoCD won't
//                  reconcile until operator merges)
//
// Behavior:
//   1. Resolve operator (gh api /user .login) unless --maintainer overrides
//   2. Verify maintainers/<op>/cluster-nodes/<host>/ exists on origin/main
//      (use `git ls-tree origin/main` to avoid relying on local checkout state)
//   3. Create a branch `deregister/<host>-<YYYY-MM-DD-HHMM>`
//   4. git rm -r the cluster-nodes/<host>/ directory
//   5. Commit with reason (if provided) + auto-generated message
//   6. Push branch
//   7. Open PR with title "deregister(cluster-node): <host> — <reason or 'no reason given'>"
//   8. Print PR URL
//
// Exit codes:
//   0 — PR opened (or direct-push succeeded)
//   1 — invocation error (missing args, no gh auth, etc.)
//   2 — host not found in maintainers/<op>/cluster-nodes/ tree on main
//   3 — git/push/gh error
//
// Composes with 081KSGS9H0008QG0R0037H3W4T (iter-5.4.1 self-registration; this tool is the
// inverse) + 081KSGS9H0008QG0R002K93MWX (iter-5.4.2 ArgoCD reconciliation; ArgoCD will
// reconcile the node-removal on PR-merge per its self-heal+prune policy).

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface Args {
  host: string;
  maintainer: string | null; // null = auto-derive via gh api /user
  reason: string;
  pushDirect: boolean;
}

interface ArgError {
  error: string;
}

function parseArgs(argv: readonly string[]): Args | ArgError {
  let host = "";
  let maintainer: string | null = null;
  let reason = "";
  let pushDirect = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--host") {
      const v = argv[i + 1];
      if (!v || v.startsWith("-")) return { error: "--host requires a value" };
      host = v;
      i++;
    } else if (a === "--maintainer") {
      const v = argv[i + 1];
      if (!v || v.startsWith("-")) return { error: "--maintainer requires a value" };
      maintainer = v;
      i++;
    } else if (a === "--reason") {
      const v = argv[i + 1];
      // Reject values starting with "-" so `--reason --push-direct`
      // doesn't silently consume the flag as the reason string
      // (Copilot P1 finding on #5216).
      if (!v || v.startsWith("-")) {
        return { error: "--reason requires a value (non-flag string)" };
      }
      reason = v;
      i++;
    } else if (a === "--push-direct") {
      pushDirect = true;
    } else if (a === "-h" || a === "--help") {
      return {
        error:
          "Usage: bun src/Core.TypeScript/cluster/deregister-node.ts --host <hostname> " +
          "[--maintainer <name>] [--reason \"...\"] [--push-direct]",
      };
    } else {
      return { error: `unknown argument: ${a}` };
    }
  }
  if (host === "") return { error: "--host <hostname> is required" };
  // Validate hostname against DNS-label rules: alphanumeric + hyphens,
  // max 63 chars, no leading/trailing hyphen, no path separators or
  // shell metachars. Without this, values like `../foo` or
  // `;rm -rf /` could target unexpected paths since --host is
  // interpolated into a filesystem path (`maintainers/<op>/cluster-
  // nodes/${host}`) AND into a branch name (Copilot P1 on #5216).
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(host)) {
    return {
      error:
        `--host '${host}' is not a valid DNS label hostname. ` +
        `Must be alphanumeric + hyphens, 1-63 chars, no leading/trailing hyphen.`,
    };
  }
  return { host, maintainer, reason, pushDirect };
}

function run(
  cmd: string,
  args: readonly string[],
  cwd?: string,
): { ok: boolean; stdout: string; stderr: string; code: number } {
  // sonarjs/no-os-command-from-path suppression rationale: this tool
  // intentionally spawns `git` + `gh` from PATH (the canonical CLI
  // tooling pattern across Zeta's TS scripts in tools/cluster/ and
  // tools/github/). Inputs are validated before spawn (host name from
  // argv passes through git ls-tree before git rm; reason is
  // operator-supplied free text passed to git commit -m via an args
  // array, NOT via shell-evaluated string).
  //
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync(cmd, args as string[], {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    ok: r.status === 0,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    code: r.status ?? -1,
  };
}

function resolveOperator(): string | null {
  const r = run("gh", ["api", "/user", "--jq", ".login"]);
  if (!r.ok) return null;
  return r.stdout.trim();
}

function nodeExistsOnMain(operator: string, host: string): boolean {
  const dir = `maintainers/${operator}/cluster-nodes/${host}`;
  // git ls-tree against origin/main avoids dependence on local checkout.
  const r = run("git", ["ls-tree", "-d", "origin/main", `${dir}/`]);
  return r.ok && r.stdout.includes(host);
}

function isoUtcTimestamp(): string {
  // YYYYMMDD-HHMM format for branch naming; clean across timezones.
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`
  );
}

function main(): number {
  const parsed = parseArgs(process.argv.slice(2));
  if ("error" in parsed) {
    process.stderr.write(`deregister-node: ${parsed.error}\n`);
    return 1;
  }
  const { host, reason, pushDirect } = parsed;
  let { maintainer } = parsed;

  // Step 1: resolve operator
  if (maintainer === null) {
    maintainer = resolveOperator();
    if (maintainer === null) {
      process.stderr.write(
        "deregister-node: could not resolve operator via 'gh api /user'. " +
          "Run 'gh auth login' first, or pass --maintainer <name>.\n",
      );
      return 1;
    }
  }
  process.stdout.write(`deregister-node: operator = ${maintainer}\n`);

  // Step 2: fetch latest main + verify node exists
  const fetch = run("git", ["fetch", "origin", "main"]);
  if (!fetch.ok) {
    process.stderr.write(`deregister-node: git fetch origin main failed:\n${fetch.stderr}\n`);
    return 3;
  }
  if (!nodeExistsOnMain(maintainer, host)) {
    process.stderr.write(
      `deregister-node: maintainers/${maintainer}/cluster-nodes/${host}/ not found on origin/main; ` +
        `nothing to deregister.\n`,
    );
    return 2;
  }

  // Step 3: temp worktree off origin/main (don't touch the operator's primary checkout)
  const wt = mkdtempSync(join(tmpdir(), "zeta-deregister-"));
  process.stdout.write(`deregister-node: temp worktree = ${wt}\n`);
  const wtAdd = run("git", ["worktree", "add", wt, "origin/main"]);
  if (!wtAdd.ok) {
    process.stderr.write(`deregister-node: git worktree add failed:\n${wtAdd.stderr}\n`);
    // Cleanup the mkdtempSync dir even though worktree-add failed
    // (Copilot P1 on #5216 — without this, temp dirs leak when the
    // repo is in a bad git state).
    rmSync(wt, { recursive: true, force: true });
    return 3;
  }

  // Step 4: branch
  const ts = isoUtcTimestamp();
  const branch = pushDirect
    ? "main"
    : `deregister/${host}-${ts}`;
  if (!pushDirect) {
    const sw = run("git", ["switch", "-c", branch, "origin/main"], wt);
    if (!sw.ok) {
      process.stderr.write(`deregister-node: git switch -c ${branch} failed:\n${sw.stderr}\n`);
      // Best-effort worktree cleanup before exit:
      run("git", ["worktree", "remove", "--force", wt]);
      rmSync(wt, { recursive: true, force: true });
      return 3;
    }
  }

  // Step 5: git rm -r the cluster-nodes/<host>/ subtree
  const dir = `maintainers/${maintainer}/cluster-nodes/${host}`;
  const rm = run("git", ["rm", "-r", dir], wt);
  if (!rm.ok) {
    process.stderr.write(`deregister-node: git rm -r ${dir} failed:\n${rm.stderr}\n`);
    run("git", ["worktree", "remove", "--force", wt]);
    rmSync(wt, { recursive: true, force: true });
    return 3;
  }

  
  // Determine author from ZETA_PERSONA if present
  let gitAuthorFlag = null;
  const activePersonaName = process.env.ZETA_PERSONA;
  if (activePersonaName) {
    // We can require the registry here to look up the persona
    try {
      const { getPersona } = require("../service/persona-registry");
      const p = getPersona(activePersonaName);
      if (p && p.gitAuthorName && p.gitAuthorEmail) {
        gitAuthorFlag = `--author=${p.gitAuthorName} <${p.gitAuthorEmail}>`;
      }
    } catch (e) {
      // ignore
    }
  }

  // Step 6: commit
  const commitMsg =
    `deregister(cluster-node): ${host} — ${reason || "no reason given"}\n\n` +
    `Removes maintainers/${maintainer}/cluster-nodes/${host}/ subtree.\n` +
    `Sibling to iter-5.4.1 self-registration flow (081KSGS9H0008QG0R0037H3W4T substrate).\n` +
    `ArgoCD reconciliation on merge will prune the corresponding K8s\n` +
    `node-labels + taints + role-specific workload memberships per its\n` +
    `selfHeal + prune policy.\n\n` +
    `Co-Authored-By: Zeta Universal Grammar <noreply@zeta.lucent-financial-group.com>\n`;
  const commitArgs = ["commit", "-m", commitMsg];
  if (gitAuthorFlag) commitArgs.push(gitAuthorFlag);
  const commit = run("git", commitArgs, wt);
  if (!commit.ok) {
    process.stderr.write(`deregister-node: git commit failed:\n${commit.stderr}\n`);
    run("git", ["worktree", "remove", "--force", wt]);
    rmSync(wt, { recursive: true, force: true });
    return 3;
  }

  // Step 7: push
  const pushArgs = pushDirect
    ? ["push", "origin", "HEAD:main"]
    : ["push", "-u", "origin", branch];
  const push = run("git", pushArgs, wt);
  if (!push.ok) {
    process.stderr.write(`deregister-node: git push failed:\n${push.stderr}\n`);
    run("git", ["worktree", "remove", "--force", wt]);
    rmSync(wt, { recursive: true, force: true });
    return 3;
  }

  // Step 8: open PR (unless --push-direct)
  let prUrl = "";
  if (!pushDirect) {
    const title = `deregister(cluster-node): ${host}${reason ? ` — ${reason}` : ""}`;
    const body =
      `Removes \`maintainers/${maintainer}/cluster-nodes/${host}/\` subtree.\n\n` +
      `${reason ? `**Reason**: ${reason}\n\n` : ""}` +
      `On merge, ArgoCD reconciles the K8s state to drop the node's labels + taints + role-specific workload memberships.\n\n` +
      `Generated by \`src/Core.TypeScript/cluster/deregister-node.ts\` (081KSGS9H0008QG0R000EPPQTR substrate; sibling to iter-5.4.1 self-registration).\n`;
    const prCreate = run(
      "gh",
      ["pr", "create", "--head", branch, "--base", "main", "--title", title, "--body", body],
      wt,
    );
    if (!prCreate.ok) {
      process.stderr.write(`deregister-node: gh pr create failed:\n${prCreate.stderr}\n`);
      run("git", ["worktree", "remove", "--force", wt]);
      rmSync(wt, { recursive: true, force: true });
      return 3;
    }
    prUrl = prCreate.stdout.trim();
    process.stdout.write(`deregister-node: PR opened: ${prUrl}\n`);
    process.stdout.write(`deregister-node: review + merge to complete deregistration\n`);
  } else {
    process.stdout.write(
      `deregister-node: direct push to main succeeded; ArgoCD will reconcile within ~3 min\n`,
    );
  }

  // Step 9: cleanup temp worktree
  run("git", ["worktree", "remove", "--force", wt]);
  rmSync(wt, { recursive: true, force: true });

  return 0;
}

// Standard Bun-tool pattern: only invoke main() when run directly,
// not when imported (Copilot P2 on #5216; matches the pattern in
// src/Core.TypeScript/backlog/generate-index.ts + sibling scripts).
if (import.meta.main) {
  process.exit(main());
}
