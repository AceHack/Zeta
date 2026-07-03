# `ace ensure <noun-path>` — idempotent-by-default CLI; non-idempotent commands need a workflow/DU around them (Aaron, 2026-06-07)

Applies the seam/verb/noun grammar (#6957) to Ace, and states a design principle. Aaron:

> *"ace package manager is same — `ace ensure npm`, `ace ensure npm.foo`, `ace ensure compiler.rust`,
> `ace ensure npm[www.privaterepo.com].bar`, blah blah. It's better if you have CLI commands that are idempotent
> mostly, and when you have ones that are not, you need a workflow / discriminated union around it."*

## 1. Ace = the same grammar; `ensure` is the idempotent verb; nouns are scoped paths

Ace is `ace <verb> <noun>` (the #6957 grammar; `ace` is a seam/tool). The canonical verb is **`ensure`** —
*idempotent*: converge to "this is present," apply-N-times == apply-once.

Noun grammar (scoped/qualified paths):

- `ace ensure npm` — ensure the npm ecosystem present.
- `ace ensure npm.foo` — ensure package `foo` in the `npm` namespace (dotted path = namespace.package).
- `ace ensure compiler.rust` — ensure the Rust compiler (`compiler` namespace).
- `ace ensure npm[www.privaterepo.com].bar` — ensure `bar` from npm, **sourced at** `www.privaterepo.com` —
  the **`[source]` bracket parameterizes the seam/registry** on the noun (which resolver/registry to resolve
  against). So a noun = `namespace[source].package` — a scoped, source-qualified reference resolved per the
  pointer/resolver discipline (#6916/#6925).

`ensure` is declarative-desired-state (NixOS/ArgoCD/Ace, #6939): you state *what should be present*; Ace
converges and surfaces conflicts at compile time (#6940). Idempotent by construction.

## 2. The principle: idempotent by default; non-idempotent ⇒ wrap in a workflow / discriminated union

> *"better if CLI commands are idempotent mostly; when not, you need a workflow / discriminated union around it."*

A standing CLI design rule, and it's the **idempotency discipline (#6 always-active)** typed for commands:

- **Default to idempotent verbs.** `ensure` (upsert / converge / apply) — safe to retry, replay, re-run; no
  duplicate effect. Most commands should be this shape (declarative desired-state). This is what makes the
  whole CLI **retry-safe, DST-replayable (the test seam #6958), and crash-safe** — re-running is harmless.
- **Non-idempotent commands are the exception, and must be FENCED.** Some verbs inherently have once-only
  effects (publish, send, pay, migrate-with-side-effects, increment). For these you **cannot** just retry —
  re-running double-applies. So **wrap them in a workflow / discriminated union** that makes the non-idempotence
  *explicit and handled*:
  - a **discriminated union** of the operation's states (e.g. `NotStarted | InProgress | Done of Receipt |
    Failed of Reason`) so the effect's status is first-class data, not an assumption — you can see where it is
    and resume/compensate correctly;
  - a **workflow / saga** with an **idempotency key** (so a retry recognizes "already done") and
    **compensation** (so a partial failure can be undone — the reversible-destruction covenant #6896 applied to
    side effects).
  - This is exactly the idempotency rule's prescription: *"apply-N-times == apply-once; if not, add a
    natural/dedup key or **name the non-idempotence**."* The DU/workflow is how you *name* it — the
    non-idempotence becomes typed, visible, and safely orchestrated rather than a silent footgun.

So: **idempotent verb (ensure) = a bare command; non-idempotent verb = a command wrapped in a DU/workflow.** The
shape of the wrapper tells you, at a glance, which kind you're dealing with.

## Why it matters

- **Retry/replay/crash-safety for free** on the idempotent majority — and the test seam (#6958) can hammer them
  deterministically without side-effect accumulation.
- **The dangerous minority is made visible by its shape** — a non-idempotent op that *isn't* wrapped in a
  DU/workflow is a code smell (silent double-apply risk). The wrapper is both the safety mechanism and the
  signal.
- **Composes with everything declarative** — `ensure` is the CLI face of desired-state (#6939); the
  workflow/DU is the CLI face of sagas/compensation for the irreducibly-effectful.

## Honest scope / peel

- Design principle + Ace verb/noun grammar, not built. `ace ensure` + the `namespace[source].package` noun path
  + the idempotent-default/DU-wrapped-non-idempotent rule are the spec; implementation pending (the Ace lane
  081KSGS9H0008QG0R0031PBNGA/#6939; the IDL #6955 likely declares verbs' idempotency as a capability attribute).
- Not every command is cleanly idempotent-or-not; some are idempotent-with-a-key (the dedup-key case). The rule
  is the *default + the explicit-fence-when-not*, not a claim everything bisects perfectly.

## Ties

- **Idempotency discipline (#6 always-active; dv2-data-split rule)** — "apply-N-times == apply-once; else add a
  dedup key or name the non-idempotence." This is that, as a CLI rule; the DU/workflow *names* it.
- **CLI seam/verb/noun grammar (#6957)** — `ace ensure namespace[source].package`; `ensure` the idempotent verb,
  `[source]` parameterizes the seam/registry on the noun.
- **Ace external-state closure / declarative desired-state (#6939) + compile-time conflicts (#6940)** — `ensure`
  is the desired-state verb; conflicts caught at compile time.
- **Reversible-destruction covenant (#6896)** — compensation in the non-idempotent workflow = reversible side
  effects.
- **Capture-vs-Ferry DU / workflow engine (#6918; 081KSKBP80008QG0R000B3Y19A)** — the DU/workflow wrapper for non-idempotent ops.
- **Test seam (#6958)** — idempotent commands are trivially DST-replayable.
- **Zeta IDL (#6955)** — idempotency could be an IDL-declared attribute of a verb/capability.

## Beacon anchors

- **Idempotency** in API design: **REST `PUT`/`DELETE` idempotent vs `POST` not**; **`kubectl apply`** /
  **Terraform** / **Ansible** / **Nix** desired-state convergence (idempotent `ensure`) vs imperative
  one-shots. · **Idempotency keys** (Stripe — making `POST`/payments safely retryable). · **Sagas /
  compensating transactions** (Garcia-Molina & Salem 1987) for the non-idempotent/effectful case. ·
  **Discriminated unions / sum types** to make operation state explicit. Honest novelty: none — it records the
  Ace `ensure` verb + `namespace[source].package` noun grammar and the CLI design principle **idempotent by
  default; wrap non-idempotent commands in a workflow/DU that names the non-idempotence** (the always-active
  idempotency discipline #6, typed for commands).
