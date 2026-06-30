# B-0590 Slice 2: Hardware Purchasing List

## Goal
Peel off slice 2 (Hardware purchasing list: 2-3 specific mini-PC models with reasoning + URLs + price) from B-0590.

## Recommendations

1. **Beelink SER8**
   - **Reasoning**: Good balance of price and AI capability (Ryzen 7 8845HS with XDNA NPU, 16 TOPS). Aaron explicitly prefers Beelink.
   - **Price**: ~$600-700
   - **Notes**: May lack high-bandwidth OCuLink, but sufficient for standard substrate nodes.

2. **Minisforum MS-01 / MS-A1**
   - **Reasoning**: Aggressive OCuLink adoption + PCIe. If OCuLink/GPU expansion is the true hard requirement for the nodes, this outperforms standard Beelink SKUs.
   - **Price**: ~$700-1000
   - **Notes**: High networking capabilities (10G SFP+). Excellent for cluster base.

3. **GMKtec NucBox K8**
   - **Reasoning**: Also uses Ryzen 7 8845HS and often includes OCuLink.
   - **Price**: ~$750
   - **Notes**: Good alternative to Beelink if OCuLink is strictly required and Beelink lacks it on the chosen SKU.

## Action Plan
Present these 3 options for the 20-node fleet purchase. If GPU expansion (OCuLink) is a strict requirement for all 20 nodes, Minisforum or GMKtec may be better than the base Beelink models unless a specific Beelink GTi/GTR model is sourced.