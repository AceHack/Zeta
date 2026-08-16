---
id: 081M02RX1PN087G0R003WK66GV
type: task
state: backlog
priority: P2
slug: z-set-merkle-nonasciiordering-law-has-no-discriminating-vect
title: "z-set-merkle nonAsciiOrdering law has no discriminating vector: add a culture-sensitive-collation discriminator across the six oracles"
created: 2026-08-15T13:13:41.845Z
depends_on: []
composes_with: []
---

# z-set-merkle nonAsciiOrdering law has no discriminating vector: add a culture-sensitive-collation discriminator across the six oracles

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M02RX1PN087G0R003WK66GV-*.md` glob. -->

## The finding

`src/Core.TypeScript/z-set-merkle/golden-vectors.json` states a rule twice:

- `"ordering": "ascending lexicographic order over raw encoded key bytes, **not culture-sensitive
string comparison**"`
- `"laws": { "nonAsciiOrdering": "non-ASCII keys are ordered by UTF-8 bytes for the Merkle leaf order" }`

and names a vector `non-ascii-ordinal-bytes` after it. **No vector discriminates the rule.**
Measured (`bun src/Core.TypeScript/hygiene/lint-treaty-rule-discrimination.ts --verbose`):

| alternative leaf ordering         | vectors that change |
| --------------------------------- | ------------------- |
| culture-sensitive collation (ICU) | **0 of 6**          |
| UTF-16 code-unit order            | **0 of 6**          |
| descending byte order             | 4 of 6              |

The named vector's keys are `e`, `é`, `Ω`, `中` — four keys in three scripts with no case or
accent conflict — so **every collation tested (en de sv da tr fr cs lt et) yields the same order
as UTF-8 bytes**. The treaty pins a point; the law claims a rule.

Cross-oracle byte agreement (the treaty's _other_ job) is unaffected and is not in question here.

## The remedy, and why it is not free

The sibling treaties `bag/` and `z-set/` **do** pin culture-invariance, by including an
accented-Latin key next to an ASCII-letter key (`áéíóú` vs `b-005-ASCII`) — a pair every collation
reorders. Both change 2 vectors under ICU collation. The pattern is already in-repo; the fix is to
give this seed an equivalent key pair (a two-key case such as `"a"` / `"Z"` is enough, and stays
ASCII where all oracles agree).

The cost is that this seed is cross-verified by **six** oracles —
`tests/cross-verification/zset-merkle/{fsharp,cs,rust,ts,go,python}-output.json` plus
`vectors.yaml` and the JSON seed — so a new vector needs a fresh XxHash128 root reproduced by all
six, and the pre-push `treaty-byte-lock-vectors` floor must be satisfied by actually running them.
That is why it is filed rather than landed alongside the audit.

## Explicitly NOT in scope

Adding an **astral-plane** key to discriminate UTF-8-byte order from UTF-16 code-unit order. That
would _break_ the treaty rather than tighten it: F#/C#/TS compare by UTF-16 code unit and Rust by
UTF-8 byte, and they genuinely disagree across the astral/high-BMP boundary. Same residual as
`081M02PEST7087G0R00253HRV0` (consensus). Blocked until the repo adopts one canonical collation
(`.claude/rules/culture-invariant-by-default.md` prescribes codepoint ≡ UTF-8 byte order; nothing
has adopted it yet).

## Done when

- One new vector whose leaf order differs under ICU collation, reproduced byte-identically by all
  six oracles.
- `treaty-rule-alternatives.ts` promotes the `culture-sensitive collation` row from
  `expect: "not-excluded", kind: "gap"` to `expect: "excluded"` — the lint fails until it is,
  because a row declared not-excluded that starts discriminating is itself a failure.

## Pointers

- `src/Core.TypeScript/hygiene/lint-treaty-rule-discrimination.ts` — the standing guard.
- `src/Core.TypeScript/hygiene/treaty-rule-alternatives.ts` — the `gap` row this item is cited from.
- PR #10759 — the origin instance ("the treaty pinned a POINT; the prose claimed a RULE").
