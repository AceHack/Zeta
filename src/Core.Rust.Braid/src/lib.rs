//! Braid — Artin's action of B_n on the free group F_n (Artin 1925, faithful) — Rust oracle.
//!
//! Port of `src/Core/Braid.fs` (the F# shelf); agreement locked by the shared seed
//! (`src/Core.TypeScript/braid/golden-vectors.json`) that the C#/F#/TS oracles also verify.
//! Exhibiting data for the faithful-functor kernel theorem (math REPORT #3 §2).
//!
//! A braid word: nonzero ints, +k = sigma_k (1-based), -k = its inverse; applied left-to-right.
//! A free-group word: (generator, exponent) letters (0-based strand, ±1), kept reduced.

/// A free-group letter: (generator index, exponent ±1).
pub type Letter = (i32, i32);

/// A reduced free-group word.
pub type Word = Vec<Letter>;

/// Cancel adjacent inverse pairs until none remain (confluent, terminating).
pub fn reduce(w: &[Letter]) -> Word {
    let mut acc: Word = Vec::with_capacity(w.len());
    for &(g, e) in w {
        match acc.last() {
            Some(&(g1, e1)) if g1 == g && e1 + e == 0 => {
                acc.pop();
            }
            _ => acc.push((g, e)),
        }
    }
    acc
}

/// The inverse word.
pub fn inv(w: &[Letter]) -> Word {
    w.iter().rev().map(|&(g, e)| (g, -e)).collect()
}

/// One generator as a word.
pub fn gen(i: i32) -> Word {
    vec![(i, 1)]
}

fn apply_crossing_to_letter(c: i32, g: i32, e: i32) -> Word {
    let i = c.abs() - 1; // the crossing acts on strands i, i+1
    let image: Word = if c > 0 {
        // sigma_i: x_i -> x_i x_{i+1} x_i^{-1} ; x_{i+1} -> x_i
        if g == i {
            vec![(i, 1), (i + 1, 1), (i, -1)]
        } else if g == i + 1 {
            vec![(i, 1)]
        } else {
            vec![(g, 1)]
        }
    } else {
        // sigma_i^{-1}: x_i -> x_{i+1} ; x_{i+1} -> x_{i+1}^{-1} x_i x_{i+1}
        if g == i {
            vec![(i + 1, 1)]
        } else if g == i + 1 {
            vec![(i + 1, -1), (i, 1), (i + 1, 1)]
        } else {
            vec![(g, 1)]
        }
    };
    if e == 1 {
        image
    } else {
        inv(&image)
    }
}

/// Apply one crossing to a word (homomorphic extension), reduced.
pub fn apply_crossing(c: i32, w: &[Letter]) -> Word {
    let expanded: Word = w
        .iter()
        .flat_map(|&(g, e)| apply_crossing_to_letter(c, g, e))
        .collect();
    reduce(&expanded)
}

/// Apply a braid word (crossings left-to-right) to a free-group word.
pub fn act(braid: &[i32], w: &[Letter]) -> Word {
    braid
        .iter()
        .fold(w.to_vec(), |acc, &c| apply_crossing(c, &acc))
}

/// The writhe: exponent sum — the unique homomorphism B_n -> Z.
pub fn writhe(b: &[i32]) -> i32 {
    b.iter().map(|&c| if c > 0 { 1 } else { -1 }).sum()
}

/// Writhe parity — the character B_n -> Z/2 (= word length mod 2 = the permutation's sign).
pub fn writhe_parity(b: &[i32]) -> i32 {
    (b.len() % 2) as i32
}

/// The underlying permutation (position -> strand id): the order-forgetting quotient B_n ->> S_n.
pub fn permutation(n: usize, b: &[i32]) -> Vec<i32> {
    let mut arr: Vec<i32> = (0..n as i32).collect();
    for &c in b {
        let i = (c.abs() - 1) as usize;
        if i + 1 < n {
            arr.swap(i, i + 1);
        }
    }
    arr
}
