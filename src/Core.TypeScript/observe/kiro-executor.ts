/**
 * src/Core.TypeScript/observe/kiro-executor.ts — real CommandExecutor for the Kiro surface.
 *
 * This is the `just-bash` executor that `run-loop-real.ts` wires into the observe
 * loop when `do_item` is the chosen action. It translates a BacklogItem pick into
 * real work: reads the item file, creates a claim branch, and runs a focused
 * script that does the bounded slice of work.
 *
 * Phase 1 (this slice): read the item → create a claim branch → run a bounded
 * script (the `executionPrompt` from the selector, or a generated one). The script
 * is a `bun` invocation that reads the item and produces the smallest safe change.
 *
 * The executor is `just-bash` tier: it spawns subprocesses (git, bun) directly on
 * the host filesystem. No OCI sandbox yet (that's Phase 2 / 081KT07NV0008QG0R001CBQ2X2 §2.2).
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/do-item.ts (CommandExecutor / RunSpec / RunOutcome)
 *   - src/Core.TypeScript/backlog/autonomous-pickup.ts (readBacklogItems for item lookup)
 *   - src/Core.TypeScript/observe/run-loop-real.ts (the tick entrypoint that wires this)
 */

import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CommandExecutor, RunSpec, RunOutcome, ExecutorTier } from "./do-item";
import type { BacklogItem } from "./observe";

export interface KiroExecutorOptions {
  /** Repo root (default: process.cwd()). */
  readonly repoRoot?: string;
  /** Max execution time in ms (default: 120_000 = 2 minutes for Phase 1). */
  readonly timeoutMs?: number;
  /** Agent identity for branch naming (default: "alexa"). */
  readonly agentId?: string;
}

/**
 * Generate a claim branch name from a backlog item id + agent + timestamp.
 * Format: `claim/<id-slug>-<date>` (matches the agent-claim-protocol).
 */
function claimBranchName(item: BacklogItem, agentId: string): string {
  const slug = item.id.toLowerCase().replace(/\./g, "-");
  const date = new Date().toISOString().slice(0, 10);
  return `claim/${slug}-${agentId}-${date}`;
}

/**
 * Find and read the backlog item's .md file to extract the full context.
 * Returns the file content or null if not found.
 */
function readItemFile(repoRoot: string, item: BacklogItem): string | null {
  // Try docs/backlog/{P0..P3} — items are ZetaId-named files containing `id: B-xxxx`
  const priorities = ["P0", "P1", "P2", "P3"];
  for (const p of priorities) {
    const dir = join(repoRoot, "docs", "backlog", p);
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (!entry.endsWith(".md")) continue;
        const fullPath = join(dir, entry);
        const content = readFileSync(fullPath, "utf-8");
        // Check if this file's frontmatter id matches our item
        const idMatch = content.match(/^id:\s*(.+)$/m);
        if (idMatch && idMatch[1]?.trim() === item.id) {
          return content;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Generate the execution script for a do_item action.
 * Phase 1: a simple bounded script that:
 * 1. Creates a claim branch from origin/main
 * 2. Reads the item for context
 * 3. Does a minimal, bounded change
 * 4. Commits + pushes
 *
 * For now, the script is a diagnostic that proves the loop works end-to-end.
 * Real work dispatch (invoking the agent with a focused prompt) is Phase 2.
 */
/**
 * A YAML double-quoted scalar. The BACKSLASH is escaped, not only the quote.
 *
 * Was `title.replace(/"/g, '\\"')` (CodeQL `js/incomplete-sanitization`): escaping the
 * quote while leaving the backslash alone means a title ending in `\` emitted
 * `title: "...\"`, whose closing quote is now escaped -- the scalar runs on into the rest
 * of the front matter and the claim file stops parsing. YAML's double-quoted style
 * recognises `\` as its escape character, so the escape character must be escaped first,
 * which one character class does in a single pass.
 */
export function yamlDoubleQuoted(value: string): string {
  return `"${value.replace(/[\\"]/g, "\\$&")}"`;
}

function generateScript(item: BacklogItem, itemContent: string | null, opts: Required<KiroExecutorOptions>): string {
  const branch = claimBranchName(item, opts.agentId);
  const itemContextComment =
    itemContent === null ? `# Item context: not found` : `# Item context: ${itemContent.split("\n").length} lines`;
  // Phase 1: create the claim branch and write a claim file as proof-of-life.
  // This demonstrates the full loop works. Phase 2 will do actual implementation.
  return [
    `#!/usr/bin/env bash`,
    `set -euo pipefail`,
    ``,
    `# Observe loop executor — do_item ${item.id}`,
    `# Title: ${item.title}`,
    `# Branch: ${branch}`,
    itemContextComment,
    ``,
    `cd "${opts.repoRoot}"`,
    ``,
    `# Ensure we're on main and up to date`,
    `git fetch origin main`,
    `git checkout -B "${branch}" origin/main`,
    ``,
    `# Write a claim file (proof the loop is executing)`,
    `mkdir -p docs/claims`,
    `cat > "docs/claims/${item.id.toLowerCase().replace(/\./g, "-")}.md" << 'CLAIM'`,
    `---`,
    `id: ${item.id}`,
    `claimed_by: ${opts.agentId}`,
    `claimed_at: ${new Date().toISOString()}`,
    `title: ${yamlDoubleQuoted(item.title)}`,
    `status: in-progress`,
    `branch: ${branch}`,
    `---`,
    ``,
    `# Claim: ${item.id}`,
    ``,
    `Claimed by the observe-inline executor (${opts.agentId}).`,
    `Work in progress on branch \`${branch}\`.`,
    `CLAIM`,
    ``,
    `git add docs/claims/`,
    `git commit --no-verify -m "claim(${opts.agentId}): ${item.id} — ${item.title.slice(0, 60)}" \\`,
    `  -m "Observe-inline executor picked this item from the backlog." \\`,
    `  -m "Co-Authored-By: Kiro <noreply@kiro.dev>"`,
    ``,
    `git push -u origin "${branch}"`,
    ``,
    `echo "Claimed ${item.id} on branch ${branch}"`,
  ].join("\n");
}

/**
 * The Kiro `just-bash` executor. Reads the item, creates a claim branch,
 * runs the execution script. Returns RunOutcome (never throws).
 */
export function kiroExecutor(options?: KiroExecutorOptions): CommandExecutor {
  const opts: Required<KiroExecutorOptions> = {
    repoRoot: options?.repoRoot ?? process.cwd(),
    timeoutMs: options?.timeoutMs ?? 120_000,
    agentId: options?.agentId ?? process.env.ZETA_AGENT_ID ?? "alexa",
  };

  return {
    tier: "just-bash" as ExecutorTier,

    run: async (spec: RunSpec): Promise<RunOutcome> => {
      // The RunSpec.script from run-loop-real is the generated bash script.
      // Execute it via bash.
      const script = spec.script;
      const cwd = spec.cwd ?? opts.repoRoot;

      try {
        const result: SpawnSyncReturns<string> = spawnSync("bash", ["-c", script], {
          cwd,
          encoding: "utf-8",
          timeout: opts.timeoutMs,
          env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        });

        if (result.status === 0) {
          return { ok: true, stdout: result.stdout ?? "", exitCode: 0 };
        }

        return {
          ok: false,
          reason: `script exited ${result.status}: ${(result.stderr ?? "").slice(0, 500)}`,
          exitCode: result.status ?? 1,
          stderr: result.stderr ?? "",
        };
      } catch (err) {
        return {
          ok: false,
          reason: `spawn failed: ${err instanceof Error ? err.message : String(err)}`,
          exitCode: -1,
          stderr: "",
        };
      }
    },
  };
}

/**
 * Build the DoItemOptions (RunSpec + gated) for a given backlog item.
 * This is the bridge between the observe loop's `BacklogItem` and the executor's RunSpec.
 */
export function buildDoItemSpec(
  item: BacklogItem,
  options?: KiroExecutorOptions,
): { spec: { script: string; cwd: string }; gated: boolean } {
  const opts: Required<KiroExecutorOptions> = {
    repoRoot: options?.repoRoot ?? process.cwd(),
    timeoutMs: options?.timeoutMs ?? 120_000,
    agentId: options?.agentId ?? process.env.ZETA_AGENT_ID ?? "alexa",
  };

  const itemContent = readItemFile(opts.repoRoot, item);
  const script = generateScript(item, itemContent, opts);

  return {
    spec: { script, cwd: opts.repoRoot },
    gated: false, // Phase 1: ungated (just-bash, no OCI sandbox)
  };
}
