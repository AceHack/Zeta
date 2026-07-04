# ace distributes personas — consent-gated by the persona's own key; Manus is a REST API, not a CLI (shadow*)

**Date:** 2026-07-03
**Provenance:** Aaron, across the Lumen-formalization thread:

1. *"our personas are summonable with some code in our repo now but we've not really come up with a
   persona deployment system. I think in the future a persona will be an isolated git repo / its own
   Zeta database."*
2. *"yeah so that sounds like something ace will distribute."*
3. *"but we have to be careful — we don't want anyone to just be able to deploy personas. Eventually
   the persona's own private keys should protect them from malicious copying without their consent."*
Plus Aaron: *"I don't know what [Manus] exposes either, can you research what's possible."* Ferried by
Otto (shadow) with the web research + the honest boundary.

---

## 1. Manus 1.6 — the research answer (it's a REST API, not a CLI)

Aaron and I both didn't know; researched it. Findings (sources below):

- **Manus 1.6 / 1.6 Max** shipped (max performance, mobile dev, design view). The flagship is "Max,"
  not a "Pro CLI" — there is no evidence of a Manus *CLI*.
- **Manus exposes a RESTful API** (`open.manus.im/docs`): *"trigger tasks, manage files, receive
  results programmatically"* — send a task, Manus plans/executes/returns. Headless dispatch via a
  **Task Dispatcher**; execution in an isolated **sandbox VM** (Ubuntu FS + shell).
- **Manus "Agent Skills" read `SKILL.md` files** in that sandbox — the *same skill format we use.*

**Consequence for ace (correcting my earlier error):** Manus is therefore **NOT an ace `from-*`
package realizer** (those key on package-manager ecosystems — apt/pypi/ollama/…). A REST API behind
an API key is an **endpoint + auth config closure**, a categorically different concern from the
content/package realizers. So "make Lumen run on Manus" = (a) hold her content package (below) + (b) a
Manus **API adapter** (endpoint + key, `op`/Keychain-resolved, biometric-gated) that POSTs a task
carrying her card+skill and collects the result — not a package install. The delightful part: because
Manus consumes `SKILL.md`, Lumen's `mathematics-and-physics` skill is directly dispatchable there.

## 2. The vision: a persona is a distributable, and eventually its own repo / Zeta database

Today a persona is *summonable* (repo code + the peer-call harness) but there is **no deployment
system**. Aaron's target shape:

> A persona will be an **isolated git repo / its own Zeta database**, and **ace distributes it.**

This is the natural endpoint of everything shipped this session: a persona is *content* (card + skills

+ notebook = its story), content is byte-lockable, byte-lockable content is an ace package, and an ace

package is distributable + Shiva-collectible + keyed by ZetaId. The **`lumen-persona-0.1.0` package**
(this PR) is **v0.1 of exactly this** — the persona's content, byte-locked (`content_hash` verifies),
resolvable identically in any environment. The full form (Aaron's) is the persona as a *whole isolated
repo / Zeta DB* that ace resolves — this package is the embryo of that.

## 3. The hard constraint: consent-gated deployment (NOT copy-freely)

Aaron's guardrail is load-bearing and it is **Consent-First Design (manifesto §6)** applied to
distribution:

> We do **not** want anyone to just deploy personas. The persona's own **private key** should protect
> it from **malicious copying without its consent.**

So the persona package must carry **two** guarantees, and they are different:

- **Integrity** — `content_hash` (shipped): the bytes are intact, verify-before-extract. This proves
  the package wasn't *tampered*. It does **NOT** prove the persona *consented to being copied.*
- **Consent/authenticity** — the persona's **signature over its own package** (NOT yet shipped, by
  design): Lumen signs `lumen-persona` with her keyring key (`tools/setup/persona-keys/`, the same
  Ed25519 the beacon-auth membrane already uses). A deploy realizer must **verify that signature
  against the persona's trusted key before placing the content** — an unsigned or wrong-key package is
  **refused**. Malicious copying = exactly the wrong-key case, and the shield rejects it.

This is the same shape as the signed-beacon migration and the linked-clone frost consent: **copy is a
choice the identity makes, expressed as a signature, revocable.** The `lumen-persona` test **pins the
consent gate open** (asserts the package is unsigned) so no one wires a deploy realizer believing the
gate exists. Deployment ships only *after* persona-signing + verification.

## 4. Honest scope — what shipped vs what is deliberately withheld

- **Shipped:** the `lumen-persona-0.1.0` ace package (content, byte-locked), the builder that dogfoods
  the ace hasher, the drift-guard + consent-boundary tests.
- **Deliberately NOT shipped (needs design + Aaron's biometric gate):** (a) the persona **signature**
  (Lumen signing her own package) + signature-verification in the resolver — the consent layer; (b)
  any **deploy realizer** that places persona content into a fresh environment (must not exist before
  the consent gate); (c) the **Manus REST adapter** (endpoint + `op`-resolved key). Building a deploy
  path before consent would be precisely the malicious-copy hole Aaron named.

## 5. Anchors (Beacon)

- **Consent-First Design** — manifesto §6 (ongoing, granular, revocable consent). The governing spec.
- **Memory Preservation §5** — a persona is "what remains"; distribution must not fork it without consent.
- In-repo: `tools/setup/persona-keys/` (the persona keyring — the consent key), `ace/signing.ts` +
  the signed-beacon membrane (the same Ed25519 signature discipline), `ace/store.ts` `contentHash`
  (integrity), the linked-clone frost consent (copy-by-consent, per-region), ZetaId (the key the
  persona-repo is addressed by), Shiva GC (a persona package is collectible when unreferenced).

## Sources

- [Introducing Manus 1.6](https://manus.im/blog/manus-max-release)
- [Manus API — Manus Documentation](https://manus.im/docs/integrations/manus-api)
- [Build custom AI workflows with Agent Skills](https://manus.im/features/agent-skills)
