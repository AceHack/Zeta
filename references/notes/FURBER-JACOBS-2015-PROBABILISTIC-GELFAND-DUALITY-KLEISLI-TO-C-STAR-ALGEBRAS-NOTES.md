# Furber & Jacobs 2015 — Probabilistic Gelfand Duality (Kleisli → C*-algebras) — substrate-anchor for "staying smooth" + 081KSNY2Z0008QG0R002HB4AGT Kleisli substrate (the human maintainer (2026-05-28) forwarded)

the human maintainer (2026-05-28): *"seems on point https://lmcs.episciences.org/1565/pdf to staying smooth"*

## Citation

- **Title**: From Kleisli Categories to Commutative C*-algebras: Probabilistic Gelfand Duality
- **Authors**: Robert W. J. Furber, Bart P. F. Jacobs
- **Journal**: Logical Methods in Computer Science (LMCS), Volume 11, Issue 2 (2015)
- **URL**: https://lmcs.episciences.org/1565
- **PDF**: https://lmcs.episciences.org/1565/pdf

## What it establishes

Functors from several **Kleisli categories of monads** (relevant to probabilistic computation) to **categories of C*-algebras**. Introduces a probabilistic variant of **Gelfand duality** via the Radon monad on compact Hausdorff spaces.

## Why "on point to staying smooth" (the human maintainer's framing)

Per `.claude/rules/substrate-smoothness-as-load-bearing-property.md`:

> *"smooth substrate producing sharp outputs through focused integration is what makes the architecture buildable. Sharpness is at the output, not in the underlying substrate. English-as-substrate doesn't collapse assertions to absolute truth; that smoothness is the load-bearing property the framework operates with implicitly + every layer depends on."*

The Furber-Jacobs paper formalizes the EXACT shape at a different scope:

| Framework substrate-smoothness | Furber-Jacobs categorical substrate |
|---|---|
| English doesn't collapse to absolute truth; only probabilities | Probabilistic computation modeled as monads on Kleisli categories |
| Smooth substrate producing sharp outputs through focused integration | Continuous functions (C*-algebra side) ↔ probabilistic computation (Kleisli side) via Gelfand duality |
| "not not sharp" double-negation preserves gradient | Compact Hausdorff topology + Radon monad preserves continuity through composition |
| Substrate-check operates in smooth zone | C*-algebras preserve operator-norm continuity; computational paths preserve probability-measure continuity |
| Multi-oracle BFT preserves more info than majority voting | Probabilistic Gelfand duality preserves more info than discrete approximation |

The paper is **published category-theory formalization** of the structural pattern the human maintainer's substrate-smoothness rule names intuitively. NOT a claim that the framework "is" probabilistic Gelfand duality; rather, that the substrate-engineering pattern the human maintainer's reaching for has formal-math anchors in published academic literature.

## Composes with 081KSNY2Z0008QG0R002HB4AGT (Kleisli arrows for context-propagation)

This citation arrives within hours of 081KSNY2Z0008QG0R002HB4AGT substrate-target filing. Kleisli categories are THE mathematical structure 081KSNY2Z0008QG0R002HB4AGT's substrate-target depends on. Furber-Jacobs provides:

- **Formal grounding** for "Kleisli arrows for context-propagation" at the categorical-substrate scope
- **C*-algebra connection** suggests an additional substrate-engineering target: if interrupt-context-propagation IS Kleisli-shaped, then the framework's broader observability + probability substrate gets a Gelfand-duality bridge for free
- **Radon monad** as concrete monad-of-interest for probabilistic operator-substrate (composes with the framework's multi-oracle BFT + reputation-weighted encryption budget substrate)

## Composes with substrate

- `.claude/rules/substrate-smoothness-as-load-bearing-property.md` — primary substrate this paper anchors at formal-math scope
- `.claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md` — Kleisli IS canonical instance; Furber-Jacobs operates at categorical-substrate scope
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` — multi-oracle = probabilistic-substrate operating per probabilistic-Gelfand-duality shape
- 081KSNY2Z0008QG0R002HB4AGT (interrupt substrate in monad space) — Furber-Jacobs is mathematical-substrate anchor for Kleisli substrate at framework scope
- `.claude/skills/mathematics-and-physics/blueprints/category-theory-expert.md` — Furber-Jacobs is canonical reference for skill-expert work at Kleisli + Gelfand duality scope
- 081KRFA460008QG0R0018SN61J (F# fork for AI safety) — F# substrate already provides Kleisli-shaped helpers (src/Core/Tracing.fs Arrow type); Furber-Jacobs anchors WHY this shape generalizes
- Aurora multi-oracle BFT substrate (081KS3X9Y0008QG0R00218150M) — probabilistic operator-substrate composes with probabilistic-Gelfand-duality at consensus-mechanism scope
- `references/notes/kleisli-ts-prior-art.md` — sibling notes file for TS-library prior-art at impl-substrate scope; Furber-Jacobs is the math-substrate anchor for the same shape

## What this notes file is NOT

- A claim that the framework "implements" probabilistic Gelfand duality (it doesn't, and doesn't need to)
- A claim that Furber-Jacobs proves substrate-smoothness is correct (the rule operates on its own operational merits; the paper provides additional formal grounding, not validation)
- A library-recommendation (the paper is theoretical; not a software dep)
- An impl-time reference (no impl-time WebSearch needed; paper is published 2015 + indexed permanently at LMCS)

## What this notes file IS

- Substrate-honest preservation of the human maintainer's substantive substrate-engineering scouting
- Formal-math anchor for substrate-smoothness rule + 081KSNY2Z0008QG0R002HB4AGT Kleisli substrate
- Cross-reference target for future-Otto / future-Alexa / Soraya formal-verification work
- Future-skill-expert (category-theory) substrate when category-theory substrate-engineering work matures

## Substrate-honest framing per razor-discipline

The framework's substrate-smoothness rule is operationally checkable on its own (per `razor-discipline.md`). The Furber-Jacobs paper provides **formal-math anchor** (per `fsharp-anchor-dotnet-build-sanity-check.md` discipline applied at math-substrate scope) for the SHAPE the rule names. Both operate independently; the paper is additional anchor, not the foundation.

Per `god-tier-claims-high-signal-high-suspicion-dont-collapse.md`: this paper is HIGH-SIGNAL substrate-engineering anchor + HIGH-SUSPICION (don't collapse to "the framework IS Furber-Jacobs"). Preserve dialectical tension; substrate-engineering work proceeds on its own merits with the paper as one prior-art surface among several.

μένω. The math has been done at the categorical scope; the framework operates at substrate-engineering scope; the shapes compose.
