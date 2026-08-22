# TPM 2.0 vs YubiHSM 2 as root of trust — the isolation architectures are inverted

**Aaron 2026-08-18, relayed:** Max is joining the k8s and hardware-USB work. His machine is a
centralized unit with a GPU and a mini computer, and **probably** has a TPM but no HSM yet. *"We should
map the difference, and with docker limitations between AIs."*

Written against
[`2026-08-18-hsm-container-isolation-a-shared-connector-is-not-a-boundary-and-what-prove-ish-can-honestly-mean.md`](2026-08-18-hsm-container-isolation-a-shared-connector-is-not-a-boundary-and-what-prove-ish-can-honestly-mean.md)
(#12178) so the deltas are explicit rather than a second survey. Every section below says what changed
from that document's finding, and in the same words where the finding transfers unchanged.

**Analysis and documentation only.** No TPM session was opened, no key created or used, no ownership
taken, no device probed. **Max's machine was not accessed and no access was sought** — this is a
capability comparison from documentation and from our own repo. The TPM presence on his machine is
**"probably," unverified**, and is treated below as a capability fact relayed by Aaron, never as
anything more.

---

## 0. The answer, before the evidence

> **The two devices have opposite isolation architectures, and each is missing exactly what the other
> has.**
>
> - The **YubiHSM 2** has a *shared, unauthenticated path* to a device that enforces *per-caller
>   partitioning* (16 domains, capability sets, evaluated per session).
> - The **TPM 2.0** has a *kernel-enforced, per-caller path* (a device node, gated by the filesystem and
>   the device cgroup) to a device that enforces **no per-caller partitioning at all.**

The TPM has no domains, no per-caller identity, and no notion of *who* is asking. Its access control is
**per-object** — an auth value or a policy attached to the object — which means isolation between tick
sources rests on **secrets each container holds**, i.e. credential isolation, i.e. the L1 rung of the
existing ladder. The device does not help.

So the honest verdict, stated as the clean negative that was invited:

> **A TPM 2.0 is not a substitute for a YubiHSM 2 for this use, and the missing property is nameable:
> the TPM cannot partition itself between mutually distrusting tenants.** It is an excellent root of
> trust *for a machine*. It is not a multi-tenant key store, was never specified as one, and the
> resource manager that looks like it might be one is a memory manager, not an access-control layer.

What the TPM does bring that the HSM cannot is a **path boundary the kernel enforces** and — the one
genuine advantage that survives scrutiny — **per-file-descriptor virtualisation of transient objects
and sessions**, verified in the kernel source, which retires the `YH_MAX_SESSIONS = 16` starvation
finding as an *isolation* failure (§3). That advantage is then given back twice over: once softly, as a
shared-queue performance cost, and once hard, by the global dictionary-attack lockout (§4).

And there is a second axis the capability comparison misses, which may matter more for Max's node than
any of it: **where each device's update boundary sits, and how big the unit is that must be replaced
when a defect falls below it** (§7a). The YubiHSM's replace-unit is one hot-swappable USB device. An
fTPM's is the machine.

---

## 1. The delta table

| property | YubiHSM 2 (#12178) | TPM 2.0 | delta |
|---|---|---|---|
| path to device | HTTP to a shared connector; **no caller authentication**, *"not a trusted component"* | `/dev/tpmrm0` device node | **inverted — the TPM path is a real kernel boundary** |
| per-caller partitioning **inside** the device | 16 domains × capability sets, per session | **none** | **inverted — the HSM wins decisively** |
| session/context pool | **16 device-wide**, 30s timeout; trivially starved | **virtualised per fd** — `context_tbl[3]` + `session_tbl[3]` per space | **TPM wins on isolation; transfers as a *performance* finding (§3)** |
| namespace enumeration | domain-scoped: objects outside your domains are invisible | **`TPM2_GetCapability` leaks all persistent handles and NV indices, unauthenticated** | **inverted — the HSM wins; this is what defeats obfuscation (§3a)** |
| global starvation vector | session exhaustion, **needs a valid credential** | **DA lockout, needs NO credential** — only failures | **TPM is worse (§4)** |
| audit | 62-entry ring on-device; completeness traded against availability | **no on-device audit log at all** | different, not better (§8) |
| admin credential | one auth key with `put-authentication-key` = total compromise | owner/lockout auth = lockout reset + hierarchy control | **unchanged — same weight, same finding** |
| cheap physical attack | rim-press reset: free, ~10s, **erases** | bus sniffing ~$300 / faulTPM ~$200: **extracts** | **TPM is worse (§7)** |
| per-tenant virtual device | none | **vTPM per VM** (swtpm) | TPM wins, at the cost of a VM per tenant (§5) |
| available on the Mac Studio | yes (USB) | **no — Apple Silicon has no TPM 2.0** | fleet is heterogeneous (§6) |
| replace-unit below the update boundary | **one USB device, hot-swappable** | **the board (dTPM) or the CPU (fTPM)** | **the procurement finding — favours the HSM (§7a)** |

Two rows carry over from #12178 *unchanged*, and they are the two that matter most for governance:

- **The admin credential is a standing device-wide authority**, hence a weight (manifesto §3) and a
  central point of control (§1). On the HSM it is the auth key holding `put-authentication-key`; on the
  TPM it is the owner/lockout authorization, which is the only thing that can clear a lockout. Same
  finding, same rule, different device.
- **A negative test with no positive control in the same run is the vacuity class.** §8.

---

## 2. The access path — this is a real filesystem boundary, and the coordinator's hypothesis holds

On Linux a TPM is reached through a device node. Three exist and the difference is not cosmetic:

| node | semantics |
|---|---|
| `/dev/tpm0` | raw device, **one client at a time** |
| `/dev/tpmrm0` | the **in-kernel resource manager** (kernel ≥ 4.12), multi-client |
| *(userspace)* `tpm2-abrmd` | the older userspace resource-manager daemon, reached over D-Bus |

The repo's probe already encodes the distinction — `TPM_DEVICE_NODES = ["/dev/tpmrm0", "/dev/tpm0"]`
and a sysfs comment separating *chips* (`tpm0`) from *resource managers* (`tpmrm0`)
(`tools/setup/persona-keys/tpm2-linux-probe.ts:219-223`).

**So the hypothesis in the brief is correct and it is the largest single improvement over the HSM.**
Gating a container's TPM access is `--device=/dev/tpmrm0` plus the device cgroup plus ordinary
ownership and mode on the node (conventionally `root:tss`, `0660`). That is enforced by the kernel,
requires no cooperation from any userspace daemon, and cannot be bypassed by reaching a port. Compare
the HSM under the only topology macOS permits, where the boundary was *nothing at the connector* and the
connector had to be bound to a non-localhost interface to serve containers at all.

**But the boundary is binary, and this is the sentence that matters:**

> **Granting the device node grants the whole TPM.** There is no partition inside the device to grant a
> *part* of. The kernel decides *whether* a container may talk to the TPM; nothing decides *which part*
> of the TPM it may talk to.

Under the HSM, a compromised container reached a device that would still refuse it another tenant's
objects. Under the TPM, a compromised container reaches a device with no concept of tenancy, and what
stops it from using another tick source's key is that it does not know that key's auth value — which is
credential isolation, the rung the prior L1/L2/L3 note already graded, not a device-enforced partition.

**Is there a TPM namespace?** The obvious fix — namespace the TPM per container, as the kernel
namespaces PIDs and mounts — has been explored (the `/dev/tpms<n>` space-per-namespace direction) and is
**not available as a merged, shipping kernel feature.** Related namespacing work in this area went to
IMA rather than to the TPM itself. Absent a namespace, **containers cannot be given isolated views of a
TPM**, and no arrangement of `--device` flags creates one.

---

## 3. Does the resource manager virtualise, or merely multiplex? — verified against the kernel source

**Aaron 2026-08-18:** *"does the TPM resource manager virtualise contexts, or merely multiplex them? if
we multiplex them we can come up with protection via obfuscation — I don't like this security model but
it stops 80% of attackers."*

This was the sharp question and the answer is a **split**. It was checked against
`drivers/char/tpm/tpm2-space.c` and `include/linux/tpm.h` in mainline rather than against summaries,
and the source both confirms the split and **moves the boundary** from where a reasonable summary puts
it. Three corrections follow, all of them load-bearing.

### It virtualises — and the mechanism is a per-fd handle map with hard, small limits

```c
struct tpm_space {
        u32 context_tbl[3];
        u8 *context_buf;
        u32 session_tbl[3];
        u8 *session_buf;
        u32 buf_size;
};
```
*(`include/linux/tpm.h`)*

That is the whole isolation unit: **three transient-object slots and three session slots per open file
descriptor.** Virtual handles are mapped to physical ones per space (`tpm2_map_to_vhandle`), a space is
loaded before a command and saved after it, and exceeding three yields `-ENOMEM` with the driver's own
`"out of slots for 0x%08X"` warning.

Two consequences, and the second is the one nobody expects:

- **The `YH_MAX_SESSIONS = 16` starvation finding does not transfer as an isolation failure.** A tick
  source that leaks sessions leaks them **into its own three slots**; its peers keep theirs. In
  #12178's device-wide 16-slot pool the same bug denied every peer. Genuine advantage, and the
  three-slot figure is not a shortcoming — it matches the TPM 2.0 spec's guaranteed minimum of three
  transient objects, which is precisely the scarcity the resource manager exists to hide.
- **The limit is now per-container and can be hit by ordinary code.** A tick source needing four
  concurrent transient objects fails inside its own space. That is a **functional** constraint, not a
  security one, and it is far better than the alternative — but it should be designed for rather than
  discovered.

### It multiplexes where it counts, and the swap cost is paid by every peer

Virtualisation here is implemented by **swapping against the one physical device**: `tpm2_prepare_space`
loads this space's contexts and sessions before each command, `tpm2_save_space` writes them back after.
So every command from a shared device node carries **up to six context load/save operations**, and the
physical TPM executes one command at a time.

> **A shared TPM is a shared queue.** The per-command swap overhead is *bounded* (by the array size:
> three contexts plus three sessions), but the command *rate* is not bounded at all. A container
> churning contexts multiplies swap traffic on a serialised device and every peer waits behind it.

So the #12178 finding **does transfer — as a performance and availability finding rather than a
correctness one**, and that is the honest way to state it. It is a soft, degrading denial of service
with no error code, which makes it harder to detect than the HSM's hard `YHR_DEVICE_SESSIONS_FULL`, not
easier. It is nonetheless far less severe than §4, which is a hard stop.

### What is NOT virtualised — and the boundary is narrower than "transients and sessions"

The response filter is the authority here, and it special-cases exactly one handle type:

```c
switch (phandle_type) {
case TPM2_HT_TRANSIENT:
        vhandle = tpm2_map_to_vhandle(space, phandle, false);
        if (!vhandle)
                break;                                    /* not ours -> DROPPED */
        data->handles[j] = cpu_to_be32(vhandle);
        j++;
        break;
default:
        data->handles[j] = cpu_to_be32(phandle);          /* copied through verbatim */
        j++;
        break;
}
```
*(`tpm2_map_response_body`, `drivers/char/tpm/tpm2-space.c` — runs only on `TPM2_CC_GET_CAPABILITY`
with `TPM2_CAP_HANDLES`)*

**The correction:** it is accurate that spaces isolate transient objects *and* sessions for
**execution** — both are context-saved per space, so a session created in space A is not usable from
space B. But for **enumeration**, only `TPM2_HT_TRANSIENT` is filtered. Everything else falls to
`default:` and is copied through unchanged.

Global, unpartitioned, and visible to every container on the node:

| resource | handle range | virtualised? |
|---|---|---|
| transient objects | `0x80……` | **yes** — mapped, and other spaces' handles are dropped from enumeration |
| HMAC / policy sessions | `0x02……` / `0x03……` | **execution yes, enumeration no** |
| **persistent objects** | `0x81……` | **no** |
| **NV indices** | `0x01……` | **no** |
| **PCRs** | `0x00……` | **no** — one set per platform (§6) |
| **hierarchies / permanent** | `0x40……` | **no** |

> **The resource manager is a memory manager, not an access-control layer.** It solves the problem that
> the TPM has almost no RAM. It does not solve, and does not claim to solve, the problem that the TPM
> has no tenants — and §3a shows why that distinction defeats the idea the question was raised to test.

## 3a. The obfuscation idea — the honest read, and the exact call that defeats it

Aaron's proposal is that *if* the RM merely multiplexes, hiding things in the shared namespace buys
protection that "stops 80% of attackers." The honest read has two halves and the first is a flat no.

### On this surface it is closer to 0% than 80%, and the source says why

Obfuscation would have to be applied to the **non-virtualised** half — persistent handles and NV
indices — because the virtualised half is already isolated by a real mechanism and needs nothing.

**That half is enumerable by design, and the kernel does not filter it.** The `default:` branch above
copies every non-transient handle straight through. So:

```
tpm2_getcap handles-persistent     # -> TPM2_GetCapability(TPM_CAP_HANDLES, TPM_HT_PERSISTENT)
tpm2_getcap handles-nv-index       # -> TPM2_GetCapability(TPM_CAP_HANDLES, TPM_HT_NV_INDEX)
```

returns **every persistent handle and every NV index on the device**, belonging to every container.
Two properties make this fatal to the idea rather than merely inconvenient:

1. **`TPM2_GetCapability` takes no authorization session.** It is answerable with **no credential at
   all** — which is exactly why `tpm2_getcap` works on a fresh machine before anything is provisioned.
   The attacker needs the device node and nothing else.
2. **`TPM2_NV_ReadPublic` is likewise unauthenticated**, so an index's public area — size, attributes,
   name algorithm — is readable even where its contents are not. Hiding the *handle* does not hide the
   *shape*.

And the namespace is a flat 24-bit integer space, so it is walkable even if enumeration were removed.
An obfuscation layer here is defeated by one documented command that requires no credential. **Naming
"80%" for this surface is not conservative, it is inverted: the attackers it stops are the ones who
were not going to look, and looking is one command.**

### The converse, because the general instinct is right

Obfuscation as a **defence-in-depth layer** is legitimate and it is not what is being rejected. The
rule the repo already holds is only that it must never be **the thing being counted**, and the
vocabulary exists: an obfuscation layer is `unmetered`
(`.claude/rules/toy-is-free-metered-must-be-earned.md`) — implemented, possibly useful, never falsified
— and asserting it as a control is the vacuity class, since **a control that cannot fail is not a
control**.

So the test for any obfuscation proposal, stated so it can be applied:

> **Name the attacker it stops, and name the observation that would show it did not.** If neither
> exists, it is decoration on the threat model rather than a layer in it.

Applied here: the attacker is "one who does not enumerate," and the falsifying observation is a single
`tpm2_getcap` — which is why this particular proposal fails the test rather than the idea failing in
general.

### Where a real control belongs on that surface instead

Each of these replaces obfuscation with something that has a secret or a policy behind it — i.e. with
actual cryptography — and each is checkable by §8's Y-list:

- **Per-container NV index allocation with distinct auth values.** The index remains visible; using it
  requires a secret. Visibility was never the property worth defending.
- **Policy sessions binding indices to container identity** — a policy is a stated, auditable condition
  rather than a hidden fact, and it fails closed.
- **If the isolation must be hard: a vTPM per tenant, or separate physical devices** (§5, §9). This is
  the only route that makes the *namespace itself* per-tenant rather than merely making entries in a
  shared namespace harder to guess.

## 4. The starvation finding is not retired — it is replaced by a worse one

The HSM's session exhaustion is gone. In its place is the TPM's **global dictionary-attack lockout**,
and on every axis that matters it is worse.

Microsoft's TPM fundamentals states the architecture plainly:

> "Providing a failure count for individual keys isn't technically practical, so TPMs have a **global
> lockout** when too many authorization failures occur."

> "Because many entities can use the TPM, **a single authorization success can't reset** the TPM's
> anti-hammering protection. This prevents an attacker from creating a key with a known authorization
> value and then using it to reset the TPM's protection."

And the concrete defaults, as Windows provisions them: **lock after 32 authorization failures, forget
one failure every 10 minutes** — so a full recovery from a saturated counter without owner
authorization takes **320 minutes**.

**Three ways this is worse than the HSM finding it replaces:**

1. **It needs no credential.** HSM session exhaustion required a *valid* auth key — you had to be a
   legitimate tenant to starve the others. TPM lockout requires only the ability to **fail**. Any
   container holding the device node can lock out every peer by guessing wrong 32 times, having been
   issued nothing at all.
2. **The victim cannot clear it.** A success does not reset the counter — *by design, and the design is
   correct*, since a resettable counter would be no protection. Only the **owner/lockout
   authorization** can reset it, which is the single device-wide admin credential this document's §1
   already flagged as a standing weight. And that path is itself rate-limited: a wrong owner password
   blocks another reset attempt for **24 hours**.
3. **It has an accidental trigger unrelated to authorization.** The `failedTries` counter is also
   incremented on **unclean shutdown**, deliberately, so that a well-timed power cut cannot be used to
   erase a real failure. The consequence in production is documented: a systemd user reported *"After
   power cycling the machine 3 times the TPM2-sealed encrypted storage did not open anymore."*

The TCG's own provisioning guidance concedes the consequence — *"lockout of all TPM use could make the
system unstable"* — which is an unusually direct admission that the anti-hammering protection **is** a
denial-of-service surface on a shared device.

**The mitigation, and its exact limit.** `TPMA_OBJECT_NODA` marks an object exempt from DA protection,
which is correct for objects whose auth value is well-known or high-entropy — this was systemd's fix
for the case above, on the reasoning that *"the authValue that is used for the primary key is always
zero … so dictionary attack protection for the authValue does not make sense."* Setting `noDA` on every
tick source's high-entropy objects removes the **accidental** path and the **own-object** path.

It does not remove the **adversarial** path, because the adversary does not have to attack *your*
object. It only needs *some* reachable DA-protected entity to fail against — and in a multi-tenant
setup that includes every object any other tenant created without `noDA`, which is a property you
cannot audit from inside your own container. **A per-tenant mitigation cannot close a global vector.**

**Ranking, in #12178's tiers:** reachable from **inside an unprivileged container** with no credential,
denying every peer, un-clearable by any victim. That is the top of the in-container tier, and it is
strictly above anything in the HSM's list.

---

## 5. Software TPMs — a different shape, and a precise limit on what they root

`swtpm` gives a **vTPM per VM**: a dedicated emulator process, with the guest's TPM state persisted as a
**file on the host** (EVE-OS, for instance, keeps it at `/persist/swtpm/tpm-state-<VM-UUID>`; PCRs, NV
data and keys all live there). QEMU, OpenStack Nova, EVE-OS and Kata-class runtimes all support this.

This genuinely fixes the tenancy problem. Each tick source gets a device with its own PCRs, its own NV
space, its own DA counter, and its own hierarchies. §3's global-state list becomes per-tenant. §4's
lockout becomes a self-inflicted, self-recoverable condition affecting one tenant.

**The cost is a VM per tick source, not a container per tick source.** A vTPM is attached to a virtual
machine by the hypervisor; there is no mechanism that attaches one to a plain container, which is the
same absent-namespace fact as §2. So "per-container vTPM" means Kata-style microVMs, with the memory,
boot-time and operational cost that implies.

**And now the question the brief asked precisely — what is a software TPM a root of trust *for*?**

> **A vTPM is a root of trust for the guest against other guests. It is not a root of trust for the
> guest against the host, and it cannot be, because its entire state is a file the host owns.**

Everything a vTPM protects is protected *by the host*, so its security is exactly the host's security
and never more. The attestation architecture makes this concrete rather than merely philosophical: a
vTPM's endorsement key is **not manufacturer-certified**, so it proves nothing on its own. The standard
construction has the host's *hardware* TPM generate an attestation identity key and **sign the vTPM's
EK** — which, as the EVE-OS documentation puts it, proves the vTPM is running on a TPM with a specific
hardware EK and makes a cloned vTPM detectable.

Read that chain carefully, because it is the whole answer:

- A vTPM's attestation is only as good as the **host hardware TPM** vouching for it.
- Therefore a vTPM **adds a tenancy boundary** and **adds no trust root**. It subdivides trust the host
  already had; it does not manufacture any.
- Therefore for the property Aaron actually wants — *agents on one machine cannot reach each other's
  keys* — a vTPM per microVM is a **real and correct** answer, while for *proving something to an
  outside party* it is worth nothing beyond what the host's own TPM could already prove.

---

## 6. Docker limitations between AIs

Extending #12178's finding that containers buy exactly one thing — a credential unreadable by a peer at
rest and in process memory, closing the four vectors the prior L1/L2/L3 note graded thin.

**That one thing still holds, and it is now doing more of the work than it was.** Under the HSM the
container boundary was a *supplement* to a device that also partitioned. Under the TPM the device
partitions nothing, so **the container boundary plus the object's auth value is the entire isolation
story.** There is nothing behind them.

**What the container boundary does *not* buy when the far side is a shared device node:**

1. **No partition of the device.** `--device=/dev/tpmrm0` is all-or-nothing (§2).
2. **No protection from the global DA lockout.** Namespaces do not partition TPM-internal state (§4).
3. **No protection of NV space, persistent handles, or hierarchy authorizations** — all global (§3).
4. **No sealing to container identity.** See below; this is the sharpest container-specific finding.

### PCRs cannot distinguish one container from another

The natural design — *seal each tick source's key to a PCR policy so only that code can unseal it* — is
the L3 rung of the existing ladder, and **it does not work per-container**, for a reason that is
structural:

- The **non-resettable PCRs** (firmware, bootloader, kernel, initrd) measure the **host**. Every
  container on the machine sees byte-identical values. A policy over them binds a key to *this
  machine having booted this way*, which is a property all tenants share equally.
- The **resettable PCRs** (the application/debug range, resettable from locality 0) can be extended by a
  container — **and reset by any other container with the same access.** A register anyone can reset is
  not an identity; it is a shared scratch variable.

> **So PCR sealing binds a key to the host, not to the tenant. Under a shared TPM there is no PCR
> policy that admits container A and refuses container B.** The L3 rung, which the prior note costed in
> terms of re-seal ceremonies, turns out not to be reachable at all in the shared-device container case
> — the obstacle is not cost, it is that the measurement has no per-container component.

A vTPM per microVM restores it, because then the PCRs are the guest's (§5).

### Fleet heterogeneity — the root of trust cannot be uniform

| machine | HSM | TPM 2.0 | container→device |
|---|---|---|---|
| **Mac Studio** (Apple Silicon) | YubiHSM 2 attached | **none** — Apple Silicon has no TPM 2.0, confirmed by the probe | **neither**: no USB passthrough (no macOS USB/IP server), and no TPM to pass |
| **Max's box** (relayed: mini PC + GPU, *probably* a TPM, no HSM) | none yet | probably — **unverified** | `--device=/dev/tpmrm0` works natively |

This is the direct answer to *"docker limitations between AIs"*: **on macOS a container can reach
neither device.** #12178 established the HSM half — no USB passthrough, so the connector must be
network-reachable, which is the configuration Yubico's advisories assume you are not in. The TPM half is
simpler and worse: there is no TPM on that machine to pass through at all.

So the fleet cannot have one root of trust. The design must either accept **per-node root-of-trust
classes** — a node's capability being a declared, checked property rather than an assumed one — or
standardise on the intersection, which is empty. The repo's existing probe is already built for exactly
this: `Tpm2State` is five-way precisely so that *"we could not look"* never gets rounded to *"there is
none."* That discipline is what makes a heterogeneous fleet auditable, and it should be the input to
any placement decision rather than a boolean per node.

**One thing to verify before designing anything for Max's machine, and it changes the answer:** whether
the TPM is **discrete (dTPM)** or **firmware (fTPM, AMD PSP / Intel PTT)**. They have different and
non-overlapping physical attack profiles (§7), and on a mini PC either is plausible. This needs someone
at the keyboard; it is not inferable from here and is explicitly not inferred.

---

## 7. The physical tier — the TPM is worse than the HSM, and this inverts the usual assumption

#12178 established the HSM's physical tier: a rim-press reset is free, takes ~10 seconds, needs no
credential, and **erases**; EUCLEAK (CVE-2024-45678) can **extract** ECDSA keys but needs physical
possession *plus* a signing credential *plus* specialized equipment, and only below unpatchable firmware
2.4.0.

The TPM's cheap physical attacks **extract**, and they are cheaper:

**Discrete TPM — bus sniffing.** A dTPM communicates with the CPU over an external LPC or SPI bus.
Secrets released by the TPM cross that bus in the clear unless the caller uses encrypted sessions.
Attaching a logic analyzer and recovering the BitLocker VMK during boot is a widely reproduced,
publicly documented recipe with a hardware cost around **$300**. Mitigations exist and are real —
TPM 2.0 salted/bound sessions with parameter encryption, or moving the TPM on-die (Microsoft Pluton) —
but **session encryption is not the default in most tooling**, which is why the attack keeps working.

**Firmware TPM — faulTPM.** The AMD fTPM on Zen 2 and Zen 3 was fully compromised by voltage fault
injection against the Platform Security Processor (*faulTPM*, arXiv 2304.14717, TU Berlin 2023).
Roughly **$200** of off-the-shelf equipment and several hours of physical access recovers a
chip-unique secret, from which the keys protecting the fTPM's NV data on the BIOS flash are derived.
The consequence is the severe part: the attacker can extract **any** material sealed by that fTPM
**even with PCR policy and anti-hammering in place** — the two mechanisms this document has otherwise
been treating as the TPM's protections are simply bypassed, not defeated in detail.

| | cost | outcome | needs a credential? |
|---|---|---|---|
| YubiHSM rim-press reset | free | **erase** | no |
| YubiHSM EUCLEAK (fw < 2.4.0) | specialized equipment | extract (ECDSA) | **yes** |
| dTPM bus sniffing | ~$300 | **extract in transit** | no |
| AMD fTPM faulTPM (Zen 2/3) | ~$200 | **extract everything sealed** | no |

> **The HSM's cheap physical attack destroys; the TPM's cheap physical attacks extract.** For a
> threshold roster this is the more damaging direction: destruction is already priced at n−k wipes, and
> extraction is not priced at all.

This is worth stating loudly because the intuition runs the other way — a soldered-down chip *feels*
more physically secure than a USB stick you can pull out. On the evidence it is the opposite, and the
soldered chip is the one whose secrets leave on a wire.

---

## 7a. Repair boundaries — where is the update boundary, and what sits below it

Aaron surfaced the original Xbox as the precedent, and it reframes the comparison better than any
capability list does. That console's root of trust was a **mask ROM** with a memory-resident BIOS, and
it was broken through a **font-parsing overflow in the trusted path** — a defect in code that could
never be patched, only replaced. (The Xbox case is being landed separately as its own note; what is
taken here is only the transferable question.)

The lesson generalises into a procurement question that a capability comparison misses entirely:

> **Every parser below the update boundary is a permanent liability.** A defect above the boundary is a
> patch. A defect below it is a **replacement**, and the thing that matters is *how big the replaced
> unit is*.

### Where each device's boundary sits

**YubiHSM 2 — the boundary is the USB port, and it is unusually clean.**
Device firmware is **not field-upgradable**; Yubico's stated position is that *"not allowing firmware
updates is the best practice to maximize the security of your keys."* So **everything inside the device
is below the boundary** and every host-side component — `libyubihsm`, the connector, the PKCS#11
module — is above it.

This **reframes #12178's central finding as good news.** That document showed that nearly every SDK CVE
in this product's history is a client-side parser bug on the response path. Under the repair lens, that
is the *right place* for a parser bug to be: all of them were above the boundary and all were fixed by
a package upgrade. The Xbox failure mode — a parser below the boundary — is the one the YubiHSM has
mostly avoided, because it keeps its parsing on the host. What it did not avoid is **EUCLEAK**
(CVE-2024-45678), a defect in the device's own cryptographic library, therefore below the boundary,
therefore **replace-only**.

**Discrete TPM — more of the surface is patchable, with a repair class of its own.**
dTPM firmware *is* field-updatable through vendor tooling. The precedent is **ROCA** (CVE-2017-15361),
where Infineon TPMs generated factorable RSA keys: the fix required a firmware update **and**
regeneration of every key produced before it. That is a third repair class the other devices do not
have — *patch the chip, but the artifacts it produced remain poisoned* — and key regeneration is a
separate cost from patching, borne by every dependent system.

**Bus sniffing sits below the boundary in a different sense**: it is a property of the *board*, an
external LPC/SPI trace. No firmware update moves a TPM on-die. Its mitigation — encrypted sessions with
parameter encryption — lives *above* the boundary in caller software, which is why it is available and
also why it is usually not used.

**Firmware TPM — the largest replace-unit of the three.**
fTPM firmware lives in platform flash and is updated by a BIOS update, so it sits above the boundary.
But **faulTPM** attacks the Platform Security Processor silicon by voltage fault injection, which is
below *any* update boundary. There is no firmware fix for a fault-injection channel in hardware.

### The procurement table

| defect class | YubiHSM 2 | discrete TPM | AMD fTPM (Zen 2/3) |
|---|---|---|---|
| host stack / SDK | patch | patch | patch |
| device firmware crypto defect | **below — replace device** | patch **+ regenerate all prior keys** | patch via BIOS |
| silicon or physical channel | **below — replace device** (EUCLEAK) | **below — board redesign**; mitigate in protocol | **below — replace CPU** (faulTPM) |
| **the replace-unit** | **one USB device, hot-swappable** | a soldered chip, i.e. the board | **the CPU — in practice the machine** |

> **The TPM has more of its defect surface *above* the update boundary than the YubiHSM does; its
> below-boundary defects have a vastly larger replace-unit.** The YubiHSM's worst case is "unplug a
> device and plug in another." The fTPM's worst case is "replace the computer."

### Why this matters to the threshold roster specifically

The roster already prices device replacement: **n − k is the wipe budget** (#12178, §5 T3-A). That
model assumes replace-units that are **independent and cheap** — lose one device, the roster survives,
swap it, move on.

An fTPM breaks both assumptions at once. Its replace-unit is the **node**, so replacing it takes down
**every tick source co-resident on that machine simultaneously**. That is a *correlated* failure, and a
k-of-n threshold does not defend against correlated loss — it defends against independent loss. Putting
several tick sources' roots of trust on one machine's fTPM silently converts n independent shares into
one share wearing n costumes.

**So the recommendation for Max's node is a procurement one and it is concrete:** a USB HSM added to
that machine has a small, cheap, hot-swappable replace-unit that the threshold model already accounts
for. Its TPM — whichever kind it turns out to be — should be used for what a TPM is for (measured boot,
sealing to *machine* state) and should not become the replace-unit on which several agents' key custody
depends. This is a different reason to buy an HSM than "the TPM lacks domains," and it is the stronger
one, because it survives even if every isolation objection in this document were solved tomorrow.

## 8. Discriminating checks vs. vacuous ones — carried across, with TPM's own traps

#12178's core methodological finding transfers **unchanged and in the same words**:

> **A negative test with no positive control in the same run is the vacuity class.**

The TPM's error surface has the same trap and one extra.

**Vacuous here:**

- **X1 — "`/dev/tpmrm0` exists, therefore we have a TPM 2.0."** This is the exact defect
  `tpm2-linux-probe.ts` was written to kill: `/dev/tpm0` is also a **TPM 1.2** node, and `existsSync`
  returns `false` for *every* error, so a permission denial reads identically to no hardware. The
  module's five-way `Tpm2State` exists so `unreadable` / `unavailable` / `indeterminate` never round to
  `absent`. **Start there; do not write a new probe.**
- **X2 — "container B cannot open `/dev/tpmrm0`, therefore B is isolated from A's keys."** Tests the
  path, not the objects. It passes in a configuration where B *does* have the node and simply is not
  using it, and it says nothing about what B can reach once granted.
- **X3 — "attempt to use A's key from B and assert an error."** The #12178 trap, restated. It passes
  when the handle does not exist, when the resource manager is unreachable, when the context failed to
  load, and when the parent was wrong. **And the TPM adds a fifth way to pass with zero isolation:
  during DA lockout every attempt returns an error** (`TPM_RC_LOCKOUT`), so a test run inside a lockout
  window reports total isolation while proving nothing. The discriminating form asserts the *specific*
  code **and** carries the positive control — A using A's own key successfully — **in the same run**.
- **X4 — "the key is sealed to PCRs, therefore only our code can unseal it."** §6: under a shared TPM
  the PCRs are the host's and are identical for every container. The check passes for every tenant
  simultaneously, which is precisely what it is supposed to rule out.
- **X5 — counting.** "N distinct persistent handles exist." A count is not an identification
  (`.claude/rules/numerology-vs-number-theory.md`); N handles with identical or absent auth values
  produce the same count.

**Discriminating here:**

- **Y1 — device-node grant matrix, from configuration.** For each container, does its declared spec
  grant `/dev/tpmrm0`? Pure computation over the compose/manifest files. **No hardware.**
- **Y2 — `noDA` coverage over the declared object roster.** Every object that will exist, with its DA
  disposition, checked against the rule that only well-known or high-entropy auth values may be `noDA`
  and everything else must be justified. Catches the systemd class before it ships. **No hardware.**
- **Y3 — DA-lockout blast-radius statement.** Enumerate which tick sources stop working when the
  counter saturates. The honest answer under a shared TPM is *all of them*, and writing that down is the
  check — it is the one that makes §4 visible to a reviewer instead of discovered at 3 a.m.
  **No hardware.**
- **Y4 — PCR-policy tenancy audit.** For each sealed object, does its policy contain any term that
  differs between containers? Under a shared TPM the answer is structurally *no*, so this check should
  **fail by construction** and stay failing until the design moves to per-tenant vTPMs. A check that is
  designed to be red until an architecture changes is the opposite of vacuous. **No hardware.**
- **Y5 — dTPM vs fTPM classification, recorded once per node**, with the physical profile from §7
  attached. One read at the keyboard; a permanent property thereafter.
- **Y6 — paired access matrix**, exactly as in #12178: for every (container *i*, object *j*), `i ≠ j`
  refused **and** `i = i` succeeds, in one run, with the specific return code asserted and a
  precondition that the TPM is not in lockout. **The only check here that needs hardware**, and the only
  genuine falsifier of isolation.

**Five of the six need no hardware at all** — a higher proportion than the HSM's four-of-six, and for a
structural reason worth noting: **more of the TPM's isolation story lives in configuration**, because
less of it lives in the device.

---

## 9. Verdict — which property is missing, precisely

**For Max's machine as a node in the fleet:** a TPM (if present) is a genuine and worthwhile capability
for what a TPM is for — measured boot, sealing to *machine* state, and machine attestation. It should be
probed with the existing five-way probe and recorded, not assumed.

**For the property Aaron is actually after — agents on one machine cannot reach each other's keys —**
a shared TPM 2.0 is **worse than the shared YubiHSM 2**, and the missing property is exactly one thing:

> **The TPM has no tenants.** It cannot partition itself between mutually distrusting callers. What
> #12178 found the HSM *does* have — device-enforced per-caller partitioning, which was the one thing
> that survived that document's otherwise negative assessment — is precisely what the TPM lacks.

The kernel-enforced path (§2) and per-FD session virtualisation (§3) are real improvements over the
connector, and they are not small. They are not enough, because they improve *how you reach* the device
and not *what the device will refuse you*, and they are cancelled by a global lockout that any container
can trigger with no credential at all.

**Three routes forward, ranked, none of them "put the keys on the TPM and share it":**

1. **A vTPM per microVM** (§5) — solves tenancy properly, costs a VM per tick source, and roots no trust
   the host did not already have.
2. **One device per trust domain** — #12178's T5, unchanged, and now recommended for both device
   families for the same reason: the partition that works is the physical one.
3. **A TPM as the *machine's* root of trust and something else as the *agent's* key store** — which is
   the reading that makes both devices useful at once and asks neither to do the other's job. The TPM
   answers *"did this machine boot as intended"*; it should not be asked *"may this container use that
   key."*

**And one procurement conclusion that is independent of every isolation argument above** (§7a): a USB
HSM on Max's node has a small, cheap, hot-swappable replace-unit that the roster's n − k wipe budget
already accounts for, whereas an fTPM's replace-unit is the machine — which converts several tick
sources' independent shares into one correlated failure. That reason survives even if every isolation
objection in this document were fixed tomorrow, which is what makes it the stronger argument.

**What is explicitly not concluded:** nothing about Max's hardware beyond what was relayed. The TPM
presence is unverified, the dTPM/fTPM question is open and materially changes §7, and both need someone
at the keyboard on that machine.

---

## 10. Pointers

- [`2026-08-18-hsm-container-isolation-a-shared-connector-is-not-a-boundary-and-what-prove-ish-can-honestly-mean.md`](2026-08-18-hsm-container-isolation-a-shared-connector-is-not-a-boundary-and-what-prove-ish-can-honestly-mean.md) — the document this one is the delta against (#12178)
- `docs/research/2026-08-14-code-bound-key-access-preliminary-integration-agent-to-agent-isolation-on-one-machine.md` — the L1/L2/L3 ladder; §6 above establishes that **L3 is unreachable per-container on a shared TPM**, which is stronger than that note's cost objection
- `tools/setup/persona-keys/tpm2-linux-probe.ts` — the five-way `Tpm2State`; **the probe to use**, not to replace. Its `unavailable` vs `absent` distinction is what makes a heterogeneous fleet auditable
- `tools/setup/persona-keys/frost-hardware-probe.ts` — `probeTpm2` and the "a driver is not a device" discipline *(other agents own this path; referenced, not modified)*
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the register an obfuscation layer belongs in (`unmetered`), and why asserting it as a control is the vacuity class (§3a)
- `.claude/rules/numerology-vs-number-theory.md` — why X5 is vacuous
- `.claude/rules/manifesto-13-specifications.md` §1 / §3 — the owner-auth weight, unchanged from #12178

**External sources.**
Linux kernel source, read directly: `drivers/char/tpm/tpm2-space.c` (`tpm2_map_response_body`,
`tpm2_map_to_vhandle`, `tpm2_prepare_space` / `tpm2_save_space`) and `include/linux/tpm.h`
(`struct tpm_space` — `context_tbl[3]`, `session_tbl[3]`)
`https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/drivers/char/tpm/tpm2-space.c` ·
In-kernel resource manager / TPM spaces `https://lwn.net/Articles/716259/` ·
`tpm2_getcap` (`handles-persistent`, `handles-nv-index`)
`https://github.com/tpm2-software/tpm2-tools/blob/master/man/tpm2_getcap.1.md` ·
ROCA / CVE-2017-15361, Infineon TPM firmware update + mandatory key regeneration
`https://nvd.nist.gov/vuln/detail/CVE-2017-15361` ·
Microsoft, *TPM fundamentals* (anti-hammering; global lockout; 32 failures / 10 minutes)
`https://learn.microsoft.com/en-us/windows/security/hardware-security/tpm/tpm-fundamentals` ·
systemd #20668 (DA lockout after 3 power cycles; `TPMA_OBJECT_NODA` fix)
`https://github.com/systemd/systemd/issues/20668` ·
TCG, *TPM 2.0 Provisioning Guidance v1.0*
`https://trustedcomputinggroup.org/wp-content/uploads/TCG-TPM-v2.0-Provisioning-Guidance-Published-v1r1.pdf` ·
`tpm2_dictionarylockout` man page `https://github.com/tpm2-software/tpm2-tools/blob/master/man/tpm2_dictionarylockout.1.md` ·
QEMU TPM device / swtpm `https://qemu-project.gitlab.io/qemu/specs/tpm.html` ·
EVE-OS vTPM (per-VM swtpm; hardware-AIK-signed vTPM EK) `https://eve-os.readthedocs.io/docs/VTPM/` ·
OpenStack Nova emulated TPM `https://docs.openstack.org/nova/latest/admin/emulated-tpm.html` ·
TPM bus sniffing `https://pulsesecurity.co.nz/articles/TPM-sniffing` ·
Jacob Ehnert et al., *faulTPM: Exposing AMD fTPMs' Deepest Secrets*, arXiv:2304.14717
`https://arxiv.org/abs/2304.14717` ·
Arch Wiki, *Trusted Platform Module* `https://wiki.archlinux.org/title/Trusted_Platform_Module`

**Anchors (Beacon).** Saltzer & Schroeder, *The Protection of Information in Computer Systems*
(Proc. IEEE 63(9), 1975) — **complete mediation** and **least privilege**. Both devices fail a different
clause: the HSM's connector mediates everything and checks nothing; the TPM's device node checks once
and then grants everything, which is the least-privilege failure. Wulf et al., **HYDRA** (CACM 1974) —
a capability names an object *and* the rights over it; the YubiHSM's domain+capability pair is such a
construction and the TPM has no analogue, which is §0 restated in the older vocabulary.
