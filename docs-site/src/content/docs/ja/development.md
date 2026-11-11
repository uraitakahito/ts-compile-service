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
- `generated/client/`。同じ model から生成した TypeScript の client（`smithy-build.json` の `client` の
  projection）。npm には出さず、image にも入れない。消費者は下の契約試験だけ。

3 つとも **commit します**。code を読むのに JVM は要らず、runtime の image は code generator を見ず、
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

新しい capture-scripts に上げる手順です。写しを手で直してはいけません。出どころは向こうの repo です。

1. `capture-scripts.pin` を新しい tag にし、その tag の `types/host.d.ts` と `tools/read-params.ts`（写す先は
   `src/vendor/read-params.ts`）を 1 バイトも替えずに写す。`pnpm run host-types:check` が tag の raw と比べる。
2. `pnpm test`。型が変わったなら、`test/fixtures/` の TS と `test/compile.test.ts` の期待（固定した
   sha256・診断の並び）を新しい型に合わせ、新しい型を使う fixture と試験を足す。古い写しで赤くなる
   試験にすると、写しがどの版かも試験が言う。
3. スクリプトが受け皿を呼ぶ形が変わったなら、`.github/workflows/ci.yaml` の image の job が送る
   スクリプトも直す。
4. docs の例を、出す版にそろえる。`hostTypes` の値（[API](/api/) と[クイックスタート](/quickstart/)）、
   image の tag（クイックスタートの `container run` と compose の例。これから打つ tag）、受け皿を
   呼ぶ例（クイックスタートの `src=`）。

## Zod と esbuild

スクリプトの `import` を `src/zod-bundle.ts` が束ねます（形は [API](/api/#zod-を読む)）。どちらも runtime の依存で、
版を固定しています。上げると Zod を読むスクリプトの JavaScript が変わるので、手順があります。

1. Zod は capture-scripts を先に上げて tag を打ち、`capture-scripts.pin` をその tag にする。
   `host-types:check` が向こうの dev の依存と版を照らす
2. `pnpm test`。`test/zod.test.ts` の固定した sha256 が赤くなる。それが狙いで、JavaScript が変わったことを知ってから
   値を直す
3. 大きさの窓の試験と、`node:vm` で `new Function` を数える試験が緑のままかを見る。Zod の JIT の入り方が変わると、
   ここで分かる

`allowBuilds` で esbuild の build script は走らせません（`pnpm-workspace.yaml`）。binary は `@esbuild/<platform>` から
実行時に読みます。

## 試験

`pnpm test` は vitest を走らせます。`test/compile.test.ts` は compiler の包みを fixture（通る物、型エラーの
ある物、`enum` のある物）で試し、`test/server.test.ts` は生成した server を port 0 に起こして HTTP で
話します。compiler は回数を数える偽物に差してあるので、制約の違反が本体に届かないことを言えます。
`test/service.test.ts` は操作を直に、自分の cache で呼び、cache に当たったときの答えを固定します。使い回すのは
JavaScript だけで、名前・版・`phase`・`options` は要求の物です。

`test/params.test.ts` は `defineParams` の宣言と渡した名前の照合を見ます。いちばん効くのは順の試験で、同じ TS を
「渡す → 渡さない → 渡す」の順で頼み、200・422・200 と `cached` を見ます。

`test/zod.test.ts` は組み上げた JavaScript を `node:vm` で走らせ、ブラウザなしで動きを見ます。`Function` を Proxy に
替えて呼ばれた数を数え、完了値が Promise か、strict で走るかを見ます。本物の Chromium と CSP での確かめは
capture-scheduler の e2e に在ります。

`test/client.test.ts` が契約試験です。同じ server を、生成した client（設定は `endpoint` だけ）で叩きます。
手で書いた service が model から外れれば、型付きの答えが赤になります。output の member が欠ける、
エラーが `CompileFailed` の instance でなくなる、という形で。

## image

```sh
container build -t ts-compile-service:dev -f Containerfile .
container run --rm -p 127.0.0.1:8080:8080 ts-compile-service:dev
```

3 段: prod の依存（runtime に pnpm の store が無いので hoisted）、`tsc` を走らせる builder、
`node_modules`・`dist`・受け皿の型の写し・pin を持つ `node:alpine` の runtime。Smithy CLI も JVM も
どの段にも入りません。

CI は pull request ごとに image を建てて起こし、型エラーのあるスクリプトを送ります。期待するのは
`TS2322` を含み `TS7017` を含まない 422。`TS7017` は受け皿の型の写しが無いときに出る物です。Zod を読むスクリプトも
送り、200 を見ます。zod か esbuild が `--prod` の依存から落ちていれば、ここで落ちます。

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
- [API](/api/) のページのエンドポイントの表は、`generated/openapi.json` の path・method・status とぴったり同じ。

ページは `docs-site/src/content/docs/`（英語）と `docs-site/src/content/docs/ja/`（日本語）に在ります。
両方を一緒に直すこと。訳の無いページは黙って fallback するのではなく、検査が赤になります。
