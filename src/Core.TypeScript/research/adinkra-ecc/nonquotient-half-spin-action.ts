/**
 * Non-quotient half-spin action census.
 *
 * Design boundary: this is a finite complexified Fock-model action of the
 * 120 bivectors of so(16) on S+ (dimension 128). It deliberately does not
 * construct Lambda^2 S+ -> so(16), verify the mixed Jacobi identity, or
 * assign a regularity / homoiconicity score to the non-quotient lane.
 */

export interface Complex {
  readonly re: number;
  readonly im: number;
}

export interface ActionTerm {
  readonly target: number;
  readonly coefficient: Complex;
}

export interface HalfSpinActionOptions {
  /** Fault injection only: removes the Jordan-Wigner parity string. */
  readonly omitJordanWignerParity?: boolean;
}

export interface HalfSpinActionCensus {
  readonly cliffordGeneratorCount: number;
  readonly fullCarrierDimension: number;
  readonly positiveChiralityDimension: number;
  readonly negativeChiralityDimension: number;
  readonly bivectorGeneratorCount: number;
  readonly gammaAnticommutatorViolations: number;
  readonly chiralityViolations: number;
  readonly gramDiagonalViolations: number;
  readonly gramOffDiagonalViolations: number;
  readonly bivectorCommutatorViolations: number;
  readonly regularity: {
    readonly status: "unmeasured";
    readonly missingWitnesses: readonly string[];
  };
}

const MODE_COUNT = 8;
const CLIFFORD_GENERATOR_COUNT = MODE_COUNT * 2;
const FULL_CARRIER_DIMENSION = 1 << MODE_COUNT;

const ZERO: Complex = { re: 0, im: 0 };

function complex(re: number, im = 0): Complex {
  return { re, im };
}

function add(left: Complex, right: Complex): Complex {
  return complex(left.re + right.re, left.im + right.im);
}

function multiply(left: Complex, right: Complex): Complex {
  return complex(left.re * right.re - left.im * right.im, left.re * right.im + left.im * right.re);
}

function conjugate(value: Complex): Complex {
  return complex(value.re, -value.im);
}

function scale(value: Complex, factor: number): Complex {
  return complex(value.re * factor, value.im * factor);
}

function isZero(value: Complex): boolean {
  return value.re === 0 && value.im === 0;
}

function equal(left: Complex, right: Complex): boolean {
  return left.re === right.re && left.im === right.im;
}

function parityBelow(mask: number, mode: number): number {
  const lower = mask & ((1 << mode) - 1);
  let count = 0;
  for (let cursor = lower; cursor !== 0; cursor >>>= 1) {
    count += cursor & 1;
  }
  return count % 2 === 0 ? 1 : -1;
}

function parity(mask: number): number {
  let count = 0;
  for (let cursor = mask; cursor !== 0; cursor >>>= 1) {
    count += cursor & 1;
  }
  return count % 2;
}

function mapTerms(terms: readonly ActionTerm[]): Map<number, Complex> {
  const result = new Map<number, Complex>();
  for (const term of terms) {
    const previous = result.get(term.target) ?? ZERO;
    const next = add(previous, term.coefficient);
    if (isZero(next)) {
      result.delete(term.target);
    } else {
      result.set(term.target, next);
    }
  }
  return result;
}

function mapsEqual(left: ReadonlyMap<number, Complex>, right: ReadonlyMap<number, Complex>): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const [target, coefficient] of left) {
    const expected = right.get(target);
    if (expected === undefined || !equal(coefficient, expected)) {
      return false;
    }
  }
  return true;
}

/**
 * Gamma_{2m} is the Jordan-Wigner X action and Gamma_{2m+1} the Y action.
 * On each occupation mask a gamma has one non-zero image, so all checks are
 * exact integer/imaginary arithmetic rather than floating approximations.
 */
export function gammaAction(generator: number, mask: number, options: HalfSpinActionOptions = {}): ActionTerm {
  if (generator < 0 || generator >= CLIFFORD_GENERATOR_COUNT) {
    throw new Error(`generator ${generator} is outside 0..${CLIFFORD_GENERATOR_COUNT - 1}`);
  }
  if (mask < 0 || mask >= FULL_CARRIER_DIMENSION) {
    throw new Error(`mask ${mask} is outside the ${FULL_CARRIER_DIMENSION}-state carrier`);
  }

  const mode = Math.floor(generator / 2);
  const occupied = (mask & (1 << mode)) !== 0;
  const stringSign = options.omitJordanWignerParity ? 1 : parityBelow(mask, mode);
  const target = occupied ? mask & ~(1 << mode) : mask | (1 << mode);

  if (generator % 2 === 0) {
    return { target, coefficient: complex(stringSign) };
  }

  // Y|0> = i|1>; Y|1> = -i|0>, including the Jordan-Wigner string.
  return { target, coefficient: complex(0, stringSign * (occupied ? -1 : 1)) };
}

export function bivectorAction(
  first: number,
  second: number,
  mask: number,
  options: HalfSpinActionOptions = {},
): ActionTerm {
  if (first === second) {
    throw new Error("a bivector requires two distinct Clifford generators");
  }
  const right = gammaAction(second, mask, options);
  const left = gammaAction(first, right.target, options);
  return { target: left.target, coefficient: multiply(left.coefficient, right.coefficient) };
}

function gammaProduct(first: number, second: number, mask: number, options: HalfSpinActionOptions): ActionTerm {
  const right = gammaAction(second, mask, options);
  const left = gammaAction(first, right.target, options);
  return { target: left.target, coefficient: multiply(left.coefficient, right.coefficient) };
}

function applyBivectorLinear(
  first: number,
  second: number,
  mask: number,
  factor: number,
  options: HalfSpinActionOptions,
): ActionTerm[] {
  if (first === second || factor === 0) {
    return [];
  }
  const orientation = first < second ? 1 : -1;
  const ordered: readonly [number, number] = first < second ? [first, second] : [second, first];
  const image = bivectorAction(ordered[0], ordered[1], mask, options);
  return [{ target: image.target, coefficient: scale(image.coefficient, factor * orientation) }];
}

function expectedBivectorCommutator(
  first: number,
  second: number,
  third: number,
  fourth: number,
  mask: number,
  options: HalfSpinActionOptions,
): Map<number, Complex> {
  const terms: ActionTerm[] = [];
  if (second === third) terms.push(...applyBivectorLinear(first, fourth, mask, 2, options));
  if (first === third) terms.push(...applyBivectorLinear(second, fourth, mask, -2, options));
  if (second === fourth) terms.push(...applyBivectorLinear(first, third, mask, -2, options));
  if (first === fourth) terms.push(...applyBivectorLinear(second, third, mask, 2, options));
  return mapTerms(terms);
}

function observedBivectorCommutator(
  first: number,
  second: number,
  third: number,
  fourth: number,
  mask: number,
  options: HalfSpinActionOptions,
): Map<number, Complex> {
  const secondThen = bivectorAction(third, fourth, mask, options);
  const left = bivectorAction(first, second, secondThen.target, options);
  const firstThen = bivectorAction(first, second, mask, options);
  const right = bivectorAction(third, fourth, firstThen.target, options);

  return mapTerms([
    { target: left.target, coefficient: multiply(left.coefficient, secondThen.coefficient) },
    { target: right.target, coefficient: scale(multiply(right.coefficient, firstThen.coefficient), -1) },
  ]);
}

function bivectorPairs(): readonly (readonly [number, number])[] {
  const pairs: [number, number][] = [];
  for (let first = 0; first < CLIFFORD_GENERATOR_COUNT; first += 1) {
    for (let second = first + 1; second < CLIFFORD_GENERATOR_COUNT; second += 1) {
      pairs.push([first, second]);
    }
  }
  return pairs;
}

const BIVECTOR_PAIRS = bivectorPairs();

function positiveChiralityMasks(): readonly number[] {
  const masks: number[] = [];
  for (let mask = 0; mask < FULL_CARRIER_DIMENSION; mask += 1) {
    if (parity(mask) === 0) {
      masks.push(mask);
    }
  }
  return masks;
}

const POSITIVE_CHIRALITY_MASKS = positiveChiralityMasks();

function countGammaAnticommutatorViolations(options: HalfSpinActionOptions): number {
  let violations = 0;
  for (let first = 0; first < CLIFFORD_GENERATOR_COUNT; first += 1) {
    for (let second = 0; second < CLIFFORD_GENERATOR_COUNT; second += 1) {
      for (let mask = 0; mask < FULL_CARRIER_DIMENSION; mask += 1) {
        const forward = gammaProduct(first, second, mask, options);
        const backward = gammaProduct(second, first, mask, options);
        const observed = mapTerms([forward, backward]);
        const expected = first === second ? mapTerms([{ target: mask, coefficient: complex(2) }]) : new Map();
        if (!mapsEqual(observed, expected)) {
          violations += 1;
        }
      }
    }
  }
  return violations;
}

function countChiralityViolations(options: HalfSpinActionOptions): number {
  let violations = 0;
  for (const [first, second] of BIVECTOR_PAIRS) {
    for (const mask of POSITIVE_CHIRALITY_MASKS) {
      if (parity(bivectorAction(first, second, mask, options).target) !== 0) {
        violations += 1;
      }
    }
  }
  return violations;
}

function gramEntry(
  leftPair: readonly [number, number],
  rightPair: readonly [number, number],
  options: HalfSpinActionOptions,
): Complex {
  let total = ZERO;
  for (const mask of POSITIVE_CHIRALITY_MASKS) {
    const left = bivectorAction(leftPair[0], leftPair[1], mask, options);
    const right = bivectorAction(rightPair[0], rightPair[1], mask, options);
    if (left.target === right.target) {
      total = add(total, multiply(conjugate(left.coefficient), right.coefficient));
    }
  }
  return total;
}

function countGramViolations(options: HalfSpinActionOptions): readonly [number, number] {
  let diagonalViolations = 0;
  let offDiagonalViolations = 0;
  for (let leftIndex = 0; leftIndex < BIVECTOR_PAIRS.length; leftIndex += 1) {
    const left = BIVECTOR_PAIRS[leftIndex];
    if (left === undefined) {
      throw new Error("bivector pair index unexpectedly absent");
    }
    for (let rightIndex = 0; rightIndex < BIVECTOR_PAIRS.length; rightIndex += 1) {
      const right = BIVECTOR_PAIRS[rightIndex];
      if (right === undefined) {
        throw new Error("bivector pair index unexpectedly absent");
      }
      const observed = gramEntry(left, right, options);
      const expected = leftIndex === rightIndex ? complex(POSITIVE_CHIRALITY_MASKS.length) : ZERO;
      if (!equal(observed, expected)) {
        if (leftIndex === rightIndex) diagonalViolations += 1;
        else offDiagonalViolations += 1;
      }
    }
  }
  return [diagonalViolations, offDiagonalViolations];
}

function countBivectorCommutatorViolations(options: HalfSpinActionOptions): number {
  let violations = 0;
  for (const [first, second] of BIVECTOR_PAIRS) {
    for (const [third, fourth] of BIVECTOR_PAIRS) {
      for (const mask of POSITIVE_CHIRALITY_MASKS) {
        const observed = observedBivectorCommutator(first, second, third, fourth, mask, options);
        const expected = expectedBivectorCommutator(first, second, third, fourth, mask, options);
        if (!mapsEqual(observed, expected)) {
          violations += 1;
        }
      }
    }
  }
  return violations;
}

export function measureNonQuotientHalfSpinAction(options: HalfSpinActionOptions = {}): HalfSpinActionCensus {
  const [gramDiagonalViolations, gramOffDiagonalViolations] = countGramViolations(options);

  return {
    cliffordGeneratorCount: CLIFFORD_GENERATOR_COUNT,
    fullCarrierDimension: FULL_CARRIER_DIMENSION,
    positiveChiralityDimension: POSITIVE_CHIRALITY_MASKS.length,
    negativeChiralityDimension: FULL_CARRIER_DIMENSION - POSITIVE_CHIRALITY_MASKS.length,
    bivectorGeneratorCount: BIVECTOR_PAIRS.length,
    gammaAnticommutatorViolations: countGammaAnticommutatorViolations(options),
    chiralityViolations: countChiralityViolations(options),
    gramDiagonalViolations,
    gramOffDiagonalViolations,
    bivectorCommutatorViolations: countBivectorCommutatorViolations(options),
    regularity: {
      status: "unmeasured",
      missingWitnesses: [
        "spinor-spinor bracket Lambda^2(S+) -> so(16)",
        "mixed Jacobi witness for so(16) plus S+",
        "regular-module carrier and rank-one action witness",
      ],
    },
  };
}
