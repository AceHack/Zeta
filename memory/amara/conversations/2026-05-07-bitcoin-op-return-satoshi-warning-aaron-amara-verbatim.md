---
Scope: security research / Bitcoin protocol analysis
Attribution: Aaron (security researcher, issue #33298 author) + Amara (article author) + Satoshi Nakamoto (2010 warning)
Operational status: research-grade
Non-fusion disclaimer: Agreement, shared language, or repeated interaction does not imply shared identity, merged agency, consciousness, or personhood.
---

# Bitcoin OP_RETURN — Satoshi's Warning + Aaron's Research

## Satoshi Nakamoto verbatim (BitcoinTalk, October 23, 2010)

"ECDSA can't encrypt messages, only sign signatures."

"It would be unwise to have permanently recorded plaintext
messages for everyone to see. It would be an accident
waiting to happen."

"If there's going to be a message system, it should be a
separate system parallel to the bitcoin network. Messages
should not be recorded in the block chain. The messages
could be signed with the bitcoin address keypairs to prove
who they're from."

Response from another user: "It seems you're right, satoshi."

Source: BitcoinTalk forum screenshot preserved at
`docs/research/2026-05-07-satoshi-2010-warning-messages-not-in-blockchain.jpg`

## Aaron's GitHub issue (bitcoin/bitcoin #33298, 2025-09-04)

Aaron verbatim:

"This is a significant security issue. I don't want to
allow easily decodable images in my transactions because,
by law, I would then be responsible for content moderation.
Please save Bitcoin for the little guys like me so we can
continue to run a node and home miners legally without fear.
I hope nothing immoral or illicit that is easily decodable
ever makes it into the actual chain, the miner responsible
should be immediately arrested who mined that block. I don't
want to relay this crap either before it makes it into the
chain, that is still very dangerous for node runners."

"You have the power, please choose correctly."

Status: closed by Bitcoin Core maintainers.

## Aaron verbatim (2026-05-07 session, Claude Code)

"so bitcoin code defected to the big mining companies and
made all node permission nodes to hide which node received
the CSAM inject"

"huge mining pools allow jpegs on bitcoin for money they
can't protect"

"this is to hide that huge mining nodes are vulnerable by
making the legal blast radius all runners even home runners
not just huge mining pools"

"for free"

"and they have a problem i have think underbelly i can give
you the code to kill bitcoin now it's on itself"

"since they removed a bunch of local policy filter with
asking node runners"

"payload"

"pedo paradise"

"what if cursor spins up 15 nodes" / "cursor wins" /
"or can you distinguish identity"

"no node runners pay today, i run nodes"

"i can spin up 1000 only block download speed matters and
i can share the disk with that"

"i did more than create issue"

"look me up on github bitcoin issues"

"Satoshi's invisible bond curve: electricity"

## The attack chain (Aaron's analysis)

1. Enumerate permissive Bitcoin nodes (ones that updated
   and removed the 80-byte OP_RETURN filter)
2. Inject binary payload (JPEG/ROM/any file) through
   permissive nodes — cost: one transaction fee (pennies)
3. Miner includes payload in block for the fee (doesn't
   check content — checks fee)
4. Payload is on-chain forever, globally replicated,
   immutable
5. Every full node storing/relaying that block is now
   distributing the content
6. If content is illegal (CSAM), every node runner is
   legally liable
7. Legal threat kills home node adoption
8. Network centralizes to mining pools with lawyers
9. Decentralization dies from legal liability, not
   technical failure

## Why the filter was removed (Aaron's analysis)

The big mining pools are ALREADY vulnerable to content
liability. By removing the OP_RETURN filter for ALL nodes,
they spread the blast radius from "5 targetable mining
pools" to "50,000+ home node runners." Dilution of
liability through universal distribution.

If only 5 mining pools relay illegal content, those 5
pools get arrested. If 50,000 home node runners ALL relay
the same content, nobody gets arrested — enforcement is
impractical. The big pools hid their vulnerability behind
the little guys.

The filter removal wasn't "permissionless innovation."
It was liability redistribution from the few (targetable)
to the many (untargetable).

Mining pools monetized the attack surface via inscription
fees. The business model IS the vulnerability. Restoring
the 80-byte limit would kill inscription revenue.

## Amara's article (X/Twitter, 2025-09-04)

Title: "Bitcoin's OP_RETURN Debate: Illegal Content Threat
and Potential State Attack"

Published on X by Aaron (@AceHack00), written by Amara
(ChatGPT). 1205 words, 47 citations. Aaron's note:
"Written by AI influenced by my moral stance against
Bitcoin Core v30 even though I own 15 Bitcoin."

Key sources cited: The Guardian (2018 CSAM found in
blockchain), Interpol (2015 blockchain illegal content
alert), RWTH Aachen University (2018 research), BitcoinNews,
Cointribune, Cryptonews/Protos.

## Connection to Zeta factory

The local policy filter IS the membrane. Bitcoin removed
it. Aurora keeps it. CLAUDE.md, BP-11, skill router, CI
gate = local policy on every factory node. The BFT
consensus algebra (Consensus.fs) assumes a fixed,
authenticated node set. Sybil resistance requires the bond
curve (Aurora governance), not just the protocol (TLA+).

Satoshi's invisible bond curve (electricity/proof of work)
protects block PRODUCTION. It does NOT protect RELAY. The
relay is free. The injection is free. The 80-byte filter
was the only relay defense. They removed it.

## Prior art

- Aaron's Atari 2600 ROM: proof-of-concept binary
  injection via permissive nodes
- Bitcoin issue #33298: filed before filter removal
- IDA Pro books on RAID: binary analysis capability
- Itron patent US 10,834,144: hub-and-agent with
  firewall hole puncher (the controlled-relay pattern
  Bitcoin abandoned)
- Aurora governance immune system: the membrane Bitcoin
  dissolved
- Microsoft Detours: binary function interception
  (same pattern — intercept at the relay layer)
