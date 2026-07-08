# ADR: Zeta Free Tier — Git-Native Database (Zero Infrastructure)

Date: 2026-07-08
Status: DECIDED
Author: Aaron (operator) + Kiro (codegen)

## Decision

The free tier of Zeta runs on zero infrastructure beyond what GitHub already provides
for open-source projects:

- **GitHub Pages** = the CDN + read API (static files, no rate limits)
- **Git commits** = the database writes (append-only, content-addressed)
- **GitHub Workflows** = the compute (cron ticks, CI verification, event processing)
- **Browser tabs** = the nodes (each tab is a full Zeta mesh node)

No servers. No databases. No API keys. No rate limits. No cloud bills.

## Context

The core insight: every component in a traditional stack has a git-native equivalent
that's free for open-source:

| Traditional           | Git-Native Free Tier                                       |
| --------------------- | ---------------------------------------------------------- |
| PostgreSQL / DynamoDB | Git objects (content-addressed, self-certifying)           |
| REST API              | Static file fetch from Pages (same-origin, no auth)        |
| Cron server           | GitHub Actions workflow_dispatch + schedule                |
| CDN                   | GitHub Pages (global, cached, HTTPS)                       |
| WebSocket server      | BroadcastChannel (same device) + RNS relay (cross-network) |
| Message queue         | Event log files (append-only JSON in a git folder)         |
| User sessions         | localStorage (yin commits) + git identity (yang)           |
| Load balancer         | Not needed (each node is sovereign, no central dispatch)   |

## The Stack

### 1. Storage: Git Objects ARE the Database

Every write is a git commit. The commit IS the transaction. The content-address
(SHA-1/SHA-256 of the object) IS the primary key. Deduplication is free (same
content = same address). History is free (git log). Branching is free (diverge then
merge). Replication is free (git clone / fetch).

The event-sink-folder pattern: each event is a ZetaId-named JSON file. Append-only.
The filename IS the dedup key (G-Set CRDT property). Two writers appending disjoint
files never conflict (set union, not update-in-place).

### 2. Reads: GitHub Pages IS the Read API

Pages serves static files over HTTPS at a global CDN. No API keys. No rate limits
(beyond GitHub's generous static hosting). Fetching `data/metrics.json` from Pages
is the same as querying a read replica — except it's free and scales to millions of
readers.

The write path: CI workflow commits a new frame to `data/metrics-history.json` on
main → Pages auto-deploys → all readers see the new data on their next fetch.
Append-only file IS the ledger.

### 3. Compute: GitHub Workflows ARE the Cron + CI

- `schedule:` triggers = cron (the observe loop tick fires on schedule)
- `push:` triggers = event-driven processing (a commit lands → workflow processes it)
- `workflow_dispatch:` = manual triggers (operator intervention)

Free for public repos. 2000 minutes/month for private repos. Each tick:
reads the event log → runs the observe oracle → picks an action → executes
(codegen, merge, claim, etc.) → commits the result → pushes.

### 4. Nodes: Browser Tabs ARE the Mesh

Each browser tab runs:

- A full in-browser git client (dumb HTTP protocol against `/repo.git/`)
- Content-addressed local storage (yin commits in localStorage)
- Mesh discovery (BroadcastChannel between tabs, WebSocket for cross-network)
- Merkle verification (same parity oracle as the backend)
- Event log fold (the UI is a projection of the append-only event stream)

Tabs discover each other automatically. No server coordination. The mesh IS
the network — every tab relays for every other tab (Reticulum-shaped).

### 5. The Data Contract

CI writes. Pages serves. Browsers read. No coordination needed.

```
CI Workflow (scheduled or on-push)
    │
    ├── Read: git log / event files → compute metrics frame
    ├── Write: append frame to data/metrics-history.json
    ├── Commit + push to main
    │
    └── GitHub Pages auto-deploys
            │
            └── Browser tabs fetch data/*.json (same-origin, no auth)
                    │
                    └── UI renders the fold (charts, timelines, presence)
```

### 6. Offline-First by Construction

The PWA service worker caches the entire site after first visit. Every page works
with no network. The yin/yang split means local commits work offline; sync happens
when connectivity returns (content-addressed rebase onto the new yang HEAD).

## Properties

- **Self-certifying**: every object's SHA is recomputable from its content. No trust required.
- **Append-only**: the event log only grows. No deletes, no updates-in-place.
- **Commutative**: beacons fold LWW-by-seq. Arrival order doesn't matter.
- **Idempotent**: same event appended twice = same result (G-Set dedup by ZetaId).
- **Convergent**: all nodes fold the same log to the same state (CRDT guarantee).
- **Offline-capable**: yin commits work without network; sync is eventual.
- **Free**: zero infrastructure cost for open-source projects.

## The Paid Tier (What You Add)

For teams that need more:

- **NATS JetStream**: real-time streaming (instead of polling Pages)
- **PostgreSQL**: relational queries over the event log (materialized views)
- **Private repos**: GitHub's paid tier for non-public projects
- **Dedicated compute**: larger models, faster ticks, more concurrency
- **SLA**: guaranteed uptime, support

The free tier IS the product. The paid tier is the acceleration.

## Composes With

- `src/Core.TypeScript/observe/event-sink-folder.ts` — the git-native write path
- `src/Core.TypeScript/ferry-throttler/network-transport.ts` — the batched wire protocol
- `src/Core.TypeScript/discovery/reticulum-transport.ts` — the mesh layer
- `site/edge/zeta-mesh.js` — the in-browser mesh node
- `site/gitpull.html` — the in-browser git client PoC
- `.github/workflows/gate.yml` — the CI verification gate
- `data/metrics-history.json` — the append-only ledger (Pages-served)

## One-Line Summary

**Git is the database. Pages is the API. Workflows are the compute. Tabs are the nodes. Free.**
