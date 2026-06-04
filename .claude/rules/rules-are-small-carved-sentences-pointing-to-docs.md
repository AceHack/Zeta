# Rules are small carved sentences that point to docs

Carved sentence:

> An auto-loaded rule is a carved sentence + pointers, not an essay.
> Every rule in `.claude/rules/` is paid for in cold-start tokens on
> every session — so the rule states the discipline in 1–3 sentences
> and links out to the doc/memory/spec that carries the detail. If a
> rule grows past a screen, the detail belongs in a doc and the rule
> shrinks to a pointer.

## Why

`.claude/rules/` auto-loads into every agent's context at wake time
(cold-start cost on every session). Detail (reasoning, citations, worked
examples, derivation chains) does not need to be resident — it needs to be
*discoverable*. So the rule carries only what an agent must hold to act
correctly; the rest lives one hop away under `docs/`, `memory/`, or a spec.

This is Data Vault 2.0 applied to rules: the carved sentence is the **hub**
(stable, always-loaded); the doc it points to is the **satellite**
(detail, changes more often, loaded on demand). See
[`dv2-data-split-discipline-activated.md`](dv2-data-split-discipline-activated.md).

## Shape

```
# <Rule title>
Carved sentence:
> <1–3 sentences: the discipline, stated so an agent can act on it>
## Why / When (optional, brief)
## Pointers
- docs/…  · memory/…  · .claude/rules/…  (where the detail lives)
```

Bias to **small**. When tempted to explain in the rule, write the
explanation in a doc and link it instead.

## Pointers

- [`wake-time-substrate.md`](wake-time-substrate.md) — *where* learning must land (this rule governs *what form* it takes once there)
- [`dv2-data-split-discipline-activated.md`](dv2-data-split-discipline-activated.md) — hub/satellite change-rate partition (the principle this rule applies to rule-text itself)
- The #6676 archive (rules → `rules.bak/`) was a cold-start-token reduction; this rule is the standing discipline that keeps active rules from re-bloating.
