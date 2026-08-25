/**
 * Work-item event direct-to-main git push (081KSXN940008QG0R002FWR9B2 slice 2c).
 *
 * Mirrors agent-bus `gitPushEnvelope`: main checkout only, pathspec commit,
 * --no-verify, pull --rebase retry. Guarded behind CLI `--push` so tests/imports
 * never touch git.
 */
import { execFileSync } from "node:child_process";
import type { WorkItemEvent } from "./types";

function coauthorFor(by: string): string {
  const byPrefix: readonly (readonly [string, string])[] = [
    ["otto", "Co-Authored-By: Claude <noreply@anthropic.com>"],
    ["alexa", "Co-Authored-By: Kiro <noreply@kiro.dev>"],
    ["riven", "Co-Authored-By: Grok <noreply@x.ai>"],
    ["vera", "Co-Authored-By: Codex <noreply@openai.com>"],
    ["lior", "Co-Authored-By: Gemini <noreply@google.com>"],
  ];
  const match = byPrefix.find(([p]) => by === p || by.startsWith(`${p}-`));
  return match ? match[1] : `Co-Authored-By: ${by}[bot] <${by}[bot]@users.noreply.github.com>`;
}

export function buildEventCommitMessage(
  gitPath: string,
  by: string,
  event: Pick<WorkItemEvent, "kind" | "payload">,
): string {
  const workItemId = event.payload.workItemId;
  return [
    `work-item(${by}): ${event.kind} ${workItemId} ${gitPath}`,
    "",
    `Work-item event published (${event.kind}, 081KSXN940008QG0R002FWR9B2, no-PR direct-to-main).`,
    "",
    coauthorFor(by),
  ].join("\n");
}

/** Commit a single event file and push `origin HEAD:main` (main checkout required). */
export function gitPushEventFile(path: string, by: string, event: Pick<WorkItemEvent, "kind" | "payload">): void {
  const opts = { stdio: "inherit" as const };
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf-8" }).trim();
  if (branch !== "main") {
    throw new Error(`work-items publish must run on a main checkout (on '${branch}'); use a worktree on main`);
  }
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  execFileSync("git", ["fetch", "origin", "main"], opts);
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const ahead = execFileSync("git", ["rev-list", "--count", "origin/main..HEAD"], { encoding: "utf-8" }).trim();
  if (ahead !== "0") {
    throw new Error(
      `work-items publish: local main is ${ahead} commit(s) ahead of origin/main; reconcile before publishing`,
    );
  }
  const gitPath = path.replaceAll("\\", "/");
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  execFileSync("git", ["add", gitPath], opts);
  const commitMsg = buildEventCommitMessage(gitPath, by, event);
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  execFileSync("git", ["commit", "--no-verify", "-q", "-m", commitMsg, "--", gitPath], opts);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // eslint-disable-next-line sonarjs/no-os-command-from-path
      execFileSync("git", ["push", "origin", "HEAD:main"], opts);
      return;
    } catch {
      try {
        // eslint-disable-next-line sonarjs/no-os-command-from-path
        execFileSync("git", ["pull", "--rebase", "origin", "main"], opts);
      } catch {
        try {
          // eslint-disable-next-line sonarjs/no-os-command-from-path
          execFileSync("git", ["rebase", "--abort"], opts);
        } catch {
          /* no rebase in progress */
        }
        throw new Error(
          "work-items publish: rebase conflict — same event path with different content. Re-mint with crypto env and retry.",
        );
      }
    }
  }
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  execFileSync("git", ["push", "origin", "HEAD:main"], opts);
}
