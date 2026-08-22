# The society has a population of one, and that one is the loop itself

**Status audit, 2026-08-20.** Answering *"see how our free agent society is progressing"* and
*"any usb/hardware and initial format / repair / reformat"*. **Register: measured** except where marked.

> **Verdict on the society: the loop runs faithfully every 30 minutes, writes real state, and has a
> population of one — and that one member is the loop itself. Almost nothing reads what it writes.**

## 1. The tick is not a no-op — the problem is upstream of the mechanism

`society-heartbeat.yml` (cron `*/30`) runs `society-evolution-runner.ts`, which writes a new event
file, a **hash-chained** index, and a persisted Bayesian posterior, then flushes via the
`heartbeat/society` staging branch. **182 such commits on `main`; 400 event files.** The mechanism is
sound and the chain is integrity-checked.

## 2. Measured: a self-consuming loop

```
agents loaded from the REAL event dir: 1
  id= society   fitness= 0.6505648066545648   settled= 200

$ ls docs/observe-events/ | sort | tail -200 | grep -c '^society-'
200
```

`loadAgentsFromEventLog` scans `readdirSync(eventDir).sort().slice(-200)` and treats each distinct
`by` field as an agent. **Every event this loop writes carries `by: "society"`.** 200 of 200. **Zero
non-society events reach the loader. The society's only member is the runner reading its own output.**

**Timeline, folded from all 400 events:** population was **4** (`alexa`, `otto`, `soraya`, `gen1-*`)
from 2026-08-09 until **2026-08-16T12:48Z**, then went **4 → 3 → 2 → 1 within one hour** as the older
agents' events aged out of the 200-file window. **It has been 1 for the ~200 ticks since — four days.**

### With n=1, `evolve()` is the identity function

`k = max(1, ceil(1 × 0.5)) = 1` survivor, `needed = 1 − 1 = 0` offspring. **No crossover, no mutation,
no replacement.** Verified empirically:

```
BEFORE: n=1 gen=0 ids=society
AFTER 5 evolve(): n=1 gen=5 ids=society div=0
genome identical to founder? true
```

> **The commit message on every tick advertises "score → select → crossover → mutate → replace." Only
> *score* and *select* execute; the last three are structurally unreachable at this population.**

`generation` is **1 in all 400 events** — distinct values across the whole history: `[1]`. The runner
does `createSociety(agents, 0)` fresh each tick, so **generation never persists and there is no
accumulating lineage.**

### `meanFitness` is pinned, not merely stable

Frozen at exactly `0.6505648066545648` since 2026-08-16T14:41Z. `settledCount` saturates at the
200-file window, so `mu = min(0.95, log(201)/log(200)) = 0.95`, `sigma = 0.0998`, and
`trustBound = mu − 3σ` = **0.65056**. **It cannot change again while the window stays saturated.**
`geneticDiversity = 0`, `fitnessSpread = 0`.

## 3. Is anything closed?

**One thing genuinely moves:** the BNN — `obsCount` increments 1/tick (243 at last read), `mu` drifts
0.678910 → 0.668912 over 12 ticks. But `society-bnn.ts`'s own header states the loop is **deliberately
open**: *"The restored belief does not enter `evolve()` … Trend is local display."*

**The outputs have no readers, and the source already says so** (`society-heat-readout.ts:97–99`):
*"No current consumer reads either — checked: nothing parses `heatReadout` back out of
`docs/observe-events`."*

**The `priorHints` exchange has a receiver that discards the arithmetic** — `mergePriorHints` computes
the merge, uses it **only to format a log string**, then absorbs a constant `severity: "info"`, so
*"mu = 4"* and *"mu = 0"* land identically.

**Nothing would notice the collapse.** `heartbeat-liveness.yml` watches only the `agent-heartbeat`
lane. **No hygiene audit references `geneticDiversity`, `meanFitness`, or population size.** A society
of one and a society of forty produce identically well-formed, correctly-chained events.

### And a crashing runner looked identical to a healthy tick

```yaml
bun …/society-evolution-runner.ts … 2>&1 | tail -10 || echo "[society] evolution tick failed (non-fatal)"
```

There is **no `set -o pipefail` in that block** — the only one in the file is at line 112, **a
different step**. The pipeline's status is `tail`'s, always 0, so **the `|| echo` guard was dead
code.** This is **the repo's own "never read exit status through a pipe" rule, live on `main`.**
**Fixed in the same change that lands this note**, with the reason written at the line so it cannot be
removed as noise. The failure stays non-fatal by design; it is now *visible*.

## 4. The F# ranking machinery: excellent, and uncalled

- **`TravelerRankLedger.fs`** (156 lines, TrueSkill EP, Herbrich–Minka–Graepel anchored) — reached
  only by `ReportTriage.fs` and tests, and **`ReportTriage` has zero non-test callers.** **No persisted
  rank state exists on disk anywhere in the repo.** The anti-whitewash property the privacy-budget
  rule cites as built **is implemented, is tested, and has never ranked a real traveler.**
- **`SocietyUsefulWork.fs`** (189 lines) — tests only. The repo already knows: workitem
  **081M0DXCM5E** (`in-progress`) is *"Wire effectiveTrialCount to a production caller"*, and
  **081M0DN5S8H** (P1) is *"Witness independence is assumed, never measured."*

## 5. The ΔU ledger: small, but the entries are real

8 entries in `db/uncertainty/`; the `measure` verb only shipped 2026-08-15. **Quality is genuinely
high — witnessed, not asserted** (e.g. *"11 of its 12 tests FAIL against the pre-fix script"*). **No
invented numbers. The rule's refusal discipline is holding.**

**But there is still no reader.** `measure.ts`'s own header records the 2026-08-15 audit *("no writer,
no reader")*; the writer now exists, the reader does not. `db/competence-outcomes/` contains **only a
README, zero data.**

## 6. The load-bearing / accumulating-unread split

**Load-bearing:** the hash chain in `society-index.json` (enforced in `gate.yml`) and
`heartbeat-liveness.yml`. **Both are meta — they protect the apparatus, not the content. Nothing in
the society loop itself is load-bearing.**

**Accumulating unread:** all 400 evolution events · `heatReadout` (zero consumers, checked) ·
`priorHints` (receiver discards the math) · `bnn-state.json` (feeds nothing back, by design) ·
`db/uncertainty/` (8 entries, no reader) · `TravelerRankLedger` / `SocietyUsefulWork` / `ReportTriage`
(no production caller, no persisted state).

**Volume context.** Last 24h on `main`, ~360 commits: 156 heartbeat-batch-merge, 74 archive, 52
metrics, 34 society, 22 research — **roughly 88% telemetry and bookkeeping.**

This is the class Daya already named in the dogfooding-state audit: *"a loop whose output cannot differ
between runs is the vacuity class."* **The society loop is the same shape one layer up — except it
*can* differ between runs, and doesn't, because its population is one.**

### The smallest honest fix is one line of intent, not a redesign

Exclude `by === "society"` from `loadAgentsFromEventLog`, **or** key agents off the *heartbeat* events
(23 persona agents exist in `.claude/agents/`). **That is a design choice and is left for the
maintainer.** What is unambiguous either way: **add the missing falsifier** — an audit that fails when
`agents.length < 2` or `geneticDiversity === 0`, **so the next collapse is loud instead of silent.**

---

# USB / hardware lifecycle

> **(a) initial provisioning EXISTS and is unusually well-guarded; (b) damage / half-provisioned
> detection DOES NOT EXIST; (c) repair / reformat DOES NOT EXIST** — every "reformat" in the repo means
> *re-flash from scratch*. And the CI half is better than expected: the ISO **is** USB media, it **is**
> boot-tested, and it **is** cosign-signed — **but no local tool verifies it before writing.**

## (a) Provisioning — exists

`src/Core.TypeScript/zflash/` is a real 53-file subsystem with three platform arms (macOS `diskutil` +
`dd`, Linux `lsblk`, Windows `Get-Disk`), a Touch ID PAM gate, and FAT12 ESP injection into the
isohybrid ISO. **Only the Windows arm has read-back verify** — its test asserts *"corrupt write is
caught by read-back verify → ok=false (NO silent green)"*.

Rails are already good: hard refusal (exit 2) on non-darwin, ISO missing / wrong extension / outside
[200 MiB, 8 GiB], **0 or ≥2 USB devices**, non-USB protocol, internal, is-boot-disk, size outside
[4 GiB, 256 GiB] — then the operator must type `accept-destroy /dev/diskN <fresh-nonce>`.

## (b) Detecting a damaged / half-provisioned device — does not exist

`flash-usb.ts` **displays** the partition table, including an explicit `(no partitions detected — raw /
freshly-erased device)` branch — **but nothing classifies it and nothing branches on it.** The only
decision made from partition state is one printed sentence. **A blank stick, a half-written stick, and
a correctly-flashed stick all take the same code path.**

**The maintainer's attached `/dev/disk6` is a textbook specimen of exactly what nothing detects:** PNY
"USB 3.2.1 FD", 124.0 GB, `FDisk_partition_scheme`, a lone `0xEF` at 3.1 MB, ~124 GB unallocated, no
filesystem, nothing mounted. A correctly `dd`-ed installer leaves an **isohybrid** layout — an ISO9660
volume `ZETA_INSTALL` plus a FAT ESP, at the ISO's own ~1–2 GB. **What is there is the signature of a
write that started and stopped, or a device partitioned but never imaged.**

A detector needs three inputs, **all of which the repo already reads and then throws away**: scheme +
partition shape; the **volume label `ZETA_INSTALL`** (set in the installer's `configuration.nix`, and
the cheapest provisioned-check available — nothing reads it); and a read-back digest of the first N MB
against the head of the expected ISO. **Zero of the three are implemented.**

> **Aaron already asked for the precursor and it was never built.** The 2026-06-09 KDF research quotes
> him verbatim: *"check if the partition exists every time before formatting; ask the questions BEFORE
> formatting."* `zeta-install.sh` still wipes unconditionally at line 219.

## (c) Repair / reformat — does not exist

`reformat` appears only as two zflash **scenario names** meaning "re-run the whole flash." No
partition-table repair, no filesystem repair, no bad-block handling. **No work item anywhere mentions
repairing a damaged stick.** Absent repo-wide: `smartctl`, `badblocks`, `fsck`, `blockdev`, LUKS, udev
rules, PXE.

## The CI question — answered, and it reshapes the problem

**The ISO is USB media**, built with `makeUsbBootable = true; volumeID = "ZETA_INSTALL"`, isohybrid
with a FAT12 ESP that `zflash` already parses by offset. (`build-platform-images.yml` is unrelated —
OCI images, not media.)

**`qemu-boot` really boots and really asserts** — a serial-captured stage ladder (`firmware` →
`bootloader` → `kernel` → `userspace` → `login`) with failure markers. **Caveat: only BOOT-FAILED
fails the job; TIMEOUT and STALLED are downgraded to advisory by explicit policy.**

**Signing exists; a checksum file does not.** The x86 job runs `cosign sign-blob` with identity pinned
to the workflow ref. The SHA-256 **is computed** but written only to `$GITHUB_OUTPUT` and the step
summary — **no `SHA256SUMS` artifact**, so a local tool can only scrape a run summary. aarch64 emits
neither.

**And the bridge is missing entirely:**

```
$ grep -rn "cosign|sha256|createHash|SHA256SUMS|verify-blob" src/Core.TypeScript/zflash/ | grep -v test
(no output)
```

`zflash/cli.ts` picks the **newest `~/Downloads/zeta-installer-*.iso` by mtime** and `dd`s it.
**Nothing verifies the image before it is written.** Checksum verification *does* exist in the repo —
`installer/multiboot/sha256sums.ts` — **but only for third-party upstream images, never for our own
ISO.**

> **Because CI already emits a cosign-signed blob, "initial format" should become "verify, write,
> verify back" rather than free-form formatting.** Three pieces, increasing cost: **(1)** upload a
> `SHA256SUMS` file — one line, and a P3 backlog item already exists; **(2)** have `zflash` verify the
> digest *before* it touches the device; **(3)** port the Windows arm's read-back verify to macOS and
> Linux, which is the missing half of *verify it back*.

## The destructive step, named — for a human to run

**Nothing that writes was run.** If `/dev/disk6` is to be reclaimed:

```
diskutil unmountDisk /dev/disk6
sudo dd if=<verified-iso> of=/dev/rdisk6 bs=4m conv=sync status=progress
diskutil eject /dev/disk6
```

> **The target must never be discovered dynamically. A tool that selects "the external disk" is one
> plugged-in phone away from destroying it.** The check must re-read `diskutil info -plist /dev/disk6`
> immediately before the write and refuse unless size, media name, `BusProtocol == "USB"`,
> `RemovableMedia`, and `Internal == false` all match a **caller-supplied expectation**.
> **`flash-usb.ts` already reads all five fields — it just never compares them against an
> expectation.** Small, high-value, and the class of bug worth designing against first.

### Verification note (Otto, landing this)

Two load-bearing claims independently re-checked. **The self-consuming loop confirmed:**
`ls docs/observe-events/ | sort | tail -200 | grep -c '^society-'` returns **200** of 200 (3,502 files
total). **The dead guard confirmed:** `society-heartbeat.yml:189` pipes to `tail -10 || echo`, and the
only `set -uo pipefail` in the file is at **line 112, a different step.** That line is **fixed in this
same change.** The population fix is **not** applied — it is a design choice between two options and
belongs to the maintainer.
