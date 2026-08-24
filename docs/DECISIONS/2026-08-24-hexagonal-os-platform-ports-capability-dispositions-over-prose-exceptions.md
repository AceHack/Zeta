# Decision: the OS is HEXAGONAL too — capability dispositions replace the prose exception map

**Date:** 2026-08-24 · **Driver:** Aaron · **Status:** proposed (direction) · **Class:** platform · **Trajectory:** cross-os-parity · **Work-item:** 081M0T694EG087G0R002SJST5K

## Carved sentence (Aaron 2026-08-24)

> _"for these discrapancies we are trying to close over the operating system so we need a
> hexagonal port interface from us that abstracts the different os/platforms behind one zeta
> interface that is connoncal and safe for human ai interaction without coreorsion either way."_

This is the **second instance** of
[`2026-06-21-hexagonal-pki-and-secret-vault-ports-swappable-adapters.md`](2026-06-21-hexagonal-pki-and-secret-vault-ports-swappable-adapters.md),
not a competing pattern. Same vocabulary (**port** = stable interface, **adapter** = swappable
implementation, **the port contract IS the best practice**), same endgame clause (the final
adapter behind every port is Zeta's own substrate), same rule basis
([`interfaces-free-classes-earned-under-rules.md`](../../.claude/rules/interfaces-free-classes-earned-under-rules.md):
the port is the free interface, each adapter is earned). It reuses cleanly and no exemption is
needed. One thing the PKI decision does not supply is added here and named as new: **a way to
say a capability is ABSENT on a platform** — see §5.

## Carved sentence — unknown include (Aaron 2026-08-24)

> _"it's always better to fail on unknown dependency from code than missi a dpenedncy, either can
> be fixed but only on makes forward movement guarenteed"_
>
> _"unknown include is bettern than unknow exclude"_
>
> _"only cause we have immune system standardize math, without this you'd have to be scared of
> the includes"_

POSIX's default is the other cut: undefined means `-1`, silence means absent — **unknown
exclude**. A missed dependency never appears, so nothing forces the next fact. Zeta inverts it:
an unclassified name stays **in** the check set as a `Gap` until someone writes a disposition.
Extra includes are cheap here because the factory already has an immune system of standardized
math ([`docs/VISION.md`](../VISION.md) — verification stack, algebraic laws, retraction). Without
that stack, includes would be an attack surface and the safe default would be fear. With it, the
unrecoverable direction is the miss.

## 1. The trigger, measured

`src/Core.TypeScript/ci/manifest-symmetry.test.ts` asserts that every tool in `manifests/apt`
or `manifests/brew` appears in `manifests/windows` **or** in `WINDOWS_EXCEPTIONS`, a
hand-written `Record<string, string>` of English sentences. `pam-reattach` — the macOS PAM
module that lets Touch ID reach the sensor from tmux, used by `tools/setup/touchid-sudo.ts` —
landed in `manifests/brew` in `a2a159542` with no Windows disposition.

Reproduced rather than reported (`bun test`, exit status captured directly, no pipe):

| commit                                      | result                                                       |
| ------------------------------------------- | ------------------------------------------------------------ |
| `c40afcb81`                                 | `TEST_RC=1` — `11 pass 1 fail`, `undealt = ["pam-reattach"]` |
| `8a8d011de` (`main` tip at time of writing) | `TEST_RC=1` — still red                                      |

So this is not a historical anecdote: **`main` is red for every PR in the repo until an English
sentence is added.** PR #14807 is open and adds exactly that — one file, nine lines, no code.
It should land as the unblock; this decision changes the mechanism that made it necessary.

## 2. The sprawl, measured and categorised

Four patterns (`process.platform`, `RuntimeInformation.IsOSPlatform`, `OSPlatform.`, `isMacOS`)
over the tree excluding `references/prior-art/`:

- **42 files** total, **32** of them code, **55 occurrences**.
- Restricted to `src/` + `tools/`: **29 files** — this reproduces the count in the brief exactly.
- Of the 55 occurrences, **2 are doc comments**, so **53 are real reads**.

The four patterns **under-report**. Two idioms they miss:

- `os.platform()` via `node:os` — **8 further sites**, including `tools/setup/persona-keys/biometric.ts`,
  which is the consent gate itself.
- `uname` in shell — **16 occurrences across 10 `.sh` files** under `tools/`.

**True surface: 77 branch sites.** A port that only covers TypeScript covers two-thirds of it.

### 2.1 The categories (hand-assigned per site, counted mechanically)

| category            | sites | files | what it is                                                                                           |
| ------------------- | ----- | ----- | ---------------------------------------------------------------------------------------------------- |
| **TestGate**        | 20    | 12    | a test skips or narrows itself on the real host                                                      |
| **MechanismSwap**   | 9     | 4     | same capability, different OS mechanism (launchd/systemd, Keychain, accessibility API, memory probe) |
| **ExecConvention**  | 8     | 6     | classpath separator, interpreter name (`powershell` vs `pwsh`), argv shape                           |
| **PackageIdentity** | 7     | 3     | which package/channel provides a tool here                                                           |
| **HostFacts**       | 6     | 5     | "which OS am I", nothing more                                                                        |
| **HardRequirement** | 3     | 3     | "this program only runs on X", front door                                                            |
| **DocComment**      | 2     | 2     | prose mentioning the idiom                                                                           |

### 2.2 The hypothesis in the brief, tested

The brief proposed (a) package names, (b) genuine capability absences like PAM-vs-UAC,
(c) path/filesystem conventions, (d) privilege elevation. Measured:

- **(a) holds, and is small** — `PackageIdentity`, 7 sites (13%).
- **(b) does not hold** — see §3. Zero of the 36 platform asymmetries in the manifest surface
  is a capability Windows genuinely lacks, `pam-reattach` included.
- **(c) does not hold** — `path.sep` and filesystem-path-convention branches measure **zero**
  in `src/` and `tools/`. What looks like it (`ExecConvention`) is a _Java classpath separator_
  and an _interpreter name_, not a filesystem convention. `workspace-port.ts` already fixed the
  path question by making forward slashes the only representation. **Do not build a path port —
  there is no demand for one.**
- **(d) holds, inverted, and is the proof of the thesis** — privilege elevation contributes
  **zero** branch sites, because `src/Core.TypeScript/privilege/elevator.ts` **already is a port**:
  it takes `ElevatorEffects { platform: () => string; stat: … }` as an injected door and
  `elevatorCandidates(name, plat)` receives the platform as a parameter. The one category that
  has a port has no sprawl. That correlation is the strongest available evidence for the
  direction, and it was already true before this decision was written.
- **The largest category is in nobody's hypothesis.** `TestGate` is 20 of 53 real sites (38%)
  and it must **not** be ported — see §9.

### 2.3 Is `when.ts` already a partial port?

Partially, and the shape of what it is missing is the design.
`src/Core.TypeScript/ace/setup-realizers/when.ts` implements `when=` clauses
(`linux`, `darwin`, `ubuntu-22.04`, `amd64`, `arm64`) used by `manifests/from-deb`,
`from-shim`, and `from-autotools-tarball`. It is a **predicate** layer: it answers _does this
row apply here?_ It is genuinely useful and should be kept.

What it cannot express:

- It is **closed-world over a hardcoded `switch`** — an unrecognised clause warns and returns
  `false`, so an unknown platform is a silent **non-match** rather than an **unknown**. A third
  adapter is invisible under `when=`, not unsupported.
- It has **no vocabulary for absence**. `false` means "not this host", never "this cannot exist
  here", and nothing consumes the difference.
- `manifests/apt`, `brew` and `windows` are **separate files per OS**, so no single row can
  carry a per-platform disposition at all. That file split is the structural reason the
  symmetry test needs a side-map in the first place.

## 3. What the 35 exceptions actually say

Classifying each entry by the claim its sentence makes (48 Unix tools; 13 have a literal
Windows twin; **7134 bytes of prose**):

| what the sentence really asserts                                                                         | entries | modelled as                                   |
| -------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------- |
| Windows ships it (curl, ICU, Schannel, SSPI, tzdata, SCardSvr, WinSCard, tar+zstd, cert store)           | 10      | `builtin { component }`                       |
| same tool, different package name (`lua5.4`/`lua`, `r-base`/`r`, `qemu-*`, `ykman`)                      | 7       | `provided { by, channel }`                    |
| nobody has decided yet (hermes-agent, mtools, z3, cvc5, eprover, agda, wabt, binaryen, emscripten, llvm) | 10      | `undetermined { owner, workitem, settledBy }` |
| present, but inside the WSL2 nested host (uidmap, slirp4netns, fuse-overlayfs)                           | 3       | `provided { channel: "nested-host" }`         |
| installed by a non-system channel (mise, prebuilt, MSI)                                                  | 3       | `provided { channel }`                        |
| not a platform question at all — `headscale-cli` is **role**-scoped (servers vs clients)                 | 1       | leaves the platform model                     |
| **dead** — `tailscale` is in `manifests/windows` **and** in the map, so its reason can never be read     | 1       | —                                             |
| **the capability genuinely does not exist on Windows**                                                   | **0**   | —                                             |

Two consequences.

**First: 25 of 35 (71%) are facts a data model can carry.** They are prose only because there is
no field to put them in. The map says so about itself: the alias entries are "recorded rather
than resolved because this matcher compares names literally and has no alias table".

**Second: there are no genuine absences here, including the trigger.** `pam-reattach` is not a
capability. It is an _implementation dependency of the macOS adapter_ for the capability
"a present human approves a privileged operation". Windows has that capability (Hello + UAC);
`biometric.ts` already names it. Under a capability-keyed model the row is
`elevation-consent`, `pam-reattach` never appears at the symmetry layer, and **the failure does
not occur** — it is not handled more gracefully, it stops being a question. That is the test of
whether this design is right, and it is why the fix is not "add an alias table".

### 3.1 The check is one-directional, and that is measurable

Nothing requires a Windows tool to have a Unix disposition. Measured: `yubikey-manager-cli` is
in `manifests/windows` with no Unix counterpart and no exception, and the test is silent. The
symmetry relation is hand-written in one direction; the reverse direction is unguarded.

## 4. The ports

Not one interface. A god-`IPlatform` over all of §2.1 would be worse than the status quo,
because it would drag `TestGate` (38% of sites, which must keep reading the real host) behind an
abstraction whose whole job is to hide the real host.

| Port / value                                                                  | Contract (the "best practices")                                                                              | Adapters (swappable)                                                                | Category it retires     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------- |
| **`HostOs`** _(a value, not a port)_                                          | open world: an OS we have no opinion about is `other(id)`, never a narrowed cast; one declared read door     | —                                                                                   | HostFacts (6)           |
| **`CapabilityRegistry`** _(declared data, not executable)_                    | every declared capability answers for every declared OS; a missing cell is a **gap**, never a silent absence | —                                                                                   | the 35 prose exceptions |
| **`ProvisionPort`** — make capability C available                             | idempotent; pinned + hash-checked where the channel allows; never a command string composed at runtime       | apt · brew · scoop/winget · mise · pinned-artifact · vendor installer · nested host | PackageIdentity (7)     |
| **`ConsentPort`** — a present human approves one privileged operation         | fail-closed; one approval per run; approval is never transferable and never manufactured                     | Touch ID (`pam_tid` + `pam_reattach`) · Windows Hello · fprintd/polkit              | Elevation (already 0)   |
| **`SupervisorPort`** — start at boot, restart on failure, report last outcome | reports **facts**, never a verdict; "no adapter here" is a distinct fact from "unit not found"               | launchd · systemd · Windows Service/Task Scheduler                                  | MechanismSwap (1 of 9)  |
| **`SecretStorePort`** — the PKI decision's port, made explicit                | encrypted at rest; never echoed; revocable                                                                   | macOS Keychain · Windows Credential Manager · libsecret · 1Password                 | MechanismSwap (3 of 9)  |
| **`ExecConventionPort`** — separators, interpreter names, argv shape          | pure function of `HostOs`; no I/O                                                                            | per-OS conventions                                                                  | ExecConvention (8)      |

`ScreenObservationPort` (shadow-observer's accessibility reads, 3 sites) is **named and not
proposed** — it has one adapter, no second consumer, and porting a single implementation is
speculative generality.

### 4.1 A conformance finding against the FIRST decision, filed here

The PKI decision lists **SecretStore** as a port with swappable adapters. At the call site it is
not one: `src/Core.TypeScript/secrets/credential.ts` imports `readGenericPassword` from
`./keychain-macos.ts` directly, so `withCredential` is bound to the macOS adapter, and on any
other OS the absence surfaces as the string `"not macOS"` in a refusal. Same shape as the FROST
conformance note already recorded in that decision (`loadShare` contradicting its own row).
Recording it here rather than editing that decision; the fix is the same one this decision
proposes.

## 5. `Unsupported` is a value, and it is Zeta's addition to the pattern

Cockburn's stated intent covers driving an application from users, programs, or tests, and
plugging in "any device that adheres to the protocols of a port". Checked against the source: it
**does not** address representing an absent capability. So this arm is not claimed as his.

The shape POSIX already standardises is the right one. IEEE Std 1003.1-2024 §2.1.6 advertises an
option as:

- **`-1`** — "the option is not supported for compilation and, at the time of compilation, is not
  supported for runtime use"
- **`0`** — "supported for compilation and might or might not be supported at runtime"
- **`> 0`** — "supported both for compilation and for use at runtime"

Zeta takes the tri-state and **rejects one thing POSIX does**: POSIX says leaving the constant
undefined "has the same meaning as defining it as -1" — silence means absent. Silence is exactly
what a symmetry check exists to refuse. So:

```ts
type Disposition =
  | { kind: "provided"; by: string; channel: Channel } // POSIX  > 0
  | { kind: "builtin"; component: string } // POSIX  > 0, nothing to install
  | { kind: "probe"; probe: string } // POSIX  = 0
  | { kind: "unsupported"; absence: Absence } // POSIX  = -1
  | { kind: "undetermined"; owner: string; workitem: string; settledBy: string };
```

and a **missing cell is not a value at all** — it is a `Gap` the checker reports. Four arms are
green; the fifth is owned debt; silence fails. There is deliberately **no arm meaning "I could
not check, here is a sentence"**, because that arm is what `WINDOWS_EXCEPTIONS` is made of.

`Absence` carries exactly one variant (`no-mechanism { mechanism }`) because the corpus contains
one absence shape. A taxonomy with more arms than the data has shapes is the prose map wearing a
type. New variants are earned by a measured instance.

**Honest state of the `unsupported` arm: currently unpopulated by the manifest data** (§3 found
zero). It exists so the type is total and so an author is never forced to invent a presence. It
_is_ populated outside the manifests — see §11.

## 6. "Without coercion either way", operationally

This is the requirement most likely to be dropped, so it is stated as four properties with
falsifiers rather than as a sentiment.

**N1 — every disposition must be assertable without lying.** For every (capability, OS) cell
there must exist at least one value the author can state truthfully with the evidence they
actually have — including `unsupported`, `probe`, and `undetermined`. If the only green value
requires a claim the author cannot check, the check coerces.
_This has already failed once, in-repo, and the map records it against itself_: three YubiKey
entries asserted that no Windows package id "was verifiable from the host this was authored on";
when the check was later run, "all three resolve" in Scoop and winget. The check asked for
something unverifiable and got a plausible sentence. That is the measured falsifier, not a
worry.

**N2 — the port's vocabulary names capabilities, never one OS's mechanism.** A Windows operator
must not have to learn "PAM" to read their own row; a macOS operator must not have to learn
"UAC" to read theirs. Adapters name mechanisms — that is their job. _Falsifier shipped_:
`mechanismNounIn()` refuses a capability named after a mechanism, and it rejects the trigger's
own key: `mechanismNounIn("pam-reattach") === "pam"`.

**N3 — silence fails, but the cheapest path to green is a fact.** Today the cheapest green path
is an essay, which is why there are 7134 bytes of them. Under the model the failure names the
exact cell and the five values it accepts, so writing the fact is less work than writing the
excuse. Honest debt costs an **owner and a work-item ZetaId**, not a paragraph — priced, not
free, and not open-ended.

**N3.1 — unknown include is better than unknown exclude.** An undeclared cell is a `Gap`
(included in the failure set), never a quiet `unsupported` (excluded from the world). Code that
names a tool is the include; a missing Windows sentence is the exclude. Both mistakes can be
fixed. Only the include-default guarantees the next green is a fact, and that default is safe
**because** the immune system (tests, algebraic laws, formal verification, retraction) can
reject extras. `when.ts` still does the POSIX cut — unknown clause → `return false` — and that
is named remaining unknown-exclude, not a second opinion.

**N3.2 — PowerBuilder is the degenerate case (Aaron 2026-08-24).**

> _"powerbuildr is the degenerate case of this where eariler sliently override later or vice
> versa without disclosure"_

Visual inheritance (ancestor vs descendant event scripts, Override vs Extend) lets one
declaration drop the other without the reader seeing which script ran. That is unknown-exclude
**in time**: earlier or later vanishes, and nothing forces a fact. Last-wins is legal in this
repo only when the discarded side is named (AgencySignature last-wins; Action-Mode takes `min()`,
precisely so a later human-directed commit cannot launder earlier autonomy). A second registry
row for the same capability is a disclosed collision (`silentOverrides`), never a `Map` overwrite.
The in-repo cousin is `.mise.full.toml` silently disarming the base rust pin
([research 2026-08-20](../research/2026-08-20-the-surface-declaration-format-one-more-qualifier-not-a-new-grammar.md)
§7).

**N4 — asymmetry is a complete answer, not a deviation.** A capability present on one OS and
absent on another is a _closed_ row. The current design cannot express this: the word
_exception_ frames a true platform difference as something requiring apology, and every such row
stays outstanding forever. This is the "either way" half — the check coerces the macOS author
(who must write about Windows to unblock CI) as much as the Windows operator (who must read
Debian package names to understand their own machine).

### 6.1 Elevation, where the coercion question is sharpest

`.claude/rules/` and the standing operator position require that privileged operations be
committed, tested, reviewable code, and that **biometric approval is the human's authorization
gate** — _nothing operator-run, only operator-approved via biometric_. The `ConsentPort`
preserves that structurally:

- The port exposes **`requestApproval(prompt) -> Decision`**. It does **not** expose
  `runAsRoot(cmd)` with an approval folded in. An adapter can therefore never report that it
  elevated without an approval, because elevating is not one of its verbs.
- **The far side may NAME an operation, never DEFINE one.** This is the closed-command-set
  property from [`itron-hub-patent-boundary-p2p-is-the-upgrade.md`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md),
  which is already the repo's standing rule and transfers here unchanged: the port's operations
  are committed, named programs, never a command string an agent composes at runtime.
- **On an `unsupported` or `undetermined` cell the port returns exactly that, and the caller must
  refuse.** It must never degrade to a password prompt or to an unattested `status === 0`. The
  existing `detectBiometricPlatform` already fails closed this way, and `elevator.ts` already
  records the limit out loud: "`status === 0` from a child process is not proof that a human was
  present". The port inherits that sentence; it does not soften it.
- The port **does not** widen `elevator.ts`'s allowlist, change its structural checks, or add a
  platform to it. Those are its decisions to keep.

## 7. What happens to `manifest-symmetry.test.ts`

Yes — it consumes the port instead of the prose map. Concretely, in three steps that can land
independently:

1. **Today (unchanged).** `WINDOWS_EXCEPTIONS` stays. PR #14807 lands as the unblock. Nothing in
   this decision touches that test yet.
2. **The registry becomes the source of truth for the _modelled_ entries.** The test's failure
   set becomes `symmetryGaps(registry)` instead of a set-difference against a `Record<string,
string>`. Each exception entry migrates to a row as its disposition is _established_, never in
   bulk: the assertion becomes `undealt = tools_without_a_registry_row`, and that list shrinks
   monotonically as rows land. Both mechanisms coexist during the migration and the test is red
   only if a tool is in **neither**.
3. **The manifests become a projection.** `manifests/{apt,brew,windows}` are generated from the
   registry's `provided { channel: "system-package" }` cells rather than hand-maintained, at
   which point the symmetry property is true **by construction** and the test degrades to a
   generator-freshness check. The one-directional gap in §3.1 disappears with it, because a
   projection is symmetric in a way a hand-written map is not.

Step 3 is the only one that removes the test; steps 1 and 2 keep it and change what it reads.

## 8. Migration path (no big-bang; 53 sites are not converted)

1. **Land the types.** `src/Core.TypeScript/platform/{host-os,disposition}.ts` — shipped with
   this decision, 8 tests, mutation-checked (§10). Nothing imports them yet, so nothing breaks.
2. **`HostFacts` first, because it is pure deletion.** The 6 HostFacts sites become one call.
   Fix `workspace-port.ts:125`'s unchecked `process.platform as Platform` cast on the way past.
3. **Registry rows land when a capability is TOUCHED, never in a sweep.** Adding a brew package
   that has a Windows question writes a row; the other 34 stay prose until someone has a reason
   to open them. Debt is priced where it is incurred.
4. **The four behavioural ports land one at a time, each behind its existing seam.** `ConsentPort`
   is nearly free (`biometric.ts` + `elevator.ts` already have the shape). `SupervisorPort` is
   next because it has a live defect (§11). `SecretStorePort` follows the PKI decision's own
   plan. `ExecConventionPort` is last and is the least valuable.
5. **`uname` in shell joins via the same registry**, read as data. It is 16 of the 77 sites and
   will otherwise drift out of the model silently.

Ordering rule: a site converts when someone is already editing it. A conversion sweep would be a
large diff with no falsifier attached, which is the shape of change this repo refuses.

## 9. What is NOT proposed

- **Not a god `IPlatform`.** Seven ports and one value, split along measured category boundaries.
- **Not converting the 53 sites.** This is a design plus a type module; the sites are untouched.
- **Not porting `TestGate` (20 sites, 38%).** A test asserting against the real host should read
  the real host — putting a port there hides exactly what the test exists to observe. That
  category has a separate and real problem (a skip that reads as a pass) which belongs to the
  assert-don't-skip discipline, not to this port.
- **Not a path/filesystem-convention port.** Demand measured zero (§2.2c).
- **Not runtime feature detection instead of a declared table.** Autoconf's doctrine — "test for
  the presence of each feature" rather than for system identity — is right about _what to ask_
  and cannot answer _this_ question: a CI job on Linux cannot probe Windows. Detection is the
  `probe` arm, not the model.
- **Not touching PR #14807**, or the open `WINDOWS_EXCEPTIONS` entries, in this change.
- **Not changing `elevator.ts` or the biometric gate's semantics** (§6.1).
- **Not making `ace` a resolver.** The registry is a checked-in TypeScript module read by `bun`
  with no package manager present, per
  [`clone-at-tag-stays-sufficient.md`](../../.claude/rules/clone-at-tag-stays-sufficient.md).
  A `git clone` at a tag can evaluate the model and run the check; that property is a constraint
  on this design, not a consequence of it.
- **Not a `ScreenObservationPort`** yet (§4).

## 10. Claim register

Per [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md):

| claim                                                                                                 | register                             | evidence                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a missing or unowned cell fails loudly; `unsupported` passes; a mechanism-named capability is refused | **metered**                          | `src/Core.TypeScript/platform/disposition.test.ts`, 8 tests. Mutation control run: stubbing `symmetryGaps` to return `[]` turns **2 tests red** (`6 pass 2 fail`), restored `8 pass 0 fail`. The falsifier is not vacuous. |
| the measured counts in §2 and §3                                                                      | **metered**                          | reproduced from `origin/main` at `8a8d011de`; the per-site classification is hand-assigned and the counting is scripted                                                                                                    |
| "this reduces the 53 branch sites"                                                                    | **toy**                              | nothing is converted. No falsifier exists until step 2 of §8 lands.                                                                                                                                                        |
| "the port makes a Zeta-native adapter a column rather than a rewrite"                                 | **toy**                              | `zeta` is in `KnownOs` and deliberately out of `DECLARED_OSES`; nothing implements it, so nothing tests it                                                                                                                 |
| "this is safe for human-AI interaction without coercion"                                              | **unmetered**, with one metered part | N2 has a shipped lint; N1 has a _historical_ falsifier (the YubiKey entries) but no standing check; N3 and N4 are asserted properties of the shape with no falsifier yet                                                   |

## 11. Findings this analysis produced (filed here, fixed elsewhere)

1. **`loop-liveness.ts` reports a live Windows loop as `not-installed`.** `gather()` is
   `platform === "darwin" ? gatherLaunchd : gatherSystemd`, so Windows gets `systemctl`, which is
   absent, which yields `unitFound: false`, which `classify()` renders as verdict
   `"not-installed"`. `type Supervisor = "launchd" | "systemd"` has no arm for "no adapter here".
   Its own docstring says the classification "stays one total function over both" — and it is
   total over the union it declares, which is not total over the platforms it runs on. **This is
   a check that did not run, wearing the face of a check that failed** — the exact class the
   `unsupported` arm exists to prevent. This is the one genuinely populated `unsupported`/
   `undetermined` instance found outside the manifests.
2. **Absence is expressed at every absence site, in six mutually-incompatible encodings**:
   `return null` (`install-pinned-smt.ts:57`, `shadow-observer` ×3), `return false` (`when.ts`),
   `{ ok: false, reason: "not macOS" }` (`keychain-macos.ts` ×3), `console.warn` + skip
   (`from-ollama.ts:47`), `bail(2, …)` (`flash-usb-windows.ts` ×2), and prose in a `Record`
   (`WINDOWS_EXCEPTIONS` ×35). Exactly **one** is modelled:
   `BiometricPlatform = "macos-touchid" | "windows-hello" | "unsupported"` in `biometric.ts`.
   This design is that one shape, generalised — it is not invented here.
3. **`hostKey()` in `install-pinned-smt.ts` returns `null` for two different facts** — wrong OS,
   and right OS with an unsupported arch — so a caller cannot tell them apart.
4. **One dead exception**: `tailscale` is in `manifests/windows` and in `WINDOWS_EXCEPTIONS`; the
   test checks the manifest first, so its 107-character reason is unreachable. A prose allowlist
   cannot tell you when it has gone stale.
5. **One misfiled exception**: `headscale-cli`'s reason is a _role_ distinction (servers vs
   clients), not a platform one. `tier=` already models host roles; the row is in the wrong system.

## 12. Anchors (checked, not merely cited)

- **Cockburn, _Hexagonal Architecture_ (ports & adapters, 2005).** Fetched and checked. Entails
  the port/adapter/swap/test-in-isolation shape used throughout. **Does not** entail the
  `unsupported` representation — stated as a limit in §5 rather than borrowed.
- **IEEE Std 1003.1-2024 (POSIX.1) §2.1.6.** Fetched and checked; the `-1` / `0` / `> 0`
  tri-state is quoted in §5, including the "undefined means -1" clause that Zeta deliberately
  inverts.
- **GNU Autoconf manual, Introduction:** configure scripts "individually test for the presence of
  each feature that the software package they are for might need". Fetched and checked. Entails
  _ask for the capability, not the OS name_; its limit (it probes the host it runs on) is why a
  declared table is needed and is stated in §9.
- **Parnas (1972), _On the Criteria To Be Used in Decomposing Systems Into Modules_** — hide the
  design decision most likely to change; "which OS" is the canonical instance.
- **Hoare, _Null References: The Billion Dollar Mistake_ (QCon London 2009)** — absence belongs
  in the type, not in a sentinel or a comment.
- In-repo: [`interfaces-free-classes-earned-under-rules.md`](../../.claude/rules/interfaces-free-classes-earned-under-rules.md)
  (ports are interfaces and free; adapters are earned — every module shipped here is interfaces
  and pure functions, zero classes, zero instance state),
  [`dv2-data-split-discipline-activated.md`](../../.claude/rules/dv2-data-split-discipline-activated.md)
  (§5 DV2.0: the capability name is the hub, the per-OS disposition is the satellite — they
  change at different rates, which is precisely why they are in different files today and why
  keying on the _package_ rather than the _capability_ was the original error; §7 noninterference:
  one declared read door for the host),
  [`itron-hub-patent-boundary-p2p-is-the-upgrade.md`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md)
  (the closed command set, §6.1),
  [`clone-at-tag-stays-sufficient.md`](../../.claude/rules/clone-at-tag-stays-sufficient.md) (§9).

## 13. The endgame adapter, same clause as the first decision

The PKI decision's reason for existing was that "the final adapter behind every port is Zeta's
own DB/substrate". The same clause applies here, and it is Aaron's stated long arc: rewriting
dependencies including the OS, _the ultimate supply chain control_, with hexagonal ports as the
interim step. `KnownOs` already carries `"zeta"` — it was already in `workspace-port.ts`'s
`Platform` union before this decision — and `DECLARED_OSES` deliberately omits it, so no author
is compelled to answer for a substrate nobody can build against yet. When it exists, a
Zeta-native adapter is **one more column**: the checker names every capability that has not yet
answered for it, one cell at a time, with an owner on each. That is the whole reason to prefer a
model over a map.
