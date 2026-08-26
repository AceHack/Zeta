# Named index — *You, Born at the Hinge*

<!-- DERIVED FILE. Do not hand-edit. -->
<!-- Regenerate: bun src/Core.TypeScript/hygiene/book-named-index.ts --write -->

> **Person -> everywhere they appear.** Generated from the `consent:begin` / `consent:end`
> markers in the prose and the roster in [`consent-events.json`](consent-events.json). It exists so a
> subject can be shown their **whole footprint** — the question they actually have is *"what does
> this book say about me?"*, and no passage-level diff answers that. Consent binds to the
> **footprint hash** below, so a revision produces a *delta* to look at rather than a fresh read of
> everything.

> **This file is derived and is checked.** `book-named-index.ts --check` fails when it disagrees
> with the prose, and `audit-book-named-index.ts` fails when a person appears in the prose with no
> marker on them. The second one is the load-bearing half: without it this index would under-report
> silently, and somebody would consent against an incomplete picture.

Design and limits: [`NAMED-INDEX-DESIGN.md`](NAMED-INDEX-DESIGN.md). Scope, conditions and reasoning
stay in [`CONSENT-LEDGER.md`](CONSENT-LEDGER.md) — this file holds only what is computed.

## Nobody is on the roster yet

`consent-events.json` carries zero people, so this index is empty and the coverage audit has
nothing to look for. **That is a count, not a clearance.** The book names real people today; what
is missing is the roster that would let a machine see them.

`bun src/Core.TypeScript/hygiene/book-named-index.ts --suggest-roster` reads the subject column of
`CONSENT-LEDGER.md` and prints roster entries to start from. It writes nothing and decides nothing:
aliases and `indexState` are human calls, and the suggestion says so per row.
