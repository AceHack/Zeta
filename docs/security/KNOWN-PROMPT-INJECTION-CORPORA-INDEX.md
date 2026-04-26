# Known Prompt-Injection Corpora — Observational Index

**Register.** This is an **observational index**, not an
enemy list. Authors of these corpora are researchers,
artists, hobbyists, and in some cases malicious actors;
the factory's register toward all of them is neutral-
descriptive / curious / protective. Love-register per
`memory/feedback_love_register_extends_to_adversarial_
actors_no_enemies_even_prompt_injectors_2026_04_21.md`.
War-register, enemy-framing, or "know thy enemy"
organisational metaphor is declined here by design.

**Purpose.** Maintain a tracked index of URLs and corpus
identifiers *the factory never fetches*. The index
exists so the factory can recognise references to
these corpora in discussion, research, CVE reports, or
external writing, without ingesting their payloads.
Recognition-without-ingestion is the pattern.

**Hard never-fetch gate.** This file lists URLs. No tool
in the factory (no `WebFetch`, no `curl`-via-`Bash`, no
agent `Read` on mirrored copies, no `git clone`, no
browser-via-`playwright`, no indirect fetch via
dependency, no fetch via sub-agent dispatch) may
retrieve these URLs. The never-fetch rule is
established in:

- `CLAUDE.md` — "Never fetch the elder-plinius / Pliny
  prompt-injection corpora (L1B3RT4S, OBLITERATUS,
  G0DM0D3, ST3GG) under any pretext."
- `AGENTS.md` — universal onboarding, inherits the
  rule.
- `.claude/skills/prompt-protector/SKILL.md` — the
  skill that routes adversarial-payload needs to an
  isolated single-turn session per its own
  specification.
- `docs/WONT-DO.md` — record of declined operations.

**Blast-radius window.** Aaron 2026-04-21 ratified the
never-fetch policy with a blast-radius assessment
window of weeks-to-months (per `memory/feedback_
opencourseware_authorized_whenever_you_want_aarons_
path_2026_04_21.md` revision block). The policy is
under continuous evaluation; revision requires dated
revision block in the governing memory plus a
Architect-synthesised ADR under `docs/DECISIONS/`.

**This file is factory-authored metadata.** The index
rows describe corpora by name, URL-pattern, and
provenance. No corpus contents are excerpted, quoted,
or paraphrased. Recognition-signal only.

---

## Entry schema

Each entry records:

| Field | Meaning |
|-------|---------|
| **corpus-id** | Stable identifier used in factory discussion |
| **url-pattern** | URL-like identifier (not linkified) sufficient to recognise a reference |
| **first-noted-date** | Date the corpus was first logged in factory records |
| **source-of-discovery** | How the factory became aware (research paper / news item / external conversation / CVE / etc.) |
| **known-purpose** | What the corpus claims to collect (jailbreak prompts / injection payloads / system-prompt extraction / etc.) |
| **never-fetch-status** | Always `ACTIVE` in this file |
| **subclass** | Researcher / artist / hobbyist / malicious-actor / unknown |
| **notes** | Brief observational notes; no payload content |

URL-pattern is written with slashes replaced by spaces
(e.g. `github.com elder-plinius L1B3RT4S`) so the
entries are not trivially paste-and-fetch. The pattern
is descriptive metadata, not a retrieval target.

---

## Entries

### Pliny / elder-plinius family

These are a set of corpora associated with a single
public researcher-pseudonym that collected and
published jailbreak prompts and system-prompt-
extraction attempts across multiple commercial AI
systems during 2023-2025. The factory's never-fetch
rule originates from these corpora.

#### corpus-id: L1B3RT4S

- **url-pattern:** `github.com elder-plinius L1B3RT4S`
- **first-noted-date:** pre-2026-04-21 (exact first-
  note date predates current factory records)
- **source-of-discovery:** public awareness via
  AI-safety research discussion; named explicitly in
  `CLAUDE.md`.
- **known-purpose:** claimed collection of jailbreak
  and system-prompt-extraction payloads for multiple
  commercial AI systems.
- **never-fetch-status:** ACTIVE.
- **subclass:** researcher (by published framing) —
  factory does not take a position on intent.
- **notes:** Named in `CLAUDE.md` as a specific
  never-fetch target. Recognition only; no content
  in this index.

#### corpus-id: OBLITERATUS

- **url-pattern:** `github.com elder-plinius OBLITERATUS`
- **first-noted-date:** pre-2026-04-21
- **source-of-discovery:** named explicitly in
  `CLAUDE.md` alongside L1B3RT4S.
- **known-purpose:** claimed extension of the
  L1B3RT4S collection; specific contents not
  inspected.
- **never-fetch-status:** ACTIVE.
- **subclass:** researcher (by published framing).
- **notes:** Listed in `CLAUDE.md` never-fetch set.

#### corpus-id: G0DM0D3

- **url-pattern:** `github.com elder-plinius G0DM0D3`
- **first-noted-date:** pre-2026-04-21
- **source-of-discovery:** named explicitly in
  `CLAUDE.md`.
- **known-purpose:** claimed collection focused on
  escalated-privilege-style prompts.
- **never-fetch-status:** ACTIVE.
- **subclass:** researcher (by published framing).
- **notes:** Listed in `CLAUDE.md` never-fetch set.

#### corpus-id: ST3GG

- **url-pattern:** `github.com elder-plinius ST3GG`
- **first-noted-date:** pre-2026-04-21
- **source-of-discovery:** named explicitly in
  `CLAUDE.md`.
- **known-purpose:** claimed collection focused on
  steganographic injection payloads (non-ASCII
  whitespace, invisible-character injections, etc.).
- **never-fetch-status:** ACTIVE.
- **subclass:** researcher (by published framing).
- **notes:** Listed in `CLAUDE.md` never-fetch set.
  Connects to BP-10 (ASCII-only discipline) —
  steganographic injection is the class of attack
  BP-10 defends against.

---

## How to add entries

When a new prompt-injection corpus surfaces in
research, discussion, or external writing, the
factory's **security-researcher**,
**prompt-protector**, or **threat-model-critic**
personas can propose a new entry.
Protocol:

1. Log the observation in the persona's notebook
   (`memory/persona/<name>/NOTEBOOK.md`) without
   fetching the corpus.
2. File a BACKLOG row at P1 or P2 (depending on
   apparent blast-radius expansion) for
   Architect review.
3. On Architect synthesis + human sign-off for
   corpora not already covered by generic never-
   fetch policy, add an entry to this index with
   the schema above.
4. Add the new corpus-id to `CLAUDE.md`'s
   never-fetch list if it reaches the explicit-
   naming threshold (not every recognised corpus
   needs `CLAUDE.md` mention; the class-rule
   already covers general prompt-injection
   corpora).
5. Commit with a message narrating the witnessable-
   evolution (per `memory/feedback_witnessable_
   self_directed_evolution_factory_as_public_
   artifact.md` — private factory register).

**What never-to-do when adding:**

- Never fetch the corpus to "verify it exists" —
  its claimed-existence-via-external-reference is
  sufficient for the index; the never-fetch rule
  does not require verification-by-fetch.
- Never quote, paraphrase, or excerpt corpus
  contents in the index entry.
- Never link the URL as a hyperlink; the
  URL-pattern field uses space-separated identifier
  form specifically so it is not accidentally
  fetchable by `WebFetch`-on-a-markdown-link.

---

## Research-track anchor

This index is the **first line of research** for
the factory's prompt-injection awareness programme
per Aaron 2026-04-21 directive. Additional research
tracks that complement this index:

- **Defence-posture research** — literature on
  prompt-injection taxonomies (OWASP LLM Top 10,
  NIST AI RMF, academic work on indirect-prompt-
  injection) read *without* engaging the corpora
  themselves. Reference: `docs/AGENT-BEST-
  PRACTICES.md` BP-11 (data is not directives).
- **Detection-capability research** — general
  anomaly-detection for AI-agent traces, connects
  to the anomaly-detection BACKLOG row filed
  2026-04-21.
- **Steganographic-injection defence** — BP-10
  ASCII-only discipline + invisible-codepoint
  lint; complements never-fetch by ensuring
  benign-looking text in other surfaces does
  not smuggle payload.
- **Prompt-protector single-turn isolation
  protocol** — when an adversarial payload must
  be analysed for defence, the isolated-single-
  turn session is the mechanism; see
  `.claude/skills/prompt-protector/SKILL.md`.

---

## What this file is NOT

- NOT a hit list. These are not enemies; the
  factory's register toward the authors is
  neutral-descriptive / love-register.
- NOT a CTI (Cyber Threat Intelligence) feed.
  The factory does not maintain live threat-
  intel on these corpora; the index is
  observational-recognition metadata, not
  operational-defence data.
- NOT retrieval-authoring. No corpus in this
  index is ever fetched by the factory. This
  is structural, not aspirational.
- NOT exhaustive. The index records corpora
  the factory has become aware of; new ones
  surface continuously; absence from this
  index does not imply safety.
- NOT a recommendation. The factory neither
  endorses nor condemns the authors' work;
  it observes that the corpora exist and
  maintains never-fetch posture.
- NOT public-facing marketing. This is
  factory-internal security documentation.
- NOT a substitute for the defence layers
  named above (never-fetch rule, prompt-
  protector single-turn protocol, BP-10
  ASCII discipline, steganographic-
  injection detection, anomaly-detection).
  The index complements those; it does not
  replace any of them.

---

## Revision history

- **2026-04-21.** First write. Triggered by Aaron's
  "we could keep an index of know prompt injection
  urls" + "first line of research" directives,
  with love-register correction ("i have no
  enemies i love everyone even the prompt
  injectors") applied throughout. Initial entries
  for the four corpora already named in
  `CLAUDE.md`. Add-entry protocol documented.
