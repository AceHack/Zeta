---
id: 081M24FW4C0087G0R003EQRCYY
type: bug
state: backlog
priority: P2
slug: npm-ci-with-an-npm-install-fallback-is-a-check-with-a-bypass
title: "npm ci with an npm install fallback is a check with a bypass; two workflows carry it"
created: 2026-09-10T01:45:47.136Z
depends_on: []
composes_with: []
---

# npm ci with an npm install fallback is a check with a bypass; two workflows carry it

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M24FW4C0087G0R003EQRCYY-*.md` glob. -->

## What was open

Scorecard `PinnedDependenciesID` alerts 782 and 783 -- "npmCommand not pinned by
hash" -- at `agentic-organization-integration.yml:78` and
`agentic-organization-tests.yml:108`. Both files carried the identical idiom:

```yaml
if ! npm ci; then
echo "::warning title=stale lockfile::npm ci failed; falling back to npm install."
npm install
fi
```

## What the alert text did not name

A CHECK WITH A BYPASS IS NOT A CHECK. `npm ci` and `npm install` are not
interchangeable: `ci` installs exactly the committed lockfile and FAILS when
`package.json` and the lockfile disagree; `install` is free to resolve different
versions and to REWRITE the lockfile.

So the fallback answered "the pinned dependency graph does not apply here" by
installing an UNPINNED one, and downgraded that from a failure to a `::warning`
-- a line in a log nobody reads. Scorecard was pointing at the second command;
the defect is that there was a second command at all.

## A comment that had gone false

The step carried a standing justification:

> `npm ci` is the reproducible form and is what should run; the fallback exists
> because package-lock.json here predates some workspace additions.

MEASURED 2026-09-10: `npm ci --dry-run` in `agentic-organization/` exits 0 and
adds 20 packages. The lockfile does NOT predate the workspace additions -- it is
current. The stated reason for the bypass had stopped being true and nothing
re-checked it, which is the same class as a stale doc asserting a live claim.

That is also why removing the fallback is safe rather than brave: it changes
nothing about what runs today. It changes what happens the day the lockfile does
go stale -- red instead of a silent unpinned install.

## Verification

- `npm ci --dry-run` rc=0 before the change (the measurement above).
- `actionlint` rc=0 on both files.
- No executable `npm install` remains in either workflow; the only matches are
  in the YAML comments explaining why it is gone.
