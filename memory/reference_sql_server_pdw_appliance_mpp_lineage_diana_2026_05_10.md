---
name: SQL Server PDW appliance — on-prem MPP where ℵ₁ NULL experiment ran, Diana's team
description: Aaron had access to SQL Server Parallel Data Warehouse (PDW/APS) — on-prem MPP appliance, share-nothing, scale-out. Where the ℵ₁ tri-boolean DST attempt happened. Same architecture Zeta targets (morsel-driven, distributed query, columnar). Aaron saw MPP at appliance scale years before building it.
type: reference
---

2026-05-10: Aaron recalled the PDW appliance.

**The appliance:**

SQL Server Parallel Data Warehouse (PDW), later renamed
Analytics Platform System (APS). On-premises MPP appliance:

- Share-nothing architecture
- Scale-out compute nodes with direct-attached storage
- Parallel query plans distributed across nodes
- Dedicated hardware racks

**Where the ℵ₁ experiment ran:**

The tri-boolean NULL DST attempt happened on this parallel
cluster — hardware that could handle the combinatorial
explosion of edge cases across distributed nodes. Diana
Little's team had access.

**The lineage to Zeta:**

| PDW concept | Zeta equivalent |
|-------------|----------------|
| MPP compute nodes | Agent society (distributed workers) |
| Share-nothing | Weight-free (no shared state dependency) |
| Parallel query plans | Morsel-driven parallelism |
| Control node | Architect persona (coordinator) |
| Direct-attached storage | Arrow Tier 0 (local memory) |
| Appliance form factor | GPU cluster ($50k in boxes) |

Aaron saw MPP at appliance scale on Diana's team, years
before building the same architecture as an AI factory.

**Connects to:**

- user_sql_null_dst_origin_story (the experiment)
- morsel-driven-expert skill (parallel execution)
- distributed-query-execution-expert skill (MPP plans)
- columnar-storage-expert skill (PDW was columnar)
- SQLSharp (the mature SQL engine implementation)
