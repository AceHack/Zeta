---
name: External dependency download retries — durable fix in code, not ephemeral rerun via workflow (Aaron 2026-04-29)
description: Aaron 2026-04-29 — *"we can retury on external dependency download failures, this goes against DST but we have not choice they are external dependencies we need.  Next time instead of kicking a 2nd build we should fix it and reduce friction for future builds."* External dependency downloads (toolchain installers, language runtimes, package mirrors, registry fetches) ARE the DST exception class — we have no choice; they are external and uncontrollable. BUT the fix location matters: durable retry-with-backoff inside the code (e.g., curl_fetch with --retry 5 in tools/setup/) reduces friction for FUTURE builds; ephemeral `gh run rerun --failed` only papers over THIS build and the friction returns next time. Composes with the 2026-04-23 DST-retries-are-smell rule (external-uncontrollable exception was already implied; this names the concrete domain + pins the fix to the durable layer).
type: feedback
---

# External dependency download retries — durable fix, not ephemeral rerun

## Source

Aaron 2026-04-29 (mid-tick correction during autonomous-loop):

> *"we can retury on external dependency download failures,
> this goes against DST but we have not choice they are
> external dependencies we need.  Next time instead of kicking
> a 2nd build we should fix it and reduce friction for future
> builds."*

Typos preserved per
`memory/feedback_aaron_channel_verbatim_preservation_anything_through_this_channel_2026_04_29.md`
("retury" / "have not choice" / double-space — Aaron's exact
wording is signal).

## Trigger context

Earlier in the same session (`docs/hygiene-history/ticks/2026/04/29/`
shards prior to 0546Z), the autonomous-loop hit a transient
elan-toolchain `502` while CI was downloading the Lean 4
installer. I resolved it by running `gh run rerun --failed` —
the 2nd build succeeded because the upstream blip cleared.
Aaron's correction names that resolution as the wrong fix
location: the rerun made THIS build pass, but it did nothing
to reduce friction for the NEXT build that hits the same
mirror flake.

The right fix location is **inside the code**: the call site
that downloaded the elan installer in
`tools/setup/common/elan.sh` (the `elan-init.sh` curl-to-tmp
download) used raw `curl -fsSL` rather than the retry-equipped
helper `tools/setup/common/curl-fetch.sh::curl_fetch` that
already existed. Migrating elan.sh (and the parallel gap in
`tools/setup/linux.sh` for the mise tarball download) to
`curl_fetch` is the durable fix. (Line numbers omitted —
shell sources churn lines fast; grep for the URL constants
or the `curl_fetch` call to locate the current sites.)

## The rule (load-bearing)

```text
External dependency downloads are a recognized DST exception:
  - toolchain installers (elan-init.sh, mise tarballs,
    homebrew install.sh, dotnet-install.sh, rustup-init.sh)
  - language runtime fetches (Lean toolchain pull, .NET SDK
    download)
  - package-registry pulls (NuGet restore, npm/bun install,
    cargo fetch, lake update)
  - GitHub release artifact downloads
  - container registry pulls (in CI runners)
  - git clone / fetch from upstream remotes

These ARE external + uncontrollable. We have no choice; the
factory needs them. Retry-with-backoff is legitimate per the
existing 2026-04-23 DST-retries-are-smell rule's "real
external uncontrollable reasons we can't control" exception.

The fix location matters:

  Durable layer (PREFERRED) — retry inside the code:
    - curl_fetch with --retry 5 --retry-delay 2
      --retry-all-errors (file-output)
    - dotnet restore with retry-equipped HTTP client
    - mise install with curl-fetch.sh helper
    - bun install / npm install with retry config
    Effect: future builds inherit the retry; same flake
    doesn't fail again.

  Ephemeral layer (LAST RESORT) — rerun the build:
    - gh run rerun --failed
    - re-trigger the workflow
    Effect: THIS build passes; same flake fails next time;
    friction reaccumulates over the fleet of contributors
    + autonomous loop ticks.

The rule: when an external-dep download fails, FIRST check
whether the call site uses the retry-equipped helper. If not,
THAT is the durable fix. Only fall back to rerun if the
helper is already in use AND the failure is a one-shot
upstream incident that retry-equipped code already handled
on the second attempt.
```

## How to apply

When CI fails on a transient external-dependency download:

1. **Identify the call site.** The failure log names the
   URL + the script. Open that script.
2. **Check whether it uses the retry-equipped helper.**
   For shell scripts: is `curl_fetch` (or `curl_fetch_stream`
   for installers piped to `sh`) sourced and used? For .NET:
   does the dotnet command use the retry-equipped
   `--source` / `--retry-on-error` flags or HTTP client?
   For Node: is the package manager configured with retries?
3. **If the helper is bypassed, that IS the durable fix.**
   Migrate the call site to the helper.
4. **If the helper is already in use AND the retry didn't
   recover**, the failure is a deeper incident:
   - Is the upstream service down for an extended window?
     (Check status pages.)
   - Is the URL pinned to a removed release? (Check
     upstream.)
   - Is the SHA256 mismatch deliberate (upstream
     republished)? (Investigate.)
   In these cases, `gh run rerun --failed` is rarely the
   right answer — the friction needs different shape (URL
   bump, mirror swap, fallback source).
5. **If genuine one-shot blip** (status pages clear, helper
   in use, no upstream incident, retry-policy exhausted on
   this exact moment), THEN `gh run rerun --failed` is OK.
   But this is the rare case, not the default reach.

## Worked example: 2026-04-29 elan-toolchain 502

Sequence:
1. Autonomous-loop tick CI hit a 502 from
   `raw.githubusercontent.com/leanprover/elan/...elan-init.sh`.
2. I ran `gh run rerun --failed`. 2nd build passed (transient
   blip cleared).
3. Tick-history shard logged this as
   "transient-CI-infrastructure-flake recovered via rerun."

Aaron's correction surfaced what was wrong with this
sequence: I treated the rerun as the resolution. The actual
resolution (per this rule) is migrating the elan.sh
call site to `curl_fetch` so the next 502 is absorbed by
`--retry 5` inside the install script.

The durable fix lands as part of the 2026-04-29 mid-tick
correction:

```diff
# tools/setup/common/elan.sh
-  curl -fsSL "${ELAN_INIT_URL}" -o "${ELAN_INIT_TMP}"
+  source "$REPO_ROOT/tools/setup/common/curl-fetch.sh"
+  curl_fetch --output "${ELAN_INIT_TMP}" "${ELAN_INIT_URL}"

# tools/setup/linux.sh — same migration for mise tarball
-  curl -fsSL "${MISE_URL}" -o "${MISE_TMP}/${MISE_TARBALL}"
+  curl_fetch --output "${MISE_TMP}/${MISE_TARBALL}" "${MISE_URL}"
```

(linux.sh already has REPO_ROOT + SETUP_DIR set up, just
needs the `source` line. elan.sh is invoked as a subprocess
from linux.sh + macos.sh, so it must source curl-fetch.sh
itself — sourcing in the parent does NOT propagate to
subprocess shells.)

## What this rule does NOT mean

- Doesn't mean "add retries everywhere." The DST rule still
  applies for INTERNAL non-determinism — internal retries
  remain a smell that needs root-causing.
- Doesn't mean "never rerun a build." Genuine one-shot
  upstream blips that the retry-equipped code already
  exhausted ARE the rare legitimate rerun case.
- Doesn't mean "all external = retryable." The exception is
  scoped to **download / fetch failures from external
  services that the factory legitimately depends on**. A
  retry is NOT legitimate for, e.g., a flaky test that
  happens to hit an external service if the underlying flake
  is in our test code, not the external dep.
- Doesn't mean "ignore the friction entirely." Retry adds
  latency on the slow path; the right shape is exponential
  backoff with a bounded ceiling, not infinite retries.

## Composes with

- `memory/feedback_retries_are_non_determinism_smell_DST_holds_investigate_first_2026_04_23.md`
  — the parent DST rule. This 2026-04-29 entry is the
  concrete-domain refinement: external dep downloads ARE the
  exception class, AND the fix lives in the code not the
  workflow.
- `tools/setup/common/curl-fetch.sh` — the existing
  retry-equipped helper, originally landed per Aaron's
  2026-04-28 framing
  (*"curl 502 pattern i mean why should a PR ever fail for
  this? our code does not handle the retries already?"* +
  *"sounds like a common helper would help too rather than
  copy/paste."*). This rule extends that direction by adding
  the rerun-vs-fix-location distinction.
- `memory/feedback_aaron_channel_verbatim_preservation_anything_through_this_channel_2026_04_29.md`
  — Aaron's correction is preserved verbatim above per the
  channel-verbatim rule.
- `memory/feedback_otto_355_blocked_with_green_ci_means_investigate_review_threads_first_dont_wait_2026_04_27.md`
  — same pattern at the PR layer: investigate the cause
  first, don't reach for the wait/rerun shortcut.

## Distilled keepers

```text
External dep downloads ARE the DST exception.
We have no choice; they're external.
Retry is legitimate at this boundary.
```

```text
Fix the friction in the code, not in the workflow.
gh run rerun --failed only saves THIS build.
curl_fetch in the script saves EVERY future build.
```

```text
Aaron 2026-04-29:
  "instead of kicking a 2nd build we should fix it
   and reduce friction for future builds."
```
