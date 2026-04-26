---
name: Text-indexing substrate for factory QoL — text-only index, no binary LFS unless <10GB and worth it, research-deeply-before-shipping
description: Aaron 2026-04-22 — repo text volume is large enough to justify a fast query / reverse-index substrate; text-based index check-in OK, binary (vector) index check-in gated on LFS cost being worth it under 10GB free tier.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-22:
*"we have so much text you might as well put a high prority
for a way you can fastly query our text, maybe even index it.
I don't really want to check in binary files so i would hope
the index would be text too, it would be fine t ocheck the
index/reverse index in too, as long as you think it would be
helpful, also same with vector indexing except that is binary
and i don't want to check in binary cause the bill for LFS in
github it's not free it's billed at usage after 10GB so i guess
technically we could turn it on for up to 10GB but only if it
was worth it. do you think that would help... Reverse index
whatever you need feel freee to think outside the box and think
how to use all the tools we have at hand and get the info you
need the fastest, seperating thing by data and behiaver is a
tried and true way and you mentied it for the skills earler,
works in code too lol. you can backlog this but reasearch this
a lot and deeply could really imporve your QoL and performance."*

**The directive:**

- The repo has accumulated a lot of text (docs, memories,
  research reports, round histories, skill files, spec files).
- Aaron wants fast-query capability — grep is fine as a
  baseline but indexing could be a QoL / performance win.
- Text-based index artifacts are CHECK-IN-OK — text indices
  can be committed to the repo.
- Binary indices (vector embeddings) are CHECK-IN-NOT-OK by
  default because GitHub LFS is billed by usage over the 10 GB
  free tier. A binary index check-in is *gated* on being worth
  it under 10 GB.
- Aaron explicitly invites outside-the-box thinking — not
  just SQLite FTS, but any substrate that gets us query speed.
- **Data-behaviour separation** (Aaron's phrase): the same
  pattern that governs skill architecture (SKILL.md = behaviour;
  notebook / persona-state = data) applies to index
  architecture (index data distinct from query behaviour).

**High-priority but research-gated:**

Aaron said *"you can backlog this but reasearch this a lot and
deeply could really imporve your QoL and performance."* The
*reasearch this a lot and deeply* phrase means the research
starts now (document pointer in place, notes accumulated on
every tick), but shipping is backlog — no hasty substrate
choice.

**Options to research (first-pass, not exhaustive):**

1. **ripgrep + ctags-style reverse index.** `rg` is already
   fast. A pre-built tags index (like `.tags` or
   `.ctags.d/**`) amortises lookup. Text artifact; trivial to
   check in; tooling universal. Works well for identifier /
   heading search, less well for semantic similarity.
2. **SQLite FTS5.** SQLite3 database with the FTS5 extension
   gives BM25 search over text. The `.sqlite` file is binary
   but typically <100 MB for our size; could be generated on
   demand from text sources rather than committed.
3. **Tantivy / Bleve / other pure-Rust/Go text indexes.** Fast,
   embeddable, but binary index format.
4. **DV-2.0 frontmatter already indexable.** The factory
   already has DV-2.0 frontmatter on skills and memories with
   fields like `record_source`, `load_datetime`,
   `bp_rules_cited`. A thin reverse-index over these fields
   (YAML front-matter -> path list) is pure text and could be
   the simplest win. Query substrate: `rg` + the reverse-index
   text file.
5. **Claude-native retrieval.** Claude Code may have built-in
   retrieval (e.g. MCP servers offer `search` methods; skills
   are already searchable by description). Worth cataloguing
   what the harness already provides before building.
6. **Plain-text inverted index.** A `docs/index/reverse.txt`
   mapping term -> list-of-paths-with-line-numbers. Pure text,
   grep-friendly, no special tools. For N terms and M files,
   file size is O(N × avg-postings) — manageable at our scale.
7. **Vector embeddings (gated).** Sentence-transformers
   embeddings give semantic similarity, but the embedding
   matrix is binary. Gate check-in on: total size <10 GB AND
   query-quality wins over BM25 AND the repo actually needs
   semantic similarity (not just keyword match).

**Pattern match to factory history:**

- **Scope-universal indexing substrate** (per `feedback_dv2_scope_universal_indexing.md`):
  the index should be scope-universal, not skill-catalog-only —
  docs, memories, research, specs, skills, tests all benefit.
- **Declarative-manifest pattern**: per
  `feedback_declarative_all_dependencies_manifest_boundary.md`,
  the index metadata (when it was built, from what commit, by
  what tool) should live in a manifest so the index is
  reproducible.
- **Data-behaviour separation**: query-behaviour (a script /
  tool / skill) is distinct from query-data (the index
  artifacts); both are version-controlled but they change at
  different rates.

**How to apply:**

- Ship nothing this tick. This is research-gated.
- BACKLOG row P1: *Text-indexing substrate research + pilot
  selection.* Owner: Architect (Kenji).
- Research doc stub: `docs/research/text-indexing-landscape-
  2026-04-22.md` with the options above + sizing estimate per
  option + measured grep-baseline (how fast is `rg` across the
  repo today? — if grep is already <50ms, the case for
  indexing weakens).
- Before any substrate choice: prior-art sweep (per
  `feedback_prior_art_and_internet_best_practices_always_with_cadence.md`)
  — what are other factory-scale agent systems using? what
  does Anthropic / OpenAI / the agent-research community
  converge on?
- Measure-before-build (per
  `feedback_data_driven_cadence_not_prescribed.md`): baseline
  grep latency + token cost of current retrieval patterns
  BEFORE declaring the problem substantial.

**Date:** 2026-04-22.
