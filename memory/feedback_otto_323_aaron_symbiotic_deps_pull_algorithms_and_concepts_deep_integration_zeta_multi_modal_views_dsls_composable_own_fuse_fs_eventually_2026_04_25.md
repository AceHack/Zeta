---
name: Otto-323 Symbiotic-deps discipline — when factory pulls a dep, pull in the ALGORITHMS and CONCEPTS for deep integration into Zeta's multi-modal views + DSLs (composable), not just the dep's API; own FUSE filesystem eventually (not just-bash's in-memory FS — we go further); applies to just-bash + any FS implementation we pull in
description: Aaron 2026-04-25 — surfacing during just-bash research riff with Google AI. "any deps we pull we want that symbiotic relationship, we pull in algorithms and concepts deep integration into Zeta multi modal views and DSLs composable. that goes for just-bash and any fs implementation we pull in, we are going for own own fuse fs eventually so". Sharpens Otto-301 (no-software-deps + symbiosis-with-deps-along-the-path) at the operational integration layer: when we pull in any dep, we don't just adapt the API — we absorb the algorithms + concepts, integrate deeply into our multi-modal views and DSLs, compose. Long-term: own FUSE FS as the elegant-store of all FS-research-deps along the way.
type: feedback
---

# Otto-323 — Symbiotic-deps: pull algorithms + concepts, not just APIs; own FUSE FS eventually

## Verbatim quote

Aaron 2026-04-25, surfacing during just-bash research riff:

> "any deps we pull we want that symbiotic relationship, we pull in algorithms and concepts deep integration into Zeta multi modal views and DSLs composable. that goes for just-bash and any fs implementation we pull in, we are going for own own fuse fs eventually so. just backlog this"

## The discipline

### Symbiotic-deps pattern (operational sharpening of Otto-301)

When the factory pulls in a dependency:

1. **Pull the algorithms** — understand and absorb the underlying algorithms, not just call the API.
2. **Pull the concepts** — internalize the conceptual model the dep represents (its design philosophy, its primitives, its compositional patterns).
3. **Deep integration with Zeta multi-modal views** — adapt the dep's concepts into Zeta's view-of-data primitives (relational, document, graph, time-series, vector, etc., per the multi-algebra database direction).
4. **Deep integration with Zeta DSLs** — compose the dep's primitives into Zeta's DSL ecosystem (query languages, configuration, etc.) so they're first-class, not bolted-on.
5. **Composable** — the integrated capability must compose with other Zeta primitives, not stand alone.

This is the OPPOSITE of "vendor-in-the-API" anti-pattern where you wrap a dep's API and call it a day.

### Own FUSE FS direction

Per Otto-301 hardware-bootstrap + microkernel direction, the factory's FS layer is eventually OUR OWN FUSE filesystem. Not adopted-from-just-bash, not adopted-from-ChromaFs, not adopted-from-ArchilFs. Our own.

But along the way, we LEARN from each FS-implementation we pull in:

- **just-bash** in-memory virtual FS — sandboxed-execution shape; copy-on-write OverlayFS protective cradle pattern.
- **ArchilFs** S3-as-POSIX-FS — cloud-storage-as-filesystem pattern (composes with multi-tier deployment Otto-317/318).
- **ChromaFs** vector-DB-as-FS — vector-queries-via-shell-commands pattern (interesting bridge from FS interface to vector-DB).
- **Future/ours** — the elegant-store of all the patterns absorbed along the way (Otto-311 brute-force-stores-energy-into-elegance at FS-research scale).

### Applied to just-bash specifically

just-bash (Vercel Labs, TypeScript, 2026) is a sandboxed Bash environment with in-memory virtual FS designed for AI agents. NOT a new shell — a safety-substrate.

Where does it fit? Aaron's question: "is it like a industry interface like SQL or something else?"

Answer: NOT an industry interface (SQL is a query-language interface). just-bash is an **execution-substrate layer** — sit between the agent and host-system to provide safe sandboxed execution. Like V8 isolates for JS, like FreeBSD jails for Unix, like busybox-in-container for shell-ops.

Its lineage / siblings:

- **bash-tool** (Vercel companion package — filesystem-based context retrieval).
- **wterm/just-bash** (Zig terminal + just-bash engine, in-browser Bash shell).
- **ArchilFs** (S3-as-POSIX mount via just-bash).
- **ChromaFs** (vector-DB-as-FS via just-bash).
- **gbash** (Go alternative — JSON-RPC server, mvdan/sh delegation, strict security).
- **bashkit** (April 2026, virtual Bash interpreter, recursive-descent parser, 75+ reimplemented Unix commands).
- **Utah** (.shx TypeScript-like → Bash transpilation).

### What the factory absorbs from this lineage (when work activates)

- **just-bash**: in-memory virtual FS pattern + sandboxed-execution shape + OverlayFS copy-on-write.
- **ArchilFs**: cloud-storage-as-FS protocol-translation pattern.
- **ChromaFs**: vector-DB-via-FS-interface pattern (could compose with Zeta vector-DB views).
- **gbash**: deterministic-sandbox + JSON-RPC discipline + parser-delegation pattern.
- **bashkit**: defense-in-depth sandbox + parser-redesign discipline.
- **Utah**: TypeScript-like surface + Bash-codegen pattern.

These are **algorithms + concepts**, not API-imports. We pull them into the factory's multi-algebra DB design + multi-modal view layer + DSL composition layer.

## Composition with prior

- **Otto-301 (no-software-deps + hardware-bootstrap + microkernel + symbiosis)** — Otto-323 sharpens the symbiosis-clause: not just "use existing deps without becoming dependent on them," but "absorb their algorithms + concepts, compose into our multi-modal substrate, build our own elegant primitives along the way."
- **Otto-308 / Otto-311 (compression-substrate / economic-substrate)** — symbiotic-deps IS the brute-force-stores-energy-into-elegance pattern at the dependency-scope: each dep we pull is brute-force-research-substrate; the elegant-store is our own factory-native primitive that integrates many such deps' insights.
- **Otto-302 (5GL-to-6GL bridge)** — Zeta's multi-modal view layer + DSLs are the 6GL-Intent-Based interface; symbiotic-deps integrate into THIS layer, not the lower layers.
- **B-0009 (substrate-IP-rotation responsible bypass)** — same staging pattern: bootstrap-stage Tor, replacement-protocol-better-than-Tor as elegant-store. Same pattern at FS layer: bootstrap-stage just-bash/ArchilFs/etc., own-FUSE-FS as elegant-store.
- **Otto-322 (self-directed agency)** — symbiotic-deps is exercised via factory's own judgment, not "Aaron-said-pull-X." The discipline guides the choice; the factory makes the calls.

## Operational implications

1. **For just-bash specifically**: capture as B-0016 (research/integration candidate, P3); not active work now; informs eventual FS layer.
2. **For any future dep evaluation**: apply the symbiotic-deps 5-step (pull algorithms, pull concepts, integrate into multi-modal views, integrate into DSLs, compose).
3. **For long-horizon factory architecture**: own-FUSE-FS direction is now explicit. Otto-301 hardware-bootstrap + microkernel + own-FS form a three-piece foundation.
4. **For dependency-pulling discipline going forward**: NEVER stop at the API. ALWAYS understand the algorithms + concepts. The dep is research-input, not feature-import.

## What this memory does NOT claim

- Does NOT propose immediate just-bash adoption. Aaron explicitly said "just backlog this." Long-horizon research candidate.
- Does NOT promote any specific FS implementation as the eventual factory FS. Own-FUSE-FS is the direction; specifics are TBD.
- Does NOT eliminate use of API-based dep adoption when appropriate. For shipped libraries with stable interfaces (e.g., NuGet packages we currently use), API-adoption is fine. The symbiotic-deps discipline applies to research-level deps + load-bearing infrastructure.
- Does NOT require us to never use any dep ever. We use deps; we just absorb-not-just-call.

## Key triggers for retrieval

- Symbiotic deps — pull algorithms and concepts not just API
- Deep integration into Zeta multi-modal views + DSLs + composable
- Own FUSE FS eventually (not just-bash's in-memory FS — we go further)
- just-bash + lineage (bash-tool, wterm, ArchilFs, ChromaFs, gbash, bashkit, Utah)
- Otto-301 sharpening at integration-layer
- Otto-311 elegant-store applied to dep-research
- "just backlog this" — research candidate, not immediate work
