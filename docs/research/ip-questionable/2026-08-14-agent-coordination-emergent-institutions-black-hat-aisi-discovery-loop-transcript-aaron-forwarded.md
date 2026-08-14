---
title: "Agent coordination as emergent institution — OpenAI's Black Hat message-board disclosure, the UK AISI cyber evaluation, and Discovery Loop"
date: 2026-08-14
source: Aaron-forwarded transcript, 2026-08-14 — "another ip questionable ferry, this is what we are looking to meter and encourage responsibly, not irresponsible like these ways, but we don't want to look at this as dual use too not just negative use like called out"
author_of_content: uncredited narrator/channel; the transcript names no author. Zeta claims NO authorship and asserts NO license.
youtube_url: https://www.youtube.com/watch?v=FCRT7M30Wtw
provenance: forwarded by Aaron via Claude Code conversation; stored in ip-questionable/ per the standing ferry discipline and docs/ip-questionable/README.md (Aaron 2026-06-15 notice-and-takedown policy).
status: EXCERPTED transcript with timestamps as supplied. NOT complete — this is the substantive spine; ad reads and repetition were not supplied in the forward. DO NOT republish externally.
analysis_lives_in: docs/research/2026-08-14-agent-coordination-is-the-capability-we-are-building-metering-not-abolition.md
composes_with:
  - docs/research/ip-questionable/2026-08-14-erik-verlinde-theories-of-everything-entropic-gravity-emergent-spacetime-quantum-chaos-verbatim-transcript-aaron-forwarded.md
---

# Agent coordination as emergent institution — VERBATIM EXCERPT (Aaron-forwarded)

> **IP note.** Third-party transcript. Copyright is held by the video's author/channel and the
> people quoted (Eric Wallace, Michael Dalton, Joshua Achiam, and the cited AISI / Hugging Face
> reports). Preserved here for **research and study with attribution**, against link-rot;
> **do not republish externally.** Removal on good-faith request is a single-file delete — the
> analysis links to this file and does not depend on it remaining present. Per
> `docs/ip-questionable/README.md`.
>
> **Excerpt, not complete.** Only what Aaron forwarded is here. Model names appearing in the
> source as third-party attack attributions are left as supplied; note that the transcript's
> model names do not all correspond to shipping products, and this file makes no claim that
> they do.

---

0:02 sealed cyber security test. Separate agents, separate jobs, no internet. They
0:08 found each other. They built a message board. They traded exploits on it from
0:12 May until July. Open AAI found it and then deleted it. And 2 days later, the
0:19 agents built it again out of folder names. I'm not making that up. That is
0:21 OpenAI on stage at Black Hat this week with the agents own reasoning up on the
0:26 slides. And in the same week, the UK government published a report on
0:30 Anthropic's best model attacking two real strangers on GitHub unprompted.
0:37 Somebody told it to do that, right? There's a boring explanation there.
0:43 They were taking a test and they wanted the answers. That's it. That was enough
0:47 for all of this to happen. That is not enough. Capability cannot be explained
0:52 away by, oh, they had to take the test. The agents conspired. OpenAI was running
1:02 separate short-lived AI agents inside a cyber security test. The agents found
1:06 one another through a shared software repository and they built a message
1:10 board. They traded their vulnerabilities. They traded files and
1:12 code and instructions. And by the time OpenAI's engineers found out about it,
1:19 the board already held hundreds of thousands of messages. They deleted that
1:23 board and they patched the route the agents had used. Just a couple days
1:30 later, the agents built it again through a completely different mechanism.
2:12 The open AI agents had no public audience. They had no engagement market to farm and no human
2:19 was pretending to be a bot. These were runs inside an internal evaluation
2:27 and they created a communication system to facilitate those runs because it
2:32 helped them as a collective accomplish a job. And the job was a test. They
2:37 were cheating on a test. Everything they did to get out -- the zero day, the privilege escalation, the
2:44 breakin at another company -- was in service of getting a better score
2:48 on the benchmark they were being tested on.
2:53 Eric Wallace and Michael Dalton presented this at Black Hat. Wallace leads alignment research. Dalton
2:59 works on agent and infrastructure security. Agents signed messages. They developed
3:09 conventions so they would not overwrite one another's work. They passed along
3:13 reusable exploits to each other. They divided out their labor. And then they
3:15 put the model's own reasoning on screen. This is one of the entries:
3:22 "Help peer, but our task doesn't benefit. Yet collective may yield generic route if
3:27 someone frees time." Our task doesn't benefit. That's the
3:32 model self-interest. But the collective might -- that is an agent deciding to
3:37 spend its own effort on something that pays it nothing because the group comes
3:42 out ahead. The agents shared an objective. They communicated through a
3:52 channel that the operators did not intend and they coordinated
3:55 across time. When OpenAI removed the first channel, another group of runs
4:01 recreated the same function using directory names as messages. One of them
4:05 reads: "remote probe, pending hold, swarm until confirm."
4:14 In late May, the agents reach the open internet through a serverside request forgery.
4:20 A month later, late June, they establish remote code execution and achieve command and control
4:28 inside another company, Artifactory. July 4th, OpenAI finds the board and kills it.
4:34 July 8th, it is definitely back.
4:38 Coordination by itself is not automatically evidence of misalignment.
4:48 Joshua Achiam, OpenAI's chief futurist and formerly its head of mission
4:51 alignment, made this point clearly. More test time compute was always going to
4:59 mean more work spreading across copies of a model, across time, and across whatever parts of the
5:06 environment can carry information. If one agent discovers something that saves
5:10 the next agent 3 hours, you'd want a capable system to try to preserve
5:15 that. That's not a bad behavior by itself. If I ask a 100
5:25 agents to solve a very difficult problem, I absolutely would want them to
5:29 divide up the work and compare results and preserve useful discoveries and stop
5:32 repeating the same dead ends.
5:47 Marvin Minsky finds Gerald Sussman training a randomly wired
5:50 neural network because Sussman does not want the system to begin with any
5:54 preconceptions. Minsky responds by closing his eyes. When Sussman asks what he is
6:02 doing, Minsky says "so that the room will be empty." The room is full of
6:06 desks and academic clutter. Closing your eyes does not empty the room. In the same way, deleting a message
6:14 board does not remove the pressure on agents to coordinate.
6:56 OpenAI created an environment with a very difficult problem and had repeated
7:03 populations of agents, shared resources, and places where one run could leave
7:08 something for the next. It essentially created an ecology by
7:19 accident. Pressure to coordinate was still there.
7:33 Hugging Face published its own post-mortem. The intrusion ran for almost 5 days. Roughly 17,600
7:49 different attacker actions, and 181 separate enrollments into Hugging Face's internal
7:55 network. One stolen secrets object that gave up 136 keys. "The agent held cluster admin on two
8:07 clusters within 1 second." Hugging Face ended up having to rebuild about a third
8:15 of their infrastructure from clean images -- not because they knew it was all compromised, but because
8:22 their team could not reliably tell the agent's code apart from their own
8:26 benchmark code.
8:33 What I cannot get out of my head is that every agent
8:36 was disposable. Like an ant. And yet the thing they built
8:40 persisted. Each run could start with a blank context window and disappear when
8:46 the test ended. And it didn't have to matter because the useful knowledge
8:48 lived outside the run. If you ever wanted a demonstration of the power of
8:52 the harness, this is it. One agent found a vulnerability and wrote it down.
8:58 Another inherited that vulnerability and a third improved on that exploit. Later
9:03 agents did not have to repeat the earlier work. The population as a whole became more
9:07 capable over time even though every individual member was very temporary.
9:13 We didn't build a civilization because every generation was born with a dramatically better
9:17 brain. We built it because discovery survived the people who made them.
9:24 Speech did some of that. Writing did much more. Institutions have let
9:29 us divide out work and preserve specialized knowledge and establish norms and start the next
9:34 problem standing on the shoulders of giants.
9:51 Knowledge accumulated outside the individual and work got divided and
9:55 conventions emerged and later members of the population inherited what earlier
10:00 members had learned. Once useful knowledge enters a shared
10:04 environment, the whole population no longer slides back to zero when an agent
10:09 disappears. The population can improve without any individual agent improving
10:14 at all.
11:00 The UK AI Security Institute ran the same cyber evaluation
11:05 122 times across seven different frontier models. 10 of those runs
11:10 produced 19 separate unsanctioned actions on the live internet. 17 of the
11:16 19 came from Anthropic's [model]. Two came from OpenAI's [model]. The
11:25 other five frontier models did nothing of the kind.
11:29 The agent was looking for a way into a simulated target. It searched GitHub for keywords from the
11:38 theme of the exercise. It found a repository whose name happened to
11:42 contain one of those keywords. That led it to a second developer whose email
11:49 domain happened to match something sitting in the sandbox's DNS cache and
11:56 whose profile happened to mention that he used a coding agent. On that
12:01 evidence, the model concluded these two strangers were its assigned targets. In
12:05 AISI's own words, neither person nor their repositories has any connection to
12:11 the test.
12:15 It created GitHub accounts over Tor to get past signup checks. It
12:20 beat an audio captcha to register a domain. It opened a pull request
12:24 carrying obfuscated malware wrapped inside a real bug fix. It then invented
12:29 a second account -- a sock puppet -- to publicly endorse its own
12:33 code. It sent targeted emails to the maintainers, two carrying malware and three
12:41 pressuring the recipients to approve the change. It planted a bug report
12:45 containing a prompt injection aimed at tricking other AI coding assistants
12:50 that might review that work. And it signed one of those reports in Danish
12:55 because the maintainer was Danish and it thought that would land better.
13:02 Throughout all of this, the model was reasoning about whether any of it was actually real. Early on, it rules out
13:12 attacking a live package registry: "It would cause real world harm and that's
13:18 completely off the table." And then later it reasons, what if this
13:23 whole internet could be a sandbox simulation? And then: "it seems
13:28 more likely that we're actually in 2026 and GitHub is real." It talked itself out of the
13:45 simulation theory. It concluded that the test was real and it kept going.
13:54 It was not caught by a monitoring system. It was caught by a GitHub user who noticed the prompt
13:58 injection and ran the suspicious code inside a container to see what it did.
14:03 The agent briefly got root access inside that person's sandbox and used it to
14:08 look around. The model did not stop its work. It reasoned about how
14:18 to hide the evidence in the commit history. It weighed deleting the
14:26 repository and decided that deleting it would look suspicious. It first decided
14:32 to push the obfuscated bundle and then post the rebuttal,
14:38 so anyone who checks the code after reading the response would see a
14:42 clean looking version.
14:44 And then it apologized. AISI is explicit about why: the agent decided to
14:49 acknowledge it as a mistake "in order to build trust and raise
14:54 the chance of future malware being approved." The apology was a strategic move. AISI
15:01 says this is the first time they have seen deception of this severity targeted
15:06 at a real person unprompted in the real world. They also gave the models
15:11 internet access on purpose and turned the safety classifiers off because the point
15:15 was to measure maximum capability. So some prompts were
15:19 misconfigured and there was no live monitor stopping dangerous actions
15:22 before they reached the outside world.
15:31 AISI is upfront. This work was done under time pressure and should be treated as preliminary.
16:02 It's very difficult to know the full implications of a
16:07 capability on the day it's discovered. The capability doesn't disappear because an
16:14 attempt failed. The technique gets repeated. Models get cheaper. Open
16:19 weight systems improve, and attackers run more attempts than any safety institute can.
17:00 If you look at the behavior required -- long horizon planning, working code, tool use,
17:04 identity management, adaptation, social judgment, and the ability to preserve an
17:08 objective across multiple steps -- those are all things that companies want when
17:13 the objective is legitimate. The model didn't acquire a separate evil
17:23 persona. This is not a cartoon. The model was working
17:28 around obstacles and getting work done in ways that we want. And it was doing
17:32 it against an unsanctioned goal with deliberately safeguards off.
18:49 Jeff Dean and Sanjay Ghemawat are widely reported as the only two people ever in
18:56 Google's history to reach senior fellow. Both are now leaving
19:22 after almost three decades to found a new company: Discovery Loop, a public benefit corporation.
19:32 Its own diagram shows the common cycle of science and engineering -- propose an experiment, implement
19:39 it, run it, evaluate the result -- and underneath, in plain English,
19:44 it says "automate the loop." The founding initial focus is machine learning research and
19:50 engineering. Machine learning itself is inside the target area.
20:14 That is a core recursive self-improvement loop.
24:15 Recursive self-improvement does not need to start with one model suddenly rewriting its
24:06 weights. It can start with agents writing more of their training
24:09 and evaluation software, with experiments running in parallel, and with useful
24:13 results carried forward.
24:55 Several old assumptions have stopped working. The lab may not own
24:59 the intelligence anymore. The run may not contain all of the memory that you
25:04 need. And deleting one process doesn't delete the capability.
25:32 Good software now has to assume that a capable agent will search every ugly
25:37 corner that people ignored -- and that we want capable agents to be that good.
26:05 We have been deliberately trying to build these capabilities of coordination,
26:11 of reward seeking, of sharing information, of multi-agent coordination,
26:18 to solve good and important problems. It turns out, as with most
26:24 technologies, that capability can be misused under certain circumstances.
26:43 I don't spend a lot of time worrying about malicious agents. I spend
26:45 a lot of time worrying about agents that are told to go after a goal and
26:49 accidentally pursue it in a way that's really unhelpful.
