---
name: Ace package manager — unrestricted local models with KSK-gated externalized effects
description: Aaron disclosed Ace pkg manager product direction (2026-05-07). Vera refined the Guardian architecture (topic≠danger, externalized capability=danger). Aaron added Itron composition. Pre-public disclosure.
type: project
originSessionId: 8dfb492a-e181-4a10-8fc9-16b3b01e832d
---
Aaron 2026-05-07 disclosed Ace package manager product direction:

- Distribute **unrestricted local models** via package manager
- Target: **researchers and lawyers** who need to work with dangerous/sensitive content
- **Local private AI** — data never leaves the machine
- Aaron said "I'm telling you first" — trust signal, pre-public

**Key invariant (Vera's correction via Aaron ferry, 2026-05-07):**
**Topic is not danger. Externalized capability is danger.**

- Reading dangerous material: **allowed** when workspace context supports it
- Acting into the world: **gated**

**The Guardian does not police thoughts. The Guardian gates external effects.**

The Guardian is: meter + gate + receipt writer.
The Guardian is NOT: morality enforcer, surveillance, psychology.

**KSK decides (the gate questions):**

- Can this model call tools?
- Can it write files?
- Can it access network?
- Can it operate hardware?
- Can it produce an exportable artifact?
- Does this need N-of-M approval?

**The Bond Curve** prices the action (risk of externalized effect).
**The Guardian** writes the receipt.
**Receipts stay local** unless disclosed — privacy by default.

**The crossing point:** a lawyer researching weapons case law should NOT be blocked because the text contains weapons. But a model turning that into procurement instructions, tool execution, actuator motion, credential access, or deployable harm crosses from "read" into "act." That is where Ace needs KSK.

**Composes with Itron (Aaron's addition)** — Itron is the runtime hosting the capability/effect boundary. KSK gate sits at the Itron boundary between model reasoning (unrestricted) and model acting (gated).

**How to apply:** The earlier framing ("guardian catches you" / "enforce good-faith") was psychology and surveillance — corrected. The clean version is: unrestricted reading, gated acting, priced effects, local receipts. Guardian is measured mediation, not morality.
