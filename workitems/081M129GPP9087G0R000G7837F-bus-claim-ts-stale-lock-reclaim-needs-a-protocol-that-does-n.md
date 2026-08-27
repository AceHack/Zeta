---
id: 081M129GPP9087G0R000G7837F
type: task
state: backlog
priority: P2
slug: bus-claim-ts-stale-lock-reclaim-needs-a-protocol-that-does-n
title: "bus/claim.ts stale-lock reclaim needs a protocol that does not unlink by path"
created: 2026-08-27T19:00:30.537Z
depends_on: []
composes_with: []
---

# bus/claim.ts stale-lock reclaim needs a protocol that does not unlink by path

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M129GPP9087G0R000G7837F-*.md` glob. -->

## The residue, stated precisely

`withItemLock` in `src/Core.TypeScript/bus/claim.ts` reclaims a lock it judges stale by
`unlinkSync(lockPath)`. Two fixes landed on 2026-08-27 and neither closes it:

1. `openSync` + `fstatSync(fd)` + `readFileSync(fd)` made the JUDGEMENT consistent — the holder PID
   and the mtime now come from one inode. Before, they could describe two different locks.
2. A dev+ino comparison immediately before the unlink makes REPLACEMENT DETECTABLE — if the holder
   released and someone else acquired, the inode differs and the unlink is skipped.

**What remains** is the window between that comparison and the `unlinkSync` itself. A path-based
unlink cannot be made race-free with the filesystem APIs Node exposes: there is no `funlinkat`, and
`renameSync` has the identical problem because its source is also resolved by path. CodeQL
`js/file-system-race` continues to flag `claim.ts:68` for exactly this, and it is correct to.

**Consequence if it fires:** two processes believe they hold the same item lock. Mutual exclusion is
broken for a process that did nothing wrong.

**Likelihood:** low. It requires a holder to crash, the lock to age past `LOCK_STALE_MS`, a
reclaimer to pass the inode check, and a third party to acquire inside the remaining microseconds.

## Candidate protocols, none chosen

- **Advisory locking** (`flock` / `fcntl`) — airtight and kernel-arbitrated, but Node does not expose
  it natively; needs a dependency, which is a supply-chain decision, not a bug fix.
- **Directory locking** — `mkdirSync` is atomic; the holder writes its PID inside. Reclaim becomes
  `rmdir` of a directory whose contents were verified, and the failure mode is benign (EEXIST). No
  new dependency.
- **Reclaim by the next acquirer** — no bystander ever deletes another process's lock; a stale lock
  is only ever displaced by whoever atomically succeeds it. Changes who is allowed to act, which is
  the cleanest conceptually and the largest change.

## Why this is filed rather than fixed

It is a change to how mutual exclusion works in a live primitive, with real blast radius. A scanner
finding is a good reason to look; it is not a good reason to choose a locking protocol under time
pressure. Recording the debt is the honest state — the code is better than it was, the residue is
named, and the decision is available to be made deliberately.
