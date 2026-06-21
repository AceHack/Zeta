# N-Dimensional Dependency Space Formalism

This document formalizes the N-dimensional (N-D) dependency space that the Ace meta-package manager operates on. It is based on the concepts outlined in [081KSGS9H0008QG0R0031PBNGA: Ace as "package manager of package managers"](../backlog/P1/081KSGS9H0008QG0R0031PBNGA-package-manager-of-package-managers-n-dimensional-dependency-space-holographic-projection-ai-rate-continuous-upstream-negotiation-aaron-2026-05-26.md).

## Introduction

Traditional package managers (like Maven, npm, apt, Helm) each operate in their own 2D projection of a dependency space, typically mapping dependencies to versions. However, the true dependency landscape is far more complex, involving numerous other factors. Ace, as a meta-package manager, is designed to operate on this full, N-dimensional dependency space.

This document enumerates the axes of this space, providing a formal model for understanding and navigating complex dependency relationships across different systems and environments.

## The Axes of the N-Dimensional Dependency Space

The N-D space is defined by a set of orthogonal axes. Each axis represents a distinct dimension of a dependency relationship. The following is a non-exhaustive enumeration of these axes:

| Axis                  | Description                                                                                             | Examples                                       | Handled by Traditional PMs?          |
|-----------------------|---------------------------------------------------------------------------------------------------------|------------------------------------------------|--------------------------------------|
| **Dependency Relation** | The nature of the relationship between two components.                                                  | `depends_on`, `conflicts_with`, `provides`, `replaces` | Yes (e.g., dpkg, rpm)                |
| **Version**             | The specific version of a component, which can be a single version, a range, or a pinned version.     | `1.2.3`, `^2.0`, `~3.14.1`                       | Yes (e.g., Maven, npm, apt)          |
| **Cardinality**         | The number of instances of a component allowed within a given scope.                                    | `cluster-singleton`, `N-allowed`               | No (addressed by Ace via [081KSGS9H0008QG0R0018ES3R4]) |
| **Namespace Scope**     | The scope within which a dependency is resolved (e.g., cluster-wide, per-namespace, per-consumer).      | `cluster`, `namespace`, `per-consumer`             | Partial (K8s-aware tools)            |
| **Multi-Tenancy**       | The strategy for isolating dependencies across different tenants.                                     | `cross-tenant isolation`, `shared`             | Partial (e.g., Bitnami charts)       |
| **Multi-Use**           | The differentiation of dependencies based on their use case within a single tenant.                     | `intra-tenant use-axis`                        | No                                   |
| **Time**                | The temporal dimension of a dependency, including its history, migration phases, and upgrade windows.   | revision history, migration phase, rolling-upgrade window | Partial (e.g., Helm revisions)         |
| **Cross-PM**            | The vertical stacking of dependencies across different package managers.                                | A `jar` (Maven) in a `Docker` image in a `Helm` chart in `ArgoCD` | No                                   |
| **Security Posture**    | The security attributes of a component, such as its signature and vulnerability status.                 | `signed`, `sbom-verified`, `vuln-scan-status`  | Partial (e.g., Sigstore-aware)       |
| **Operator Policy**     | The organizational policies and compliance requirements that constrain dependencies.                      | `environment`, `org-policy`, `compliance-tier` | No                                   |

## Composition with 081KSGS9H0008QG0R0018ES3R4

The four properties for diamond resolution outlined in [081KSGS9H0008QG0R0018ES3R4: Diamond resolution namespace cardinality multi-tenant awareness](../backlog/P1/081KSGS9H0008QG0R0018ES3R4-diamond-resolution-namespace-cardinality-multi-tenant-awareness-as-third-dimension-of-shared-chart-dependency-resolution-aaron-2026-05-26.md) are a 4-axis slice of this N-dimensional space. Specifically:

* **Cardinality**
* **Namespace Scope**
* **Multi-Tenancy**
* **Multi-Use**

Ace's ability to resolve diamond dependency conflicts stems from its awareness of these additional dimensions, which are typically invisible to traditional 2D package managers. By operating in the full N-D space, Ace can make more informed and robust decisions about dependency resolution.
