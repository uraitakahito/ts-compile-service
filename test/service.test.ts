import { describe, expect, it } from "vitest";
import { BoundedCache } from "../src/cache.js";
import { compile } from "../src/compile.js";
import { sha256 } from "../src/hash.js";
import { createService } from "../src/service.js";

/**
 * 操作の中身を、server を挟まずに直に呼ぶ。cache は試験ごとに建てる ——
 * server.test.ts は 1 つの cache を全部の試験で共有するので、「前の要求が cache に何を残したか」を
 * 1 本の試験の中で決められない。
 */
const fresh = () =>
  createService({ compile, cache: new BoundedCache(8), typescript: "6.0.3", hostTypes: "v0.2.0" });

const SOURCE = `(() => {\n  document.querySelector<HTMLButtonElement>("#accept")?.click();\n})();\n`;

const script = (
  id: string,
  phase: "behavior" | "preload",
  source: string,
  version = 1,
  options: Record<string, number> = {},
) => ({ id, version, phase, source, sha256: sha256(source), options });

describe("cache に当たっても、答えはいまの要求の物", () => {
  it("同じ TS を phase と名前を変えて頼むと、その phase と名前で返る", async () => {
    const service = fresh();
    await service.Compile({ scripts: [script("close-banner", "behavior", SOURCE)] }, {});
    const again = await service.Compile(
      { scripts: [script("dismiss-consent", "preload", SOURCE)] },
      {},
    );
    // 対照: cache を通った。通らずに本体が変換し直したなら、この試験は何も言っていない
    expect(again.cached).toBe(true);
    expect(again.scripts?.[0]).toMatchObject({
      id: "dismiss-consent",
      version: 1,
      phase: "preload",
    });
  });

  it("同じ TS で options だけ違う版は、その版と options で返る", async () => {
    // 台帳の `scripts add --options` が作る形: 中身は同じで、版と渡す値だけが違う
    const service = fresh();
    await service.Compile({ scripts: [script("autoscroll", "behavior", SOURCE)] }, {});
    const again = await service.Compile(
      { scripts: [script("autoscroll", "behavior", SOURCE, 2, { maxSteps: 60 })] },
      {},
    );
    expect(again.cached).toBe(true);
    expect(again.scripts?.[0]).toMatchObject({
      id: "autoscroll",
      version: 2,
      options: { maxSteps: 60 },
    });
  });

  it("cache に当たっても、JS は 1 回目と同じバイト列で、sha256 はその JS の物", async () => {
    const service = fresh();
    const first = await service.Compile(
      { scripts: [script("close-banner", "behavior", SOURCE)] },
      {},
    );
    const again = await service.Compile(
      { scripts: [script("dismiss-consent", "preload", SOURCE)] },
      {},
    );
    expect(again.cached).toBe(true);
    const js = again.scripts?.[0]?.source;
    expect(js).toBe(first.scripts?.[0]?.source);
    expect(again.scripts?.[0]?.sha256).toBe(sha256(js!));
  });
});
