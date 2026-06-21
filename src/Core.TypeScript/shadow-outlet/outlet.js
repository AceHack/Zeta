#!/usr/bin/env bun
// outlet.ts — ephemeral shadow outlet for agent scratch/exploration.
//
// Phase 1 of B-0212: agents write scratch content to /tmp/zeta-shadow/.
// OS-managed cleanup — low stakes, no permanent record.
// The code path exists unconditionally; Phase 2 adds cryptographic privacy.
//
// Self-invisibility is enforced via --exclude: callers pass their own
// agent name and the tool filters them out. list and read both support
// --exclude so consensus agents see entries the writer cannot.
//
// Usage:
//   bun src/Core.TypeScript/shadow-outlet/outlet.ts write --agent otto --content "exploring X"
//   bun src/Core.TypeScript/shadow-outlet/outlet.ts list                          # all entries
//   bun src/Core.TypeScript/shadow-outlet/outlet.ts list --exclude otto           # consensus view (exclude self)
//   bun src/Core.TypeScript/shadow-outlet/outlet.ts read <id> --exclude otto       # read one entry (self-invisibility enforced)
//   bun src/Core.TypeScript/shadow-outlet/outlet.ts clean                         # remove all entries
//   bun src/Core.TypeScript/shadow-outlet/outlet.ts clean --agent otto            # remove one agent's entries
//
// All subcommands accept --json for programmatic consumption.
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
const SHADOW_DIR = process.env.ZETA_SHADOW_DIR ?? join("/tmp", "zeta-shadow");
function ensureDir() {
    if (existsSync(SHADOW_DIR)) {
        if (!lstatSync(SHADOW_DIR).isDirectory()) {
            throw new Error(`${SHADOW_DIR} exists but is not a directory`);
        }
        return;
    }
    mkdirSync(SHADOW_DIR, { recursive: true, mode: 0o700 });
}
function entryPath(id) {
    return join(SHADOW_DIR, `${id}.json`);
}
function writeEntry(agent, content) {
    ensureDir();
    const id = randomUUID();
    const entry = {
        id,
        agent,
        timestamp: new Date().toISOString(),
        content,
    };
    writeFileSync(entryPath(id), JSON.stringify(entry, null, 2));
    return entry;
}
function listEntries(exclude) {
    ensureDir();
    const files = readdirSync(SHADOW_DIR).filter((f) => f.endsWith(".json"));
    const entries = [];
    for (const f of files) {
        try {
            const raw = readFileSync(join(SHADOW_DIR, f), "utf-8");
            const entry = JSON.parse(raw);
            if (typeof entry.id !== "string" || typeof entry.timestamp !== "string")
                continue;
            if (exclude && entry.agent === exclude)
                continue;
            entries.push(entry);
        }
        catch {
            // corrupted entry — skip silently, OS will clean up
        }
    }
    return entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
function readEntry(id, exclude) {
    const p = entryPath(id);
    if (!existsSync(p))
        return null;
    try {
        const entry = JSON.parse(readFileSync(p, "utf-8"));
        if (exclude && entry.agent === exclude)
            return null;
        return entry;
    }
    catch {
        return null;
    }
}
function cleanEntries(agent) {
    ensureDir();
    const files = readdirSync(SHADOW_DIR).filter((f) => f.endsWith(".json"));
    let removed = 0;
    for (const f of files) {
        const p = join(SHADOW_DIR, f);
        if (agent) {
            try {
                const entry = JSON.parse(readFileSync(p, "utf-8"));
                if (entry.agent !== agent)
                    continue;
            }
            catch {
                continue;
            }
        }
        try {
            rmSync(p, { force: true });
            removed++;
        }
        catch {
            // best-effort removal
        }
    }
    return removed;
}
function usage() {
    console.log(`Usage:
  bun src/Core.TypeScript/shadow-outlet/outlet.ts write --agent <name> --content <text>
  bun src/Core.TypeScript/shadow-outlet/outlet.ts list [--exclude <agent>]
  bun src/Core.TypeScript/shadow-outlet/outlet.ts read <id> [--exclude <agent>]
  bun src/Core.TypeScript/shadow-outlet/outlet.ts clean [--agent <name>]

Flags:
  --json    JSON output`);
}
function parseArgs(argv) {
    const args = argv.slice(2);
    const command = args[0] ?? "";
    const flags = {};
    const positional = [];
    for (let i = 1; i < args.length; i++) {
        const a = args[i];
        if (a.startsWith("--")) {
            const key = a.slice(2);
            const next = args[i + 1];
            if (next !== undefined && !next.startsWith("--")) {
                flags[key] = next;
                i++;
            }
            else {
                flags[key] = "true";
            }
        }
        else {
            positional.push(a);
        }
    }
    return { command, flags, positional };
}
function main() {
    const { command, flags, positional } = parseArgs(process.argv);
    const json = flags.json === "true";
    switch (command) {
        case "write": {
            const agent = flags.agent;
            const content = flags.content;
            if (!agent || !content) {
                console.error("Error: --agent and --content required for write");
                process.exit(1);
            }
            const entry = writeEntry(agent, content);
            if (json) {
                console.log(JSON.stringify(entry, null, 2));
            }
            else {
                console.log(`wrote ${entry.id} (agent=${entry.agent}, ${entry.timestamp})`);
            }
            break;
        }
        case "list": {
            const exclude = flags.exclude;
            const entries = listEntries(exclude);
            if (json) {
                console.log(JSON.stringify(entries, null, 2));
            }
            else if (entries.length === 0) {
                console.log("no entries" + (exclude ? ` (excluding ${exclude})` : ""));
            }
            else {
                for (const e of entries) {
                    console.log(`${e.id}  ${e.agent}  ${e.timestamp}  ${e.content.slice(0, 80)}`);
                }
            }
            break;
        }
        case "read": {
            const id = positional[0];
            if (!id) {
                console.error("Error: entry id required");
                process.exit(1);
            }
            const entry = readEntry(id, flags.exclude);
            if (!entry) {
                console.error(`Error: entry ${id} not found`);
                process.exit(1);
            }
            if (json) {
                console.log(JSON.stringify(entry, null, 2));
            }
            else {
                console.log(`id:        ${entry.id}`);
                console.log(`agent:     ${entry.agent}`);
                console.log(`timestamp: ${entry.timestamp}`);
                console.log(`content:   ${entry.content}`);
            }
            break;
        }
        case "clean": {
            const agent = flags.agent;
            const removed = cleanEntries(agent);
            if (json) {
                console.log(JSON.stringify({ removed, agent: agent ?? null }));
            }
            else {
                console.log(`removed ${removed} entries` + (agent ? ` for ${agent}` : ""));
            }
            break;
        }
        default:
            usage();
            process.exit(command ? 1 : 0);
    }
}
if (import.meta.main) {
    main();
}
