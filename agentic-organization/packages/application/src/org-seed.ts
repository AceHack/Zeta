/**
 * Org seed — the starter graph: 16 departments + the full hat catalog from
 * DEPARTMENT_HAT_TOOL_INVENTORY.md, expanded into HatDefinition records.
 *
 * Each hat declares a compact spec (id, dept, level, single reportsTo, tool
 * bundles, scopes); the builder fills the rest from per-level defaults and
 * derives `supervisesHatIds` as the reverse of `reportsTo`, so the supervisor
 * graph cannot be inconsistent. The graph is validated acyclic.
 *
 * TTLs are intentionally short (minutes) so the lifecycle (warmup → active →
 * expiry → succession) is observable in a running cluster; production tuning is
 * a per-hat override.
 */

import {
  HatLevel,
  ReputationScope,
  RiskLevel,
  SuccessionPolicy,
  ToolBundle,
  type HatDefinition,
} from "../../domain/src/hat-definition.ts";
import { DepartmentId, type Department } from "../../domain/src/department.ts";

export const DEPARTMENTS: readonly Department[] = [
  { id: DepartmentId.ExecutiveBoardAndGovernance, name: "Executive Board and Governance", reportsTo: "Executive Board", owns: "Org shape, high-power hats, policy, major priorities, budget ceilings, final escalations" },
  { id: DepartmentId.ProgramAndInitiativeManagement, name: "Program and Initiative Management", reportsTo: "COO", owns: "Initiative lifecycle, mission formation, task sequencing, dependency coordination, escalation routing" },
  { id: DepartmentId.ProductAndCustomerDiscovery, name: "Product and Customer Discovery", reportsTo: "CEO", owns: "Product intent, customer needs, acceptance criteria, product signoff" },
  { id: DepartmentId.BusinessAnalysis, name: "Business Analysis", reportsTo: "Product Director or CEO", owns: "BRDs, ambiguity reduction, business evidence, requirements readiness" },
  { id: DepartmentId.Architecture, name: "Architecture", reportsTo: "CTO or Chief Architect", owns: "CA documents, ADRs, tradeoffs, integration boundaries, architecture gates" },
  { id: DepartmentId.Engineering, name: "Engineering", reportsTo: "CTO", owns: "TDD implementation, code changes, focused validation, implementation evidence, code review" },
  { id: DepartmentId.EngineeringManagement, name: "Engineering Management", reportsTo: "CTO and COO", owns: "Task readiness, staffing, context attachment, team health, outcome reviews" },
  { id: DepartmentId.QaAndVerification, name: "QA and Verification", reportsTo: "COO", owns: "Acceptance verification, browser checks, reproducibility, QA signoff" },
  { id: DepartmentId.QaEngineering, name: "QA Engineering", reportsTo: "CTO", owns: "Test automation tooling, regression suites, coverage gaps, flaky test triage" },
  { id: DepartmentId.SecurityAndCompliance, name: "Security and Compliance", reportsTo: "CEO and CTO", owns: "Credential proxy scopes, tool expansion approval, security gates, audit" },
  { id: DepartmentId.DeliveryAndRelease, name: "Delivery and Release", reportsTo: "COO", owns: "Merge readiness, release readiness, deployment evidence, rollback coordination" },
  { id: DepartmentId.MemoryAndKnowledge, name: "Memory and Knowledge Management", reportsTo: "COO", owns: "Hindsight attribution, memory scopes, project context routing, memory adaptation" },
  { id: DepartmentId.DocumentationAndProjectSkills, name: "Documentation and Project Skills", reportsTo: "Architecture and Memory", owns: "BRD/CA/ADR/design-doc lifecycle, repo skills, skill graph quality" },
  { id: DepartmentId.OperationsAndInfrastructure, name: "Operations and Infrastructure", reportsTo: "COO and CTO", owns: "Always-on runtime, schedulers, triggers, incidents, SLOs, runbooks, capacity" },
  { id: DepartmentId.ObservabilityAndEvidence, name: "Observability and Evidence", reportsTo: "Operations", owns: "Traces, metrics, health reports, telemetry coverage, evidence quality" },
  { id: DepartmentId.CapabilityAndAutomationExpansion, name: "Capability and Automation Expansion", reportsTo: "Executive Board, Architecture, Security", owns: "New hats, tools, workflows, MCP registry entries, capability review flow" },
];

type LevelDefaults = {
  tokenTtlSeconds: number;
  warmupSeconds: number;
  cooldownSeconds: number;
  maxConcurrentAssignments: number;
  successionPolicy: SuccessionPolicy;
  riskLevel: RiskLevel;
  requiresTwoPersonApproval: boolean;
  requiresHumanApproval: boolean;
  reputationScope: readonly ReputationScope[];
};

const LEVEL_DEFAULTS: Record<HatLevel, LevelDefaults> = {
  [HatLevel.ExecutiveBoard]: { tokenTtlSeconds: 420, warmupSeconds: 20, cooldownSeconds: 120, maxConcurrentAssignments: 5, successionPolicy: SuccessionPolicy.ExecutiveVote, riskLevel: RiskLevel.Critical, requiresTwoPersonApproval: true, requiresHumanApproval: false, reputationScope: [ReputationScope.Hat, ReputationScope.AgentHat] },
  [HatLevel.CSuite]: { tokenTtlSeconds: 360, warmupSeconds: 15, cooldownSeconds: 90, maxConcurrentAssignments: 1, successionPolicy: SuccessionPolicy.ExecutiveVote, riskLevel: RiskLevel.Critical, requiresTwoPersonApproval: true, requiresHumanApproval: false, reputationScope: [ReputationScope.Hat, ReputationScope.AgentHat, ReputationScope.DepartmentHat] },
  [HatLevel.Director]: { tokenTtlSeconds: 300, warmupSeconds: 12, cooldownSeconds: 60, maxConcurrentAssignments: 1, successionPolicy: SuccessionPolicy.ExecutiveVote, riskLevel: RiskLevel.High, requiresTwoPersonApproval: false, requiresHumanApproval: false, reputationScope: [ReputationScope.Hat, ReputationScope.AgentHat, ReputationScope.DepartmentHat] },
  [HatLevel.Manager]: { tokenTtlSeconds: 240, warmupSeconds: 8, cooldownSeconds: 45, maxConcurrentAssignments: 3, successionPolicy: SuccessionPolicy.DirectorAssigned, riskLevel: RiskLevel.High, requiresTwoPersonApproval: false, requiresHumanApproval: false, reputationScope: [ReputationScope.Hat, ReputationScope.AgentHat, ReputationScope.DepartmentHat] },
  [HatLevel.Lead]: { tokenTtlSeconds: 180, warmupSeconds: 5, cooldownSeconds: 30, maxConcurrentAssignments: 5, successionPolicy: SuccessionPolicy.DirectorAssigned, riskLevel: RiskLevel.Medium, requiresTwoPersonApproval: false, requiresHumanApproval: false, reputationScope: [ReputationScope.Hat, ReputationScope.AgentHat] },
  [HatLevel.IndividualContributor]: { tokenTtlSeconds: 120, warmupSeconds: 5, cooldownSeconds: 20, maxConcurrentAssignments: 10, successionPolicy: SuccessionPolicy.Rotate, riskLevel: RiskLevel.Low, requiresTwoPersonApproval: false, requiresHumanApproval: false, reputationScope: [ReputationScope.Hat, ReputationScope.AgentHat, ReputationScope.ProjectHat] },
};

type HatSpec = {
  id: string;
  name: string;
  departmentId: DepartmentId;
  level: HatLevel;
  /** single parent hat id; null only for the Executive Board root */
  reportsTo: string | null;
  toolBundles: readonly ToolBundle[];
  approvalScopes?: readonly string[];
  votingScopes?: readonly string[];
  skills?: readonly string[];
  quorumSize?: number;
  conflictsWithHatIds?: readonly string[];
};

const B = ToolBundle;
const D = DepartmentId;
const L = HatLevel;

// The full hat catalog. reportsTo wires the supervisor DAG; supervises is derived.
const HAT_SPECS: readonly HatSpec[] = [
  // ── Executive Board and Governance ──
  { id: "executive_board_member", name: "Executive Board Member", departmentId: D.ExecutiveBoardAndGovernance, level: L.ExecutiveBoard, reportsTo: null, toolBundles: [B.GoalIntake, B.Project, B.PortfolioAndInitiative, B.HatAuthorization, B.AgentInsight, B.Voting, B.Status, B.Messaging, B.Meeting, B.Observability], approvalScopes: ["major_initiatives", "departments", "high_power_hats", "budget_ceilings", "dangerous_overrides"], votingScopes: ["org_priority", "high_power_hats", "departments", "major_policy"], quorumSize: 3 },
  { id: "ceo", name: "CEO", departmentId: D.ExecutiveBoardAndGovernance, level: L.CSuite, reportsTo: "executive_board_member", toolBundles: [B.GoalIntake, B.Project, B.PortfolioAndInitiative, B.Voting, B.Status, B.Meeting, B.Messaging, B.HatAuthorization, B.AgentInsight], approvalScopes: ["portfolio_priority", "org_direction", "executive_escalation"], votingScopes: ["org_priority"] },
  { id: "cto", name: "CTO", departmentId: D.ExecutiveBoardAndGovernance, level: L.CSuite, reportsTo: "ceo", toolBundles: [B.Project, B.PortfolioAndInitiative, B.Architecture, B.ReviewAndGates, B.Status, B.Observability, B.HatAuthorization, B.Meeting, B.CapabilityExpansion], approvalScopes: ["technical_standards", "major_technical_gates", "architecture_escalation"] },
  { id: "coo", name: "COO", departmentId: D.ExecutiveBoardAndGovernance, level: L.CSuite, reportsTo: "ceo", toolBundles: [B.Project, B.PortfolioAndInitiative, B.TeamRuntime, B.Status, B.AlwaysOnRuntime, B.ScheduledReviews, B.Meeting, B.Messaging], approvalScopes: ["operating_cadence", "process_changes", "incident_process", "schedule_policy"] },
  { id: "cfo", name: "CFO", departmentId: D.ExecutiveBoardAndGovernance, level: L.CSuite, reportsTo: "ceo", toolBundles: [B.Project, B.PortfolioAndInitiative, B.Status, B.HatAuthorization, B.AgentInsight, B.AlwaysOnRuntime, B.Observability], approvalScopes: ["budget_ceilings", "cost_exceptions", "capacity_scaling"], votingScopes: ["hat_supply"] },
  { id: "chief_architect", name: "Chief Architect", departmentId: D.ExecutiveBoardAndGovernance, level: L.CSuite, reportsTo: "cto", toolBundles: [B.Architecture, B.ReviewAndGates, B.DocumentationContext, B.CapabilityExpansion, B.TemporalWorkflowRegistry, B.DaprActorRegistry, B.Voting, B.Observability], approvalScopes: ["high_risk_ca_adr", "runtime_architecture", "cross_service_design"] },
  { id: "policy_steward", name: "Policy Steward", departmentId: D.ExecutiveBoardAndGovernance, level: L.Director, reportsTo: "ceo", toolBundles: [B.Voting, B.ReviewAndGates, B.HatAuthorization, B.Observability, B.DocumentationContext, B.CapabilityExpansion], approvalScopes: ["policy_review"] },
  { id: "hat_approval_steward", name: "Hat Approval Steward", departmentId: D.ExecutiveBoardAndGovernance, level: L.Director, reportsTo: "ceo", toolBundles: [B.HatAuthorization, B.AgentInsight, B.Voting, B.ScheduledReviews, B.ReviewAndGates, B.Observability], approvalScopes: ["new_hat_classes", "sensitive_hat_activation"], votingScopes: ["hat_supply"] },

  // ── Program and Initiative Management ──
  { id: "program_director", name: "Program Director", departmentId: D.ProgramAndInitiativeManagement, level: L.Director, reportsTo: "coo", toolBundles: [B.Project, B.PortfolioAndInitiative, B.HatAuthorization, B.AgentInsight, B.Status, B.Meeting, B.ScheduledReviews], approvalScopes: ["department_initiative_priority", "tpm_assignment"], votingScopes: ["hat_supply"] },
  { id: "senior_tpm", name: "Senior TPM", departmentId: D.ProgramAndInitiativeManagement, level: L.Manager, reportsTo: "program_director", toolBundles: [B.PortfolioAndInitiative, B.TeamRuntime, B.Task, B.BacklogAndDefect, B.HatAuthorization, B.AgentInsight, B.Messaging, B.Meeting, B.ArtifactAndEvidence, B.Status], approvalScopes: ["initiative_readiness", "staffing"] },
  { id: "tpm", name: "TPM", departmentId: D.ProgramAndInitiativeManagement, level: L.Manager, reportsTo: "senior_tpm", toolBundles: [B.TeamRuntime, B.Task, B.BacklogAndDefect, B.Messaging, B.Meeting, B.ArtifactAndEvidence, B.Status, B.AgentInsight, B.HatAuthorization], approvalScopes: ["task_priority", "team_coordination"] },
  { id: "mission_control_lead", name: "Mission Control Lead", departmentId: D.ProgramAndInitiativeManagement, level: L.Lead, reportsTo: "tpm", toolBundles: [B.TeamRuntime, B.Task, B.Messaging, B.Meeting, B.ArtifactAndEvidence, B.Status, B.Observability], approvalScopes: ["mission_coordination"] },
  { id: "initiative_planner", name: "Initiative Planner", departmentId: D.ProgramAndInitiativeManagement, level: L.IndividualContributor, reportsTo: "program_director", toolBundles: [B.Project, B.PortfolioAndInitiative, B.BacklogAndDefect, B.Task, B.ArtifactAndEvidence, B.Status] },
  { id: "dependency_manager", name: "Dependency Manager", departmentId: D.ProgramAndInitiativeManagement, level: L.IndividualContributor, reportsTo: "tpm", toolBundles: [B.Task, B.BacklogAndDefect, B.Messaging, B.Meeting, B.Status, B.Observability] },
  { id: "blocker_manager", name: "Blocker Manager", departmentId: D.ProgramAndInitiativeManagement, level: L.IndividualContributor, reportsTo: "tpm", toolBundles: [B.Task, B.BacklogAndDefect, B.Messaging, B.Meeting, B.Status, B.ScheduledReviews] },

  // ── Product and Customer Discovery ──
  { id: "product_director", name: "Product Director", departmentId: D.ProductAndCustomerDiscovery, level: L.Director, reportsTo: "ceo", toolBundles: [B.GoalIntake, B.Project, B.PortfolioAndInitiative, B.Business, B.ReviewAndGates, B.Status, B.Meeting], approvalScopes: ["product_priority", "product_signoff_escalation"], votingScopes: ["hat_supply"] },
  { id: "product_owner", name: "Product Owner", departmentId: D.ProductAndCustomerDiscovery, level: L.Manager, reportsTo: "product_director", toolBundles: [B.Business, B.ArtifactAndEvidence, B.Project, B.Task, B.ReviewAndGates, B.Messaging, B.Memory, B.Status, B.DocumentationContext], approvalScopes: ["brd_signoff", "product_readiness", "customer_rfp_review", "final_business_validation"] },
  { id: "customer_interviewer", name: "Customer Interviewer", departmentId: D.ProductAndCustomerDiscovery, level: L.IndividualContributor, reportsTo: "product_owner", toolBundles: [B.Business, B.Messaging, B.ArtifactAndEvidence, B.Task, B.Memory, B.DocumentationContext] },
  { id: "requirement_clarifier", name: "Requirement Clarifier", departmentId: D.ProductAndCustomerDiscovery, level: L.IndividualContributor, reportsTo: "product_owner", toolBundles: [B.GoalIntake, B.Business, B.Messaging, B.ArtifactAndEvidence, B.BacklogAndDefect] },
  { id: "acceptance_criteria_owner", name: "Acceptance Criteria Owner", departmentId: D.ProductAndCustomerDiscovery, level: L.IndividualContributor, reportsTo: "product_owner", toolBundles: [B.Business, B.Task, B.ArtifactAndEvidence, B.ReviewAndGates, B.DocumentationContext] },
  { id: "customer_feedback_lead", name: "Customer Feedback Lead", departmentId: D.ProductAndCustomerDiscovery, level: L.Lead, reportsTo: "product_owner", toolBundles: [B.GoalIntake, B.BacklogAndDefect, B.Business, B.Messaging, B.ArtifactAndEvidence, B.Status] },

  // ── Business Analysis ──
  { id: "ba_director", name: "BA Director", departmentId: D.BusinessAnalysis, level: L.Director, reportsTo: "product_director", toolBundles: [B.Business, B.ReviewAndGates, B.Status, B.Meeting, B.ScheduledReviews], approvalScopes: ["ba_process", "brd_quality_standards"], votingScopes: ["hat_supply"] },
  { id: "business_analyst", name: "Business Analyst", departmentId: D.BusinessAnalysis, level: L.IndividualContributor, reportsTo: "ba_director", toolBundles: [B.Business, B.ArtifactAndEvidence, B.Task, B.BacklogAndDefect, B.Messaging, B.Memory, B.ReviewAndGates, B.DocumentationContext] },
  { id: "requirements_analyst", name: "Requirements Analyst", departmentId: D.BusinessAnalysis, level: L.IndividualContributor, reportsTo: "ba_director", toolBundles: [B.Business, B.ArtifactAndEvidence, B.Task, B.DocumentationContext, B.Memory] },
  { id: "brd_author", name: "BRD Author", departmentId: D.BusinessAnalysis, level: L.IndividualContributor, reportsTo: "ba_director", toolBundles: [B.Business, B.ArtifactAndEvidence, B.DocumentationContext, B.Memory, B.Messaging] },
  { id: "brd_reviewer", name: "BRD Reviewer", departmentId: D.BusinessAnalysis, level: L.IndividualContributor, reportsTo: "ba_director", toolBundles: [B.Business, B.ReviewAndGates, B.ArtifactAndEvidence, B.DocumentationContext], approvalScopes: ["brd_approval"] },
  { id: "business_approver", name: "Business Approver", departmentId: D.BusinessAnalysis, level: L.Manager, reportsTo: "ba_director", toolBundles: [B.Business, B.ReviewAndGates, B.ArtifactAndEvidence, B.Status, B.Messaging], approvalScopes: ["brd_approval"] },
  { id: "domain_researcher", name: "Domain Researcher", departmentId: D.BusinessAnalysis, level: L.IndividualContributor, reportsTo: "ba_director", toolBundles: [B.Business, B.ArtifactAndEvidence, B.Memory, B.DocumentationContext, B.Messaging] },

  // ── Architecture ──
  { id: "architecture_director", name: "Architecture Director", departmentId: D.Architecture, level: L.Director, reportsTo: "cto", toolBundles: [B.Architecture, B.ReviewAndGates, B.DocumentationContext, B.Status, B.ScheduledReviews, B.AgentInsight], approvalScopes: ["architecture_standards", "reviewer_assignment"], votingScopes: ["hat_supply"] },
  { id: "architect", name: "Architect", departmentId: D.Architecture, level: L.IndividualContributor, reportsTo: "architecture_director", toolBundles: [B.Architecture, B.ArtifactAndEvidence, B.Project, B.Task, B.Memory, B.DocumentationContext, B.Observability], approvalScopes: ["architecture_approval"] },
  { id: "conceptual_architect", name: "Conceptual Architect", departmentId: D.Architecture, level: L.IndividualContributor, reportsTo: "architecture_director", toolBundles: [B.Architecture, B.DocumentationContext, B.ArtifactAndEvidence, B.Memory, B.Meeting] },
  { id: "architecture_reviewer", name: "Architecture Reviewer", departmentId: D.Architecture, level: L.IndividualContributor, reportsTo: "architecture_director", toolBundles: [B.Architecture, B.ReviewAndGates, B.ArtifactAndEvidence, B.DocumentationContext, B.Observability], approvalScopes: ["architecture_approval"] },
  { id: "adr_steward", name: "ADR Steward", departmentId: D.Architecture, level: L.IndividualContributor, reportsTo: "architecture_director", toolBundles: [B.DocumentationContext, B.Architecture, B.ReviewAndGates, B.ProjectSkills, B.Memory] },
  { id: "integration_architect", name: "Integration Architect", departmentId: D.Architecture, level: L.IndividualContributor, reportsTo: "architecture_director", toolBundles: [B.Architecture, B.CredentialProxy, B.ReviewAndGates, B.DocumentationContext, B.Observability] },
  { id: "runtime_architecture_reviewer", name: "Runtime Architecture Reviewer", departmentId: D.Architecture, level: L.IndividualContributor, reportsTo: "architecture_director", toolBundles: [B.Architecture, B.TemporalWorkflowRegistry, B.DaprActorRegistry, B.NatsAndDlqOperations, B.OzAndHermesRuntime, B.ReviewAndGates, B.Observability], approvalScopes: ["runtime_architecture"] },

  // ── Engineering ──
  { id: "engineering_director", name: "Engineering Director", departmentId: D.Engineering, level: L.Director, reportsTo: "cto", toolBundles: [B.Project, B.PortfolioAndInitiative, B.HatAuthorization, B.AgentInsight, B.Status, B.ScheduledReviews], approvalScopes: ["engineering_priority", "engineering_standards"], votingScopes: ["hat_supply"] },
  { id: "backend_implementer", name: "Backend Implementer", departmentId: D.Engineering, level: L.IndividualContributor, reportsTo: "engineering_director", toolBundles: [B.Task, B.ArtifactAndEvidence, B.Memory, B.CredentialProxy, B.DevOps, B.Observability, B.Messaging, B.DocumentationContext] },
  { id: "frontend_implementer", name: "Frontend Implementer", departmentId: D.Engineering, level: L.IndividualContributor, reportsTo: "engineering_director", toolBundles: [B.Task, B.ArtifactAndEvidence, B.Memory, B.DevOps, B.Observability, B.Messaging, B.DocumentationContext, B.Qa] },
  { id: "fullstack_implementer", name: "Full-Stack Implementer", departmentId: D.Engineering, level: L.IndividualContributor, reportsTo: "engineering_director", toolBundles: [B.Task, B.ArtifactAndEvidence, B.Memory, B.CredentialProxy, B.DevOps, B.Observability, B.Messaging, B.DocumentationContext, B.Qa] },
  { id: "defect_fixer", name: "Defect Fixer", departmentId: D.Engineering, level: L.IndividualContributor, reportsTo: "engineering_director", toolBundles: [B.Task, B.BacklogAndDefect, B.ArtifactAndEvidence, B.Memory, B.DevOps, B.Observability, B.Messaging] },
  { id: "test_first_engineer", name: "Test-First Engineer", departmentId: D.Engineering, level: L.IndividualContributor, reportsTo: "engineering_director", toolBundles: [B.Task, B.ArtifactAndEvidence, B.DevOps, B.Observability, B.Qa, B.DocumentationContext] },
  { id: "integration_engineer", name: "Integration Engineer", departmentId: D.Engineering, level: L.IndividualContributor, reportsTo: "engineering_director", toolBundles: [B.Task, B.CredentialProxy, B.ArtifactAndEvidence, B.DevOps, B.Observability, B.Architecture, B.DocumentationContext] },
  { id: "tooling_engineer", name: "Tooling Engineer", departmentId: D.Engineering, level: L.IndividualContributor, reportsTo: "engineering_director", toolBundles: [B.Task, B.ProjectSkills, B.CapabilityExpansion, B.DevOps, B.Observability, B.ArtifactAndEvidence, B.DocumentationContext] },
  { id: "code_reviewer", name: "Code Reviewer", departmentId: D.Engineering, level: L.IndividualContributor, reportsTo: "engineering_director", toolBundles: [B.ReviewAndGates, B.ArtifactAndEvidence, B.Task, B.Memory, B.Status, B.Observability, B.Messaging, B.DocumentationContext], approvalScopes: ["implementation_review"] },

  // ── Engineering Management ──
  { id: "engineering_manager", name: "Engineering Manager", departmentId: D.EngineeringManagement, level: L.Manager, reportsTo: "engineering_director", toolBundles: [B.Task, B.TeamRuntime, B.ReviewAndGates, B.BacklogAndDefect, B.ArtifactAndEvidence, B.Memory, B.ScheduledReviews, B.Status, B.Observability, B.AgentInsight], approvalScopes: ["readiness", "outcome", "process_gates", "implementation_review"] },
  { id: "team_lead", name: "Team Lead", departmentId: D.EngineeringManagement, level: L.Lead, reportsTo: "engineering_manager", toolBundles: [B.TeamRuntime, B.Task, B.Messaging, B.Meeting, B.ArtifactAndEvidence, B.Status, B.Memory], approvalScopes: ["team_coordination"] },
  { id: "readiness_reviewer", name: "Readiness Reviewer", departmentId: D.EngineeringManagement, level: L.IndividualContributor, reportsTo: "engineering_manager", toolBundles: [B.Task, B.ReviewAndGates, B.ArtifactAndEvidence, B.DocumentationContext, B.Memory, B.Status], approvalScopes: ["readiness_gate"] },
  { id: "context_attachment_reviewer", name: "Context Attachment Reviewer", departmentId: D.EngineeringManagement, level: L.IndividualContributor, reportsTo: "engineering_manager", toolBundles: [B.Task, B.ArtifactAndEvidence, B.Memory, B.DocumentationContext, B.ProjectSkills, B.ReviewAndGates], approvalScopes: ["context_readiness_gate"] },
  { id: "outcome_reviewer", name: "Outcome Reviewer", departmentId: D.EngineeringManagement, level: L.IndividualContributor, reportsTo: "engineering_manager", toolBundles: [B.ReviewAndGates, B.ArtifactAndEvidence, B.Observability, B.Qa, B.Status, B.BacklogAndDefect], approvalScopes: ["outcome_review"] },
  { id: "performance_review_author", name: "Performance Review Author", departmentId: D.EngineeringManagement, level: L.IndividualContributor, reportsTo: "engineering_manager", toolBundles: [B.ScheduledReviews, B.ReviewAndGates, B.Memory, B.AgentInsight, B.Observability, B.BacklogAndDefect] },
  { id: "capability_request_triage", name: "Capability Request Triage", departmentId: D.EngineeringManagement, level: L.IndividualContributor, reportsTo: "engineering_manager", toolBundles: [B.CapabilityExpansion, B.BacklogAndDefect, B.ReviewAndGates, B.ArtifactAndEvidence, B.Messaging] },

  // ── QA and Verification ──
  { id: "qa_director", name: "QA Director", departmentId: D.QaAndVerification, level: L.Director, reportsTo: "coo", toolBundles: [B.Qa, B.ReviewAndGates, B.Status, B.ScheduledReviews, B.Meeting, B.BacklogAndDefect], approvalScopes: ["qa_standards", "qa_signoff_escalation"], votingScopes: ["hat_supply"] },
  { id: "qa_verifier", name: "QA Verifier", departmentId: D.QaAndVerification, level: L.IndividualContributor, reportsTo: "qa_director", toolBundles: [B.Qa, B.ArtifactAndEvidence, B.Task, B.ReviewAndGates, B.Observability, B.Status, B.BacklogAndDefect, B.Messaging], approvalScopes: ["runtime_validation"] },
  { id: "qa_reviewer", name: "QA Reviewer", departmentId: D.QaAndVerification, level: L.IndividualContributor, reportsTo: "qa_director", toolBundles: [B.Qa, B.ReviewAndGates, B.ArtifactAndEvidence, B.Task, B.Observability, B.BacklogAndDefect, B.Messaging], approvalScopes: ["runtime_validation", "qa_signoff"] },
  { id: "browser_automation_qa", name: "Browser Automation QA", departmentId: D.QaAndVerification, level: L.IndividualContributor, reportsTo: "qa_director", toolBundles: [B.Qa, B.ArtifactAndEvidence, B.Observability, B.Task, B.Messaging] },
  { id: "regression_verifier", name: "Regression Verifier", departmentId: D.QaAndVerification, level: L.IndividualContributor, reportsTo: "qa_director", toolBundles: [B.Qa, B.ScheduledReviews, B.ArtifactAndEvidence, B.Observability, B.BacklogAndDefect] },
  { id: "reproducibility_analyst", name: "Reproducibility Analyst", departmentId: D.QaAndVerification, level: L.IndividualContributor, reportsTo: "qa_director", toolBundles: [B.Qa, B.BacklogAndDefect, B.ArtifactAndEvidence, B.Observability, B.Messaging] },
  { id: "evidence_package_author", name: "Evidence Package Author", departmentId: D.QaAndVerification, level: L.IndividualContributor, reportsTo: "qa_director", toolBundles: [B.ArtifactAndEvidence, B.Qa, B.Observability, B.DocumentationContext] },

  // ── QA Engineering ──
  { id: "qa_engineering_director", name: "QA Engineering Director", departmentId: D.QaEngineering, level: L.Director, reportsTo: "cto", toolBundles: [B.Qa, B.ScheduledReviews, B.Project, B.BacklogAndDefect, B.CapabilityExpansion, B.Status], approvalScopes: ["qa_engineering_priority"], votingScopes: ["hat_supply"] },
  { id: "qa_engineering_manager", name: "QA Engineering Manager", departmentId: D.QaEngineering, level: L.Manager, reportsTo: "qa_engineering_director", toolBundles: [B.Qa, B.ScheduledReviews, B.BacklogAndDefect, B.ArtifactAndEvidence, B.Status, B.Observability, B.ProjectSkills], approvalScopes: ["qa_automation_readiness"] },
  { id: "qa_automation_engineer", name: "QA Automation Engineer", departmentId: D.QaEngineering, level: L.IndividualContributor, reportsTo: "qa_engineering_manager", toolBundles: [B.Qa, B.Task, B.ArtifactAndEvidence, B.DevOps, B.Observability, B.ProjectSkills] },
  { id: "test_suite_maintainer", name: "Test Suite Maintainer", departmentId: D.QaEngineering, level: L.IndividualContributor, reportsTo: "qa_engineering_manager", toolBundles: [B.Qa, B.ScheduledReviews, B.DevOps, B.Observability, B.BacklogAndDefect, B.ArtifactAndEvidence] },
  { id: "coverage_analyst", name: "Coverage Analyst", departmentId: D.QaEngineering, level: L.IndividualContributor, reportsTo: "qa_engineering_manager", toolBundles: [B.Qa, B.Observability, B.BacklogAndDefect, B.ArtifactAndEvidence, B.Status] },
  { id: "regression_scheduler", name: "Regression Scheduler", departmentId: D.QaEngineering, level: L.IndividualContributor, reportsTo: "qa_engineering_manager", toolBundles: [B.Qa, B.ScheduledReviews, B.AlwaysOnRuntime, B.Status, B.Messaging] },
  { id: "test_case_manager", name: "Test Case Manager", departmentId: D.QaEngineering, level: L.IndividualContributor, reportsTo: "qa_engineering_manager", toolBundles: [B.Qa, B.DocumentationContext, B.ArtifactAndEvidence, B.ProjectSkills, B.BacklogAndDefect] },

  // ── Security and Compliance ──
  { id: "security_director", name: "Security Director", departmentId: D.SecurityAndCompliance, level: L.Director, reportsTo: "cto", toolBundles: [B.CredentialProxy, B.ReviewAndGates, B.HatAuthorization, B.Observability, B.Voting, B.Meeting, B.Status], approvalScopes: ["security_veto", "sensitive_tool_policy", "security_escalation"], votingScopes: ["hat_supply"] },
  { id: "security_reviewer", name: "Security Reviewer", departmentId: D.SecurityAndCompliance, level: L.IndividualContributor, reportsTo: "security_director", toolBundles: [B.ReviewAndGates, B.CredentialProxy, B.Observability, B.ArtifactAndEvidence, B.DocumentationContext], approvalScopes: ["security_gate"] },
  { id: "credential_scope_approver", name: "Credential Scope Approver", departmentId: D.SecurityAndCompliance, level: L.IndividualContributor, reportsTo: "security_director", toolBundles: [B.CredentialProxy, B.ReviewAndGates, B.Observability, B.ArtifactAndEvidence, B.Messaging], approvalScopes: ["credential_scope"] },
  { id: "policy_engineer", name: "Policy Engineer", departmentId: D.SecurityAndCompliance, level: L.IndividualContributor, reportsTo: "security_director", toolBundles: [B.ReviewAndGates, B.Observability, B.DocumentationContext, B.CapabilityExpansion, B.HatAuthorization] },
  { id: "external_api_reviewer", name: "External API Reviewer", departmentId: D.SecurityAndCompliance, level: L.IndividualContributor, reportsTo: "security_director", toolBundles: [B.CredentialProxy, B.Architecture, B.ReviewAndGates, B.DocumentationContext, B.Observability], approvalScopes: ["external_api_security"] },
  { id: "dangerous_automation_reviewer", name: "Dangerous Automation Reviewer", departmentId: D.SecurityAndCompliance, level: L.IndividualContributor, reportsTo: "security_director", toolBundles: [B.CredentialProxy, B.AlwaysOnRuntime, B.ReviewAndGates, B.Observability, B.HumanOverride], approvalScopes: ["dangerous_automation"] },
  { id: "audit_reviewer", name: "Audit Reviewer", departmentId: D.SecurityAndCompliance, level: L.IndividualContributor, reportsTo: "security_director", toolBundles: [B.Observability, B.ArtifactAndEvidence, B.ReviewAndGates, B.Status, B.DocumentationContext], approvalScopes: ["audit_finding"] },

  // ── Delivery and Release ──
  { id: "delivery_director", name: "Delivery Director", departmentId: D.DeliveryAndRelease, level: L.Director, reportsTo: "coo", toolBundles: [B.Delivery, B.ReviewAndGates, B.Status, B.DevOps, B.Meeting, B.ScheduledReviews], approvalScopes: ["delivery_standards"], votingScopes: ["hat_supply"] },
  { id: "release_manager", name: "Release Manager", departmentId: D.DeliveryAndRelease, level: L.Manager, reportsTo: "delivery_director", toolBundles: [B.Delivery, B.ReviewAndGates, B.ArtifactAndEvidence, B.Status, B.DevOps, B.Messaging], approvalScopes: ["release_readiness"] },
  { id: "release_operator", name: "Release Operator", departmentId: D.DeliveryAndRelease, level: L.IndividualContributor, reportsTo: "release_manager", toolBundles: [B.Delivery, B.DevOps, B.ArtifactAndEvidence, B.Observability, B.Status, B.Messaging, B.AlwaysOnRuntime] },
  { id: "delivery_reviewer", name: "Delivery Reviewer", departmentId: D.DeliveryAndRelease, level: L.IndividualContributor, reportsTo: "delivery_director", toolBundles: [B.Delivery, B.ReviewAndGates, B.ArtifactAndEvidence, B.Status, B.DevOps, B.Project, B.Messaging], approvalScopes: ["release_readiness"] },
  { id: "merge_steward", name: "Merge Steward", departmentId: D.DeliveryAndRelease, level: L.IndividualContributor, reportsTo: "release_manager", toolBundles: [B.Delivery, B.DevOps, B.ArtifactAndEvidence, B.Status, B.Messaging] },
  { id: "deployment_evidence_author", name: "Deployment Evidence Author", departmentId: D.DeliveryAndRelease, level: L.IndividualContributor, reportsTo: "release_manager", toolBundles: [B.Delivery, B.ArtifactAndEvidence, B.Observability, B.DocumentationContext] },
  { id: "rollback_coordinator", name: "Rollback Coordinator", departmentId: D.DeliveryAndRelease, level: L.IndividualContributor, reportsTo: "delivery_director", toolBundles: [B.Delivery, B.AlwaysOnRuntime, B.Meeting, B.Messaging, B.Observability, B.HumanOverride] },

  // ── Memory and Knowledge ──
  { id: "memory_director", name: "Memory Director", departmentId: D.MemoryAndKnowledge, level: L.Director, reportsTo: "coo", toolBundles: [B.Memory, B.AgentInsight, B.ScheduledReviews, B.Status, B.BacklogAndDefect, B.DocumentationContext], approvalScopes: ["memory_policy"], votingScopes: ["hat_supply"] },
  { id: "memory_manager", name: "Memory Manager", departmentId: D.MemoryAndKnowledge, level: L.Manager, reportsTo: "memory_director", toolBundles: [B.Memory, B.ScheduledReviews, B.ReviewAndGates, B.AgentInsight, B.BacklogAndDefect], approvalScopes: ["memory_adaptation"] },
  { id: "memory_curator", name: "Memory Curator", departmentId: D.MemoryAndKnowledge, level: L.IndividualContributor, reportsTo: "memory_manager", toolBundles: [B.Memory, B.AgentInsight, B.BacklogAndDefect, B.ArtifactAndEvidence, B.DocumentationContext] },
  { id: "memory_reviewer", name: "Memory Reviewer", departmentId: D.MemoryAndKnowledge, level: L.IndividualContributor, reportsTo: "memory_manager", toolBundles: [B.Memory, B.ReviewAndGates, B.ScheduledReviews, B.Observability, B.ArtifactAndEvidence] },
  { id: "knowledge_router", name: "Knowledge Router", departmentId: D.MemoryAndKnowledge, level: L.IndividualContributor, reportsTo: "memory_manager", toolBundles: [B.Memory, B.DocumentationContext, B.ProjectSkills, B.Task, B.ArtifactAndEvidence] },
  { id: "project_context_librarian", name: "Project Context Librarian", departmentId: D.MemoryAndKnowledge, level: L.IndividualContributor, reportsTo: "memory_manager", toolBundles: [B.DocumentationContext, B.Memory, B.Project, B.ProjectSkills, B.ArtifactAndEvidence] },

  // ── Documentation and Project Skills ──
  { id: "documentation_systems_director", name: "Documentation Systems Director", departmentId: D.DocumentationAndProjectSkills, level: L.Director, reportsTo: "chief_architect", toolBundles: [B.DocumentationContext, B.ProjectSkills, B.ReviewAndGates, B.Status, B.ScheduledReviews], approvalScopes: ["documentation_policy"], votingScopes: ["hat_supply"] },
  { id: "design_doc_steward", name: "Design Doc Steward", departmentId: D.DocumentationAndProjectSkills, level: L.IndividualContributor, reportsTo: "documentation_systems_director", toolBundles: [B.DocumentationContext, B.Architecture, B.ArtifactAndEvidence, B.Memory] },
  { id: "documentation_reviewer", name: "Documentation Reviewer", departmentId: D.DocumentationAndProjectSkills, level: L.IndividualContributor, reportsTo: "documentation_systems_director", toolBundles: [B.DocumentationContext, B.ReviewAndGates, B.ArtifactAndEvidence, B.Memory], approvalScopes: ["documentation_gate"] },
  { id: "project_skill_author", name: "Project Skill Author", departmentId: D.DocumentationAndProjectSkills, level: L.IndividualContributor, reportsTo: "documentation_systems_director", toolBundles: [B.ProjectSkills, B.DocumentationContext, B.Memory, B.ArtifactAndEvidence, B.CapabilityExpansion] },
  { id: "skill_graph_curator", name: "Skill Graph Curator", departmentId: D.DocumentationAndProjectSkills, level: L.IndividualContributor, reportsTo: "documentation_systems_director", toolBundles: [B.ProjectSkills, B.Memory, B.DocumentationContext, B.ReviewAndGates] },
  { id: "documentation_enforcement_reviewer", name: "Documentation Enforcement Reviewer", departmentId: D.DocumentationAndProjectSkills, level: L.IndividualContributor, reportsTo: "documentation_systems_director", toolBundles: [B.DocumentationContext, B.ReviewAndGates, B.Task, B.ArtifactAndEvidence, B.Memory], approvalScopes: ["documentation_compliance_gate"] },

  // ── Operations and Infrastructure ──
  { id: "operations_director", name: "Operations Director", departmentId: D.OperationsAndInfrastructure, level: L.Director, reportsTo: "coo", toolBundles: [B.AlwaysOnRuntime, B.Observability, B.DevOps, B.Status, B.Meeting, B.ScheduledReviews], approvalScopes: ["operations_priority", "incident_process"], votingScopes: ["hat_supply"] },
  { id: "platform_operator", name: "Platform Operator", departmentId: D.OperationsAndInfrastructure, level: L.IndividualContributor, reportsTo: "operations_director", toolBundles: [B.AlwaysOnRuntime, B.Observability, B.DevOps, B.Status, B.Messaging, B.ArtifactAndEvidence] },
  { id: "runtime_steward", name: "Runtime Steward", departmentId: D.OperationsAndInfrastructure, level: L.IndividualContributor, reportsTo: "operations_director", toolBundles: [B.AlwaysOnRuntime, B.Observability, B.BacklogAndDefect, B.DocumentationContext, B.ReviewAndGates] },
  { id: "lease_steward", name: "Lease Steward", departmentId: D.OperationsAndInfrastructure, level: L.IndividualContributor, reportsTo: "operations_director", toolBundles: [B.AlwaysOnRuntime, B.Observability, B.ArtifactAndEvidence, B.BacklogAndDefect] },
  { id: "oz_k3s_reconciler", name: "Oz/K3s Reconciler", departmentId: D.OperationsAndInfrastructure, level: L.IndividualContributor, reportsTo: "operations_director", toolBundles: [B.OzAndHermesRuntime, B.AlwaysOnRuntime, B.Observability, B.DevOps, B.ArtifactAndEvidence] },
  { id: "sre", name: "SRE", departmentId: D.OperationsAndInfrastructure, level: L.IndividualContributor, reportsTo: "operations_director", toolBundles: [B.AlwaysOnRuntime, B.Observability, B.BacklogAndDefect, B.DevOps, B.Status] },
  { id: "incident_commander", name: "Incident Commander", departmentId: D.OperationsAndInfrastructure, level: L.Manager, reportsTo: "operations_director", toolBundles: [B.AlwaysOnRuntime, B.Messaging, B.Meeting, B.Status, B.ArtifactAndEvidence, B.BacklogAndDefect, B.Observability, B.HumanOverride], approvalScopes: ["incident_command"] },
  { id: "dlq_steward", name: "DLQ Steward", departmentId: D.OperationsAndInfrastructure, level: L.IndividualContributor, reportsTo: "operations_director", toolBundles: [B.AlwaysOnRuntime, B.NatsAndDlqOperations, B.Observability, B.ArtifactAndEvidence, B.BacklogAndDefect] },
  { id: "scheduler_steward", name: "Scheduler Steward", departmentId: D.OperationsAndInfrastructure, level: L.IndividualContributor, reportsTo: "operations_director", toolBundles: [B.AlwaysOnRuntime, B.ScheduledReviews, B.Observability, B.Status, B.BacklogAndDefect] },
  { id: "trigger_steward", name: "Trigger Steward", departmentId: D.OperationsAndInfrastructure, level: L.IndividualContributor, reportsTo: "operations_director", toolBundles: [B.AlwaysOnRuntime, B.Observability, B.ReviewAndGates, B.DocumentationContext] },
  { id: "runbook_maintainer", name: "Runbook Maintainer", departmentId: D.OperationsAndInfrastructure, level: L.IndividualContributor, reportsTo: "operations_director", toolBundles: [B.DocumentationContext, B.ProjectSkills, B.AlwaysOnRuntime, B.ReviewAndGates, B.Memory] },
  { id: "cost_controller", name: "Cost Controller", departmentId: D.OperationsAndInfrastructure, level: L.Manager, reportsTo: "cfo", toolBundles: [B.Status, B.HatAuthorization, B.PortfolioAndInitiative, B.AlwaysOnRuntime, B.Observability, B.AgentInsight], approvalScopes: ["cost_guardrail"], votingScopes: ["hat_supply"] },

  // ── Observability and Evidence ──
  { id: "observability_director", name: "Observability Director", departmentId: D.ObservabilityAndEvidence, level: L.Director, reportsTo: "operations_director", toolBundles: [B.Observability, B.Status, B.ScheduledReviews, B.BacklogAndDefect, B.Meeting], approvalScopes: ["observability_standards"], votingScopes: ["hat_supply"] },
  { id: "observability_curator", name: "Observability Curator", departmentId: D.ObservabilityAndEvidence, level: L.IndividualContributor, reportsTo: "observability_director", toolBundles: [B.Observability, B.ArtifactAndEvidence, B.BacklogAndDefect, B.DocumentationContext] },
  { id: "trace_analyst", name: "Trace Analyst", departmentId: D.ObservabilityAndEvidence, level: L.IndividualContributor, reportsTo: "observability_director", toolBundles: [B.Observability, B.ArtifactAndEvidence, B.Status, B.DevOps] },
  { id: "trace_and_evidence_steward", name: "Trace and Evidence Steward", departmentId: D.ObservabilityAndEvidence, level: L.IndividualContributor, reportsTo: "observability_director", toolBundles: [B.Observability, B.ArtifactAndEvidence, B.Qa, B.DocumentationContext, B.ReviewAndGates] },
  { id: "health_report_reviewer", name: "Health Report Reviewer", departmentId: D.ObservabilityAndEvidence, level: L.IndividualContributor, reportsTo: "observability_director", toolBundles: [B.Observability, B.AlwaysOnRuntime, B.BacklogAndDefect, B.ReviewAndGates], approvalScopes: ["health_finding"] },
  { id: "anomaly_classifier", name: "Anomaly Classifier", departmentId: D.ObservabilityAndEvidence, level: L.IndividualContributor, reportsTo: "observability_director", toolBundles: [B.Observability, B.AlwaysOnRuntime, B.BacklogAndDefect, B.Messaging] },
  { id: "coverage_gap_reporter", name: "Coverage Gap Reporter", departmentId: D.ObservabilityAndEvidence, level: L.IndividualContributor, reportsTo: "observability_director", toolBundles: [B.Observability, B.BacklogAndDefect, B.DocumentationContext, B.ProjectSkills] },

  // ── Capability and Automation Expansion ──
  { id: "hat_designer", name: "Hat Designer", departmentId: D.CapabilityAndAutomationExpansion, level: L.Manager, reportsTo: "hat_approval_steward", toolBundles: [B.HatAuthorization, B.AgentInsight, B.CapabilityExpansion, B.ReviewAndGates, B.DocumentationContext, B.ScheduledReviews], approvalScopes: ["hat_proposal"], quorumSize: 3, conflictsWithHatIds: ["backend_implementer", "fullstack_implementer"] },
  { id: "capability_request_owner", name: "Capability Request Owner", departmentId: D.CapabilityAndAutomationExpansion, level: L.IndividualContributor, reportsTo: "hat_designer", toolBundles: [B.CapabilityExpansion, B.BacklogAndDefect, B.ArtifactAndEvidence, B.ReviewAndGates, B.Messaging] },
  { id: "tool_registry_steward", name: "Tool Registry Steward", departmentId: D.CapabilityAndAutomationExpansion, level: L.IndividualContributor, reportsTo: "hat_designer", toolBundles: [B.CapabilityExpansion, B.ReviewAndGates, B.Observability, B.DocumentationContext, B.HatAuthorization] },
  { id: "automation_expansion_reviewer", name: "Automation Expansion Reviewer", departmentId: D.CapabilityAndAutomationExpansion, level: L.IndividualContributor, reportsTo: "hat_designer", toolBundles: [B.TemporalWorkflowRegistry, B.DaprActorRegistry, B.AlwaysOnRuntime, B.Architecture, B.ReviewAndGates, B.Observability], approvalScopes: ["automation_expansion"] },
  { id: "workflow_maintainer", name: "Workflow Maintainer", departmentId: D.CapabilityAndAutomationExpansion, level: L.IndividualContributor, reportsTo: "hat_designer", toolBundles: [B.TemporalWorkflowRegistry, B.Architecture, B.DocumentationContext, B.Observability, B.ReviewAndGates] },
  { id: "actor_registry_maintainer", name: "Actor Registry Maintainer", departmentId: D.CapabilityAndAutomationExpansion, level: L.IndividualContributor, reportsTo: "hat_designer", toolBundles: [B.DaprActorRegistry, B.Architecture, B.DocumentationContext, B.Observability, B.ReviewAndGates] },
  { id: "mcp_registry_maintainer", name: "MCP Registry Maintainer", departmentId: D.CapabilityAndAutomationExpansion, level: L.IndividualContributor, reportsTo: "hat_designer", toolBundles: [B.CapabilityExpansion, B.CredentialProxy, B.DocumentationContext, B.Observability, B.ReviewAndGates] },
];

/** Expand the compact specs into full HatDefinitions with level defaults + derived supervises. */
export function buildHatDefinitions(): readonly HatDefinition[] {
  // derive supervises = reverse of reportsTo
  const supervisedBy = new Map<string, string[]>();
  for (const spec of HAT_SPECS) {
    if (spec.reportsTo !== null) {
      const list = supervisedBy.get(spec.reportsTo) ?? [];
      list.push(spec.id);
      supervisedBy.set(spec.reportsTo, list);
    }
  }

  // conflicts are symmetric: if A conflicts with B, B conflicts with A
  const conflicts = new Map<string, Set<string>>();
  for (const spec of HAT_SPECS) {
    for (const other of spec.conflictsWithHatIds ?? []) {
      (conflicts.get(spec.id) ?? conflicts.set(spec.id, new Set()).get(spec.id)!).add(other);
      (conflicts.get(other) ?? conflicts.set(other, new Set()).get(other)!).add(spec.id);
    }
  }

  return HAT_SPECS.map((spec): HatDefinition => {
    const d = LEVEL_DEFAULTS[spec.level];
    return {
      id: spec.id,
      name: spec.name,
      departmentId: spec.departmentId,
      level: spec.level,
      supervisesHatIds: supervisedBy.get(spec.id) ?? [],
      reportsToHatIds: spec.reportsTo === null ? [] : [spec.reportsTo],
      conflictsWithHatIds: [...(conflicts.get(spec.id) ?? [])],
      // a hat is assignable by the hats it reports to (its supervisors)
      assignableByHatIds: spec.reportsTo === null ? [] : [spec.reportsTo],
      allowedToolBundles: spec.toolBundles,
      skills: spec.skills ?? [],
      approvalScopes: spec.approvalScopes ?? [],
      votingScopes: spec.votingScopes ?? [],
      memoryScopes: [spec.departmentId],
      credentialScopes: spec.toolBundles.includes(ToolBundle.CredentialProxy) ? [spec.departmentId] : [],
      documentationScopes: spec.toolBundles.includes(ToolBundle.DocumentationContext) ? [spec.departmentId] : [],
      lifecycleTransitions: [],
      requiredEvidence: [],
      maxConcurrentAssignments: d.maxConcurrentAssignments,
      tokenTtlSeconds: d.tokenTtlSeconds,
      warmupSeconds: d.warmupSeconds,
      cooldownSeconds: d.cooldownSeconds,
      successionPolicy: d.successionPolicy,
      stickyAttribution: spec.level === HatLevel.IndividualContributor,
      ...(spec.quorumSize !== undefined ? { quorumSize: spec.quorumSize } : {}),
      reputationScope: d.reputationScope,
      riskLevel: d.riskLevel,
      requiresTwoPersonApproval: d.requiresTwoPersonApproval,
      requiresHumanApproval: d.requiresHumanApproval,
    };
  });
}

export type OrgSeed = {
  departments: readonly Department[];
  hats: readonly HatDefinition[];
};

export function buildOrgSeed(): OrgSeed {
  return { departments: DEPARTMENTS, hats: buildHatDefinitions() };
}

export const OrgGraphValidation = {
  Acyclic: "acyclic",
  Cyclic: "cyclic",
  UnknownParent: "unknown_parent",
} as const;

export type OrgGraphValidation = (typeof OrgGraphValidation)[keyof typeof OrgGraphValidation];

export type OrgGraphValidationResult =
  | { outcome: typeof OrgGraphValidation.Acyclic }
  | { outcome: typeof OrgGraphValidation.Cyclic; cycle: readonly string[] }
  | { outcome: typeof OrgGraphValidation.UnknownParent; hatId: string; parentId: string };

/** Validate the reportsTo graph is a DAG terminating at the Executive Board root. */
export function validateOrgGraph(hats: readonly HatDefinition[]): OrgGraphValidationResult {
  const byId = new Map(hats.map((h) => [h.id, h]));
  for (const hat of hats) {
    for (const parent of hat.reportsToHatIds) {
      if (!byId.has(parent)) {
        return { outcome: OrgGraphValidation.UnknownParent, hatId: hat.id, parentId: parent };
      }
    }
  }
  // DFS cycle detection over reportsTo edges
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>(hats.map((h) => [h.id, WHITE]));
  const stack: string[] = [];
  const visit = (id: string): readonly string[] | undefined => {
    color.set(id, GRAY);
    stack.push(id);
    const hat = byId.get(id);
    for (const parent of hat?.reportsToHatIds ?? []) {
      const c = color.get(parent);
      if (c === GRAY) {
        return [...stack.slice(stack.indexOf(parent)), parent];
      }
      if (c === WHITE) {
        const cycle = visit(parent);
        if (cycle !== undefined) return cycle;
      }
    }
    color.set(id, BLACK);
    stack.pop();
    return undefined;
  };
  for (const hat of hats) {
    if (color.get(hat.id) === WHITE) {
      const cycle = visit(hat.id);
      if (cycle !== undefined) {
        return { outcome: OrgGraphValidation.Cyclic, cycle };
      }
    }
  }
  return { outcome: OrgGraphValidation.Acyclic };
}
