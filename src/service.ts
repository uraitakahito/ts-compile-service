import { CompileFailed, SourceHashMismatch } from "../generated/ssdk/models/errors.js";
import type { CompileOutput, Declaration, Script } from "../generated/ssdk/models/models_0.js";
import type { TsCompileService } from "../generated/ssdk/server/index.js";
import type { BoundedCache } from "./cache.js";
import type { Compiled, Diagnostic } from "./compile.js";
import { sha256 } from "./hash.js";
import { missingOf } from "./params.js";
import { readParams, type ReadResult } from "./vendor/read-params.js";
import { preloadProblems } from "./zod-bundle.js";

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

/** 答えに載せる宣言。読めなかった本は `unreadable` で言い、`params` は空。 */
const declarationOf = (id: string, read: ReadResult): Declaration => ({
  id,
  params: read.params,
  unreadable: read.problems.length > 0,
});

/**
 * Smithy が生成した server に差す、操作の中身。
 *
 * 入力の形と制約 (required・length・pattern・enum) は SSDK が先に見て 400 にする。ここに来るのは
 * model どおりの入力だけで、ここが見るのは model に書けない 3 つ —— sha256 が source と合うか (409)、
 * 型と決まりが通るか (422)、必須の変数が渡されているか (422・BH0001)。
 */
export const createService = ({
  compile,
  cache,
  typescript,
  hostTypes,
}: ServiceDeps): TsCompileService<Record<string, never>> => ({
  Compile: async (input) => {
    const variableNames = present(input.variableNames, "variableNames");
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

    // **宣言は cache に入れず、毎回 source から読む。** 読むのは数 ms で、当たりと外れで答えが食い違う道が無くなる。
    // 渡した名前との照合も毎回。JS は source だけで決まるが、足りるかは要求ごとに違う。cache の中で見ると、
    // 同じ TS を前のクロールが名前つきで通した後に、名前の無いクロールが素通りする
    const declared = scripts.map((s) => ({ id: s.id, read: readParams(s.source) }));
    const declarations = declared.map(({ id, read }) => declarationOf(id, read));
    const missing = missingOf(declared, variableNames);
    const failed = (diagnostics: readonly Diagnostic[]): CompileFailed =>
      new CompileFailed({
        message: `${String(diagnostics.length)} 件の誤り`,
        typescript,
        diagnostics: [...diagnostics],
        declarations,
        missingVariables: missing.names,
      });

    // phase は cache の鍵に無いので、cache の前で毎回見る (同じ TS を preload で頼み直すと当たる)
    const misplaced = preloadProblems(scripts);
    if (misplaced.length > 0) throw failed([...misplaced, ...missing.diagnostics]);

    // 鍵は TS の sha256 の並び。同じスクリプトは段ごとに来るので、2 段目からはここで返る
    const key = scripts.map((s) => s.sha256).join("+");

    // **使い回すのは JS だけ。** id・版・phase・options は、いつもいまの要求から付ける。出てくる JS は
    // source だけで決まり、ファイル名にしている id には依らない。答えごと覚えると、同じ TS を別の名前や
    // 別の phase で頼んだ要求に、前の要求の物が返る（phase だけ違えば、違う口で黙って走る）
    const answer = (js: readonly string[], cached: boolean): CompileOutput => ({
      typescript,
      hostTypes,
      cached,
      declarations,
      scripts: scripts.map((s, i): Script => {
        const source = present(js[i], `${s.id} の JS`);
        // source と sha256 だけ JS の物になる
        return { ...s, source, sha256: sha256(source) };
      }),
    });

    const hit = cache.get(key);
    if (hit !== undefined) {
      if (missing.diagnostics.length > 0) throw failed(missing.diagnostics);
      return answer(hit, true);
    }

    const r = compile(scripts);
    if ("diagnostics" in r) throw failed([...r.diagnostics, ...missing.diagnostics]);
    const js = scripts.map((s) => present(r.outputs.get(`/src/${s.id}.js`), `emit の出力 ${s.id}`));
    cache.set(key, js);
    if (missing.diagnostics.length > 0) throw failed(missing.diagnostics);
    return await Promise.resolve(answer(js, false));
  },

  GetHealth: async () => await Promise.resolve({ ok: true, typescript, hostTypes }),
});
