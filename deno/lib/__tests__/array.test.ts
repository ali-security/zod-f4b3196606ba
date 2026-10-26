// @ts-ignore TS6133
import { expect } from "https://deno.land/x/expect@v0.2.6/mod.ts";
const test = Deno.test;

import { util } from "../helpers/util.ts";
import * as z from "../index.ts";

const minTwo = z.string().array().min(2);
const maxTwo = z.string().array().max(2);
const justTwo = z.string().array().length(2);
const intNum = z.string().array().nonempty();
const nonEmptyMax = z.string().array().nonempty().max(2);

type t1 = z.infer<typeof nonEmptyMax>;
util.assertEqual<[string, ...string[]], t1>(true);

type t2 = z.infer<typeof minTwo>;
util.assertEqual<string[], t2>(true);

test("passing validations", () => {
  minTwo.parse(["a", "a"]);
  minTwo.parse(["a", "a", "a"]);
  maxTwo.parse(["a", "a"]);
  maxTwo.parse(["a"]);
  justTwo.parse(["a", "a"]);
  intNum.parse(["a"]);
  nonEmptyMax.parse(["a"]);
});

test("failing validations", () => {
  expect(() => minTwo.parse(["a"])).toThrow();
  expect(() => maxTwo.parse(["a", "a", "a"])).toThrow();
  expect(() => justTwo.parse(["a"])).toThrow();
  expect(() => justTwo.parse(["a", "a", "a"])).toThrow();
  expect(() => intNum.parse([])).toThrow();
  expect(() => nonEmptyMax.parse([])).toThrow();
  expect(() => nonEmptyMax.parse(["a", "a", "a"])).toThrow();
});

test("parse empty array in nonempty", () => {
  expect(() =>
    z
      .array(z.string())
      .nonempty()
      .parse([] as any)
  ).toThrow();
});

test("get element", () => {
  justTwo.element.parse("asdf");
  expect(() => justTwo.element.parse(12)).toThrow();
});

test("continue parsing despite array size error", () => {
  const schema = z.object({
    people: z.string().array().min(2),
  });

  const result = schema.safeParse({
    people: [123],
  });
  expect(result.success).toEqual(false);
  if (!result.success) {
    expect(result.error.issues.length).toEqual(2);
  }
});

test("an upper size bound fails before any element is parsed", () => {
  let parsed = 0;
  const el = z.string().refine(() => ++parsed);
  let refined = 0;
  const schema = z
    .array(el)
    .max(2, "too many")
    .refine(() => ++refined);

  const tooMany = schema.safeParse([1, 2, 3]).error!.issues;
  expect(tooMany.length).toEqual(1);
  expect(tooMany[0].code).toEqual(z.ZodIssueCode.too_big);
  expect(tooMany[0].path).toEqual([]);
  expect(tooMany[0].message).toEqual("too many");

  const notExact = z.array(el).length(2).safeParse(["a", "b", "c"]).error!;
  expect(notExact.issues.length).toEqual(1);
  expect(notExact.issues[0].code).toEqual(z.ZodIssueCode.too_big);
  expect((notExact.issues[0] as z.ZodTooBigIssue).exact).toEqual(true);

  const nested = z.object({ a: z.array(el).max(1) });
  const nestedIssues = nested.safeParse({ a: [1, 2] }).error!.issues;
  expect(nestedIssues.length).toEqual(1);
  expect(nestedIssues[0].code).toEqual(z.ZodIssueCode.too_big);
  expect(nestedIssues[0].path).toEqual(["a"]);

  expect(z.array(el).max(2).safeParse(["a", "b", "c"]).success).toEqual(false);
  expect([parsed, refined]).toEqual([0, 0]);

  // a lower size bound still lets the elements be parsed
  const short = z.array(el).min(3).safeParse(["a", 1]).error!.issues;
  expect(short.map((i) => i.code)).toEqual(["too_small", "invalid_type"]);
  expect(short[1].path).toEqual([1]);
  expect(parsed).toEqual(1);
});

test("an oversized array is rejected with a single issue", async () => {
  let parsed = 0;
  const el = z.string().refine(() => ++parsed);
  const numbers: number[] = [];
  for (let i = 0; i < 10000; i++) {
    numbers.push(i);
  }
  const strings = numbers.map(String);
  const schemas: z.ZodTypeAny[] = [
    z.array(el).max(100),
    z.array(el).length(100),
    z.array(el).nonempty().max(100),
  ];

  for (const schema of schemas) {
    for (const input of [numbers, strings]) {
      const syncIssues = schema.safeParse(input).error!.issues;
      const asyncIssues = (await schema.safeParseAsync(input)).error!.issues;
      for (const issues of [syncIssues, asyncIssues]) {
        expect(issues.length).toEqual(1);
        expect(issues[0].code).toEqual(z.ZodIssueCode.too_big);
        expect(issues[0].path).toEqual([]);
      }
    }
  }
  expect(parsed).toEqual(0);
});

test("parse should fail given sparse array", () => {
  const schema = z.array(z.string()).nonempty().min(1).max(3);

  expect(() => schema.parse(new Array(3))).toThrow();
});
