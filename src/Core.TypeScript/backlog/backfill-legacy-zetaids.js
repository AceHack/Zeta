#!/usr/bin/env bun
// backfill-legacy-zetaids.ts — one-shot: add a `zetaid:` field to every grandfathered B-NNNN row
// (B-0956 cutover, Aaron 2026-06-06). The B-NNNN stays the human alias / filename / id; the ZetaId makes
// every work-item uniformly 128-bit-addressable (for the git-native G-Set / bus substrate) WITHOUT a
// filename rewrite.
//
// DETERMINISTIC (replayable, no external input): the ZetaId is derived from the row's own data —
//   timestamp = the row's `created:` date (preserves chronological order; falls back to a B-number-derived
//               instant for the ~13 rows lacking `created:`),
//   randomness = a SplitMix64 hash of the B-NNNN id (stable per row),
// packed via the proven ZetaId pack + canonical Crockford-base32 format. Re-running yields identical ids
// (idempotent): if a `zetaid:` is already present it is left as-is unless --force re-derives it.
//
// Usage:
//   bun tools/backlog/backfill-legacy-zetaids.ts            # write
//   bun tools/backlog/backfill-legacy-zetaids.ts --dry-run  # preview counts + samples
//   bun tools/backlog/backfill-legacy-zetaids.ts --force    # re-derive even if zetaid present
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pack } from "../zeta-id/zeta-id";
import { format } from "../zeta-id/encoding";
import { Category, Chromosome, Firefly } from "../zeta-id/types";
const TIERS = ["P0", "P1", "P2", "P3"];
const FALLBACK_BASE = Date.UTC(2026, 0, 1); // for rows lacking `created:` — ordered by B-number
const M64 = 0xffffffffffffffffn;
/** SplitMix64 finalizer on a 64-bit word. */
function mix64(x) {
    let z = x & M64;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & M64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & M64;
    return z ^ (z >> 31n);
}
/** Deterministic 64-bit randomness, stable per B-NNNN. Position-DEPENDENT FNV-1a fold
 *  (each char advances the state through the multiply) so anagram / equal-digit-sum ids —
 *  e.g. B-0308 vs B-0281 — do not collide the way a commutative additive hash would. */
function detRand(s) {
    let z = 0xcbf29ce484222325n; // FNV-1a offset basis
    for (let i = 0; i < s.length; i++) {
        z = (z ^ BigInt(s.charCodeAt(i))) & M64;
        z = (z * 0x100000001b3n) & M64; // FNV prime
    }
    return mix64(z);
}
function field(block, name) {
    const m = block.match(new RegExp(`^${name}:\\s*(.*)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}
/** Deterministic ZetaId for a legacy row, as canonical Crockford base32. */
function legacyZetaId(bnnnn, createdMs) {
    const env = { nextInt64: () => detRand(bnnnn) };
    const obs = {
        version: 1,
        timestamp: createdMs,
        chromosome: Chromosome.MetaCoherence,
        category: Category.WorkItem,
        firefly: Firefly.NoDirective,
        authority: { type: "Standard" },
        persona: 0,
        momentum: { type: "Normal" },
        location: 0,
    };
    return format(pack(obs, env));
}
function timestampFor(id, created) {
    if (created) {
        const t = Date.parse(created);
        if (!Number.isNaN(t))
            return t;
    }
    const num = Number((id.match(/^B-(\d+)/) ?? [])[1] ?? 0); // ordered fallback by B-number
    return FALLBACK_BASE + num * 60_000;
}
function main(argv) {
    const dryRun = argv.includes("--dry-run");
    const force = argv.includes("--force");
    let added = 0;
    let already = 0;
    let noFm = 0;
    const seen = new Map(); // zetaid -> id, collision guard
    const samples = [];
    for (const tier of TIERS) {
        let entries;
        try {
            entries = readdirSync(join("docs/backlog", tier), { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const e of entries) {
            if (!e.isFile() || !e.name.startsWith("B-") || !e.name.endsWith(".md"))
                continue;
            const path = join("docs/backlog", tier, e.name);
            const content = readFileSync(path, "utf8");
            if (!content.startsWith("---")) {
                noFm++;
                continue;
            }
            const end = content.indexOf("\n---", 3);
            const block = content.slice(0, end);
            const id = field(block, "id");
            if (!id) {
                noFm++;
                continue;
            }
            const hasZetaid = /^zetaid:\s*\S/m.test(block);
            if (hasZetaid && !force) {
                already++;
                continue;
            }
            const z = legacyZetaId(id, timestampFor(id, field(block, "created")));
            const prior = seen.get(z);
            if (prior) {
                process.stderr.write(`COLLISION: ${id} and ${prior} → ${z}\n`);
                return 1;
            }
            seen.set(z, id);
            if (samples.length < 5)
                samples.push(`${id} → ${z}`);
            if (!dryRun) {
                const newContent = hasZetaid
                    ? content.replace(/^zetaid:\s*.*$/m, `zetaid: ${z}`)
                    : content.replace(/^(id:\s*.*)$/m, `$1\nzetaid: ${z}`);
                writeFileSync(path, newContent, "utf8");
            }
            added++;
        }
    }
    process.stdout.write(`${dryRun ? "[dry-run] would add" : "added"} zetaid to ${added} rows; ${already} already had one; ${noFm} skipped (no frontmatter/id)\n`);
    for (const s of samples)
        process.stdout.write(`  ${s}\n`);
    return 0;
}
if (import.meta.main)
    process.exit(main(process.argv.slice(2)));
