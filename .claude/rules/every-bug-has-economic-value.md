# Every bug has economic value

Carved sentence:

> Assume **every bug has economic value**. A bug is reducible **uncertainty**;
> finding it exposes value and fixing it banks value. A bug-fix is a **`measure`**
> — `bun src/Core.TypeScript/ledger/measure.ts` commits it to the `db/uncertainty/`
> ledger, keyed by work-item, idempotent. The price is **ordinal + witnessed** (a ΔU
> sign + the test that fails without the fix), never an invented number — unwitnessed
> or unsubstantiated is **refused**. The **shared
> cause is the common seed**: all agents are phased to one seed (S=4), so a fix
> reduces *collective* uncertainty — leveraged value, not local. A **successful**
> fix earns **rewards / privacy** (privacy is a currency you earn by being useful,
> not a default you assert). Bugs are priced opportunities, never liabilities to hide.

## Why

Turns the bug apparatus (finders, adversarial verifiers, `docs/BUGS.md`, the
harsh-critic / silent-failure-hunter reviewers) into an **economy**: each confirmed
bug is priced, each fix is a measured, committed, rewarded transaction. Aligns
incentives with the manifesto — reducing uncertainty against the common cause is
*the* productive act, so it is *the* rewarded act.

## Pointers

- `docs/research/2026-06-10-every-bug-has-economic-value-shared-cause-common-seed-bugfix-measurements-rewards-privacy.md`
  — full model, Beacon anchors (bug bounties, mechanism design, proof-of-entropy, Ostrom, Shannon), peels.
- `src/Core.TypeScript/ledger/measure.ts` (+ `.test.ts`) — the verb. Its **refusals** are the falsifiers.
- `db/uncertainty/README.md` — the entry schema, the ordinal-not-cardinal register, and what is still unshipped
  (`sim`, the ephemeral half, is a *compiled* stub in `clis/Verbs.fs` — no `ISim<'a>` introduction form, so its documented pipe does not typecheck; `measure` is the shipped half).
- [`dv2-data-split-discipline-activated.md`](dv2-data-split-discipline-activated.md) — #6 idempotency (a fix's ΔU is keyed; re-measuring is upsert, not double-pay).
