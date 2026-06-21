#!/usr/bin/env bun
// lint-no-new-bnnnn.ts — the cutover guard for the B-0956 ZetaId migration.
//
// THE RULE (Aaron 2026-06-06, "how will you remember to stop creating them like the old backlog?"):
// `docs/backlog/` is FROZEN to the grandfathered B-NNNN rows. The sequential `B-NNNN` scheme requires
// cross-agent consensus to allocate the next number — exactly the does-not-scale pain B-0956 removes. So
// NEW work-items must be minted as conflict-free ZetaIds via `tools/backlog/new-workitem.ts` (→
// `workitems/<zetaid>-<desc>.md`), NOT added as new `docs/backlog/P*/B-NNNN-*.md` files.
//
// THE WALL (Aaron 2026-06-11, "I had someone rename all these to the zetaids so the AIs would stop
// creating more — we said stop a long time ago"): the 2026-06-11 rename sweep (#7840-#7843 + the
// workitems migration) drove the B-named file set to ZERO, and the original toll-booth design had
// demonstrably failed — the "rare, deliberate" bump procedure was used ROUTINELY (five consecutive
// "grandfather B-10XX" commits; B-1036..B-1040 minted after the stop was called). So the check is
// now a wall: ANY file named `B-<digits>*` under docs/backlog/ or workitems/ FAILS, regardless of
// frontmatter — post-sweep, a B-named file is by definition new. There is no bump procedure.
// frozen-bnnnn-ids.json stays as the historical record of the closed series (and so legacy `id:`
// references in old rows remain resolvable), but it no longer grants passage.
//
// Exit: 0 = no new B-NNNN ids · 1 = new B-NNNN id(s) found.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
function repoRoot() {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
    return r.status === 0 ? r.stdout.trim() : process.cwd();
}
function main() {
    const root = repoRoot();
    const frozenPath = join(root, "src", "Core.TypeScript", "backlog", "frozen-bnnnn-ids.json");
    if (!existsSync(frozenPath)) {
        process.stderr.write(`ERROR: frozen snapshot missing: ${frozenPath}\n`);
        return 1;
    }
    const frozen = new Set(JSON.parse(readFileSync(frozenPath, "utf8")));
    const offenders = [];
    const dirs = [
        ...["P0", "P1", "P2", "P3"].map((tier) => join(root, "docs", "backlog", tier)),
        join(root, "workitems"),
    ];
    for (const dir of dirs) {
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const e of entries) {
            // THE WALL: a B-named FILE fails outright — the series is closed and the sweep already
            // renamed every legacy row, so there is nothing left to grandfather. Frontmatter is not
            // consulted (the old id-only check let id-less B-files through silently).
            if (e.isFile() && /^B-\d/.test(e.name))
                offenders.push(join(dir, e.name).slice(root.length + 1));
        }
    }
    if (offenders.length === 0) {
        process.stdout.write(`ok: the B-NNNN series is closed — 0 B-named files under docs/backlog/ + workitems/ (${frozen.size} legacy ids live on as zetaid-named rows)\n`);
        return 0;
    }
    process.stderr.write(`FAIL: ${offenders.length} B-named file(s) — THE B-NNNN SERIES IS CLOSED (2026-06-11 sweep).\n`);
    for (const o of offenders)
        process.stderr.write(`  - ${o}\n`);
    process.stderr.write("\nNew work-items must be minted as conflict-free ZetaIds:\n" +
        '  bun src/Core.TypeScript/backlog/new-workitem.ts --type task|bug --title "..."\n' +
        "(→ workitems/<zetaid>-<desc>.md; no cross-agent id consensus — B-0956).\n" +
        "There is no grandfather/bump path: rename the file to its zetaid form instead.\n");
    return 1;
}
if (import.meta.main)
    process.exit(main());
