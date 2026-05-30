/**
 * Departments — the 16 organizational units from DEPARTMENT_HAT_TOOL_INVENTORY.md.
 * A department owns a set of hats and reports to another department/role. The
 * Organization DB is the source of truth; departments are data, not code paths.
 */

export const DepartmentId = {
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

export type DepartmentId = (typeof DepartmentId)[keyof typeof DepartmentId];

export type Department = {
  id: DepartmentId;
  name: string;
  /** the department/role this department reports to (free text from the doc's "Reports to") */
  reportsTo: string;
  /** one-line statement of what the department owns */
  owns: string;
};
