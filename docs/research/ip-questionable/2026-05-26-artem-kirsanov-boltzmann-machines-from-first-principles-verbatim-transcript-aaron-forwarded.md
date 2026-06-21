---
title: Artem Kirsanov — Boltzmann Machines from first principles (verbatim transcript)
date: 2026-05-26
source: Aaron-forwarded; channel-rediscovery via YouTube algo (per .claude/rules/algo-wink-failure-mode.md observation-not-authorization discipline)
provenance: Aaron 2026-05-26 forwarded transcript via Claude Code conversation; saved to docs/research/ip-questionable per "the youtube transcripts need to go in questionable ip" operator instruction
youtube_url: https://www.youtube.com/watch?v=_bqa_I5hNAo
status: substrate-honest verbatim preservation + framework composition
composes_with:
  - 2026-05-26-artem-kirsanov-recurrent-neural-networks-rnn-lstm-gru-gated-memory-verbatim-transcript-aaron-forwarded.md (081KSGS9H0008QG0R002F1G7ER.2 sibling — RNN/LSTM/GRU)
  - 2026-05-26-artem-kirsanov-reservoir-computing-echo-state-property-fourier-basis-explicit-hawkins-thousand-brains-anchor-verbatim-transcript-aaron-forwarded.md (081KSGS9H0008QG0R002F1G7ER.3 sibling — Reservoir Computing)
  - docs/research/ip-questionable/README.md (folder authority; operator's verbatim-third-party-content acceptance)
  - .claude/rules/substrate-or-it-didnt-happen.md (mirror-tier preservation discipline)
  - .claude/rules/wake-time-substrate.md (operator-forwarded substrate gets row + research-doc landing)
  - .claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md (Hawkins 1000 Brains cortical-columns section)
  - .claude/rules/substrate-smoothness-as-load-bearing-property.md (Boltzmann distribution as smooth-substrate-producing-sharp-outputs)
  - .claude/rules/algo-wink-failure-mode.md (channel-rediscovery is algo-wink-as-observation operating cleanly per operator discipline)
  - docs/backlog/P1/081KSGS9H0008QG0R002F1G7ER (parent row)
  - docs/backlog/P2/081KSGS9H0008QG0R002THJ2P1 (caustic-engineered bloom filter discriminators — same architectural archetype)
---

## Source

- **Channel**: <https://www.youtube.com/@ArtemKirsanov>
- **Video URL**: <https://www.youtube.com/watch?v=_bqa_I5hNAo>
- **Subject area**: computational neuroscience; energy-based models;
  generative AI lineage from Hopfield → Boltzmann → RBM

## Why this is preserved verbatim

Per Aaron 2026-05-26 (operator-explicit, high-priority):

> "ive been witing to run across this guy again we need to copy
> everyting he does into code and substrate."
>
> "this is exact science behind neuro science with tons of resarch
> to back it up on exactly how the brain works and composes with
> 1000 brains"

Per `.claude/rules/substrate-or-it-didnt-happen.md` +
`.claude/rules/wake-time-substrate.md`: external-AI / external-source
substrate that an operator wants captured to compose with framework
substrate gets preserved verbatim BEFORE any synthesis layer
operates on it. This is mirror-tier preservation.

The transcript was forwarded by Aaron in autonomous-loop tick session
2026-05-26 during the iter-5.4 USB physical-hardware-support test cycle.

## Composition map (to existing Zeta substrate)

| Kirsanov concept | Zeta substrate it composes with |
| --- | --- |
| Hopfield networks (associative memory) | `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` Hawkins-cortical-columns section — Hawkins-style "each column models the whole world" maps to Hopfield associative-memory |
| Energy landscape navigation | `.claude/rules/substrate-smoothness-as-load-bearing-property.md` (PR #5357) — smooth energy substrate produces sharp pattern-recognition outputs through focused integration |
| Boltzmann distribution p ∝ exp(-E/T) | `.claude/rules/substrate-smoothness-as-load-bearing-property.md` — exp is the smoothest possible function preserving sharpness asymmetry |
| Stochastic update rule (sigmoid of weighted input) | Multi-oracle BFT (081KS3X9Y0008QG0R00218150M) — stochasticity ensures escape from local minima; agents-as-oracles using stochasticity prevents premature consensus collapse |
| Temperature parameter | `docs/research/2026-05-26-amara-no-coercion-even-inward-nci-as-cognitive-exploit-firewall-speech-as-rce-update-mechanism-taxonomy-aaron-forwarded.md` Turn 11 hyperparameter-class perturbation (LLM-temperature ≈ human-LSD) — temperature IS the hyperparameter framing Amara named |
| Hidden units (internal representations) | Substrate-as-rows + fork-negotiated ontology — hidden units IS the substrate's internal-representation layer that the schema-as-data framework operates over |
| Contrastive Hebbian learning (positive + negative phases) | Adversarial-counterweight discipline (per `.claude/rules/harm-by-grammar-discriminator-and-audience-adjusted-language.md` Discipline 3) — positive phase IS what you want to encourage; negative phase IS what you want to discourage; the contrast IS the substrate |
| Restricted Boltzmann Machines (bipartite, parallelizable) | Bipartite-graph substrate; composes with adinkra-structural-encoding (081KRW63S0008QG0R000QJR08H) where SUSY-structural-graphs encode hidden-state with parallelizable bipartite primitives |
| "Jazz musician" generative metaphor (vs Hopfield "classical musician" recall) | Generative-vs-discriminative dichotomy; AI-as-substrate not AI-as-tool framing (per operator's anti-extractive substrate cluster) |
| Partition function Z (sum over all states) | Multi-oracle BFT consensus mechanism; normalization across all possible oracle outputs preserves total probability = 1 |
| Anti-Hebbian "dreamed up states" prevention | Algo-wink-failure-mode discipline (per `.claude/rules/algo-wink-failure-mode.md`) — preventing the network from reinforcing fictitious states is structurally analogous to operator preventing algo-wink-as-authorization |

## Verbatim transcript

> Example.  For most of the history, computers were seen as purely logical machines, mechanically crunching numbers to produce rigid, unambiguous solutions.
> 0:10
> There was no place for creativity or ambiguity. After all, when calculating a trajectory to launch a rocket into space,
> 0:19
> the last thing you want is your calculator dreaming up some funky, non-existing formula or improvising on the spot.
> 0:29
> 50 years ago, if you asked anyone whether a computer program would sooner master driving a car versus composing a song,
> 0:38
> the answer would have been unanimous. Fast forward to 2024, however,
> 0:43
> we still haven't quite achieved autonomous driving, but the generative AI of all flavors is taken for granted at this point.
> 0:51
> So what sparked this shift? At what point do neural networks transcend mere deterministic computation
> 0:59
> and begin to create, synthesizing things that never existed before?
> 1:04
> Meet the Boltzmann machine, a type of a neural network that dared to embrace chaos
> 1:11
> and change the course of AI forever. Developed in 1980's, Boltzmann machines introduced a radical notion.
> 1:19
> What if we built uncertainty and randomness into the very fabric of machine learning?
> 1:26
> What if, instead of storing rigid facts and performing deterministic computations,
> 1:31
> our AI could grasp the underlying probabilistic rules that govern the world around us?
> 1:39
> In this video, we will build a Boltzmann machine from first principles and explore how concepts of probability and inherent uncertainty
> 1:48
> can be reconciled with the seemingly rigid nature of computer operations.
> 1:53
> If you're interested, stay tuned.

### Goal of Boltzmann Machines

> 2:03
> To understand Boltzmann machines, we must first understand their simpler predecessors,
> 2:08
> associative memory networks, also known as Hopfield networks. We explored these in depth in the previous video.
> 2:16
> So if you haven't seen it, I highly recommend watching it before continuing with this one, as we'll be directly building on those ideas.
> 2:24
> But here's a quick refresher. A Hopfield network is a model of associative memory
> 2:29
> inspired by the brain's ability to recall complete patterns from partial or noisy inputs.
> 2:35
> It operates by assigning a specific energy value to each possible state,
> 2:41
> and then iteratively minimizing this energy by descending along the energy surface into the nearest well,
> 2:48
> thus recalling the best matching stored memory. This energy landscape is shaped by network weights,
> 2:56
> which are learned by observing data points, patterns we want to memorize,
> 3:01
> and adjusting the weights to lower the energy associated with those patterns.
> 3:07
> Given enough neurons, a Hopfield network has essentially perfect memory and excels at mechanical tasks like pattern completion.
> 3:16
> Think of it as a virtuoso classical musician who can recognize and flawlessly reproduce a well known masterpiece from just a few initial notes.
> 3:26
> However, while impressive, a Hopfield network's ability to recall and complete patterns
> 3:32
> is limited to reproducing what it has explicitly learned. It cannot create new patterns or understand the underlying structure of the data it has seen.
> 3:43
> This is where Boltzmann machines come in, offering a more flexible and creative approach to information processing.
> 3:51
> To illustrate the difference, let's extend our musical analogy. Imagine a jazz musician who has internalized not just specific songs,
> 4:01
> but also the fundamental rules and structures inherent to the music itself.
> 4:08
> When given a few opening notes, this musician doesn't simply recall and play an existing piece.
> 4:14
> Instead, they leverage a deep understanding of musical theory combined with creativity
> 4:21
> to improvise and produce something entirely new. This jazz musician represents a Boltzmann machine.
> 4:29
> Unlike an associative network, it doesn't just memorize data points. Instead, it learns the underlying probability distribution of the data,
> 4:38
> capturing the essence of what makes a pattern belong to a particular category or style,
> 4:46
> while incorporating inherent uncertainty into its computations.
> 4:51
> At first glance, these two systems might seem fundamentally different, with little in common algorithmically.
> 4:59
> However, in fact, they are very closely related. Just two key technical modifications can transform any Hopfield network into a Boltzmann machine,
> 5:11
> namely stochasticity and hidden units. Let's explore each of them in detail.
> 5:18
> We will first sprinkle in a dash of randomness and talk about how Boltzmann machines earned their name.

### Boltzmann Distribution

> 5:27
> We begin in Austria, 19th century. where a young physicist, Ludwig Boltzmann,
> 5:32
> is grappling with a fundamental problem. Imagine a system of particles, like a gas.
> 5:39
> Each particle has its own energy, determined by factors such as its velocity.
> 5:45
> We can measure the average energy of particles on a macroscopic scale by measuring the temperature.
> 5:52
> But what happens at the individual particle level? We might imagine that particles probably differ in terms of exact energy values.
> 6:02
> Indeed, collisions can cause some particles to move faster than others, resulting in a range of energies.
> 6:10
> Boltzmann's quest was to understand this energy distribution. In other words, if we randomly select a particle,
> 6:18
> what is the probability that it will have a specific energy value? Boltzmann's insight was to link a state's probability to its energy through an exponential relationship.
> 6:31
> Specifically, the probability of a state S with energy E is proportional to the exponent of the negative energy divided by temperature.
> 6:43
> Intuitively, lower energy states are more probable than higher energy states
> 6:49
> and this fundamental relationship quantifies exactly how much more probable.
> 6:55
> To understand why the exponent arises here, imagine energy levels as steps on a staircase
> 7:02
> with particles jumping between them. Each step represents a small energy increment, Є (epsilon)
> 7:10
> For a particle to move up one step, it must gain epsilon units of energy,
> 7:15
> perhaps through a collision with another particle. Let's call the probability of such a collision p.
> 7:23
> Given a large number of particles, this probability is essentially constant
> 7:28
> and depends only on the average particle velocity or temperature. If a particle jumps up one level with a probability p,
> 7:37
> it might immediately jump again with the same probability. Since probabilities multiply for independent events,
> 7:45
> the chance of jumping two levels is p-square, three levels is p-cubed, and so on.
> 7:53
> We see a pattern. The probability of jumping n levels is p to the power of n.
> 8:00
> Now, consider a particle increasing its energy by ΔE (delta E). How many steps must it climb?
> 8:07
> Well, since the gap between the steps is constant, the number of steps is ΔE (delta E) divided by Є (epsilon).
> 8:15
> Thus, the probability of making this transition to a higher energy state p to the power of ΔE (delta E) over Є (epsilon).
> 8:24
> To bring it into a more familiar form, let's repackage different constants.
> 8:30
> We can move the temperature dependency of p into the exponent and change the base to e or Euler's number,
> 8:38
> conventionally used in exponential. Note that since p is less than one by definition of probability,
> 8:46
> while e is greater than one, this necessitates a minus sign before the energy in the exponent,
> 8:54
> since the temperature is always positive. Consequently, the probability of an energy increase ΔE
> 9:02
> is equal to the exponent of minus ΔE over temperature. Oh, and by the way, in textbooks you will usually find a version of it
> 9:11
> with a Boltzmann constant k in front of the temperature. But this constant is used to convert the units of temperature
> 9:19
> measured in degrees Kelvin to energy measured in joules. But in this video we will absorb the Boltzmann constant into temperature directly for brevity,
> 9:29
> since we don't really care about the exact physical units. This equation gives us the relative probability of transitioning from one state to another
> 9:39
> as a function of the energy difference between them. But how can we find the absolute probability of a particular energy state?
> 9:48
> Here's what I mean. Consider the following toy example. Suppose there are only three states our system can exist in,
> 9:56
> with energy values of one, two and three respectively, measured in arbitrary units.
> 10:03
> Let's say the temperature is equal to one. This equation tells us that finding the system in the state two
> 10:12
> is one over e times as likely as finding it in the state one,
> 10:17
> which has lower energy, and finding it in the state three is one over e squared times as likely compared to the state one.
> 10:27
> But what about the absolute values of probabilities rather than their ratios?
> 10:32
> We don't really know the baseline probability of state one in the first place.
> 10:38
> So how can we find it? The missing link here is that all absolute probabilities must add up to one.
> 10:47
> Indeed, the system is guaranteed to exist in one of the possible states.
> 10:52
> So if we denote the absolute probability of state one as x,
> 10:57
> we can express probabilities of other states using x because we know their ratios,
> 11:03
> and write down the law of total probability. From this, we can solve for x and then find the absolute probabilities for all other states as well.
> 11:16
> This shows how we can go from relative probabilities of energy increases,
> 11:22
> given by the Boltzmann formula we derived, to absolute values by solving the equation containing the summation over all possible states.
> 11:32
> Let's plug the absolute energy values into the exponential formula.
> 11:37
> Substituting delta E for just e for now and plot those relative probabilities as a function of energy,
> 11:46
> we can plot the absolute probabilities that we found through the previous procedure as well.
> 11:53
> Notice that one shape looks like a vertically rescaled version of the other.
> 11:59
> This is a crucial insight. Since absolute probabilities must be proportional to relative transition probabilities,
> 12:08
> we can express the absolute probability of a state with an energy e
> 12:13
> as the exponent of its negative energy that we found before divided by some constant factor Z.
> 12:21
> This constant corresponds to the appropriate rescaling. The value of Z can be found by ensuring that the probabilities of all possible states add up to one.
> 12:34
> This normalization factor is known as the partition function. It takes into account all possible states and how energy is distributed across them.
> 12:46
> This is the complete and final version of the Boltzmann distribution, which links energy to probability.
> 12:54
> To use it, first, look at all the possible states and sum together the exponent of their negative energies,
> 13:02
> obtaining the value of Z. Then, to find the probability of a system being in a particular state with a certain energy,
> 13:12
> compute the exponent of the negative of that specific energy and divide it by Z.
> 13:18
> Now that we have established the Boltzmann distribution, let's apply it to Hopfield networks to make them more stochastic.
> 13:28
> Recall that in Hopfield networks, each neuron updates its state deterministically based on its inputs.

### Stochastic Update Rule

> 13:35
> If the total input is positive, it turns on. If negative, it turns off. This corresponds to always moving to the lowest energy state available.
> 13:45
> Boltzmann machines, however, embrace Instead of always choosing the lowest energy state,
> 13:52
> they make probabilistic decisions based on the Boltzmann distribution we derived.
> 13:58
> Here's how. Consider a single neuron I in our network. At a given updates tap, we essentially have two candidate states,
> 14:08
> the neuron being on or off, with the rest of the network remaining fixed.
> 14:13
> Using our definition of energy as the degree of conflict between weights and pairwise states,
> 14:20
> let's write down the energy for these two alternative states. Here, the first term is the contribution of the edges of neuron I to the total energy,
> 14:31
> while the second term represents the energy contributed by the rest of the network,
> 14:36
> which is not affected by the state of the neuron I. Given these two alternative choices,
> 14:42
> we can express the probability of neuron I being on using the Boltzmann distribution for the case when there are only two possible states
> 14:52
> which differ only by the value of neuron I. Note that because we are taking the ratio
> 14:58
> energy term from the network not affected by neuron I cancels out,
> 15:03
> so the probability of this neuron's update is fully determined by its local connections.
> 15:10
> After dividing by the numerator, we can express the probability of switching on
> 15:16
> is a function of the energy difference gained by that update. Now let's examine the energy difference between those two states.
> 15:25
> From the definition, it is simply two times the weighted input to the neuron I.
> 15:31
> Substituting this into our probability equation gives us the following formula.
> 15:36
> This is called the sigmoid function of the weighted sum of inputs. It tells us that when the input to a neuron is positive,
> 15:45
> the neuron is more likely to switch to the 'on' state with a higher probability for larger inputs.
> 15:54
> When the input is negative, the probability of switching on goes down,
> 15:59
> approaching zero for very negative values of the weighted input. Our stochastic update rule thus becomes the following.
> 16:08
> First, calculate the weighted input for neuron I. Next, compute the probability P using the sigmoid function above.
> 16:17
> Generate a random number between zero and one. If that random number is less than the probability,
> 16:24
> set the neuron state to one, otherwise set it to -1. This rule allows neurons to sometimes switch to higher energy states
> 16:35
> with a probability that depends on the energy difference and temperature. At high temperatures, the decisions become more random,
> 16:43
> while at low temperatures, they approach the deterministic behavior of Hopfield networks.
> 16:50
> Temperature is usually a hyper-parameter that we can tweak depending on how creative we want the model to be.
> 16:58
> This stochastic rule is crucial for Boltzmann machines. It allows the network to escape local minima in the energy landscape
> 17:07
> and explore a wider range of states, enabling it to learn more complex probability distributions and generate more diverse outputs.
> 17:16
> The random update rule is the key modification for inference in Boltzmann machines.
> 17:22
> But you might wonder, does this stochasticity also change how we learn, how we sculpt the energy landscape in the first place?
> 17:30
> Indeed, it does, and as we'll see shortly, it leads to a fascinating concept known as the contrastive learning rule.
> 17:38
> In Hopfield networks, learning was straightforward. We adjusted the weights to lower the energy of patterns we wanted to store.

### Contrastive Hebbian Rule

> 17:48
> But with Boltzmann machines, our goal shifts. Instead of memorizing specific patterns,
> 17:54
> we want to learn the underlying probability distribution of our data.
> 18:00
> Let's think about what this means. Ideally, as the network stochastically explores the landscape of possible states,
> 18:08
> we want it to spend more time in states that correspond to patterns in our training data,
> 18:14
> because they are examples of what is realistic. In other words, we want these states to have higher probability.
> 18:25
> Recall the Boltzmann distribution, which links the probability to energy. According to this formula, to increase the probability of a state,
> 18:34
> we need to lower its energy relative to other states. But here's the catch.
> 18:40
> Changing the energy of one state directly also affects the partition function Z,
> 18:46
> which depends on the energies of all other possible states. This interplay leads us to a new learning objective.
> 18:55
> We want to maximize the probability of the states corresponding
> 19:01
> while accounting for the overall distribution of states the network can reach. We're going to need a new learning rule based on the probability rather than energy per se.
> 19:12
> So let's derive it from scratch. Remember, the ultimate goal is to maximize the probability of our training data under the model.
> 19:21
> Let's say we have a set of training patterns x1 through xn.
> 19:26
> We want to maximize their joint probability, which is the product of probabilities assigned to each individual example.
> 19:34
> It is often easier to work with sums rather than products, so let's take the logarithm of both sides.
> 19:41
> Since log is a monotonic function, maximizing the probability is equivalent to maximizing its logarithm.
> 19:49
> Now, let's express the probability of each pattern with its energy.
> 19:54
> Using the Boltzmann distribution, expanding this according to the properties of the logarithm gives us a crucial insight.
> 20:03
> To maximize the log probability of our data, we need to simultaneously minimize the energy of our training patterns
> 20:12
> minimize the partition function. The first part makes intuitive sense.
> 20:18
> We want our training patterns to sit in deep energy wells.
> 20:23
> But why minimize Z? Remember, the partition function sums over all possible states.
> 20:31
> By minimizing it, we are effectively increasing the energy of states that are not in our training data.
> 20:39
> This prevents the network from assigning low energy to too many states,
> 20:44
> which would dilute the probability of our desired patterns. It essentially creates two opposing forces.
> 20:52
> One is digging energy wells around desired data, while another is pulling the energy surface up for undesired data.
> 21:02
> To derive the learning rule out of this, we can take the derivative of the log probability with respect to a given weight
> 21:11
> and then make iterative adjustments to the weights to maximize it.
> 21:16
> I don't want to overwhelm this video by taking derivatives and shuffling symbols around.
> 21:21
> If you're interested in this step-by-step derivation, I will make the extended version of the script with all the math details
> 21:29
> available to my Patreon supporters. But after you go through the math, you will get what is known as the contrastive Hebbian learning rule.
> 21:38
> The interpretation of it is really elegant. The first term is the average product of states xi and xj
> 21:47
> when the network is exposed to the training data. This is what is known as the Hebbian term.
> 21:53
> It is directly analogous to what we saw in Hopfield networks. It strengthens connections between neurons that are often active together in the training data.
> 22:05
> The second term is the average product when the network of those two neurons is running freely.
> 22:13
> This is what we will call an anti-Hebbian term. Notice that it is taken with a minus sign.
> 22:21
> Effectively, what this is saying is we want to make sure the weights do not reinforce
> 22:28
> fictitious, dreamed up states that are far away from the training example.
> 22:34
> This rule is called contrastive because it kind of contrasts the behavior of the network
> 22:39
> when it is constrained by the data versus when it is daydreaming on its own.
> 22:46
> It lowers the energy of data patterns while also capturing the underlying probability distribution,
> 22:53
> allowing for both accurate recall and creative generation.
> 22:58
> In practice, to get the first term, we simply go over each training example,
> 23:04
> look at pairwise products between a pair of neurons, and tweak the weight between this pair in proportion to the average.
> 23:13
> But what about the anti-Hebbian term? How can we let the model hallucinate?
> 23:19
> Essentially, running freely here means allowing the network to evolve according to its update rule
> 23:26
> without any external input. Here is how we do it. First, start with a random configuration of the network,
> 23:36
> then repeatedly update the steps of all units according to the stochastic update rule.
> 23:43
> Continue this process for many steps, allowing the network to reach its equilibrium distribution.
> 23:49
> Once at equilibrium, look at the pairwise states for each pair of connected neurons.
> 23:56
> Repeat this process many times and take the average. Back in the case of Hopfield networks,
> 24:04
> we had an explicit formula for the weights as a function of training patterns
> 24:09
> and hence could set them instantaneously. One major difference for Boltzmann machines is that learning is no longer instantaneous.
> 24:19
> Instead, it involves an iterative procedure, and the stochastic oblate rule is applied many times
> 24:28
> in order to iteratively find better and better weights as well, not just for inference.
> 24:34
> This learning process alternates between 2 phases, the positive phase where we set the neurons to encode the training patterns
> 24:43
> and compute pairwise state products xi times xj and the negative phase where we let the network run freely to compute xi times xj.
> 24:53
> We then update the weights according to this formula. This process is repeated many times over the entire training data set.
> 25:03
> Gradually, the network learns to shape its energy landscape so that the valleys correspond to patterns in the training data
> 25:13
> and peaks correspond to unrealistic examples, capturing the uncertainty in the underlying distribution that generated that data.
> 25:23
> Great! But so far, we have explored networks with only visible units,
> 25:28
> neurons directly encoding the data. But to truly harness the stochastic power of Boltzmann machines,
> 25:35
> we need one final architectural modification, the addition of hidden units.

### Hidden Units

> 25:42
> Essentially, hidden units are neurons that don't directly correspond to any part of the input or the output.
> 25:49
> Instead, they serve as the model's internal representation, capturing abstract features and higher order correlations in the data
> 25:58
> that are not immediately apparent in the visible units alone. Implementing hidden units is straightforward.
> 26:06
> We simply increase the number of neurons in the network. designating some as visible and others as hidden.
> 26:13
> The number of visible units usually corresponds to the data's dimensionality.
> 26:18
> For instance, a 32 by 32 pixel image would require 1024 visible neurons, one for each pixel.
> 26:27
> The number of hidden units, however, is a design choice and can be arbitrarily high.
> 26:32
> Importantly, while there is a conceptual distinction between visible and hidden units,
> 26:38
> the network treats them identically in terms of the update rule. It computes weighted inputs and performs stochastic updates on one neuron at a time,
> 26:48
> regardless of the type. You might wonder if setting weights required known states from the training data.
> 26:56
> How do we handle the weights involving hidden units whose correct states are never directly observed?
> 27:04
> This is where the elegance of the contrastive learning rule shines. The weight adjustment, which is an iterative procedure, looks like this.
> 27:13
> In the positive phase, we clamp the visible units to a training pattern,
> 27:18
> and we allow hidden units to update freely using our stochastic update rule.
> 27:24
> After reaching the equilibrium, we measure the product of xi and xj for all unit pairs, including those involving hidden units.
> 27:34
> In the negative phase, we'll let all units, both visible and hidden, update freely,
> 27:40
> starting from a random configuration. We then update all weights, including those connected to hidden units, using our contrastive update rule.
> 27:50
> This process enables the network to learn appropriate states for hidden units
> 27:55
> that capture the data structure without explicitly specifying what these states should be.
> 28:01
> Overtime, hidden units develop representations that capture important data features.
> 28:08
> The network learns through optimization to leverage these hidden representations
> 28:13
> to better model the training data's probability distribution.
> 28:18
> Before we conclude, let's briefly touch on what is called restricted Boltzmann machines, or RBM.

### Restricted Boltzmann Machines

> 28:26
> Essentially, it is a modification of what we talked about today, but where connections between visible units or between hidden units are prohibited,
> 28:37
> only connections between visible and hidden units are allowed.
> 28:42
> This restriction might seem limiting, but it actually offers a significant advantage.
> 28:48
> It allows for parallel updates of all units in a layer. In a standard Boltzmann machine, we update units one at a time,
> 28:58
> because each neuron's update depends on every other neuron. In an RBM, all visible units can be updated simultaneously
> 29:08
> given the states of all hidden units, and vice versa. This parallelization dramatically speeds up both learning and inference.
> 29:18
> Despite the connectivity restriction, RBM's retain much of the expressive power of full Boltzmann machines,
> 29:25
> while being much more computationally efficient. This efficiency made restricted Boltzmann machines practical for many real-world applications.

### Conclusion & Outro

> 29:37
> All right, let's try to tie everything together. In this video, we have seen how Hopfield networks that could store and recall specific patterns
> 29:47
> could be modified for more creative problems of generating new data.
> 29:53
> In particular, we looked at how incorporating randomness into the update rule
> 29:58
> governed by the Boltzmann distribution and rephrasing the learning objective in terms of maximizing probability of training data
> 30:07
> gives rise to a powerful generative model named the Boltzmann machine.
> 30:13
> This stochastic approach, combined with hidden units, allows Boltzmann machines to learn and capture
> 30:21
> the underlying probability distribution of the training data rather than simply memorizing specific patterns
> 30:28
> by detecting abstract hidden features. Such ability not only to recognize, but to understand and generate
> 30:37
> made Boltzmann machines a crucial stepping stone in the development of modern machine learning.
> 30:43
> And while in practice, they have been largely replaced by more advanced models
> 30:49
> such as multi-layered networks trained through back-propagation, the underlying principles of modeling uncertainty and learning abstract features
> 30:59
> form the foundation of even the most recent generative AI systems.
> 31:06
> Speaking of abstract understanding as opposed to mere memorization, I'd like to thank the sponsor of today's video.
> 31:13
> Shortform is an innovative platform that transforms how we engage with books and other information dense content.
> 31:20
> Shortform goes beyond traditional summaries by offering in-depth book guides
> 31:26
> that provide a comprehensive understanding of the material. along with summary of main points,
> 31:32
> which is usually more detailed than what you might find on other platforms. Shortform guides contain multiple references
> 31:40
> and explain ideas from relevant sources like other books or research articles.
> 31:46
> It's like having a knowledgeable reading companion who highlights the most crucial insights
> 31:52
> and shows you how they fit into a broader context. Shortform's rapidly growing library of books covers a wide range of topics
> 32:00
> such as science, technology, and education. They also have a quite impressive browser extension
> 32:06
> that can generate similar guides for virtually any online content you encounter.
> 32:11
> Don't hesitate to supercharge your reading by clicking the link down in the description
> 32:16
> to get five days of unlimited access and 20% off on annual membership.
> 32:23
> If you liked the video, share it with your friends, press like button and subscribe to the channel if you haven't already.
> 32:29
> Stay tuned for more computational neuroscience and machine learning topics coming up.
> 32:43
> (Subtitles by Crimson Ghoul). <https://www.youtube.com/watch?v=_bqa_I5hNAo&t=180s>

## Substrate-honest framing

This is mirror-tier verbatim preservation per
`.claude/rules/substrate-or-it-didnt-happen.md`. The substantive
substrate-engineering work (composition with Zeta substrate +
F#/TS implementation per 081KSGS9H0008QG0R002F1G7ER Phase 2) is downstream of this
preservation.

The composition-map table at the top is Otto-CLI's substantive
synthesis. The verbatim transcript stays intact below. Future
substrate-engineering work decomposes from sub-row 081KSGS9H0008QG0R002F1G7ER.1.

Per `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md`:
Boltzmann distribution + energy-landscape + Hebbian-learning + RBM
ARE substrate-anchored mathematical objects (not metaphysical
hand-waving). Razor-discipline applies: operational claims survive
the razor; the substantive math is operational. Compositional
substrate-engineering work in subsequent rows decomposes the
substantive substrate per the operator's "we need to copy
everything he does into code" framing.

## Origin

Aaron-forwarded verbatim transcript 2026-05-26 during autonomous-loop
tick session. Operator's positioning + URL forwarded in 2 messages.
Companion backlog row: 081KSGS9H0008QG0R002F1G7ER (this row's anchor).

Composes with `.claude/rules/honor-those-that-came-before.md` —
Kirsanov's pedagogical clarity + research-anchoring discipline IS
substrate worth honoring + composing with rather than collapsing
into the agent's own framing.
