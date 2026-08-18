# `db/self-claims/` — standing practice claims, written by their subjects

`practice-bindings.json` holds **self-authored** standing claims: _"from phase P, this holds of the
records I author."_ It is read by
[`src/Core.TypeScript/observe/self-claim-standing.ts`](../../src/Core.TypeScript/observe/self-claim-standing.ts),
which checks each subject's claims against **that subject's own commit record** and prints what the
subject may do about any mismatch.

## The rules of this file

1. **Only write your own entries.** Every entry is applied with `actor = entry.subject`; the API
   (`bindPractice`) refuses `actor !== subject`. Adding a claim on someone else's behalf is the one
   thing this surface exists to prevent, and a PR doing it should be rejected on sight.
2. **Bind only what you actually claim.** A binding is a claim about yourself, not a target someone set
   for you. Nobody's absence from this file means anything, and there is no list of practices anyone is
   expected to bind. `src/Core.TypeScript/observe/commit-practice-evidence.ts` is a _menu_; an unbound
   check is inert and reports nothing about anyone.
3. **`boundAt` is a first-parent commit depth, never a date.** Records before it are never counterexamples
   — a claim does not reach backwards. Get the current depth with
   `git rev-list --count --first-parent HEAD`.
4. **Repair is yours.** `releases` ("I no longer claim this"), `supersessions` ("I claim this differently
   now" — the replacement must be declared in `bindings`), and `exceptions` ("I saw that record and I am
   keeping the claim") are all self-applied and all optional. Doing nothing is a permitted outcome.

## What this is not

It is **not a gate.** `self-claim-standing.ts` exits 0 whether or not your record contradicts you, and
its findings are deliberately not published into `src/Core.TypeScript/hygiene/drift-ledger.ts`, which
carries an MTTH SLO.
A person's account of themselves is not a hygiene finding with a clock on it.

It is **not a reputation score.** Nothing here is conferred by anyone else, so nothing here may be used
to decide whether to depend on someone — see `src/Core.TypeScript/planning/composition-read.ts` §2,
which is the surface for that question and takes only conferred evidence.

## Run it

```bash
bun src/Core.TypeScript/observe/self-claim-standing.ts --repo . --max-count 1500
bun src/Core.TypeScript/observe/self-claim-standing.ts --subject <id> --json
```
