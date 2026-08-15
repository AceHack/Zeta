# ΔU: 081KZZZH24H087G0R002TXQA15 — derive block address from seq, ignore wire fields

- **measure:** blockSeq/blockPos rode on the unauthenticated UDP header and were trusted independently of seq: recvBlocks was keyed by the wire blockSeq and the slot chosen by the wire blockPos. Both are now derived at the two use sites (blockAddressOf) as floor(seq/8) and seq%8; the fields stay on the wire for honest senders but are no longer an address.
- **ΔU > 0 because:** a peer could hold seq monotone and still write any slot of any block, and CRC-32C cannot close it because the packet is well-formed and lying about where it belongs. The address is no longer attacker-supplied, so a class of silent cross-block corruption stops being reachable.
- **witnessed by:** ULT-36 (seq 0..7 with lying blockSeq/blockPos still deliver block 0); ULT-17 and ULT-24 pinned unchanged. bun test src/Core.TypeScript/discovery/udp-lossy-transport.test.ts -t 'ULT-36|ULT-24|ULT-17'
- **lineage:** PR #10778, merged 2026-08-14
