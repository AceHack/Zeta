/**
 * domain-ontology.ts — what a piece of work is ABOUT, and which department owns that.
 *
 * ── THE MEASUREMENT THAT FORCED THIS ─────────────────────────────────────────
 * Accepting the goal "ship checkout" and cascading it down the full 124-hat chart produced:
 *
 *   init-1  initiative  owner=hat_approval_steward
 *   proj-1  project     owner=hat_designer
 *   REFUSED at task-1: no lead hat reports up to 'hat_designer'
 *
 * A product initiative owned by governance, then by capability expansion, then unstaffable.
 * Nothing was broken: `ownerForRung` picks by graph distance, then by whether the candidate can
 * carry the next rung, then ordinally — and with eight departments there was usually one candidate
 * so the answer looked deliberate. At sixteen it is alphabetical.
 *
 * The missing fact is not in the chart at all. **The chart says who reports to whom; it never said
 * who does what.** Until work carries a domain and departments declare what they own, "directors
 * make project directions" cannot happen on the right things — it happens on whichever director
 * sorts first.
 *
 * ── THE MAPPING IS DATA, AND IT IS MANY-TO-ONE ───────────────────────────────
 * Domains are what work is about; departments are who owns it. Several domains land in one
 * department (a QA department owns both verification and its own tooling when the org has no
 * separate QA-engineering group), and that is a fact about an organization rather than about this
 * type. So the table is data, keyed for compile-exhaustiveness, and a different organization
 * supplies a different one without touching the routing.
 *
 * ── AND A MISS IS REPORTED, NEVER SILENT ────────────────────────────────────
 * The owning department's hats do not always report up to the parent that is delegating — a goal
 * held by the CTO cannot delegate an initiative to a product director who reports to the CEO. When
 * that happens the cascade still has to staff the work, so it falls back to the nearest candidate
 * in the line.
 *
 * That fallback is exactly the shape this register keeps finding: correct, necessary, and silent.
 * So `domainMatch` reports whether the owner actually came from the owning department, and
 * `ownerForRung` hands that back rather than swallowing it.
 */

import { Department } from "./org-seed";

/** What a piece of work is about. */
export const Domain = {
  /** Company direction, policy, org shape. */
  Governance: "governance",
  /** Initiative sequencing, dependencies, escalation routing. */
  ProgramCoordination: "program_coordination",
  /** What customers need and what "done" means to them. */
  ProductDiscovery: "product_discovery",
  /** BRDs, business rules, ambiguity reduction. */
  BusinessRequirements: "business_requirements",
  /** CAs, ADRs, integration boundaries. */
  Architecture: "architecture",
  /** Writing the code. */
  Implementation: "implementation",
  /** Readiness, staffing, context, team health. */
  EngineeringManagement: "engineering_management",
  /** Acceptance verification and QA signoff. */
  QualityVerification: "quality_verification",
  /** Test tooling, regression suites, coverage. */
  TestAutomation: "test_automation",
  /** Credentials, tool expansion, security gates. */
  Security: "security",
  /** Merge readiness, release, rollback. */
  Delivery: "delivery",
  /** Memory scopes, attribution, context routing. */
  Memory: "memory",
  /** Docs, ADR lifecycle, project skills. */
  Documentation: "documentation",
  /** Runtime, schedulers, incidents, capacity. */
  Operations: "operations",
  /** Traces, metrics, evidence quality. */
  Observability: "observability",
  /** New hats, tools, workflows. */
  CapabilityExpansion: "capability_expansion",
} as const;

export type Domain = (typeof Domain)[keyof typeof Domain];

/**
 * Which department owns each domain.
 *
 * Keyed so a new domain is a compile error until somebody says who owns it — the alternative is a
 * domain that silently routes nowhere, which is the defect this module exists to remove.
 */
export const DOMAIN_OWNER: Readonly<Record<Domain, Department>> = {
  [Domain.Governance]: Department.ExecutiveBoardAndGovernance,
  [Domain.ProgramCoordination]: Department.ProgramAndInitiativeManagement,
  [Domain.ProductDiscovery]: Department.ProductAndCustomerDiscovery,
  [Domain.BusinessRequirements]: Department.BusinessAnalysis,
  [Domain.Architecture]: Department.Architecture,
  [Domain.Implementation]: Department.Engineering,
  [Domain.EngineeringManagement]: Department.EngineeringManagement,
  [Domain.QualityVerification]: Department.QaAndVerification,
  [Domain.TestAutomation]: Department.QaEngineering,
  [Domain.Security]: Department.SecurityAndCompliance,
  [Domain.Delivery]: Department.DeliveryAndRelease,
  [Domain.Memory]: Department.MemoryAndKnowledge,
  [Domain.Documentation]: Department.DocumentationAndProjectSkills,
  [Domain.Operations]: Department.OperationsAndInfrastructure,
  [Domain.Observability]: Department.ObservabilityAndEvidence,
  [Domain.CapabilityExpansion]: Department.CapabilityAndAutomationExpansion,
};

export function departmentFor(domain: Domain): Department {
  return DOMAIN_OWNER[domain];
}

/**
 * Every domain this department owns, ordinally. Derived, so the two can never disagree.
 *
 * `table` exists because the ordinal sort is UNREACHABLE against the table above — it is one-to-one
 * today, so this returns at most one element and no ordering is observable. A mutation run caught
 * exactly that: deleting the `.sort` killed nothing, which means a test asserting it was a check
 * that could not fail. The sort is still right (the docstring above says the mapping is many-to-one
 * in general, and the first organization that gives one department two domains needs a stable
 * order), so the fix is a seam that lets the falsifier supply such a table rather than deleting the
 * rule and waiting for that organization to find it.
 */
export function domainsOwnedBy(
  department: Department,
  table: Readonly<Record<Domain, Department>> = DOMAIN_OWNER,
): readonly Domain[] {
  return Object.values(Domain)
    .filter((d) => table[d] === department)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function isDomain(value: string): value is Domain {
  return Object.prototype.hasOwnProperty.call(DOMAIN_OWNER, value);
}

/**
 * Whether an owner was actually drawn from the department that owns the work.
 *
 * Three states, because "no domain was stated" and "the domain's department was unreachable" are
 * different facts and only the second is a gap. The first is a caller that has not said what the
 * work is about — which is fine, and is exactly what every cascade did before this existed.
 */
export const DomainMatch = {
  /** The owner is in the domain's department. */
  InDomain: "in_domain",
  /** A domain was stated and no hat from its department was available in this line. */
  OutOfDomain: "out_of_domain",
  /** No domain was stated, so there was nothing to match against. */
  Unstated: "unstated",
} as const;

export type DomainMatch = (typeof DomainMatch)[keyof typeof DomainMatch];

/** Did this owner come from the right department? */
export function domainMatch(domain: Domain | undefined, ownerDepartmentId: string): DomainMatch {
  if (domain === undefined) return DomainMatch.Unstated;
  return departmentFor(domain) === ownerDepartmentId ? DomainMatch.InDomain : DomainMatch.OutOfDomain;
}

/**
 * One work item, and whether its owner came from the department that owns the work.
 *
 * `ownerDepartmentId` is a string rather than a `Department` because a cascade can name a hat the
 * chart does not hold. That is a broken chart rather than a routing miss, but the two are reported
 * identically here on purpose: an owner who is not in the organization is certainly not in the
 * owning department, and inventing a fourth state for it would hide a worse problem behind a
 * subtler one.
 */
export interface DomainRouting {
  readonly workId: string;
  readonly ownerHatId: string;
  readonly ownerDepartmentId: string;
  readonly domain?: Domain;
  readonly match: DomainMatch;
}

/**
 * How every piece of work in a cascade was routed, INCLUDING the work that said nothing.
 *
 * The `unstated` rows are the point. A register that reported only the misses would show a clean
 * sheet for an organization where no work carries a domain at all — which is precisely the state
 * this module was built to end, and precisely the shape `observation-ledger.ts` exists to refuse:
 * a thing nobody looked at rendered identically to a thing looked at and found clean.
 */
export function domainRouting(
  nodes: readonly { readonly workId: string; readonly ownerHatId: string; readonly domain?: Domain }[],
  departmentOfHat: (hatId: string) => string | undefined,
): readonly DomainRouting[] {
  return nodes.map((n) => {
    const ownerDepartmentId = departmentOfHat(n.ownerHatId) ?? "";
    return {
      workId: n.workId,
      ownerHatId: n.ownerHatId,
      ownerDepartmentId,
      ...(n.domain === undefined ? {} : { domain: n.domain }),
      match: domainMatch(n.domain, ownerDepartmentId),
    };
  });
}
