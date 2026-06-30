/**
 * Kleisli trace arrows — thread an OpenTelemetry-style trace context across
 * async boundaries. Port of `src/Core/Tracing.fs` (`Traced.Arrow<'A,'B>`,
 * `Traced.compose`).
 *
 * Merge1 §01 (F# Core Algebra). Room operations compose as Kleisli arrows so the
 * trace context propagates without being threaded by hand. Composition is
 * associative and the identity arrow is a unit (verified in tests).
 */

export type TraceContext = {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
};

/** A trace-threading arrow `A → B` in the Task/Promise Kleisli category. */
export type KleisliArrow<A, B> = (ctx: TraceContext, a: A) => Promise<B>;

/** The identity arrow — a left/right unit for {@link composeKleisli}. */
export function identityArrow<A>(): KleisliArrow<A, A> {
  return (_ctx, a) => Promise.resolve(a);
}

/** Kleisli composition `f >=> g`: run `f`, then `g`, threading the same context. */
export function composeKleisli<A, B, C>(
  f: KleisliArrow<A, B>,
  g: KleisliArrow<B, C>,
): KleisliArrow<A, C> {
  return (ctx, a) => f(ctx, a).then((b) => g(ctx, b));
}

/** Left-to-right composition of a non-empty pipeline of same-typed arrows. */
export function pipeKleisli<A>(
  first: KleisliArrow<A, A>,
  ...rest: readonly KleisliArrow<A, A>[]
): KleisliArrow<A, A> {
  return rest.reduce((acc, arrow) => composeKleisli(acc, arrow), first);
}
