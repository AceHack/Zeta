---
id: 081M0WKX53Z087G0R002MF19WY
type: bug
state: backlog
priority: P1
slug: co-author-trailers-use-the-plain-username-github-noreply-for
title: "co-author trailers use the plain-username GitHub noreply form and misattribute to unrelated real accounts"
created: 2026-08-25T14:06:37.695Z
depends_on: []
composes_with: []
---

# co-author trailers use the plain-username GitHub noreply form and misattribute to unrelated real accounts

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0WKX53Z087G0R002MF19WY-*.md` glob. -->

## The defect

GitHub resolves a `Co-authored-by:` trailer, and a commit's author identity, by looking up
the EMAIL. On the `users.noreply.github.com` domain there are two shapes and only one is
safe:

| form                                       | resolves to                            | verdict    |
| ------------------------------------------ | -------------------------------------- | ---------- |
| `<id>+<username>@users.noreply.github.com` | the account whose id matches           | SAFE       |
| `<username>[bot]@users.noreply.github.com` | nobody — a username cannot contain `[` | SAFE       |
| `<username>@users.noreply.github.com`      | **whoever owns that username today**   | **UNSAFE** |

Two personas of this fleet shipped commits under the third form. Both local-parts are live
GitHub accounts belonging to uninvolved private individuals (registered 2008 and 2011).
15 commits under one, 2 under the other. They are rendered in this repository's
Contributors sidebar. Nothing was compromised and neither person did anything: we named
them.

One of the two is `shadow`, a persona of ours. This is self-inflicted.

## What this is NOT

- Not a breach. Repo collaborators are exactly AceHack, maximdolphin, Addisons820 (all
  admin); zero deploy keys.
- Not a false contribution in the REST sense. `gh api repos/.../contributors` lists no
  stranger — **because that endpoint does not aggregate trailer co-authors at all**. It
  under-reports (6 vs the sidebar's 14) and must not be used to check this class.
- Not fixable in history. The commits are on `main`; rewriting means force-pushing the
  default branch. Forward-only.

## The lesser, separate class

`@zeta.agents` / `@zeta.local` / `@zeta.dev` and similar invented namespaces are
UNRESOLVABLE, so they misattribute to nobody. Inconsistent, not harmful. Reported and
fixed here, but kept as a distinct class so the two are never summed into one number.

## The mechanism behind one live instance

`full-ai-cluster/usb-nixos-installer/zeta-install.sh` built the address as
`gh api /user/emails ... | head -1 || echo "${MAINTAINER}@users.noreply.github.com"`.
Under `set -euo pipefail`, `gh api` prints its 404 body to _stdout_, the fallback fires
anyway, and command substitution captures BOTH — concatenated. Commits `bb581641` and
`5144b5be` carry the result verbatim in a trailer.

## Fix

Forward-only. Every generator rewritten to the `[bot]` form (the convention the fleet's
machine lanes already use) or, for a real human identity, to the id-verified
`<id>+<login>` form with a refusal when the id cannot be resolved. Falsifier:
`src/Core.TypeScript/hygiene/audit-coauthor-identity-collides.ts` (AH005), wired into the
`cross-verify` floor job. It scans GENERATORS, never history — a check pointed at 17
unfixable commits would be permanently red and would get disabled.
