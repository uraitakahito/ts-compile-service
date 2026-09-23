import { describe, expect, it } from "vitest";
import { BoundedCache } from "../src/cache.js";

describe("BoundedCache", () => {
  it("上限を超えると、一番長く使われていない物から消える", () => {
    const cache = new BoundedCache<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
    expect(cache.size).toBe(2);
  });

  it("読んだ物は新しくなる —— 直前に読んだ鍵は、次に足しても消えない", () => {
    const cache = new BoundedCache<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
  });

  it("同じ鍵を入れ直しても件数は増えない", () => {
    const cache = new BoundedCache<number>(2);
    cache.set("a", 1);
    cache.set("a", 2);
    expect(cache.size).toBe(1);
    expect(cache.get("a")).toBe(2);
  });

  it("上限が 1 未満や整数でなければ作れない", () => {
    expect(() => new BoundedCache<number>(0)).toThrow();
    expect(() => new BoundedCache<number>(1.5)).toThrow();
  });
});
