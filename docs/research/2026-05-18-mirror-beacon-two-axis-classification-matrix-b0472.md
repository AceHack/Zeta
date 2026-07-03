# Mirror/Beacon Two-Axis Classification Matrix (081KRHWGX0008QG0R002DP6AZN)

**Date:** 2026-05-18
**Author:** Lior
**Related row:** 081KRHWGX0008QG0R002DP6AZN

## Purpose
Populate the two-axis classification matrix for all existing and proposed LFG repositories, assigning each to either the Mirror (fast, speculative, internal) or Beacon (governed, citation-gated, canonical) tier.

## Classification Matrix & Rationale

| Repository | Axis 1 (Domain) | Axis 2 (Maturity) | Rationale |
|------------|-----------------|-------------------|-----------|
| **LFG/Zeta** | Factory | **Beacon** | Holds the core engine and citation-gated F# computation expressions. Stable, governed, alignment-floor enforced. |
| **LFG/civsim** | Product | **Beacon** | *[Revision from initial 081KRFA460008QG0R0007RWSN1 matrix]*: civsim was created (PR #3127) and has already undergone PR #2909 language/governance escalation. Due to its mutual-privacy crypto design and "aliens-and-future" rigorous register, it operates as a governed, externally-citable Beacon product. |
| **Forge** | Factory | **Mirror** | Factory infrastructure and bots. Requires fast iteration, speculative forks, and low governance load. |
| **ace** | Factory | **Beacon** | Package manager. Requires cryptographic infrastructure and strict governance. |
| **lf-ksk** | Product | **Mirror** | Experimental robotics/actuators. Needs fast iteration before any Homeland Security clearance governance locks it. |
| **aurora-network** | Product | **Beacon** | Alignment consensus thesis with 7-audience versions. Highly visible, externally citable, requires strict governance. |
| **american-dream** | Product | **Mirror** | Gamified NFT wealth building. Highly speculative, fun-and-rigorous iteration. |
| **lf-dio** | Product | **Mirror** | Experimental cross-lingual distributed organism. Needs fast iteration and forkability. |
| **Wellness** | Product | **Mirror** | Idea-level behavioral modification app. Scope is still speculative. |
| **Dawn** | *Monorepo* | **N/A** | Stays in monorepo as a charter document; no repository needed. |
| **Aaron-private speculative** | Owner-only | **Mirror** | Fast-forking private experimentation. |
| **Aaron-private governance** | Owner-only | **Beacon** | Private, citation-gated governance substrate. |

## Ambiguous Cases

- **LFG/civsim:** The original 081KRFA460008QG0R0007RWSN1 assumption was `Mirror`. However, given the PR #2909 governance escalation and the fact that it is the flagship external implementation of the mutual-privacy engine, it has functionally bypassed the Mirror tier and established itself as a Beacon. This will be flagged for explicit resolution in the 081KRHWGX0008QG0R0023FDYVE ADR.

## Conclusion
The Axis-2 structure holds cleanly. Repositories whose primary value is stability, security, and external citation (Zeta, ace, Aurora, civsim) fall cleanly into Beacon. Repositories whose primary value is velocity, experimentation, and speculative game design (Forge, KSK, DIO, american-dream) fall cleanly into Mirror. This matrix is ready to be formalized in the 081KRHWGX0008QG0R0023FDYVE ADR.
