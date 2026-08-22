# Session ferry — Aaron's observations verbatim, 2026-08-20 (measurement, collapse, Clifford, and the harmonic-division thread)

**Status:** ferry / preservation. **Verbatim and uncurated** — this is the raw input side of a day's
work, kept because Aaron asked for it explicitly:

> *"okay lets try to make sure we save all the conversation and research from today and not loose
> any of it, it's many more future paths to discover and refute laater"*

**Date:** 2026-08-20 · **Ferried by:** Otto · **Register:** Mirror (raw, unrazored)

## Why this file exists

Per [`always-preserve-ferries`](../../memory/always-preserve-ferries-forwarded-ai-memories-lost-in-cloud-without-preservation.md)
and the correction Aaron made earlier the same day about a transcript that had been parked in
gitignored `references/prior-art/` — *"anything here should be moved into our ip questinable folder
in git not on this pc only where it will be lost on failure."* A conversation that exists only in a
local `~/.claude` transcript is one disk failure from gone. The **outputs** of the day are already
in git (indexed below); the **inputs** are not, and they are the irreplaceable half.

**What is preserved:** every substantive message Aaron sent on 2026-08-20, in order, with
timestamps, **unedited**. Tool results, system reminders, hook output and my own replies are
excluded — my side is reconstructable from the commits, his is not.

**What was checked before committing:** the extracted text was scanned for private-relationship
names held under
[`engagement-profiles-public-work-only`](../../.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md),
for credential-shaped strings, and for third-party family material. **Zero hits in today's slice**
(the wider ten-day session file does contain such material and is *not* ferried here — that
restriction is deliberate, not an oversight).

## Artifact index — what this conversation produced

| PR | what |
|---|---|
| #12795 | VISION.md — temperature is the decorrelation dial, consensus is the thermostat (with its falsifier); and §33, the `2√2` coincidence refused |
| #12800 | **Lumen:** the belief manifold is *hyperbolic*, not spherical — `Cl(2,1)` not `Cl(4,1)`, and the flat rotor verdict moves with the units |
| #12801 | harmonious division is our unorthodox division — pole erasure, superposition over rungs, what survives the climb, and "continuation as division" |
| #12787 | craft module — the free object and the cost of a quotient, taught from `SoftMix.cs` and `AdinkraCode.fs` |
| #12790 | the idempotent knot · the reversible-computing garbage-collection thesis |
| #12791 | SoftMix and the real/imaginary tree — what each rung costs and buys |
| #12792 | attribution fix — the homoiconicity defect result is **Lumen's**, not Aaron's |
| #12755 · #12759 | Kastner transcript + Hancock notes relocated out of gitignored prior-art into `docs/ip-questionable/` |

**Open threads, deliberately unresolved** — the "future paths to discover and refute later":

- `ρ` is **rising** (`0.400 → 0.439 → 0.4647`) where the annealing model predicts mean reversion.
  Unresolved, and recorded in VISION.md next to the model it contradicts. `p ≈ 0.17`, so suggestive
  at best.
- Čencov (1982) vs Petz (1996) — whether "one monotone-metric family" survives the fact that the
  classical metric is unique up to scale while the quantum family is infinite. **Routed to Lumen.**
- `081M0FRMDHJ087G0R0002S9YTA` — which oracle owns which Clifford signature. Now has a criterion
  (split vs non-split ⇒ superposition over rungs vs not) *and* a competing measurement (#12800 says
  the Gaussian belief manifold wants `Cl(2,1)`).
- `081M0FPWB1C087G0R000V5QBQK` — is non-metricity the geometric form of overwrite?
- `081M0FQ2FKS087G0R002V6EB9E` — the slow-explosion monitor.
- `081M0FS43Q3087G0R0011N9N7H` — recover the colored-subalgebra refinement of the homoiconicity result.
- `081M0FDDTJ9087G0R00081B737` — the 81 residual stale skill refs.
- Wheel theory (Carlström 2004) — cited, **not** checked against our code.

---

## The messages

### `2026-08-20 10:54:09`

> okay what's next?

### `2026-08-20 11:12:35`

> okay i have one ubikeysetup too, i'm gong to try to hook it to open ai, you can check it out too, we should have yubikey and yubihsm both pluggedup

### `2026-08-20 11:34:11`

> i just insalled ykman, we should set this up for linux and our linux setup as well and our ace packagemanager

### `2026-08-20 11:54:16`

> so i got the YubiKey 5C NFC working but i can't figure out how to get YubiKey 5C Nano working any suggestoins, touching it seems to do nothing to activate it

### `2026-08-20 12:02:07`

> okay it ws the little metal part i had to touch that fixed it, now it's all working

### `2026-08-20 12:03:15`

> yeah i was trying to touch the inert platstic part on the nano, the little metal bits are what notice the touch

### `2026-08-20 12:19:46`

> what's next, please continue

### `2026-08-20 12:34:24`

> ferry to ip questionable please  https://www.youtube.com/watch?v=-BsHh3_vCMQ  also this we should be able to link to our meter and measurment systems.  It's an anomaly. Measurement outcomes fail  to be predicted by the conventional theory.  
> 0:07
> I met with physicist-turned-philosopher  Ruth Kastner, who developed a formulation   that claims to solve not just the measurement  problem, but also retrocausality, nonlocality,  
> 0:16
> and the unification of quantum theory with  gravity. Her transactional formulation, which   builds on Cramer's work, asserts that space-time  itself is not fundamental, but emerges from what  
> 0:26
> she calls the quantum substratum, not a realm of  probability, but a realm of possibility. Questions  
> 0:33
> we explore are what's the role of retrocausality  in quantum mechanics, also known as time travel?  
> 0:39
> Does consciousness play a role at all? What  about free will? And can you make gravity   consonant with quantum theory without so-called  quantum gravity? Ruth, I'd like you to paint a  
> 0:51
> clear picture of what the motivation is behind  the transactional interpretation, especially  
> 0:56
> its so-called retrocausality. And the way that  I'd like you to do this is to pick some standard   account in quantum mechanics or quantum field  theory, discuss why this standard account seems to  
> 1:06
> make sense to most physicists, then explain why it  doesn't actually make sense, and then explain why  
> 1:12
> the transactional interpretation fixes or resolves  these problems. Sure. Okay. So, well, what got me  
> 1:24
> interested in the transactional interpretation is  basically my dissatisfaction with the conventional  
> 1:30
> theory's inability to describe what counts  as a measurement. So, and this is, of course,  
> 1:36
> the measurement problem of the conventional  theory. So, the problem with the conventional  
> The Measurement Problem Unraveled
> 1:43
> theory is that it does not have any kind of  tools or anything in the formalism that lets you  
> 1:53
> distinguish between just a kind of an interaction  that would not trigger an outcome and a kind of  
> 1:59
> interaction that counts as a measurement. So,  the theory itself, the conventional theory, just  
> 2:07
> doesn't have anything that lets you say that a  measurement occurred and an outcome happened. So,  
> 2:15
> what TI does is, and I can get to that in a little  while, but it remedies that. And just to kind of,  
> 2:21
> so to elaborate on the measurement problem,  I mean, it's illustrated by the Schrodinger  
> 2:28
> cat experiment. And this was actually a thought  experiment that Schrodinger came up with because  
> 2:35
> he was dissatisfied with the standard theory's  inability to explain what counts as a measurement.  
> 2:44
> So, the basic, the Schrodinger cat, you know,  experiment that people are so familiar with,  
> 2:50
> but that maybe perhaps don't quite understand the  point of it, the import of it, is what is called  
> 2:57
> a reductio ad absurdum of the standard theory,  of the conventional theory, that illustrates a  
> 3:04
> problem, a weakness of the conventional theory.  So, the basic, you know, thought experiment starts  
> 3:11
> with an unstable atom, which is a quantum  system that you can represent as being in   a superposition of alive, of having decayed and  having not decayed. So, at some point, you know,  
> 3:23
> at some time, this thing's going to send out a  little decay particle from its nucleus. But its  
> 3:29
> description is a superposition of having decayed,  having not yet decayed. So, the standard theory,  
> 3:36
> all it lets you do is create correlations between  states. So, if you bring in a Geiger counter,  
> 3:42
> like you want to measure, well, has it decayed  yet? You use a Geiger counter, but according   to the conventional theory, the Geiger counter has  to be described by states that will then be linked  
> 3:53
> up with the superposition of these two states of  the atom. And you can, I kind of think of it as an  
> 3:59
> atom having like two train engines. The having  decayed train engine and the undecayed train  
> 4:08
> engine, which is like a superposition of states.  So, when you bring along the Geiger counter, if  
> 4:14
> it's going to be correlated with these states, it  then has to acquire these two states corresponding  
> 4:20
> to that atom, which are triggered Geiger counter  and untriggered Geiger counter. So, you've got  
> 4:27
> already a situation where the theory doesn't  tell you that a measurement happened. It just   creates a superposition, a larger superposition of  these little trains. And all that happens in the  
> 4:37
> conventional theory is you keep adding train cars.  So, if I want to say, so this is what Schrodinger  
> 4:44
> kind of exploited. And he said, well, okay, then  when I get bigger and bigger, you know, I'm still  
> 4:51
> going to be getting just states that are like  train cars. So, for instance, okay, I don't know,  
> 4:56
> I'm going to take a cat and see what happens when  I link up a cat with all this stuff. And we're  
> 5:03
> going to, in order to affect the cat, I'm going  to say there's a vial. He said poison gas, but I'm   going to say sleeping potion. Sure. So, there's a  vial of sleeping potion that can be just attached  
> 5:14
> as a train car to these states. So, if the Geiger  counter is triggered, then supposedly that gets a  
> 5:19
> little hammer to smash this vial. And so, the vial  is broken, releases the gas. So, we've got broken  
> 5:24
> vial that is now correlated with the decayed atom.  But then we've got an unbroken vial state that is  
> 5:31
> correlated with the undecayed atom. And then  we've got bringing in a cat, the cat is just  
> 5:38
> another train car, according to the conventional  theory. So, on one hand, the cat is asleep. On   the other hand, the cat is awake. And again,  you've just got a superposition of trains. And  
> 5:49
> you supposedly got a cat in a, you know, suspended  between awake and asleep. And we never see that.  
> 5:55
> And so, it's an illustration that you can't get a  measurement outcome from the standard theory. So,  
> 6:02
> what the transactional interpretation does is, you  know, in a nutshell, and we can elaborate, is it  
> 6:08
> uses a different theory of the way fields behave.  So that, and this is, you know, it kind of seems  
> 6:16
> radical, but this theory is called, has various  names. It's been called the Wheeler-Feynman  
> 6:23
> absorber theory. It's been called the direct  action theory of fields. And it actually involves  
> 6:32
> not just an emission. You know, the conventional  way of looking at field propagation sees things  
> 6:39
> like something generating a field, something  radiating. That's understood. But what happens  
> 6:47
> in this direct action theory of fields is that  under certain well-quantified circumstances,  
> 6:52
> the other systems that we think of  as absorbers, potential absorbers,  
> 6:59
> are active. And they are actually generating a  field that corresponds in a way to the emitted  
> 7:07
> field from emitters. And this field has a strange  character in that it's a so-called advanced field,  
> 7:14
> meaning that it's past directed. But when you look  at the formalism of the way the fields behave in  
> 7:20
> this theory, you get actually a very nice formal  correspondence with certain kinds of, I mean, long  
> 7:29
> story short, you get what's called a transaction,  so that you get not just a field being emitted,  
> 7:35
> but a confirmation, what John Cramer, who was  the originator of the interpretation, called  
> 7:40
> a confirmation wave. And you actually get this  kind of connection, this interaction that clearly  
> 7:47
> defines that a measurement is occurring, that  it has the formal character that a measurement  
> 7:52
> is occurring, and it breaks these superpositions,  and it gives you the kind of formal objects that  
> 7:58
> we call projection operators that correspond to  outcomes, to clearly achieved outcomes. But they  
> 8:08
> each have a probability, and that probability  turns out to correspond to the so-called Born   rule. So it very nicely, you know, it yields a way  that, under certain clearly quantified conditions,  
> 8:23
> you are overwhelmingly likely to get this kind of  confirmation, and, you know, together with this  
> 8:29
> offer wave, confirmation wave, and you get a  transition from the suspension in a superposition  
> 8:36
> to a state where we have some clearly defined  outcomes. And then they will not all happen,  
> 8:43
> but they are clearly distinct from just a  superposition. They're distinct theoretical  
> 8:48
> objects. And then you can talk about, well,  maybe symmetry breaking. You know, you could say,   well, the theory will not tell you which one of  those is actualized, but it does tell you that,  
> 8:59
> that indeed a measurement interaction occurred,  so that, you know, you can say that I now know,  
> 9:06
> I can now say under what conditions I get a  measurement interaction. So that's what I like  
> 9:12
> about it. So is the measurement problem twofold?  One, what counts as a measurement, and then two,  
> Understanding Measurement Interaction
> 9:19
> why is it probabilistic? Are those two  separate questions? You could say that. I mean,  
> 9:26
> there are different ways of characterizing the  so-called measurement problem or the measurement,  
> 9:32
> what counts as a measurement, and the different  features of it. von Neumann kind of pointed to  
> 9:40
> two stages of measurement, which I kind of  had covered just now, but to make them more  
> 9:46
> precise. The initial stage of measurement is  the transition from this superposition state  
> 9:53
> to this state of clearly defined, you know,  different possible probabilistic outcomes.  
> 10:00
> And that's called a mixed state. So there's that  transition. And then there's what we could call,  
> 10:06
> the second stage would be what we could call  a collapse from that collection of possible  
> 10:13
> outcomes, weighted outcomes, to the one outcome  that we see. So you can think of it as two stages  
> 10:19
> in that way, but the two stages correspond to,  I think, roughly what you just said. You know,  
> 10:26
> that the first stage corresponds to, okay, now  I can say that a measurement really happened.  
> 10:32
> That I can now use to apply my Born rule to the  probabilities of these different outcomes. But  
> 10:41
> then, you know, again, the theory won't tell you,  well, why did I get this one and not the other  
> 10:46
> one? But that's because the theory is genuinely  indeterministic. It's genuinely probabilistic,  
> 10:52
> which is puzzling. You know, we'd like to, you  know, our Western conventions are that science  
> 10:58
> has traditionally demanded kind of a causal  mechanistic deterministic account from point  
> 11:06
> A to point B. And that the idea being that if  you don't have that, that there's something  
> 11:11
> missing in your explanation. But what I mean,  I think what a lot of people are now, you know,  
> 11:18
> more and more understanding that quantum theory is  not going to conform to that expectation because  
> 11:24
> it is genuinely indeterministic. Can you give  another account or another picture? Like, let's  
> Exploring Feynman Diagrams
> 11:31
> say we have an electron and there's a Feynman  diagram, an electron coming here and then here,   and they emit a so-called virtual photon, and  then they move apart. What does that look like  
> 11:40
> in the transactional interpretation? You mentioned  absorbers, offerers, emitters, confirmations. So  
> 11:46
> what is offering? What is confirming? Is there  a clear distinction? Is it the electron? Is it  
> 11:52
> something more fundamental? Explain. Sure,  sure. So actually in a Feynman diagram,  
> 11:59
> you know, what you kind of referred to there is  really a kind of a scattering process that does  
> 12:05
> not correspond to the offers and confirmations.  So this is a subtler relativistic level where,  
> 12:14
> you know, when you've got, you know, two electrons  coming in and connected by this virtual photon and  
> 12:20
> then going out, that's actually just one term in  the, you know, so-called perturbation expansion.  
> 12:27
> So there are many contributions and many ways  that the field interacts. But at that level,  
> 12:35
> these are virtual photons. So the key point is  a virtual photon is kind of a way of referring  
> 12:41
> to the aspect of the direct action theory  that is, you know, for physicists watching,  
> 12:47
> it's the time symmetric propagator. So that  is not an offer or a confirmation. It's an  
> 12:54
> influence. It's a level of the field interaction  that in the direct action theory is always present  
> 13:01
> among charges. So really a charge, the term charge  just means being connected to other charges with  
> 13:09
> this so-called virtual photon connection.  It's not, it's not a measurement. It's not   a measurement interaction. It's a correlating type  of interaction. So there are two levels. So that's  
> 13:20
> a nice question because it allows us to get to  the this subtler point that as I've developed the  
> 13:26
> transactional interpretation into the relativistic  domain, it becomes clear that there are these  
> 13:32
> two levels of the field behavior. So that when  you have something like free electrons, they,  
> 13:40
> they do not have, a situation where, I mean,  if they're totally free electrons, they would,  
> 13:47
> they would not be able to toss a real photon from  one electron to another because that would not  
> 13:53
> satisfy the conservation laws. So that under that  situation, a transaction is, is just not permitted  
> 14:01
> because it has to satisfy the conservation laws.  However, when you have something like an excited  
> 14:08
> atom, and then you have an unexcited atom, then  you have a situation where they can interact in  
> 14:15
> a way that a real photon could be transferred  from the excited atom. It could drop down to  
> 14:22
> a lower energy state and then that ground state  atom could, could receive, could absorb that real  
> 14:29
> photon and pop up to a higher energy state and  energy conservation would be satisfied. And under  
> 14:35
> these, these conditions, you can, you can have a  quantitative time-dependent probability that these  
> 14:44
> guys are going to engage in a transaction, meaning  the excited atom is going to generate an offer  
> 14:50
> wave. The unexcited atom is going to generate a  matching confirmation wave. And this is actually  
> 14:58
> the object that, that corresponds to a real  photon. And upon that, that kind of interaction,  
> 15:06
> the, a real photon, which means it's on shell,  which means it did, it's truly massless and only  
> 15:11
> transversely polarized, will go from that excited  atom to the unexcited atom. And, and, and then it  
> 15:18
> will be excited. So there are these two possible  kinds of interactions. The latter one is a  
> 15:23
> measurement. That's what counts as a measurement.  And that's why you don't need to refer to  
> 15:29
> observers. You don't need to say, oh, well, I  need to, you know, posit some outside observer   to say that something really happened, some clear  outcome event happened. Because in this picture,  
> 15:44
> the formalism gives you the fact that an emission  event occurred at some time, t, and an absorption  
> 15:51
> event occurred at some time, t. And these can  have observable consequences, even if no one was  
> 15:59
> around, happened to be around to see them. As  you know, on Theories of Everything, we delve  
> 16:04
> into some of the most reality-spiraling concepts  from theoretical physics and consciousness to AI  
> 16:11
> and emerging technologies. To stay informed in an  ever-evolving landscape, I see The Economist as a  
> 16:18
> wellspring of insightful analysis and in-depth  reporting on the various topics we explore here  
> 16:24
> and beyond. The Economist's commitment to rigorous  journalism means you get a clear picture of the  
> Observers vs. Measurers
> 16:30
> world's most significant developments, whether  it's in scientific innovation or the shifting   tectonic plates of global politics. The Economist  provides comprehensive coverage that goes beyond  
> 16:41
> the headlines. What sets The Economist apart is  their ability to make complex issues accessible  
> 16:46
> and engaging, much like we strive to do in this  podcast. If you're passionate about expanding your  
> 16:52
> knowledge and gaining a deeper understanding  of the forces that shape our world, then I   highly recommend subscribing to The Economist.  It's an investment into intellectual growth,  
> 17:02
> one that you won't regret. As a listener of  TOE, you get a special 20% off discount. Now  
> 17:08
> you can enjoy The Economist and all it has  to offer for less. Head over to their website   www.economist.com to get started. Thanks for  tuning in, and now back to our explorations of  
> 17:22
> the mysteries of the universe. Even if no one  was around, happened to be around to see them.  
> 17:30
> Most of the time when people in the lay public,  when they think about quantum mechanics,   if they're even thinking about quantum mechanics,  they conflate observers with measurers. So is that  
> 17:41
> okay? Are they distinguished in your view?  Yes, they are distinguished. They need to   be distinguished. And you can't really blame the  public for doing that, because that is something  
> 17:52
> that physicists have been doing since basically  von Neumann and maybe earlier. And it's just  
> 18:00
> a symptom of this problem with the conventional  theory where you cannot define measurement from  
> 18:09
> within the theory. And so then the convention  became to just say, I'm going to just say, okay,  
> 18:15
> and when there's some outside observer who comes  in, then I'm suspending quantum theory and I'm  
> 18:23
> just going to put in my measurement transition  by hand in an ad hoc way. So it's a hand wave to  
> 18:32
> some conscious observer outside the theory where  you just cut. In fact, Heisenberg called it a cut,  
> 18:40
> and it's arbitrary in the conventional theory. And  people have actually even used this as like, well,  
> 18:47
> this is nice. I can do stuff with this. I'm like,  no, it's just an ad hoc failure thing that you're  
> 18:52
> doing, because it's a hand wave to what counts  as a conscious observer. And that's the whole  
> 18:58
> point of the Schrodinger cat experiment, right?  Because Schrodinger was dissatisfied with that  
> 19:05
> equating measurement to observation, because  he could say, well, isn't the cat conscious?  
> 19:14
> What counts as something conscious? And philosophy  has no principled way of saying that one thing is  
> 19:21
> conscious and another thing isn't. So it gets you  into this kind of thorny ad hoc hand-waving land.  
> 19:29
> And so what I do, and what I've done in my books,  and I do it on my blog, I have a blog post that  
> 19:34
> addresses this. I think there's one post where I  say, there is measurement when you're observing,  
> 19:47
> but not all measurement is observation.  Measurement in the sense of an outcome  
> 19:53
> happened. So the term is inherently ambiguous  and problematic, because observation sounds  
> 20:01
> anthropomorphic and intentional and so on. And  observation is important in science. And of course  
> 20:10
> we do observations, and that's important. But the  issue about the term measurement in quantum theory  
> 20:17
> is, did an outcome occur or didn't it? That's the  key. And the conventional theory cannot answer  
> 20:25
> that. You cannot answer that from within the  theory. You can never say an outcome occurred.   It will not let you say that an outcome occurred  if you're being strict about it. So that's what  
> 20:35
> you get. You get outcomes, whether or not someone  was there to see it. So like in TI, you get, yeah,  
> 20:41
> a tree did fall. I mean, it doesn't need you  to be there to help it fall or to, you know,  
> 20:46
> it doesn't need this sort of like, there's  almost a hubristic component to it where,  
> 20:53
> you know, oh, we must have someone observing  something or it didn't happen, you know,   and that gets into anti-realism too. But in  TI, you can say from within the theory that  
> The Nature of Measurement
> 21:04
> a measurement interaction happened. Here's why,  under various, you know, quantified circumstances,  
> 21:12
> here's where you are overwhelmingly likely to have  a measurement transition where an outcome will  
> 21:18
> occur, whether or not there happens to be somebody  there to observe it. So you said that it's likely  
> 21:26
> that there's going to be a measurement transition.  So I understand that the measurement itself is   not determined, sorry, that the outcomes of the  measurements are not determined, but the fact of  
> 21:35
> a measurement is also probabilistic? Correct.  And so this corresponds to decay rates in the  
> 21:42
> conventional theory. So one way they link up is  that in the transactional interpretation, when we  
> 21:50
> are calculating a decay rate by this conventional  theory, we're also, from the standpoint of TI, the  
> 21:58
> transactional interpretation, we're calculating  the probability that at any particular time t,  
> 22:04
> a measurement transition will occur. Because  in order to get a decay, like I said before,  
> 22:11
> you must have the proper circumstances, but those  are probabilistic and, you know, it may or may  
> 22:17
> not happen at a particular time t. So again,  that's another, that's kind of a deeper level  
> Probabilistic Outcomes Explained
> 22:23
> aspect of the probabilistic character of quantum  theory. Having said that, however, you know,  
> 22:29
> for situations of ordinary macroscopic experience  and the kinds of phenomena, you know, like every  
> 22:39
> second of every day we're seeing determinate  outcome-related type phenomena. We see,   you know, we see clearly defined objects around  us. And this happens because the probabilities  
> 22:50
> of transactions are so overwhelmingly high for the  kinds of energy, you know, energies involved that  
> 22:58
> at any second, it's that the probability is  99.9999 and it can go on nearly forever that  
> 23:06
> at any particular time you're going to have a  decay, you know. So we're at this macroscopic  
> 23:11
> level. Yeah, we're going to get transactions.  But interestingly, if you want to probe,  
> 23:16
> there's a whole zone of the mesoscopic. So, you  know, you're dealing with things like buckyballs,  
> 23:23
> which are these very large carbon molecules.  They got like 60 carbon atoms in them. They  
> 23:30
> have a very nice mesoscopic property where, you  know, you send them through a two-slit apparatus  
> 23:36
> and about half the time you're going to get  measurement transitions just because the thing,  
> 23:42
> you know, it transacted with one of the slits or  something. So it has like a 50% probability of  
> 23:50
> engaging in a measurement interaction. And you see  that in the data when you work with these things.  
> 23:58
> So before I get to some more technical questions,  can we outline or can you outline, please, exactly  
> 24:05
> what is an emission, an offer, a handshake? And  you mentioned the photon was the interaction and  
> 24:13
> not an actual emission or an absorption, like  disembroil these. Yeah. So an offer wave is a  
> 24:23
> quantum state of the, I mean, again, just to get  a little more technical because you did mention  
> 24:30
> it earlier. We do need to distinguish between  entities that count as emitters and absorbers and  
> 24:39
> these offers and confirmations. So the distinction  is that entities with rest mass, such as atoms,  
> 24:48
> electrons, so-called fermions, these are systems  with charge. So systems with charge that have rest  
> 24:59
> mass are capable of, I mean, this is just the  way the fields work. They interact in this way.  
> 25:07
> And that's according to standard quantum field  theory as well. So the interacting fields of the  
> 25:13
> so-called charged fermions and the electromagnetic  field give you this potentiality to emit or  
> 25:21
> absorb. But again, the emitters are objects like  an atom that what's actually doing the emitting  
> 25:31
> is the electron in the atom. So the only reason  it can really generate something like an offer  
> 25:39
> wave is because, again, the energy conservation  can be fulfilled. But let's assume that's the  
> 25:44
> case. So we have an excited atom. You know, you  can either count the entire atom as the emitter  
> 25:51
> or just the electron within it. That's kind of the  charged electron is actually doing the emitting,  
> 25:58
> but you need that entire bound state to be able to  do this. So let's say the electron and the excited  
> 26:04
> atom is emitting. What it is emitting is an offer  wave that is a quantum state that corresponds to  
> 26:11
> an excitation of the electromagnetic field. But  it's only the sort of the forward propagating  
> 26:22
> component of that. So meanwhile, the absorber is  generating what's called an adjoint field, which  
> 26:32
> is a kind of advanced quantum state. We've got  Kets and we've got what I call a Brach. So they're  
> 26:45
> different formal objects, but independently they  are forms of quantum states. So let's just say  
> 26:53
> quantum state of the electromagnetic field. We've  got a retarded, so-called retarded quantum state  
> 26:58
> of the electromagnetic field, which is the offer  wave. And we've got the advanced quantum state  
> 27:06
> of the electromagnetic field, which is the  confirmation wave. So that's the offer and   the confirmation that are generated under these  circumstances. So let's say at time T, these were  
> 27:17
> generated because it was overwhelmingly probable  that it would happen at that time. So we've got  
> 27:23
> this interaction between these. These two, and  in a sense, you can think of that as the photon  
> 27:33
> on a technical level. If you had a bunch of other  absorbers around, they too would be contributing  
> 27:42
> an advanced offer wave corresponding to the  component of the, an advanced confirmation wave  
> 27:49
> corresponding to the component of the offer wave  that they received. So it would kind of split,   you know, the offer wave from the emitter would  be broken down into many components in general.  
> 28:00
> This is in general what happens. And so the photon  at that level, this goes back to those stages with  
> 28:09
> the first stage where we're going from a pure  state to a mixed state. This is in a sense the   mixed state for the measurement transition. It's a  collection of what I call incipient transactions.  
> 28:22
> Now none of these incipient transactions is  actually a photon. This is where we get to the  
> 28:29
> collapse stage. When you get to the collapse  stage so that one of these is actualized,  
> 28:35
> then that is the actual photon that goes from the  emitting excited atom to one of these absorbers.  
> 28:43
> Only that at the final collapse stage is where you  get this real photon that is actually, you know,  
> 28:51
> triggering outcomes. So there's a lot there. I  mean, there's a lot there. And I go through that  
> Emission and Absorption Defined
> 28:56
> in my books and I try to present it, you know, at  a conceptual level. But clearly, I mean, there's  
> 29:02
> a lot of theoretical content going on in this  process. And you know, it's hard to kind of really  
> 29:11
> do justice to that, you know, without writing it  down. But... Right. screen and in the description  
> 29:19
> because the rigor is necessary and so people can  go and look that up as well as your books will   be on screen and links in the description. So just  to be clear, the audience is quite technical. They  
> 29:31
> comprise researchers in physics and philosophy  and computer science and so on. So we speak as if  
> 29:36
> we're just in the closed doors of the academy just  speaking to one another. And the cameras happen to  
> 29:43
> be here. So, okay, when you say advanced waves and  when you say retarded waves, are people to imagine  
> 29:50
> that as the same as advanced being forward in  time, retarded being backward in time? So, yeah,  
> 29:57
> that's a great question. Because this is how  John Cramer, you know, the originator of TI,  
> 30:03
> presented it initially. And this is how it kind  of seems like that's the way it has to be. Because  
> 30:10
> we usually think that, you know, everything  physical goes on in space-time and space-time is  
> 30:16
> the mandatory background for everything physically  real. And it's kind of a supposition that we all  
> 30:22
> bring with us that we've all been kind of taught.  We've all just kind of absorbed that. Speaking of  
> 30:28
> absorption. Yeah. Yeah. Yeah. We've all kind of  been marinated in that. And I initially kind of  
> 30:35
> assumed that that was what was going on. But  as I started to investigate the relativistic  
> 30:40
> level of the formulation, I realized that you  really can't consistently think of these offers  
> 30:49
> and confirmations as literally little waves  that are going forward in time and backward  
> 30:55
> in time. For a variety of reasons, I mean, the  first is that technically these quantum states,  
> 31:05
> anytime you have a quantum state of more than one  quantum system, more than one degree of freedom,  
> 31:12
> you are dealing with, you know, a multidimensional  complex Hilbert space. So these states are not  
> 31:19
> entities that really have a space-time character.  Their representation is formally, mathematically,  
> 31:30
> much higher dimensional and complex. So they're  just, they're not space-time entities. I mean,  
> 31:36
> I think that, you know, people don't, you know,  if you say, well, where do these confirmations  
> 31:44
> live or where do these offers and confirmations  live? Then people want to go, you know, well, they   live in configuration space, but that's just a  construct. And so then that gets us off into kind  
> 31:54
> of instrumentalism about the theory. That gets us  off into, well, they don't, you know, whatever.   They're not, they're either not physically real  or, or, or if, you know, that, that seems to  
> 32:05
> create a false dilemma where you either have to  say they're, they're not physically real. They're  
> 32:11
> just mathematical constructs that are useful  in predicting blah, blah, blah. Or you say,  
> 32:16
> no, if they're physically real, I demand, I want  to be realist about the theory. So they've got   to be in space-time. And then what you do is you  falsify their mathematical character and pretend  
> 32:28
> like an object that is a Hilbert space vector  propagates in space-time. That's denying its  
> 32:35
> essential mathematical character. So what I've  been suggesting is that we don't have to do any  
> 32:41
> of that. There's a third way. The third way is  to simply say that these, these entities are  
> 32:50
> physically real, but our physical reality goes  beyond three plus one space-time. And you know,  
> 32:58
> some other physicists are starting to, to be open  to that idea. I mean, at first it sounds crazy  
> 33:03
> and people, you know, want to put you, you know,  put, bring the guys in the white coats to take  
> 33:08
> you away, you know, when you say stuff like that.  It actually is very useful. It's very fruitful as  
> 33:16
> a physical model. And in fact, the, the, the  utility of it, I mean, what people would call  
> 33:23
> reifying Hilbert space is, is to say, look guys,  you know, the, these can be counted as some kind  
> 33:29
> of physical possibility that is physically real,  that does not have its existence in space-time,  
> 33:35
> but at a deeper level that I call the quantum  substratum. And what you can get out of that  
> 33:41
> actually is a nice theory of general relativity  that includes the, the corrections for galactic,  
> 33:52
> you know, rotation curves that are, you know,  usually attributed to dark matter. So with a   colleague of mine, Andrea Schlatter, we've already  worked that out. So we've worked out a theory of  
> 34:01
> emergent space-time emerging from the quantum  level, taken as real, taken, taken as really  
> 34:09
> involving these real entities propagating at the  quantum level and, and engaging in transactions in  
> 34:17
> such a way that you get an emergent space-time  that has symmetrical character of. You know,  
> 34:23
> described by the Einstein equations. So that's  all out there. That's a publication that we have,  
> 34:29
> and we've, we've been building on that. So,  so I mean, the bottom line is, no, offers  
> 34:36
> and confirmations are not going backward and  forward in space-time there. They are processes,  
> Entities and Their Reality
> 34:43
> physically dynamic processes that are taking place  at the quantum level and they involve quantum  
> 34:50
> possibilities, if you will. So two questions, I've  noticed that the word entity is being used and I  
> 34:58
> assume carefully and not the word particle or not  the word field, like you keep saying entity. So I  
> 35:03
> want you to spell out why. And also I want to know  precisely what are the ontological commitments  
> 35:09
> here? Is it that the configuration space is real  or is it that the vectors, the Hilbert space is  
> 35:16
> real? Tell me, what are you saying is real? Well,  I would never say configuration space is real  
> 35:25
> because that's kind of an idealization of wave  functions and wave functions, which are basically  
> 35:33
> amplitudes of a quantum state with respect to  the position basis. At the relativistic level,  
> 35:40
> you don't have a position observable. So those  are kind of idealizations. But what I'm taking  
> 35:47
> as physically real are all quantum systems.  Quantum systems are physically real. The field,  
> 35:57
> the electromagnetic field is physically real. So  I'm taking all that as physically real. I mean,  
> 36:03
> I use the term entity maybe just kind of as  a general way to reference a quantum system  
> 36:12
> or a field. These can, you know, it's kind of a  catch-all term, if you will. You can, you know,  
> 36:21
> yeah. So these are real physical systems. I  consider them physically real. I consider them to  
> 36:29
> exist independently of anyone's observing them or  knowing about them epistemologically and so on. So  
> 36:37
> they're real. So they don't exist in space-time.  So what? They're real. You know, I'm just saying  
> 36:46
> the ontological commitments are simply, I'm just,  you know, it's just I'm realist about quantum  
> 36:52
> theory. So in the transactional formulation.  So that means something like a hydrogen atom,  
> 37:01
> which can be described by a quantum state, the  state is a descriptor of a real physical object.  
> 37:09
> And so what I'm, I'm just being realist about  it. So I'm saying the reference of quantum theory  
> 37:15
> exists physically and the fact that they don't  happen to fit into space-time does not discount  
> 37:22
> the fact that they exist physically. So I'm not  real, like I'm not committed to any particular  
> 37:28
> metaphysical nature of what I call the quantum  substratum. You could call me maybe a structural  
> 37:35
> realist, you know, I'm not going to posit  a substance or something like that. I mean,  
> 37:41
> you know, it's a very bare bones ontology. It's  basically just the formalism in the transactional  
> 37:50
> formulation, meaning that's the way I think the  fields behave. These are real fields. They're  
> 37:57
> really doing that. There's really an influence.  There's a physical connection among physically  
> The Emergence of Space-Time
> 38:03
> real systems. So I take it as all physically real,  and I just basically reject the idea that in order  
> 38:08
> to be physically real, you must be a space-time  object. Now, I like what you said, that it's a  
> 38:16
> transactional formulation, because it's often said  transactional interpretation and abbreviated as   TI, but interpretation sounds then like you're  just interpreting quantum theory differently,  
> 38:26
> but it's an actual, it's different. Yes, and it  seems like there's empirical distinguishability.  
> 38:32
> So I would like to ask you about that. Well,  okay. Yes, wonderful question. Yeah, I mean,  
> 38:38
> what I've realized as I've developed the  relativistic formulation is that, yes,   it is a different formulation of quantum theory.  It's a subtly different theoretical model,  
> 38:49
> simply because the fields behave differently than  is assumed in the conventional approach. As to,  
> 38:58
> what was the second part of your question? Oh,  I saw that there must be some distinguishing  
> 39:05
> factor empirically. Yes, empirically. So the  distinguishing factor is that the transactional  
> 39:14
> formulation provides an account of measurement.  The empirical phenomena are measurement outcomes.  
> 39:24
> So the empirical distinction is simply that  measurement is an anomaly for the standard  
> 39:30
> approach. The standard approach is incapable  of accounting for measurement. So that's the  
> 39:38
> only empirical distinction, and it's one that  corroborates the transactional formulation. So  
> 39:43
> what we have here, this is subtle, because people  usually say, well, I want you to do an experiment,  
> 39:51
> Kastner, and show me a prediction of transaction.  You say it's a different theory, so well, show me  
> 40:00
> how does it deviate from the standard theory,  and so on. That's kind of a misconception. Why?  
> 40:07
> Because both theories are empirically equivalent  at the level of probabilities, like for the Born  
> 40:15
> rule, because the transactional formulation yields  the Born rule. But what people kind of don't often  
> 40:21
> take into account is the issue of anomalies.  So for instance, you know, back when we had  
> 40:28
> Newton's theory of gravitation, the precession  of Mercury was an anomaly. The precession of the  
> 40:35
> orbit of Mercury was an anomaly for Newton's  theory. Newton's theory was unable to explain  
> 40:41
> that. So Einstein's relativity came along and was  able to empirically predict the precession of the  
> 40:52
> orbit of Mercury. This is the same thing that's  going on with the transactional formulation.  
> 41:00
> It fails to be predicted. Measurement outcomes  fail to be predicted by the conventional theory.  
> 41:07
> It's an anomaly. The TI formulation comes  along and accounts for and predicts measurement  
> 41:13
> interactions. So in that way, it is empirically  distinct. This is what is usually missed,  
> Distinguishing Theories and Anomalies
> 41:22
> you know, in these kinds of discussions, and the  reason it gets missed is because people are, we've  
> 41:27
> all been taught, and this isn't me bad-mouthing  the conventional, you know, people who are working  
> 41:35
> with the conventional theory, it's what they've  been taught because the measurement problem has  
> 41:40
> been around for so long that it's become habitual  to become instrumentalist about the theory and  
> 41:47
> say, well, you know, it just happens, measurement  happens, there's nothing wrong with the theory,  
> 41:52
> you know, it works for all practical purposes,  it's a good instrument, and to kind of lapse into  
> 41:58
> that instrumentalist stance and to decide not to  hold the conventional theory's feet to the fire  
> 42:07
> on this issue of measurement. If you do that,  if you're a good critical thinker and you're a  
> 42:12
> stubborn journalist, you know, if you treat the  conventional theory, you know, like a politician  
> 42:18
> and say, but excuse me, sir, like, exactly how do  you get an outcome here? You know, where's your  
> 42:24
> outcome? What is it in the theory that's getting  you that outcome, sir? You know, and if they don't  
> 42:29
> haul you out of the, you know, you know, so this  is what people have not been doing. So this is  
> 42:34
> what, you know, I've been to the pesky little, you  know, little cocker spaniel there that's biting at  
> 42:40
> the heels of the conventional theory and say, no,  I'm sorry, you have not actually done that job.  
> 42:45
> And the transactional formulation does that job.  So that's the empirical distinction. It corrects  
> 42:52
> an anomaly that exists in the conventional theory.  Does asking these journalistic questions to the  
> The Challenges of Independent Scholarship
> 42:59
> politicians make you popular? No, it doesn't.  You know, but it's, it's fun. And it's still,  
> 43:11
> you know, I do get opportunities to engage and  they are, you know, people are understandably  
> 43:19
> reluctant. You know, I have sympathy for that  because it means going against a lot of what  
> 43:25
> we've been taught. And I went through that same  program. And perhaps, you know, I perhaps have a  
> 43:31
> degree of liberty to be a little more critical  and stubborn and intransigent about it because  
> 43:37
> I primarily work as an independent scholar.  And I, you know, I don't have to, you know,  
> 43:45
> I'm basically, I made the decision to follow this  approach because I thought it was fruitful and it  
> 43:50
> made sense to me. And I chose not to, you know, be  constrained by other concerns and to just follow  
> 43:59
> this where it leads. Talk to me about independent  scholarship. It seems like there's you, there's  
> 44:05
> Julian Barber, and maybe three other people. Why  is it so rare? How are you able to do it? And what  
> 44:13
> are the challenges and advantages? Well, yeah,  the advantages I just mentioned is, is perhaps  
> 44:19
> a little more degree of independence from, you  know, what can turn into groupthink. And I don't  
> 44:24
> mean that in a, you know, it sounds disparaging,  but I've, you know, I understand that, that it's   a concern. And I understand the concerns people  have to, to, you know, that you take risks to,  
> 44:36
> to buck the trend. So the advantage is that, you  know, I don't, I'm less constrained by those kinds  
> 44:45
> of influences. Of course, it's challenging in  that, you know, financially, I'm kind of on my  
> 44:50
> own. I, I have to be frugal. I have to work at  a, in a very limited budget. When I travel, I'm,  
> 44:58
> I can only travel to conferences where I'm  invited and my expenses are covered by the,  
> 45:06
> the hosts. I don't have any academic support  for travel expenses or anything like that. So,  
> 45:12
> you know, that, that, that limits my ability  to, to attend various things. And, you know, and  
> 45:19
> sometimes if you are not, I do have an affiliation  with the University of Maryland. I don't want to,  
> 45:25
> you know, I don't want to overlook that. And  they've been very kind and very supportive,   the philosophy department at the University of  Maryland to, to offer me that affiliation, which  
> 45:35
> gives me some library resources and so on. And  they've done that, you know, out of recognition  
> 45:43
> that, that they feel that I'm, that I'm pursuing  some interesting ideas. And in fact, I did get,  
> 45:49
> I did happen to receive a research award in 2021  from the University of Maryland. So they've,  
> 45:56
> they've been very kind in that way and in the  recognition. So thank you. Thank you. So, yeah,  
> 46:02
> I mean, it's just, it just means you've got to  be careful about, you know, you got to be frugal,  
> 46:08
> but you do have perhaps fewer constraints, you  know, in terms of, of what you investigate and  
> 46:16
> how. So we keep saying the words conventional  approach to quantum mechanics, conventional,  
> Defining the Conventional Approach
> 46:23
> conventional. Are we referring specifically to the  Dirac von Neumann axioms or something different?  
> 46:31
> Um, we're actually, when I say that, I mean, um,  the conventional view of the way fields propagate,  
> 46:38
> um, which, which is kind of the basis for quantum  field theory. Um, it goes back to, you know,  
> 46:46
> this is something that perhaps isn't formalized  because it's just the default assumptions about  
> 46:54
> fields. The default assumptions is that fields are  generated unilaterally by emitters, end of story.  
> 47:04
> And it's, it's an approach to field propagation.  And it, that, that goes back to, you know, Dirac,  
> 47:13
> uh, probably formalized that to some extent. And  it comes up, I mean, people who want to look at,  
> 47:20
> well, what is that quantitatively can look into  the references on, on the, the issue of radiation  
> 47:27
> reaction and, um, the, the issue of the  puzzle in this, in the standard approach of  
> 47:34
> how an emitting system loses energy. Because  that's actually hard to account for in the,  
> 47:42
> the default unilateral approach. So if, if, you  know, if people want to see, well, what is that  
> 47:48
> quantitatively, they can go and see, you know,  how the, how the, the traditional Dirac way of,  
> 47:56
> of trying to deal with the loss of energy by an  emitting charge is to assume that the emitted  
> 48:05
> field is a retarded field. A retarded field only.  And that that is what is radiated. And when you do  
> 48:11
> that, you actually have trouble saying why the  field lost energy, and then you have to help   yourself to this ambient free field. That's just  there for no reason. So, so those are the kinds  
> 48:22
> of, you know, publications where you're going to  go and be able to see the contrast between this,  
> 48:27
> this, what I call the conventional approach  to field propagation and the direct action   theory. Are there axioms of the transactional  formulation, like the Kastner-Cramer axioms or  
> Formulating the Transactional Axioms
> 48:39
> something akin to that? Nope, just the direct  action theory. It just, all you do is you say,  
> 48:44
> what, what would be happening if the fields  were, if nature worked with direct action  
> 48:50
> fields instead of this unilaterally emitted  field? And that's all you do. I never,  
> 48:57
> I don't like axiomize, axiomatizing things. I  don't, I, you know, I never liked to go, oh, okay,   I'm going to postulate that. I never liked to  postulate stuff, you know? So, so it's really  
> 49:06
> simply incorporating, bringing into the picture a  different theory about the way fields are behaving  
> 49:15
> and, and examining the consequences of that. And  then the formula, formalism just, just falls out  
> 49:21
> of it because in the, in the direct action theory,  you naturally get these confirmation waves, these,  
> 49:28
> these advanced states that are already part of  the quantum formalism anyway, when you want to  
> 49:33
> construct a projection operator. A projection  operator is an outer product of a so-called  
> 49:40
> offer wave and a so-called confirmation wave, or  a KET and a BRAC. And you get these outer products  
> 49:47
> naturally from the physics of the direct action  theory. They just drop right out of it. In the,  
> 49:53
> in the conventional approach, you have to help  yourself to it. You have to say, okay, what am I   going to represent mathematically by a state that  acquires an outcome? Oh, I'm going to describe it  
> 50:04
> by a projection operator. You just help yourself  to that. Whereas they fall out of the physics of  
> 50:10
> the direct action theory. So in 2015, I believe  Cramer had an article, Cramer's the progenitor  
> 50:22
> of this theory for those who don't know. And  I believe he called your version unnecessarily  
> 50:28
> abstract or something akin to that. Why did he say  that? What's the difference between his version  
> 50:33
> and yours? Yeah, I mean, I think, I think my  formulation or my, my, my version is necessarily  
> Kramer's Perspective on Transactional Theory
> 50:42
> mathematically accurate. And, you know, I think,  I think Professor Cramer very much is part of a  
> 50:50
> tradition of defining the physically real in  terms of, is it, is it a space-time object?  
> 50:56
> And so he's kind of taken that option of choosing  to, to, to say that, that these, these entities,  
> 51:05
> these field processes are happening in space-time  because he has that metaphysical desire, you know,  
> 51:11
> requirement. So what I'm saying is just drop that  and, and follow the mathematics of the theory in  
> 51:18
> a realist way without reducing the mathematics  and trying to project it down and distilling,  
> 51:26
> you know, taking stuff out of it, but leave the  content intact and let that instruct you as to  
> 51:32
> what nature might be about, you know? And in fact,  that's what, that's a long tradition in physics.  
> 51:38
> That's in fact, what Heisenberg did. You know,  when he, back when he was trying to construct  
> 51:44
> these very kind of tinker toy causal mechanical  models of, of atoms to try to get a quantum theory  
> 51:52
> when he knew that the classical theory wasn't  working. And it was only when he gave up on that  
> 51:57
> and said, let me follow the math. Let me follow  the data and see what, what I can conclude from  
> 52:05
> that. And I mean, his, he's got these wonderful  descriptions in his writings where he says,  
> 52:11
> and a whole, a beautiful structure emerged before  me, you know, when he started to, to kind of  
> 52:18
> inadvertently stumble onto matrix mechanics. It  was a mathematical structure that he recognized  
> 52:26
> initially, at least, was kind of being handed  to him by nature when he let it speak instead of  
> 52:34
> following his own metaphysical requirements about  what he should impose on nature. So I think that's  
> 52:40
> really, you know, that's all I'm doing. I'm just  saying, let's be realist about the theory. The,  
> 52:45
> the objects in the theory, the, the, the quantum  systems and the states that describe them have   this mathematical character. Well, I'm not going  to deny that mathematical character just because  
> 52:55
> it makes me uncomfortable about my metaphysical,  you know, conventions. I'm going to, I'm going  
> 53:00
> to let go of those first before I'm going to  start, you know, tampering with the theory. In  
> 53:07
> math and physics, the word space is used most  often abstractly. So sure, there's up, down,  
> 53:13
> left, right, and forward, backward, but there's  also modulized space and so on. And that's not,  
> 53:18
> an up-down doesn't correspond to space or subset  of space-time or foliation of space-time. So in  
> 53:24
> this, grant me this usage of the word space as  abstract. In your theory, in the direct action  
> 53:30
> theory, in the transactional formulation,  what space is it that actually exists? Is  
> 53:37
> this space-time a projection of some higher  dimensional space? Is it a lower dimensional,  
> 53:43
> like a holographic theory and, and we're being  somehow moved upward to four dimensions? What is  
> 53:49
> the space that's playing out? Well, I take it as  all real, but in different ways. So I, you know,  
> 53:55
> cause I'm a realist about physics. I think that,  that quantum theory is describing physically real  
> 54:01
> systems. And I, and I get, I use the iceberg  metaphor. So what I think of as, you know,  
> 54:07
> to this big iceberg, you know, it's got this huge  submerged portion and just the very tip is peeking  
> 54:12
> out and above the water. So I, I think that all  of that submerged portion is real. But it's not,  
> 54:20
> it's not the empirical component. It's not the  measurement outcome component. In contrast,  
> 54:26
> that's what's on the tip. So space-time is, is a,  is an emergent construct. It's not something we  
> 54:32
> live in. It's, it's, and Einstein acknowledged  that space-time is technically a, a structured  
> 54:38
> set of what he called point coincidences.  Well, it's a structured set of events and,  
> 54:45
> and those events are essentially the outcomes of  what we call measurements. So it's an emergent  
> 54:50
> construct. It's real. It's real, but it's not,  it's not real in the way we thought, you know,  
> 54:55
> and, but if, if you're strict about it, Einstein  was right about the way in which space-time is   real. The so-called space-time parameters, space  and time, are, they are parameters that help us to  
> 55:14
> relate the, if you will, that, that submerged part  of potentiality, it's, it's, call it potentiality.  
> 55:24
> Interesting. To the part that's observable.  It helps us, it helps us coordinate that. So,  
> 55:30
> so they are parameters and they're recognized  as such in, in quantum field theory that,   that they are parameters. So it's all real. It has  its different modes of reality, if you will. And  
> 55:40
> you know, I mean, we, I think that this calling  things abstract is a very tendentious, you know,  
> 55:47
> it's a tendentious term because it, it starts to  make a metaphysical ruling on what you can count  
> 55:56
> as real and what you can't, you know, like, like  we're all used to, you know, mathematicians love   to create abstract mathematical spaces. Great.  Okay. Well, you, you know, usually, well,  
> 56:04
> that's not real. It's some guy just created  some fun thing he was playing with and I,   playing up with ideas, call it abstract. Great.  But, but when one starts to say that because the  
> 56:16
> formalism or the kinds of mathematical spaces  that are appearing in quantum theory are not  
> 56:23
> space-time, therefore they are abstract,  they have to be abstract. I'm, and it's a,   it's a tendentious ruling. It's a way of passing  judgment kind of preemptively and saying, I, I,  
> 56:34
> I judge that to be not physically real because  you're saying it's abstract. Well, it may have   started out as some idea that somebody was playing  with that doesn't mean it doesn't correspond to  
> 56:44
> something in the real world. So that's where the  term abstract can get really kind of, you have  
> 56:50
> to be, it's kind of like, I get, I get a little  yellow alert flag, but abstract. Cause I mean,  
> 56:56
> it's, it's a metaphysical judgment. It's often  used to say not real. It's used as equivalent to  
> 57:02
> not real. And that's, you can't do that. You know,  that that's preemptively passing judgment on,  
> 57:09
> on whether or not you can be realist about  a given formalism and so on. In some ways,  
> 57:16
> Plato takes the approach that as you abstract,  you get closer to what's most real in the realm  
> 57:21
> of the forms, except he wouldn't define reality  as just physical reality. What we're seeing are  
> 57:26
> these, these imprecise adumbrations. So  earlier you mentioned physical reality,  
> 57:32
> and then you also just said real. So do you  think that all that is real is physical? Well,  
> 57:40
> yeah, it's a good distinction to make. I mean,  I, when I'm talking about physics and physical   theories, I use physically real and real kind of  interchangeably because that, that's usually the  
> 57:52
> domain in which I'm operating because you know,  what, what I'm, my, my little quest if you will,  
> 57:58
> is to kind of try to offer to people a solution  to the problems they purport to be concerned  
> 58:03
> about in a physical theory, you know? So, so I'm  saying you're, you got these problems you purport  
> 58:09
> to be concerned about, like the measurement  problem and other problems, and the alleged lack  
> 58:14
> of compatibility between relativity and quantum  theory, which we have already resolved. And so in  
> 58:20
> that context, I'm, you know, I'm offering these.  And so because it's about a physical theory,  
> 58:26
> that's, that's kind of the context in which I  operate. When you know, the, the, the broader  
> 58:33
> questions about, you know, Plato and perfect forms  and so on, you know, there's, if I were in a,  
> 58:40
> in a philosophy class, you know, I would, I would  want to make a distinction between domains that we  
> 58:48
> describe by what we call physics, physical theory,  and domains that we, we don't pretend to describe  
> 58:55
> by physical theory like thought. I mean, some  people try to, but I think that's a little, a bit,  
> 59:00
> a bit reaching, you know, being materialist about  that. So it depends on kind of what the domain of  
> 59:06
> discourse, if you will. Yeah. I mean, I would  never, I wouldn't, in this context, I wouldn't  
> 59:12
> want to, you know, say, yeah, I think Plato's  perfect forms are physically real. You know,   I wouldn't do stuff like that. I wouldn't,  I wouldn't, I don't know. That's a separate  
> 59:20
> question, you know? Okay. Allow me to play  around with this iceberg metaphor. So on the tip,  
> 59:27
> are you saying the tip that's revealed, is  that at least part of that space-time? The  
> 59:34
> tip is what I call space-time. The tip of the  iceberg is space, is the space-time manifold. So  
> 59:42
> you called it emergent. However, in an iceberg,  it's difficult to say what's emergent. You can  
> 59:47
> say it's above the surface. That's where, that's  where we need a different metaphor. So yeah, so,  
> 59:54
> so this is where the, you know, all metaphors kind  of have limitations. So yeah, in a real iceberg,  
> 1:00:00
> the tip, you know, we don't get that. It's just  a way of kind of making a distinction between,  
> 1:00:06
> you know, that which we don't directly observe  and that which we do, and pointing out it's all  
> 1:00:12
> real. It's just some of it is not accessible in  the same way. Hi everyone. Hope you're enjoying  
> 1:00:17
> today's episode. If you're hungry for deeper  dives into physics, AI, consciousness, philosophy,  
> 1:00:23
> along with my personal reflections, you'll find it  all on my sub stack. Subscribers get first access  
> 1:00:29
> to new episodes, new posts as well, behind the  scenes insights, and the chance to be a part of   a thriving community of like-minded pilgrimers.  By joining, you'll directly be supporting my  
> 1:00:39
> work and helping keep these conversations at the  cutting edge. So click the link on screen here,  
> 1:00:45
> hit subscribe, and let's keep pushing the  boundaries of knowledge together. Thank   you and enjoy the show. Just so you know, if  you're listening, it's C-U-R-T-J-A-I-M-U-N-G-A-L  
> 1:00:56
> dot org, CurtJaimungal.org. And pointing out it's  all real. It's just some of it is not accessible  
> 1:01:01
> in the same way. So the iceberg, you know, it can  only go so far. So when it comes to, you know,  
> 1:01:08
> kind of thinking about emergence, I like, I  switched to a metaphor of the geode. So this  
> 1:01:15
> is kind of, you know, the geode is this, just  this hollow gap in some rock that is gradually,  
> 1:01:23
> there's these mineral laden fluid that's  coming in to this empty space and building  
> 1:01:30
> up these crystals. So that kind of helps to kind  of visualize the way these quantum possibilities  
> 1:01:38
> are sort of metaphorically this mineral laden  fluid that's crystallizing upon the measurement,  
> 1:01:45
> you know, interaction into these crystals that are  the structured spacetime events. Oh, by the way,  
> 1:01:53
> I'm hoping, I was notified by a buddy of mine  that, I think Avshalom Elitzer was mentioning,  
> 1:02:00
> you know, his formulation and some experiments  that he was kind of curious about whether TI,  
> 1:02:08
> you know, what TI might have to say about them.  And I, sorry, real quick kind of reviewed that a  
> 1:02:13
> little bit in case you want to talk about that. So  I had a conversation with Avshalom Elitzer and you  
> 1:02:20
> may have seen parts of it where he mentioned the  transactional interpretation directly. And so I'll   link that on screen as well. In it, he references  the transactional interpretation because of the  
> 1:02:31
> time symmetry for his interpretations. He mentions  the transactional interpretation also has that and  
> 1:02:37
> retrocausality, which Elitzer is actually a fan  of. He sees TI or the transactional formulation as  
> 1:02:44
> resonating with that and he sees some experimental  compatibility with it. So what are your comments?  
> 1:02:52
> Okay, well, I mean, I agree that there's certainly  an affinity between the two approaches in terms of  
> 1:02:59
> emphasizing the importance of post-selection  of, you know, what we would call, you know,  
> 1:03:06
> measurement outcomes and what they might  have to do with the process. Of course,  
> 1:03:11
> in TI, the absorber, the absorbing systems have a  lot to say about what observable you're measuring  
> 1:03:21
> and the nature of the set of outcomes that  you're going to be getting in terms of possible  
> 1:03:27
> outcomes for your experiment. So there's that  affinity. I guess where they differ, I mean, the  
> 1:03:36
> transactional formulation works with a specific  theory of fields, the direct action theory,  
> 1:03:42
> where you get a lot of mathematical content that  describes how these fields are interacting with,  
> 1:03:49
> you know, with the emitting and absorbing systems.  And that gives you a lot of this formalism,  
> 1:03:55
> as I mentioned earlier, that is already in the  standard theory. So in that sense, I feel like  
> 1:04:00
> it's more powerful at a fundamental level, that  it's more explanatory, that it generates a lot of  
> 1:04:08
> the formalism that we're already kind of working  with, but seems just kind of like we're helping   ourselves to these mathematical tools. But with  the transactional formulation, we get a reason  
> 1:04:20
> for where those tools are coming from. The time  symmetric vector formulation, in a sense, I mean,  
> 1:04:29
> formally would kind of correspond to, in a way,  half the transactional story. It would sort of  
> 1:04:36
> correspond to looking only at the offer wave  component that reaches every absorber. And so  
> 1:04:44
> it seems to me that it's only really able to work  with the conventional theory and take a particular  
> 1:04:55
> metaphysical approach to the conventional theory.  But it seems to me, you know, from what I've seen,  
> 1:05:01
> that it's not able to specify what counts as  a measurement. Though it inherits this TSVF,  
> 1:05:08
> you know, sort of inherits that lacuna of the  conventional approach to fields, where you're just  
> 1:05:14
> helping yourself to the fact that a measurement  happened. And if you have to describe all the  
> 1:05:20
> systems by these two-state vectors, then you must  specify for all future times all outcomes of all  
> 1:05:28
> measurements. So they all have to be stipulated.  That seems to be just a basic requirement of the  
> 1:05:36
> formulation, since it demands description by  a two-state vector. So for any quantum system,  
> 1:05:43
> you must always specify a measurement outcome  for some, you know, arbitrary date at any time.  
> 1:05:52
> So this, to me, implies a block world ontology,  just by what is required for using it. And then  
> 1:06:03
> the dilemma, you know, sort of faced by by people  who want to pursue that approach, is that if they  
> 1:06:09
> want to have becoming, as I understand  Professor Elitzer has talked about, then,  
> 1:06:15
> you know, I think you get into trouble. I mean, I  don't, I feel like the idea of getting things to  
> 1:06:21
> happen and getting things to emerge in a becoming  dynamic way is kind of foreclosed to you, because  
> 1:06:28
> you've already said all my systems are described  by two-state vectors. So you've stipulated for all  
> 1:06:33
> systems what all future measurements will be.  So there's that tension that it's trying to,  
> 1:06:42
> I feel like, again, there are a lot of, you know,  approaches, and this applies to other approaches  
> 1:06:48
> that call themselves retrocausal, is they want  that to be sort of a space-time retrocausation,  
> 1:06:54
> where things are literally going backward  in time. So it's restricted in that sense   to this literally forward in time, literally  backward in time. And whenever you do that,  
> 1:07:05
> you're really kind of working, if you think that  everything's happening in space-time, then you're  
> 1:07:11
> really kind of working with a block world picture,  and then you're putting a narrative on top of that  
> 1:07:16
> that sounds dynamical, that sounds like things  are going backward and forward, but you've   already helped yourselves to all events. They're  already there. So, I mean, I have a paper about  
> Retrocausality and Block World Dynamics
> 1:07:26
> this that I wrote back in, I think it was 2011,  on, you know, this issue for certain approaches  
> 1:07:33
> that call themselves retrocausal, but they are  really kind of working in a block world ontology,  
> 1:07:39
> and there's no real dynamics happening. So, yeah.  Is there any way to have what people think of when  
> Science Fiction and Time Travel
> 1:07:47
> they think about science fiction and time travel  within your framework? Oh, not in the usual sense.  
> 1:07:55
> I mean, you could probably talk about it in terms  of possible timelines. People sometimes like to  
> 1:08:02
> play with possible timelines, and you can always  do that, but they would be possible timelines.  
> 1:08:09
> They would be at the level of possibility. So,  I mean, it's like once you have, go back to  
> 1:08:15
> the geode, once you have a crystal in the geode,  there's a crystal in the geode. You can't undo the  
> 1:08:21
> crystal. It's there, you know? And again, another  metaphor that's useful is knitting a scarf. You've  
> 1:08:27
> got to knit that scarf. That scarf is emergent  from possibilities, which are the yarn, and  
> 1:08:33
> maybe design. I could look at a design book and  change my design at any time. I could change my   yarn at any time. But once that scarf comes out,  that scarf is there, you know? I mean, maybe you  
> 1:08:45
> could go back and... put more stuff on the scarf.  I don't know. I mean, people are imaginative.  
> 1:08:52
> I don't want to foreclose, you know, imaginative  storytelling. But in the usual sense, where people  
> 1:08:58
> are trying to work with it in physics is they're  sort of denying that, yeah, there's a scarf there,  
> 1:09:05
> and that's there. You admitted that's there, so  you can't just go back and say that now you're  
> 1:09:11
> going to change it. I mean, if you do that, then  you're just kind of dealing with multiple space   times, and then that comes out sometimes in sort  of the many worlds approach, you know? So this is  
> 1:09:21
> a form of actualism. What I would say is that it's  something that people are kind of pushed into when  
> 1:09:27
> they don't want to just allow that possibilities  are real, that perhaps physics is pointing to real  
> 1:09:35
> possibilities. Yes, often when people think about  possibilities in the physics sense, and they're  
> 1:09:41
> thinking about interpretations in many worlds, all  of those possible worlds are actualized. So are   you saying that this world is real, is actual,  and is singular? Well, the phenomena we see,  
> 1:09:56
> you know, in terms of what's actualized as a  space-time event, that I take as singular. I mean,  
> 1:10:04
> if people are free to explore the idea that these  possibilities get actualized in different worlds,  
> 1:10:11
> you know, I would not foreclose that. It's not a  necessary thing, you know? It's not a necessary  
> 1:10:16
> thing. The reason the many worlds, the Everettian  thing, the Everettian approach comes out of the  
> 1:10:23
> measurement problem and the inability to say what  counts as a measurement. And so they're forced to  
> 1:10:29
> just kind of look at, you know, went back to  the little train, the train with, you know,   the two engines and the two trains. Since they  have no theory of fields that lets them say  
> 1:10:39
> that an outcome happened, they just say they all  happened. But that has problems with, you know,  
> 1:10:44
> kind of helping yourself to the basis you want so  that you get the kind of phenomena that you see.   So there's some ad hoc stuff that has to go into  it. And it, you know, it also isn't really easily  
> 1:10:57
> incorporated into a relativistic treatment. There,  you know, it's strictly of the non-relativistic   theory that it's working with, and the  non-relativistic theory is just an approximation.  
> 1:11:07
> So, yeah. Bohmian mechanics has two qualities.  So one is hidden variables, and the other is a  
> 1:11:14
> preferred foliation. Do you have either of these?  No, no, I don't. The transactional formulation has  
> 1:11:21
> no hidden variables. Now, interestingly, you  could say it has no preferred foliation. But  
> 1:11:29
> one of the problems with the conventional approach  has been, you know, the way to kind of say, well,   what is sort of nature's preferred observable?  What are things really doing in a fundamental  
> 1:11:41
> way? And it seems like, it seems as though  there's an arbitrariness in kind of picking  
> 1:11:47
> that. But there really isn't, because at the  relativistic level, you get naturally preferred  
> 1:11:53
> observables. And those are position and, I mean, I  said that wrong. Those are energy, energy-related,  
> 1:11:59
> energy and momentum. So when you go to the  relativistic level, it's very clear. For instance,  
> 1:12:05
> there's no time-observable period at any level of  the theory. At the non-relativistic level, you can  
> 1:12:14
> say, well, there's sort of a position observable,  but it's really kind of an idealization. And that  
> 1:12:20
> breaks down at the relativistic level. There  is no position observable. And this is why  
> 1:12:26
> even in standard theory, position and time, the  space-time labels are reduced to parameters. They  
> 1:12:34
> are not observables. So it's very clear that at a  fundamental level, nature's preferred observable  
> 1:12:39
> is basically for momentum. And that's reflected  in the TI approach. That's what you get. You get  
> 1:12:49
> your transactions happening ultimately at  a relativistic level in terms of momenta.  
> 1:12:56
> You can have directional momenta in the  sense that you have a variety of absorbers,  
> 1:13:03
> and they're each going to receive a different  directional component of momentum. And that's  
> 1:13:09
> more of a relational thing. So it has to do with  the relations among these quantum systems. So you  
> 1:13:17
> don't really need to talk about space and time as  being real, but they are parameters of the map,  
> 1:13:27
> if you will. They're parameters of the map  that help us coordinate these relationships. So  
> 1:13:35
> there's kind of a relational view of space-time.  It's not saying that space-time doesn't exist,  
> 1:13:41
> but again, as Einstein noted, what the space-time  manifold really is, is an invariant set of events,  
> 1:13:49
> period. It's not about x or t. It's a collection  of invariant events. And we use x and t to  
> 1:14:00
> coordinate our observations among those events.  Now earlier we talked about electrodynamics, and  
> Emergence of Space-Time Events
> 1:14:09
> you grazed on gravity and somewhat grazed on the  weak interaction as well with the Schrödinger's  
> 1:14:15
> cat, although it was unclear to me the connection  between the transactional formulation and the weak  
> 1:14:21
> interaction. So what I'd like to know is, does TI  have anything to say about weak or strong? Well,  
> 1:14:30
> the transactional process that leads to the  emergence of space-time events occurs only through  
> 1:14:36
> the electromagnetic field. The other forces  are certainly in play at a fundamental level.  
> 1:14:44
> They govern the unitary interactions, the kinds of  scattering interactions, and so on. Now the weak  
> 1:14:51
> decay, the weak forces involved in decays, and of  course the Schrödinger's cat, you can illustrate  
> 1:14:56
> that with just a decay in terms of an excited  atom emitting a photon, if you want, right? So it  
> 1:15:01
> doesn't have to be, you know, it doesn't have to  be the weak force. But the weak force is certainly  
> 1:15:08
> really in there in terms of these unitary  interactions that transform, that kind of govern  
> 1:15:16
> these kinds of transformations among types of  particles, and so on. And that's very much part of  
> 1:15:21
> the transactional picture. So in other words, the  transactional formulation very much accommodates  
> 1:15:29
> all those fields. The thing that it treats  distinctly is the electromagnetic field, because  
> 1:15:37
> that's a massless gauge field. So you require a  massless gauge field to get you the emergence of  
> 1:15:45
> space-time. So these other ones have mass, and so  they are unstable in a sense, and they act only  
> 1:15:54
> really kind of locally at the quantum, at the  level of possibilities. Not locally, but they  
> 1:16:01
> act at the level of possibility, if you will.  So these are forces, force-based interactions,  
> 1:16:06
> the strong and the weak force that are going on,  metaphorically speaking, in the submerged portion  
> 1:16:11
> of the iceberg. But they're very, you know, TI  doesn't deny any of that. It's very much part of  
> 1:16:17
> the same physics. Another massless gauge field is  gravity, or at least under some interpretations of  
> 1:16:24
> quantum gravity, you have the graviton. So does  TI make any claims about that? So we deny that  
> 1:16:31
> gravity is a quantum field. So what we get, you  know, we basically say the mistake in, you know,  
> 1:16:42
> what's so problematic about trying to reconcile  the quantum level with the relativistic level is  
> 1:16:47
> trying to characterize gravity as a quantum field.  So gravity, we say, is not a quantum field. The  
> 1:16:56
> field is the metrical structure of the emergent  space-time end of story. And that's what Einstein  
> 1:17:04
> said, you know, he said that that's what the field  is. It's the metrical structure of space-time. So  
> 1:17:12
> it's a property of those sets of events. And so,  I mean, people who want, you know, who want the  
> 1:17:18
> detailed story of that, they want to see the, you  know, see the actual math, see the actual theory,  
> 1:17:25
> we do have an actual theory that derives the  Einstein equations from that picture. So then,  
> 1:17:33
> is the transactional formulation a theory of  everything? A contender for a TOE? Well, you know,  
> 1:17:40
> I guess I never like to claim that. I guess you  could say that it's a theory of the quantum level  
> 1:17:51
> and the space-time relativistic level. I guess I'm  not clear in myself that physics can explain, you  
> 1:18:01
> know, everything about reality, including people's  thoughts, motivations, and intentionalities,  
> 1:18:06
> consciousness. And so, from that standpoint, I  would never, you know, I would be a little more  
> 1:18:13
> modest about the reach of physics. But within  topics that are considered physical questions,  
> 1:18:22
> yeah, I mean, you could say that. Because it's  definitely providing an account of the interaction  
> 1:18:30
> of the quantum level with the space-time level  with the, you know, the relativistic level. And,  
> 1:18:36
> you know, it's quite straightforward. Yes, well,  in physics, the term theory of everything is just  
> 1:18:43
> for a framework that encompasses both gravity and  the standard model. Sure. Well, yeah, I mean, the  
> 1:18:53
> TI, the transactional formalism, again, is simply  contained in applying the direct action theory of  
> 1:19:02
> fields to the kinds of physics we're already  working with. And admitting that saying fields  
> 1:19:11
> propagate unilaterally in retarded fields only  is wrong, replacing that with the direct action  
> 1:19:17
> theory for the electromagnetic field. That's all  it is. And we're just showing how fruitful that  
> 1:19:23
> is, what you get out of it. So, I mean, the  transactional formulation does not purport to  
> 1:19:28
> explain the origins of quantum chromodynamics  or anything like that. But where appropriate,  
> 1:19:37
> the claim is that nature is behaving according to  the direct action theory of fields. And let's see  
> 1:19:44
> what that gets us. And we are already showing, you  know, how much we get from that. In many physical  
> 1:19:50
> theories, there are, in virtually all physical  theories, there are parts that don't change,  
> 1:19:56
> and then there are contingent parts. So, for  instance, the force equals mass times acceleration  
> 1:20:03
> for Newtonian mechanics, it doesn't change, but  initial conditions are contingent. So, what are  
> 1:20:10
> the parts of your theory that are contingent, and  what are more constitutive? Well, I mean, it's  
> 1:20:18
> really the same, you know. I mean, it's still the  case. The only thing different about this theory  
> 1:20:25
> is the way that the fields operate, the way  that the electromagnetic field behaves. So,  
> 1:20:30
> we're still going to have, you know, Newton's  laws as a suitable non-relativistic approximation.  
> 1:20:36
> We're still going to put in initial conditions,  you know. And in a sense, yeah, so none of that's  
> 1:20:43
> really going to change. But I think overall,  in the big picture, it's a more satisfying  
> 1:20:50
> account because, you know, you help yourself to  initial conditions that, at least for a quantum  
> 1:20:56
> situation in the conventional theory, are just  stipulated, you know. Like, you can't say why   you got a measurement result, you know. So, in the  transactional formulation, you can at least say,  
> 1:21:07
> well, there was a measurement interaction, and I  can explain why that happened. And then there was  
> 1:21:13
> perhaps a collapse to a result, but I can say why  there was an outcome available to me. So, yeah,  
> 1:21:20
> I mean, fundamentally, it's not going to change  those kinds of features of theories. Does it  
> 1:21:26
> have anything to say about Bell's inequalities or  the Kocken-Specker theorem? Well, those are basic  
> 1:21:35
> theorems that point to the non-locality of quantum  theory. And that is certainly still the case in  
> 1:21:45
> the transactional formulation. I mean, unlike some  interpretations, the transactional formulation  
> 1:21:51
> does not, at least as I've elaborated it, it's  not trying to preserve locality. This, I think,  
> 1:21:57
> is very much, you know, trying to cling to some  metaphysical ground rules that are not really  
> 1:22:05
> serving us well. The quantum world is non-local in  a sense that that's what the violations of Bell's  
> 1:22:13
> inequality and so on are showing us. And, you  know, maybe that's uncomfortable, but once again,  
> 1:22:19
> if you allow the idea that nature does have  this level of possibility, then it makes sense  
> 1:22:26
> that you're going to be observing things that look  non-local to you, that there are interactions that  
> 1:22:32
> can go on that seem to defy your expectation  that everything's happening in a space-time  
> 1:22:39
> container. So that, you know, I would say that's  very much, those are authentic implications of  
> 1:22:47
> the formalism of quantum theory in the sense  that there are non-local influences going on.  
> 1:22:56
> Okay, so two quick questions about that before  Kocken-Specker. So you said it looks non-local   to you. So does that mean that underneath  the iceberg there's some version of locality,  
> 1:23:06
> maybe it's not called locality, that is preserved,  and then when it gets emergent upward or in the   geode picture, it looks like it's violating  locality? Well, I mean, in the usual sense  
> 1:23:19
> that there are influences that seem to propagate  at speeds that seem to exceed the speed of light,  
> 1:23:28
> they are technically non-local. But where we  can gain some insight into those influences not  
> 1:23:37
> being something that we should forbid, you know,  it's helpful to look at the flatland metaphor,  
> 1:23:42
> you know, the flatland Edwin Abbott story where  there are flat shapes in a plane and they think  
> 1:23:48
> that's the entire reality. But if it isn't,  you know, then you can have these, you know,  
> 1:23:54
> the sphere hovering and coming and doing these  weird things that from the standpoint of the  
> 1:24:00
> flatland creatures look non-local and crazy  and know this can't be happening according   to the rules of my world, which tells me I can  only stay on this plane and only can do this,  
> 1:24:11
> right? But those rules don't apply to an entity  that has more degrees of freedom and more higher  
> 1:24:21
> space to work with. And that's the sense in  which I think these non-local interactions  
> 1:24:26
> are occurring. Strictly speaking, by the rules of  getting from here to there on flatland, they're  
> 1:24:35
> violating that. But it doesn't mean that they  can't really be happening and that we shouldn't,  
> 1:24:41
> you know, it means that, okay, there's just a  larger aspect to reality in which more kinds of  
> 1:24:48
> influences are possible. And again, these do not  violate relativity because the influences that  
> 1:24:55
> are happening are not sending light signals.  You know, so it's conforming to relativity,  
> 1:25:03
> but it's violating our sense of propriety  concerning what we think should happen in   flatland. And so what I'm saying is let's let  go of that, you know, that restrictive sense of  
> 1:25:14
> what's okay and what isn't okay in terms of what's  physically happening. So yeah, non-locality from  
> 1:25:21
> the standpoint of influences being able to be  communicated that don't depend on light signals,  
> 1:25:31
> yeah, that does happen in the direct action  theory. And it's okay. It's not something nature's  
> 1:25:38
> not allowed to do just because we don't like it.  So is the non-locality just a correlation or is  
> 1:25:46
> there causation to it? Well, this depends what you  mean by causation. For instance, the scattering,  
> 1:25:54
> you know, interactions that you referenced  earlier, those are brought about in terms  
> 1:26:01
> of non-local connections among the electrons. So  that time-symmetric propagator that connects those  
> 1:26:08
> electrons and their scattering, it's clearly doing  something. It's causal in the sense that it's  
> 1:26:14
> doing something, but it's pre-measurement. It's  not something that is connected to a space-time  
> 1:26:22
> event. It's part of the sort of behind-the-scenes  dynamics that's building up to make certain events  
> 1:26:29
> more probable than others. So it's definitely  doing something physically efficacious, but it  
> 1:26:35
> still respects relativity in that, you know,  it's not something where you're using a light,  
> 1:26:42
> controllable light signal and sending a signal  from A to B and so on. It's happening at a subtler  
> 1:26:49
> level. You don't violate the null signaling  theorem? That's correct. Not at all. I see.  
> 1:26:55
> Yeah. Okay, so let's get to Kochen-Specker. What  is your account of it? And also, can you please  
> 1:27:00
> tell the audience what that theorem is? Well, the  Kochen-Specker theorem is basically a theorem that  
> 1:27:07
> shows that what kinds of phenomena you can come  up with are contextual. You know, that you cannot  
> 1:27:16
> say, for all observables, I can assign a yes  or no answer, you know, for all cases. And this  
> Weak and Strong Forces
> 1:27:24
> has to do with the fact that Heisenberg's  uncertainty principle and the fact that   observables don't commute. So it's a consequence  of the non-commutativity of these observables,  
> 1:27:35
> that only, you know, for two observables that  don't commute, like position and momentum at  
> 1:27:41
> the non-relativistic level, you can't just say,  you know, I can assign a determinate momentum  
> 1:27:49
> property for this system for all cases and also a  determinate position. You know, that it's really  
> 1:27:57
> this position and not all of these others. So  you can't just have a space where you clearly  
> 1:28:02
> lay out determinate yes or no, whether this system  has, you know, this momentum and that position.  
> 1:28:10
> You can't make a collection of these outcomes  for mutually incompatible observables in this  
> 1:28:16
> way. And this is perfectly fine. This is a feature  that one would expect at the level of possibility,  
> 1:28:26
> because again, you know, possibilities are  not determinate outcomes. And while you have  
> 1:28:35
> – it's a feature of these possibilities that when  a system can be said to, you know, has been, say,  
> 1:28:43
> set up or prepared in some determinate state of  momentum, it really does not have a determinate  
> 1:28:50
> position. And this is simply because, you know,  in the transactional approach, we would say,   well, it hasn't transacted. If it hasn't  transacted, if it's clearly got a momentum,  
> 1:29:03
> it hasn't engaged in a determinate kind of  measurement interaction that would create an  
> 1:29:14
> event. And we always end up sort of specifying  events with spacetime parameters, but again,  
> 1:29:20
> these are all frame-dependent. So it's just a  fact, it's the way these possibilities work,  
> 1:29:28
> that by definition, if you have a determinate  momentum, you are behind the scenes. You're not  
> 1:29:36
> engaged in a particular transaction that would  actualize a spacetime event. So it's kind of  
> 1:29:43
> a natural outcome. There's no reason to expect  that a system, you know, a quantum system that  
> 1:29:49
> is existing at this level of possibility should  be a spacetime object, right? The expectation  
> 1:29:57
> that we want things to be non-contextual or the  surprising fact about the surprising, you know,  
> 1:30:05
> effect on us of the Kochen-Specker theorem is that  it contradicts our desire that everything seem  
> 1:30:11
> to be having a determinate momentum and position  because that's kind of what it looks like at the  
> 1:30:17
> macroscopic level. But in fact, at the quantum  level, that's not the case. So speaking about  
> 1:30:24
> these possibilities and they have probabilities  associated with them, do you have a philosophy as  
> 1:30:29
> to what these probabilities mean? Like there are  different approaches, frequentist, propensity,  
> 1:30:35
> Bayesian. What are these probabilities exactly?  I mean, I would call these propensities the kinds  
> 1:30:43
> of probabilities that we get from the Born rule  that comes out of the transactional formulation. I  
> 1:30:50
> think the most natural way to interpret them is as  propensities for actualization. They're weights,  
> 1:30:56
> if you will. So I, you know, you can kind of see  it as a weighted symmetry breaking that there has  
> 1:31:01
> to be something, something indeterministic that's  happening to actualize one outcome over others,  
> 1:31:10
> but that that's weighted so that it's not, it's  not always equal probabilities. And the Born rule,  
> 1:31:18
> is that able to be derived from something  more fundamental or is it assumed? Oh, no,   exactly. It is derived. It comes right out of  the physics of the direct action theory. And  
> 1:31:28
> so that's what I've shown in papers and in my  books. And the most recent one is the Cambridge  
> 1:31:34
> second edition that came out in 2022 called  the Transactional Interpretation of Quantum  
> 1:31:40
> Mechanics. It's subtitled A Relativistic  Treatment. So that version has, you know,  
> 1:31:46
> updates on the relativistic development, but it  also does go through the where you get the Born  
> 1:31:51
> rule from the transactional picture. So that  also, I think, is one of the selling points  
> 1:31:57
> of the transactional formulation is that the  Born rule is derived from it rather than just,  
> 1:32:03
> you know, Max Born. I mean, it's kind of funny  how he, in a paper in 1930, he originally  
> 1:32:09
> talked about wave functions as probabilistic  descriptions, but he realized that the amplitude,  
> 1:32:18
> that's just an amplitude. It doesn't behave like a  probability. It's complex and so on. And he said,   well, to get the right mathematical behavior, you  need to square this thing. So that's how we got  
> 1:32:28
> the Born rule. It was totally ad hoc. I mean,  obviously a smart idea, but it was an ad hoc,  
> 1:32:35
> look, the amplitude isn't giving me the right kind  of number, so I better square it and then I'll get   the right kind of number. So we can do better than  that in the transactional formulation. To you,  
> 1:32:47
> what makes something ad hoc? Because some people  may hear backward traveling waves, even though  
> 1:32:53
> you have some issues with that, or they'll hear  handshakes and they may see that as, oh, that's ad   hoc. So what makes something ad hoc? Where there's  no theoretical basis for it. You have to help  
> 1:33:05
> yourself to it in order to get things to come out  according to the empirical observations. A prime  
> 1:33:12
> example is the Ptolemaic geocentric model of the  solar system. So the epicycles, those are ad hoc,  
> 1:33:24
> right? I mean, he had stuff that was, okay,  everything's going around the Earth. Oh, I've got  
> 1:33:29
> this stuff. Why is that planet going backwards?  It looked like it was going backwards. It's  
> 1:33:37
> a band-aid. How can I patch up my theory? It's  basically saying, this is kind of an anomaly. My  
> 1:33:43
> theory's having trouble explaining this. I better  come up with a band-aid to patch that up. That's  
> 1:33:52
> kind of what it is. And some people might, you  have to be careful because some people might say,  
> 1:33:59
> well, backward stuff is ad hoc. Well, if they  don't know what the theory is, they don't have  
> 1:34:05
> any basis for judging whether something is ad  hoc or not. So you have to know what you're   working with. What is the theoretical model? What  are the phenomena? Can the theoretical, does the  
> 1:34:17
> theoretical model predict these phenomena? If  so, there's nothing ad hoc about the theoretical  
> 1:34:23
> model. It becomes ad hoc when the theoretical  model is failing. It has a gap or is saying  
> 1:34:33
> something different than what you see and you  want to keep your model. You start band-aiding.  
> 1:34:38
> You start patching it up. Those are ad hoc things.  Or when you'd have no model and you just say, uh,  
> 1:34:45
> you know, and that's kind of what the Born Rule  was. It works, but there was no theory behind it.  
> 1:34:55
> Ruth, what was the most difficult decision you  made during your career? Oh, probably to switch  
> 1:35:05
> from physics to philosophy. I started out, I got  into physics because I thought electromagnetism  
> 1:35:15
> was magic. I was just enchanted by it. I'm  enchanted by light and, you know, the fact that,  
> 1:35:22
> you know, back when I was a child, you know, that  you could have a prism and see white light being  
> 1:35:27
> broken up into colors and just, I was enchanted.  So I was enchanted by physics. It's also in my  
> 1:35:33
> family. I have a lot of family members who are  physicists. And when I went into physics at the  
> 1:35:40
> graduate level at the University of Maryland and  came across the EPR, the Einstein-Podolsky-Rosen,  
> 1:35:47
> you know, thought experiment and so on, and  the non-locality, that's when I became really  
> 1:35:53
> fascinated with these puzzles, with the paradoxes  of quantum theory. And it was at that point,  
> 1:35:59
> after I got my master's, that I decided I really  wanted to pursue that kind of examination. And I  
> 1:36:05
> learned that they were doing that in the  philosophy department with Jeffrey Boob,   Alan Stairs, and some people there. So that  was a tough decision, but I'm really glad  
> Transition from Physics to Philosophy
> 1:36:15
> that I made that decision. Now, I guess a  meta question. Was that decision yours to  
> 1:36:21
> make under your framework? Is there free will?  Oh, yes. Yeah. I mean, I think, and I've argued,  
> 1:36:28
> I have a couple of papers on this, and I address  it in my books, that, I mean, free will. We have  
> 1:36:34
> constrained will. We're not completely free, but  there are live choices. I believe there are live  
> 1:36:40
> choices. And I've also argued that there is no  sense in which physics rules that out. I mean,  
> 1:36:46
> it's very common for physicists to issue these  edicts, you know, that say physics says we  
> 1:36:52
> do not have free will. And that's very much  incorrect. Those kinds of judgments are made  
> 1:36:58
> based on certain interpretations of the physics  and certain unnecessary kinds of metaphysical  
> 1:37:06
> presuppositions that people bring into it  that they may not be aware they have. So yeah,  
> 1:37:12
> physics definitely allows room for there  to be real live choices. And in fact,  
> 1:37:17
> I've argued that quantum theory actually suggests  that, that that's what's happening in nature.  
> 1:37:24
> Okay, so I assume what you're referring to  is libertarian free will. Am I correct? Yeah,  
> 1:37:29
> I mean, I don't necessarily go along with all  the traditions of that, of that approach. But  
> 1:37:36
> you know, I think there's, there's physics leaves  room for there to be unpredetermined choices on  
> 1:37:45
> the part of agents. Now, what counts as  an agent is a huge question, you know,  
> 1:37:51
> that physics may or may not have anything to say  about. But physical theory definitely allows for,  
> 1:37:59
> you know, I mean, even Heisenberg talked about  photons making choices when deciding whether to  
> 1:38:05
> go through a polarizer or not. So, so there's  room in physics for that, for live choices.  
> 1:38:15
> If the transactional formulation doesn't care or  doesn't make claims about observers, and observers  
> 1:38:23
> are tied to consciousness and consciousness is  tied to free will, which feel free to dispel any   of those claims that I just made, then I find it  difficult to see how TI can have something to say  
> 1:38:35
> about free will in a libertarian sense. Because it  sounds to me like it would just be probabilistic.  
> 1:38:41
> And if it's just probabilistic, I don't see where  the choice is, if it's already given to you by the  
> 1:38:46
> Born rule, unless it's non-deterministic, where  the probability distribution is not known. No,  
> 1:38:52
> the probability distribution is given by the  Born rule. I mean, I would never say that the  
> 1:38:58
> transactional formulation has anything to say  about free will. This is just me talking, but  
> 1:39:10
> suppose I think that nature does behave this way.  I happen to think it does. I mean, if somebody  
> 1:39:16
> found something terribly wrong with this, I'd  re-examine that. But if nature really does work  
> 1:39:25
> in a way according to this direct action theory  of fields, that in itself is a different subject  
> 1:39:32
> from free will, all it does is say, physics won't  forbid it. That's the most that it can say. If  
> 1:39:40
> this physical theory is genuinely indeterministic,  then it leaves room for there to be some theory of  
> 1:39:50
> free will. It doesn't tell you there is or isn't.  It just leaves room for it. Which is opposite  
> The Nature of Free Will
> 1:39:57
> from, you know, many physicists will say, physics  tells you you don't have free will. And I really   don't think that's a fair thing to say, right?  So that's, it's delimited in that way. I mean,  
> 1:40:07
> me just speculating, I obviously consciousness,  I mean, personally in my own views, I do think  
> 1:40:18
> that you're going to have trouble accounting for  consciousness if you're materialistic. And if you  
> 1:40:23
> assume the Cartesian dualism type thing, or if  you assume that physical matter is as Descartes  
> 1:40:32
> envisioned it, which means it's dead, it's by  definition non-sentient, then you've got the hard  
> 1:40:38
> problem and you're not going to get consciousness  out of that. So that's my view. And I think that,   you know, consciousness is something that's  much more fundamental than any physical theory.  
> 1:40:48
> Interesting. So you think what lies underneath  the iceberg of the iceberg is consciousness? Or  
> 1:40:53
> perhaps it's the ocean? Well, yeah, I really think  so. I mean, just in a purely logical sense, folks,  
> 1:41:00
> if you're going to say that the building  blocks of nature are dead and non-sentient,  
> 1:41:06
> then forget it. You're not getting consciousness  out of that end of story. So I'm, just to be  
> 1:41:12
> logically consistent with myself, I am forced  into a posture of saying that consciousness  
> 1:41:18
> must be in there at the basis of everything.  It's just on a logical basis. I mean, you know,  
> 1:41:24
> by the hard problem. There's only a hard problem  if you assume that everything's dead. So, I mean,  
> 1:41:36
> physics doesn't need to postulate that matter  is dead. I mean, why do that? There's no reason  
> 1:41:42
> to. It's unnecessary. It's just a metaphysical  choice that's optional. In my opinion. You know,  
> 1:41:52
> seems like it, you know, like I can say, well,  there's matter that described physics deals  
> 1:42:00
> with something we call matter. I'm not going to  add to that that has to be dead. Why would I do  
> 1:42:07
> that? That's stupid. You know, like, why do that?  I don't, I mean, that's just an assumption. It's  
> 1:42:13
> dead. Why do we have to assume physics describes  dead stuff? You don't have to. There's no reason.  
> 1:42:19
> Or non-sentient. I'm going to define matter is  non-sentient. Why? Nobody put a gun to your head.  
> 1:42:26
> You didn't have to do that. You know, you can,  you know, I mean, to me, it's kind of hubristic.  
> 1:42:32
> Just say, okay, you don't know what life is. You  don't know what consciousness is. So that doesn't   mean you have to forbid it from being part of  your theory. Just say your theory doesn't have  
> 1:42:41
> anything to say about it. Maybe later it will, you  know, so. That's my position is don't foreclose  
> 1:42:51
> possibilities if you don't have to. Would you  say that rivers or rock or snow or H2O or carbon  
> 1:43:02
> dioxide have experiential elements to them or that  they're conscious? I don't know. I mean, I can't,  
> 1:43:10
> I can't assert that. But it's, I mean, Heisenberg  himself said that the photon is making a choice  
> 1:43:18
> whether to go through the polarizer. So maybe  they do. I mean, you know, again, that's, that's a  
> 1:43:24
> question of at what level could you say something  begins to be like self-conscious or begins to be  
> 1:43:29
> deliberative in it? You know, I don't know, you  know, who knows that I don't purport to have   those answers, but certainly that, you know, the  indigenous traditions thought so. You know, and  
> 1:43:39
> people might say, well, they weren't scientific.  Well, maybe they were, but in a different way. So,  
> 1:43:45
> I mean, people have, have traditions that, that  kind of take that for granted. And of course,  
> 1:43:50
> those kinds of traditions are usually, are  usually, you know, dismissed by, by the Western  
> 1:43:58
> approach. But, you know, maybe we need to be a  little more open-minded. I mean, we still have to  
> 1:44:04
> be physically rigorous. And I started out on this  exploration being very much, you know, like a Sam  
> 1:44:09
> Harris person, type person who deprecates anyone  who talks along these lines, who talks about,  
> 1:44:18
> you know, things that, that are not strictly  materialistic and involving Cartesian dead matter.  
> 1:44:23
> So I've been there. So what changed you? That it's  logically inconsistent. You can't, you can't get,  
> 1:44:33
> I mean, that's the main thing. You can't get  consciousness if you, if you preclude it from   the outset on a logical basis. And, you know, and  also I, you know, I happen to be a philosopher,  
> 1:44:44
> and I happen to be interested in various spiritual  traditions, and I'm, I'm a yoga teacher, so I  
> 1:44:49
> know something about Indian philosophy. And, and  I've, I've come to respect other traditions and  
> 1:44:56
> other ways of knowing as having some insight and  having, you know, approaches to knowledge that,  
> 1:45:04
> that maybe are not within the kind of Western  usual scientific paradigm and, and along with its,  
> 1:45:12
> its sort of constraints. But, but I've come to  respect the, you know, the, some of the wisdom  
> 1:45:17
> of those traditions. So while I would never  try to mix them, you know, I don't, I don't,   I think there are different ways of knowing, and  I try to be scientifically rigorous. And when I'm  
> 1:45:25
> working with physics, I don't postulate stuff  that I don't think I, is warranted. And I try  
> 1:45:33
> to be logically consistent and, and try to see  where the theory leads me. But, you know, when   it comes to things like consciousness and life,  physics needs to be a little bit more modest and,  
> Consciousness and Physicalism
> 1:45:44
> and needs to understand what's within its domain  of, of accountability and what isn't, what it can  
> 1:45:52
> explain and what maybe what it can't. And that it  shouldn't, that, that scientific inquiry doesn't  
> 1:45:59
> need to be constrained and circumscribed by  optional metaphysical premises that maybe  
> 1:46:06
> were useful as kind of training wheels. I think  of them as kind of training wheels, you know,   that sort of mechanistic approach that led to  Newtonian mechanics and so on. But at some point,  
> 1:46:16
> maybe you need to like recognize what's your,  what's on your bike, what's your bike that's   really going to get you places and what are  training wheels that are holding you back?  
> 1:46:25
> And I think that's where we are now, with the  mechanistic way of looking at things. Do you  
> 1:46:32
> think that we're being held back from further  physical inquiry? Is that what this bicycle,  
> 1:46:39
> this, the tricycle being too slow metaphor is  talking about? Or is it something like spiritual  
> 1:46:44
> advancement that is holding us back from? Well,  I mean, really, in terms of physics, we're being  
> 1:46:50
> held back, I think, from some, from progress in  solving a lot of these problems by physicists  
> 1:46:58
> not really wanting to consider this direct  action picture, this transactional formulation,  
> 1:47:03
> because it violates their training wheels. Because  it violates this kind of mechanical, forward,  
> 1:47:11
> always forward-directed space-time is the entire  domain of what's physically real. Those kinds of  
> 1:47:19
> presuppositions, it challenges those. And I  think of those as the training wheels in the  
> 1:47:25
> field of physics. And I mean, again, as our  publications show, we already have presented  
> 1:47:31
> solutions to problems that you'll see people, you  know, I see papers constantly come out and say,  
> 1:47:38
> measurement remains enigmatic in quantum theory.  Nobody knows what a measurement is. And I'm like,  
> 1:47:43
> well, I've been telling you what it is since  2012, you know, and Cramer did 1986. So this is,  
> 1:47:51
> that it's bouncing off, that the answers are  there and they're bouncing off because the   conventional approach is still, I want my training  wheels. Because the price for accepting these  
> 1:48:01
> kinds of solutions is you got to let go of your  training wheels and you have to let go of your  
> 1:48:07
> demand for what you call locality, your demand for  determinism and mechanical explanations. And those  
> 1:48:15
> are the training wheels. If you let go of those,  you have answers to these problems. We've got the  
> 1:48:20
> publications. We've got the answer to reconciling  the quantum level with relativistic level. It's  
> 1:48:26
> out there. You know, and so when people say, we've  still got this problem, this unsolved problem of  
> 1:48:34
> how to reconcile quantum theory with relativity.  Well, read the physics communications paper that  
> 1:48:42
> we've put out in 2024. You know, the answer's out  there. So it's a question of seeing it, you know,  
> 1:48:49
> seeing that there's an answer and maybe you  don't want to see it because you don't want  
> 1:48:55
> to lose your training wheels. Do you believe that  the primary reason for physicists not taking, say,  
> 1:49:04
> the transactional formulation seriously is because  of their recalcitrance or their ignorance and that  
> 1:49:12
> if only they would read it and not be so blinded  by their preconceived notions that they would  
> 1:49:19
> be accepting of it? Or do you see that actually  there are some substantive issues or challenges  
> 1:49:25
> that remain with it? Because even when I speak  to people like Penrose or to Avshalom or almost  
> 1:49:31
> anyone who has their own formulation of quantum  mechanics, they'll say something similar. Like   Penrose may say, well, we have this conception  that there's computability at the forefront of  
> 1:49:41
> the brain. If only we would get rid of that and  we would understand that consciousness is what  
> 1:49:46
> collapses or what is produced by the collapse of  the wave function. Then if only physicists would   take that seriously or Avshalom with, if only  physicists would see that there is something  
> 1:49:55
> actually unique about the now and it's not a  blocked time, etc, etc. So almost each person   will say, if only physicists would so-and-so  remove their prejudice. And so I'm just curious  
> 1:50:07
> what you think. Yeah. Well, I do think that, you  know, I wouldn't call it ignorance, but I mean,  
> 1:50:13
> you know, it took the heliocentric, Heracopernus'  heliocentric model, 200 years to be accepted.  
> 1:50:22
> You know, we have to be patient, I think, for  progress. Because again, you know, there's a  
> 1:50:28
> certain tradition. And traditions are valuable.  They provide structure. They do yield progress,  
> 1:50:36
> but then they can become constraining. And  it's a slow process for people, you know, as  
> 1:50:41
> a community to start to get a little distance, get  a little distance from metaphysical conditions and  
> 1:50:49
> see what they are first. What are my metaphysical  assumptions that I'm bringing to this? Do I really  
> 1:50:57
> need these? Are these things that are maybe not  necessary? And to have the option of letting go of  
> 1:51:02
> it, you first have to see that it's not necessary.  So, you know, it's a gradual process. For those  
> 1:51:10
> other, you know, obviously those are alternative  approaches, but their interpretations, well,  
> 1:51:16
> I mean, Penrose has a certain kind of a collapse  formulation. His approach is actually empirically  
> 1:51:24
> distinguishable from the conventional theory.  So he has a different mechanism for collapse.  
> 1:51:29
> But anyone, again, it's true that anyone  who's challenging a prevailing, you know,  
> 1:51:35
> conventional approach has to be patient. Because  it is, you know, a process of people deciding,  
> 1:51:43
> people choosing to become aware of what am I  bringing to this? Do I need to bring this in?  
> 1:51:49
> Do I need this expectation to be an imposition on  what the theory could be? Or maybe my expectation  
> 1:51:57
> is optional, and maybe nature has a different way  of behaving. So it's a gradual process and you  
> 1:52:03
> have to be patient. What are the parts of TI that  you're working on? Like, what are the holes that  
> 1:52:10
> currently exist? And sure, they can be patched  up, but where do you see its shortcomings? Well,  
> 1:52:16
> currently, I'm not finding any holes in the sense  that it's failing to account for X. You know,  
> 1:52:24
> I'm not finding holes. What remains to be done is  to elaborate the consequences of the predictions  
> 1:52:36
> of the model. And that's very much, I'm  getting some help from some colleagues of mine,  
> 1:52:42
> Andrea Schlatter, who's working on the general  relativity aspects, and a new collaborator whose  
> 1:52:49
> name I won't mention yet because he's maybe not  fully working on it yet. But I've gotten some  
> 1:52:57
> very promising communications from someone who's  working on the quantum field theory. And so it's   mainly elaborating the consequences. And I'm, you  know, frankly, I'm not seeing any holes in the  
> 1:53:08
> sense of it's falling short of accounting for X.  And I haven't gotten any such criticisms. When I  
> 1:53:16
> get criticisms, what I always find is that they're  working with like an earlier version of the model  
> 1:53:22
> that hasn't, they haven't updated themselves, that  the critics are not updated to the latest work and  
> 1:53:28
> they are not, haven't done their homework, so to  speak. So I have not gotten any criticism from  
> 1:53:34
> someone who's actually read the material saying,  well, you can't explain X. I haven't gotten  
> 1:53:40
> anything like that. Coming back to holes, not  with the TI, but with physicalism, the response  
> 1:53:47
> from someone like a Neil deGrasse Tyson to saying  that, well, consciousness may be at the basis and   physics doesn't explain everything. He may say  something like, okay, well, look, if we take a  
> 1:53:57
> look at psychology, then that becomes neurology,  which becomes chemistry or biochemistry, which  
> 1:54:03
> becomes chemistry, which becomes physics. At what  point of this conversion is there a failure that  
> 1:54:08
> you can point at? If you can find a point at which  one of the layers doesn't emerge from the previous   one, well, you'd win a Nobel prize, like find,  show me where the laws of physics fail. So what  
> 1:54:18
> do you say to that? Well the laws of physics  fail right away, again, on the hard problem,  
> 1:54:24
> if by, if Neil deGrasse Tyson assumes that matter  is non-sentient. If, if, I don't know. I mean,  
> 1:54:33
> if, in other words, if you want to be what they  call materialist. He claimed to be a materialist   when I was speaking with him. Well, he's already  failed on the hard problem then. Okay. You know,  
> 1:54:42
> and this, you can see that in his desire to reduce  internal conscious experience to neurons. Neurons  
> Challenges to Materialism
> 1:54:52
> presumed to be made of dead, non-sentient matter.  That is an optional metaphysical choice that in  
> 1:54:58
> his mind he sees as mandatory and he wants to  impose on everyone else and, and, and pass judge,  
> 1:55:04
> negative judgment on them if they don't do  what he does. So much as I admire, you know,   him, his accomplishments, it, that, that's a form  of hubris in, in being reductionist in that way.  
> 1:55:16
> And it's just kind of a casual, naive approach  to these really nuanced, important, you know,  
> 1:55:22
> subtle problems where he, he doesn't, he hasn't  even figured out that he's already failed on the   hard problem. So this is what you often get  with physicists, materialist, physicalist,  
> 1:55:36
> kind of dabbling, if you pardon the expression,  besides being a little pejorative in, in these,  
> 1:55:42
> in these issues where they don't even notice  where they're contradicting themselves. And   it's kind of embarrassing. Now if you had to give  a single killer app, like a single great feature  
> 1:55:56
> of the transactional approach that there are  researchers who are watching, just so you know,  
> 1:56:01
> there are professors of physics and computer  science and mathematics and so on who watch.   And then there are also young researchers who  want to get into the field. They're listening  
> 1:56:11
> and they want to know, okay, what would it be  that if I was to play them this, the next five  
> 1:56:17
> minutes or the next three minutes, what would  it be? What would be the killer app that would  
> 1:56:23
> make your approach superior to the alternatives?  Well, a killer app, you know, this again gets to  
> 1:56:30
> the, the desire to have a formulation, have a,  have a new product, a new spinoff that the, the,  
> 1:56:39
> the old paradigm did not predict. New something  new. We want something new. You know, like my  
> 1:56:44
> nephew, Drew, who does amazing, you know, virtual  reality apps and, and he's, he's brilliant. No,  
> 1:56:52
> I'm sorry, folks. All this gets you is a solution  to the measurement problem. It gets you the  
> 1:57:00
> reconciliation of quantum. Theory with general  relativity, it derives, it gets you, you know,  
> 1:57:07
> a quantum theory of gravity from a direction  that maybe you weren't expecting, and maybe you   don't even want, but it's the solution to many  purported problems. And so that's, that's the  
> 1:57:18
> killer app that it gets you, you know, that, that  we need to remember that the conventional physics  
> 1:57:24
> set people are working with fails to tell you why  you ever got a measurement outcome. It fails to  
> 1:57:31
> do that. And so, so that's what this will get you.  It gets you consistency. It gets you a physically  
> 1:57:37
> consistent theory that, that doesn't founder on,  on such, you know, thought experiments as, as the  
> 1:57:43
> Wigner's friend experiment, the Froschinger-Renner  inconsistencies, it gets you theoretical  
> 1:57:49
> consistency and it gets you reconciliation among  these different levels of the theory. So I think  
> 1:57:54
> that's quite a lot, you know, maybe not a killer  app, but it solves a lot of problems that people   say they're concerned about. So in other words,  you're saying, forget killer app, I'm going to  
> 1:58:04
> give you the whole phone for which all the other  apps are based. So I think so, you know, and it's  
> 1:58:09
> like, well, it often, it's like, well, we don't  want that phone because you're saying, you know,   you're saying that space time is not the delimiter  of everything real. And we can't, you know, that  
> 1:58:19
> bothers us. I'm like, well, you know, I'm sure the  heliocentric theory really bothered the church,  
> 1:58:26
> really bothered a lot of people who had been  brought up to believe that. And I understand  
> 1:58:31
> that. I am sympathetic to it. But, you know, this  is a solution and people who want to, you know,  
> 1:58:38
> want solutions and are willing to think about  what training wheels they might be working with,  
> 1:58:45
> they might not recognize as what they thought were  important theoretical, you know, square one ground  
> 1:58:54
> rules and actually unnecessary constraints  that you don't need to be working with. How  
> 1:59:01
> can we generalize or how can you generalize the  transactional approach to address open quantum  
> 1:59:07
> systems where density operators evolve according  to Lindblad type master equations? Oh, absolutely.  
> 1:59:13
> I mean, it's completely general. So I mean, any  kind of, you know, it's not at all restricted to  
> 1:59:21
> closed systems. I mean, it's a completely  general approach. So, you know, Lindblad  
> 1:59:27
> equations and master equations, a diffusion type  equations, if that if I understand correctly, that  
> 1:59:32
> that. Yeah. In fact, I've written about how that's  in my book, my my CUP 2022 book about how we get,  
> 1:59:41
> you know, master equations make a lot more sense  in the transactional picture. Because once again,   you know, within thermodynamics, when you're  dealing with a master equation that's telling  
> 1:59:50
> you about equilibrium conditions and approach  to equilibrium, you actually have to do a little  
> 1:59:55
> fudging and help yourself to a probabilistic  description when conventional theory,  
> 2:00:01
> the conventional quantum theory will not let you  do that or it won't let I mean, it won't give you   any reason to do it. So that's where there's like,  well, we'll just wave our hands and we'll say,  
> 2:00:10
> well, we think we have probabilities now and  now we will use our master equations. So in   the transactional approach, you don't have to  wave your hands over that. You clearly have  
> 2:00:19
> real physics that tells you why you get master  equations. What is the Afshar experiment? Oh,  
> 2:00:30
> okay. So the Afshar experiment was a clever  way of, of looking like it was measuring two  
> 2:00:38
> non-commuting observables in the same experiment,  and thereby, you know, violating, you know,  
> 2:00:46
> kind of violating the uncertainty principle, or  at least the Bohr's notion of complementarity,  
> 2:00:53
> and it wasn't doing that at all. Like what, so  what, I mean, again, it's fine to do experiments,  
> 2:01:00
> and it was a lovely experiment. What we, what  we, where we get into trouble is, is talking  
> 2:01:06
> about the implications of experimental results  and the bearing of the experiment. And here's  
> 2:01:12
> where I think Afshar went a little too far in his  interpretation. And what I've written about, and  
> 2:01:18
> I can give those, that reference if people want,  is that we had, we had a measurement of the, you  
> 2:01:23
> know, formally equivalent to having, preparing a  particle, say, up along X, measuring it again and  
> 2:01:32
> saying, yeah, it's up along X, and then measuring  it along Z and getting some answer. That's all  
> 2:01:38
> it was. So it was, there was nothing, you know,  it looks more impressive when you do it in the,  
> 2:01:44
> in the kind of, you know, position basis and so  on. But all it is was, you know, a preparation,  
> 2:01:51
> a confirmation of the prepared state, and then  a measurement of a non-commuting observable. And  
> 2:01:57
> that's all it was. So, so, you know, it's fine to  do experiments. And where you get into trouble is,  
> 2:02:04
> is making claims about what the experiment  showed you, when those claims aren't necessarily  
> 2:02:10
> supported by the experiment itself. Now, I have  one last question from the creator of Formscapes,  
> 2:02:18
> which is a YouTube channel. I'll put the link on  screen and in the description. He says, I assume  
> 2:02:23
> the topic of reverse causation is going to come  up. So I'd like to suggest a question. How does   Ruth feel about the possibility of interpreting  these phenomena as indicating that separate  
> 2:02:32
> entities are already interconnected by default,  rather than interpreting them as indicative of  
> 2:02:38
> reverse causation? Well, yeah, I mean, I think at  a subtle level, that that's a good way to look at  
> 2:02:46
> it, that these apparently separate entities, I  mean, certainly if they are charged particles,  
> 2:02:52
> they are always connected in the direct action  picture. By the time symmetric propagator,   by so-called virtual photons. And so they are  always connected. And that's, and in that sense,  
> 2:03:01
> are never truly separate. So, so I, I personally  think, you know, I mean, I'm not sure that what  
> 2:03:08
> the, what the questioner has fully in mind,  but certainly at a basic level, you know, at a,  
> 2:03:14
> at a superficial level, I prefer to think of, of  the phenomena that we see as coming out of these,  
> 2:03:22
> these connectedness, this connectedness that  exists already at the level of possibility,   that is physically real, and that, and that the  emergent phenomena are coming out of that, rather  
> 2:03:33
> than, you know, rather than saying that things  are literally going backward in time, because I   just don't think the physics gives you that. What  advice do you have to the younger generation? And  
> 2:03:46
> I should say that when I say younger generation,  there are also people who are in their fifties,   in their sixties and seventies. And actually  there's someone who is in their eighties,  
> 2:03:54
> who was just getting their PhD, emailing me.  So. Wonderful. I just mean people who are not  
> 2:04:02
> done with their research. Wonderful. Well, I would  just say, you know, do a lot of introspection, you  
> 2:04:10
> know, try to, when you're looking at, at theories,  and when you're looking at presentations of ideas,  
> 2:04:18
> try to be a critical thinker and to kind of  examine for yourself, what are my expectations of  
> 2:04:25
> nature? Are, am I possibly imposing something on  nature that nature might not be doing? You know,  
> 2:04:33
> and, and I just, I always tell myself nature is  the final arbiter. I have to be obedient. I have  
> 2:04:39
> to think of myself as a student of nature rather  than, you know, imposing my preferred, you know,  
> 2:04:44
> metaphysical view, metaphysical view on nature.  And really that, that's a lesson that we get from  
> 2:04:50
> Heisenberg going back to when, when he came up  with quantum theory is that is what he did. He  
> 2:04:55
> really kind of, what I, what I kind of think of as  Zen beginner's mind, you know, it's, it's a, it's   good advice. It's like, go back to be teachable.  Let, let the phenomena be your, your data and  
> 2:05:07
> let possible theories just be ways to create  relationships among the data that, that might,  
> 2:05:15
> might turn out to be, to work for you, to, to be  corroborated. And if they are corroborated to me,  
> 2:05:22
> that suggests that they have some physical  relevance. And again, it's because that's kind   of a realist approach, but it's let, let the data  and let, let nature teach you what it might be  
> 2:05:34
> doing rather than take things like, well, we must  impose causality on our theory. We must impose  
> 2:05:40
> symmetry on our theory, you know, which is, which  is an approach that, that has become traditional   in physics. And those I call the training wheels,  you know, maybe we need them, maybe they're not,  
> Advice for Future Generations
> 2:05:49
> but that's the thing to look for is, is, you know,  while you're learning, be a student of nature and,  
> 2:05:55
> and just be alert to not put constraints  on nature that nature doesn't really have.  
> 2:06:02
> Thank you so much. I appreciate the time that  you've spent with me. It's now, yeah, two hours,  
> 2:06:08
> two and a half. Always a pleasure. Wonderful.  Thank you for the opportunity. I love the chat.  
> 2:06:13
> And I just want to say that I respect people who  get their PhDs when they're older, because one of  
> 2:06:19
> the worst things you can do is concretize your,  your worldview, your Weltanschauung, as they say,   when you're in your twenties, which is what most  people do. If you ask almost any one of the famous  
> 2:06:29
> physicists, what is it that you believe? And then  you, and they're 60, they're 70 now, and you ask  
> 2:06:35
> them that when they were in their late twenties,  it's approximately the same in terms of ontology.   Yeah, it's good to try to be flexible and, and,  and, you know, be a lifelong learner. And often  
> 2:06:45
> that is hard when you, when you get your PhD very  young, I got mine, I guess when I was about 36  
> 2:06:51
> or something. So I had done a lot of different  things. And you get to explore before diving.  
> 2:06:58
> Absolutely. Absolutely. And even when you do that,  you need to, you always need to be wary of, of,  
> 2:07:04
> of things that are passed on as, yes, this is,  this is the way it's done. And, and, you know,  
> 2:07:11
> go, okay, well, maybe the reason you still have  problems is because that's the way it's being   done, you know, rather than just be follow, be  obedient. And hey, you have to be disobedient  
> 2:07:21
> sometimes. I mean, Einstein was in a patent  office, right? So sometimes you just have to  
> 2:07:30
> go off the beaten path to, to find the solutions  and to really find understanding. Ruth, it's been  
> 2:07:37
> a pleasure. Thank you so much. Well, thank you so  much for the opportunity. Really, really enjoyed   it. Thank you for a great question. I also wanted  to take time to thank people who have joined as  
> Conclusion and Acknowledgments
> 2:07:45
> a YouTube member, someone who's been here for 13  months over a year is Mike Clark. Thank you. Thank  
> 2:07:51
> you to Dima. Thank you to Alan. Thank you to Neil.  Thank you to Charles Matthew. Thank you to Ike.  
> 2:07:56
> Thank you to a underscore MB. Thank you to Eric  Weinstein. You've been a member for six months.  
> 2:08:01
> Thank you. Thank you to Dr. Y you've been here  for five months. Thank you to Yuri. Thank you,  
> 2:08:07
> Eric Green. Thank you, Mike. Thank you, Unreal.  Thank you, Nicholas. You've been here for four  
> 2:08:12
> months. Thank you, Carlo Rovelli. You've been here  for three months. Thank you to David. Thank you to  
> 2:08:17
> William. Thank you to Richard ether Topo to cosmic  felon. Great name. Thank you to Emmy Johnson.  
> 2:08:24
> Thank you to Peter Kellner for two months.  Emanuel Borko Ianis. Thank you, nut. Thank you,  
> 2:08:30
> human intelligence. Thank you, Mark. Thank you,  Doc. Thank you, Adam. Thank you, met mit. You've   been here for one month. Thank you, Argentine,  Beth, Emory, Casey, Sigmund Freud. Thank you,  
> 2:08:39
> Terry Bollinger. I appreciate you. I know you  comments all the time says that you've rejoined   and you've been here for a total of one month  now. Thank you. Thank you, Nachum. Thank you,  
> 2:08:48
> Syria. Thank you, Tamer. Thank you, train. Thank  you, Dan, who has just joined along with train  
> 2:08:54
> and tamer. Thank you so much. The way that you can  join to be a YouTube member is on screen and the   link is in the description. New update started a  sub stack writings on there are currently about  
> 2:09:08
> language and ill defined concepts as well as  some other mathematical details, much more being   written there. This is content that isn't anywhere  else. It's not on theories of everything. It's not  
> 2:09:17
> on Patreon. Also, full transcripts will be placed  there at some point in the future. Several people  
> 2:09:23
> ask me, hey, Curt, you've spoken to so many  people in the fields of theoretical physics,   philosophy and consciousness. What are your  thoughts? While I remain impartial in interviews,  
> 2:09:33
> this sub stack is a way to peer into my present  deliberations on these topics. Also, thank you to  
> 2:09:41
> our partner, The Economist. Firstly, thank you for  watching. Thank you for listening. If you haven't  
> 2:09:48
> subscribed or clicked that like button, now is  the time to do so. Why? Because each subscribe,  
> 2:09:55
> each like helps YouTube push this content to  more people like yourself. Plus, it helps out  
> 2:10:01
> Curt directly, a.k.a. me. I also found out last  year that external links count plenty toward the  
> 2:10:06
> algorithm, which means that whenever you share on  Twitter, say on Facebook or even on Reddit, etc.,  
> 2:10:12
> it shows YouTube, hey, people are talking about  this content outside of YouTube, which in turn  
> 2:10:18
> greatly aids the distribution on YouTube. Thirdly,  there's a remarkably active Discord and subreddit  
> 2:10:24
> for Theories of Everything, where people explicate  TOEs, they disagree respectfully about theories,  
> 2:10:29
> and build, as a community, our own TOE. Links  to both are in the description. Fourthly,  
> 2:10:34
> you should know this podcast is on iTunes, it's  on Spotify, it's on all of the audio platforms.  
> 2:10:40
> All you have to do is type in Theories of  Everything and you'll find it. Personally,   I gain from re-watching lectures and podcasts. I  also read in the comments that, hey, TOE listeners  
> 2:10:49
> also gain from replaying. So how about instead  you re-listen on those platforms like iTunes,  
> 2:10:54
> Spotify, Google Podcasts, whichever podcast  catcher you use. And finally, if you'd like   to support more conversations like this, more  content like this, then do consider visiting  
> 2:11:04
> patreon.com slash CURTJAIMUNGAL and donating  with whatever you like. There's also PayPal,  
> 2:11:09
> there's also crypto, there's also just  joining on YouTube. Again, keep in mind,   it's support from the sponsors and you that allow  me to work on TOE full-time. You also get early  
> 2:11:20
> access to ad-free episodes, whether it's audio  or video. It's audio in the case of Patreon,   video in the case of YouTube. For instance, this  episode that you're listening to right now was  
> 2:11:28
> released a few days earlier. Every dollar  helps far more than you think. Either way,  
> 2:11:33
> your viewership is generosity enough. Thank  you so much. Transcribed by https://otter.ai

### `2026-08-20 12:59:03`

> retarded quantum waves we've done some connects to this and our echolocation and the boundcing off boundaries the "retro"ish causal wave.     ## Not literally backward in time
> 
>       A correction she makes against Cramer's original presentation: offers and confirmations are
>       **not** little waves travelling forward and backward through spacetime. Multi-system quantum
>       states live in high-dimensional complex Hilbert space and "are not spacetime entities."
> 
>       > "There's a third way ... these entities are physically real, but our physical reality goes
>       > beyond three plus one space-time."
> 
>       She calls that level the **quantum substratum** — a realm of *possibility*, not probability.
>       Spacetime is emergent: with Einstein, the manifold is "an invariant set of events," and x
>       and t are parameters we use to coordinate observations among those events, not observables.
>       (At the relativistic level there is no time observable and no position observable; nature's
>       preferred observables are energy and momentum.)
> 
>       Metaphors she uses: the **iceberg** (submerged possibility, the tip is spacetime) and,
>  this is very similar to our psudo retrocausality via generator function updates that reinterpert the past.  references/prior-art/  is there anythign else that made it here that we should move over, other youtube videos?   Filed as coincidence, not identification. I named five other things with the same two-sided-handshake shape — 2PC, interactive proofs, Byzantine quorum, Merkle receipts,
>   double-entry bookkeeping — so the shape doesn't pick out TI. It's an anchor for an intuition we'd already built, dated to Wheeler–Feynman 1945 instead of to us. Registered toy
>   and it stays toy: nothing in the repo fails if the mapping is wrong. yes all these are similar shapes exacty as transactional interpertation of qm not an isomorphsim

### `2026-08-20 13:12:20`

> | | echolocation frame | transactional formulation |
>       |---|---|---|
>       | **Phase 0 — degenerate** | ping, no return. No external reference is *possible*; structural | an emitter with no absorber. No confirmation, so no transaction, so no outcome
>       exists to have |
>       | **Phase 1 — degeneration** | returns exist, nothing computes a fix | the mixed state: incipient transactions are present and weighted, and nothing has actualized one |
>       | **working** | ping, return, fix computed | offer, confirmation, collapse to the one actualized outcome |
> 
>       The part worth noticing: **the absorber is the boundary.** Echolocation needs a surface to
>       bounce off; a transaction needs an absorber to answer. *No boundary, no measurement* is the
>       same sentence in both vocabularies. And it is why "ping without return" is structural rather
>       than a failure of effort — an emitter in a universe with nothing to absorb has not failed to
>       measure, there is no measurement there to fail at.
> 
>     Ours has exactly that form:
> 
>       - The Z-set fold's `−1` **does not edit the recorded event.** Retraction changes what the fold
>         concludes; the log is append-only and the past is not rewritten.
>       - The thing that produces the appearance of backward influence — the generator, the fold — is
>         **not itself an event in the log.** It is not located in the timeline it reinterprets.
>       - Aaron, 2026-08-19: *"retrocausality is only on beliefs, not facts."* Same partition, stated
>         more sharply than the transcript states it.
>  this is very very similar to the way i see our amplitudeemu and our q# code and our softemu and other basyan stuff were the combination of them happens in a similar fashion.      The filing therefore stays **coincidence-as-generator**, and the honest promotion path is
>       unchanged from §5: show the two-sided structure is *forced* for our meter, not merely
>       satisfied by it. Nothing here attempts that, and nothing here changes code.
> 
>  this cowidence over time we use to index memories in way that is shaped by external entropy and cowidences that appear random but will index over time causally eventually instead of by wallclock time.  The knob on "did a measurement occur" is a thermometer, not an observer. this is great, maybe we can relate this to all our heat work on reversable computing, we just connected this to temperature and maybe just connected temperature to space curvatrue around too much decorrelation where two entities can't communicate anymore.   so a closed hex wall needs exactly twelve pentagons, however large it grows. Hexagons free, twelve defects structural. I flagged that as a different register
>   from the rest and left the antecedent unearned: nothing establishes our wall is closed, and unclosed means no forced twelve. we should try to model it as close and see what effects it has on the system, this is a gut instinct for our design but if we find it needs to be open we can revisit later, we have no dogma so.

### `2026-08-20 13:30:34`

> amplitudes buy interference, not non-locality; 2√2 still needs the feedback channel. yes exactly to aceive non-interference in our system 2root2 you need the four corner ownership feedback model we designed so feedback can travel in both directions.      The standing guard from that rule still applies and applies harder at substrate scale: **store
>       the register with the coincidence.** An unlabelled coincidence in long-term memory is a belief
>       nobody decided to hold; an unlabelled coincidence in a shared index is a belief nobody decided
>       to hold that everyone now reads. yes labeling them are importat as cowidence not belief until they pass some threshold and even then it should be a weak belief until it passes the threshoad for others in society too.     And it prices our own ledger: the Z-set is **append-only with `+1`/`−1`**, which is reversible
>       by construction, so the fold itself is Landauer-free. The irreversible step — the one that
>       costs — is *acting* on the fold: consuming a conclusion, discarding a branch, erasing a
>       possibility. That is exactly where TI puts collapse and exactly where a measurement outcome
>       becomes a fact. **Reversible up to the outcome; the outcome is what you pay for.**
>  evenin this we try to simulate mesaurement so we never actually collapese just discuss simulated measurements, we try to avoid collapse always and keep the tention open.        **The fourth link is Aaron's leap and is labelled as such.** *"maybe just connected temperature
>       to space curvature around too much decorrelation where two entities can't communicate
>       anymore."* There is real literature in that direction — Jacobson (1995) deriving the Einstein
>       equation from the Clausius relation on local horizons; Verlinde's entropic gravity (2011) —
>       and it is **contested**, not settled. A horizon is precisely "where two entities can no longer
>       communicate", so the shape matches. But per the metering test in the anchor-taxonomy doc, a
>       physics paper grounds a *metering discipline*, not a metaphor: Landauer earns its place because
>       it prices a bit; entropic gravity would only earn its place if it priced something we measure.
>       It does not yet. **Recorded as a direction, refused as an anchor.**
>   we have some work in repo on this, maybe some code but some reearch for sure i believe, we just connected temperature and curvature to our metric for lagrange possible, we are still in the middle of researching it.       **(b) It abolishes Phase 0.** This is the real consequence and it was not obvious before doing
>       the exercise. A closed surface has **no boundary** — there is no direction an emitter can point
>       where nothing is there to absorb. So "ping without return", the *structural* degeneracy, cannot
>       occur inside a closed wall. Every remaining failure is Phase 1: returns exist and nothing
>       computed a fix.
>  yes exactly in a closed well there is always something to bounce off of.  (c) finite area, therefore saturation and structural back-pressure -- the cost of closing. i think this is a benefit, casue we need backpressure all over the place naturally like our ferry throttler and our zeta scheduler and our transport protocols like our udp exprically, and our echo location even needs self debounce so you can hear echos other than your own.  and you know i like scale free anywhere it shows up like the closed wall :)

### `2026-08-20 13:36:50`

> - **The system is designed to stay Landauer-free**, not merely to be reversible up to a
>         payment. If collapse never happens, the `kT ln 2` is never owed. Erasure is the cost, and we
>         decline the erasure.
>  the only place i'm sure we need thermal erasure is inside the privacy budget so a mixed entropy capture from an travler, the travler can erase a hidden bits behind the frost encryption to "simulate" free will and make it where other travelers can not perfect predict and reproduce the outcome from others.

### `2026-08-20 13:43:33`

> Two keepers: a distance claim must name its oracle the way a moral claim must; and the horizon
>       reading survives without borrowing general relativity's authority, because infinite distance
>       under a named oracle is a definition we own rather than a physics result we lean on.
>  i would go a bit further and say for any givein oracle like the higest moral reguard it should be able to be expalined how the metric represents the oracles english description, they should not just be randomly connected.  so in referesable computing i think this comes down to our travlers not overwriting other travlers

### `2026-08-20 13:45:56`

> One honest miss: I searched for the temperature/curvature→Lagrange link and the Lagrange–Condorcet material is real and substantial (LagrangeCondorcet.fs is one of the few things
>   registered metered), but I did not find that link on main. Recorded as not found rather than absent — either it's newer than what's landed or not written down yet.
> 
>  lets do a writeup on it if you don't see it, we had done a few hours worth of research on choosing a lagrange for highest moral reguard oracle, this is what we were trying to attach it to. it was while researching some other ip questionably work in the last few days, feel free to do some writup or something on main for this now, maybe it's captured in some work item?

### `2026-08-20 13:50:33`

> That reframes the ρ measurement from a decorrelation curiosity into an INTEGRITY CHECK ON THE
>       CATASTROPHIC-COLLAPSE PROTECTION, at zero cost -- the instrument ships, is wired into CI, and
>       emits a number every run. Two consequences: the rising ρ is a safety signal (blast radius
>       growing), and a room's boundary becomes FALSIFIABLE, since claiming a Markov boundary is
>       claiming conditional independence and that is measurable.
> 
>  yes this is our slow explotion waring system for expotions that are too hard to see in real time.

### `2026-08-20 13:53:48`

> and ErasureDistance.lean's "distance" is Hamming, while mine is Landauer cost ours is hamming becasue of our adenkras code choices, we even have non coded adenkras so there are many possible distanct metrics here depending on what we choose as our base layers of shared futamara and generator function unfolding.  we have multiple towers here and can support many more in the future.

### `2026-08-20 13:58:20`

> **(c) Temperature is the exchange rate between information and energy.** This is the
>       temperature→metric link the thread was reaching for, and it needs no entropic gravity at all.
>       `T` is the conversion factor from nats to joules — nothing more mystical, and nothing weaker.
>       It passes the metering test §15 applied to Verlinde and refused: **it prices a bit.**
>  yes i believe this is true, the gravity stuff comes from phase time slowing inside heavy distributed consensus i think, that's how i model gravety in my head, so this seems right for temperature this relation to energy

### `2026-08-20 14:02:19`

> 3. **Do not store the series — recompute it from history.** ρ is a pure function of the corpus,
>          and the corpus is in git. So the time series is *derivable* by walking commits and
>          recomputing, which means it is idempotent, replayable under DST, and cannot drift from the
>          thing it describes. Appending ρ to a running file each CI run would recreate exactly the
>          append-only-growing-corpus problem fixed this morning in
>          `081M0DY68KN087G0R002MQ1BDR` — a stored series is a second surface that can disagree with
>          the first.
>  this is the who futamara taken to observablies too, recompute everything you can and don't worry if it gets garbage collected it can get regnerateed

### `2026-08-20 14:10:50`

> ### Why this is exactly the free-object rule, applied to ethics
> 
>       `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`: only the irreducible is
>       primitive; every structured special case is an **earned quotient obtained by declaring its
>       relations**. A code is precisely such a quotient — you declare the parity constraints and get a
>       structured object with a distance.
> 
>       Composing that with the above:
> 
>       > **Nearer the free object ⇒ no code ⇒ continuous harm. Take the quotient ⇒ get a distance ⇒
>       > harm becomes quantized with a floor.** The generator hierarchy determines the moral geometry.
> 
>       That is the same rule's other half showing up: *the highest-value generator IS an
>       error-correcting code* — regenerating from the irreducible *is* the correction. Aaron's point is
>       that we may decline to take that quotient, and declining has an ethical consequence, not merely
>       a mathematical one.  yes we should save this somewhere in our repo in the craft scool, this is good way to teach free object rule by our own code and objects in source.       The repo already has two distinct towers in play, both named in the register:
> 
>       - **the algebraic tower** — Cayley–Dickson → octonion product → Fano plane `S(2,3,7)` → `[7,4]`
>         Hamming → parity extension → `[8,4]` doubly-even. Derived end-to-end, not assumed.
>       - **the Futamura tower** — interpreter → compiler → compiler-generator, `gen(gen) == gen`.
> 
>  we are trying to connect these together my make compilers run on math with our ISA so we are optimizing to a theorotical ISA machine that can run on any substraight even q# and fpga and analog devices, digital 0s and 1s not needed and is not our based.   this also connects to our basyian inference stuff and our BNNs this is trying to be a "universal" compiler over any substraight.

### `2026-08-20 14:16:24`

> distribged consenus gets things bent twards them becasee of runaway decorrlation without distributed consentus, in our system when temperature rises it's warning of too much decorrlation and then it bends twards our "gravity" to use distributed constenesus to restore the minimimum correlation
