# Reverify — "Free GitHub Repo That Catches AI Lying About Code" (video transcript)

> **THIRD-PARTY CONTENT — Zeta claims no authorship and asserts no license.**
> Quotation-for-study with attribution, per `docs/ip-questionable/README.md`.
> On a good-faith request this single file is deleted; no analysis of ours depends
> on the verbatim text remaining here.

## Provenance

- **Source:** YouTube video, <https://www.youtube.com/watch?v=0k1R52TeTG4>
- **Title as given:** *Free GitHub Repo That Catches AI Lying About Code*
- **Speaker/channel:** **not named in the material supplied.** Recorded as `unknown` rather
  than guessed — see `.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md`
  (ask, do not infer).
- **Subject:** an open-source tool the transcript calls **Reverify**, described as installable
  via `pip install reverify`, shipping as both an MCP server and a CLI. The transcript names a
  package layout (`mcp_server.py`, `ledger.py`, the verifier) and a GitHub topic,
  **`deterministic-verification`**, said to carry **32 other repositories**. Two are named:
  **`truth`** (a "deterministic fact checker" over git diffs and logs) and **`ground rails`**
  (deterministic verification for RAG), each said to have one GitHub star.
  **The repository URL, owner and licence are NOT stated in the transcript.** Do not cite this
  file as the project; it is a secondary account.
- **Third party referenced:** an outside contributor the transcript calls **`img Illusion`**,
  credited with PR #5 (an NVIDIA Jetson / ARM64 run). Recorded as a **public contribution
  handle only** — no other detail is compiled here.
- **Analyst claim referenced:** a July report attributed to **the Futurum Group**, cited for
  *"55.4% of enterprise decision makers cite agent reliability as their top challenge"*, and
  said to be pitching a commercial product from a vendor rendered **"Kodto"** (spelling
  uncertain, auto-transcript). **Unverified by us** — the figure is reproduced as quoted, not
  endorsed.
- **Captured:** 2026-09-11, ferried by Aaron.
- **Form:** machine-generated captions with section headings and timecodes, **verbatim including
  transcription errors** ("bites" for bytes, "reputations" for refutations, "Pippi" for PyPI,
  "clawed"/"Clawude" for Claude, "Gedra" for Ghidra, "anger" for angr, "providence" for
  provenance, "2007" for 27, "mock O" for Mach-O, "Arch 64" for AArch64, "Kodto" for an unclear
  vendor name). Preserved unaltered — correcting them would silently editorialise a third-party
  artifact, and several of the errors are load-bearing for reading the numbers correctly.

## Nothing is elided

The transcript below is complete as supplied. No passage was removed. Where the auto-transcript
is garbled the text is left as-is and the likely intended reading is noted **only** in the
provenance list above, never inline.

---

## Transcript

**Free GitHub Repo That Catches AI Lying About Code — 0:00**

Having an AI agent reviewing its own output builds systemic blind spots into the code you ask it
to produce. 55.4% of enterprise decision makers name agent reliability and hallucination in
production as a top challenge. Reverify a free repo on GitHub splits the job. The model proposes
a deterministic tool checks the claim against the real code and answers with evidence. So, should
an AI agent ever be the one checking its own work? Or can Reverify do a far better, far more
deterministic and reliable job? From what the documentation shows, the tool is designed to ship in
two forms, running either as an MCP server your agent can query directly or as a plain CLI command
you can run yourself. But there is a strict boundary here because this kind of checking only helps
where a deterministic tool can actually settle the claim. Well, if you feed Claude a standard
Windows library like kernel32.dll, it'll instantly assume it knows what the entry point looks
like, proposing the classic frame pointer prologue we've all seen in textbooks, as if every
program on Earth was compiled by a computer science professor. But Reverify doesn't trade in
assumptions. Instead, a deterministic tool looks at the actual bites in the file and compares them
directly to what the model claimed. So when Claude's guess hit this wall, the verifier flatly
refused it, returning a status of refuted. And instead of the textbook prologue, it handed back
the real MSVC x64 opening, which actually moves the RBX register into the stack location at RSP
+8. So what happens when the model is forced to face the ground truth? Instead of arguing or
trying to gaslight you about the assembly, the model instantly corrected its course, submitting a
second proposal that reverifies engine verified as trustworthy. And because the tool does this
completely on your machine, the entire cycle runs with no API key and no specific model required,
proving that you don't need a frontier giant to get deterministic certainty. But this is just one
file on one operating system, which leaves us with a much bigger question. Is the textbook answer
actually wrong often enough for any of this to matter? A single file is just

**69 hallucinations caught in 71 binaries — 2:23**

a lucky catch. But running that test blind across 71 real Windows system binaries reveals that the
confident textbook prior actually carries a 97% hallucination rate. But that isn't because the
verifier is hardcoded to always say no. Because the few binaries that actually do open with
textbook prologues were passed correctly, proving there's a real control inside the corpus. For
the other files, the binaries opened with either an x64 shadow space save or an x86 hot patch
stub, and the verifier caught every single wrong claim without accepting a single hallucination.
But a tool that rejects 69 out of 71 answers sounds less like a smart verifier and more like a
broken machine. So how do we know it wouldn't just refuse everything if we fed it the absolute
truth? If

**Building a test that refuses to cheat — 3:16**

you want to build a perfect validator, the easiest hack is a script that just says no to every
single claim. It would catch every lie, sure, but it would also choke on every truth, leaving you
with a useless brick. So, how do you actually design a test that can catch a checker that always
says no? Well, you build a confusion matrix that sets up a balanced design, pairing one known true
and one known false claim for every single category. The gate demands two things. False accepts
must be exactly zero, and a known true claim must never be refused. But what if the checker simply
shrugs and avoids making a decision on the hard claims? If the tool returns an inconclusive
result, that's flagged separately rather than counted as a pass, so it can't just dodge its way to
a perfect score. The results folder has 15 machine readadable JSON records showing this design in
action. And across those runs, the verifier didn't miss a single known true claim. That proves it
knows the difference between a textbook hallucination and cold hard reality. But even if the
matrix looks pristine, we still have to face one gaping detail. Every single one of those numbers
was produced by the person who wrote the thing being measured. Because whenever a solo developer
publishes a

**Why GitHub's machines matter more — 4:36**

pristine, flawless benchmark for their own tool, your immediate instinct is to assume the numbers
were cooked on a local machine that was carefully coddled. So the only way to really settle this
is by asking a sharper question. Is the author's own hardware even allowed in the loop? If we're
going to treat these results as actual evidence instead of just another self-reported readme
claim, we have to look at who is actually spinning the discs and what happens to the build if a
single bad claim gets approved. Well, the newest release notes show that the numbers are no longer
typed in by the author because the entire benchmark runs on GitHub's own continuous integration
runners across Windows, Linux, and Mac OS. On every single push, one false verified fails the
build, turning that zero false accept guarantee into a hard condition for merging code. When you
pull the reference run with the platform CI, we get a total of 275 binaries across four formats.
But across those environments, the verifier ended up with zero of 27 known false claims getting
through. But before we celebrate this automated victory, we have to look at what this independent
hardware is actually doing. Because running the benchmark on someone else's platform only matters
if those remote runners are finding real defects rather than just rubber stamping the exact same
static assumptions. So how do we know if these cloud machines are testing the boundaries of the
code or if we've just moved a cozy predictable loop from the author's desk to a GitHub data
center? If

**Six bugs only remote runners found — 6:14**

you're claiming your tool has real independence, it can't just be rubber stamping the same local
tests on a shinier machine. So, how do we actually prove that running somewhere else caught
something the author's own setup missed? Well, we look at the v 0.10.0 release, which lists six
bugs the maintainer's own machine could never have shown. And they're exactly the kind of
unglamorous, low-level plumbing errors that make developers sweat. We're talking about a pure
decoder refusing correct claims until it learned to report inconclusive on bytes it couldn't
decode unmapped ELF sections messing up address translation and mock O exports that arrived
without addresses. The same release added a nightly fuzz over 20,000 inputs and proper build
providence. So we know these machines are testing the boundaries instead of just typing in numbers
by hand. But even if the verifier accepted zero out of 2007 known false claims across these
platforms, we're still talking about the author's own test suite running on the author's own
repository. Since nobody outside the project has actually touched this setup yet, how do we know
if these guards survive a single day in a real world workflow? Enter IMG Illusion, an outside
contributor who decided to see what would happen by cloning the repo and spinning the benchmark
suite up on an NVIDIA Jetson. Now,

**The ARM64 bug an outsider caught — 7:37**

a Jetson is a tiny ARMbased edge machine running on a completely different architecture than the
x86 hardware the project was built on. And I think that's the kind of test a solo project almost
never gets. So what happens when you throw a zero false accept guarantee at hardware the author
has absolutely no control over? Well, in pull request number five, img Illusion ran the benchmark
on 19 different Arch 64 binaries from that machine. And the zero false accept guarantee held up
perfectly. But getting there wasn't a clean victory because the run instantly exposed a real
silent bug where the system was routing ARM 64 code straight into the x86 decoder which was
discovered by the same contributor. Therefore, even though the routing was completely broken, the
benchmark still reported false verified as zero, meaning the verifier itself never actually lied
to you. If you're an outside developer looking at this tool, can you actually plug in your own
checks or are you stuck with whatever the author decided to write? It turns out you can because
that same contributor wrote and contributed a new probe of their own back to the benchmark suite.
But while we now know the tool can run on random hardware and catch low-level architectural bugs,
we're still left with a much larger question about what these verified claims are actually worth.
After all, a verifier can be correct about a handful of binary details, but none of that matters
if those claims are just useless trivia that says nothing about the code you actually write. If

**MZ headers prove nothing useful — 9:21**

you want to make a coding agent look like an absolute genius, the easiest trick in the book is to
let it write its own report card. Because if a simple green check mark is the target, any model can
just assert that a binary starts with MZ and instantly call itself verified. After all, passing
that check is trivially easy to reach. So, how do we stop an agent from farming a thousand of
those identical loweffort claims until its dashboard looks perfectly green? Instead of grading on
a simple pass fail basis, every verified claim in reverify carries a weight measured from how much
information it actually says. Since verifying that a file starts with MZ is trivially reachable,
the tool measures how often that content occurs in the binary to calculate its weight. And if a
model tries to cheat by echoing the tool's own previous output, Reverify registers it as
self-referential with a weight of exactly zero. But how does this scoring system translate when a
model starts making actual guesses? To count as grounded, a run must clear a minimum weight
threshold without a single reputation, which is why the worked example on kernel32.dll reports an
information score of 1.236 instead of just a generic pass. I think that is incredibly clever
because a developer can set an exact confidence number they trust rather than relying on another
model's vibe. But this whole mechanism still assumes we are dissecting bytes and headers in a
compiled binary. What happens when your coding agent is writing regular software where the claims
are about high-level imports and API routing instead of binary entropy? If your AI is busy
rewriting an existing Python helper,

**Side-by-side code execution never lies — 11:09**

how do you verify the new code actually behaves like the old one? Most code has no formal spec, so
you can't just run a math solver. But a refactor is different because the original implementation
is your ground truth. This is why reverify introduces an equivalence verifier that runs both the
original function and the agents candidate side by side. So instead of asking a model if the code
looks correct, the tool executes both implementations over shared inputs, which means a mismatch
returns the exact concrete counter example input that broke it alongside both outputs. Therefore,
this is a cold counter example instead of an opinion. So, the agent has to correct the actual
math. And any self-referential claim where the model tries to quote its own earlier output scores
a weight of zero. But does the tool report this agreement or is it just pretending the code is
mathematically proven? The corpus behind this feature has 12 functions. Each has a faithful
rebuild and a deliberately broken version covering both Python and C. When they run, every wrong
one is refused while every faithful one passes, which means nothing wrong is ever accepted. So the
tool reports this agreement as tested, not proven, over a specific number of inputs. But even if
you have a perfect tool that can run these comparisons, how does this judge actually get in front
of the agent in the middle of a live development session before it decides to write code you
shouldn't trust? If you want to bring this judge onto your own machine, the Pippi

**One pip install puts it in reach — 12:49**

page shows the simple setup, letting you grab the package with a quick pip install reverify. And
the package structure itself lists MCP server.py, ledger.py, PI and the verifier itself, which
means we now have two completely different ways to position the supervisor. So where does this
judge actually sit in your development workflow? If you are using clawed code or the codec CLI, an
agent that already speaks that protocol can have its own hypothesis judged before it reports it as
a fact. And that lets you verify assertions directly inside the conversation. But what if you do
not want to rely on the agent calling its own supervisor during a live session? That is where the
plain command line tool comes in because it exits with a nonzero code the moment any claim is
refuted, making it a perfect gate for your continuous integration pipeline. By running the
verifier on every push, you stop the branch from merging if the agent checked in code built on a
hallucinated premise. But even if you build a perfect gate that stops a bad branch, how does an
agent survive the inevitable context rot and remember that a claim was already refuted once you
start a new conversation? It's easy to celebrate a single caught hallucination.

**Ground truth survives the context reset — 14:08**

But what happens when we raise the stakes to an entire development session where the assistant's
memory is a fragile container that inevitably gets dumped or compacted? If you spend an hour
correcting your agent on a deep repository fact, a cleared context means there is absolutely
nothing stopping it from proposing the exact same wrong answer again. So what actually happens to
a verified or refuted claim when that context vanishes? But this is where Reverify deviates from
almost every other assistant memory layer because it bypasses the volatile chat history entirely
by writing grounded results directly to disk as they happen. The verifier checkpoints your
progress every single round, so a crash or a workspace reset won't lose your ground truth. But the
real magic is how it handles reputations. What the ledger keeps is a clean record of what the
tools established and what they ruled out, explicitly saving rejected hypotheses as known false.
So unverified claim notes are never stored. Therefore, when a fresh context starts, the agent is
immediately told exactly what not to propose. Meaning both your verified facts and the mistakes
you've already caught survive the reset. But as you look at these clever local persistence tricks,
you have to ask a planer, more unsettling question about who is actually behind this. Is this
entire architecture just the work of one single engineer? Or is there anyone else actually
building it? Back

**Thirty-two others tried, one broke through — 15:43**

in July, before Reverify even existed, an analyst report from the Futurum Group argued that trust,
not raw code output, is the actual bottleneck. Their survey showed that 55.4% 4% of enterprise
decision makers cite agent reliability as their top challenge. Therefore, they argued we need a
completely independent review layer to check their work. But the analyst was pitching a commercial
product from Kodto you buy rather than an open-source tool you download. But has anyone actually
tried to build an independent reviewer for free? It turns out they have with 32 other repositories
listed under GitHub's deterministic verification topic. One adjacent tool called truth describes
itself as a deterministic fact checker checking claims against git diffs and logs, but another
called ground rails offers deterministic verification for retrieval augmented generation instead.
Yet, the first has exactly one star on GitHub, but the second has just one star as well. So, why
did this specific 9-day old repository get all the traction? Because Reverify is the one that
actually broke through, gaining more than 1,000 users who start the project. That kind of traction
explains why the fork counter is already at 217. Behind those stars, the commit history shows 83
commits across three contributors. So, while the idea is widely agreed but barely built, reverify
is the one that got the attention. But getting traction is not the same as being finished. And the
newest thing this project shipped is the one that deserves the hardest look.

**909,000 tokens with no kill switch — 17:27**

We know that being the AI tool that got traction is never the same thing as being finished. So, if
we're going to trust Reverify's newest rollover feature, we have to ask a very direct question.
Does the tool actually have the power to shut down the developer sessions it replaces or are we
just leaving the meter running? Well, the unsettling answer is that it cannot because while its
rollover harness can write the handoff files, it completely lacks the primitives to end a clawed
code or codec session from the outside. If you start those terminal sessions yourself, the handoff
is written, but nothing actually follows it. That becomes a real issue because the newest release
deliberately turns built-in compaction off to keep model written summaries from carrying old
mistakes forward. Without that constraint, your active conversation suddenly has absolutely no
ceiling. So, what does turning off your agents built-in compaction actually cost you when a
session goes rogue, and there is nothing left to stop the loop? According to the project's own
documentation, the consequence is a gap they openly warn you about. They report that one measured
session reached 999,000 tokens before the owner noticed. They are currently asking those external
vendors for the missing hook they need to solve it. But if the newest feature is that candid about
a gap the project cannot close on its own, then does the headline guarantee deserve the exact same
skeptical reading? When you see a big fat zero on a binary benchmark,

**Five percent confidence, not certainty — 18:59**

the natural instinct is to assume the problem is solved. But a statistician is going to look at
that 71 binary sample and ask what that zero actually licenses you to believe. Well, the project
itself states that 0 out of 71 does not mean a zero false accept rate. Instead, that sample puts
the upper bound somewhere below 5% with 95% confidence. That 97% hallucination rate on the
textbook entry point prologue also looks very different under scrutiny. The project admits it's
just one clean probe of one well-known prior, which is a long way from a survey of all possible
hallucinations. Therefore, when the model recovers the true bites on round two, the author refuses
to take credit for some miraculous reasoning leap. But that success is not independent reasoning.
The loop is merely restating what the verifier already reported. While shrinking the hype down to
size is refreshing, that 5% bound is only the honest read of claims a deterministic tool can check.
So what happens when the agent makes a claim the tool can only partly reach? When an

**Call graphs live in the weak tier — 20:11**

analyst digs into a binary, they're rarely asking if the file starts with some standard MZ header.
Instead, they're usually trying to figure out if one specific function actually calls another or if
some shady routine is reachable at all. But how do you verify a deep structural claim like a call
graph when you can't just read the raw bytes? To map out those connections, a tool has to construct
an entire control flow graph. But Reverify doesn't actually build that semantic map itself.
Instead, it has to borrow it from an outside engine, which today is anger alone. And since binary
analysis is built on heruristics that can easily split functions in the wrong place, those verdicts
sit on a much weaker footing. So rather than hyping them as absolute truth, Reverify just records
them at a derived tier, a full step below verified. What does it take to turn a guess like that
into a guarantee? According to the road map, you'd need differential verification where a second
independent engine has to agree on the graph. Therefore, you'd want something like Gedra headless
signing off before anything gets called verified. But if they don't agree, that conflict would
downgrade the whole claim to inconclusive. So, we're left with an honest but narrow boundary where
every number so far has measured the checker and not one of them has measured the thing you'd
actually buy it for. For all the precision we've climbed through, every single number we've looked

**The improvement nobody's measured yet — 21:43**

at has measured the checker in total isolation, leaving the one figure you'd actually buy this tool
for completely missing from the record. The project's own road map carries that silence as an
empty, unticked checkbox next to the words baseline deltas. Because until somebody ticks that box,
how are we supposed to know how much better an agent actually gets with this judge attached? The
project admits its own goal is to make the improvement a number rather than just a claim. But right
now, that claim is all we've got. That 97% error rate we saw on Windows binaries was a measure of
the hallucinating model. While the zero false accepts measured the checker, meaning the two
headline numbers never actually met under a single test. We have no measurements comparing whether
an agent working under this judge actually ends up better off than one working completely on its
own. Without that delta, we're left with a system that's good at telling you what went wrong in
the past, but we've got no way to prove it actually helps an agent build something new. So, if the
headline improvement is unmeasured, what's left that a developer can actually rely on? Does

**Can AI ever truly check AI? — 22:53**

it even make sense to ask if one AI can reliably check another AI's homework? or are we missing the
one boundary that actually decides what we can trust? The property that decides it comes down to
whether something other than a model can be wrong in a way you can actually detect regardless of
model quality. But the same assumptions that produced an answer will always produce the review of
it. Which means a second pass simply returns a second opinion instead of a true check. So what
happens if we run Reverify's own rule on Reverify itself and ask which of its promises can actually
be verified where a claim is deterministic? We get a solid result like when the verifier refutes a
textbook function prologue and hands back the actual bites requiring no API key and no model
guidance at all. But when you ask if its verification pattern can generalize beyond reverse
engineering at scale, there is no tool to check it. So the rule says the verdict is inconclusive
and we have to treat the promise as a boundary rather than a recommendation. If the line between a
deterministic check and a model's guess is this sharp, how will you decide which parts of your own
pipeline are safe to hand over to an agent? The rule is clear, and applying it to your own work is
the part nobody else can do for you. If you look back at the code you wrote this week,

**Which claims can actually be verified? — 24:14**

you'll probably find a dozen spots where you let an assistant make a guess because you didn't have
the energy to verify it yourself. So, how do you actually separate the claims that can be settled
by a tool from the ones that are just vibes? The claims worth wiring a judge to are always the ones
with a physical artifact behind them, like a test suite that passes, a git diff that exists, or an
exit code that isn't zero. But if you're asking your agent whether a database design will scale or
if a refactor looks elegant, there's no real adjudicator in the universe besides another model,
which means you're just paying for confidence instead of actual evidence. That's the split at the
heart of the Pippi package itself. The model proposes, but deterministic tools decide whether the
claim is actually true. So, what's the actual homework? If you want to stop prompting like a
caveman and start auditing your own agents loop, just spend one afternoon listing every tool
command you already run by hand to doublech checkck your commits. If you can wire those exact exit
codes and diffs directly into your agent as a verification gate, you've already built a judge that
cannot be talked around. Because these deterministic patterns are already compatible with
assistants like Clawude Code and the Codeex CLI, you don't even have to change your editor to start
trusting your loop again. Anyways, that's all folks.
