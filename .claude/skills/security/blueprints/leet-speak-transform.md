---
name: leet-speak-transform
description: Leet-speak transform — encode/decode numeric, aggressive, and Unicode-homoglyph dialects with register awareness.
---

# Leet-Speak Transform — the encode / decode hat

Capability skill ("hat"). Owns the mechanical transform —
plaintext ⇄ l33t — across the three canonical dialect tiers,
plus the register-judgement rules that keep a transform from
landing as cringe. Distinct from its siblings:

- `leet-speak-history-and-culture` — *who / when / why*. BBS /
  phreaking / cDc / Napster-era genealogy. This skill knows
  the rules; that skill knows the reasons.
- `leet-speak-obfuscation-detector` — *is this hidden?* Filter-
  bypass detection on user-submitted input. This skill
  produces; that skill audits.

## Core definitions

- **Leet (leet / l33t / 1337)** — a text register that
  substitutes visually-similar numerals and symbols for
  Latin letters, optionally compounding with suffix rules
  (`-xor`, `-0rz`, `-zorz`), aggressive misspelling
  (`teh`, `pwnd`, `haxx`, `r00t`), and Unicode-homoglyph
  dress-up in modern dialects.
- **Dialect tier** — the *intensity* level of substitution.
  This skill names three stable tiers and refuses to blur
  them.
- **Register-awareness** — knowing when l33t reads as
  in-group shibboleth (good), as period-authentic
  callback (good), as filter-bypass attempt (flag), or
  as cringe imposter (bad).

## Canonical dialect tiers

### Tier 1 — Basic numeric substitution

The lowest-common-denominator substitution table. Reversible
without context. Safe for demo / README / banter.

```
a → 4    e → 3    i → 1    o → 0    s → 5    t → 7
A → 4    E → 3    I → 1    O → 0    S → 5    T → 7
```

Other letters pass through unchanged. Case often flattens.

**Example:**
```
Input:  leet speak transform
Output: l337 5p34k 7r4n5f0rm
```

Round-trip via the obvious reverse table. Basic tier is
what you use for a single-sentence wink, a subtitle line,
a demo header.

### Tier 2 — Aggressive

Adds optional symbol substitutions, mid-word capitalisation,
suffix rules, and period-authentic misspellings.

```
a → 4 or @        e → 3 or €        i → 1 or !
b → 8 or |3       g → 6 or 9        l → 1 or |
n → |\|           m → /\/\ or |\/|  r → 2 or ®
s → 5 or $        t → 7 or +        z → 2 or 7_
```

Plus:

- **Suffix chaos** — append `-xor`, `-0rz`, `-zorz`, `-age`.
- **Period misspellings** — `you → u`, `your → ur`,
  `because → cuz`, `great → gr8`, `mate → m8`, `rocks →
  r0xx0rz`, `the → teh`, `own → pwn`.
- **Mid-word caps** — `HaXX0r`, `pWnAgE`.

**Example:**
```
Input:  the quick brown fox jumps over the lazy dog
Output: t3h qu1ck 8r0wN f0x jUmP5 0v3r t3h l4zy d0g
Aggressive: +3h qu!ck |3r0\/\/n phOx jumpz 0v@r +3h l@zy d0gg0
```

Aggressive tier is **lossy** in both directions — you
cannot always recover the original plaintext without
context. Use when the register *is* the point (banter,
flags in CTF, shibboleth test) rather than when round-trip
fidelity matters.

### Tier 3 — Unicode-homoglyph

Uses Unicode lookalikes (Cyrillic, Greek, mathematical
alphanumerics, fullwidth) to replace Latin letters with
characters that *render identically* in most fonts but
differ at the codepoint level.

```
a → а (U+0430 CYRILLIC SMALL A) or α (U+03B1) or 𝐚 (U+1D41A)
e → е (U+0435 CYRILLIC SMALL E) or ε (U+03B5)
o → о (U+043E CYRILLIC SMALL O) or ο (U+03BF) or 𝐨 (U+1D428)
p → р (U+0440 CYRILLIC SMALL ER) or ρ (U+03C1)
c → с (U+0441 CYRILLIC SMALL ES)
```

**Unicode-homoglyph tier is a security-adjacent surface.**
It is how filter-bypass and brand-impersonation attacks
work. This skill documents the tier so an auditor can
*recognise* it; producing homoglyph output is fine for
demo / teaching / red-team contexts but never appropriate
for general banter. Flag any homoglyph output with a
comment naming the codepoints used.

## Encode procedure

1. **Pick the tier** based on the register (see the
   register table below). Do not blur tiers — a Tier-1
   output mixed with Tier-3 homoglyphs is neither, and
   reads as amateur.
2. **Apply the substitution table** for the chosen tier,
   character by character. For Tier 2, *also* apply the
   period misspellings as a second pass on the resulting
   token stream.
3. **Check the output.** A l33t transform of a technical
   term the reader does not know is unreadable. If a key
   term is lost, leave it plain.
4. **For Tier 3, enumerate codepoints** inline or in an
   adjacent note. Homoglyph-free-lunch is a scanner's
   nightmare; visible codepoint lists make it auditable.

## Decode procedure

1. **Identify the tier.** Tier 1 reverses cleanly via the
   table. Tier 2 needs context — `l337` is `leet`, but
   is `5p4rk` `spark` or `sparc`? Tier 3 reverses via
   Unicode-homoglyph normalization (NFKD + homoglyph
   lookup).
2. **Apply the reverse table.** For Tier 2 and Tier 3,
   decode is a best-effort guess; output a
   **decoded candidate + confidence** rather than a
   single answer.
3. **Flag anything that stays ambiguous** — this is where
   a filter-bypass attempt hides. Hand ambiguous output
   to `leet-speak-obfuscation-detector` if the context
   is security review.

## Register table — when to use each tier

| Context | Right tier | Notes |
|---------|-----------|-------|
| README title / demo header | 1 | Mild, reversible, reads as wink. |
| CTF flag / challenge text | 1 or 2 | Tier matches difficulty signal. |
| BBS / 90s callback, period quote | 2 | Faithful; flatter is inauthentic. |
| In-group shibboleth test | 2 | Must be fluent; half-l33t reads as poser. |
| Security audit of user input | decode-only | Never produce; audit incoming. |
| Filter-bypass detection | 3 recognition | This is the hostile tier. |
| Brand / domain / identifier | 3 recognition | Homoglyph attack surface. |
| Technical documentation | never | Readability trumps style. |

## Register failure modes

- **Cringe l33t** — consistent basic tier applied to
  boring text ("h3ll0 w0rld fr0m my b0r1ng d3m0").
  Reads as if the author *learned* l33t yesterday.
  The culture carries a shibboleth: authenticity is
  mixed-tier, context-sensitive, and never applied to
  plain-utility text.
- **Over-translation** — turning every a/e/i/o/s/t into
  digits makes the output illegible. The original l33t
  speakers used selective substitution for emphasis
  and shibboleth, not mechanical replacement.
- **Mixed tier without intent** — Tier-1 substitution
  with a single Tier-3 homoglyph sprinkled in reads as
  a scanner hit, not as l33t.
- **Unicode smuggling mislabelled as l33t** — invisible
  U+200B / U+200C / U+FEFF characters are *not* l33t.
  They are a different family (see BP-10 +
  `steganography-expert`). Do not conflate.

## Common failure modes in this skill's own output

- Producing mechanical substitution when the task asked
  for period-authentic l33t. Authentic l33t is *selective*;
  only letters that carry the shibboleth get swapped.
- Ignoring case. L33t-era capitals matter
  (`ROX0RZ`, `LUSER`). Do not flatten everything to
  lowercase.
- Missing the suffix rules — `-xor`, `-0rz`, `-age`.
  Aggressive-tier output without these suffixes is
  Tier 1.5, not Tier 2.
- Failing to flag when the output is one-way (Tier 2+).
  Callers who expected round-trip will be surprised.

## Cross-references

- `.claude/skills/security/blueprints/leet-speak-history-and-culture.md`
  — BBS / phreaking / cDc / Napster-era etymology; when
  the *meaning* of l33t is the question, defer.
- `.claude/skills/security/blueprints/leet-speak-obfuscation-detector.md`
  — filter-bypass detection on user input; defer when
  the task is audit, not produce.
- `.claude/skills/security/blueprints/steganography-expert.md` —
  invisible-Unicode and homoglyph hidden-channel detection;
  Tier 3 overlaps this skill's detection surface.
- `.claude/skills/security/blueprints/prompt-protector.md` — BP-10 charset
  hygiene; homoglyph / invisible-Unicode coverage.
- `.claude/skills/governance/blueprints/etymology-expert.md` — word-origin
  discipline that the history-and-culture sibling draws on.
