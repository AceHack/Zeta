// full-ai-cluster/portal/src/ops.ts
//
// The management-plane view models + the ResourceOps interface: everything the
// per-resource console needs beyond the basic listing — pod info, metrics, logs,
// events, a file tree (FTP/SFTP), editable config, and lifecycle actions. The
// server provides a k8s-backed impl (data-ops-k8s.ts); the demo provides rich
// deterministic data so the whole console renders with no cluster.
