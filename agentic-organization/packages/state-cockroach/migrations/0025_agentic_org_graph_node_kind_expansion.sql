ALTER TABLE IF EXISTS agentic_org_graph_nodes
  DROP CONSTRAINT IF EXISTS agentic_org_graph_nodes_kind_check;
ALTER TABLE IF EXISTS agentic_org_graph_nodes
  ADD CONSTRAINT agentic_org_graph_nodes_kind_check CHECK (kind IN ('service', 'module', 'repo', 'endpoint', 'datastore', 'environment', 'test_target', 'doc_unit', 'entity', 'inbox_anchor', 'decision', 'discussion', 'initiative', 'meeting', 'mission', 'organization', 'project', 'quality_gate', 'release', 'schedule_block', 'supervisor_signal', 'team', 'trace', 'work_item', 'hat'));
