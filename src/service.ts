import { CompileFailed, SourceHashMismatch } from "../generated/ssdk/models/errors.js";
import type { CompileOutput, Script } from "../generated/ssdk/models/models_0.js";
import type { TsCompileService } from "../generated/ssdk/server/index.js";
import type { BoundedCache } from "./cache.js";
import type { Compiled } from "./compile.js";
import { sha256 } from "./hash.js";

/** 操作の外から差す物。試験では compile を偽物にして「本体が呼ばれていない」を言う。 */
export interface ServiceDeps {
  compile: (scripts: readonly { id: string; source: string }[]) => Compiled;
  cache: BoundedCache<CompileOutput>;
  typescript: string;
  hostTypes: string;
}

/** 生成された型は required の member も `T | undefined`。SSDK の検証を通った後は必ず在る。 */
const present = <T>(value: T | undefined, name: string): T => {
  if (value === undefined) throw new Error(`${name} が無い —— SSDK の検証を通っていない入力`);
  return value;
};

/**
 * Smithy が生成した server に差す、操作の中身。
 *
 * 入力の形と制約 (required・length・pattern・enum) は SSDK が先に見て 400 にする。ここに来るのは
 * model どおりの入力だけで、ここが見るのは model に書けない 2 つ —— sha256 が source と合うか (409)、
 * 型が通るか (422)。
 */
export const createService = ({
  compile,
  cache,
  typescript,
  hostTypes,
}: ServiceDeps): TsCompileService<Record<string, never>> => ({
  Compile: async (input) => {
    const scripts = present(input.scripts, "scripts").map((s) => ({
      ...s,
      id: present(s.id, "id"),
      source: present(s.source, "source"),
      sha256: present(s.sha256, "sha256"),
    }));

    // 台帳の約束を先に確かめる。運ぶ途中で入れ替わった物を、変換して新しい hash を付けて通さない
    for (const s of scripts) {
      if (sha256(s.source) !== s.sha256) {
        throw new SourceHashMismatch({ message: `${s.id}: sha256 が台帳の約束と違う`, id: s.id });
      }
    }

    // 鍵は TS の sha256 の並び。同じ目録は段ごとに来るので、2 段目からはここで返る
    const key = scripts.map((s) => s.sha256).join("+");
    const hit = cache.get(key);
    if (hit !== undefined) return { ...hit, cached: true };

    const r = compile(scripts);
    if ("diagnostics" in r) {
      throw new CompileFailed({
        message: `${String(r.diagnostics.length)} 件の型エラー`,
        typescript,
        diagnostics: r.diagnostics,
      });
    }
    const out: CompileOutput = {
      typescript,
      hostTypes,
      cached: false,
      scripts: scripts.map((s): Script => {
        const js = present(r.outputs.get(`/src/${s.id}.js`), `emit の出力 ${s.id}`);
        // version と phase と options はそのまま。source と sha256 だけ JS の物になる
        return { ...s, source: js, sha256: sha256(js) };
      }),
    };
    cache.set(key, out);
    return await Promise.resolve(out);
  },

  GetHealth: async () => await Promise.resolve({ ok: true, typescript, hostTypes }),
});
