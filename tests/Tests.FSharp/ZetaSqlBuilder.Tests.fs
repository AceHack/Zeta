module Zeta.Tests.ZetaSqlBuilderTests

open Xunit
open Zeta.Core
open Zeta.Core.Sql

type User = { Id: int64; Name: string }
type Order = { Id: int64; UserId: int64; Amount: float }

[<Fact>]
let ``ZetaQueryBuilder selection filters Z-set`` () =
    let users =
        { Stream = ZSet(Pool.Freeze [|
            ZEntry({ Id = 1L; Name = "Alice" }, 1L)
            ZEntry({ Id = 2L; Name = "Bob" }, 1L)
          |]) }
          
    let query =
        zeta {
            for u in users do
            where (u.Id = 1L)
            select u
        }
        
    let expected =
        ZSet(Pool.Freeze [|
            ZEntry({ Id = 1L; Name = "Alice" }, 1L)
        |])
        
    Assert.Equal<ZEntry<User>>(expected, query.Stream)

[<Fact>]
let ``ZetaQueryBuilder join aggregates keys and weights`` () =
    let users =
        { Stream = ZSet(Pool.Freeze [|
            ZEntry({ Id = 1L; Name = "Alice" }, 1L)
            ZEntry({ Id = 2L; Name = "Bob" }, 1L)
          |]) }
          
    let orders =
        { Stream = ZSet(Pool.Freeze [|
            ZEntry({ Id = 100L; UserId = 1L; Amount = 50.0 }, 1L)
            ZEntry({ Id = 101L; UserId = 1L; Amount = 150.0 }, 2L)
          |]) }
          
    let query =
        zeta.Join(users, orders, (fun u -> u.Id), (fun o -> o.UserId), (fun u o -> (u.Name, o.Amount)))
        
    let expected =
        ZSet(Pool.Freeze [|
            ZEntry(("Alice", 50.0), 1L)
            ZEntry(("Alice", 150.0), 2L)
        |])
        
    Assert.Equal<ZEntry<string * float>>(expected, query.Stream)
