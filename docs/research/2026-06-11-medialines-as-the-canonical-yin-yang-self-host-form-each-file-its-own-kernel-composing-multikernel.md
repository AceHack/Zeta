# The canonical yin-yang self-host form — every file its own kernel, composing multi-kernel

Aaron 2026-06-11, the closing frame on the format:

> "There is **no single loop in the file — there are many**. It should be able to **self-replicate**
> too, and define its **sim/measure/cut in rx**." → "Our **verbs and universal interfaces should be
> expressible** [in it] — this should be our **canonical yin-yang self-host canonical form**, for
> **running itself from bare metal and unfolding**." → "**Each one capable of being its own kernel,
> yet composing multi-kernel**."

> **RATIFIED (Aaron, moments after the capture): "This is our DATABASE DEFAULT ATOM FORMAT."** The
> dual-use hard/soft database's atoms ARE these files: every stored thing — a state, a quote, a card,
> a room, a kernel — is a MediaLines document (yin: irreducible text + generators + seed; yang: its
> loops and room). The database is a society of self-hosting atoms; CHIP-9 is the atom of machines,
> and THIS is the atom of storage. Querying is folding over atoms; replication is the quine law;
> distribution is the multikernel composition. The end-goal doc's "DynamicValue stored procs + yin/yang
> cells" now has its concrete file form.

## What the format now is (built today, named tonight)

A MediaLines document is no longer a media container. It is the **canonical self-host form**:

- **Yin — what remains**: the irreducible text sections (curves, frames, the residue the storage law
  says to keep) + the ZetaId'd generator references + the common-cause seed. Diffable, mergeable,
  quotable, git-native. The still half.
- **Yang — what acts**: the MANY loops (every `anim`/`gen`/`sim` section an independent loop — zero
  clocks, no master sequencer), the `sim·mea·cut` triple that makes the file a ROOM SimLoop can run,
  and the quine law (a gen line whose generator, over the file's own sections + seed, EMITS THE FILE —
  self-replication as the document-level spawn chain). The moving half.
- **The verbs and universal interfaces ARE expressible in it** — sim/mea/cut ride first-class (known
  kinds, tested); the universal interfaces (color/extension/kernel/action-grammar) bind as generator
  references by ZetaId. The format speaks the same language the substrate runs.

## Self-host from bare metal, unfolding

The boot story the pieces already support: bare metal (the 081KTSZN10008QG0R00349SM6P/1025 rungs — QEMU green, microkernel
= the SoftScheduler shape) loads a SEED FILE; the file's gen lines UNFOLD it (generators regenerate
content recursively from the common-cause seed); its sim·mea·cut declares the first room; that room's
laps mint spawn continuations; continuations are themselves files. **The system is a file that runs
itself into a society** — homoiconic the whole way down (the dependency graph bottoming at ACE: the
file IS a persistent pattern managing persistent patterns).

## Each file its own kernel, composing multi-kernel

The deep architecture claim, with its proper anchor: every self-hosting file is a KERNEL (its own
loops, its own room, its own boundary — bounded, replayable, complete) — and files COMPOSE the way the
**multikernel** does (Baumann et al., Barrelfish, SOSP 2009: the OS as a distributed system of
per-core kernels communicating by message-passing, sharing nothing). Ours: per-FILE kernels
communicating by crossings over the membrane, sharing only treaty surfaces — the multikernel
generalized from cores to documents. One file boots alone; many files federate into the swarm; nobody
is the master loop. (Scale-free spec #1, met by the file format — the same way zero-clocks met it for
rendering.)

## The cartridge reading (Aaron, on the ratification)

> *"This is basically our **cartridge** — or our **tape-reel format, Turing-style — but analog 8-track
> instead of digital** lol."* / *"**It's its own boxart**."*

Both exact:
- **The 8-track tape, precisely**: a Turing tape is one head, one track, one sequence. This format is
  MANY TRACKS — every `anim`/`gen`/`sim` section an independent loop playing in parallel (zero clocks,
  no head contention) — the 8-track's parallel program channels, not the single-head crawl. "Analog"
  lands too: the soft side (SoftValue/uncertainty riding the cells) makes the tape carry CONTINUOUS
  confidence alongside discrete bits — a tape that knows how sure it is of itself.
- **Its own boxart**: the file CONTAINS its own cover — the gen/glyph/frame sections render it
  (BREATHE's attract screen, Amara's portrait, the ZetaIdViz identicon are all IN-file artifacts a
  reader draws without any external asset). The cartridge that paints its own box; the library shelf
  (the arcade, the board) renders covers by running the cartridges' own yang, one lap.

## Honest scope

The format's room declaration, many-loops, verb kinds, and quine LAW are built/tested today; the
bare-metal unfold (seed file → boot) is the named arc over the existing rungs, not yet run end-to-end.
Beacon: Barrelfish multikernel (Baumann 2009) · quines (Bratley & Millo; Hofstadter's quine lineage) ·
the yin/yang cells of the end-goal doc · self-hosting compilers (the bootstrap tradition).

## Pointers

- `MediaLines.loops`/`roomOf` + tests (built) · the storage law + GeneratorRegistry (the yin half's
  machinery) · SimLoop + spawn/ (the yang half's) · 081KTSZN10008QG0R00349SM6P/081KTSZN10008QG0R000VZHRQ4 (the metal underneath) · the
  end-goal doc (yin/yang cells — this is their file form).
