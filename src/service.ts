import { CompileFailed, SourceHashMismatch } from "../generated/ssdk/models/errors.js";
import type { CompileOutput, Script } from "../generated/ssdk/models/models_0.js";
import type { TsCompileService } from "../generated/ssdk/server/index.js";
import type { BoundedCache } from "./cache.js";
import type { Compiled } from "./compile.js";
import { sha256 } from "./hash.js";

/** 操作の外から差す物。試験では compile を偽物にして「本体が呼ばれていない」を言う。 */
export interface ServiceDeps {
  compile: (scripts: readonly { id: string; source: string }[]) => Compiled;
  /**
   * 値は JS の並び（要求の並びと同じ順）。id・版・phase・options は持たない —— それは同じ TS でも
   * 要求ごとに違いうる（名前を変えた撮り直し、phase だけを変えた撮り直し、options だけ違う版）。
   */
  cache: BoundedCache<readonly string[]>;
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

    // 鍵は TS の sha256 の並び。同じスクリプトは段ごとに来るので、2 段目からはここで返る
    const key = scripts.map((s) => s.sha256).join("+");

    // **使い回すのは JS だけ。** id・版・phase・options は、いつもいまの要求から付ける。出てくる JS は
    // source だけで決まり、ファイル名にしている id には依らない。答えごと覚えると、同じ TS を別の名前や
    // 別の phase で頼んだ要求に、前の要求の物が返る（phase だけ違えば、違う口で黙って走る）
    const answer = (js: readonly string[], cached: boolean): CompileOutput => ({
      typescript,
      hostTypes,
      cached,
      scripts: scripts.map((s, i): Script => {
        const source = present(js[i], `${s.id} の JS`);
        // source と sha256 だけ JS の物になる
        return { ...s, source, sha256: sha256(source) };
      }),
    });

    const hit = cache.get(key);
    if (hit !== undefined) return answer(hit, true);

    const r = compile(scripts);
    if ("diagnostics" in r) {
      throw new CompileFailed({
        message: `${String(r.diagnostics.length)} 件の型エラー`,
        typescript,
        diagnostics: r.diagnostics,
      });
    }
    const js = scripts.map((s) => present(r.outputs.get(`/src/${s.id}.js`), `emit の出力 ${s.id}`));
    cache.set(key, js);
    return await Promise.resolve(answer(js, false));
  },

  GetHealth: async () => await Promise.resolve({ ok: true, typescript, hostTypes }),
});
