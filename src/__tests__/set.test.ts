// @ts-ignore TS6133
import { expect, test } from "@jest/globals";

import { util } from "../helpers/util";
import * as z from "../index";
import { ZodIssueCode } from "../index";

const stringSet = z.set(z.string());
type stringSet = z.infer<typeof stringSet>;

const minTwo = z.set(z.string()).min(2);
const maxTwo = z.set(z.string()).max(2);
const justTwo = z.set(z.string()).size(2);
const nonEmpty = z.set(z.string()).nonempty();
const nonEmptyMax = z.set(z.string()).nonempty().max(2);

test("type inference", () => {
  util.assertEqual<stringSet, Set<string>>(true);
});

test("valid parse", () => {
  const result = stringSet.safeParse(new Set(["first", "second"]));
  expect(result.success).toEqual(true);
  if (result.success) {
    expect(result.data.has("first")).toEqual(true);
    expect(result.data.has("second")).toEqual(true);
    expect(result.data.has("third")).toEqual(false);
  }

  expect(() => {
    minTwo.parse(new Set(["a", "b"]));
    minTwo.parse(new Set(["a", "b", "c"]));
    maxTwo.parse(new Set(["a", "b"]));
    maxTwo.parse(new Set(["a"]));
    justTwo.parse(new Set(["a", "b"]));
    nonEmpty.parse(new Set(["a"]));
    nonEmptyMax.parse(new Set(["a"]));
  }).not.toThrow();
});

test("valid parse async", async () => {
  const result = await stringSet.spa(new Set(["first", "second"]));
  expect(result.success).toEqual(true);
  if (result.success) {
    expect(result.data.has("first")).toEqual(true);
    expect(result.data.has("second")).toEqual(true);
    expect(result.data.has("third")).toEqual(false);
  }

  const asyncResult = await stringSet.safeParse(new Set(["first", "second"]));
  expect(asyncResult.success).toEqual(true);
  if (asyncResult.success) {
    expect(asyncResult.data.has("first")).toEqual(true);
    expect(asyncResult.data.has("second")).toEqual(true);
    expect(asyncResult.data.has("third")).toEqual(false);
  }
});

test("valid parse: size-related methods", () => {
  expect(() => {
    minTwo.parse(new Set(["a", "b"]));
    minTwo.parse(new Set(["a", "b", "c"]));
    maxTwo.parse(new Set(["a", "b"]));
    maxTwo.parse(new Set(["a"]));
    justTwo.parse(new Set(["a", "b"]));
    nonEmpty.parse(new Set(["a"]));
    nonEmptyMax.parse(new Set(["a"]));
  }).not.toThrow();

  const sizeZeroResult = stringSet.parse(new Set());
  expect(sizeZeroResult.size).toBe(0);

  const sizeTwoResult = minTwo.parse(new Set(["a", "b"]));
  expect(sizeTwoResult.size).toBe(2);
});

test("failing when parsing empty set in nonempty ", () => {
  const result = nonEmpty.safeParse(new Set());
  expect(result.success).toEqual(false);

  if (result.success === false) {
    expect(result.error.issues.length).toEqual(1);
    expect(result.error.issues[0].code).toEqual(ZodIssueCode.too_small);
  }
});

test("failing when set is smaller than min() ", () => {
  const result = minTwo.safeParse(new Set(["just_one"]));
  expect(result.success).toEqual(false);

  if (result.success === false) {
    expect(result.error.issues.length).toEqual(1);
    expect(result.error.issues[0].code).toEqual(ZodIssueCode.too_small);
  }
});

test("failing when set is bigger than max() ", () => {
  const result = maxTwo.safeParse(new Set(["one", "two", "three"]));
  expect(result.success).toEqual(false);

  if (result.success === false) {
    expect(result.error.issues.length).toEqual(1);
    expect(result.error.issues[0].code).toEqual(ZodIssueCode.too_big);
  }
  const capped = z.set(z.string()).max(1).safeParse(new Set([1, 2]));
  expect(capped.error!.issues.length).toEqual(1);
  expect(capped.error!.issues[0].code).toEqual(ZodIssueCode.too_big);
});

test("an upper size bound fails before any element is parsed", async () => {
  let parsed = 0;
  const el = z.string().refine(() => ++parsed);
  const values: string[] = [];
  for (let i = 0; i < 10000; i++) {
    values.push(String(i));
  }
  const input = new Set(values);

  for (const schema of [z.set(el).max(100), z.set(el).size(100)]) {
    const syncIssues = schema.safeParse(input).error!.issues;
    const asyncIssues = (await schema.safeParseAsync(input)).error!.issues;
    for (const issues of [syncIssues, asyncIssues]) {
      expect(issues.length).toEqual(1);
      expect(issues[0].code).toEqual(ZodIssueCode.too_big);
      expect(issues[0].path).toEqual([]);
    }
  }
  expect(parsed).toEqual(0);

  // a lower size bound still lets the elements be parsed
  const short = z.set(el).min(3).safeParse(new Set(["a", 1]));
  expect(short.error!.issues.map((i) => i.code)).toEqual([
    ZodIssueCode.too_small,
    ZodIssueCode.invalid_type,
  ]);
  expect(parsed).toEqual(1);
});

test("doesn’t throw when an empty set is given", () => {
  const result = stringSet.safeParse(new Set([]));
  expect(result.success).toEqual(true);
});

test("throws when a Map is given", () => {
  const result = stringSet.safeParse(new Map([]));
  expect(result.success).toEqual(false);
  if (result.success === false) {
    expect(result.error.issues.length).toEqual(1);
    expect(result.error.issues[0].code).toEqual(ZodIssueCode.invalid_type);
  }
});

test("throws when the given set has invalid input", () => {
  const result = stringSet.safeParse(new Set([Symbol()]));
  expect(result.success).toEqual(false);
  if (result.success === false) {
    expect(result.error.issues.length).toEqual(1);
    expect(result.error.issues[0].code).toEqual(ZodIssueCode.invalid_type);
    expect(result.error.issues[0].path).toEqual([0]);
  }
});

test("throws when the given set has multiple invalid entries", () => {
  const result = stringSet.safeParse(new Set([1, 2] as any[]) as Set<any>);

  expect(result.success).toEqual(false);
  if (result.success === false) {
    expect(result.error.issues.length).toEqual(2);
    expect(result.error.issues[0].code).toEqual(ZodIssueCode.invalid_type);
    expect(result.error.issues[0].path).toEqual([0]);
    expect(result.error.issues[1].code).toEqual(ZodIssueCode.invalid_type);
    expect(result.error.issues[1].path).toEqual([1]);
  }
});
