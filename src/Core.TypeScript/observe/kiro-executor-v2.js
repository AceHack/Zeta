/**
 * src/Core.TypeScript/observe/kiro-executor-v2.ts — WorkspacePort-based executor.
 *
 * The executor that uses WorkspacePort instead of raw git/bash. This is the
 * "eat our own cooking" version: all persistence goes through the port interface.
 * Testable with the simulated port (no I/O). Production uses realWorkspacePort
 * (which delegates to git underneath via the polyfill).
 *
 * NO raw git commands. NO bash scripts. NO child_process.spawnSync.
 * Just typed WorkspacePort operations: branch, writeFile, stage, commit, push.
 *
 * Composes with:
 *   - src/Core.TypeScript/observe/workspace-port.ts (the DI-injectable interface)
 *   - src/Core.TypeScript/observe/do-item.ts (CommandExecutor / RunOutcome)
 *   - src/Core.TypeScript/observe/simulate-tick.ts (injects simulated port for testing)
 */
/**
 * Generate a claim branch name from a backlog item id + agent + date.
 */
function claimBranchName(item, agentId) {
    const slug = item.id.toLowerCase().replace(/\./g, "-").slice(0, 20);
    const date = new Date().toISOString().slice(0, 10);
    return `claim/${slug}-${agentId}-${date}`;
}
/**
 * Find and read a backlog item's file via the workspace port.
 */
function findItemFile(port, item) {
    const priorities = ["P0", "P1", "P2", "P3"];
    for (const p of priorities) {
        const dirPath = `docs/backlog/${p}`;
        const dirResult = port.readDir(dirPath);
        if (!dirResult.ok)
            continue;
        for (const entry of dirResult.value) {
            if (!entry.endsWith(".md"))
                continue;
            const filePath = `${dirPath}/${entry}`;
            const content = port.readFile(filePath);
            if (!content.ok)
                continue;
            // Check if zetaid matches
            const zetaMatch = content.value.match(/^zetaid:\s*(.+)$/m);
            if (zetaMatch && zetaMatch[1]?.trim() === item.id) {
                return content.value;
            }
        }
    }
    return null;
}
/**
 * Execute a do_item via WorkspacePort operations.
 * NO bash. NO git CLI. Just typed port operations.
 */
async function executeViaPort(port, item, agentId) {
    const branch = claimBranchName(item, agentId);
    // 1. Pull latest. Pull can fail (no remote, offline) — continue anyway for
    //    local work; we intentionally do not branch on the result here.
    void port.pull("origin", "main");
    // 2. Create claim branch
    const branchResult = port.branch(branch, "origin/main");
    if (!branchResult.ok) {
        // Fallback: branch from current HEAD
        const fallback = port.branch(branch);
        if (!fallback.ok) {
            return { ok: false, reason: `branch failed: ${fallback.reason}`, exitCode: 1, stderr: fallback.reason };
        }
    }
    // 3. Read the item for context
    const itemContent = findItemFile(port, item);
    // 4. Write a claim file (proof of execution)
    const claimPath = `docs/claims/${item.id.toLowerCase().replace(/\./g, "-")}.md`;
    const claimContent = [
        "---",
        `id: ${item.id}`,
        `claimed_by: ${agentId}`,
        `claimed_at: ${new Date().toISOString()}`,
        `title: "${item.title}"`,
        `status: in-progress`,
        `branch: ${branch}`,
        "---",
        "",
        `# Claim: ${item.id}`,
        "",
        `Claimed by the observe-inline executor (${agentId}).`,
        `Work in progress on branch \`${branch}\`.`,
        itemContent ? `\nItem has ${itemContent.split("\n").length} lines of context.` : "",
    ].join("\n");
    const writeResult = port.writeFile(claimPath, claimContent);
    if (!writeResult.ok) {
        return { ok: false, reason: `writeFile failed: ${writeResult.reason}`, exitCode: 1, stderr: writeResult.reason };
    }
    // 5. Stage + commit
    const stageResult = port.stage([claimPath]);
    if (!stageResult.ok) {
        return { ok: false, reason: `stage failed: ${stageResult.reason}`, exitCode: 1, stderr: stageResult.reason };
    }
    const commitMsg = `claim(${agentId}): ${item.id} — ${item.title.slice(0, 60)}\n\nObserve-inline executor.\n\nCo-Authored-By: Kiro <noreply@kiro.dev>`;
    const commitResult = port.commit(commitMsg);
    if (!commitResult.ok) {
        return { ok: false, reason: `commit failed: ${commitResult.reason}`, exitCode: 1, stderr: commitResult.reason };
    }
    // 6. Push
    const pushResult = port.push("origin", branch);
    if (!pushResult.ok) {
        // Push failure is non-fatal (offline work is valid)
        return {
            ok: true,
            stdout: `Claimed ${item.id} on ${branch} (push failed: ${pushResult.reason} — local commit exists)`,
            exitCode: 0,
        };
    }
    return {
        ok: true,
        stdout: `Claimed ${item.id} on ${branch} (pushed to origin)`,
        exitCode: 0,
    };
}
/**
 * The WorkspacePort-based executor. No bash, no raw git.
 * Testable with simulatedWorkspacePort (no I/O, deterministic).
 */
export function portExecutor(options) {
    const agentId = options.agentId ?? process.env.ZETA_AGENT_ID ?? "alexa";
    return {
        tier: "just-bash", // same tier label (compatible with do-item)
        run: async (_spec) => {
            // The spec carries the item info in a structured way, but the new path
            // bypasses RunSpec/bash entirely: callers pass the item directly via
            // portExecuteItem. This RunSpec entry point is a compatibility shim that
            // directs callers to the typed path; agentId is surfaced in stdout below.
            return {
                ok: true,
                stdout: `port-executor (${agentId}): use portExecuteItem directly`,
                exitCode: 0,
            };
        },
    };
}
/**
 * Execute a backlog item directly via the port (the preferred path).
 * This bypasses RunSpec/bash entirely — pure WorkspacePort operations.
 */
export async function portExecuteItem(port, item, agentId = "alexa") {
    try {
        return await executeViaPort(port, item, agentId);
    }
    catch (err) {
        return {
            ok: false,
            reason: `executor error: ${err instanceof Error ? err.message : String(err)}`,
            exitCode: -1,
            stderr: "",
        };
    }
}
