# The AI↔human secure-handoff protocol

> Aaron, 2026-08-26: *"many times i have to redesign over and over secure AI / human
> interactions. if this could be taught and reused over and over it would be great
> productivity enhancement to both sides."*

This is the protocol for the moment an agent cannot proceed alone — a privileged act that
needs a person. It was **extracted from a working instance**, not designed in the abstract,
and the parts that turned out to be artifacts of that instance are labelled as such.

**REGISTER: `unmetered`.** The invariants below are implemented and falsified; that
consumers of them produce handoffs a human understands better, or that the next privileged
operation is measurably cheaper to build, is **not measured**. See
[Falsifying the productivity claim](#9-falsifying-the-productivity-claim) for what would have
to be true for that to become `metered`.

---

## 0. If you read nothing else

You are about to build a privileged operation. Do this:

```ts
import { runGatedCeremony } from "tools/setup/persona-keys/ceremony-handoff.ts";
```

One call performs the whole protocol in the right order, and **the order is the function
body, not your responsibility**. Everything below explains why each step is there and what
it does not deliver. §7 is the end-to-end walkthrough for a new operation.

---

## 1. Where this sits

Four surfaces answering four different questions — but you normally touch **one**.

| Question | Surface |
|---|---|
| Does this operation need a human at all? | `src/Core.TypeScript/federated-identity/ceremony-gate.ts` |
| What is the human told? | `tools/setup/persona-keys/ceremony-brief.ts` |
| **What must be true before and after the moment of approval?** | **`tools/setup/persona-keys/ceremony-handoff.ts`** ← this doc |
| How is approval actually established? | `tools/setup/persona-keys/biometric.ts` |

The first two and the last already existed. The third is what was being re-derived from
scratch, correctly, every time — which is what this doc and that module exist to stop.

**`runGatedCeremony` composes all four.** That composition is not a convenience wrapper; it
is what turns invariant 2 from prose into a guarantee. An ordering that lives in a doc is a
call-site obligation you can get wrong. An ordering that lives in a function body is not.

`ceremony-gate.ts` holds a **closed set** of operations. Nothing here extends it, and
nothing should: a peer may *name* an operation and can never *define* one, so compromising
the far side does not buy arbitrary execution
(`.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`). A new capability must go
and be classified there — with a written reason — before it can be handed off at all. That
friction is the design.

---

## 2. The one-paragraph version

> The agent stages everything reversible and measures the ground truth. It resolves every
> credential from a store, never holding one itself. It then builds the **complete** act —
> nothing left to ask for — and shows the human that act with the secrets redacted. The
> human authenticates, *then* approves. The agent performs the act and measures the state
> again, so what it reports afterwards is a reading. Everywhere it stops, it says what to do
> next.

Everything below is that paragraph with its reasons and its limits.

---

## 3. The invariants

Each states what it forbids, what enforces it, and — this is the part that keeps it
honest — **what it does not deliver**.

### 3.1 The agent never holds the secret

Resolve it from a store at use time. Never from agent context, never from a literal, never
from a value that has been through a transcript.

*Mechanism:* `Secret` wraps the value so `toString`, `toJSON` and `util.inspect` all render
`<redacted>`. The realistic leak is not an agent deciding to print a password — it is a
template literal in a log line, or a `JSON.stringify` of an options object landing in a
crash report. Those all go through the guarded paths. `reveal()` is the one deliberate exit
and is greppable on purpose.

*What it does not deliver:* this is **hygiene, not a security boundary**. The value is in
process memory and anything with code execution can read it. It stops accidents — which is
what the incident history is made of — and it stops no attacker. `HandoffPlan.argv` must be
a plain `string[]` for `spawn` to accept it, so that one field is guarded by prose.

*Vacuous when* the act has no credential to resolve — a signing operation whose key never
leaves the HSM. The invariant is then satisfied trivially and proves nothing.

### 3.2 Approval follows authentication — never precedes it

**Authentication and approval are two separate human acts and the order is load-bearing.**

If a program will still ask for a credential *after* the human approves, the sequence is:

```
brief shown → human approves → program starts → program asks for a password
```

The human approved a sentence. What ran was that sentence plus a credential they had not
yet supplied, behind a prompt they cannot distinguish from any other. **That approval was
unevaluable**, which is the exact thing `ceremony-brief.ts` already refuses to raise.

*Mechanism:* `assertFullySpecified` (any act shape) and `specifySubprocessPlan` (subprocess
acts) refuse a knowably-absent credential rather than letting it flow onward.

*What it does not deliver:* **it cannot prove no prompt appears.** `gpg`, `ssh-keygen`,
`op` and `yubihsm-shell` all prompt on a tty regardless of what you pass them, and a
library may read a config file the module was never shown. The actionable form of this
invariant is therefore a design preference, not a guarantee:

> **Prefer a program that FAILS when a credential is missing over one that PROMPTS.**

Run ceremonies with stdin closed where the program honours it.

### 3.3 The approved act is fully specified before approval

What the human reads must be **derived from** the object the act consumes, never authored
beside it. Two independent derivations of "which thing" will disagree, and then the operator
approves a sentence describing a different act. That is not hypothetical: it is the defect
`ceremony-brief.ts` was written to fix, where the rotation prompt named the ports
*requested* while the dispatcher swapped the ports *performed*.

*Mechanism (subprocess acts):* `argv` and `displayArgv` are two projections of **one array**
in one pass. Secrets are **replaced, not omitted**, so the reader can see there is a
credential and exactly where it goes.

*Mechanism (everything else):* `ceremony-brief.ts`'s `CeremonySubject {label, value}` list,
which predates this module.

> ⚠️ **`specifySubprocessPlan` is subprocess-shaped, and that is a real limit.** Two of the
> three ceremonies this repo already implements are not subprocess invocations —
> `publish.ts` posts a JSON body, `revoke.ts` calls an injected effect — and both correctly
> use `CeremonySubject` instead. Do not contort a non-subprocess act into an argv to use
> this helper; use `assertFullySpecified` for the ordering and `CeremonyBrief` for the
> display. Building a second general consent surface would fork the thing the human reads,
> which is the drift this invariant exists to prevent.

### 3.4 Every refusal names its remedy

> **A refusal that names its remedy is a guard. One that does not is a dead end.**

This is the invariant the working instance was missing, and it is the reason this is code
rather than advice. See §4 for the evidence.

A refusal has four parts: a greppable `code`, `what` was refused, `why`, and a **non-empty
`remedy`** of concrete steps — a command to paste, a file to edit, or a person to ask. The
remedy renders **last**, so it is what is still on screen after a stack trace scrolls past.

*Mechanism:* `refusal()` throws if the remedy is empty, if a step states an intention with
no act, or if a command spans multiple lines (a remedy is meant to be pasted). The value
does not exist. This deliberately is not a linter and not a review convention: a linter is
satisfied by `remedy: [""]`, and a review convention is satisfied by nobody looking.

*What it does not deliver:* a constructor can check that a remedy **exists**; it cannot
check that it **helps**. `{ why: "fix it", note: "see the docs" }` constructs fine, and a
check claiming otherwise would be the vacuity class in this module's own front door. What
the constructor buys is that an omission is now **deliberate**. It also cannot force a
refusal to go through it at all — `throw new Error("nope")` bypasses the type entirely.

**A wrong remedy is worse than none.** It costs the reader the time to run it, the time to
work out why it failed, and some of their willingness to follow the next instruction this
system gives them. Verify the command against the tool's own usage text before you print it.

### 3.5 Before/after state is measured

"Nothing changed" must be a **reading**, not an assumption. The failure is small and
extremely common: a dry run reports the device untouched *because dry runs do not touch
devices*. That sentence is true, and it is the conclusion assumed rather than observed.

*Mechanism:* `measureAround` runs the probe before and after the act and carries both
readings. When the act throws, it throws `MeasuredActFailure` carrying `before`, `after` and
`changed` — because **"it failed and left the state alone" and "it failed halfway through"
are different outcomes**, and the second is the worst one to discover late. The cause's
message is preserved as a prefix so existing assertions and log greps keep matching.

*What it does not deliver:* it runs the probe **you** supply. `probe: () => 0` satisfies it
and measures nothing, and no signature can tell that from a real observation. The default
comparator is `Object.is`, which is right for a scalar reading (a handle, a count, a hash)
and wrong for a freshly-allocated object — **supply `sameState` for structural readings**,
or every run reports a change and a signal that is always on carries no information.

*Weak when* the state is large or monotone. An HSM audit counter only goes up, so "it
changed" is a check that cannot fail.

### 3.6 The escape hatch is explicit and named

An escape lifts **one** refusal code, and carries a reason and an authorizer.

The shape everyone reaches for is `--force` — or `--admin`, which this repo has already
found to be an override *button* rather than an escape hatch. One flag that lifts every
refusal has three bad properties: it is used to get past the refusal you understand and
silently lifts the several you have never heard of; nothing about the system's behaviour
under it can be reasoned about, because the set of checks that ran is unknown; and it
removes any incentive to fix a refusal that fires too often, because the workaround is
cheaper than the report.

*Mechanism:* `namedEscape` refuses the blanket spellings (`*`, `all`, `any`, `force`,
`admin`, empty) and requires both a reason and an authorizer. It is a **value, not a flag**,
so granting one is a code change that appears in a diff.

*What it does not deliver:* nothing stops somebody enumerating every code by hand. What the
type buys is that doing so is a **visible list in a diff** instead of one innocuous-looking
flag.

---

## 4. The evidence: two refusals, one file, one hour apart

`tools/setup/persona-keys/frost-hsm-provision.ts` (PR #15564) was run end-to-end against a
real YubiHSM 2 on 2026-08-26. It got the hard parts right, and it is the reason this
protocol exists rather than being invented.

**The one that taught.** Its `module-init-failed` stage said:

> `C_Initialize returned 6.` The module loaded and would not initialise, which is usually
> module CONFIGURATION rather than hardware. For the YubiHSM module: point
> `YUBIHSM_PKCS11_CONF` at a file containing `connector = http://127.0.0.1:12345`, with
> `yubihsm-connector` running.

Two of its eight named stages diagnosed a live operator's environment correctly enough to
be repaired in **one step each**.

**The one that walled.** Its empty-password refusal said:

> `frost-hsm-provision:` no device password was supplied. Refusing to build a command that
> would prompt interactively behind a biometric gate — the operator would be approving an
> act whose authentication had not happened yet.

The reasoning is *better* than the one that taught. It names the invariant precisely. And a
newcomer at that stop has **nothing to do next**.

Same file. Same author. Same hour. That asymmetry is the whole argument: remedy-naming is a
**discipline you fall out of**, not a thing careless people do — which is why it belongs in
a constructor rather than in a review checklist. Both strings are pinned as constants in
`ceremony-handoff.test.ts` so the claim stays checkable after the code is repaired.

### The fix, as the first consumer

When #15564 lands, its password refusal resolves through a store instead of an env var:

```ts
import { keychainSecretSource, resolveSecret, renderRefusal } from "./ceremony-handoff.ts";

const source = keychainSecretSource({
  read: (service) => {
    const r = readGenericPassword(service); // src/Core.TypeScript/secrets/keychain-macos.ts
    return r.ok ? r.secret : undefined;
  },
  thenAlso: (ref) => [{
    why: "hand it to the provisioning command for one run, without exporting it globally",
    command: `ZETA_YUBIHSM_PASSWORD=$(tools/setup/secret-clip.sh get ${ref}) `
           + `bun tools/setup/persona-keys/frost-hsm-provision.ts plan`,
  }],
});

const pw = resolveSecret(
  { ref: "zeta-yubihsm-password", purpose: "the YubiHSM device password" },
  source,
);
if (!pw.ok) { process.stderr.write(renderRefusal(pw.refusal)); process.exit(2); }
```

The operator now reads:

```
  TO PROCEED:
    1. store the credential under the keystore name 'zeta-yubihsm-password' …
         $ tools/setup/secret-clip.sh set zeta-yubihsm-password --clipboard --clear-clipboard
    2. confirm it is there without printing it
         $ tools/setup/secret-clip.sh get zeta-yubihsm-password >/dev/null && echo present
    3. hand it to the provisioning command for one run, without exporting it globally
         $ ZETA_YUBIHSM_PASSWORD=$(…) bun tools/setup/persona-keys/frost-hsm-provision.ts plan
```

**The spelling was verified, not guessed.** `tools/setup/secret-clip.sh` accepts exactly
`set` / `get` / `del` — its `usage()` prints lines 11–18 of itself, so the text cannot drift
from the parser. There is no `put`, no `store`, no `add`. A test asserts the remedy never
names one of those, because §3.4's "a wrong remedy is worse than none" applies hardest to
this module's own output.

Known limits that travel **with** the remedy rather than in a footnote: `secret-clip.sh` is
macOS-only today (Linux `secret-tool` and Windows DPAPI print "PLANNED, not yet implemented"
and exit 3), and items stored to date carry an ACL naming only `security(1)`, so in-process
reads fall back to the deputy — reported in `via`, never silently (workitem
`081M01028VF087G0R001W0VD0B`).

---

## 5. The readiness ladder — "one command away" is not "broken"

A boolean cannot tell an operator the thing they most need to know. Measured on the working
instance: a **factory-fresh** device reported the same exit status as a dead one, and "you
have one approved command left to run" is the ordinary state of new hardware.

| rung | exit | meaning |
|---|---|---|
| `ready` | 0 | the prerequisite is satisfied; proceed |
| `actionable` | **3** | the subject answered and lacks the prerequisite. **Expected.** One act away, and the rung names which act. |
| `blocked` | 1 | something is actually wrong; `stage` names which, and each stage carries its own remedy |

The rule that keeps the middle rung honest: **`actionable` must be reachable only by
completing every check that could have failed.** In the worked instance it required the
module to load, the connector to answer, a token to be in the slot, the mechanism to be
supported, a session to open and the PIN to be accepted — everything except the key. *A
check that could not run must never wear the answer of a check that ran and said no.*

> ⚠️ **Scope: this is a ladder over PREREQUISITE ACQUISITION**, and it is coherent only
> where prerequisites chain. For a cloud token rotation or a signing operation it is a
> boolean wearing three rungs. For a destructive act it is worse: `ready` would mean "the
> prerequisite is satisfied, proceed", which for a drop or a revoke is either unreachable or
> means *already destroyed* — and a rung that cannot be occupied is a check that cannot
> fail. **Use the ladder where prerequisites chain; use a boolean where they do not.**

---

## 6. How well it generalises

Walked against three unlike acts. This table is the honest scope of the protocol.

| # | Invariant | cloud token rotation | signing (key stays in HSM) | destructive (revoke / drop) |
|---|---|---|---|---|
| 1 | Agent never holds the secret | fits | displaced to the session credential | vacuous — no credential |
| 2 | Approval follows authentication | fits | fits | vacuous — nothing to authenticate |
| 3 | Fully specified before approval | property fits; **argv mechanism does not** | same | same |
| 4 | **Every refusal names its remedy** | **fits** | **fits** | **fits** |
| 5 | Before/after measured | needs an async probe | weak (monotone counter) | needs an explicit comparator |
| 6 | **Named escape, never blanket** | **fits** | **fits** | **fits** |
| — | Three-rung ladder | boolean | boolean | `ready` unreachable |

**Invariants 4 and 6 survive unchanged everywhere.** Invariants 2 and 3 survive as
*properties* while their mechanisms are subprocess-shaped. Invariants 1 and 5 are
conditional, and the ladder is a provisioning tool.

If you take one thing: **4 and 6 are the portable core.**

---

## 7. Building the next one — worked end to end

Take a real unimplemented row from the closed set: **`x402-authorize-exceeding-standing-budget`**,
classified `biometric-ceremony` because it is *"outside the envelope a human set; the agent
may propose it and may not decide it."*

### Step 1 — classify (before writing any handoff code)

Is your operation in `FederatedIdentityOperation`? This one is. If yours is not, **add it
there first**, with a written reason — the `switch` has no `default`, so it will not compile
until you have. If it classifies `unattended`, **stop**: `runGatedCeremony` throws for
unattended operations, because prompting for routine work is what makes real ceremonies
unreadable.

### Step 2 — call it

```ts
import {
  runGatedCeremony,
  keychainSecretSource,
  renderRefusal,
} from "../../tools/setup/persona-keys/ceremony-handoff.ts";
import { realBriefEffects } from "../../tools/setup/persona-keys/ceremony-brief.ts";
import { realBiometric } from "../../tools/setup/persona-keys/biometric.ts";

const outcome = await runGatedCeremony({
  operation: "x402-authorize-exceeding-standing-budget",
  summary: `Authorize a payment ABOVE the standing budget`,

  // Read off the objects `act` consumes — never re-derived from the request. A second
  // derivation is how the shown act drifts from the performed one.
  subjects: [
    { label: "payee",           value: invoice.payee },
    { label: "amount",          value: `${invoice.amount} ${invoice.currency}` },
    { label: "standing ceiling", value: `${budget.ceiling} ${budget.currency}` },
    { label: "overage",         value: `${invoice.amount - budget.ceiling}` },
  ],

  ifDeclined:
    "no payment is authorized, the standing budget is unchanged, and the invoice stays " +
    "pending. Nothing is half-done: this is a single authorization, not a sequence.",

  requires: [{ ref: "zeta-x402-signing-key", purpose: "the payment authorization key" }],
  source: keychainSecretSource({ read: (s) => { const r = readGenericPassword(s); return r.ok ? r.secret : undefined; } }),

  // Read the state the act is supposed to change. MAY be async — this one is.
  probe: async () => (await ledger.authorizedTotal(invoice.id)),

  act: async (secrets) => signAuthorization(invoice, secrets.get("zeta-x402-signing-key")!),

  dryRun: !process.argv.includes("--apply"),   // default is dry run
  biometricAuth: realBiometric(),
  briefFx: realBriefEffects(),
});

switch (outcome.kind) {
  case "refused":   process.stderr.write(renderRefusal(outcome.refusal)); process.exit(2); break;
  case "dry-run":   console.log(`WOULD ASK: ${outcome.promptLine}`); break;
  case "declined":  console.log(`not authorized: ${outcome.reason}`); break;
  case "performed": console.log(`authorized; ledger ${outcome.measured.before} → ${outcome.measured.after}`); break;
}
```

### Step 3 — what you get without writing it

| step | invariant | happens where |
|---|---|---|
| refuse if the op is `unattended` | — | `assertGatedCeremony` |
| resolve every credential from the store, **before** the prompt | 1, 2 | body |
| refuse an absent credential **with the store's remedy**, and never prompt | 1, 4 | body |
| refuse if anything is still unspecified | 2, 3 | `assertFullySpecified` |
| read ground truth before the human is asked | 5 | body |
| dry run returns without touching the biometric door | — | body |
| brief printed, prompt **derived** from the same brief | 3 | `ceremony-brief` |
| fail closed if no door was injected | — | `requireBiometric` |
| act, re-probe, report a measured change | 5 | body |
| named escapes only, never blanket | 6 | `findEscape` |

### Step 4 — what you still have to think about yourself

The protocol carries the *crossing*. It does not carry your domain:

- **What the probe should observe.** `probe: () => 0` typechecks and measures nothing.
- **Idempotency and replay.** Is a second authorization of the same invoice a no-op? If the
  act is already done, return early and **do not prompt** — re-prompting for a completed act
  trains the operator to approve things they already approved.
- **Expiry.** Does an approval given now still mean yes in ten minutes?
- **The ladder, if prerequisites chain** (§5). For a budget authorization they do not — it
  is a boolean, and forcing three rungs onto it would be worse than a boolean.

---

## 8. What this protocol is not

It is **not an authentication mechanism** (`biometric.ts`), **not a classifier**
(`ceremony-gate.ts`), **not the consent renderer** (`ceremony-brief.ts`), and **not a secret
store** — it holds no credentials, opens no vault, and adds no new place a secret can live.

And it **sits beside the path rather than on it.** `ceremony-gate.ts` at least guards a
closed set that consumers pass through; nothing compels anyone to import
`ceremony-handoff.ts`. The strongest honest statement of what it buys:

> It makes four failures unconstructible **for a caller who uses it**: a refusal with no
> remedy, a plan whose displayed sentence drifts from its executed bytes, a secret that
> stringifies to plaintext, and a blanket escape hatch. It cannot stop a program prompting
> from behind the gate, cannot tell a real probe from a constant one, and cannot make
> anybody import it.

---

## 9. Falsifying the productivity claim

The claim is that the next privileged operation is cheaper because it composes this instead
of re-deriving it. That is currently a **hope, not a measurement**. What would make it
`metered`:

- **The count of independently re-derived handoffs after this lands.** If the next gated
  operation ships with its own hand-rolled prompt-and-refuse logic, the protocol failed at
  discoverability, whatever its content.
- **Remedy coverage across gated call sites** — the fraction of refusals reachable from a
  `biometric-ceremony` operation that carry a non-empty remedy. That is mechanically
  countable, and it is the number this whole document is about.
- A CI hygiene lint would make it checked rather than asserted:
  `audit-privileged-handoff-uses-protocol.ts` — enumerate the `biometric-ceremony` rows from
  `ceremony-gate.ts` itself, find every file naming one, and flag any that spawns a child
  process without going through `specifySubprocessPlan`. Roster derived from the gate's own
  table, never a hand-written allowlist that drifts from it — the same shape as
  `src/Core.TypeScript/hygiene/audit-proof-lineage-binaries.ts`. **Not written.** Named here
  so the gap is legible rather than implied closed.

### The discoverability hole — named, partly open

The protocol is worthless if the next agent never finds it, and **that, not the wording of
any rule, is the highest-value gap**. A resident rule fires at *wake*, for every agent on
every task; it cannot fire at *"about to build a privileged operation"*. It is a pointer, not
a connector.

What is closed now: `runGatedCeremony` is one symbol, the module is linked from
`tools/setup/persona-keys/README.md`, and this doc is its worked example.

What is still open, in the order it is worth doing:

1. **An adoption ratchet test** — the real mechanism, because it binds to the *act* rather
   than the wake. For every `biometric-ceremony` row in `ceremony-gate.ts`, the implementing
   call site must import `runGatedCeremony`; roster explicit and may only grow, so a new
   gated operation fails CI until it is wired. The repo already has this shape in
   `tools/setup/persona-keys/ceremony-reachability.test.ts`. **Not written.**
2. **A `security` skill blueprint** — `blueprints/ai-human-secure-handoff.md`. The skill
   router already surfaces `security` on privileged work, and blueprints are this repo's
   established teachable-procedure form. **Not written.**

Recording these as absent is the point. An unenforced guarantee that reads as protection is
the thing this whole document is against, and that applies to its own claims first.

---

## 10. The proposed rule — adversarial review record

A carved sentence for `.claude/rules/` was drafted and put through two rounds of adversarial
review with distinct lenses (cold-start cost, duplication, falsifiability, generality; then
host-fit and the teaching claim). **The proposal that survives is deliberately smaller than
the one that went in.**

### What was rejected, so nobody re-litigates it

- **A new rule file.** Rejected. `.claude/rules/` is 26 files / 103,895 B, paid on every
  wake by every agent. More decisively:
  `.claude/rules.bak/desktop-admin-consent-via-biometric-plus-small-challenge-i-execute-you-fingerprint.md`
  already covers this territory — including a "What CANNOT be substituted for biometric"
  section that decides invariant 1 — and the fleet **archived it out of residency**. A new
  file here would reverse that decision without saying so.
- **A five-clause carved sentence.** Rejected as ~35% rationale, which the meta-rule says
  belongs in the doc.
- **Making the protocol summary resident.** Rejected on a structural argument:
  **anything a type enforces need not be resident.** You cannot violate invariants 1, 3, 4
  and 6 while holding the types, and you cannot obey them by remembering them while not
  holding the types. Only the *unenforceable* halves are candidates for residency.

### What survives — two small placements, not one paragraph

Round 1 converged on "append it all to `no-directives.md`". Round 2 rejected that, and the
reason is worth recording: three attackers agreeing was a **correlated** result — they were
all optimising the same cold-start metric round 1 put in front of them, so their agreement
was one observation counted three times, not three confirmations
(`.claude/rules/numerology-vs-number-theory.md`, *too many correlations is a warning*).
Cheapness of insertion is not fitness of host.

`no-directives.md` is about **who may attach authorization**. Only one clause here is about
that; the rest is the *procedure* for a crossing you already have authority for. So:

**(A) One sentence into `.claude/rules/no-directives.md`**, under "Standing authorization is
already given", because a blanket bypass is *literally* the shadow extending authority
rather than inheriting it:

> An escape from a gated-class guard lifts exactly one named refusal, with a named
> authorizer — never a blanket `--force`, which is extension wearing a flag.

**(B) The refusal/remedy discipline**, at **broad** scope — every refusal, not only gated
ones. This is the residue with no existing owner, and its natural neighbour is
`never-assume-malice-where-mistake-is-possible.md` (how agents report to humans), not
`no-directives.md`:

> Every refusal names its remedy. A refusal that names its remedy is a guard; one that does
> not is a dead end — it teaches the reader that this system stops for reasons they cannot
> act on, which is how a person learns to route around it. Protocol and worked instance:
> `docs/protocols/ai-human-secure-handoff.md`.

Note both are stated as **design obligations, not guarantees** — deliberately. Invariant
2's clause was cut from the resident text entirely, because "authentication precedes
approval" reads as a property of the system and no mechanism delivers it (§3.2).

### The residual decisions — for the human maintainer

Adversarial review reduced the open questions to three. Each is a genuine values call, not
something more evidence settles.

**(i) Is `rules.bak/` a graveyard or a lookup table?**
Re-admitting a slice of archived territory sets a precedent: *for* — the archived rule
covers biometric consent, not refusal hygiene, and treating "adjacent" as "covered" is how a
gap hides behind a redirect. *Against* — the archive was a measured cold-start cut, and
reversing it per-topic re-bloats by a thousand individually-justified paragraphs. **Turns
on:** whether an archived rule is a decision or a reference.

**(ii) Is a resident norm with no falsifier acceptable?**
"Every refusal names its remedy" cannot be linted at broad scope — `throw new Error("nope")`
is always available, and only the constructor path is enforced. *For* — it is the discipline
that makes gates survivable, its violation is invisible until a human hits the wall, and the
measured evidence is that good engineers fall out of it within the hour. *Against* — an
unenforceable floor at maximum scope is the unenforced-guarantee shape Aaron named as *the*
obstacle to human-AI trust. **Turns on:** whether a resident norm may ever ship without a
check.

**(iii) Is "name the remedy" a power discipline or a care discipline?**
If the gate-holder **owes** the gated a path, it files near `no-directives` and authority.
If it is about how one intelligence treats another when delivering bad news, it files near
`never-assume-malice`. Both readings are defensible and they file it in different places
permanently. **Turns on:** which one Aaron thinks it is.

---

## Anchors (Beacon)

- **Confused deputy** — Norm Hardy, *"The Confused Deputy"*, ACM OSR 22(4), 1988. An
  authority exercised on behalf of a principal who could not see what was being asked; the
  failure invariants 2 and 3 exist to prevent.
- **Fail-safe defaults, least privilege** — Saltzer & Schroeder, *"The Protection of
  Information in Computer Systems"*, Proc. IEEE 63(9), 1975.
- **Informed consent as comprehension, not signature** — Faden & Beauchamp, *A History and
  Theory of Informed Consent*, 1986.
- **Habituation to security dialogs** — Böhme & Köpsell, *"Trained to Accept? A Field
  Experiment on Consent Dialogs"*, CHI 2010; Anderson et al., *"How Polymorphic Warnings
  Reduce Habituation in the Brain"*, CHI 2015. Consent dialogs shaped like routine dialogs
  get click-through, not consent — which is why this protocol adds no prompt and removes one.
- **Actionable errors** — Ko, Myers & Aung, *"Six Learning Barriers in End-User Programming
  Systems"*, VL/HCC 2004. The *selection* and *coordination* barriers are precisely "the
  system told me it stopped and not what to do next" — §3.4 with a citation.
- **Closed command set** — the portable half of the Itron hub/agent lineage;
  `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`.

## Pointers

- `tools/setup/persona-keys/ceremony-handoff.ts` — the module; `ceremony-handoff.test.ts` — the falsifiers, including the vacuities admitted as tests
- `tools/setup/persona-keys/ceremony-brief.ts` · `biometric.ts` · `src/Core.TypeScript/federated-identity/ceremony-gate.ts`
- `src/Core.TypeScript/secrets/credential.ts` · `keychain-macos.ts` · `tools/setup/secret-clip.sh` — the store this points at
- `tools/setup/persona-keys/frost-hsm-provision.ts` (PR #15564) — the worked instance
- `.claude/rules.bak/desktop-admin-consent-via-biometric-plus-small-challenge-i-execute-you-fingerprint.md` — the archived rule on adjacent territory
