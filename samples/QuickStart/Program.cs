using System;
using Zeta.Core;
using Zeta.Core.CSharp;

var circuit = new Circuit();
var input = circuit.ZSetInput<int>();
var rows = new[] { 1, 2, 3 };
var output = circuit
    .From(input.Stream)
    .Filter(x => x > 1)
    .Map(x => x * 10)
    .Build();

input.Send(ZSetModule.ofKeys(rows));
await circuit.StepAsync().ConfigureAwait(false);

Console.WriteLine($"20 => {output.Current[20]}");
Console.WriteLine($"30 => {output.Current[30]}");
