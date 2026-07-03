---
name: Itron is the edge gate — local ML + local policy + capability/energy gating (Aaron + Vera 2026-05-07)
description: Itron reduced to "the edge gate" (Vera correction of Otto's "energy gate" reduction). Itron = general edge policy/energy substrate. KSK is the kinetic high-risk specialization downstream. Itron is upstream of KSK. Concrete provenance: Aaron built IoT ML at the edge + distributed policy cache at Itron.
type: project
originSessionId: 8dfb492a-e181-4a10-8fc9-16b3b01e832d
---
Aaron 2026-05-07: "Itron damn you just reduced the shit out of itron the energy gate"

**Vera's correction (2026-05-07):** Itron is the **edge gate**, not only the energy gate. It sits where local ML, local policy, local device state, and real-world action meet.

The clean shape (Vera):

- **Model at the edge:** local inference, not cloud dependency
- **Distributed policy cache:** the device carries current rules locally
- **Capability gate:** policy decides what the model is allowed to do
- **Energy/actuation gate:** action crossing into motors/switches/valves/power/network = gated harder
- **Receipts:** the edge can explain what rule allowed or blocked the action

"Doesn't police topics" is still partly right but incomplete. It does NOT police topics as moral content categories. It DOES enforce local policy over capabilities, resources, and externalized effects.

**Hierarchy:** Itron upstream of KSK. Itron = general edge policy/energy substrate. KSK = kinetic high-risk specialization of the actuation gate.

**Concrete provenance (Aaron 2026-05-07):** "we did do this cause of our IoT ML at the edge i built that." Itron's edge-gate pattern came from IoT ML at the edge — Aaron built it. A model running on an edge device, the gate deciding whether decisions cross into actuating the physical world. Same pattern as Ace, same pattern as KSK/actuators. The abstract generalized FROM the IoT edge case. Every abstraction in this framework has a concrete engineering ancestor Aaron built: Cartographer = Isaac Sim SLAM, KSK = NVIDIA Thor actuators, Itron = IoT ML at the edge.

**Distributed policy cache at the edge (Aaron 2026-05-07):** "doesn't police topics we had distributed policy cache at the edge too." The IoT system had a distributed policy cache — each edge device carried its own local rules about what it could DO (capability gating), not what it could think about (topic filtering). Policy was local to the device, not centralized. Concrete ancestor of Ace's "receipts stay local unless disclosed" + privacy-by-default.

**How to apply:** When describing Itron, lead with "the edge gate" — where local ML, local policy, local state, and real-world action meet. KSK is downstream (kinetic specialization). Bond Curve prices what crosses the gate. Guardian writes the receipt. The IoT provenance is the concrete grounding.
