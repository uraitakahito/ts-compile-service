---
title: API
description: 2 つの操作と、それぞれが返しうる全 status、request と response の形。Smithy の model を読み下した物
---

interface は `model/main.smithy` に 1 回だけ定義されていて、このページは全部その読み下しです。生成した
OpenAPI（`generated/openapi.json`）が機械向けの形です。下の口の表は CI でそれと突き合わされるので、
片方にしか無い status は pull request を落とします。

## 口

| 口              | status                | すること                                                              |
| --------------- | --------------------- | --------------------------------------------------------------------- |
| `POST /compile` | 200 · 400 · 409 · 422 | その段のスクリプトを 1 つの program として型検査し、JavaScript を返す |
| `GET /healthz`  | 200 · 400             | 起きているか。どの compiler と受け皿の型で                            |

エラーはどれも、種類を `x-amzn-errortype` の response header（`ValidationException`・
`SourceHashMismatch`・`CompileFailed`）と JSON の本文の両方で伝えます。`/healthz` に `400` が
並ぶのは、model が `ValidationException` を service 全体に付けているからで、入力の無い `GET` が
実際にそれを起こすことはありません。

## `POST /compile`

### request

```json
{
  "variableNames": ["query"],
  "scripts": [
    {
      "id": "autoscroll",
      "version": 3,
      "phase": "behavior",
      "source": "…TypeScript…",
      "sha256": "…hex 64 文字…",
      "options": {}
    }
  ]
}
```

| 欄              | 制約                                | 備考                                                                                             |
| --------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `variableNames` | `^[a-z][a-z0-9_]*$` の列・32 個まで | このクロールに渡された変数の名前。値は送らない。必須の宣言と照らし、足りなければ 422（`BH0001`） |
| `scripts`       | 0〜100 本                           | その段のスクリプトを丸ごと、1 つの request で。空も通る: 何も変換せず、`scripts` は空で返る      |
| `id`            | `^[a-z][a-z0-9-]*$`、1〜64 文字     | program の中の file 名になる（`/src/<id>.ts`）                                                   |
| `version`       | 整数                                | 触らずに返す                                                                                     |
| `phase`         | `preload` か `behavior`             | 触らずに返す                                                                                     |
| `source`        | 文字列                              | TypeScript                                                                                       |
| `sha256`        | `^[0-9a-f]{64}$`                    | `source` の UTF-8 のバイト列の sha256。台帳が打った物                                            |
| `options`       | 任意の JSON document。省略可        | 触らずに返す                                                                                     |

スクリプトは全部を**1 つの program**として compile します。ページの中では global を共有する（どれも
module ではない）ので、2 本が同じ top-level の名前を宣言すればここで型エラーになります。向こうで
runtime の衝突になるのと同じです。[Zod を読む](#zod-を読む)スクリプトだけは例外で、compiler には module に、
ページでは block の中に見えるので、ぶつかりません。

### 200

同じ並びを同じ順で。`source` は emit した JavaScript に、`sha256` はその JavaScript の hash に
置き換わります。`id`・`version`・`phase`・`options` は触らずに返ります。答えが memory から出たときも同じで、
いつも要求の物です。

```json
{
  "typescript": "6.0.3",
  "hostTypes": "v0.10.0",
  "cached": false,
  "scripts": ["…"],
  "declarations": [
    {
      "id": "egov-law-search",
      "unreadable": false,
      "params": [
        {
          "name": "query",
          "kind": "variable",
          "required": true,
          "summary": "法令名の検索語",
          "schema": { "type": "string", "minLength": 1 }
        }
      ]
    }
  ]
}
```

`typescript` は出力を作った compiler の版。`hostTypes` は何に向けて compile したか（受け皿の型の
capture-scripts の tag。`/healthz` が名乗るのと同じ値）で、報告に両方を載せるのにサービスへ訊き直さずに
済む。`cached` は、同じ source の hash の並びを最近 compile していて、JavaScript が memory から出たとき `true`。
使い回すのは JavaScript だけで、同じ source を別の名前・別の `phase`・別の `options` で送れば、それが返る。

`declarations` はスクリプトごとの変数の宣言で、並びは `scripts` と同じ（[変数を宣言する](#変数を宣言する)）。

スクリプトが空でも同じ形で答え、`scripts` は `[]`。何も変換しないが `typescript` と `hostTypes` は付くので、
何も走らせない段でも「何で変換するはずだったか」を報告に載せられる。

### 400 ValidationException

request が model の制約を破った: 大文字の入った id、hex 64 文字でない hash、101 本以上の list。本文は違反を
全部、欄への JSON pointer 付きで並べます。

```json
{
  "message": "…",
  "fieldList": [{ "path": "/scripts/0/id", "message": "…" }]
}
```

この答えは生成した server が出す物で、手で書いた code は 1 行も走りません。

### 409 SourceHashMismatch

`sha256` が `source` と合わない。サービスは保証できない物を変換しません。台帳とここの間で変わった
スクリプトは、新しい hash で emit されるのではなく断られます。TCP が守っているのになぜ照合するのかは
[なぜ照合するのか](/#なぜ照合するのか) を参照。

```json
{ "message": "autoscroll: sha256 が台帳の約束と違う", "id": "autoscroll" }
```

### 422 CompileFailed

1 本でも型か決まりが通らなかった。**どのスクリプトの JavaScript も返しません。** 通っていた物も含めて。途中まで
変換された並びは、受け取る側から見ると完全な物と区別が付かないからです。

```json
{
  "message": "2 件の誤り",
  "typescript": "6.0.3",
  "diagnostics": [{ "file": "bad.ts", "line": 3, "col": 7, "code": "TS2322", "message": "…" }],
  "declarations": [{ "id": "bad", "params": [], "unreadable": false }],
  "missingVariables": []
}
```

位置の無い診断では `file`・`line`・`col` が欠けます。`declarations` は型が通らなくても読める物を読み、
`missingVariables` は必須の宣言のうち `variableNames` に無かった名前です。台帳はこの 2 つで、クロールの行を
立てる前に断れます。

`code` は TypeScript の誤りが `TS` で始まり、この service の決まりが `BH` で始まります。

| `code`   | 意味                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `BH0001` | 必須の変数が `variableNames` に無い。誤りは宣言のその行を指す                                                                    |
| `BH0002` | `defineParams` の宣言を読めない（[書ける形](#変数を宣言する)を外れた）。`declarations` の `unreadable` が `true` になる          |
| `BH0003` | zod の読み方が[受ける 2 形](#zod-を読む)でない。先頭の文でない。`import("zod")`。`// @ts-nocheck` でも効く                       |
| `BH0004` | `phase` が `preload` のスクリプトに `import` か `defineParams` がある。全部のフレームで遷移のたびに走り、受け皿も無い            |
| `BH0005` | `__bh.vars` を直に読んでいる。`// @ts-nocheck` でも効く                                                                          |
| `BH0006` | classic script として読めない。`export` と、`import` のあるスクリプトの top-level の `await`。ページでは構文エラーで何も走らない |

## `GET /healthz`

```json
{ "ok": true, "typescript": "6.0.3", "hostTypes": "v0.10.0" }
```

`hostTypes` は、サービスが compile の相手にする `types/host.d.ts` が capture-scripts のどの tag の物か
（`capture-scripts.pin` の中身）。その tag の capture-scripts 自身の CI で型が通るスクリプトは、ここでも通ります。

## Zod を読む

スクリプトの先頭の文に、次のどちらかを書けます。受けるのはこの 2 形だけです。ほかの package と `zod/locales` は
`TS2307` になります。

```ts
import { z } from "zod";
import * as z from "zod/mini";
```

型は本物の Zod から付きます。版は capture-scripts と同じで、`host-types:check` が見ています。JavaScript には
`import` を書けないので（BrowserHive は classic script として評価します）、emit の後に次の形へ組み上げます。

```js
"use strict";
{
  // zod 4.6.7 (MIT)
  const { z } = (() => {
    /* 使う名前だけを束ねた Zod */
  })();
  // スクリプトの本体
}
```

- **使う名前だけを束ねます。** 型の位置を除いて `z.<名前>` を集めます。目安は 85 KB です（`zod/mini` は 15 KB）。
  `z[key]` のように名前を読めない使い方があれば全部を束ねます（385 KB）
- **`jitless` で束ねます。** 立てないと Zod は速い検査を `new Function` で作ろうとし、`script-src` が eval を
  禁じるページでは投げるうえ、相手のサイトへ違反の報告が飛びます
- **block で包みます。** 関数で包むとスクリプトの最後の式が完了値でなくなり、BrowserHive が終わりを待てません
- **`import` の無いスクリプトは今までと同じバイト列です。** Zod の版か esbuild の版を上げると、Zod を読むスクリプトの
  JavaScript は変わります

`import` の前のコメントは JavaScript に残りません。

## 変数を宣言する

スクリプトはクロールごとの変数を `defineParams` で読みます。

```ts
const { query } = defineParams(z.object({ query: z.string().min(1).describe("法令名の検索語") }));
```

- **宣言は走らせずに読みます**（`src/vendor/read-params.ts`。capture-scripts が正の写し）。書けるのは `z.object({ 名前: 値 })` で、
  値は `z.string()` か `z.enum([…])`、続けられるのは `.min`・`.max`・`.length`・`.optional`・`.describe` だけ、引数はリテラルだけ。
  1 本に 1 回。外れれば `BH0002` です
- **`.optional()` の無い名前は必須です。** `variableNames` に無ければ `BH0001`
- **宣言は cache に入れません。** JavaScript は source だけで決まるので cache の鍵は変わらず、宣言の読みと名前の照合は要求ごとにします。
  同じ TS を「渡す → 渡さない → 渡す」の順で頼むと 200・422・200 です
- **JavaScript では `globalThis.__bh.vars` に置き換わります。** `z` を宣言の中でしか読まなければ Zod は入りません

## compiler の設定

option は capture-scripts の `tsconfig.json` と同じにしてあります。向こうの CI で緑のスクリプトはここでも
緑でなければならず、逆も同じだからです。

| option               | 値                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `target` / `module`  | ES2023 / ESNext                                                                                           |
| `moduleResolution`   | Bundler。スクリプトから解決するのは `zod` と `zod/mini` だけ                                              |
| `skipLibCheck`       | on: Zod の d.ts を検査しない（3 本で 556 ms が 117 ms に）                                                |
| `lib`                | ES2023 と DOM                                                                                             |
| `strict`             | on                                                                                                        |
| `erasableSyntaxOnly` | on: enum・namespace・parameter property は使えない。JavaScript は TypeScript から型を引いただけの物になる |
| `removeComments`     | off: コメントは archive まで残る                                                                          |

emit した JavaScript は `"use strict";` で始まります。compiler が module でない file に必ず付ける物で、
[Zod を読む](#zod-を読む)スクリプトは組み上げのときに付けます。

## 出どころ

- `model/main.smithy` が model。そこの doc comment が、生成した OpenAPI に載る物。
- `generated/openapi.json` は `pnpm run smithy` が model から生成する。commit されていて、CI が diff を見る。
