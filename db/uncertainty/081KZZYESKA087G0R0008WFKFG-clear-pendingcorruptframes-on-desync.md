# ΔU: 081KZZYESKA087G0R0008WFKFG — clear pendingCorruptFrames on desync

- **measure:** a CRC-failed frame incremented pendingCorruptFrames without advancing expectedSeq; a later gap wider than MAX_NACK_GAP took the desync branch and left the count standing. LossyUdpChannel.handleIncoming and udp-bdp-link now zero it on desync.
- **ΔU > 0 because:** the stale count was spent against a different region of sequence space, re-labelling ordinary loss as corruption — the signal that tells the sender NOT to back off. The desync branch already argues it cannot evidence anything past the window; the count was the same class of claim, so it is now cleared rather than carried.
- **witnessed by:** ULT-35 (corrupt frames then desync then narrow gap emits only 'unknown'); UCH-27 (replay zeros pending on desync, clamp stays unreachable on long-burst and heavy-tailed channels). bun test src/Core.TypeScript/discovery/udp-lossy-transport.test.ts -t 'ULT-3[45]|ULT-1[7-9]|ULT-2[0-1]'
- **lineage:** PR #10777, merged 2026-08-14
