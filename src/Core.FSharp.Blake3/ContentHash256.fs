namespace Zeta.Core.FSharp.Blake3

open System
open Zeta.Core

module ContentHash256Blake3Hook =
    do
        ContentHash256.setOfBytesHook (fun bytes -> { Raw = Blake3Spec.hash bytes })
