# Zeta CodeQL customisation — what works on first-party code, and what does not

`.github/codeql/codeql-config.yml` carried a commented-out `packs:` slot
"reserved for the follow-up round that ships Zeta-specific taint / CWE rules".
This directory is that round. It does not ship rules, and the reason is a
measurement rather than a preference.

Everything below was measured with **CodeQL CLI 2.27.0** (the bundle
`github/codeql-action` v4.37.9 resolves), `codeql/javascript-all@2.10.1`,
`codeql/javascript-queries@2.4.5`, against fixtures committed in `test/`.
Every number is reproducible with the commands given.

## TL;DR

| mechanism                                                                                   | reaches a query compiled **inside a pack** | reaches a **built-in** query |
| ------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------- |
| `barrierModel` data extension, delivered via a local query pack's `dataExtensions`          | **yes**                                    | **no**                       |
| `barrierModel` data extension, delivered via `--model-packs` (`--extension-packs`)          | **yes**                                    | **no**                       |
| the same, with the config baked in by `database create --codescanning-config` (the CI path) | **yes**                                    | **no**                       |
| `sinkModel` data extension (control — does the row arrive at all?)                          | **yes**                                    | **no**                       |
| subclassing the query's `abstract class Sanitizer` from a separate pack                     | **yes**                                    | **no**                       |
| **a guard in the first-party code that the DEFAULT taint barriers already recognise**       | yes                                        | **YES**                      |

Only the last row changes what a CodeQL scan reports, so only the last row can
close an alert. It is also the only one of the six that makes the program
safer, which is the point: the alert gets **fixed**, not explained.

## 1. Data extensions do not reach built-in queries

`js/log-injection` looks like the best possible case for a data extension. Its
library file opts into models-as-data explicitly —
`LogInjectionQuery.qll:93`:

```ql
private class SanitizerFromModel extends Sanitizer {
  SanitizerFromModel() { ModelOutput::barrierNode(this, "log-injection") }
}
```

and models-as-data can address first-party code, through the `file:<path>` type
that `ApiGraphModelsSpecific.qll` resolves via `RawFilePathEntryPoint`. So a
`barrierModel` row naming a Zeta sanitizer ought to close the alert.

It does not. The decisive run put a **byte-identical clone** of the shipped
`Security/CWE-117/LogInjection.ql` inside a local pack that declares the
extension, next to the shipped query itself, in one `database analyze`
invocation over one database:

|                   | clone, compiled in the pack | built-in `js/log-injection` |
| ----------------- | --------------------------- | --------------------------- |
| extension present | **0**                       | **1**                       |
| extension emptied | 1                           | 1                           |

Same query text, same database, same suite (`rules_count: 106`, with
`js/log-injection` confirmed present in `tool.driver.rules`). The barrier is
honoured by the copy and ignored by the original, so the difference is _which
pack the query was compiled in_, not anything about the flow.

Four things were ruled out along the way, each with its own run:

- **Not a resolution failure.** `codeql resolve extensions --model-packs=… --
<the built-in query>` lists the Zeta `barrierModel` row against
  `codeql/javascript-queries` — the row is found and considered applicable.
- **Not a `.qlx` cache.** Deleting the precompiled `LogInjection.qlx` from the
  bundle so the CLI had to compile from source changed nothing: still 1.
- **Not delivery.** Three delivery routes were tried — a local query pack's
  `dataExtensions`, `--model-packs` with a `library: true` extension pack, and
  `database create --codescanning-config` (what `github/codeql-action` actually
  does) — all three give the same answer.
- **Not specific to barriers.** Swapping the row for a `sinkModel` that should
  create a _new_ alert had the same asymmetry: the in-pack clone went 1 → 2,
  the built-in query stayed at 1. The rows simply do not arrive.

Two structural facts are worth recording next to that, because they close off
the routes that look available on paper:

- **`js/file-access-to-http` and `js/http-to-file-access` have no MaD hook at
  all.** `FileAccessToHttpCustomizations.qll` and
  `HttpToFileAccessCustomizations.qll` contain zero `SanitizerFromModel`
  classes, so even where extensions did arrive they could not affect these two.
  The queries that DO opt in, by kind, are: `log-injection`, `path-injection`,
  `url-redirection`, `sql-injection`, `nosql-injection`, `command-injection`,
  `code-injection`, `html-injection`, `unsafe-deserialization`,
  `request-forgery`, `cors-origin`, `credentials-*`.
- **An extension pack cannot be delivered by name from the Action config.**
  `packs:` in `.github/codeql/codeql-config.yml` is validated against
  `^[a-z0-9](-*[a-z0-9])*\/[a-z0-9](-*[a-z0-9])*$` (`src/config/db-config.ts` in
  `github/codeql-action`) — a **registry** pack name. An unpublished in-repo
  pack cannot be named there. The `model-packs` key exists only under
  `default-setup.org`, which is not user-supplied. And a pure extension pack may
  not contain queries or dependencies ("Invalid QL Pack: extension packs cannot
  define dependencies"), so it cannot ride in on `queries: - uses: ./path`
  either.

**Consequence for anyone reaching for this next:** a model pack is the right
tool for teaching CodeQL about a **library** it does not model. It is not a tool
for telling a shipped query that your own function is safe. If a first-party
sanitizer genuinely needs to be recognised, the change belongs upstream in
`github/codeql` — adding the missing `SanitizerFromModel` class, or fixing
whichever layer drops the rows — not in a pack here.

## 2. Subclassing the query's `Sanitizer` does not reach it either

`FileAccessToHttpCustomizations.qll` exposes `abstract class Sanitizer`, which
reads like an extension point. It is one — for queries compiled in the same
pack. A separate pack that subclasses it with the maximal
`Sanitizer() { any() }` drove its own copy of the flow to **0** while the
built-in `js/file-access-to-http` stayed at **6** in the same run. QL abstract
classes are resolved per query-compilation closure, and a custom pack is not in
the built-in query's closure.

## 3. What does work: guards the default taint barriers already recognise

`TaintTracking::Global` applies `defaultTaintSanitizer` to **every** taint
configuration, including the two queries with no MaD hook. That set includes
`WhitelistContainmentCallSanitizer` (an allowlist membership test),
`SanitizingRegExpTest` (a regular-expression test), `MembershipTestSanitizer`,
`InSanitizer` and others. A first-party guard written in one of those shapes is
a barrier for the shipped query, with no customisation anywhere.

Measured on `test/file-access-to-http/`, one credential-reading helper and three
consumers that differ only in their guards:

| fixture             | guards                                    | `js/file-access-to-http`                      |
| ------------------- | ----------------------------------------- | --------------------------------------------- |
| `unguarded.ts`      | none                                      | **2** (destination, and credential)           |
| `partly-guarded.ts` | origin allowlist only                     | **1** (the credential flow it does not cover) |
| `guarded.ts`        | origin allowlist **and** token-shape test | **0**                                         |

The middle row is the one that makes this a guard rather than a suppression:
covering one flow closes one alert and leaves the other standing.

This is what `full-ai-cluster/portal/src/data-k8s.ts` now does. A projected
ServiceAccount token is a JWT, so the constructor refuses anything that is not
one before presenting it as a bearer credential — a real failure mode
(misconfigured projection, wrong volume, replaced file), not a formality.
Measured on that file: **3 alerts before (#180, #192, #262), 0 after.**

## 4. The `js/log-injection` alert on `realtime-client.ts`, diagnosed

That alert is left OPEN on purpose, and this section is why.

`sanitizeForLog` maps the whole C0/DEL/C1 class to a space. A previous attempt
assumed `js/log-injection` refuses a character RANGE and named `\r` and `\n`
explicitly ahead of it; the alert survived and merely moved line, and the file
records that the shape hypothesis would then be wrong. It is wrong, and
`test/log-injection/variants.ts` pins the actual discriminator by varying one
thing at a time:

| shape                                                          | reported?                              |
| -------------------------------------------------------------- | -------------------------------------- |
| `.replace(/\n/gu, "")`                                         | no                                     |
| `.replace(/[\r\n]/gu, "")`                                     | no — **the range was never the issue** |
| `.replace(/\n/gu, " ")`                                        | **yes**                                |
| `.replace(/[\u0000-\u001F\u007F-\u009F]/gu, " ")` (what ships) | **yes**                                |

`StringReplaceSanitizer` holds only when `StringReplaceCall.replaces(old, new)`
has `new = ""`. The **replacement string** decides it; the regex does not.

So the shipping function is strictly safer than both of the shapes CodeQL
accepts — it strips ESC and the rest of the control class, not just the two
famous members — and is reported precisely because it replaces with a space
instead of deleting. Deleting would satisfy the query and cost the
length-preserving property that `realtime-client.ts` argues from and its tests
assert. That is a behaviour decision for that file's author, not something to
change from a CodeQL round, and it is not something to dismiss either. The
measurement is recorded here so the decision can be made from facts.

## 5. The two `js/file-access-to-http` alerts left on `safe-io.ts`, diagnosed

Alerts #933 and #934 sit on the two `fetch` calls in
`src/Core.TypeScript/io/safe-io.ts`. That file already refuses a scheme it will
not fetch, so it looks like it should be closed by section 3 — and it is not,
for a reason worth writing down before someone re-derives it.

The refusal is written as

```ts
const refusal = checkUrl(url);
if (refusal !== null) return fail(refusal);
```

and `checkUrl` tests `ALLOWED_PROTOCOLS.has(parsed.protocol)` on a value it
derived from `url`. Both halves miss:

- the guard at the call site tests `refusal`, not `url`, so no barrier lands on
  the value that flows to `fetch`;
- the membership test inside `checkUrl` guards `parsed.protocol`, which is a
  different node from `url` and is not what reaches the request.

A barrier would need the membership or regular-expression test to be applied to
`url` itself on the branch that continues. That is a real refactor of a core IO
primitive with a large test surface, and it is a separate change from this
round rather than something to bundle in behind it. Recorded here so the next
attempt starts from the mechanism instead of from the alert.

## Running the falsifier

```bash
codeql test run .github/codeql/custom-queries/zeta-security/test
```

Both suites must pass. `test/*/*.expected` pins the alerts that must SURVIVE as
tightly as the ones that must disappear, so a future guard, model or config
change that silences a true positive fails here rather than quietly widening.
The fixtures are deliberately vulnerable, which is why
`.github/codeql/codeql-config.yml` excludes this directory from the repository
scan — they are the control group, not Zeta code.
