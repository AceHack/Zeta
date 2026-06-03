CREATE INVERTED INDEX IF NOT EXISTS doc_units_by_bound_hat_ids
  ON agentic_org_doc_units (bound_hat_ids);
CREATE INVERTED INDEX IF NOT EXISTS doc_units_by_bound_stage_ids
  ON agentic_org_doc_units (bound_stage_ids);
