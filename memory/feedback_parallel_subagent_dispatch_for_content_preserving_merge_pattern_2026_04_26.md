---
name: Parallel-subagent dispatch for content-preserving merge of N divergent files — operational pattern that worked for the 26-file AceHack/LFG fork-sync 2026-04-26; 7 subagents × ~4 files each completed in ~5 min wall-clock with content-preservation verified per file; subagent reports themselves became the substrate documenting judgment calls; safer than `git merge-file --union` (proven lossy) and faster than serial manual merge
description: After `git merge-file --union` failed the preservation requirement (silently dropped 172-line ADR section + 2 of 3 JSONL rows), Aaron picked Strategy A (per-file 3-way merge with content-preservation verification). I dispatched 7 parallel subagents handling ~4 files each. Each subagent: read ours/base/theirs blobs from `/tmp/sync-merge/`; applied content-preservation discipline (preserve all substantive content from both sides; keep both versions where rewritten differently; dedupe identical lines); wrote merged content to `.merged` files; reported judgment calls. All 7 confirmed "no substantive content silently dropped." Wall-clock: ~5 min from dispatch to all reports back. Otto then aggregated, verified load-bearing preservation cases (Blockers section restored, 3 jsonl rows present, BACKLOG unique sections preserved, bash scripts pass syntax check), committed merge with AgencySignature trail. Pattern works; document for future reuse.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

## When to use this pattern

Triggers:

- N divergent files need content-preserving merge (typically N >= 6, where serial work becomes time-expensive)
- Both sides have substantive content the other doesn't have
- Blind merge strategies (`-X theirs`, `-X ours`, `merge-file --union`) are unsafe because preservation is the load-bearing rule
- Aaron has explicitly directed "preserve all content from both sides" or equivalent
- Each file's resolution requires judgment calls that benefit from focused per-file attention

Counter-indications:

- N < 6: serial Otto execution is faster than dispatch overhead
- Files are all code (executable scripts) where one canonical wins per file: pick-canonical is correct, not union
- Files require coordinated cross-file reasoning (e.g., a refactor that touches several files together): subagents lose context between files

## The pattern (operational steps)

1. **Stage blobs** in a temp directory: for each conflicting file `<path>`, save `<safe_path>.ours`, `<safe_path>.base`, `<safe_path>.theirs` to `/tmp/sync-merge/` (replace `/` with `_` in path for safe filename).

   ```bash
   mkdir -p /tmp/sync-merge
   base_ref="$(git merge-base ours_ref theirs_ref)"
   while IFS= read -r f; do
     safe="$(printf '%s' "$f" | tr '/' '_')"
     git show ours_ref:"$f" > "/tmp/sync-merge/${safe}.ours" 2>/dev/null || true
     git show theirs_ref:"$f" > "/tmp/sync-merge/${safe}.theirs" 2>/dev/null || true
     git show "$base_ref":"$f" > "/tmp/sync-merge/${safe}.base" 2>/dev/null || true
   done < /tmp/conflicts.txt
   ```

2. **Group files by class** (skills / docs / drafts / tools / append-only-logs / decisions / security). Each group becomes one subagent's batch. Aim for ~4 files per group; 7 groups handles up to ~28 files.

3. **Dispatch parallel subagents** in a SINGLE Agent tool call message (multiple tool calls in one message run in parallel). Each subagent prompt includes:
   - The preservation rule (LOAD-BEARING)
   - File-class-specific guidance (e.g., "for SKILL.md, preserve all sections from both sides; for JSONL, dedup-by-key + sort")
   - File list with absolute blob paths
   - Output destination (`/tmp/sync-merge/<safe>.merged`)
   - Required report content (line counts, judgment calls, preservation evidence)

4. **Aggregate**: copy each `.merged` file to its target path in the working tree; `git add` each.

   ```bash
   while IFS= read -r f; do
     safe="$(printf '%s' "$f" | tr '/' '_')"
     cp "/tmp/sync-merge/${safe}.merged" "$f"
     git add "$f"
   done < /tmp/conflicts.txt
   ```

5. **Verify load-bearing preservation cases** before commit. Spot-check:
   - Critical sections from each side are present (`grep -c "<key phrase>"`)
   - Append-only logs have all rows from both sides
   - Bash scripts pass `bash -n` syntax check
   - Markdown files don't have orphaned merge markers (`<<<<<<<`, `=======`, `>>>>>>>`)

6. **Commit with AgencySignature trail** documenting subagent reports + per-file judgment calls. Include verification evidence in the Proof: section.

## Subagent prompt template (load-bearing)

```text
You are merging files for [CONTEXT] with strict content-preservation discipline.

CONTEXT: [Aaron's directive + reason]

PRESERVATION RULE (LOAD-BEARING): your merged output must contain ALL
substantive content from BOTH ours and theirs. When the same paragraph
was rewritten differently on both sides, keep BOTH versions side-by-side.
When content is identical between sides, deduplicate to one copy. Never
silently drop content.

FILES TO MERGE (N):
1. <path1>
   ours:   /tmp/sync-merge/<safe1>.ours
   base:   /tmp/sync-merge/<safe1>.base
   theirs: /tmp/sync-merge/<safe1>.theirs
[...]

FOR EACH FILE:
1. Read all 3 blobs
2. Identify what each side added/modified/deleted relative to base
3. Compose merged content preserving ALL substantive content
4. [File-class-specific guidance]
5. Write merged content to /tmp/sync-merge/<safeN>.merged
6. Verify by spot-checking key sections from BOTH sides are present

REPORT BACK (under [400-500] words):
- Files merged: [count]
- ours/theirs/merged line counts per file
- Judgment calls (e.g., "ours and theirs both had X but different content; I kept both with markers")
- Identical content deduplicated
- Confirmation: no substantive content silently dropped
```

## File-class-specific guidance

| File class | Preservation strategy | Subagent hint |
|---|---|---|
| SKILL.md | Operational instructions; preserve all sections | "If both sides have a 'when to wear' section with different criteria, KEEP ALL criteria" |
| ADR / DECISION | Architectural records; preserve all rationale | "If one side added a section the other lacks, preserve the addition; verify by grep" |
| BACKLOG row-list | Append-only; preserve all rows | "Union of rows; resolve duplicates only when truly identical" |
| Marketing drafts | Both versions kept as drafts | "Keep both with date-stamped or AceHack/LFG markers" |
| Research notes | Append-only research findings | "Preserve all observations; both sides' findings are valid" |
| Hygiene rows | Numbered list of hygiene rules | "Preserve all rows from both sides; renumber if needed" |
| Tick-history table | Append-only row log | "Concat all rows; dedup by row identifier; preserve order" |
| Append-only JSONL | One JSON per line | "concat + jq dedup-by-ts + sort_by(.ts)" |
| Bash scripts (.sh) | Single executable | "Pick newer/canonical OR if both added new flags/functions keep both; verify with bash -n" |
| Configuration | Pattern lists, exclusions | "Union the patterns; dedupe identical lines" |

## Performance

For the 2026-04-26 sync (26 files, mixed file classes):

- **Wall-clock dispatch-to-aggregate**: ~5 minutes
- **Subagent task durations**:
  - Group 1 (3 files, skills+gitignore): 171s
  - Group 2 (4 files, agent docs): 174s
  - Group 3 (4 files, BACKLOG+hygiene): 254s
  - Group 4 (3 files, decisions+upstream): 617s (the heaviest because of Blockers-section restoration)
  - Group 5 (3 files, marketing): 321s
  - Group 6 (4 files, research+security): 113s
  - Group 7 (5 files, ops+budget): 217s
- **Total subagent compute**: ~30 min serial; **parallel wall-clock** ~10 min
- **Otto verification + commit**: ~3 min after subagents reported

Compared to:

- **Serial Otto manual merge**: ~30-60 min wall-clock per Aaron's earlier estimate
- **Blind `git merge-file --union`**: ~10 sec but UNSAFE (proven lossy)

## Risk mitigations

1. **Subagent inconsistency**: each subagent handles different files independently; reports document judgment calls for Otto verification.
2. **Subagent silent loss**: prompt requires explicit "no substantive content silently dropped" confirmation; Otto verifies load-bearing cases (key phrases, section counts, row counts).
3. **Subagent context overflow**: file-class grouping keeps each subagent focused; ~4 files per group fits comfortably.
4. **Output file path conflicts**: standardized `/tmp/sync-merge/<safe>.merged` naming prevents collision.
5. **Subagent crash mid-batch**: if a subagent fails to produce all `.merged` files, Otto detects on aggregation step (skipped count > 0); can re-dispatch missing files.

## Composes with

- **Otto-220** (don't lose substrate) — the load-bearing rule the pattern enforces
- **Otto-227** (verbatim signal-in-signal-out absorb) — applied to merge-time content preservation
- **Otto-275-FOREVER** (bounded perfectionism) — pattern is bounded enough to be tractable; sub-agent dispatch keeps scope manageable
- **Otto-294** (antifragile-cross-substrate-review) — multiple subagents are themselves a cross-review form
- **Otto-347** (2nd-agent verify) — Otto's verification step on subagent output is the 2nd-agent check applied to merge work
- **`feedback_git_merge_file_union_is_not_set_union_can_lose_content_2026_04_26.md`** — sibling memory naming the pattern this replaces
- **The Substrate Truth Principle** (AgencySignature ferry-16 maxim) — the parser is the witness for trailers; subagent reports + Otto's verification spot-checks are the witness for content preservation
- **`superpowers:dispatching-parallel-agents` skill** — the meta-pattern this is an instance of

## When NOT to use this pattern

- For files where pick-canonical is correct (single executable code; one canonical wins): subagents add overhead without benefit
- For tightly-coupled cross-file refactors: subagents can't see each other's work
- For < 6 files: serial Otto execution is faster
- For files where Aaron explicitly wants per-file substrate-author judgment: pre-empts Otto's full-execution authorization

## Direct evidence from the 2026-04-26 application

All 7 subagent reports confirmed "no substantive content silently dropped." Spot-checks Otto ran:

- ADR Blockers section (172 lines): **RESTORED** (was lost by blind union)
- snapshots.jsonl: **3 rows preserved** (was 1 after blind union)
- BACKLOG unique sections (4 spot-checked): **all present**
- Bash scripts: **both pass `bash -n`**
- Hygiene rows: FACTORY-HYGIENE.md base rows 39/40/41 (which ours had silently dropped in earlier renumber): **RESTORED**
- Marketing drafts: **both attribution variants preserved as inline alternates**

Pattern produced PR #26 (sync: full reconciliation) which passed BACKLOG drift check + MEMORY.md reference-existence check on first run.

## Future-Otto reuse

Reach for this pattern when:

1. Aaron directs "merge everything" / "both all" / "preserve content"
2. The conflict count is moderate (6-30 files)
3. File classes are diverse (mixed docs, code, drafts, logs)
4. Time pressure is moderate (need it done in this session, not over multiple ticks)

Adapt the file-class table for new classes encountered. Each successful application adds evidence the pattern is generalizable.
