# David Greenberg — "Exotic Functional Data Structures: Hitchhiker Trees" (Strange Loop ~2016) — verbatim transcript (Aaron-forwarded)

**Source:** <https://www.youtube.com/watch?v=jdn617M3-P4> (David Greenberg; `datacrypt` Hitchhiker trees).
**IP status:** auto-caption transcript of a third-party talk — DO NOT republish externally (folder README).
Substrate value is the framework-composition analysis below.

> Aaron 2026-06-07: *"This is also relevant."*

## Framework-composition analysis (what this means for Zeta)

The **Hitchhiker tree IS the IO-optimized, sorted, immutable tree for our COW store** — the structure our
git-compatible/remote store should use for ordered/range-scannable data (where the HAMT `ImmutableDictionary`
is unordered).

- **Lineage:** BST → B-tree → **B+ tree** (split index vs data nodes; values only in leaves) → **fractal
  tree** (a B+ tree with a small *write buffer* on each index node; Tokutek/Bε-tree) → **Hitchhiker tree**
  = a **path-copying (functional/immutable) fractal tree**. Path-copying = exactly our structural-sharing /
  COW (only the root→leaf path is copied on update; the rest is shared; old versions persist → free
  snapshots). Same mechanism as `ContentStore`/`DagFs`, but a *sorted* tree with *range scans*.
- **Buffered writes = our append-to-log idea.** Each index node has a log-like buffer; inserts append to
  the buffer (O(1)) and **flush down recursively** only when full → far fewer IOs per insert than a B+
  tree. This is the `DeltaLog` append + batched checkpoint pattern, generalized into the tree.
- **Flush control = our commit/checkpoint cadence.** You choose when to flush (latency vs durability vs
  IO-cost trade-off) — exactly our group-commit / fsync-cadence knob. "<1 IO per insert" when you batch.
- **Reads = path-find + project pending ops into the leaf** (only ops in-range), using *functional* nodes
  to simulate the flushed leaf without mutating — i.e. fold the buffered deltas onto the base, which is the
  **DBSP integrate / Z-set replay** shape applied to a tree.
- **Optimized for REMOTE storage** (big blocks, high latency) — our cross-cell / cloud / object-store case
  (vs fractal trees tuned for local SSD). Pluggable backends (redis/jdbc/S3/in-mem), serialization
  (compression/encryption), sort — matches our plugin-everything + codec-as-plugin design.
- **"Outboard API" / free snapshots / data-lifetime ≠ runtime-lifetime:** a hashmap stored off-heap
  (redis), functional ⇒ free snapshots, reconnect after VM restart without losing state. This is precisely
  our **COW branches + store-decoupled-from-process** stance (restart fast, state persists).

Net: **a strong design lead** — when the COW store needs a sorted, range-scannable, IO/remote-optimized
*immutable* index, the Hitchhiker tree is the structure (path-copying immutability + buffered writes +
flush control). Filed as a backlog item; complements the HAMT (unordered) + Jumprope (large blobs).

## Beacon anchors

- **David Greenberg** — Hitchhiker trees (`datacrypt`, Clojure). · **Fractal / Bε-trees** — Bender,
  Farach-Colton, Kuszmaul (cache-oblivious streaming B-trees); **TokuDB/Tokutek**. · **B+ trees** (Comer,
  *The Ubiquitous B-Tree*). · **Persistent search trees / path copying** — Sarnak & Tarjan (1986); Okasaki.
  · **Log-structured merge** (O'Neil, LSM) — the buffered-write relative. Ties: `ContentStore`/`DagFs`
  (path-copying), `DeltaLog` (buffered append + flush), DBSP (project/integrate pending ops), the COW store
  `081KTGTJC1Q`, the HAMT note + the Jumprope note (the three complementary store structures: HAMT=keyed,
  Jumprope=blobs, Hitchhiker=sorted/range).

---

## Verbatim transcript (lightly cleaned from auto-captions; Aaron-forwarded 2026-06-07)

Today we're talking about exotic functional data structures — specifically **Hitchhiker trees**. I'm David
Greenberg, author of *Building Applications on Mesos*, an engineer/consultant on Mesos & distributed
systems.

**Functional data structures** are at core *immutable* — that's the difference from a regular structure.
Consider 7: add 1 → 8, but 7 is still 7. In Python, `y = x; y.append(...)` mutates `x` too ("sad panda");
fix by copying (`y = x[:]`) so they differ. Copying is important. With a list of fruit, to "mutate" I copy
(red = deallocated, green = allocated/mutated, black = unchanged) — the old list is unchanged (like 7+1).
But copying the *whole* list is expensive.

**Pointers / references enable sharing.** A struct can embed a sub-record or *point* to it; pointers let
two records (Biometrics, Employee) share one Name record. Sharing + functional data structures: use a
**singly linked list** — to put a mango at the front, allocate only the new head; the last four elements
are shared. But worst case is *linear*: changing the 3rd element copies the first three (you **copy the
path from the mutated node back to the root**). The "when is an apple not an apple" point: an apple→orange→
banana differs from apple→orange→mango, because descendants differ — so the path must be copied. To do
better → **trees**.

We'll build BST → B-tree → B+ tree → fractal tree → Hitchhiker tree.

**Binary search trees:** two children; sorted (left < node < right). Lookup `log₂ n` (only the last level
dominates: n = 2^(L−1) ⇒ log₂ n = L = lookup cost = #levels). The base-2 comes from 2 children.
**Functional update:** path-copy from root to the changed node — old subtrees stay black (shared); updates
are still `log₂ n` — *same asymptotic cost as a mutable tree*. (Balancing: see CLRS. Ordering: sorted trees
here; *tries* — same optimizations — back Scala/Clojure/Elixir immutable hashmaps.)

**Change the cost model from comparisons to IO.** Reading 1 byte vs 1000 bytes off disk costs the same;
over a network even more. So make **fat nodes with B children** (branching factor) → **B-trees**. Same sort
property, but several BST levels scrunched into one node. B-trees are **optimal for reads** (lower bound
`log_B n` on sorted lookups) — we control the log base. 1000 elements: BST ~10 units; B=5 nearly 2×; B=100
~7× faster — constant speedups for free from the IO cost model (reading more *useful* data per IO).

**B+ trees:** B-tree bookkeeping is annoying; separate **index nodes** (keys only) from **data nodes**
(values, at leaves only). More keys per index level (keys smaller than values) → better fan-out. Root
replicates the largest key of each child; "+" = bigger than anything. (For the rest, use B=3, 3-level trees
to show multi-level effects.)

**Fractal trees:** a B+ tree where each index node gets a small **buffer** (a log). *Appending to a log is
O(1)* (you know the next index). Insert into the root buffer (touch only the root!) until it's full, then
**flush down recursively** toward where the values belong (smallest → bottom-left, etc.) until there's
room; at the bottom it triggers the normal B+ insert. Big **write** improvement. **Reads** = find the path,
then **project the pending operations** (the buffered ops along the path) into the leaf — using *functional*
nodes to simulate the new leaf without mutating — then search the leaf. For **scans**, only project ops
*within range* (projecting everything would mis-order). 

**Hitchhiker tree = a fractal tree that uses PATH COPYING** → it's a *functional/immutable* fractal tree
(fractal trees normally mutate in place for concurrency, incompatible with functional). Also more optimized
for **remote/higher-latency, bigger-block storage** (fractal trees → local SSD).

**Flush control:** for 7 inserts — B+ tree: 21 IO total, 3 IO/flush, avg 3 IO/insert. Fractal: 12 IO total,
1–4 IO/flush (variable pauses), avg ~1.7. Hitchhiker: choose **not to flush** until many writes — 5 IO
total, one 5-IO flush (longer latency once) → **<1 IO per insert**. It's up to you when to flush (IO cost
vs durability trade-off).

**Real branching factors:** B+ tree fan-out 1–2000 (block 4 KB–1 MB). Hitchhiker fan-out *smaller* (~100–
200) because the **buffers** are huge — you trade a small read penalty for big insertion gains (Wikipedia
shows you can beat `log_B n` for ops because buffers are so big).

**Datacrypt** (Clojure) implements Hitchhiker trees, fully **pluggable**: backend storage (redis, in-mem,
DB, S3), IO-management (when to flush/compress), serialization (compression/encryption), sort. API: insert/
delete/flush + cache management (it targets remote storage). **Outboard API:** a hashmap stored off-heap in
**redis** — but *functional*, so **free snapshots** (snapshot any version at ~zero cost) and you can
**reconnect after a VM restart** without flushing memory — data lifetime decoupled from runtime lifetime
(fast restarts, preserved state). Thanks to Andy Chambers (jdbc backend, GC) and Casey Marshall (S3
backend). On GitHub under the datacrypt project.
