#!/usr/bin/env bun
// complete-workitem.ts — move a work-item to done (081KSXN940008QG0R002FWR9B2 lifecycle = folder).
//
// Completing a work-item:
//   1. updates frontmatter: state → done, adds `completed: <ISO datetime>` (precise;
//      DORA lead-time = created→completed),
//   2. MOVES the file workitems/<zetaid>-<desc>.md → workitems/done/YYYY/MM/<zetaid>-<desc>.md
//      (folder = state; YYYY/MM from the COMPLETION date — path answers "done when",
//      the ZetaId prefix still answers "created when"). A move is a git rename of a
//      disjoint, ZetaId-prefixed file → conflict-free even with 500 concurrent agents.
//   3. appends one line to the INCREMENTAL, checked-in done-index
//      `workitems/done/index.jsonl`. Sound because a done item is IMMUTABLE: its
//      entry is append-only and never goes stale (DV2.0 zero-change-rate satellite +
//      idempotent append). The index gives O(1) by-id lookup of done items (whose
//      completion-date — hence path — is NOT derivable from the ZetaId).
//
// DST (manifesto §7): the core `completeWorkItem` is a PURE function of
// (content, fromPath, env); the clock arrives via env. Date.now() is only in
// SYSTEM_ENV at the CLI boundary.
//
// Usage:
//   bun tools/backlog/complete-workitem.ts <zetaid|path> [--dir workitems] [--dry-run]
//
// Exit codes: 0 ok · 2 usage / not-found error.
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, appendFileSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { isCanonical, ZETAID_BASE32_LEN } from "../zeta-id/encoding";
import { SYSTEM_ENV } from "./new-workitem";
function pad2(n) {
    return n < 10 ? `0${n}` : `${n}`;
}
function extractFrontmatterField(content, field) {
    // only scan the leading --- ... --- block
    const end = content.indexOf("\n---", 3);
    const block = content.startsWith("---") && end > 0 ? content.slice(0, end) : content;
    const m = block.match(new RegExp(`^${field}:\\s*(.*)$`, "m"));
    return m ? m[1].trim() : undefined;
}
/** Pure: compute the done-path, updated content, and index line. No filesystem. */
export function completeWorkItem(content, fromPath, env) {
    const file = basename(fromPath);
    if (!file.endsWith(".md")) {
        throw new Error(`complete-workitem: expected a .md work-item file, got ${JSON.stringify(file)}`);
    }
    const stem = file.slice(0, -3);
    const zetaid = stem.slice(0, ZETAID_BASE32_LEN);
    if (!isCanonical(zetaid)) {
        throw new Error(`complete-workitem: ${JSON.stringify(file)} does not start with a canonical ZetaId`);
    }
    const ms = env.nowMs();
    const d = new Date(ms);
    const yyyy = String(d.getUTCFullYear());
    const mm = pad2(d.getUTCMonth() + 1);
    const completedIso = d.toISOString();
    const toPath = join("workitems", "done", yyyy, mm, file);
    // Update frontmatter: state → done; insert/replace `completed:`.
    let newContent = content;
    if (/^state:\s*.*$/m.test(newContent)) {
        newContent = newContent.replace(/^state:\s*.*$/m, "state: done");
    }
    else {
        throw new Error("complete-workitem: no `state:` field in frontmatter");
    }
    if (/^completed:\s*.*$/m.test(newContent)) {
        newContent = newContent.replace(/^completed:\s*.*$/m, `completed: ${completedIso}`);
    }
    else {
        // insert after the `created:` line if present, else before the closing ---
        if (/^created:\s*.*$/m.test(newContent)) {
            newContent = newContent.replace(/^(created:\s*.*)$/m, `$1\ncompleted: ${completedIso}`);
        }
        else {
            newContent = newContent.replace(/\n---/, `\ncompleted: ${completedIso}\n---`);
        }
    }
    const title = extractFrontmatterField(content, "title") ?? "";
    const indexLine = JSON.stringify({ id: zetaid, path: toPath, completed: completedIso, title: title.replace(/^"|"$/g, "") }) + "\n";
    return { zetaid, fromPath, toPath, newContent, indexLine };
}
// ── CLI ──────────────────────────────────────────────────────────────────────
/** Resolve a work-item file from a zetaid (glob `<zetaid>-*.md` under dir, recursive)
 *  or an explicit path. */
function resolvePath(arg, dir) {
    if (arg.includes("/") || arg.endsWith(".md")) {
        return existsSync(arg) ? arg : null;
    }
    // treat arg as a zetaid prefix; search dir (active) then done/** recursively
    const hits = [];
    const walk = (d) => {
        if (!existsSync(d))
            return;
        for (const e of readdirSync(d, { withFileTypes: true })) {
            const p = join(d, e.name);
            if (e.isDirectory())
                walk(p);
            else if (e.isFile() && e.name.startsWith(`${arg}-`) && e.name.endsWith(".md"))
                hits.push(p);
        }
    };
    walk(dir);
    return hits.length === 1 ? hits[0] : null;
}
function main(argv) {
    const args = argv.filter((a) => !a.startsWith("--"));
    const flags = new Set(argv.filter((a) => a.startsWith("--")));
    const dirIdx = argv.indexOf("--dir");
    const dir = dirIdx >= 0 ? argv[dirIdx + 1] : "workitems";
    const target = args[0];
    if (!target) {
        process.stderr.write("Usage: bun src/Core.TypeScript/backlog/complete-workitem.ts <zetaid|path> [--dir workitems] [--dry-run]\n");
        return 2;
    }
    const fromPath = resolvePath(target, dir);
    if (!fromPath) {
        process.stderr.write(`complete-workitem: could not uniquely resolve ${JSON.stringify(target)} under ${dir}/\n`);
        return 2;
    }
    const content = readFileSync(fromPath, "utf8");
    let done;
    try {
        done = completeWorkItem(content, fromPath, SYSTEM_ENV);
    }
    catch (e) {
        process.stderr.write(`complete-workitem: ${e.message}\n`);
        return 2;
    }
    if (flags.has("--dry-run")) {
        process.stdout.write(`[dry-run] ${done.fromPath} → ${done.toPath}\n  index += ${done.indexLine}`);
        return 0;
    }
    mkdirSync(dirname(done.toPath), { recursive: true });
    if (existsSync(done.toPath)) {
        process.stderr.write(`complete-workitem: refusing to overwrite existing ${done.toPath}\n`);
        return 2;
    }
    writeFileSync(done.toPath, done.newContent, "utf8");
    rmSync(done.fromPath);
    appendFileSync(join("workitems", "done", "index.jsonl"), done.indexLine, "utf8");
    process.stdout.write(`completed ${done.zetaid}\n  ${done.fromPath} → ${done.toPath}\n`);
    return 0;
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
