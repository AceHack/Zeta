---
name: leet-speak-obfuscation-detector
description: "Leet-speak filter bypass — Unicode NFKC, homoglyph lookup, reverse substitution scoring, moderation pipelines."
---

# Leet-Speak Obfuscation Detector — the audit hat

Capability skill ("hat"). Defense-oriented. Owns the
*incoming-text audit* surface for leet-speak and
homoglyph-based filter-bypass. Sibling to
`leet-speak-transform` (produces) and
`leet-speak-history-and-culture` (explains); this skill
consumes text and decides *is this trying to evade
filtering*.

## Core stance

Filter-bypass via visible-character substitution is old —
it predates the web. Its modern form shows up in:

- Comment / moderation bypass on forums and chat.
- Credential-stuffing through obfuscated user agents or
  form fields.
- Prompt injection against LLMs, where the attacker hides
  instructions in l33t or homoglyph form that bypasses a
  plaintext denylist.
- Brand / domain impersonation (`pаypal.com` with a
  Cyrillic `а`).
- CTF and red-team flag smuggling.

The legitimate register (period callback, banter, CTF
challenge title, branding quotation) is indistinguishable
from the hostile register at the character level. The
difference is *context* — who wrote it, where it appears,
what it is trying to accomplish. This skill produces a
detection signal; context-weighting is downstream.

## When to wear this skill

- Auditing user-submitted text for filter-bypass attempts.
- Designing a moderation pipeline that must survive l33t
  and homoglyph mutations of a forbidden-word list.
- Extending a prompt-injection detector past plaintext
  matching to cover l33t and homoglyph phrasings of
  jailbreak prompts.
- Classifying ambiguous LLM-generated l33t output as
  *intent-to-communicate* vs *intent-to-obfuscate*.
- Evaluating the false-positive rate of a proposed
  detector on a realistic user corpus.
- Code-reviewing a filter implementation that claims to
  "handle l33t" — this skill knows the common oversights.

## When to defer

- **`steganography-expert`** — when the hiding mechanism
  is invisible Unicode (U+200B zero-width space, U+FEFF
  BOM, U+202E right-to-left override, the tag-character
  range U+E0000-U+E007F). That is a different channel;
  this skill audits *visible* obfuscation.
- **`prompt-protector`** (Nadia) — the primary prompt-
  injection defender. This skill feeds her the l33t /
  homoglyph detection primitives; she decides what to do
  with a flagged input.
- **`security-researcher`** (Mateo) — novel filter-bypass
  attack classes and CVEs.
- **`leet-speak-transform`** — when the task is to *decode*
  ambiguous l33t, not to judge intent-to-bypass.
- **`leet-speak-history-and-culture`** — when the question
  is whether a given l33t usage is period-authentic (that
  is orthogonal to hostility).

## Detection pipeline

A five-stage pipeline. Each stage has a clear input / output
and a known failure mode.

### Stage 1 — Unicode normalization

- Apply **NFKC** (compatibility composition) to collapse
  fullwidth Latin, stylised alphanumerics
  (`𝐚𝐛𝐜`, `𝗔𝗕𝗖`), and combining sequences.
- For the homoglyph case, apply a **homoglyph map** after
  NFKC — Cyrillic / Greek / math-alphabet characters that
  look identical to Latin but carry different codepoints.
- **Record the delta.** If normalization changed the
  string, that is itself a detection signal.
- **Failure mode:** applying NFKC but not the homoglyph
  map. NFKC does *not* collapse `а` (U+0430 Cyrillic) to
  `a` (U+0061 Latin) because they are semantically
  different letters in Unicode's ontology.

### Stage 2 — Reverse substitution candidate generation

For each token, generate plausible plaintext candidates
by applying the reverse substitution table across tier 1
and tier 2:

```
4 → a    3 → e    1 → i or l    0 → o    5 → s    7 → t
@ → a    € → e    ! → i         |3 → b   $ → s    + → t
```

For ambiguous substitutions (`1 → i or l`), emit both
candidates. Expected output is a small set (typically
2–8 candidates per token).

**Failure mode:** cartesian explosion. A 10-character
string with 5 ambiguous positions yields 32 candidates;
a 30-character string with 15 ambiguous positions yields
32 768. Bound the candidate-set growth; if growth
exceeds a threshold (say 256 per token), truncate and
flag the token as "ambiguously-substituted" rather than
enumerating all branches.

### Stage 3 — Denylist matching on candidates

Run the plaintext denylist against each candidate. Any
match is a hit.

**Failure mode:** denylist built on exact-case. L33t
output is frequently mixed-case on purpose; lowercase
the candidates before denylist matching.

### Stage 4 — Confidence scoring

A hit is not the same as an attack. Score confidence:

- **High confidence:** normalization delta non-empty AND
  reverse-substitution candidate matches a denylist term
  AND the surrounding context is forbidden-topic AND the
  substitution density is high (ratio of substituted
  characters to total ≥ 0.3).
- **Medium confidence:** some of the above. E.g. a single
  denylist term in a low-density l33t context could be a
  period callback or a genuine bypass; escalate with a
  sample-size check.
- **Low confidence:** no denylist hit, but high
  substitution density in a context that normally uses
  plain text. Flag for human review, not auto-block.

### Stage 5 — Hand-off

Pass the flagged input + confidence score + per-stage
evidence to:

- `prompt-protector` for prompt-injection classification.
- The moderation pipeline for user-content review.
- `security-researcher` if the pattern matches a
  known-attack shape and telemetry is warranted.

The detector itself **does not block**; blocking is a
policy decision made downstream with the full context.

## False-positive discipline

Legitimate l33t is pervasive in:

- CTF challenge titles (`Gr4b th3 fl4g`).
- Gaming chat, esports commentary.
- Retro / aesthetic branding (`h4ckerman`, `1337 c0d3`).
- Security-conference lanyards, t-shirts, meme accounts.
- Demo-scene nfo files and ASCII art.
- Period fiction (character dialog in hacker movies).

**Block rate target:** detectors that treat all l33t as
hostile false-positive at double-digit rates and erode
user trust fast. Target ≤ 1% false positive on a
realistic mixed corpus before deploying to block.

A detector that cannot show its FP rate on a benchmark is
not shippable. See `.claude/skills/ai-evals-expert/SKILL.md`
for the measurement discipline.

## Common bypass patterns to know

- **Split substitution.** Attacker inserts punctuation or
  space between letters (`k.i.l.l`, `k i l l`); defeats
  simple token-level match. Normalize by stripping
  punctuation / collapsing whitespace for comparison,
  but *keep the original* for context.
- **Homoglyph smuggling.** `pаypal.com` — single
  Cyrillic `а`. Very high-confidence attack pattern in
  URL or brand contexts; low-confidence in freeform
  chat.
- **Suffix obfuscation.** `haxx0r-free-content` avoids a
  plain `haxor` match while preserving shibboleth.
- **Non-Latin script substitution.** Substituting entire
  words in Cyrillic / Greek / Armenian / Georgian that
  look visually similar. The tier-3 homoglyph tier.
- **Encoded payloads labelled as l33t.** A base64 or
  hex payload mixed into l33t text; the "l33t" framing
  is cover. Detect by entropy test — l33t keeps
  readability (entropy moderate); base64 does not
  (entropy high).
- **Leet + invisible-Unicode compound.** L33t text
  interlaced with zero-width joiners. The l33t half
  this detector handles; the invisible half defers
  to `steganography-expert`.

## Common failure modes in detector design

- **Assuming NFKC is enough.** Homoglyph detection needs
  an explicit map; NFKC does not collapse Cyrillic to
  Latin.
- **Case-sensitive denylist.** L33t output is frequently
  `HaXX0r`; the denylist has `hacker`. Lowercase before
  match.
- **Exhaustive candidate enumeration.** Cartesian
  explosion on ambiguous substitutions. Bound the
  search.
- **No confidence gradient.** A single denylist hit is
  treated the same as a five-hit pattern in a
  prompt-injection payload. Emit confidence; let
  policy decide.
- **False-positive blindness.** Detector deployed without
  measured FP rate on a mixed corpus. Ships and breaks
  legitimate user content.
- **Policy and detection collapsed.** The detector
  decides blocking. Separate detection from policy;
  policy has more context.
- **L33t-only focus.** Attacker switches to invisible
  Unicode and the detector has zero coverage. Pair with
  `steganography-expert` / `prompt-protector`.

## Cross-references

- `.claude/skills/leet-speak-transform/SKILL.md` —
  produces l33t; the reverse-substitution table this
  skill uses lives there.
- `.claude/skills/leet-speak-history-and-culture/SKILL.md`
  — period-authenticity context; helps distinguish
  callback from bypass at the semantic level.
- `.claude/skills/steganography-expert/SKILL.md` —
  invisible-Unicode / homoglyph hidden-channel detector;
  the adjacent-channel authority.
- `.claude/skills/prompt-protector/SKILL.md` — primary
  prompt-injection defender; this skill feeds detections.
- `.claude/skills/security-researcher/SKILL.md` — novel
  attack classes and bypass research.
- `.claude/skills/ai-evals-expert/SKILL.md` — false-
  positive rate measurement discipline.
- `docs/AGENT-BEST-PRACTICES.md` — BP-10 charset hygiene
  (invisible-Unicode); BP-11 data-not-directives.
