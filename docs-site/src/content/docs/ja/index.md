---
title: ts-compile-service
description: TypeScript を型検査して JavaScript にする、クローラのための常駐サービス。全部が通らなければ 1 本も返さない
---

ts-compile-service は仕事が 1 つだけの小さな HTTP サービスです。
[capture-ledger](https://uraitakahito.github.io/capture-ledger/ja/) が目録に持つ TypeScript を型検査し、
[BrowserHive](https://github.com/uraitakahito/browserhive) が取り込んだページの中で評価する
JavaScript を返します。**1 本でも型が通らなければ何も返さず**、頼んできたクロールの段は失敗になります。

## どこに居るか

スクリプトそのものは [capture-scripts](https://github.com/uraitakahito/capture-scripts) に在り、
型の付いた受け皿 `__bh` に向けて書かれています。触るのは 4 つの repo で、順番はこうです。

1. **capture-ledger** が `.ts` を目録に取り込み、1 本ずつ TypeScript のバイト列の sha256 を打つ。
2. **capture-scheduler** の Windmill の flow が、クロールの段ごとに目録をここへ送る（`POST /compile`）。
3. **ts-compile-service** が hash を照合し、全部を 1 つの program として型検査し、JavaScript を emit して
   その hash を打つ。
4. **BrowserHive** が新しい hash 付きの JavaScript を受け取り、照合してから、ページの中で評価する。

hash は鎖になっています。台帳の hash は TypeScript に、サービスの hash は JavaScript に打たれ、
受け取る側はそれぞれ照合してから動きます。運ぶ途中で変わったスクリプトは、変換されずに断られます（409）。

## なぜ transpile の一段ではなくサービスなのか

型を剥がすだけでは足りません。注釈を消すだけの transpiler は `const n: number = "x"` を平気で
ページで走らせ、その誤りは（出るとしても）取り込みの妙な挙動として後から現れます。このサービスは本物の
TypeScript compiler を `strict` で走らせるので、型の誤りは診断付きの 422 になり、flow は壊れたスクリプトで
取り込む代わりに段を落とします。

compiler を独自のコンテナに置くことで、部品の結合も緩くなります。Windmill の worker に `typescript` は
要らず、compiler の版と受け皿の型の定義は 1 か所に固定され、flow から呼ばれても、試験から呼ばれても、
`curl` で叩いても、同じ image が同じ答えを返します。

## 手で書いている物

interface は Smithy の model（`model/main.smithy`）です。server、つまり経路の振り分け・model の制約の検証・
JSON の serde・エラーの status は、model から `generated/ssdk` に**生成**します。手で書くのは 2 つだけ:
2 つの操作の中身（`src/service.ts`）と compiler の包み（`src/compile.ts`）です。model を変えて生成し直すと、
手で書いた側が何を足すべきかは型検査が教えてくれます。

## 次に読む物

- **[クイックスタート](/quickstart/)** — image を起こして、`curl` で 1 本変換する。
- **[API](/api/)** — 2 つの口、返しうる全 status、request と response の形。
- **[開発](/development/)** — model から生成し直す、検査を走らせる、image を建てる。
