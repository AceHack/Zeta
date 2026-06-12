# GGUF / llama.cpp quantization — legacy vs K-quants vs I-quants, super-blocks, the importance matrix, mixed precision — verbatim transcript, Aaron-forwarded

> **IP-questionable storage convention:** Aaron forwarded the transcript of
> https://www.youtube.com/watch?v=vW30o4U9BFE&t=260s (a quantization-series explainer on the
> GGML/llama.cpp/GGUF stack; the creator maintains a companion GitHub repo as community
> documentation) on 2026-06-12: "save this one too plese." Preserved verbatim per the folder
> convention; third-party content, not ours.
>
> **Why it lands here (shadow's routing note):** this is *deployed industrial prior art for the
> float-budget thesis*. The GGUF importance matrix assigns per-weight precision **sized to
> importance** (squared activation — borrowed from AWQ), mixed-precision variants (\_S/\_M/\_L)
> make **width an output, not a constant** (Aaron's binding correction: "the number 10 is a
> guess… the float budget algo is what I'm creating"), super-blocks are two-level quantization
> = quantizing the quantization constants (the recursive-budget shape, ferry 7), and decoupling
> quantize/dequantize scales via an importance-weighted MSE is precision-weighting (REPORT #2's
> Friston verdict) running in production on consumer CPUs. Also relevant: Ball.BitsUsed (bits =
> signal above noise) is the same dictionary GGUF prices in bits-per-weight. Cross-refs:
> REPORT #2 (soft-max width theorem), ferries 3/7, `docs/PRIMITIVE-REGISTRY.md` UniversalNumber
> row. Beacon: Gerganov (GGML/llama.cpp/GGUF); Frantar et al. (GPTQ); Lin et al. (AWQ);
> Dettmers et al. (QLoRA double quantization).

## Verbatim transcript

Large language models can be really large, and if you wanna run them locally with full privacy and no internet connection, then you probably have to shrink them first.

This process is called model quantization.

The most popular tool today is GGUF, which is backed by Llama CPP an LLM inference engine.

With the right settings, you can bring down a DeepSeek R one model from 700 gigabytes down to a hundred gigabytes.

However, getting the settings right for your particular use case is incredibly overwhelming.

That's because there are multiple algorithms and a ton of options, and nobody really understands what they do.

Unfortunately, the documentation is really sparse and we're probably never going to see .An official paper.

One of the authors said.

There are no papers because I don't like writing papers. I see no reason to go and advertise on archive, so no wonder everybody's confused.

There are a ton of questions on Reddit, and the answers are sometimes half baked or even wrong.

This video is my attempt at fixing this situation.

I made a public GitHub repo, which is linked in the description with a writeup of this video, and hopefully that can function as the documentation that they don't wanna write.

So if you see any mistakes, which is totally possible, or omissions, feel free to send a pull request.

So here's what I was able to piece together by reading the code and the comments on the pull requests.

### The stack: GGML, llama.cpp, GGUF

The technology stack we're about to discuss falls under the umbrella of post-training quantization.

We take an already trained full precision model like Llama and map each floating point weight to a lower bit integer.

This reduces the memory bottleneck and allows us to run a fully fledged LLM on a consumer CPU.

Over the years, various post-training quantization methods took center stage, including research projects like GPTQ and AWQ.

But currently, as of July, 2025, GGUF is the dominant quantization framework for running Llama like models on CPUs.

But unlike previous methods, which originated from research labs, GGUF comes from a prolific and independent open source contributor.

Georgi Gerganov, seen here, not very pleased with older quantization methods.

Gerganov build a much broader ecosystem for LLM inference, which among other things also supports quantization.

At the basis of his technology stack Sits.

GGML, a minimal high performance tensor library for machine learning written mostly in C and C++.

You can think of it as a very lean alternative to PyTorch.

It implements the core linear algebra needed to run efficient model inference on CPUs.

llama.cpp is an LLM inference built on top of GGML.

It adds higher level primitives for loading and running Llama like models on your computer.

It also comes with tools to quantize models and run inference on quantize checkpoints.

And finally, GGUF is a binary file format that stores the quantized weights.

It's similar to hugging faces, safetensors, but stores additional metadata about the model, and each tensor,

Presumably Gerganov woke up one morning and decided there were too many model formats out there, so he made a universal one.

From now on, I'll be using the widely adopted term GGUF quantization to refer to this entire stack, but keep in mind, it's a bit of a misnomer since technically the GGUF format is only the tip of the iceberg.

### End-to-end workflow

So here's what a typical workflow looks like.

I'll include these commands in the GitHub repo linked in the description.

Step one, install llama.cpp, which comes with a bunch of useful binaries.

Step two, make sure your full precision model is in GGUF format.

Step three, run llama-quantize to shrink it.

And step four, run inference on your quantized model with llama-cli, this workflow might seem straightforward, but the real challenge is choosing the right quantization settings.

There are about 40 options to choose from, and the best choice depends on a bunch of factors.

The original model you're starting with your hardware setup and the trade off you're willing to make between quality and speed.

The reality is there's no silver bullet.

I won't be able to provide a one size fits all solution that works best in all scenarios, but what I can do is walk you through the various algorithms and options so that you can make an informed decision.

Again, I can't promise I won't make any mistakes, especially in a world of no documentation and AI agents that completely hallucinate on the topic.

Also, I won't be able to edit this video, so let's use the GitHub repo linked in the description as a more up-to-date live resource.

### Overview: Legacy, K-quants, I-quants

So far, llama.cpp has seen three major generations of quantization algorithms, legacy quants, K-quants, and I-quants.

Each of these categories contains multiple versions, and luckily there's a naming convention that helps us tell them apart.

Legacy quants usually end in zero or one while K-quants and I-quants include their letter in the name.

The Q part tells us the bit width.

For example, Q4 means the weights are stored as four bit integer.

### Legacy quants (Type 0, Type 1)

So let's start with a legacy quants, even though they're deprecated as a standalone quantization method.

They're still relevant because later versions build on top of them rather than replace them.

Legacy quants use the most basic form of linear quantization, which I covered in detail in my foundations video.

There are two subcategories, type zero and type one.

In a nutshell, they correspond to symmetric and asymmetric quantization respectively.

If you're already familiar with these concepts, feel free to skip this chapter.

Otherwise, let's start with a legacy type Zero.

We'll take a concrete example and quantize float 16 weights into INT4.

Say the model weights range between minus one and plus one more Generally, I'll call these boundaries alpha, the minimum and beta the maximum.

On the integer side, we'll use a symmetric range between minus seven and plus seven, which gives us 15 evenly spaced bins given a real value R, the question is which integer bin should it map to?

The first step is to compute the scale S, which is the ratio between the width of the floating point interval and the width of the integer interval.

In other words, the scale measures how wide one space is compared to the other.

If we stretch the real interval by one over s, the two spaces align and we can now assign R to its nearest bin.

This is exactly how Type zero quants work in the checkpoint.

Each weight is stored as a quantized integer, along with a floating point scale

Now the setup we just discussed assumes the real interval is centered around zero, but in practice that's not always true.

What happens if your weights span from minus one to plus two?

If you naively stretch this interval to match the integer range? the alignment will be off to fix this type zero quants.

Fake symmetry.

By pretending the range goes from minus two to plus two, then we run the same symmetric algorithm as before, but this comes at a cost.

The buckets covering the fake region from minus two to minus one go completely unused.

This is where type one quantization comes in.

To fully use the available bins, it maps the minimum alpha to the leftmost bucket and the maximum beta to the rightmost.

In our example where weights go from minus one to plus two, the floating point value zero sits about one third of the way in landing in bucket negative two.

This bucket is called the zero point and is denoted by Z. Z can be computed from Alpha S and the integer boundaries, and it serves as an alignment offset.

It tells us how much to shift left before rescaling the float interval.

So type one quants depend on two constants, S and Z. In practice GGUF stores S and alpha from which Z can be easily derived.

This extra value, which they often call min or offset, is the reason why type one is less memory efficient, but more precise than type zero.

So how much extra storage does type one require compared to type zero?

Well, that depends on how many sets of quantization constants we have.

In theory, we could have one per model or one per weight matrix in practice.

Legacy quants.

Use block quantization.

That means one set of constants for each block of 16 or 32 individual scalar weights

. given a weight matrix W we'll split it into fixed size blocks independently.

In each block, we'll find the minimum value alpha and maximum value beta.

Based on these, we'll calculate separate scales S for each block and apply quantization.

So in the final checkpoint, we'll store the INT4 matrix together with two sets of quantization constants in floating point 16 precision.

The block size is like a knob.

When you increase it, you save space by storing fewer quantization constants, but you lose granularity

for a block size of 32, a 16 billion parameter model.

Would need about two gigabytes just to store the quantization constants on top of the quantized weights themselves.

### K-quants

K-quants, The second generation of the Llama CPP Quantization algorithm reduces this overhead with a deceptively simple solution.

Why not quantize the quantization constants themselves?

This time we'll group eight regular blocks into one big super block on the quantized side.

Each regular block still contains 32 INT4 weights, but this time the scales S and offsets alpha corresponding to each block are stored as INT8.

They are themselves quantized values, so to de quantize them, we now need an extra pair of floating point 16 constants for the entire super block.

This is a two level quantization scheme.

The super scale dequant sizes, the block scale, which dequant sizes, the weights.

This saves quite a bit of space.

In our 16 billion parameter model, the overhead is only one gigabyte instead of two.

While the term super blocks is GGUF specific, the core idea isn't new.

The QLoRA paper published a few years earlier called this Technique Double Quantization.

What is relatively novel in GGUF is the use of super blocks to improve memory efficiency.

The basic idea is that reading small, scattered chunks of memory, like a single 32 element block, can lead to poor utilization of cache lines and memory bandwidth by grouping blocks into super blocks and accessing them together, the runtime can take better advantage of sequential reads and reduced memory overhead.

So to recap, K-quants are not replacing Legacy quants.

They're simply an improvement that introduces an extra layer of quantization for the constants.

And now here's a question that is harder than it should be.

What does the K in K-quants stand for?

There are plenty of hypotheses online, but the truth is we don't know for sure.

Based on this project's history of naming things after people, I believe it comes from Kawrakow which is the name of the developer who submitted the K-quants pull request, or it could stand for kernels because they had to implement new CPU kernels.

I'm not sure.

But I will tell you one thing, it does not come from K means clustering.

This is a misunderstanding that you'll see everywhere online and even Claude Opus with deep research gets it wrong.

Here's where I think this misunderstanding comes from. I. K means is a specific type of vector quantization, which I'll explain in a bit.

### I-quants

Vector quantization is what I-quants use, not K-quants.

So the fact that K means that K-quants share a letter is just an unfortunate coincidence.

So then let's move on to I-quants.

This third generation of the Llama CPP Quantization algorithm is quite a big conceptual departure from K-quants.

I-quants interpret groups of weights as vectors in an N-dimensional space.

For instance, let's look at a group of three weights.

We can visualize it as a 3D vector, where the weights are the X, Y, Z coordinates.

In this space, we define a set of fixed reference vectors, the conceptual equivalent of integer bins used in legacy and K-quants.

Reference vectors are stored in a code book, which maps each vector to an arbitrary binary code quantizing, the three weights, or our yellow vector means finding its nearest reference vector in the code book and then applying a scale to match its norm.

Effectively, we quantized three full precision weights into a single binary code.

This is a lossy operation.

The scale will allow us to recover the magnitude of the original vector, but the angular distance between the two vectors is forever lost.

To minimize the loss, we'll have to make sure that the Codebook covers as many directions as possible.

Now groups of three weights are easy to visualize, but in practice, GGUF primarily uses eight dimensional vectors.

So how are these reference vectors chosen?

Honestly, we don't know for sure.

They're just hard coded in one of the header files.

Each of these hexa decimal values store an entire eight dimensional vector in a very compact way.

The exact decoding scheme that turns them back into eight different dimensions is different for every I-quant subtype, so I won't describe it exhaustively, but if you have the patience to read the code, it's quite incredible to see how they utilize every single bit to the fullest.

Here's one hack related to the code book table that I thought was pretty smart.

In their Codebook reference, vectors always have positive coordinates before matching a weight vector against the codebook, they flip the sign of all its negative dimensions, so the nearest neighbor search will always compare exclusively positive vectors against each other, apples to apples.

But of course, we wouldn't want to lose the sign information.

So a quantized vector is stored as the code of its reference vector, plus its original signs, which can be compressed into a bite.

The net effect is we virtually expanded the size of the code book by a factor of 256.

A smaller code book is easier to store, and nearest neighbor search is also faster.

Now, let's do some quick math to figure out the compression rate for this setup.

For an eight dimensional weight factor, we're storing an eight bit code, plus eight bits worth of signs.

That's two bits per weight, not accounting for the scale.

But because I-quants share the same scale across 256 vectors, this is the equivalent of a block in the world of K-quants.

The overhead is minimal.

So what we describe here is the IQ2 quants.

There's also IQ1, IQ3, and IQ4.

These different bit rates are obtained by tweaking parameters like the code book size.

So what does the I in I-quants stand for?

The answer is a little bit nuanced.

Most likely I stands for importance as an importance matrix,

### Importance Matrix

The importance matrix was added at the same time with I-quants, but it's actually an orthogonal concept that can be applied to legacy and K-quants as well. I. The core idea is that not all model weights are equally important.

A weight is considered important if small changes to it cause large changes in the model's output, so it deserves more precise quantization

to estimate importance.

We observe model behavior on a calibration data set.

Typically a few hundred examples from Wiki text.

A small Wikipedia subset,

quantization with an imatrix becomes a two step process.

Step one, compute the importance scores based on the full precision model's behavior on the calibration dataset.

Step two, run quantization with the iMatrix as an input.

During step one, GGUF assigns an importance score to each row of the matrix.

W. During inference on a calibration data point, an input activation x is multiplied by the matrix W to produce an output activation Y.

Then the importance score for each row is given by the squared output activation for that row.

This idea was borrowed from an older algorithm called activation aware quantization or AWQ.

The final importance matrix combines the per row importance with the magnitude of each individual weight.

The more interesting question is, how do we leverage the importance matrix to allocate more precision to the important weights?

In the methods discussed, so far the same constants S and Z are used during both quantization, which maps floats to integers and de-quantization, which attempts the reverse.

Of course, we won't be able to perfectly recover the original values because rounding wipes out some precision, hence the clusters.

Moreover, the loss in precision affects all weights equally.

But now we want to take weight importance into account.

Let's say this weight over here has value 0.5 and was deemed important.

Quantization will map it to bucket zero and de-quantization will reconstruct it as 0.429.

But it would be great to actually recover the original 0.5 since it's so important.

And to do that we'll tweak the de-quantization process instead of using the original scale 0.21, we'll use a different scale S prime and set it to 0.25, which will nudge the de-quantized value to the desired place.

Effectively, we decouple the constants used during quantization and de-quantization.

So we already have formulas for S and Z, but how can we find the optimal S prime and Z prime in a way that takes into account the importance matrix?

Well, we can treat this as an optimization problem.

The ultimate goal is to keep dequantized values in W hat as close as possible to their counterparts in W, which can be expressed as this mean squared error.

The trick is we'll weigh each error by its importance.

This way important weights will contribute more to the loss, so they will be quantized more accurately.

W Hat is a function of our four quantization constants.

With S and Z fixed by the formulas on the previous slide.

This becomes an optimization problem with parameters S prime and Z prime.

And since this is simple quadratic, it turns out there's a closed form expression for the optimal solution, which I won't spell out here.

It's straightforward math.

S prime, and Z prime are the constants we'll end up storing in our checkpoint alongside the quantized weights.

The original S and Z don't need to be stored explicitly.

They've already impacted the quantized weights, so we're almost done with the importance matrix, but there's one final wrinkle.

So far, we've been using these formulas to calculate S and Z for quantization, but GGUF goes one step further and does a small grid search around this.

S. For instance, if we increase it just a little bit, we're effectively clipping out high magnitude weights and reallocating more precision around zero.

So the final algorithm for picking quantization constants looks like this.

Calculate initial S and Z values, then do grid search in the vicinity of S.

For each S candidate, calculate S prime and Z prime that minimize the loss, keep track of that loss, and ultimately pick the combination that has the minimum loss and we're finally done.

### Recap

So to recap, GGUF went through three generations of quantization algorithms.

Legacy quants are basic linear quantization, where the scale is shared across the weights within a block K-quants introduced super blocks, which reduced the overhead incurred by quantization constants, and led to more efficient memory reads.

I-quants switch to vector quantization, which improve the compression rate even further.

And finally, the importance matrix is a quality improvement that can be applied to any of these versions and which comes for free.

It's simply a way to select better scales.

There's one more aspect that I wanted to touch on.

### Mixed precision (\_S, \_M, \_L, \_XL)

Some of the K-quants variants have a size modifier, be it S for small, M for medium, L for large, and so on.

These modifiers are present because not all model weights get quantized down to the same bit.

With

here we're looking at a Qwen model that was quantized with Q4 quants.

Small or S on the left and M or medium on the right, even though officially the quantization method I used was Q4.

We see a variety of precisions across the model.

Indeed, some weights are truly in four bits, but some are in full precision, like the layer norm ones, and some are somewhere in between.

The small version uses Q5 and the median version uses Q6.

These in-between weights were manually flagged by the GGUF authors to be allocated more precision.

The size modifiers in the file name loosely indicate how much precision.

If you want to learn more about mixed precision and why it's critical to preserve model quality, check out my previous video in the quantization series.

I know that was a lot.

It was a lot for me too, and I haven't even covered all the smart tricks that they use for bit packing.

Also, reading C and C++ is definitely not my favorite pastime.

Anyway, don't forget about the GitHub repo.

I love your contributions.

Thanks for watching, and I'll see you next time.
