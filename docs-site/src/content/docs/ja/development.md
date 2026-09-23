---
title: 開発
description: model から server を生成し直す、検査を走らせる、image を建てる、docs を嘘にしない
---

## コマンド

```sh
pnpm install
pnpm run smithy      # model/ → generated/ (Smithy CLI を 1 回だけ落とす。Java は要らない)
pnpm run check       # audit → smithy:check → host-types:check → typecheck → lint → format:check → test → build
pnpm run build && pnpm start
```

`pnpm run check` は CI が走らせる物そのもので、同じ並びです。1 段 1 行なので、どこで落ちたかが GitHub の
UI で読めます。

## model が先

`model/main.smithy` が service を定義します。そこから `pnpm run smithy` が作るのは:

- `generated/ssdk/`。TypeScript の server SDK: 経路の振り分け・検証・serde・エラーの対応付け。
- `generated/openapi.json`。同じ interface の OpenAPI 3.1。読む人のためと、docs の検査のため。

どちらも **commit します**。code を読むのに JVM は要らず、runtime の image は code generator を見ず、
CI は `smithy:check`（生成し直して `git diff --exit-code -- generated`）を走らせるので、生成物を
作り直さない model の変更は赤になります。

Smithy CLI は `scripts/smithy.sh` が OS ごとの zip（JRE 同梱）を `.smithy-cli/` に落とします。Maven や
Gradle の project ではありません。

### model を変える

1. `model/main.smithy` を直す。`pnpm run smithy:format` が整形する（整形されていない model は build が
   断る）。
2. `pnpm run smithy`。生成される型が変わる。
3. `pnpm run typecheck`。手で書いた `src/service.ts` が足せていない物が、そのままやることの一覧。
4. `generated/` を model と一緒に commit する。

model で required の member も、生成される型では `T | undefined` です。生成した server が操作の前に
検証しているので、`src/service.ts` は先頭で 1 回だけ在ることを確かめます。

## 受け皿の型

スクリプトは、BrowserHive がページに注入する object `__bh` に向けて compile されます。その型は
capture-scripts の `types/host.d.ts` の**写し**で、どの tag から写したかを `capture-scripts.pin` が
持ちます。CI の `host-types:check` はその tag の file を GitHub から取り、写しが 1 バイトでも違えば
落とします。

新しい capture-scripts に上げるなら: pin を変え、file を写し、検査を走らせる。写しを手で直しては
いけません。出どころは向こうの repo です。

## 試験

`pnpm test` は vitest を走らせます。`test/compile.test.ts` は compiler の包みを fixture（通る物、型エラーの
ある物、`enum` のある物）で試し、`test/server.test.ts` は生成した server を port 0 に起こして HTTP で
話します。compiler は回数を数える偽物に差してあるので、制約の違反が本体に届かないことを言えます。

## image

```sh
container build -t ts-compile-service:dev -f Containerfile .
container run --rm -p 127.0.0.1:8080:8080 ts-compile-service:dev
```

3 段: prod の依存（runtime に pnpm の store が無いので hoisted）、`tsc` を走らせる builder、
`node_modules`・`dist`・受け皿の型の写し・pin を持つ `node:alpine` の runtime。Smithy CLI も JVM も
どの段にも入りません。

CI は pull request ごとに image を建てて起こし、型エラーのあるスクリプトを送ります。期待するのは
`TS2322` を含み `TS7017` を含まない 422。`TS7017` は受け皿の型の写しが無いときに出る物です。

tag `vX.Y.Z` を push すると `.github/workflows/release.yaml` が走り、ARM の runner で `linux/arm64` を
建てて `ghcr.io/uraitakahito/ts-compile-service:vX.Y.Z` に出します。`package.json` の `version` は版では
ありません。版は tag です。

## docs

```sh
pnpm run site:dev     # 手元で見る
pnpm run site:check   # build ＋ scripts/check-doc-refs.mjs
```

`site:check` は pull request ごとに走ります。build だけでは守りになりません。`.md` のページでは
Starlight の loader が描画の例外を握り潰して exit 0 になるからです。だから検査は
`scripts/check-doc-refs.mjs` がします:

- 英語のページには `ja/` に同じ file 名の日本語のページが在り、逆も同じ。
- 本文の `[link](/page/)` は、その locale に在るページを指す。
- code span で書いた repo の path は実在する。
- [API](/api/) のページの口の表は、`generated/openapi.json` の path・method・status とぴったり同じ。

ページは `docs-site/src/content/docs/`（英語）と `docs-site/src/content/docs/ja/`（日本語）に在ります。
両方を一緒に直すこと。訳の無いページは黙って fallback するのではなく、検査が赤になります。
