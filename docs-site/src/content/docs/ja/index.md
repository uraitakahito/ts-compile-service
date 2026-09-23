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

### なぜ照合するのか

TCP/IP がデータの正しさを守るのは本当です。ただし守る範囲は、1 本の接続の 2 つの socket の間だけ。
スクリプトの道のりはそれより長く、capture-ledger から Windmill、このサービス、また Windmill、そして
BrowserHive へと接続を何本も渡り、その間に Windmill のデータベースに 2 回眠り、JSON と protobuf に
直列化し直され、flow の式で取り出されます。線から降りている間に何が起きても、次の線のチェックサムは
化けた後のバイト列から正しく数え直されるので、TCP は文句を言いません。

sha256 は台帳がバイト列を生んだ場所で打たれ、それを使う側が使う直前に数え直します。線もデータベースも
runtime も跨いで、道のり全体を 1 つの検査で覆う。台帳は TypeScript の hash を、このサービスは emit した
JavaScript の hash を打ち、受け取る側（このサービス、次に BrowserHive）はそれぞれ 1 つの事だけを見ます ——
同じ request の中の `source` から数えた digest が、同じ request の `sha256` と等しいか。データベースにも
台帳にも問い合わせません。

:::note[古典的な議論と同じ形（end-to-end argument, 1984）]
信頼できるリンクだけで組んだ網でも、ファイルを送る program は最後に checksum を比べる。途中の host の
ディスクやメモリで化けた物を、リンクの検査は見つけられないから。「正しさは、それが何であるかを知っている
端点でしか確かめられない」。script にとっての端点は、バイト列を生む台帳と、それを走らせる BrowserHive です。
:::

この照合が言えるのは「送ったつもりの物が、そのまま届いた」までです。`source` と `sha256` を両方差し替えた物は
通ります（それは署名の話で、この検査の守備範囲ではありません）。中身の善し悪しも見ません。走らせる前に
確かめるのは、走らせてから archive に「この digest のコードが走った」と書くと、archive が嘘をつくからです。

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
