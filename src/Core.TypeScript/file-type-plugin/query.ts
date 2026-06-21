import { type Expr, type ConstValue, type BinOp } from "../bonsai/bonsai";
import { type Tagged } from "../dynamic-value/types";
import { type ZEntry, ofEntries } from "../z-set/z-set";
import { compareTagged, taggedToZSet, zsetToTagged } from "./types";
import { jsToTagged } from "./codecs";

export type QueryEnv = Readonly<Record<string, Tagged>>;

function constToTagged(c: ConstValue): Tagged {
  switch (c.t) {
    case "null":
      return { t: "null" };
    case "bool":
      return { t: "bool", v: c.v };
    case "int":
      return { t: "int", v: c.v.toString() };
    case "str":
      return { t: "str", v: c.v };
  }
}

function evaluateBinary(op: BinOp, left: Tagged, right: Tagged): Tagged {
  switch (op) {
    case "add": {
      if (left.t === "int" && right.t === "int") {
        return { t: "int", v: (BigInt(left.v) + BigInt(right.v)).toString() };
      }
      throw new Error(`Invalid operands for add: ${left.t} + ${right.t}`);
    }
    case "sub": {
      if (left.t === "int" && right.t === "int") {
        return { t: "int", v: (BigInt(left.v) - BigInt(right.v)).toString() };
      }
      throw new Error(`Invalid operands for sub: ${left.t} - ${right.t}`);
    }
    case "mul": {
      if (left.t === "int" && right.t === "int") {
        return { t: "int", v: (BigInt(left.v) * BigInt(right.v)).toString() };
      }
      throw new Error(`Invalid operands for mul: ${left.t} * ${right.t}`);
    }
    case "eq": {
      return { t: "bool", v: compareTagged(left, right) === 0 };
    }
    case "lt": {
      return { t: "bool", v: compareTagged(left, right) < 0 };
    }
    case "and": {
      if (left.t === "bool" && right.t === "bool") {
        return { t: "bool", v: left.v && right.v };
      }
      throw new Error(`Invalid operands for and: ${left.t} and ${right.t}`);
    }
    case "or": {
      if (left.t === "bool" && right.t === "bool") {
        return { t: "bool", v: left.v || right.v };
      }
      throw new Error(`Invalid operands for or: ${left.t} or ${right.t}`);
    }
  }
}

function getField(entry: Tagged, fieldName: string): Tagged {
  if (entry.t === "obj") {
    const kVal = entry.v.find(([k]) => k === "k")?.[1];
    const vVal = entry.v.find(([k]) => k === "v")?.[1];
    if (kVal && kVal.t === "str" && kVal.v === fieldName && vVal) {
      return vVal;
    }
  }
  return { t: "null" };
}

function evaluateCall(fn: string, args: readonly Expr[], env: QueryEnv): Tagged {
  switch (fn) {
    case "filter": {
      if (args.length !== 2) throw new Error("filter expects 2 arguments");
      const zsetVal = evaluateQuery(args[0]!, env);
      const lambdaExpr = args[1]!;
      if (lambdaExpr.kind !== "lambda") throw new Error("filter second argument must be a lambda");

      const zset = taggedToZSet(zsetVal);
      const filtered: ZEntry<Tagged>[] = [];
      const paramName = lambdaExpr.params[0]!;

      for (const entry of zset) {
        const result = evaluateQuery(lambdaExpr.body, {
          ...env,
          [paramName]: entry.e
        });
        if (result.t === "bool" && result.v) {
          filtered.push(entry);
        }
      }
      return zsetToTagged(filtered);
    }
    case "map": {
      if (args.length !== 2) throw new Error("map expects 2 arguments");
      const zsetVal = evaluateQuery(args[0]!, env);
      const lambdaExpr = args[1]!;
      if (lambdaExpr.kind !== "lambda") throw new Error("map second argument must be a lambda");

      const zset = taggedToZSet(zsetVal);
      const mappedEntries: ZEntry<Tagged>[] = [];
      const paramName = lambdaExpr.params[0]!;

      for (const entry of zset) {
        const newKey = evaluateQuery(lambdaExpr.body, {
          ...env,
          [paramName]: entry.e
        });
        mappedEntries.push({ e: newKey, w: entry.w });
      }
      return zsetToTagged(ofEntries(compareTagged, mappedEntries));
    }
    case "get_field": {
      if (args.length !== 2) throw new Error("get_field expects 2 arguments");
      const entryVal = evaluateQuery(args[0]!, env);
      const nameVal = evaluateQuery(args[1]!, env);
      if (nameVal.t !== "str") throw new Error("get_field field name must be a string");

      return getField(entryVal, nameVal.v);
    }
    case "get_zset_field": {
      if (args.length !== 2) throw new Error("get_zset_field expects 2 arguments");
      const zsetVal = evaluateQuery(args[0]!, env);
      const nameVal = evaluateQuery(args[1]!, env);
      if (nameVal.t !== "str") throw new Error("get_zset_field field name must be a string");

      const zset = taggedToZSet(zsetVal);
      for (const entry of zset) {
        const fieldVal = getField(entry.e, nameVal.v);
        if (fieldVal.t !== "null") {
          return fieldVal;
        }
      }
      return { t: "null" };
    }
    default:
      throw new Error(`Unknown query function: ${fn}`);
  }
}

/**
 * Synchronously evaluate a Bonsai query expression over an environment.
 */
export function evaluateQuery(expr: Expr, env: QueryEnv): Tagged {
  switch (expr.kind) {
    case "const":
      return constToTagged(expr.value);
    case "param":
      if (!(expr.name in env)) {
        throw new Error(`Unbound variable: ${expr.name}`);
      }
      return env[expr.name]!;
    case "cond": {
      const test = evaluateQuery(expr.test, env);
      if (test.t === "bool" && test.v) {
        return evaluateQuery(expr.then, env);
      }
      return evaluateQuery(expr.else, env);
    }
    case "binary": {
      const left = evaluateQuery(expr.left, env);
      const right = evaluateQuery(expr.right, env);
      return evaluateBinary(expr.op, left, right);
    }
    case "call": {
      return evaluateCall(expr.fn, expr.args, env);
    }
    case "lambda":
      return { t: "obj", v: [["__lambda", jsToTagged(expr)]] };
  }
}
