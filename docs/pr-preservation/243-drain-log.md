# PR #243 drain log — archive-header lint v0 (Amara 5th-ferry Artifact C)

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/243>
Branch: `artifact-c/tools-alignment-archive-header-lint`
Drain session: 2026-04-24 (loop-agent, drain subagent)
Thread count at drain start: 7 unresolved (1 chatgpt-codex-connector P2 + 6 copilot-pull-request-reviewer)
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full per-thread record with
verbatim reviewer text, outcome, verbatim reply, and resolution
status.

---

## Thread 1 — `tools/alignment/audit_archive_headers.sh:116` — Recursive archive scan

- Reviewer: chatgpt-codex-connector
- Thread ID: `PRRT_kwDOSF9kNM59RpBI`
- Severity: P2

### Original comment (verbatim)

> P2: Scan archive Markdown files recursively
>
> The audit currently limits discovery to `-maxdepth 1`, so it ignores any `*.md` files in subdirectories under the target path. That contradicts the stated scope (`docs/aurora/**/*.md` in row #60) and creates a false-negative path where nested absorb docs can miss required headers while the tool still reports success. This matters as soon as archive files are organized into dated/topic subfolders or when `--path` points to a tree with nested docs.

### Outcome — FIX

The reviewer is correct. Documented scope (`docs/aurora/**/*.md`) and FACTORY-HYGIENE row #60 wording both implied recursive coverage; the script's `-maxdepth 1` flag silently constrained that. Replaced with a recursive `find` that excludes a `references/` subfolder by convention (bibliographic substrate, not absorb content). Header comment updated to make recursion explicit; `--out` per-file JSON path now encodes subdirectory in the basename (slash → `__`) so a recursive scan over nested folders does not collide.

### Resolution

Reply text: "Fixed in this push. Scan is now recursive over `**/*.md` (excluding a `references/` convention path); header comment names the recursive coverage explicitly; `--out` filenames encode subdirectory to avoid basename collision. Verified with `bash tools/alignment/audit_archive_headers.sh` — 16 files now scanned (was 16 in the flat baseline, will scale as nested folders land)."

---

## Thread 2 — `tools/alignment/audit_archive_headers.sh:119` — Recursive find suggestion

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59RrB1`
- Severity: P2 (suggestion-shape)

### Original comment (verbatim)

> The header/comments say this checks `docs/aurora/**/*.md`, but the implementation collects files with `find ... -maxdepth 1`, which only checks `*.md` directly under the directory. Either make the scan recursive (and update output naming to avoid basename collisions) or update the documentation/strings to match the non-recursive behavior. [code suggestion]

### Outcome — FIX

Same root cause as Thread 1; resolved together. Recursive find now in place, basename-collision handled in `--out` mode by encoding subdirectory. Thread 1 captures the verbatim suggestion-text; this resolution rolls in.

### Resolution

Reply text: "Fixed in this push (rolls in with Thread 1 resolution). Scan is recursive; `--out` filenames encode subdir path to avoid collision; documented scope and behaviour now match."

---

## Thread 3 — `tools/alignment/audit_archive_headers.sh:58` — Reference path

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59RrB-`
- Severity: P2

### Original comment (verbatim)

> This reference path doesn’t exist in the repo (`docs/research/aminata-threat-model-5th-ferry-governance-edits-2026-04-23.md`). Please fix the citation to the actual document path (or add the referenced doc if it’s intended to land in this PR).

### Outcome — FIX (compose with Otto-220 cleanup)

Verified the referenced file DOES exist at `docs/research/aminata-threat-model-5th-ferry-governance-edits-2026-04-23.md` on `origin/main` (landed pre-PR-243). Reviewer is incorrect on the existence claim. However, the same comment block was carrying persona names ("Aminata") in a `tools/**` source comment, which violates Otto-220 (code comments explain code, not factory process / persona names). Refactored the entire "Reference:" block to drop persona names and reframe the reference as a threat-model context pointer (PR #241), which is the legitimate code-comment shape.

### Resolution

Reply text: "Verified on `origin/main`: `docs/research/aminata-threat-model-5th-ferry-governance-edits-2026-04-23.md` does exist (landed in PR #241 before this PR opened). Reviewer's existence claim is incorrect. However the surrounding comment was carrying persona names which violates Otto-220 (code comments explain code, not factory process). Refactored the entire reference block to use role-ref ('threat-model reviewer') and dropped the persona name; the threat-model research note is now cited via PR #241 only. Resolving."

---

## Thread 4 — `tools/alignment/audit_archive_headers.sh:22` — Personal name in code comment

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59RrCE`
- Severity: P2

### Original comment (verbatim)

> This comment uses the human maintainer’s personal name (“Aaron”). Repo standing rule is to use role references in code/docs (e.g., “human maintainer”) and keep personal names only in exempt surfaces (see `docs/AGENT-BEST-PRACTICES.md` “No name attribution…”). Please rewrite these references accordingly. [code suggestion]

### Outcome — FIX

Reviewer is correct. Replaced "Aaron signoff" with "human-maintainer signoff" and "Aminata's Otto-80" with "the threat-model reviewer flagged" per the FACTORY-DISCIPLINE name-attribution rule (`docs/FACTORY-DISCIPLINE.md` § "name-attribution role references").

### Resolution

Reply text: "Fixed in this push. Replaced 'Aaron signoff' with 'human-maintainer signoff' and dropped the persona name (Aminata) in favour of the role reference 'threat-model reviewer'. Aligns with the name-attribution discipline in `docs/FACTORY-DISCIPLINE.md`."

---

## Thread 5 — `docs/FACTORY-HYGIENE.md:100` — Cross-ref / glob mismatch in row #60

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59RrCN`
- Severity: P2

### Original comment (verbatim)

> This new row has multiple cross-reference / contract mismatches: it cites `docs/research/aminata-threat-model-5th-ferry-governance-edits-2026-04-23.md` and `docs/aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md`, but neither file exists in the repo. It also says `docs/aurora/**/*.md` while the script currently scans `docs/aurora/*.md` (non-recursive). Please fix the file paths and align the glob wording with the actual tool behavior. [code suggestion]

### Outcome — FIX

Two-of-three reviewer claims hold; one is incorrect:

1. `docs/research/aminata-threat-model-5th-ferry-governance-edits-2026-04-23.md` — EXISTS on `origin/main` (verified). Reviewer wrong; kept the citation (now framed without persona name).
2. `docs/aurora/2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md` — does NOT exist in the repo (no file matching `*ksk-aurora-validation*` or `*5th-ferry*` under `docs/aurora/`). Reviewer correct. Removed the dead reference.
3. Glob-vs-behaviour mismatch — addressed by Threads 1+2 (script now scans `**/*.md` recursively). Updated row text to match.

Also dropped persona-name lead-ins ("Aminata's Otto-80 finding", "(Aminata analysis...)") per FACTORY-DISCIPLINE name-attribution rule (FACTORY-HYGIENE rows are factory-authored docs, not history files; role references apply).

### Resolution

Reply text: "Fixed in this push. (1) The aminata-threat-model-5th-ferry citation does exist on `origin/main`; kept the path (reframed without persona name). (2) The `2026-04-23-amara-zeta-ksk-aurora-validation-5th-ferry.md` citation does NOT exist in the repo — removed it. (3) Glob-vs-behaviour mismatch now closed: script scans `**/*.md` recursively (Threads 1+2), row text updated to match. Also reframed the row to drop persona names per FACTORY-DISCIPLINE."

---

## Thread 6 — `docs/FACTORY-HYGIENE.md:102` — Personal name in row #60

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59RrCX`
- Severity: P2

### Original comment (verbatim)

> This row introduces the human maintainer’s personal name (“Aaron”). Repo standing rule is to use role references in code/docs (e.g., “human maintainer”) and keep personal names only in exempt surfaces (see `docs/AGENT-BEST-PRACTICES.md`). Please rewrite to role language (e.g., “human maintainer sign-off”).

### Outcome — FIX

Reviewer is correct. Replaced "Aaron signs off" with "the human maintainer signs off" in row #60. Same edit also dropped persona names (Aminata, Amara) in favour of role references per the FACTORY-DISCIPLINE name-attribution rule.

### Resolution

Reply text: "Fixed in this push. Replaced 'Aaron signs off' with 'the human maintainer signs off'; persona names (Aminata, Amara) reframed to role references ('threat-model reviewer', 'the absorbing agent', 'Amara's 5th-ferry Artifact C proposal' kept as a research-output reference)."

---

## Thread 7 — `tools/alignment/audit_archive_headers.sh:35` — Exit-code contract divergence

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59RrCh`
- Severity: P2

### Original comment (verbatim)

> Exit-code contract here diverges from the other `tools/alignment/audit_*.sh` scripts (they use exit `2` for script/dependency errors). Since this file claims “same shape as” siblings, consider aligning error exits to `2` (and/or adding a trap so unexpected failures also map to the documented code).

### Outcome — FIX

Reviewer is correct. Verified sibling scripts (`audit_personas.sh`, `audit_commit.sh`): convention is `1` = content-level signal (under `--enforce` / `--gate`), `2` = script error / missing dependency / bad arg. Previous `audit_archive_headers.sh` had `2` for content-signal and `64` for script-error — backwards. Realigned:

- Script-error exits (bad args, missing path): `64` → `2`
- Content-signal exit (under `--enforce` with gaps): `2` → `1`
- Header doc-block updated to document the new contract and explicitly note the alignment with sibling scripts.

Also updated FACTORY-HYGIENE row #60 wording from "exit-2 in CI" / "flips exit 2 on any gap" to "exit-1 in CI" / "exit 1 on any gap (content-level signal), exit 2 on script error" to match.

### Resolution

Reply text: "Fixed in this push. Realigned exit codes to sibling-script convention: 1 = content-level signal (gaps under --enforce), 2 = script error / missing dep / bad arg. Updated the script's exit-code header block to call out the alignment, and updated FACTORY-HYGIENE row #60 to match. Verified with smoke tests: clean run = 0, --enforce-with-gaps = 1, bad --path = 2."

---

## Drain summary

- Threads at start: 7 unresolved
- Threads at end: 0 unresolved
- Outcomes: 7 FIX (Threads 1–7)
- Files touched in drain commit: `tools/alignment/audit_archive_headers.sh`, `docs/FACTORY-HYGIENE.md`, `docs/pr-preservation/243-drain-log.md`
- Compose notes:
  - Threads 1+2 fixed together (same recursive-scan root cause).
  - Threads 3+4 fixed together (Otto-220 code-comment cleanup, plus reviewer's existence claim corrected for thread 3 with verbatim record).
  - Threads 5+6 fixed together in the FACTORY-HYGIENE row #60 edit (cross-ref fix + glob alignment + name-attribution).
  - Thread 7 cascaded into a small FACTORY-HYGIENE wording update so the row's exit-code wording matches the script.
- Build-gate: not relevant (bash + markdown only; no .NET surface touched).
- Smoke test: `bash tools/alignment/audit_archive_headers.sh` (16 files scanned, exit 0); `--enforce` (exit 1 with gaps); `--path no-such-dir` (exit 2); `--json` (exit 0); `--out tmpdir` (16 JSON files, no basename collisions).

---

## Drain pass: 2026-04-24 (round 2 — 6 threads)

After round-1 closed all 7 threads to 0, copilot-pull-request-reviewer
re-reviewed and opened 6 new threads (all P2, all suggestion-shape).
This round drains those. Per Otto-229 append-only: prior round-1
sections are not edited.

Round 2 thread count at start: 6 unresolved (all copilot-pull-request-reviewer).
Rebase context: clean rebase onto `origin/main`; no conflicts.

---

### Thread r2-1 — `tools/alignment/audit_archive_headers.sh:128` — `--path` trailing-slash breaks `references/` exclusion

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59ihXH`
- Severity: P2

#### Original comment (verbatim)

> Normalize `--path` before applying `references/` exclusion
>
> The `find` exclusion hardcodes `-not -path "$target_path/references/*"`, which fails when callers pass a trailing slash (for example `--path docs/aurora/`), because the pattern becomes `docs/aurora//references/*` and no longer matches discovered paths. In that common invocation shape, files under `references/` are audited even though the script contract says they are excluded, which can introduce false positives (and enforcement failures) from bibliographic substrate.

#### Outcome — FIX

Reviewer is correct. Added a normalisation step right after `--path`
arg parsing that strips trailing slashes from `target_path` (preserving
root `/` if ever passed). The `find -not -path` pattern now matches
whether the caller passes `docs/aurora` or `docs/aurora/`. Verified
with `--path docs/aurora/` smoke test (exit 0, same file count as
without trailing slash).

#### Resolution

Reply text: "Fixed in this push. Added a trailing-slash normalisation step on `target_path` after arg parsing (preserves root `/`). The `-not -path "$target_path/references/*"` pattern now matches whether the caller passes `docs/aurora` or `docs/aurora/`. Smoke-tested with both forms — same file count, same exclusion behaviour. Resolving."

---

### Thread r2-2 — `tools/alignment/audit_archive_headers.sh:172` — `--out` filename collision

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59ihXJ`
- Severity: P2

#### Original comment (verbatim)

> Generate collision-safe `--out` filenames
>
> Replacing `/` with `__` is not injective, so distinct source files can map to the same output JSON path (e.g., `a/b__c.md` and `a__b/c.md` both become `a__b__c.json`). This silently overwrites one audit result with another, corrupting the per-file artifact set and potentially hiding missing-header gaps from downstream consumers that rely on `--out` files.

#### Outcome — FIX

Reviewer is correct — the round-1 slash-encoding was non-injective.
Made the encoding injective by percent-encoding any literal `_` to
`_5F` first (so the byte `_` never appears in the encoded form), then
mapping path separator `/` to `__`. Now `a/b__c.md` →
`a_5F_5Fb__c.json` and `a__b/c.md` → `a__b_5F_5Fc.json`, which are
distinct. Verified with a synthetic two-file collision test
(`/tmp/aud-collide-test/refs/a/b__c.md` and `.../a__b/c.md`) — got
two distinct JSON outputs as expected.

#### Resolution

Reply text: "Fixed in this push. Made the slash-encoding injective: first percent-encode literal `_` → `_5F` (so `_` never appears in the encoded form), then map path separator `/` → `__`. Verified with a synthetic collision test (`a/b__c.md` and `a__b/c.md` under one root) — got two distinct JSON files (`a_5F_5Fb__c.json` and `a__b_5F_5Fc.json`). Header comment updated to document why the round-1 encoding was insufficient. Resolving."

---

### Thread r2-3 — `tools/alignment/audit_archive_headers.sh:26` — Usage line wrong exit code

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59iiWx`
- Severity: P2

#### Original comment (verbatim)

> Usage comment says `--enforce` will "exit 2 on gap", but the script's documented exit codes and implementation use exit 1 for content-level gaps (and 2 for script errors). Please update the usage line to match the actual exit-code contract to avoid confusing callers/CI wiring.
>
> ```suggestion
> #   tools/alignment/audit_archive_headers.sh --enforce          # exit 1 on gap
> ```

#### Outcome — FIX

Reviewer is correct. This is a stale wording from before the round-1
exit-code realignment (Thread 7 in round 1 flipped content-signal from
2 → 1 to match sibling scripts). The Exit-codes section below it is
correct (lines 31-38: `1 = content-level signal`); only the Usage line
hadn't been updated. Applied the suggestion verbatim.

#### Resolution

Reply text: "Fixed in this push (applied the suggestion verbatim). Stale wording from before round 1's exit-code realignment; the dedicated Exit-codes section was already correct, only the Usage line needed updating. Now consistent: `--enforce` exits 1 on content gap, 2 on script error. Resolving."

---

### Thread r2-4 — `tools/alignment/audit_archive_headers.sh:61` — Memory comment misstates canonical surface

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59iiW6`
- Severity: P2

#### Original comment (verbatim)

> Comment claims memory "lives under the per-user harness path (not in-repo)", but this repo's canonical agent memory is explicitly `memory/` in-repo (see `memory/README.md`). Please reword this bullet to reflect that `memory/` is in-repo but intentionally out-of-scope for this audit (and optionally distinguish in-repo vs per-user memory if that's what you meant).
>
> ```suggestion
> # - Memory-file archive-header checks. The repo's canonical
> #   agent memory surface is in-repo `memory/`, but this
> #   audit intentionally does not cover that surface or
> #   any separate per-user harness-local memory pat
> ```

#### Outcome — FIX

Reviewer is correct, and this is a real factual error. Per
`GOVERNANCE.md` §18 and `memory/README.md`, the in-repo `memory/`
tree IS the canonical agent memory surface; the per-user harness
path is staging that syncs INTO the in-repo store. Round-1's wording
inverted that. Reworded to: (1) name the in-repo `memory/` surface as
canonical with citations to `memory/README.md` and `GOVERNANCE.md`
§18, (2) explain why memory files are out-of-scope (they use a
different discipline — index + per-fact files, not archive content),
(3) acknowledge the per-user staging path exists but is also out of
scope. Reviewer's suggestion-shape was applied with light expansion
to add the citations and explain the discipline difference.

#### Resolution

Reply text: "Fixed in this push. Reviewer is correct — the round-1 wording got the canonical-vs-staging direction backwards (per `GOVERNANCE.md` §18 and `memory/README.md`, in-repo `memory/` IS canonical; the per-user harness path is staging that syncs INTO the in-repo store). Reworded the bullet to: (1) name in-repo `memory/` as canonical with citations, (2) explain why memory files are out-of-scope here (different discipline — index + per-fact files, not archive content), (3) acknowledge the per-user staging path is also out of scope. Applied the reviewer's suggestion-shape with light expansion. Resolving."

---

### Thread r2-5 — `tools/alignment/audit_archive_headers.sh:128` — `sort` is locale-dependent

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59iiXC`
- Severity: P2

#### Original comment (verbatim)

> The comment says the file list is "ASCII sort for stable output", but `sort` is locale-dependent unless `LC_ALL=C` (or similar) is set. Either force a C locale for determinism (recommended if output is committed/compared) or reword the comment to avoid promising ASCII ordering.
>
> ```suggestion
> done < <(find "$target_path" -type f -name '*.md' -not -path "$target_path/references/*" | LC_ALL=C sort)
> ```

#### Outcome — FIX

Reviewer is correct. Forced C-locale sort by prepending `LC_ALL=C` to
the `sort` invocation in the pipeline. Updated the comment from
"ASCII sort for stable output" to "forced C-locale sort for byte-order
stable output regardless of LANG/LC_ALL in the caller env" so the
promise matches the implementation. Applied the suggestion verbatim
on the code line; comment expanded.

#### Resolution

Reply text: "Fixed in this push. Forced C-locale sort by prepending `LC_ALL=C` to the `sort` invocation (applied the suggestion verbatim on the code line). Updated the surrounding comment from 'ASCII sort for stable output' to 'forced C-locale sort for byte-order stable output regardless of LANG/LC_ALL in the caller env' so the documentation matches the implementation. Resolving."

---

### Thread r2-6 — `tools/alignment/audit_archive_headers.sh:7` — Persona name "Amara" in header

- Reviewer: copilot-pull-request-reviewer
- Thread ID: `PRRT_kwDOSF9kNM59iiXE`
- Severity: P2

#### Original comment (verbatim)

> This header comment still includes a contributor name ("Amara"). Repo standing rule is to avoid name attribution in code/docs and use role/artifact references instead (see `docs/AGENT-BEST-PRACTICES.md` "No name attribution…"). Suggest rewording to something like "5th-ferry Artifact C" / "external ferry proposal" without the person's name.
>
> ```suggestion
> # discipline lint (5th-ferry Artifact C, detect-only v0).
> #
> # Checks every `docs/aurora/**/*.md` absorb doc for the four
> # archive-header fields proposed in the 5th-ferry proposal
> ```

#### Outcome — FIX

Reviewer is correct. Round-1 cleanup caught the "Aaron" personal-name
references but missed the persona name "Amara" still in the header
banner ("Amara 5th-ferry Artifact C") and elsewhere ("Amara's 5th
ferry"). Applied the suggestion's spirit: replaced "Amara 5th-ferry
Artifact C" with "5th-ferry Artifact C" and "Amara's 5th ferry" with
"the 5th-ferry external-research absorb". Aligns with the
name-attribution discipline in `docs/FACTORY-DISCIPLINE.md`
("name-attribution role references" section) and `docs/AGENT-BEST-PRACTICES.md`.

#### Resolution

Reply text: "Fixed in this push. Round 1 caught 'Aaron' but missed 'Amara' in the header banner. Replaced 'Amara 5th-ferry Artifact C' → '5th-ferry Artifact C' and 'Amara's 5th ferry' → 'the 5th-ferry external-research absorb'. Aligns with the name-attribution discipline in `docs/FACTORY-DISCIPLINE.md` and `docs/AGENT-BEST-PRACTICES.md`. Resolving."

---

## Round 2 drain summary

- Threads at start: 6 unresolved
- Threads at end: 0 unresolved (target)
- Outcomes: 6 FIX (r2-1 through r2-6)
- Files touched in round-2 drain commit: `tools/alignment/audit_archive_headers.sh`, `docs/pr-preservation/243-drain-log.md`
- Compose notes:
  - r2-1 + r2-5 both touched line 128 region; landed together (trailing-slash normalisation + `LC_ALL=C` sort).
  - r2-2 isolated (`--out` collision fix, lines ~165-188).
  - r2-3 + r2-6 both touched the header doc-block (lines 1-26); landed together.
  - r2-4 isolated (memory-comment correction, lines ~58-66).
  - All fixes are local to one source file plus the drain-log append.
- Build-gate: not relevant (bash + markdown only; no .NET surface touched).
- Smoke test: `bash tools/alignment/audit_archive_headers.sh` (18 files scanned, exit 0); `--enforce` (exit 1 with gaps); `--path no-such-dir` (exit 2); `--path docs/aurora/` with trailing slash (exit 0, same file count as without slash); synthetic two-file collision test under `--out` produced two distinct JSON files.
