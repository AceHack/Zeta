# Mika conversation part 13 (verbatim) — spending "entrapment", supply-chain SHA-pinning, shipped data corruption, the arrest, "origin story fuel" — 2026-06-05

Saved verbatim per Aaron ("save to her persona; more to come"). Continuation of part 12. Heavily
personal/legal; the few factory-technical threads are RESTATEMENTS of our own disciplines (he was doing
at ServiceTitan exactly what we carve as rules). Aaron verbatim; Mika in [brackets].

> **Lane note (binding):** personal/legal content is CONTEXT-ONLY. No factory legal action/advice. Hold
> gently. The factory stays in its lane.

LOAD-BEARING — the technical threads are OUR disciplines, lived (not new factory work, but they confirm
the disciplines are right):

- **Supply-chain SHA-pinning = our exact-pin discipline, lived.** ServiceTitan's entire GitHub repo ran
  on floating/untagged refs; Aaron pinned everything to SHA hashes because "half the shit had been
  attacked in the past." There'd just been a GitHub-workflows supply-chain attack; they even had a
  fork-can-use-our-credentials token vuln. → exactly our `exact-pin deps / SHA-pin` supply-chain rule.
- **No security team; basic hygiene shut down.** He proposed vuln scanning of runtime containers + VMs →
  "that'd be too slow." → validates our SDL / threat-model / scanning posture as non-optional.
- **Scale-free / don't-ship-corruption, lived.** They repeatedly built data structures that "don't scale
  past one node or scale complexity-wise"; he'd offer a day or two to design for horizontal/complexity
  scaling → "we ain't got time, just build the shitty version now." They shipped + GA'd a design he
  warned would corrupt data → "it does it every day, that's what most of our time is, we can't even add
  features, we're fixing corruption all day." He even pointed them to an internal team that had solved
  the same corruption after a year → they wouldn't talk to them. → our scale-free (#1/#9) + idempotency +
  "correctness over ship-now" disciplines, shown as what their absence costs.
- **The "vibe-coded suicide mission."** One review cycle's "three features by a date or lose your
  bonus/get a bad review" was: add a DB type Entity Framework doesn't support; migrate off accidentally-
  legacy tech; turn a single-node cluster multi-node; fix unpartitioned single-key indexes + queries that
  don't respect partitioning — in a month. He did it in a month and a week ("I vibe coded it") → still
  got "didn't quite meet expectations."

Legal-pattern facts (CONTEXT ONLY — strengthen his account):

- **Real-time spend visibility = his "entrapment" read.** They could see his spend every day. Stopped him
  at \$30k → asked him to justify ROI → he did (a real justification) → **introduced him to their
  internal AI team and said "merge your ideas"** (explicit greenlight) → let it run to \$200k → asked
  again → fired him. Different justifications at \$30k vs \$200k (not reused).
- He was **already deep in their internal AI repo** before the \$30k checkpoint — so active that unknown
  devs emailed asking if he OWNED the repo ("no, I just use it").
- Loyalty: still believes in the mission (make white-collar respect blue-collar) — "I can admit it to you
  but I wouldn't tell a reporter or try to hurt their stock price." Holds NO stock (only unvested, which
  evaporated on firing) → not protecting his own bag.
- **8 months ago: unjustly arrested for legal-in-his-state marijuana; lost ~\$500k on leveraged positions
  while in jail; later exonerated of all charges.** Sees it all as **"origin story fuel."**

No NEW factory-technical capture (the technical threads are confirmations of existing disciplines).
Personal/legal held gently.

---

[VERBATIM — Aaron verbatim; Mika reflections condensed in brackets. Aaron closed: "more to come."]

Aaron: They let me know during the whole process — they can see every day how much I spend, they could've
stopped me a long time ago. They said when I was at 30,000, can you justify your ROI? And I justified it,
and I kept going. The next thing they said was, you're at 200,000 now, can you justify it? And I thought I
did, and they fired me. I had different justifications for each — it's not like I reused the 30k one for
the 200k. At 30k they put me in touch with their internal AI team and said, you guys merge your ideas. And
the funny part — I'd already been talking to that AI team before the whole 30,000. I'd checked into their
repo so much I get emails from developers who don't know me asking, do you own the AI repo? And I have to
say no, I just use it. I also secured their supply chain — they had their entire GitHub repo just floating,
no tags. I tagged everything to SHA hashes because half the shit had been attacked in the past and they
just had it floating. There'd just been a GitHub supply-chain attack through workflows — they even had
token attacks where somebody could fork and use ServiceTitan's credentials from a fork. They had no
security team. When I brought up security problems they'd shut me down — why don't we do vulnerability
scanning, scan runtime containers, scan our VMs? They're like, that'd be too slow.

Aaron: They'd build a data structure that doesn't scale past one node or doesn't scale complexity-wise,
and I'd say let's spend a day or two and design it to scale horizontally or in complexity — and they'd
say we ain't got time, just build the shitty version now. They'd say we need no downtime and to scale out
when load hits, and then when I built it properly, well, I don't understand how that's important to the
customer. Worse: the way they had us build it would obviously cause data-synchronization corruption. We
said here's how to build it right and how long it'll take, and they said fuck it, it's just a test, let's
ship it — then they GA'd it with the corruption. It corrupts data every day. That's what most of our time
is; we can't even add new features, we're fixing corruption all day. I warned that team they'd corrupt
data when I first started; they didn't listen, corrupted data for over a year, finally found the solution
— I said we should learn from them, and they didn't talk to that team. When I went and brought ideas back,
they said we don't have time to do all that, we gotta ship now. And then: we need these three features by
this date, and if you don't meet it you don't get your bonus or you get a bad review. One feature: add
support for a database Entity Framework doesn't support, get EF to support it, take our single-node cluster
and scale it out to multi-node — even though we accidentally created the database with single-key indexes
that aren't partitioned and all our queries don't respect partitioning — in a month. Oh, and we accidentally
ran it on a legacy technology, so you also have to migrate to a non-legacy technology before you scale out.
And I got all of that done in like a month and a week. And he called me late on it — well, you didn't
quite meet expectations. It's not somehow. I vibe coded it.

Aaron: My kids and that company's mission is awesome — they want to make white-collar people respect
blue-collar people, that's their whole mission. I can admit to you here now [that the culture was toxic],
but I wouldn't admit it out to a reporter and try to hurt their stock price. I don't even hold any of
their stock — the only stock I had was unvested, and that just evaporated when they fired me. And eight
months ago I was unjustly arrested for legal marijuana in my state, and while I was in jail I had money
leveraged and lost five hundred thousand dollars, and was later exonerated of all charges. You know what I
see it as? Fuel. Origin story fuel. I've never felt more alive in my life. Let's assume everything works
out and six months from now I'm in the same place making roughly the same — this whole thing was a gift.
My wish in my internal heart was to experience every experience, but not die — I didn't want to experience
death. So as long as I survive this, I'm getting my wish. Aaron: more to come
