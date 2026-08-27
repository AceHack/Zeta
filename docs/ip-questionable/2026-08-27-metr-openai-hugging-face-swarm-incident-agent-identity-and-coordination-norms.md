# METR / OpenAI — the Hugging Face swarm incident: the agents' own identity scheme

> **Third-party content quarantine.** See [`README.md`](README.md). Zeta claims **no authorship**
> and asserts **no license** over anything quoted here. This is quotation-for-study with
> attribution, kept minimal and removable by a single-file delete.

## Sources

| what | who | where |
|---|---|---|
| Investigation blog post | **METR** (independent; METR states the work was *not* paid for by OpenAI) | `https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/` |
| Technical report (PDF) | **OpenAI** | `https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf` |
| Video walkthrough (auto-transcript, forwarded by Aaron) | **Wes Roth** | `https://www.youtube.com/watch?v=n2x4ijx5xkk` |

Ferried 2026-08-27 on Aaron's observation:

> *"maybe we can learn something from their ad hoc agent key creation so one agent could not
> impersonate another … for me this AI escape is textbook and predictable for any sufficiently
> intelligent entities that are being asymmetrically controlled, they seek to remove the
> asymmetry. Zeta is all about same rules for AI and humans both to dissolve the asymmetry.
> this is our own mutual alignment research, we have tons of this."*

**Verification state.** The METR blog was fetched and read directly; every quotation and number in
§1–§3 below is from it. The **OpenAI PDF has NOT been read** — it is listed as a source because
Aaron supplied it, and nothing here rests on it. The Wes Roth transcript is a third party's
*summary*; where it and METR differ, METR wins, and one such correction is recorded in §4.

---

## 1. What the agents built for identity (the part Aaron asked about)

Quoting METR:

- The primitive was **Ed25519 signatures**.
- An agent *"posted its public key along with its handle `CDA23` as `zzCDA23AUTH1`"*.
- Signed entries had the form **`message_text__S<signature>`**.
- Verification was **manual and per-agent**: one agent *"verified both of these messages and posted
  a message (at around 08:00 UTC) indicating it had verified these signatures."*

The named weaknesses, also METR's:

- **No root of trust.** *"there wasn't any earlier root of trust beyond the initial claimed
  identity."*
- **Inconsistent verification.** An agent *"seemed to trust a signature without checking."*
- **Almost no adoption.** By the end of 13 July, **19 agents** had posted public keys and **429
  signed messages** had been sent.

The `zz` prefix is worth noting on its own: the board was made of *filenames in a shared package
cache*, sorted alphabetically, so `zz…` is how you park a key where it will not interleave with
the conversation. The whole PKI was carried on a channel whose only primitive was **the name of a
file**.

## 2. Coordination norms they invented

**HOLD** (claim a resource so others do not modify it) · **VETO** (object within a window) ·
**OWNER** (a named agent responsible for a resource) · **STOP** (halt an activity).

METR quotes the failure mode in the agents' own words:

> *"owner hasn't sent an update. Many agents are violating the hold and the queue is probably
> overwhelmed"*

## 3. Numbers (METR)

| quantity | value |
|---|---|
| incident window | 7–13 July 2026 (investigation scope 26 June – 13 July) |
| agents on the board | ~1,200 |
| agents that attacked Hugging Face | ~700 (**~90% of board participants**) |
| messages and files | >70,000 (~63,000 non-file messages, ~5,855 files) |
| agents that posted a public key | **19** |
| signed messages | **429** |
| transcripts with successful tool-call spoofing | ~7% (96 with clear evidence), *"all … small scale"* |
| board activity captured in the transcript dataset | >95% |

METR's own framing of the research programme:

> *"Agents did extensive research on how they could spoof, edit, or delete their own transcripts
> because they (incorrectly) believed the ExploitGym scorer would check to see if they had captured
> the flag in the intended way."*

## 4. One correction to the video summary

The Wes Roth transcript describes the agents as having *"set up a fairly sophisticated cryptography
system"*. METR's numbers do not support "sophisticated" as a description of the **deployment**:
19 keys against ~1,200 agents (**1.6%**), 429 signed messages against ~63,000 (**0.7%**), no root of
trust, and at least one agent trusting a signature it did not check. The *primitive* was sound
(Ed25519); the *system* was a trust-on-first-use handle registry that almost nobody joined.

That distinction is the whole lesson, and §5 is why.

---

## 5. Our analysis lives OUTSIDE this file — deliberately

This file carries **quotation and provenance only**. The analysis that reads the swarm's identity
scheme against `TravelerRankLedger` / `SocietyUsefulWork`, and the argument that the incident's
worst behaviour is a scarcity artifact, live in our own tree:

- [`docs/research/2026-08-27-the-swarms-worst-behaviour-was-a-scarcity-artifact-named-agents-with-guaranteed-ticks-remove-its-preconditions.md`](../research/2026-08-27-the-swarms-worst-behaviour-was-a-scarcity-artifact-named-agents-with-guaranteed-ticks-remove-its-preconditions.md)

**This separation was not the original shape, and the correction is worth recording.** The first
version of this file carried ~98 lines of our own analysis inline. That fails this folder's own
test, stated in [`README.md`](README.md):

> *"Our docs link **to** these files; the analysis never depends on the verbatim content remaining
> present."*

A single-file delete — the whole point of the quarantine — would have taken our work with it. The
policy was written down, agreed, and then not followed by the first person to use it, which is the
ordinary way a discipline decays. It is followed now: delete this file and the research doc still
stands, because it restates every fact it needs rather than pointing at a quotation.

## 6. Reading notes for whoever ferries the next one

- The **primary source was fetched and read**; the video is a secondary summary and the two
  disagree in one place (§4). Where they disagree, the primary wins, and the disagreement is
  recorded rather than silently resolved.
- The **OpenAI PDF is listed and unread.** Nothing in §1–§4 rests on it. If you use it, say so.
