# The delegated-capability lint (built), the audit-log drainer (designed), and the connector Content-Type verdict

**Nazar / security-operations-engineer - advisory, not binding.** 2026-08-20.

**Discipline held throughout: THE DEVICE WAS NOT TOUCHED.** No `yubihsm-shell`, no `ykman`, no
session, no credential, no `op`. The running connector was not restarted, reconfigured, or even
polled - `/connector/status` calls `usbCheck` and therefore reaches the device, so it was left
alone. Every device fact below is read from vendor documentation or upstream source, and is
labelled as such.

**Register key.** **measured** (something in this repo was executed and observed) - **checked**
(primary source, named, quoted, dated) - **doc-silent-unverified** (the documentation does not say,
and the silence is recorded as silence) - **designed-not-running** (specified here, no code path
executes it). Nothing is rounded up.

## 0. One paragraph

Three pieces of work, and the honest summary of each. **R12 is resolved and the answer is the bad
one:** upstream `yubihsm-connector` never inspects `Content-Type`, so a web page the operator merely
opens can execute an HSM command blind - and the one mitigation that exists, Host-header
allowlisting, is **off by default** and would not stop this attack even when on. **The
delegated-capability lint is built and running** - 43 tests, 79 assertions, four mutants killed - and
building it produced three corrections to the brief that commissioned it, one of which (the device
enforces domain subsetting on create) weakens the original claim and is recorded rather than
buried. **The audit-log drainer is designed, not built**, and the design turns up a problem larger
than the drainer: Yubico documented default output shows per-command audit **disabled for SIGN
ECDSA**, so a drainer could faithfully export 62 slots of session-open noise while every signature
goes unlogged. Draining is not the blocking question. Turning logging on is.

## 1. R12 resolved - `POST /connector/api` does NOT require a Content-Type

**Register: checked** - source read at `Yubico/yubihsm-connector`, `master` at commit
`76b26eb809a9068c497baec4b5f8761a7825c475`, `VERSION` reporting 3.0.7, fetched 2026-08-20.

### 1.1 The code

`apiHandler` performs exactly two admission checks before it hands the body to the device:

```go
// api.go:175-180
if r.Method != "POST" {
    w.Header().Set("Allow", "POST")
    http.Error(w, http.StatusText(http.StatusMethodNotAllowed),
        http.StatusMethodNotAllowed)
    return
}

// api.go:182-186
if r.ContentLength < min_len || r.ContentLength > max_len {
    http.Error(w, http.StatusText(http.StatusBadRequest),
        http.StatusBadRequest)
    return
}
```

with `min_len = 3` and `max_len = 3136 + 3` (`api.go:167-168`). The body is then read and proxied
straight to the device:

```go
// api.go:188-200
if buf, err = io.ReadAll(io.LimitReader(r.Body, max_len)); err != nil { ... }
if buf, err = usbProxy(buf, cid, serial); err != nil { ... }
```

**`Content-Type` appears exactly once in the entire repository as a request-side value**, and it is
a log field:

```go
// api.go:75-84
clog := log.WithFields(log.Fields{
    ...
    "Content-Type":   r.Header.Get("Content-Type"),
    ...
})
```

It is read, printed, and discarded. It is never compared to anything. The only place the connector
*sets* a content type is on the **response** (`api.go:202`).

### 1.2 Verdict

**R12 upgrades from UNKNOWN to REACHABLE for execution.** A cross-origin `fetch` with a
`text/plain` Blob body is a CORS **simple request**: no preflight is issued, so nothing gives the
browser an opportunity to refuse. The request arrives, passes the method check, passes the length
check, and is executed against the HSM. The page cannot read the reply - no
`Access-Control-Allow-Origin` header is emitted anywhere in the source, which is what the prior
review already measured - **and it does not need to.** A blind write is sufficient for
session-slot exhaustion, for denial of the root of trust, and for reaching the response-parser
position on every subsequent client.

### 1.3 The mitigation that exists, and why it does not help here

`middlewareWrapper` has a Host-header allowlist (`api.go:97-101`), guarded by
`hostHeaderAllowlisting`. Two facts about it:

- **It is off by default.** `main.go:216` registers the flag with default `false`, and the measured
  connector runs `yubihsm-connector -d` with **no config file**, so the compiled default is in force.
- **Turning it on would not stop this.** The default allowlist is
  `[]string{"localhost", "localhost.", "127.0.0.1", "[::1]"}` (`main.go:43`). A browser fetching
  `http://127.0.0.1:12345/connector/api` sends `Host: 127.0.0.1:12345`, which `validateHost` accepts.
  The allowlist defeats **DNS rebinding** - an attacker domain resolving to loopback - and that is a
  real and different attack. It does not defeat a page that simply names the loopback address.

**So the honest control is not a header check.** It is: do not leave a connector running when no
client needs it, and put it under supervision so that a takeover is a visible service flap rather
than a silent one. Both were already finding 1 of the connector review; R12 raises its priority
rather than adding a new mitigation.

**Cheapest confirmation, and it does touch the device, so it is NOT recommended on this unit:**
serve a page from any origin that POSTs a 3-byte `text/plain` body and observe the connector log
line. On a throwaway connector with no device attached, the log line alone settles it without any
HSM contact at all - `usbProxy` fails and still logs the request. That variant is safe and is the
one to run.

## 2. The delegated-capability lint - built, running, and it corrected its own brief

Files: `src/Core.TypeScript/hygiene/hsm-authkey-model.ts` (pure model),
`src/Core.TypeScript/hygiene/lint-hsm-delegated-capability-escalation.ts` (thin CLI),
`src/Core.TypeScript/hygiene/lint-hsm-delegated-capability-escalation.test.ts`,
`src/Core.TypeScript/hygiene/hsm-authkey-roster.json` (the declared roster).

### 2.1 The core theorem, which is where the value is

Yubico writes, of Delegated Capabilities:

> "These define the maximum capabilities that can be assigned to any new object created in a session
> opened with that key. In other words, a session cannot create an object that has more permissions
> than the Authentication Key itself is delegated to grant. **This prevents a lower-privileged
> operator from creating keys with higher privileges than their own.**"
> - YubiHSM 2 User Guide section 1.4

That last sentence is true only if *their own* means **delegated**, not **capabilities**. The
operator who creates an authentication key **chooses its password**, and can then open a session
with it. Therefore:

> **effective(A) = capabilities(A) UNION delegated(A), whenever `put-authentication-key` is in
> capabilities(A).**

A roster that carefully keeps `export-wrapped` out of an agent key CAPABILITIES while leaving it in
that key DELEGATED set has not reduced privilege. **It has renamed it.** That is the most likely
real provisioning error, it is invisible to inspection, and it is rule `delegated-exceeds-capabilities`.

### 2.2 Why this is a closure and not a comparison

A one-hop check asks "does this key hold a dangerous capability". Here is a roster where the answer
is no and the key is nonetheless a full administrator two operations later:

```
A: capabilities  { put-wrap-key, import-wrapped }
   delegated     { import-wrapped, sign-ecdsa, put-authentication-key }
```

`put-authentication-key` is **not** in A capabilities, so A cannot mint an authentication key
directly, and a comparison reports clean. The chain:

| hop | operation | result |
|---|---|---|
| 1 | `put-wrap-key` | wrap key W, with `delegated(W)` bounded by `delegated(A)` - so W may delegate `put-authentication-key` |
| 2 | `import-wrapped` under W | an object whose capabilities are bounded by **delegated(W)**, not by `delegated(A)` |

and that object is an authentication key that can mint. **A acquired a power A never held**, with no
vulnerability and no extra credential. This exact roster is in the test suite, and the lint reports it:

```
[HIGH] domain-escalation-reachable - agent-a-signer (0x0014)  register=doc-silent-unverified
  under the doc-silent-pessimistic device model, a chain of 2 operation(s) reaches domain(s) 2,
  which belong to another principal. Chain: agent-a-signer then put-wrap-key then import-wrapped.
```

The fixpoint genuinely iterates. A separate pinned case (`nested`, in the tests) needs **two rounds**
to saturate, and capping the closure at one round provably loses reachable control points.

### 2.3 Three corrections to the brief that commissioned this lint

Each was checked against a primary source before it was believed, and each is recorded because the
false version is the one a reader would otherwise carry away.

**(a) `delete-object` is NOT a capability.** It is a **command** (User Guide section 6.1.15), whose
required capability is per-type: *"to delete an Asymmetric Key the Authentication Key must have the
delete-asymmetric-key capability."* There is no `delete-object` entry in `yh_capability[]`. The lint
**refuses** a roster naming it, and the error names all nine family members - because a
silently-ignored capability name in a security roster is a permission you only think you denied.

**(b) `change-authentication-key` is not the escalation it looks like.** It was a natural candidate
for a devastating edge (rekey a peer credential and become that peer). It is not:

> "Replace the Authentication Key used to establish **the current Session**. It is not possible to
> modify any of the metadata connected to the Object such as Domains or Capabilities."
> - User Guide section 6.1.6

It rekeys only the session own key: a persistence primitive, not an escalation. Recorded so nobody
re-derives the false version.

**(c) The device DOES enforce domain subsetting on create - so the brief central claim is narrower
than stated.** The brief says an auth key holding `put-authentication-key` plus a wide delegated set
*"can mint itself a credential into a peer domain."* Checked:

> "an object cannot be created with access to Domains that the Authentication Key used to create it
> does not have access to." - User Guide section 3.6

So on the **create** path, privilege is monotone on the domain axis by hardware, and the direct mint
into a peer domain is refused. **This makes the lint MORE useful, not less**, because it relocates
the real defect to two places that are genuinely unguarded:

1. **Declared trespass.** A key that simply *holds* domains belonging to another principal needs no
   chain at all. Rule `declared-domain-trespass`, and it is the likeliest provisioning slip of all.
2. **The import path, which the documentation does not close.** See 2.4.

### 2.4 The one edge the documentation leaves open, registered as silence

`IMPORT WRAPPED` (section 6.1.38) states that *"The imported object retains its metadata (Object ID,
**Domains**, Capabilities, etc)"* and lists its Required Capabilities in full: auth key has
`import-wrapped`; wrap key has `import-wrapped`; *"Target object capabilities must all be part of the
**Wrap Key** delegated capabilities."*

**What is absent from that list**: any constraint binding the imported object DOMAINS to the session
authentication key, and any binding its capabilities to the SESSION key delegated set rather than
the WRAP KEY one.

**Documentation silence is not permission.** The device may well enforce a rule the manual omits. So
the lint runs **two named device models** and reports them separately:

- `documented` - R2 and R3 only; import cannot widen domains. Findings register **checked**.
- `doc-silent-pessimistic` - the silence is treated as permission. Findings register
  **doc-silent-unverified**, and the message says in full that this is *not* a demonstrated
  escalation and names the falsifier.

**The difference between the two models IS the finding.** It is exactly the question a throwaway
device settles in ten minutes, and it is not settled here because settling it means touching
hardware.

### 2.5 Measured

```
bun test src/Core.TypeScript/hygiene/lint-hsm-delegated-capability-escalation.test.ts
  43 pass, 0 fail, 79 expect() calls
```

Mutation - each guard reverted afterwards, all four killed:

| # | mutation | delta |
|---|---|---|
| 1 | drop the `put-authentication-key` precondition from the core theorem | 43 pass to **42 pass / 1 fail** |
| 2 | make the import edge always widen to all 16 domains | 43 pass to **42 pass / 1 fail** |
| 3 | accept any capability name in `validateRoster` | 43 pass to **41 pass / 2 fail** |
| 4 | make `dominates` ignore the capability component | 43 pass to **39 pass / 4 fail** |

CLI behaviour, measured: clean roster exit 0; hostile roster with `--enforce` exit **1** and four
findings; missing roster exit **2**; roster naming `delete-object` exit **2**. **Fail-closed: an
unreadable or invalid security roster is never reported as "no findings".**

### 2.6 What it does NOT check, said at the claim rather than in a footnote

It reads a **declaration**. It does not read the device. Reading real object metadata needs an
authenticated session, i.e. a credential, which an agent may not hold. The roster therefore carries a
mandatory `provisioningStatus` field, the shipped one says `proposed-not-provisioned`, and **the lint
prints that status on every run including the clean one** - because "lint passed" and "device is
safe" being confusable is precisely the vacuity failure this repo keeps finding.

## 3. The audit-log drainer - designed, and one finding that outranks it

Files: `src/Core.TypeScript/hygiene/hsm-audit-log-drain-model.ts` and its test. The pure logic is
**running and tested**; every part that touches hardware is **designed-not-running**, and no device
I/O is written or planned in that file.

### 3.0 The finding that comes before the design

**Checked, and it may hollow out the entire exercise: by default the device logs almost nothing.**
Yubico documents a per-command audit toggle and shows its real default output:

```
$ yubihsm-shell -a get-option --opt-name command-audit
Option value is:
 0100030004000500060007000900080040004100420043004400450046004700550056004800490057...
```

The encoding is *"C1 V1, C2 V2, ..., Cn Vn where Ci is the Command Code and Vi is the option value"*
(section 4.2). Parsing that output in pairs gives `01 00`, `03 00`, `04 00`, ... - **every listed
command has logging value `0x00`, disabled.** And `SIGN ECDSA` is command code **`0x56`** (section
6.1.61); the pair `5600` sits in the middle of that default string.

> **Register: checked against a vendor documentation example; NOT measured on our device.** Reading
> our own `command-audit` mask needs an authenticated session, i.e. a credential, so it was not
> done. The connector review measured `2/62` slots used on a device that has been enumerated - which
> is exactly what a boot marker plus a session establishment would produce, and is consistent with
> "nothing else is logged", but consistency is not measurement.

**The operational consequence, and it is the whole point:** a drainer that faithfully exports 62
slots per cycle, verifies every chain, and persists everything to durable storage - while
`command-audit` for `0x56` is `0x00` - **has built a perfect evidence pipeline for session-open
noise, and no signature it was built to witness will ever enter it.** That is the vacuity class in
operational form: a check that runs, passes, and constrains nothing.

**So step one of the drainer runbook is not "drain". It is: read the `command-audit` mask, and enable
logging for the commands whose absence would make the trail worthless.** That is a human step (it
needs `set-option`, hence a credential). It is also a *cheaper* fix than the drainer, because
selective per-command audit is simultaneously the drain-rate control - see 3.2.

**And `command-audit` has its own `0x02`**: *"Command log permanently enabled (only possible to turn
off through factory reset)"* (section 4.2). Same gated class as `force-audit 0x02`. See 3.6.

### 3.1 What the drainer exports

`GET LOG ENTRIES` (section 6.1.30) returns, per entry: `item`, `cmd`, `length`, `session key`,
`target key`, `second key`, `result`, `tick`, and a 16-byte `hash` - plus two counters printed
ahead of the entries, `unlogged boots` and `unlogged authentications`. Both counters are part of the
record and both are load-bearing: *"the number of unlogged authentication and power-up events is
stored in a counter that is retrieved as part of the log retrieval"* (section 1.2.11). They are the
device own admission that some real events have **no chain entry at all**.

Required capability: `get-log-entries` on the session key, and nothing else. The shipped roster gives
that capability to exactly one key (`auditor-log-drain`, domain 2, empty delegated set) so that the
drainer credential can do nothing except drain.

**One asymmetry worth naming because it is a real control weakness.** `SET LOG INDEX` - the command
that tells the device which entries may be reused - documents **"No specific capabilities are
required"** (section 6.1.57). So *any* authenticated session can advance the index and, under
`force-audit`, release a halted device. The evidence-retention control is therefore only as strong
as the weakest credential on the device, not as strong as the auditor credential.

### 3.2 How often - the arithmetic, executed rather than asserted

Let `R` be the ring size (62), `f` the number of consecutive drain failures to survive, `c` the
entries a drain itself costs, `r` the logged-entry rate from application work, and `T` the interval.
Between the last SUCCESSFUL drain and the next one the device may see `f + 1` intervals of work plus
`f + 1` drain attempts - a failed drain that got as far as opening a session still spent its entries.
So:

```
(f + 1) * (r * T + c)  <=  R          =>          T  <=  ( R/(f+1) - c ) / r
```

Two conclusions fall straight out, and both are design decisions rather than tuning:

1. **The drainer consumes the resource it protects.** If `R/(f+1)` is not strictly greater than `c`,
   **no interval works at all**. Holding a persistent session (small `c`) is therefore a
   *feasibility condition*, not an optimisation.
2. **There is a maximum sustainable logged-entry rate.** `T` has a physical floor, so above some `r`
   the 62-entry ring cannot be drained losslessly by **any** schedule. Past that point the honest
   options are: log fewer commands, or accept lossy evidence and say so, or stop calling it an audit
   trail.

Worked, with `f = 1` (survive one failed drain) and 3 logged entries per payment:

| scenario | `c` | `r` | budget/cycle | interval |
|---|---|---|---|---|
| 1 payment/s, session per drain | 3 | 3/s | 62/2 - 3 = **28** | **9.33 s** |
| 1 payment/s, persistent session | 1 | 3/s | 62/2 - 1 = **30** | **10.0 s** |
| 1 payment/min, session per drain | 3 | 0.05/s | **28** | **560 s** (9m20s) |
| 1000 payments/s | 3 | 3000/s | 28 | **INFEASIBLE** - below the physical floor |
| drain costs 31 entries | 31 | any | **0** | **INFEASIBLE** - drainer fills the ring |

All five rows are test cases in `hsm-audit-log-drain-model.test.ts`, so the table cannot drift from
the function. `drainBudget` returns `{ feasible, intervalSeconds, budgetPerCycle, reason }` and the
infeasible rows carry the reason as prose, not as a zero.

**Note how 3.0 feeds back in here.** If signing is not logged, `r` collapses to the
session-establishment rate and the interval lengthens enormously - the drainer looks *easy* exactly
in the configuration where it is *worthless*. Cheap interval is not good news on its own; it is a
prompt to check what is being logged.

### 3.3 Where it persists, and how the record stays verifiable

- **Append-only, text, in-repo-shaped.** One JSON object per drain window: the entries verbatim
  (`hash` as lowercase hex), the two unlogged counters, and the untrusted host annotation of 3.5.
  Hex-in-JSON rather than a binary export, per `.claude/rules/no-binary-in-proof-lineage.md` - a
  verification artifact a reviewer cannot read in a diff is not a verification artifact.
- **Windows OVERLAP deliberately.** This is a design requirement, not a nicety: see 3.4.
- **Off the signing host, and the honest limit on that.** Copying the record to a second machine
  bounds what a host compromise can retroactively erase; it does not bound what the host could have
  written in the first place. The compromised host is *upstream* of persistence, always.

### 3.4 What the hash chain proves - and precisely what it does not

Yubico:

> "Entries in the Log Store are organized to form a chain of hashes. This enables auditors to verify
> that a given set of entries has not been tampered with after extraction, and that all entries are
> present." - section 1.2.11

Read precisely, **"all entries are present" is scoped to the extracted set.**

> **THE CLAIM: the chain proves a DRAINED WINDOW was not altered after extraction.**
> **THE LIMIT: it does NOT prove nothing was evicted BEFORE you drained.** The ring is 62 deep and
> wraps silently by default, so eviction is the normal case, not the exceptional one. The chain
> stays perfectly valid across a wrap - integrity preserved while the evidence is destroyed, which
> is the worst combination for a reviewer, because the chain verifies and invites confidence.

That limit is enforced in code, not asserted in prose: `detectEvictionGaps` is a separate function
from the consistency check, and its findings never merge with them.

**The link function is not guessed.** The hash `H` that chains entries is specified in Yubico
protocol documentation this work has not read. Rather than invent one and ship a verifier that
"passes", every implemented check is chosen to need **no knowledge of H**:

| check | what it establishes | needs H? |
|---|---|---|
| **index continuity across drains** | entries were evicted before banking | no - integer arithmetic |
| **overlap consistency across drains** | an already-banked entry was rewritten | no - byte equality |
| **tick monotonicity within a boot epoch** | the sequence was reordered or forged | no - integer comparison |
| **unlogged boot / auth counters** | activity exists that no chain will ever cover | no - the device says so |

**Overlap consistency is the load-bearing one.** If two drains overlap on item `k`, the two copies
must be byte-identical; a rewrite must differ somewhere. It costs exactly one thing: **the drainer
must overlap its windows deliberately.** A drain-and-forget schedule produces no overlap and
therefore no tamper evidence, so **a missing overlap is itself reported as a finding** rather than
passing silently.

**And index continuity has its own stated limit, attached to the finding rather than to a footnote.**
`SET LOG INDEX` documents *"Possible Values: 1-60"*, which is smaller than the 62-entry store and
strongly suggests a small, wrapping item counter. **If the counter wraps, an eviction of exactly one
full period is invisible.** So a clean gap check means "no gap smaller than the wrap period", never
"nothing was evicted" - and every eviction finding is registered `limited`, never `checked`. Its
falsifier belongs on a throwaway device: drive the log past one full index period and see whether
`item` restarts.

### 3.5 The tick-to-wall-clock trap - declared, metered, and what it costs

The log carries a monotonic `tick`, not a wall-clock timestamp. Correlating tick to time is a
**host-side** step, and the host is the thing assumed compromised. Under
`.claude/rules/local-time-never-enters-the-shared-fold.md` that correlation is a crossing between two
orders that must never touch: the device `tick` is the shared logical order, the host clock is local
time, and local time *"MUST NOT filter, drop, weight, reorder, or de-duplicate the evidence on its
way into the shared fold."*

**How this design declares and meters the crossing.**

1. **The tick is the only order the record trusts.** All ordering, gap detection and monotonicity
   checks run on `item` and `tick`. Nothing else.
2. **The host clock is carried in one explicitly-named, explicitly-untrusted field**,
   `hostObservedAtUntrusted`, on the drain window rather than on any entry. It is the declared
   channel: present, labelled, provenance visible.
3. **It decides nothing, and that is enforced by a test rather than by intent.** A test feeds the
   same drain sequence twice - once bare, once with wildly wrong host timestamps including one from
   1999 - and asserts the findings are **identical**. If the host clock ever starts influencing a
   verdict, that test fails.
4. **The metering is that the annotation is one-way.** A human reading a record may read it; no check
   may. There is no code path from `hostObservedAtUntrusted` into a comparison.

**What that honestly costs, stated plainly rather than engineered around.**

> **Without an off-host time source you can establish the ORDER of HSM operations and never their
> WALL-CLOCK TIME.** For "did the signature happen before or after the revocation" that is
> sufficient, provided the revocation is itself an on-device event in the same chain. For "was this
> signature inside the authorised window" measured against any external clock, **it is not
> sufficient, and no amount of host-side care makes it sufficient.**

**The fix that would work, named because honesty requires naming the control before refusing it, and
it is NOT built:** an **anchor record** pairing a device `tick` with evidence produced **off-host** -
for an x402 signer the natural one is the settlement transaction, whose timestamp comes from the
chain rather than from the machine that signed. Two anchors bracket every tick between them into a
bounded real-time interval, and the compromised host never supplies a timestamp; it merely relays one
a third party already committed to. That composes with the shared-fold rule rather than violating it,
because the anchor enters through a declared, externally-witnessed channel.

**Register: designed-not-running.** No anchor record exists and no code writes one. Until one does,
**a compromised host still supplies the only timeline anyone has** - which is exactly the state the
connector review flagged. This design narrows it to a single named, buildable gap instead of closing
it.

### 3.6 `force-audit` - per device, and `0x02` is a gated class

The trade is strict, and it is not the same trade on every device:

- **Off (the default): evidence is destructible.** *"By default, when the Log Store is full, it is
  used as a circular buffer, meaning that the least recently used entry is overwritten"* (1.2.11).
  An adversary hides one signature by performing 62 boring operations.
- **`force-audit 0x01`: the device refuses.** *"entries from the Log Store must be retrieved or
  commands that cannot be logged will fail"*, returning `LOG FULL` (`0x0a`). Session establishment
  stays permitted so logs can always be retrieved.

Converting silent evidence-loss into loud availability failure is normally right for a root of
trust - **except where the device sits on the critical path of unattended payments.** So:
**signing device: force-audit OFF plus an aggressive drain; ceremony device: force-audit ON.** The
shipped roster encodes exactly that split, one principal per device role.

> **`force-audit 0x02` - "Force Audit permanently enabled (only possible to turn off through factory
> reset)" - is IRREVERSIBLE UNTIL FACTORY RESET. It is a NON-REVERSIBLE ACTION and therefore a GATED
> CLASS requiring fresh human authorization. It is not covered by standing authority and no agent may
> issue it.** The identical sentence applies to `command-audit 0x02`. Any runbook printing either
> command must print this warning on the same screen, not in an appendix - and note that on a device
> holding a live payment key, `0x02` hands anyone with a credential a permanent denial-of-service
> lever, because the only recovery destroys every key.

### 3.7 Register summary for the drainer

| component | register |
|---|---|
| drain-interval arithmetic | **measured** - 24 tests, 41 assertions, executed |
| eviction-gap / overlap / tick / unlogged-counter checks | **measured** - same suite |
| the 62-entry ring, circular by default | **checked** - User Guide 1.2.11 |
| `force-audit` semantics incl. `0x02` irreversibility | **checked** - User Guide 1.2.10 / 4.2 |
| per-command audit disabled by default incl. `0x56` | **checked** vs a vendor doc example; **NOT measured on our device** |
| item-counter wrap period | **doc-silent-unverified** - falsifier named, throwaway device |
| the chain link function H | **not read** - deliberately not guessed; no check depends on it |
| device I/O, scheduling, persistence, anchors | **designed-not-running** |

## 4. Findings in priority order

1. **`POST /connector/api` ignores `Content-Type` (section 1).** A page the operator merely opens can
   execute an HSM command blind. Host-header allowlisting is off by default and would not stop it.
   **Who is affected:** anyone running an unsupervised connector. **What they observe:** nothing at
   all. **Action:** do not leave the connector running idle; put it under launchd with `KeepAlive` so
   a takeover is a visible flap. **SLA:** before any agent signs.
2. **Per-command audit is disabled by default, including SIGN ECDSA (3.0).** The audit log cannot
   witness agent spending because it is not recording it. **Action:** read the `command-audit` mask,
   then enable logging for the signing commands - a human step, it needs `set-option`. **SLA:**
   before the drainer is built, because building the drainer first produces a green pipeline over
   nothing.
3. **Effective privilege is capabilities UNION delegated (2.1),** and the roster lint now computes
   it. **Action:** keep every operational key delegated set EMPTY; the shipped roster does.
   **SLA:** at provisioning time; the lint is the gate.
4. **`SET LOG INDEX` requires no capability (3.1).** Evidence retention under `force-audit` is only
   as strong as the weakest credential on the device, not as strong as the auditor credential.
5. **The import-wrapped domain constraint is undocumented (2.4).** Registered as silence, with the
   falsifier named. Not claimed as an escalation.
6. **Wall-clock time for HSM operations is unavailable without an off-host anchor (3.5),** and the
   anchor is not built.

## 5. Falsifiers named and NOT run - all belong on a throwaway device

| question | falsifier | why not run |
|---|---|---|
| Does `import-wrapped` really permit a foreign domain? | attempt the import, read the object domains | needs a credential and a live import |
| Does the `item` counter wrap, and at what period? | drive the log past one full period | needs sustained device operation |
| Is `command-audit` for `0x56` disabled on OUR unit? | `get-option --opt-name command-audit` | needs a credential |
| Does `force-audit 0x01` recover cleanly after a drain? | set, fill, drain, observe | irreversible-adjacent; human step |
| Does a CORS-simple POST really execute? | serve a page, POST 3 bytes as `text/plain`, read the connector log | **a safe variant exists**: run it against a connector with NO device attached |

The last row is the one worth doing now, and it needs no HSM: `usbProxy` fails and the request is
logged anyway, which is all the confirmation the claim requires.

## 6. Anchors - checked

**Yubico, YubiHSM 2 User Guide** (`docs.yubico.com/hardware/yubihsm-2/hsm-2-user-guide/`,
machine-read from the shipped `webdocs.pdf`, revision dated 2026-08-12, fetched 2026-08-20) -
1.2.3 capabilities as an 8-byte bitfield, 1.2.4 domains, 1.2.10 force-audit values, 1.2.11 the Log
Store, 1.4 delegated capabilities and the administrative-key caution, 3.6 domain subsetting on
create, 4.2 per-command audit and its default output, 6.1.6 change-authentication-key, 6.1.15 delete
object, 6.1.30 get log entries, 6.1.38 import wrapped, 6.1.43 and 6.1.44 put authentication key,
6.1.50 put wrap key, 6.1.57 set log index, 6.1.61 sign ecdsa command code `0x56`.

**Yubico/yubihsm-shell** `lib/yubihsm.h`, `yh_capability[]` (master, fetched 2026-08-20) - the 56
capability bit indices, transcribed verbatim into the lint as a single diffable block.

**Yubico/yubihsm-connector** at `76b26eb809a9068c497baec4b5f8761a7825c475` (VERSION 3.0.7) -
`api.go`, `main.go`. Read for analysis only; nothing here reimplements it, and no expression was
carried across.

**Fetch Standard, CORS-simple requests** - why a `text/plain` body avoids preflight, and why a blind
write needs no reply.

**Saltzer and Schroeder (1975)**, *The Protection of Information in Computer Systems* - least
privilege and complete mediation. The delegated-versus-capabilities distinction in 2.1 is a
least-privilege failure that survives precisely because the mediation is performed on the wrong
quantity.

**Goguen and Meseguer (1982)**, noninterference - 3.5 is that discipline applied to time: the host
clock is an undeclared channel until it is declared and metered.

**Lamport (1978)**, *Time, Clocks, and the Ordering of Events in a Distributed System* - the tick is
a logical clock. It orders and it does not date, and 3.5 is what that costs operationally.

**Haber and Stornetta (1991)**, *How to Time-Stamp a Digital Document* - the anchor design in 3.5 is
their construction, with the settlement chain as the widely-witnessed publication.

## Pointers

- `src/Core.TypeScript/hygiene/hsm-authkey-model.ts` - the pure model: capability bits, domains,
  roster validation, the delegation closure, the findings
- `src/Core.TypeScript/hygiene/lint-hsm-delegated-capability-escalation.ts` - the thin CLI
- `src/Core.TypeScript/hygiene/lint-hsm-delegated-capability-escalation.test.ts` - 43 tests
- `src/Core.TypeScript/hygiene/hsm-authkey-roster.json` - the declared roster,
  `proposed-not-provisioned`
- `src/Core.TypeScript/hygiene/hsm-audit-log-drain-model.ts` and its test - the drainer pure logic
- `docs/research/2026-08-20-the-running-connector-measured-loopback-is-not-a-boundary-when-one-uid-owns-the-host.md`
  - R12 came from there; section 1 resolves it and section 2.3 corrects that document section 7
- `docs/research/2026-08-20-secp256k1-rescore-of-the-hsm-survey-fips-mode-disables-the-curve-and-unattended-signing-is-the-crux.md`
  - its open question 7 (the drainer) is answered here as a design, with the blocking finding in 3.0
- `src/Core.TypeScript/federated-identity/hsm-domain-map.ts` - the SPIFFE-to-domain decision; this
  lint checks the roster that decision assumes. Complementary, not overlapping
- `.claude/rules/local-time-never-enters-the-shared-fold.md` - the rule 3.5 is held to
- `.claude/rules/toy-is-free-metered-must-be-earned.md` - the register discipline every table uses
- `.claude/rules/no-binary-in-proof-lineage.md` - why the drain record is hex-in-JSON
- `memory/nazar/NOTEBOOK.md` - the running ops notes this work continues
