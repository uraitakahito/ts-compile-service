---
title: API
description: 2 つの操作と、それぞれが返しうる全 status、request と response の形。Smithy の model を読み下した物
---

interface は `model/main.smithy` に 1 回だけ定義されていて、このページは全部その読み下しです。生成した
OpenAPI（`generated/openapi.json`）が機械向けの形です。下の口の表は CI でそれと突き合わされるので、
片方にしか無い status は pull request を落とします。

## 口

| 口              | status                | すること                                                            |
| --------------- | --------------------- | ------------------------------------------------------------------- |
| `POST /compile` | 200 · 400 · 409 · 422 | 目録のスクリプトを 1 つの program として型検査し、JavaScript を返す |
| `GET /healthz`  | 200 · 400             | 起きているか。どの compiler と受け皿の型で                          |

エラーはどれも、種類を `x-amzn-errortype` の response header（`ValidationException`・
`SourceHashMismatch`・`CompileFailed`）と JSON の本文の両方で伝えます。`/healthz` に `400` が
並ぶのは、model が `ValidationException` を service 全体に付けているからで、入力の無い `GET` が
実際にそれを起こすことはありません。

## `POST /compile`

### request

```json
{
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

| 欄        | 制約                            | 備考                                                  |
| --------- | ------------------------------- | ----------------------------------------------------- |
| `scripts` | 1〜100 本                       | その段の目録を丸ごと、1 つの request で               |
| `id`      | `^[a-z][a-z0-9-]*$`、1〜64 文字 | program の中の file 名になる（`/src/<id>.ts`）        |
| `version` | 整数                            | 触らずに返す                                          |
| `phase`   | `preload` か `behavior`         | 触らずに返す                                          |
| `source`  | 文字列                          | TypeScript                                            |
| `sha256`  | `^[0-9a-f]{64}$`                | `source` の UTF-8 のバイト列の sha256。台帳が打った物 |
| `options` | 任意の JSON document。省略可    | 触らずに返す                                          |

スクリプトは全部を**1 つの program**として compile します。ページの中では global を共有する（どれも
module ではない）ので、2 本が同じ top-level の名前を宣言すればここで型エラーになります。向こうで
runtime の衝突になるのと同じです。

### 200

同じ並びを同じ順で。`source` は emit した JavaScript に、`sha256` はその JavaScript の hash に
置き換わります。`version`・`phase`・`options` は触らずに返ります。

```json
{ "typescript": "6.0.3", "cached": false, "scripts": ["…"] }
```

`typescript` は出力を作った compiler の版。`cached` は、同じ source の hash の並びを最近 compile して
いて、答えが memory から出たとき `true`。

### 400 ValidationException

request が model の制約を破った: 大文字の入った id、hex 64 文字でない hash、空の list。本文は違反を全部、
欄への JSON pointer 付きで並べます。

```json
{
  "message": "…",
  "fieldList": [{ "path": "/scripts/0/id", "message": "…" }]
}
```

この答えは生成した server が出す物で、手で書いた code は 1 行も走りません。

### 409 SourceHashMismatch

`sha256` が `source` と合わない。サービスは保証できない物を変換しません。台帳とここの間で変わった
スクリプトは、新しい hash で emit されるのではなく断られます。

```json
{ "message": "autoscroll: sha256 が台帳の約束と違う", "id": "autoscroll" }
```

### 422 CompileFailed

1 本でも型が通らなかった。**どのスクリプトの JavaScript も返しません。** 通っていた物も含めて。途中まで
変換された目録は、受け取る側から見ると完全な物と区別が付かないからです。

```json
{
  "message": "2 件の型エラー",
  "typescript": "6.0.3",
  "diagnostics": [{ "file": "bad.ts", "line": 3, "col": 7, "code": "TS2322", "message": "…" }]
}
```

位置の無い診断では `file`・`line`・`col` が欠けます。

## `GET /healthz`

```json
{ "ok": true, "typescript": "6.0.3", "hostTypes": "v0.2.0" }
```

`hostTypes` は、サービスが compile の相手にする `types/host.d.ts` が capture-scripts のどの tag の物か
（`capture-scripts.pin` の中身）。その tag の capture-scripts 自身の CI で型が通るスクリプトは、ここでも通ります。

## compiler の設定

option は capture-scripts の `tsconfig.json` と同じにしてあります。向こうの CI で緑のスクリプトはここでも
緑でなければならず、逆も同じだからです。

| option               | 値                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `target` / `module`  | ES2023 / ESNext                                                                                           |
| `lib`                | ES2023 と DOM                                                                                             |
| `strict`             | on                                                                                                        |
| `erasableSyntaxOnly` | on: enum・namespace・parameter property は使えない。JavaScript は TypeScript から型を引いただけの物になる |
| `removeComments`     | off: コメントは archive まで残る                                                                          |

emit した JavaScript は `"use strict";` で始まります。compiler が module でない file に必ず付ける物です。

## 出どころ

- `model/main.smithy` が model。そこの doc comment が、生成した OpenAPI に載る物。
- `generated/openapi.json` は `pnpm run smithy` が model から生成する。commit されていて、CI が diff を見る。
