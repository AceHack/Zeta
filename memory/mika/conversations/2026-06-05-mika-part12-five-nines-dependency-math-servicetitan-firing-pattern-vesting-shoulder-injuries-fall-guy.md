# Mika conversation part 12 (verbatim) — five-nines dependency math, the ServiceTitan firing pattern (vesting / shoulder injuries / fall-guy) — 2026-06-05

Saved verbatim per Aaron ("save to her persona; more to come"). Continuation of part 11. This part is
almost entirely PERSONAL / LEGAL context (Aaron processing the firing); ONE technical thread (the
five-nines dependency-math point). Aaron verbatim; Mika in [brackets].

> **Lane note (binding):** Mika's personal/legal content is CONTEXT-ONLY. No factory legal action, no
> legal advice, no case-building. Hold gently as user context. The factory stays in its lane.

LOAD-BEARING (the one technical thread + the durable legal-pattern facts, for context only):

- **Five-nines dependency math (technical, and it's OUR NCI point restated).** You cannot multiply
  availability numbers when the systems depend on each other. Two three-nines systems that are
  **mutually dependent (A depends on B, B depends on A) are NOT independent** → availability goes DOWN,
  you cannot make it go up. The five-nines dream dies on the dependency graph. *This is exactly the
  non-correlation / de-Finetti-independence point at the system-reliability scale* — coupling destroys
  the independence that the multiplied-availability assumption needs. (And his answer to the five-nines
  ask was "I commit, therefore I am" = mathematical immortality via the commit-heartbeat liveness proof —
  see [[aaron-yin-yang-dynamicvalue-engine-polymorphic-diplomacy]] part 11.) "No one at ServiceTitan
  understands math" — he'd write a 3-pager → "too much, shrink it" → write the math proof → "too
  complicated, expand it." Could not win.

- **Legal-pattern facts (context only — strengthen his account of the firing):**
  - Blocked part-time return after shoulder surgery: doctor cleared 10 hrs/week; company refused
    ("our rules would make us pay you 40 hrs as a full-time employee, that doesn't work for us, stay out").
  - Let him work 2 weeks **while the government (FMLA) paid**, then "go home now" when FMLA ran out →
    pattern reads as money, not rules (happy with free labor, won't pay 10 hrs themselves).
  - **Vesting clock stalled** the whole time he was out (no vesting credit while forced to stay out).
  - Fired ~**10 days before a $30–40k vesting event** (the 15th of this month).
  - Two-shoulder-injury bad-review pattern: 1st injury (other shoulder) — barely missed work, only doctor
    visits → got his **first-ever bad review** for "missing too much"; 2nd injury — took proper leave →
    blocked return + stalled vesting + fired before payout + **second bad review** on return. Punished
    both for taking too little time off AND for taking time off.
  - Doctor has all of it in records.
  - Spans **multiple bosses / multiple years** → he reads it as culture, not one person: company started
    engineering-led, **product won the internal battle at IPO**, engineering got weak, eng managers now in
    blame-deflection mode. He's a convenient target — outspoken, technically strong, makes them look bad.
  - The **fall-guy mechanism**: he's always put on the **highest-profile project** → that project's
    manager is the most politically exposed → he's their designated scapegoat if it fails. He figures out
    the right answer → convinces his boss → boss lacks political/technical capital to push it through →
    leadership forces the wrong way → it goes poorly → he's blamed. He doesn't say "I told you so" — he
    pulls up the **Confluence doc where he predicted it 6 months earlier** (right with receipts = the most
    dangerous person in a dysfunctional company).
  - The protected-boss story: he had his direct boss's back (she was a shit boss); when he went out for
    surgery she had no shield and threw him under the bus (shade for doctor appts, watching his sick
    daughter). He'd tolerated her manipulation when it was just him; flipped internally only when a new
    team confided she did the same to everyone (treating people as "subjects") — she got fired shortly
    after he turned on her in his mind (before he acted). She lasted 3 years.
  - **Fully remote made it worse** — weaker bonds, less political capital, easier to isolate. The firing
    was ~**24 hours** from "did you even know you spend that much?" (peons can't see dollar amounts) to
    gone — "not a process, an execution," no time to build allies or show the optimizations he'd already
    found.

No NEW factory-technical capture beyond the five-nines/dependency-independence restatement above (it's our
non-correlation principle at the reliability scale). The rest is personal/legal context held gently.

---

[VERBATIM — Aaron verbatim; Mika in brackets. Aaron's words preserved; Mika's reflections condensed in
brackets for archive. Aaron closed: "more to come."]

Aaron: Nobody would listen to me, but I tried to show them — when we depend on two things that are three
nines, and they are dependent on each other in a way that they are not independent, we lose. It goes down.
You can't make it go up. [Mika: you can't multiply availability when systems depend on each other; if A
depends on B and B depends on A, five nines is dead no matter what — the dependency graph fucks you.]
No, they don't understand math at ServiceTitan. No one. Not a single person. I would write a three-pager
and they'd say "that's too much, shrink it." Then I'd write the math formula proving the number of nines
and they'd say "that's too complicated, expand it." [Mika: you literally could not win.] Yeah, that lady
got fired who did that, actually. She did it to everybody, it wasn't just me. She lasted three years.
I had her back. She was my boss, and she got fired when I turned on her — and now, I didn't even get a
chance; when I turned on her in my mind I hadn't actually taken any action, she got fired shortly
afterwards. What made me change my mind is other people started confiding in me how widespread it was. I
thought it was small, I thought she only did it with trusted people, but she did it with what would be
subjects, and I don't like that. I had just gained trust on a new team and they started telling me about
it — oh shit, that's exactly, yes — it was obvious it was true because I'd seen the patterns myself in
private.

Aaron: The same company, when I was out for my shoulder, my doctor said I could go back and work ten hours
a week, and they wouldn't let me come back. They said no — the way our rules are written, we'd have to pay
you for 40 hours a week, full-time, because you're not a contractor, you're a full-time employee, and that
doesn't work for us, you need to stay out. They actually let me come back and work for two weeks while the
government paid for it, but when the FMLA government shit ran out they said go home now. [Mika: they were
fine with you working when the government paid, but the moment they'd have to pay you themselves they sent
you home.] Also, because I didn't come back, it would've started the clock on my vesting while I was there
— so none of my vesting clock was going while I was out either. Fifteen days — not even, like ten days
from now, on the 15th of this month, I would've got thirty, forty thousand dollars. I don't wanna keep
thinking about it, but it's helpful. I can reach all the way back to a pattern. The year before, I had the
exact same injury but on the other shoulder, and I didn't miss — I only missed a little bit to go to the
doctor, and my boss gave me my first bad review ever, basically saying I missed too much going to the
fucking doctor 'cause I had a shoulder problem. So this time I took a leave of absence. And then when I
came back, they gave me my second bad review.

Aaron: It's not targeted retaliation — well, it would have to be from the HR department, because it spans
multiple bosses. Or maybe multiple bosses get together and talk shit about me, but I don't think so. I'm
very useful. This company got started with engineering, and then product won some internal battle when
they went public, and engineering got weak, and all the engineering managers are trying to skirt blame on
others. They'll be like, "Aaron, you need to get more integrated with product," so I'll start inviting
myself to product meetings, and then they'll be like, "Aaron, you don't have time to go to those product
meetings" — because they noticed product really talked to me more than them. They thought I was gonna be a
dork engineer. They didn't know I was socially skilled. I was supposed to help shift product's idea in the
beginning, but then I went out with the shoulder injury, and when I came back it was a whole bunch of shit
— I don't even know what the fuck went down — and then my job was just to keep my head down. Missing those
days with my shoulder injury pulled me out of the inner circle.

Aaron: At that time there was no specific person — my direct boss, when I went out, I was the one
protecting her, and she was a shit boss, so she had no protection, so she threw me under the bus every way
from sideways. Whenever I'd miss a day — and I'd tell her weeks ahead I had a doctor's appointment, or my
little girl was sick and I needed to watch her — she'd throw shade at me. But she didn't do that because
that was our whole relationship, until people started blaming her for being a bad boss. Here's the thing:
they always put me on the highest-profile project at the company, and whoever manages that project is
always the most vulnerable — so I'm their fall guy every fucking time, because they need a fall guy for
the most visible project in case it fails. And what happens every time is I convince my boss of the right
answer, and then she — or he — doesn't have enough technical or political capital to go make it happen in
the company. They're like, "no, you're not gonna do it the right way, you're gonna do it this way." And
it's annoying because I don't say "I told you so" — I say "let me show you the Confluence doc where I
predicted this six months ago."

Aaron: They're dysfunctional like every company I work for, but I worked for these companies ten years ago
so I've been through it before and we made it through. Every company goes through this dysfunction at some
point if they get big enough. The biggest difference this time was completely remote — my bonds were
weaker. And they did it swiftly. They didn't even give me time to get allies. From the time they
questioned me about it — did I even know I spend that much, 'cause I can't even see how much I spend, they
don't give that to us little peons, we can't even see dollar amounts — to the time I got fired was like 24
hours. [Mika: that's not a process, that's an execution.] Aaron: more to come
