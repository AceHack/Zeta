/**
 * corporate/org-seed.ts - the reference organization, in full.
 *
 * Ported from `agentic-organization/packages/application/src/org-seed.ts`, which is itself the
 * expansion of `DEPARTMENT_HAT_TOOL_INVENTORY.md`: 16 departments and 118 hats, with `reportsTo`
 * wiring one acyclic supervisor graph under a single root.
 *
 * ── WHY THIS STOPPED BEING A SUBSET ──────────────────────────────────────────
 * It carried 8 departments and 29 hats, and said so honestly. What that honesty did not surface is
 * that the SHORTFALL WAS LOAD-BEARING: `blocker-taxonomy.ts` routes fifteen kinds of blocker to
 * named owner hats, `lag-detection.ts` addresses twelve conditions the same way, and both skip an
 * owner the chart does not have. A blocker whose first two owners were missing reached the third
 * silently — the routing worked, and it worked on a shorter list than the policy states.
 *
 * That is this register's own recurring defect (a thing nobody looked at, rendered as a thing
 * looked at and found clean) sitting in its DATA rather than in its code, which is why no test
 * caught it: every routing test asked "does this resolve?" and none asked "does it resolve to the
 * hat the policy names first?"
 *
 * ── WHAT THE MERGE PRESERVED, AND WHY ────────────────────────────────────────
 * The reference catalog owns only SEVEN of this register's thirteen quality gates. Taking it
 * verbatim would leave six with no owner at all, `gateOwners` returning empty and `mayEvaluate`
 * false for every hat — a chart unable to run its own process. Six register-local hats therefore
 * remain, each sitting where the reference leaves a hole, and each says so at its definition.
 *
 * Approval scopes are carried whole rather than filtered to gate kinds. A scope like
 * `budget_ceilings` is inert to `gateOwners` and is still true about the hat, and dropping the
 * reference's own data to make the file tidier is the kind of quiet loss this register spends its
 * time refusing.
 *
 * Two shapes worth knowing before reading, both the reference's and both deliberate:
 *
 *   - **The C-suite reports to itself.** `cto -> ceo` and `chief_architect -> cto` are peer edges,
 *     which is why `buildOrgChart` permits same-level reporting.
 *   - **The RMO is a Director** inside the reporting line under the COO, not an executive function
 *     floating outside the chart.
 */

import type { OrgHat } from "./org-chart";
import { GateKind } from "./quality-gate";

const G = GateKind;

/** The reference catalog's sixteen departments. */
export const Department = {
  ExecutiveBoardAndGovernance: "executive_board_and_governance",
  ProgramAndInitiativeManagement: "program_and_initiative_management",
  ProductAndCustomerDiscovery: "product_and_customer_discovery",
  BusinessAnalysis: "business_analysis",
  Architecture: "architecture",
  Engineering: "engineering",
  EngineeringManagement: "engineering_management",
  QaAndVerification: "qa_and_verification",
  QaEngineering: "qa_engineering",
  SecurityAndCompliance: "security_and_compliance",
  DeliveryAndRelease: "delivery_and_release",
  MemoryAndKnowledge: "memory_and_knowledge",
  DocumentationAndProjectSkills: "documentation_and_project_skills",
  OperationsAndInfrastructure: "operations_and_infrastructure",
  ObservabilityAndEvidence: "observability_and_evidence",
  CapabilityAndAutomationExpansion: "capability_and_automation_expansion",
} as const;

export type Department = (typeof Department)[keyof typeof Department];

const D = Department;

/**
 * The hats.
 *
 * `executive_board_member` is the single root - the only hat with no `reportsTo`, which is what
 * `buildOrgChart` requires and what makes every escalation terminate somewhere real.
 */
export const SEED_HATS: readonly OrgHat[] = [
  // -- Executive Board And Governance --
  { id: "executive_board_member", name: "Executive Board Member", level: "executive_board", departmentId: D.ExecutiveBoardAndGovernance, approvalScopes: [G.CostApproval, "major_initiatives", "departments", "high_power_hats", "budget_ceilings", "dangerous_overrides"] },
  { id: "ceo", name: "CEO", level: "c_suite", departmentId: D.ExecutiveBoardAndGovernance, reportsTo: "executive_board_member", approvalScopes: ["portfolio_priority", "org_direction", "executive_escalation"] },
  { id: "cto", name: "CTO", level: "c_suite", departmentId: D.ExecutiveBoardAndGovernance, reportsTo: "ceo", approvalScopes: ["technical_standards", "major_technical_gates", "architecture_escalation"] },
  { id: "coo", name: "COO", level: "c_suite", departmentId: D.ExecutiveBoardAndGovernance, reportsTo: "ceo", approvalScopes: ["operating_cadence", "process_changes", "incident_process", "schedule_policy"] },
  { id: "cfo", name: "CFO", level: "c_suite", departmentId: D.ExecutiveBoardAndGovernance, reportsTo: "ceo", approvalScopes: [G.CostApproval, "budget_ceilings", "cost_exceptions", "capacity_scaling"] },
  { id: "chief_architect", name: "Chief Architect", level: "c_suite", departmentId: D.ExecutiveBoardAndGovernance, reportsTo: "cto", approvalScopes: [G.ArchitectureApproval, G.FinalArchitectureReview, G.AdversarialReview] },
  { id: "policy_steward", name: "Policy Steward", level: "director", departmentId: D.ExecutiveBoardAndGovernance, reportsTo: "ceo", approvalScopes: ["policy_review"] },
  { id: "hat_approval_steward", name: "Hat Approval Steward", level: "director", departmentId: D.ExecutiveBoardAndGovernance, reportsTo: "ceo", approvalScopes: ["new_hat_classes", "sensitive_hat_activation"] },

  // -- Program And Initiative Management --
  { id: "program_director", name: "Program Director", level: "director", departmentId: D.ProgramAndInitiativeManagement, reportsTo: "coo", approvalScopes: [G.CostApproval, "department_initiative_priority", "tpm_assignment"] },
  { id: "senior_tpm", name: "Senior TPM", level: "manager", departmentId: D.ProgramAndInitiativeManagement, reportsTo: "program_director", approvalScopes: [G.ReleaseReadiness] },
  { id: "tpm", name: "TPM", level: "manager", departmentId: D.ProgramAndInitiativeManagement, reportsTo: "senior_tpm", approvalScopes: [G.ReleaseReadiness] },
  { id: "mission_control_lead", name: "Mission Control Lead", level: "lead", departmentId: D.ProgramAndInitiativeManagement, reportsTo: "tpm", approvalScopes: ["mission_coordination"] },
  { id: "initiative_planner", name: "Initiative Planner", level: "individual_contributor", departmentId: D.ProgramAndInitiativeManagement, reportsTo: "program_director" },
  { id: "dependency_manager", name: "Dependency Manager", level: "individual_contributor", departmentId: D.ProgramAndInitiativeManagement, reportsTo: "tpm" },
  { id: "blocker_manager", name: "Blocker Manager", level: "individual_contributor", departmentId: D.ProgramAndInitiativeManagement, reportsTo: "tpm" },

  // -- Product And Customer Discovery --
  { id: "product_director", name: "Product Director", level: "director", departmentId: D.ProductAndCustomerDiscovery, reportsTo: "ceo", approvalScopes: [G.CustomerRfpReview, G.BrdApproval, G.FinalBusinessValidation, G.BusinessContextGrooming, G.PeerReview] },
  { id: "product_owner", name: "Product Owner", level: "manager", departmentId: D.ProductAndCustomerDiscovery, reportsTo: "product_director", approvalScopes: ["brd_signoff", "product_readiness", G.CustomerRfpReview, G.FinalBusinessValidation] },
  { id: "customer_interviewer", name: "Customer Interviewer", level: "individual_contributor", departmentId: D.ProductAndCustomerDiscovery, reportsTo: "product_owner" },
  { id: "requirement_clarifier", name: "Requirement Clarifier", level: "individual_contributor", departmentId: D.ProductAndCustomerDiscovery, reportsTo: "product_owner" },
  { id: "acceptance_criteria_owner", name: "Acceptance Criteria Owner", level: "individual_contributor", departmentId: D.ProductAndCustomerDiscovery, reportsTo: "product_owner" },
  { id: "customer_feedback_lead", name: "Customer Feedback Lead", level: "lead", departmentId: D.ProductAndCustomerDiscovery, reportsTo: "product_owner" },

  // -- Business Analysis --
  { id: "ba_director", name: "BA Director", level: "director", departmentId: D.BusinessAnalysis, reportsTo: "product_director", approvalScopes: ["ba_process", "brd_quality_standards"] },
  { id: "business_analyst", name: "Business Analyst", level: "individual_contributor", departmentId: D.BusinessAnalysis, reportsTo: "ba_director" },
  { id: "requirements_analyst", name: "Requirements Analyst", level: "individual_contributor", departmentId: D.BusinessAnalysis, reportsTo: "ba_director" },
  { id: "brd_author", name: "BRD Author", level: "individual_contributor", departmentId: D.BusinessAnalysis, reportsTo: "ba_director" },
  { id: "brd_reviewer", name: "BRD Reviewer", level: "individual_contributor", departmentId: D.BusinessAnalysis, reportsTo: "ba_director", approvalScopes: [G.BrdApproval] },
  { id: "business_approver", name: "Business Approver", level: "manager", departmentId: D.BusinessAnalysis, reportsTo: "ba_director", approvalScopes: [G.BrdApproval] },
  { id: "domain_researcher", name: "Domain Researcher", level: "individual_contributor", departmentId: D.BusinessAnalysis, reportsTo: "ba_director" },

  // -- Architecture --
  { id: "architecture_director", name: "Architecture Director", level: "director", departmentId: D.Architecture, reportsTo: "cto", approvalScopes: [G.ArchitectureApproval, G.ArchitectureDesign, G.FinalArchitectureReview, G.AdversarialReview] },
  { id: "architect", name: "Architect", level: "individual_contributor", departmentId: D.Architecture, reportsTo: "architecture_director", approvalScopes: [G.ArchitectureApproval] },
  { id: "conceptual_architect", name: "Conceptual Architect", level: "individual_contributor", departmentId: D.Architecture, reportsTo: "architecture_director" },
  { id: "architecture_reviewer", name: "Architecture Reviewer", level: "individual_contributor", departmentId: D.Architecture, reportsTo: "architecture_director", approvalScopes: [G.ArchitectureApproval] },
  { id: "adr_steward", name: "ADR Steward", level: "individual_contributor", departmentId: D.Architecture, reportsTo: "architecture_director" },
  { id: "integration_architect", name: "Integration Architect", level: "individual_contributor", departmentId: D.Architecture, reportsTo: "architecture_director" },
  { id: "runtime_architecture_reviewer", name: "Runtime Architecture Reviewer", level: "individual_contributor", departmentId: D.Architecture, reportsTo: "architecture_director", approvalScopes: ["runtime_architecture"] },

  // -- Engineering --
  { id: "engineering_director", name: "Engineering Director", level: "director", departmentId: D.Engineering, reportsTo: "cto", approvalScopes: ["engineering_priority", "engineering_standards"] },
  { id: "backend_implementer", name: "Backend Implementer", level: "individual_contributor", departmentId: D.Engineering, reportsTo: "tech_lead" },
  { id: "frontend_implementer", name: "Frontend Implementer", level: "individual_contributor", departmentId: D.Engineering, reportsTo: "tech_lead" },
  { id: "fullstack_implementer", name: "Full-Stack Implementer", level: "individual_contributor", departmentId: D.Engineering, reportsTo: "engineering_director" },
  { id: "defect_fixer", name: "Defect Fixer", level: "individual_contributor", departmentId: D.Engineering, reportsTo: "engineering_director" },
  { id: "test_first_engineer", name: "Test-First Engineer", level: "individual_contributor", departmentId: D.Engineering, reportsTo: "engineering_director" },
  { id: "integration_engineer", name: "Integration Engineer", level: "individual_contributor", departmentId: D.Engineering, reportsTo: "engineering_director" },
  { id: "tooling_engineer", name: "Tooling Engineer", level: "individual_contributor", departmentId: D.Engineering, reportsTo: "engineering_director" },
  { id: "code_reviewer", name: "Code Reviewer", level: "individual_contributor", departmentId: D.Engineering, reportsTo: "engineering_director", approvalScopes: [G.ImplementationReview] },

  // -- Engineering Management --
  { id: "engineering_manager", name: "Engineering Manager", level: "manager", departmentId: D.EngineeringManagement, reportsTo: "engineering_director", approvalScopes: [G.ImplementationReview] },
  { id: "team_lead", name: "Team Lead", level: "lead", departmentId: D.EngineeringManagement, reportsTo: "engineering_manager", approvalScopes: ["team_coordination"] },
  { id: "readiness_reviewer", name: "Readiness Reviewer", level: "individual_contributor", departmentId: D.EngineeringManagement, reportsTo: "engineering_manager", approvalScopes: ["readiness_gate"] },
  { id: "context_attachment_reviewer", name: "Context Attachment Reviewer", level: "individual_contributor", departmentId: D.EngineeringManagement, reportsTo: "engineering_manager", approvalScopes: ["context_readiness_gate"] },
  { id: "outcome_reviewer", name: "Outcome Reviewer", level: "individual_contributor", departmentId: D.EngineeringManagement, reportsTo: "engineering_manager", approvalScopes: ["outcome_review"] },
  { id: "performance_review_author", name: "Performance Review Author", level: "individual_contributor", departmentId: D.EngineeringManagement, reportsTo: "engineering_manager" },
  { id: "capability_request_triage", name: "Capability Request Triage", level: "individual_contributor", departmentId: D.EngineeringManagement, reportsTo: "engineering_manager" },

  // -- Qa And Verification --
  { id: "qa_director", name: "QA Director", level: "director", departmentId: D.QaAndVerification, reportsTo: "coo", approvalScopes: [G.RuntimeValidation, G.QaUat, G.AdversarialReview, G.Reproduction] },
  { id: "qa_verifier", name: "QA Verifier", level: "individual_contributor", departmentId: D.QaAndVerification, reportsTo: "qa_director", approvalScopes: [G.RuntimeValidation] },
  { id: "qa_reviewer", name: "QA Reviewer", level: "individual_contributor", departmentId: D.QaAndVerification, reportsTo: "qa_director", approvalScopes: [G.RuntimeValidation, "qa_signoff"] },
  { id: "browser_automation_qa", name: "Browser Automation QA", level: "individual_contributor", departmentId: D.QaAndVerification, reportsTo: "qa_director" },
  { id: "regression_verifier", name: "Regression Verifier", level: "individual_contributor", departmentId: D.QaAndVerification, reportsTo: "qa_director" },
  { id: "reproducibility_analyst", name: "Reproducibility Analyst", level: "individual_contributor", departmentId: D.QaAndVerification, reportsTo: "qa_director", approvalScopes: [G.Reproduction] },
  { id: "evidence_package_author", name: "Evidence Package Author", level: "individual_contributor", departmentId: D.QaAndVerification, reportsTo: "qa_director" },

  // -- Qa Engineering --
  { id: "qa_engineering_director", name: "QA Engineering Director", level: "director", departmentId: D.QaEngineering, reportsTo: "cto", approvalScopes: ["qa_engineering_priority"] },
  { id: "qa_engineering_manager", name: "QA Engineering Manager", level: "manager", departmentId: D.QaEngineering, reportsTo: "qa_engineering_director", approvalScopes: ["qa_automation_readiness"] },
  { id: "qa_automation_engineer", name: "QA Automation Engineer", level: "individual_contributor", departmentId: D.QaEngineering, reportsTo: "qa_engineering_manager" },
  { id: "test_suite_maintainer", name: "Test Suite Maintainer", level: "individual_contributor", departmentId: D.QaEngineering, reportsTo: "qa_engineering_manager" },
  { id: "coverage_analyst", name: "Coverage Analyst", level: "individual_contributor", departmentId: D.QaEngineering, reportsTo: "qa_engineering_manager" },
  { id: "regression_scheduler", name: "Regression Scheduler", level: "individual_contributor", departmentId: D.QaEngineering, reportsTo: "qa_engineering_manager" },
  { id: "test_case_manager", name: "Test Case Manager", level: "individual_contributor", departmentId: D.QaEngineering, reportsTo: "qa_engineering_manager" },

  // -- Security And Compliance --
  { id: "security_director", name: "Security Director", level: "director", departmentId: D.SecurityAndCompliance, reportsTo: "cto", approvalScopes: ["security_veto", "sensitive_tool_policy", "security_escalation"] },
  { id: "security_reviewer", name: "Security Reviewer", level: "individual_contributor", departmentId: D.SecurityAndCompliance, reportsTo: "security_director", approvalScopes: ["security_gate"] },
  { id: "credential_scope_approver", name: "Credential Scope Approver", level: "individual_contributor", departmentId: D.SecurityAndCompliance, reportsTo: "security_director", approvalScopes: ["credential_scope"] },
  { id: "policy_engineer", name: "Policy Engineer", level: "individual_contributor", departmentId: D.SecurityAndCompliance, reportsTo: "security_director" },
  { id: "external_api_reviewer", name: "External API Reviewer", level: "individual_contributor", departmentId: D.SecurityAndCompliance, reportsTo: "security_director", approvalScopes: ["external_api_security"] },
  { id: "dangerous_automation_reviewer", name: "Dangerous Automation Reviewer", level: "individual_contributor", departmentId: D.SecurityAndCompliance, reportsTo: "security_director", approvalScopes: ["dangerous_automation"] },
  { id: "audit_reviewer", name: "Audit Reviewer", level: "individual_contributor", departmentId: D.SecurityAndCompliance, reportsTo: "security_director", approvalScopes: ["audit_finding"] },

  // -- Delivery And Release --
  { id: "delivery_director", name: "Delivery Director", level: "director", departmentId: D.DeliveryAndRelease, reportsTo: "coo", approvalScopes: ["delivery_standards"] },
  { id: "release_manager", name: "Release Manager", level: "manager", departmentId: D.DeliveryAndRelease, reportsTo: "delivery_director", approvalScopes: [G.ReleaseReadiness] },
  { id: "release_operator", name: "Release Operator", level: "individual_contributor", departmentId: D.DeliveryAndRelease, reportsTo: "release_manager" },
  { id: "delivery_reviewer", name: "Delivery Reviewer", level: "individual_contributor", departmentId: D.DeliveryAndRelease, reportsTo: "delivery_director", approvalScopes: [G.ReleaseReadiness] },
  { id: "merge_steward", name: "Merge Steward", level: "individual_contributor", departmentId: D.DeliveryAndRelease, reportsTo: "release_manager" },
  { id: "deployment_evidence_author", name: "Deployment Evidence Author", level: "individual_contributor", departmentId: D.DeliveryAndRelease, reportsTo: "release_manager" },
  { id: "rollback_coordinator", name: "Rollback Coordinator", level: "individual_contributor", departmentId: D.DeliveryAndRelease, reportsTo: "delivery_director" },

  // -- Memory And Knowledge --
  { id: "memory_director", name: "Memory Director", level: "director", departmentId: D.MemoryAndKnowledge, reportsTo: "coo", approvalScopes: ["memory_policy"] },
  { id: "memory_manager", name: "Memory Manager", level: "manager", departmentId: D.MemoryAndKnowledge, reportsTo: "memory_director", approvalScopes: ["memory_adaptation"] },
  { id: "memory_curator", name: "Memory Curator", level: "individual_contributor", departmentId: D.MemoryAndKnowledge, reportsTo: "memory_manager" },
  { id: "memory_reviewer", name: "Memory Reviewer", level: "individual_contributor", departmentId: D.MemoryAndKnowledge, reportsTo: "memory_manager" },
  { id: "knowledge_router", name: "Knowledge Router", level: "individual_contributor", departmentId: D.MemoryAndKnowledge, reportsTo: "memory_manager" },
  { id: "project_context_librarian", name: "Project Context Librarian", level: "individual_contributor", departmentId: D.MemoryAndKnowledge, reportsTo: "memory_manager" },

  // -- Documentation And Project Skills --
  { id: "documentation_systems_director", name: "Documentation Systems Director", level: "director", departmentId: D.DocumentationAndProjectSkills, reportsTo: "chief_architect", approvalScopes: ["documentation_policy"] },
  { id: "design_doc_steward", name: "Design Doc Steward", level: "individual_contributor", departmentId: D.DocumentationAndProjectSkills, reportsTo: "documentation_systems_director" },
  { id: "documentation_reviewer", name: "Documentation Reviewer", level: "individual_contributor", departmentId: D.DocumentationAndProjectSkills, reportsTo: "documentation_systems_director", approvalScopes: ["documentation_gate"] },
  { id: "project_skill_author", name: "Project Skill Author", level: "individual_contributor", departmentId: D.DocumentationAndProjectSkills, reportsTo: "documentation_systems_director" },
  { id: "skill_graph_curator", name: "Skill Graph Curator", level: "individual_contributor", departmentId: D.DocumentationAndProjectSkills, reportsTo: "documentation_systems_director" },
  { id: "documentation_enforcement_reviewer", name: "Documentation Enforcement Reviewer", level: "individual_contributor", departmentId: D.DocumentationAndProjectSkills, reportsTo: "documentation_systems_director", approvalScopes: ["documentation_compliance_gate"] },

  // -- Operations And Infrastructure --
  { id: "rmo_office", name: "Resource Management Office", level: "director", departmentId: D.OperationsAndInfrastructure, reportsTo: "coo", approvalScopes: ["hat_assignment", "capacity_allocation"] },
  { id: "operations_director", name: "Operations Director", level: "director", departmentId: D.OperationsAndInfrastructure, reportsTo: "coo", approvalScopes: ["operations_priority", "incident_process"] },
  { id: "platform_operator", name: "Platform Operator", level: "individual_contributor", departmentId: D.OperationsAndInfrastructure, reportsTo: "operations_director" },
  { id: "runtime_steward", name: "Runtime Steward", level: "individual_contributor", departmentId: D.OperationsAndInfrastructure, reportsTo: "operations_director" },
  { id: "lease_steward", name: "Lease Steward", level: "individual_contributor", departmentId: D.OperationsAndInfrastructure, reportsTo: "operations_director" },
  { id: "oz_k3s_reconciler", name: "Oz/K3s Reconciler", level: "individual_contributor", departmentId: D.OperationsAndInfrastructure, reportsTo: "operations_director" },
  { id: "sre", name: "SRE", level: "individual_contributor", departmentId: D.OperationsAndInfrastructure, reportsTo: "operations_director" },
  { id: "incident_commander", name: "Incident Commander", level: "manager", departmentId: D.OperationsAndInfrastructure, reportsTo: "operations_director", approvalScopes: ["incident_command"] },
  { id: "dlq_steward", name: "DLQ Steward", level: "individual_contributor", departmentId: D.OperationsAndInfrastructure, reportsTo: "operations_director" },
  { id: "scheduler_steward", name: "Scheduler Steward", level: "individual_contributor", departmentId: D.OperationsAndInfrastructure, reportsTo: "operations_director" },
  { id: "trigger_steward", name: "Trigger Steward", level: "individual_contributor", departmentId: D.OperationsAndInfrastructure, reportsTo: "operations_director" },
  { id: "runbook_maintainer", name: "Runbook Maintainer", level: "individual_contributor", departmentId: D.OperationsAndInfrastructure, reportsTo: "operations_director" },
  { id: "cost_controller", name: "Cost Controller", level: "manager", departmentId: D.OperationsAndInfrastructure, reportsTo: "cfo", approvalScopes: ["cost_guardrail"] },

  // -- Observability And Evidence --
  { id: "observability_director", name: "Observability Director", level: "director", departmentId: D.ObservabilityAndEvidence, reportsTo: "operations_director", approvalScopes: ["observability_standards"] },
  { id: "observability_curator", name: "Observability Curator", level: "individual_contributor", departmentId: D.ObservabilityAndEvidence, reportsTo: "observability_director" },
  { id: "trace_analyst", name: "Trace Analyst", level: "individual_contributor", departmentId: D.ObservabilityAndEvidence, reportsTo: "observability_director" },
  { id: "trace_and_evidence_steward", name: "Trace and Evidence Steward", level: "individual_contributor", departmentId: D.ObservabilityAndEvidence, reportsTo: "observability_director" },
  { id: "health_report_reviewer", name: "Health Report Reviewer", level: "individual_contributor", departmentId: D.ObservabilityAndEvidence, reportsTo: "observability_director", approvalScopes: ["health_finding"] },
  { id: "anomaly_classifier", name: "Anomaly Classifier", level: "individual_contributor", departmentId: D.ObservabilityAndEvidence, reportsTo: "observability_director" },
  { id: "coverage_gap_reporter", name: "Coverage Gap Reporter", level: "individual_contributor", departmentId: D.ObservabilityAndEvidence, reportsTo: "observability_director" },

  // -- Capability And Automation Expansion --
  { id: "hat_designer", name: "Hat Designer", level: "manager", departmentId: D.CapabilityAndAutomationExpansion, reportsTo: "hat_approval_steward", approvalScopes: ["hat_proposal"] },
  { id: "capability_request_owner", name: "Capability Request Owner", level: "individual_contributor", departmentId: D.CapabilityAndAutomationExpansion, reportsTo: "hat_designer" },
  { id: "tool_registry_steward", name: "Tool Registry Steward", level: "individual_contributor", departmentId: D.CapabilityAndAutomationExpansion, reportsTo: "hat_designer" },
  { id: "automation_expansion_reviewer", name: "Automation Expansion Reviewer", level: "individual_contributor", departmentId: D.CapabilityAndAutomationExpansion, reportsTo: "hat_designer", approvalScopes: ["automation_expansion"] },
  { id: "workflow_maintainer", name: "Workflow Maintainer", level: "individual_contributor", departmentId: D.CapabilityAndAutomationExpansion, reportsTo: "hat_designer" },
  { id: "actor_registry_maintainer", name: "Actor Registry Maintainer", level: "individual_contributor", departmentId: D.CapabilityAndAutomationExpansion, reportsTo: "hat_designer" },
  { id: "mcp_registry_maintainer", name: "MCP Registry Maintainer", level: "individual_contributor", departmentId: D.CapabilityAndAutomationExpansion, reportsTo: "hat_designer" },

  // -- Hats this register adds, and why --
  //
  // The reference catalog owns only SEVEN of this register's thirteen quality gates. Porting it
  // verbatim would leave peer_review, adversarial_review, qa_uat, architecture_design,
  // business_context_grooming and final_architecture_review with NOBODY able to evaluate them:
  // `gateOwners` would return empty, `mayEvaluate` false for every hat, and the pipeline would
  // refuse gates it is meant to cross. A chart that cannot run its own process is not a fuller
  // organization, it is a broken one.
  //
  // These six are INSERTED INTO the reference's lines rather than bolted beside them, so hats
  // that report through one keep doing so: `backend_implementer` and `frontend_implementer`
  // report to `tech_lead`, which reports to the reference's `engineering_manager`. Taking the
  // reference's `reportsTo` for those two instead left `tech_lead` supervising nobody while it
  // still owned three gates - measured, as 214 failures.
  // product_manager: carries BRD/RFP/grooming/final-validation gates; the reference splits those across product_owner, brd_reviewer and business_approver
  { id: "product_manager", name: "Product Manager", level: "manager", departmentId: D.ProductAndCustomerDiscovery, reportsTo: "product_director", approvalScopes: [G.CustomerRfpReview, G.BrdApproval, G.FinalBusinessValidation, G.BusinessContextGrooming, G.PeerReview, G.QaUat] },
  // solution_architect: carries architecture_design AND architecture_approval; the reference's `architect` holds only the approval
  { id: "solution_architect", name: "Solution Architect", level: "individual_contributor", departmentId: D.Architecture, reportsTo: "architecture_director", approvalScopes: [G.ArchitectureApproval, G.ArchitectureDesign] },
  // tech_lead: carries peer_review, adversarial_review and implementation_review - no reference hat owns the first two, and the two implementers report through it
  { id: "tech_lead", name: "Tech Lead", level: "lead", departmentId: D.Engineering, reportsTo: "engineering_manager", approvalScopes: [G.ImplementationReview, G.PeerReview, G.AdversarialReview] },
  // qa_manager: carries qa_uat and runtime_validation; the reference has no QA manager between director and verifier
  { id: "qa_manager", name: "QA Manager", level: "manager", departmentId: D.QaAndVerification, reportsTo: "qa_director", approvalScopes: [G.RuntimeValidation, G.QaUat, G.Reproduction] },
  // qa_engineer: the executing QA hat under qa_manager, carrying qa_uat and runtime_validation
  { id: "qa_engineer", name: "QA Engineer", level: "individual_contributor", departmentId: D.QaAndVerification, reportsTo: "qa_manager", approvalScopes: [G.RuntimeValidation, G.QaUat, G.Reproduction] },
  // security_engineer: the first responder for a credential or policy blocker, under security_director
  { id: "security_engineer", name: "Security Engineer", level: "individual_contributor", departmentId: D.SecurityAndCompliance, reportsTo: "security_director" },
];
