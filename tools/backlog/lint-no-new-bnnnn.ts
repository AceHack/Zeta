#!/usr/bin/env bun
// lint-no-new-bnnnn.ts — the cutover guard for the B-0956 ZetaId migration.
//
// THE RULE (Aaron 2026-06-06, "how will you remember to stop creating them like the old backlog?"):
// `docs/backlog/` is FROZEN to the grandfathered B-NNNN rows. The sequential `B-NNNN` scheme requires
// cross-agent consensus to allocate the next number — exactly the does-not-scale pain B-0956 removes. So
// NEW work-items must be minted as conflict-free ZetaIds via `tools/backlog/new-workitem.ts` (→
// `workitems/<zetaid>-<desc>.md`), NOT added as new `docs/backlog/P*/B-NNNN-*.md` files.
//
// This lint fails if any `docs/backlog/P*/B-*.md` carries a frontmatter `id:` that is NOT in the frozen
// snapshot (`frozen-bnnnn-ids.json`). Removing/closing a grandfathered row is fine (no new id); only
// ADDING a new B-NNNN id fails. That's the mechanical "remember to stop" — an agent reaching for the old
// habit gets a red gate pointing at new-workitem.ts.
//
// Bump procedure (rare, deliberate): if a legacy B-NNNN row genuinely must be added/renumbered,
// update frozen-bnnnn-ids.json in the same commit — making the exception explicit + reviewable.
// Do not use that path for normal work; ZetaIds/workitems are the backlog/workitem substrate.
//
// Exit: 0 = no new B-NNNN ids · 1 = new B-NNNN id(s) found.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : process.cwd();
}

function frontmatterId(content: string): string | null {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  const block = end > 0 ? content.slice(0, end) : content;
  const m = block.match(/^id:\s*(.*)$/m);
  return m ? m[1]!.trim().replace(/^["']|["']$/g, "") : null;
}

function main(): number {
  const root = repoRoot();
  const frozenPath = join(root, "tools", "backlog", "frozen-bnnnn-ids.json");
  if (!existsSync(frozenPath)) {
    process.stderr.write(`ERROR: frozen snapshot missing: ${frozenPath}\n`);
    return 1;
  }
  const frozen = new Set<string>(JSON.parse(readFileSync(frozenPath, "utf8")) as string[]);

  const offenders: string[] = [];
  for (const tier of ["P0", "P1", "P2", "P3"]) {
    const dir = join(root, "docs", "backlog", tier);
    let entries: readonly import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isFile() || !e.name.startsWith("B-") || !e.name.endsWith(".md")) continue;
      const id = frontmatterId(readFileSync(join(dir, e.name), "utf8"));
      if (id && !frozen.has(id)) offenders.push(`${tier}/${e.name} (id ${id})`);
    }
  }

  if (offenders.length === 0) {
    process.stdout.write(
      `ok: legacy docs/backlog/ frozen — no new B-NNNN ids beyond the ${frozen.size} grandfathered rows\n`,
    );
    return 0;
  }
  process.stderr.write(`FAIL: ${offenders.length} NEW B-NNNN row(s) — docs/backlog/ is FROZEN.\n`);
  for (const o of offenders) process.stderr.write(`  - ${o}\n`);
  process.stderr.write(
    "\nNew work-items must be minted as conflict-free ZetaIds:\n" +
      '  bun tools/backlog/new-workitem.ts --type task|bug --title "..."\n' +
      "(→ workitems/<zetaid>-<desc>.md; no cross-agent id consensus — B-0956). If a legacy B-NNNN row\n" +
      "genuinely must be added, update tools/backlog/frozen-bnnnn-ids.json in the same commit.\n",
  );
  return 1;
}

if (import.meta.main) process.exit(main());
