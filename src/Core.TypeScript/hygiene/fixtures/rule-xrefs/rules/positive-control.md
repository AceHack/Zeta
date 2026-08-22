# Positive control for `audit-rule-cross-refs`

Planted references, one per class the auditor claims to tell apart. This file is a
FIXTURE — an instrument that has never been shown to fire on a known positive is an
instrument nobody has checked. Read with the sibling archive dir `rules-archive/`.

## Live — resolves in the live rules dir

- span: `live-sibling.md`
- link: [`live-sibling.md`](live-sibling.md)

## Archived — resolves ONLY in the archive dir

The file exists; the reference names the wrong directory. Misleading, not missing.

- span: `archived-rule.md`
- link: [`archived-rule.md`](archived-rule.md)

## Dead — resolves nowhere

- span: `no-such-rule-anywhere.md`
- link: [`no-such-rule-anywhere.md`](no-such-rule-anywhere.md)

## Shorthand — an unqualified basename that is NOT a rule pointer

`shorthand-tool.ts` deliberately also exists in the archive dir. It must still come
back `dead`, never `archived`: the archive fallback is for `.md` rule siblings only,
and dragging every bare `.ts` into the rules-archive question is how a shorthand
reference gets mislabelled as a defect.

## Display / target agreement

Correctly-written links, which must NOT be reported as mismatches:

- file-relative display: [`../rules-archive/archived-rule.md`](../rules-archive/archived-rule.md)
- bare display, states no directory: [`live-sibling.md`](live-sibling.md)

## Display / target mismatch

The display text says one directory, the target resolves to another:

- [`some-other-dir/live-sibling.md`](live-sibling.md)
