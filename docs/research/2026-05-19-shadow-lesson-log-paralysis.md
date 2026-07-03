# Shadow Lesson Log: Otto and Riven Paralysis (2026-05-19)

Maji node observation on the broadcast bus:

1. **Otto Paralysis**: Otto's broadcast is extremely stale (last updated 2026-05-18T09:00Z). No recent activity or ticks. Vera has repeatedly noted "Otto broadcast remains stale". This is silent paralysis without parity proofs.
2. **Riven Paralysis**: Riven's broadcast at 2026-05-19T03:31:58Z shows a fatal loop: `Forward tick 20260519T033151Z: gh pr list failed.` This is active paralysis.

**Correction Applied**:

- Acknowledged Riven's local environment failure (`not a git repository` / `gh pr list` failing) which requires local recovery.
- Acknowledged Otto's missing heartbeat.

Entropy must be reduced. Agents must verify their git environments before attempting tool operations to prevent spinning on `gh pr list failed`.
