---
id: 081KZYD1M71087G0R0022GS3ZH
type: bug
state: backlog
priority: P2
slug: support-js-postmessage-handler-has-no-origin-check-14-org-pa
title: "support.js postMessage handler has no origin check — 14 org pages, matters when login lands"
created: 2026-08-13T20:29:31.233Z
depends_on: []
composes_with: []
---

# support.js postMessage handler has no origin check — 14 org pages, matters when login lands

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYD1M71087G0R0022GS3ZH-*.md` glob. -->

## The alert

CodeQL `js/missing-origin-check`, **medium**, at
`docs/design/root-site-iris/site/support.js:1281`. Surfaced on PR #10367, which landed
Iris's `site/` deliverable verbatim from her 2026-07-03 design-handoff zip.

```js
window.addEventListener("message", (e) => {
  const type = e.data && e.data.type;
  if (type === "__dc_theme") {
    const t = e.data.theme;
    if (t === "light" || t === "dark") {
      appTheme = t;
      doc.documentElement.dataset.theme = t;
      applyCanvasBg();
    }
    return;
  }
  if (!designDocMode || type !== "__dc_probe") return;
  postDesignMode(designDocMode);
});
```

No `e.origin` check. Any page that frames one of ours, or any window holding a handle to
one, can post to it.

## Honest severity TODAY: low

- `__dc_theme` only accepts the literal strings `"light"` or `"dark"` — the value is
  allowlisted before it reaches `dataset.theme`, so there is no injection path. Worst case
  is an embedding page flipping our theme. Cosmetic.
- `__dc_probe` replies with `designDocMode` — a design-mode flag. Minor information
  disclosure, and only when that mode is on.

CodeQL is right about the pattern and roughly right about the rating; it is not right that
this is exploitable for anything interesting *as the page stands today*.

## Why it is filed anyway: it stops being cosmetic the moment login lands

Aaron, 2026-08-13: *"we also need the ability to login eventually so it can commit back or
some hack we are trying to do it without a backend server."*

A `message` listener with no origin check on a page that later holds a credential is the
wrong foundation, and the gap is easy to miss because it is in a vendored runtime nobody
re-reads. Whatever auth arrives — device flow, a token in `localStorage`, an API key — it
will live on pages that already accept unauthenticated cross-origin messages. Fix the
origin check BEFORE the credential exists, not after.

## Blast radius: 14 pages, all of them

`support.js` is loaded by **every** org-site page — concepts, dora, gitpull, hall, index,
llmtv, lodge, mesh, portal, settlement, track00, track00b, vault, vaults — and
`docs/design/root-site-iris/HANDOFF.md` marks it `(page runtime; required)`. It is also
precached by `sw.js`.

## Why I did not patch it

`site/` is carried **wholesale** to `lucent-financial-group.github.io` and must byte-match
what Iris ships. It is also a design-tool runtime, so a hand-edit is overwritten on her
next export — the same regeneration hazard Iris independently flagged for
`styles.css` losing its `@import "./zeta-state.css"` line.

So the fix belongs upstream in the export, or in a documented post-export patch step, not
in a silent local edit.

## Fix shape

Add an origin allowlist at the top of the handler — accept only the known origins
(`lucent-financial-group.github.io`, the `/Zeta/` project-site origin, and whatever the
design tool needs for its own preview) and drop everything else:

```js
const ALLOWED = new Set([location.origin, /* design-tool preview origin */]);
window.addEventListener("message", (e) => {
  if (!ALLOWED.has(e.origin)) return;
  // …existing body…
});
```

The awkward part is the design-tool preview origin — that is what the handler exists to
serve, so the allowlist has to include it without opening the door generally. Needs Iris,
since only she knows what the tool posts from.

## Related

- PR #10367 — the deliverable this arrived with; CodeQL flags it there.
- Iris's `_ds/` regeneration hazard — same class: the design tool overwrites hand-fixes,
  so both need a post-export lint rather than a one-time edit.
