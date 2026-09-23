---
title: クイックスタート
description: image を起こし、生きているのを確かめ、コマンドラインから 1 本変換する
---

## image を起こす

image は GitHub Container Registry に `linux/arm64` で公開されていて、設定は要りません。

```sh
container run -d --name ts-compile -p 127.0.0.1:8080:8080 \
  ghcr.io/uraitakahito/ts-compile-service:v0.1.0

curl -s http://127.0.0.1:8080/healthz
# {"ok":true,"typescript":"6.0.3","hostTypes":"v0.2.0"}
```

`typescript` は image に焼き込まれた compiler の版、`hostTypes` は image が持つ `types/host.d.ts` が
capture-scripts のどの tag の物か。`/compile` の答えはどれもこの 2 つで作られます。

Docker なら `container` を `docker` に読み替えるだけで、引数は同じです。

## 1 本変換する

`POST /compile` は capture-ledger が目録に持つ形そのもの、つまり id・version・phase・TypeScript の
source・その source の sha256 を受け取ります。hash は飾りではなく、source と合わないスクリプトは
断られます（[API](/api/) を参照）。

```sh
src='globalThis.__bh.report("hello", { remaining: __bh.remainingMs });'
sha=$(printf '%s' "$src" | shasum -a 256 | cut -d' ' -f1)

curl -s -H 'content-type: application/json' http://127.0.0.1:8080/compile -d "$(cat <<EOF
{"scripts":[{"id":"hello","version":1,"phase":"behavior",
  "source":$(printf '%s' "$src" | jq -Rs .),"sha256":"$sha","options":{}}]}
EOF
)"
```

答えは同じ並びで、`source` と `sha256` だけが JavaScript と*その*hash に置き換わり、何で変換したかが
付きます。

```json
{
  "typescript": "6.0.3",
  "cached": false,
  "scripts": [
    {
      "id": "hello",
      "version": 1,
      "phase": "behavior",
      "source": "\"use strict\";\nglobalThis.__bh.report(\"hello\", { remaining: __bh.remainingMs });\n",
      "sha256": "…",
      "options": {}
    }
  ]
}
```

同じ並びをもう一度送ると `cached` が `true` になります。サービスは最近の入力を hash の並びで覚えているので、
クロールの 2 段目からは何も走りません。

## 型が通らないとき

```sh
src='const n: number = "x"; globalThis.__bh.report("x", { n });'
```

同じように送ると **422** で、診断だけが返り、JavaScript は 1 本も返りません。同じ request の中の、
通っていた他のスクリプトの分も返りません。

```json
{
  "message": "1 件の型エラー",
  "typescript": "6.0.3",
  "diagnostics": [
    {
      "file": "x.ts",
      "line": 1,
      "col": 7,
      "code": "TS2322",
      "message": "Type 'string' is not assignable to type 'number'."
    }
  ]
}
```

capture-scheduler の flow はこれを、診断を理由にしたクロールの段の失敗にします。それがこのサービスの
要点で、壊れたスクリプトはページに届きません。

## 設定

env は 3 つ。起動時に 1 回読みます。

| 変数                   | 既定      | 備考                                                        |
| ---------------------- | --------- | ----------------------------------------------------------- |
| `PORT`                 | `8080`    | 待ち受ける port                                             |
| `HOST`                 | `0.0.0.0` | 全 interface に bind する。他のコンテナから呼ばれる物なので |
| `TS_COMPILE_CACHE_MAX` | `256`     | 覚えておく目録の数（LRU。鍵は hash の並び）                 |

## compose の中で

capture-scheduler は Windmill の隣に `ts-compile` として起こします。port は開けません。呼ぶのは
Windmill の worker だけで、名前で届きます。

```yaml
# docker-compose.yml (capture-scheduler)
services:
  ts-compile:
    image: ghcr.io/uraitakahito/ts-compile-service:v0.1.0
    environment:
      - PORT=8080
      - HOST=0.0.0.0
    mem_limit: 512mb
```

flow は Windmill の workspace の変数 `u/admin/ts_compile_url` で居場所を知ります。scheduler の `dev:up` が
`TS_COMPILE_URL`（既定 `http://ts-compile.capture-scheduler:8080`）から入れる物です。scheduler の
`doctor` には `worker→ts-compile` の probe が在り、worker から届かなければ赤になります。

## checkout から

```sh
pnpm install
pnpm run build
pnpm start          # node dist/src/main.js
```

`pnpm start` は repo の root で走らせます。受け皿の型の写し（`types/host.d.ts`）と pin
（`capture-scripts.pin`）は、checkout でもコンテナでも、current directory からの相対で読まれます。
