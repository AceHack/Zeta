# B-0590 Slice 2: Hardware Selection (Beelink vs Minisforum)

## Goal
Select the hardware platform for the 20-machine Otto fleet replication.

## Context from B-0590 Blob
Aaron prefers Beelink-class mini-PCs with AI CPUs (NPU) and OCuLink ports for potential GPU expansion.

## Options
1. **Beelink SER/GTR/GTi series**
   - Pros: Well known, good community support, some models have OCuLink.
   - Cons: NPU availability varies.
2. **Minisforum MS-01**
   - Pros: Exceptional networking (10GbE), PCIe slots.
   - Cons: Larger, thermals under sustained load.
3. **Framework Desktop / Strix Halo**
   - Pros: Extreme modularity, high TOPS.
   - Cons: Likely too expensive for a 20-node fleet.

## Next Steps
- Verify OCuLink port availability on Beelink GTi 14.
- Determine NPU minimum TOPS requirement (AMD Ryzen AI 300 vs Intel Core Ultra).
- Source availability for a 20-unit bulk order.