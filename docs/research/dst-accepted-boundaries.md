# DST Accepted Boundaries — Registry

Scope: research-grade DST-accepted-boundary registry from a courier-ferry import; documents where the factory deliberately does not route through the simulation layer.

Attribution: Amara (named-entity peer; first-name attribution per Otto-279) provided content via 19th courier ferry. Architect review integrates and authors.

Operational status: research-grade

Non-fusion disclaimer: Amara's contributions and Otto's framing/integration are preserved with attribution boundaries; agreement on accepted-boundary criteria does not imply shared identity or merged agency.

(Per GOVERNANCE.md §33 archive-header requirement on external-conversation imports.)

**Status:** research-grade registry (pre-v1). Origin: Amara
19th courier ferry, Part 2 correction #3 (retry audit for
`tools/git/push-with-retry.sh`) and DST-held minimum bar
item #6 from `docs/research/dst-compliance-criteria.md`.
Author: architect review.

## 1. What this registry is

`docs/research/dst-compliance-criteria.md` §2 item #6
requires:

> File / network / time / random / task-scheduling
> boundaries are either simulated or explicitly marked as
> accepted external boundaries.

An **accepted external boundary** is a place where the
factory deliberately does not route through the simulation
layer because the boundary is genuinely outside our
control (external network, operating-system calls, git
remote protocol, etc.). Each boundary is listed here with:

1. The code location.
2. The entropy class the boundary crosses.
3. Why simulation is not the right answer for this site.
4. What investigation has already been done.
5. What would trigger revisiting.

This is not a loophole. It is the discipline: every
un-simulated entropy surface is either on this list with
rationale, or it is a DST-held compliance gap. No silent
boundary exceptions.

## 2. Registry shape

Each entry follows the schema:

```text
### <relative path>

- **Entropy class:** <one or more of the 12 DST entropy
  classes, comma- or `+`-separated when a site genuinely
  crosses multiple (e.g. a network boundary whose only
  retry policy is itself a distinct entropy source)>
- **Scope:** main-path / tools-path / samples-path / tests-path
- **Classification:** ACCEPTED_BOUNDARY
- **Rationale:** 1-3 sentences on why simulation does not
  fit this site.
- **Investigation performed:** what was checked before
  classifying.
- **Retry discipline (if applicable):** logging, caps,
  targeted-only (not blind).
- **Revisit triggers:** conditions that would reopen this
  classification.
- **First classified:** YYYY-MM-DD tick reference.
```

## 3. Entries

### `tools/git/push-with-retry.sh`

- **Entropy class:** external network I/O +
  retry-on-failure (retries are a non-determinism smell
  per the DST skill).
- **Scope:** tools-path (never imported from `src/Core/`;
  called only by developer / CI scripts wrapping
  `git push`).
- **Classification:** ACCEPTED_BOUNDARY.
- **Rationale:** `git push` to `github.com` crosses the
  factory/GitHub boundary. The HTTP 500s the wrapper
  retries on are genuinely external transients originating
  at GitHub's server. Simulation is not applicable — we
  are not simulating GitHub. Routing through a simulated
  network would mask the real boundary rather than handle
  it.
- **Investigation performed** (quoted from the script's
  own header comment block, 2026-04-23):
  - Local git config clean: no trailing-slash URL bug.
  - `GIT_TRACE=1 GIT_CURL_VERBOSE=1 git ls-remote origin`
    confirmed the on-wire URL is correct per Git protocol
    spec.
  - HTTP 500 reproduces intermittently on different
    commands (push / ls-remote), consistent with an
    external GitHub-server-side transient.
- **Retry discipline:**
  - **Targeted only:** retries ONLY on explicit 5xx
    patterns (`500 | 502 | 503 | 504 | Internal Server
    Error | Bad Gateway | Service Unavailable | Gateway
    Timeout`). Non-transient errors (auth, protected-
    branch, hook, divergence) propagate immediately.
  - **Capped:** default 3 attempts; overridable via
    `GIT_PUSH_MAX_ATTEMPTS`.
  - **Backoff:** exponential (2s → 4s → 8s default).
  - **Logged:** each retry emits
    `push-with-retry: transient 5xx on attempt
    N/MAX; retrying in Ks...` to stderr; after exhaustion
    emits `failed after MAX attempts on transient 5xx`.
  - **Error-text preserved:** `tee "$tmp_stderr"` keeps
    the full git-push stderr output visible + usable for
    downstream diagnosis.
  - **Exit codes distinct:** 0 = success; 1 = all retries
    exhausted; 2 = env validation failed; N = non-transient
    error (git push's own code).
- **Revisit triggers:**
  - 5xx rate escalates beyond the "intermittent transient"
    pattern (sustained 5xx → investigate for GitHub
    incident or factory config regression before
    retrying).
  - Investigation surfaces a new root cause (client-side
    bug, auth drift, proxy issue).
  - Factory adopts a simulated remote for offline /
    isolated-CI mode — the wrapper's behavior should
    compose with a simulated endpoint when one exists.
- **First classified:** 2026-04-23 (initial implementation);
  formally registered Otto-168 2026-04-24 after Amara 19th-
  ferry correction #3 audit.

## 4. Pending classifications

Boundaries identified by the Amara 19th-ferry entropy-
source scan (Part 1 §2) but not yet formally registered:

- `DiskBackingStore.fs` (planned, not yet landed in
  `src/` — referenced here as the target of PR 5 of the
  19th-ferry revised roadmap) — will be classified BLOCKER
  on landing and immediately migrated to SIMULATED via
  `ISimulationFs` (also planned, not yet landed). The
  BLOCKER → SIMULATED transition is the PR 5 body of
  work; this registry entry is the forward-looking
  placeholder so the accepted-boundary scan has a row to
  compare against when the code arrives.
- Future network I/O for multi-node scenarios — also
  BLOCKER until PR 8 simulates it.
- All other 12 entropy sources in §2 report "not found
  in core"; no boundary entry needed unless they appear.

## 5. Classification migration rules

A boundary's classification follows this lifecycle:

- **DETECTED** — entropy-scan finds a hit in
  main-path code; action required.
- **BLOCKER** — detected and must be simulated before
  DST-held can be claimed. Example: `DiskBackingStore`.
- **SIMULATED** — wrapped in an `ISimulation*` interface;
  no longer a boundary.
- **ACCEPTED_BOUNDARY** — left un-simulated on purpose;
  registered here with rationale.
- **REJECTED** — originally accepted, but investigation
  reveals a client-side fix or simulation is feasible;
  migrate to SIMULATED.

Moves between classifications are tracked by this
registry's git history, not by an additional audit log.

## 6. Relationship to the entropy-scanner

Once PR 1 of the 19th-ferry revised roadmap lands a
`tools/dst/entropy-scan.*` implementation, the scanner
consumes this registry as its accepted-boundary list.
Findings that match a registry entry are reported as
ACCEPTED_BOUNDARY rather than BLOCKER/HIGH/MEDIUM.
Findings that do not match must either fix the code or
add a registry entry with rationale.

## 7. Promotion path

This registry is research-grade today. Promotes to
`docs/DST-ACCEPTED-BOUNDARIES.md` (top-level) in the same
ADR that promotes `docs/research/dst-compliance-criteria.md`
→ `docs/DST-COMPLIANCE.md` (PR 1 of the 19th-ferry revised
roadmap). Until then, entries here are citable by code
comments but not enforced by CI.

## 8. Cross-references

- `docs/research/dst-compliance-criteria.md` — the
  acceptance-criteria doc that requires this registry.
- Amara 19th ferry — `docs/aurora/2026-04-24-amara-dst-
  audit-deep-research-plus-5-5-corrections-19th-ferry.md`
  (PR #344 merged), Part 2 correction #3.
- `tools/git/push-with-retry.sh` — the first entry.
- `.claude/skills` DST guide — the rulebook classifying
  retries as a non-determinism smell unless at explicitly
  documented boundaries.
