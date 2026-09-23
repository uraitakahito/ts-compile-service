---
title: ts-compile-service
description: A resident service that type-checks TypeScript and emits JavaScript for the crawler — nothing comes back unless every script passes
---

ts-compile-service is a small HTTP service with one job: take the TypeScript that
[capture-ledger](https://uraitakahito.github.io/capture-ledger/) keeps in its catalogue,
type-check it, and hand back the JavaScript that
[BrowserHive](https://github.com/uraitakahito/browserhive) evaluates inside the captured page.
**If a single script fails to type-check, nothing comes back**, and the crawl level that asked
is failed.

## Where it sits

The scripts themselves live in [capture-scripts](https://github.com/uraitakahito/capture-scripts)
and are written against a typed host object, `__bh`. Four repositories touch them, in this order:

1. **capture-ledger** imports the `.ts` files into its catalogue and stamps each one with the
   sha256 of its TypeScript bytes.
2. **capture-scheduler**'s Windmill flow sends the catalogue here once per crawl level
   (`POST /compile`).
3. **ts-compile-service** verifies the hashes, type-checks everything as one program, emits
   JavaScript and hashes that.
4. **BrowserHive** receives the JavaScript with its new hash, verifies it, and evaluates it in
   the page.

The hashes form a chain. The ledger's hash is on the TypeScript, the service's hash is on the
JavaScript, and each consumer verifies before it acts. A script that changed in transit is
refused (409) rather than converted.

### Why verify at every hop

TCP/IP does protect data in transit, but only between the two sockets of one connection. A
script travels further than that. From capture-ledger through Windmill to this service, back
through Windmill and on to BrowserHive it crosses several connections, and in between the bytes
sleep twice in Windmill's database, are re-serialised as JSON and then as protobuf, and are
picked out by a flow expression. Whatever happens while the bytes are off the wire, the next
connection's checksum is computed from the bytes as they are by then, so TCP never complains.

The sha256 is minted where the bytes are born and recomputed by whoever is about to use them,
so one check spans the wires, the databases and the runtimes. The ledger stamps the TypeScript,
this service stamps the JavaScript it emits, and each consumer (this service, then BrowserHive)
compares exactly one thing: the digest of the `source` in the request against the `sha256` in
the same request. No database and no ledger is consulted.

:::note[The classic argument (end-to-end argument, 1984)]
Even on a network built only from reliable links, a file-transfer program compares a checksum
at the end, because a byte corrupted on an intermediate host's disk or in its memory is
invisible to every link check. Correctness can only be confirmed by the endpoint that knows what
the data is. For a script, those endpoints are the ledger that produces the bytes and BrowserHive
that runs them.
:::

What the check can say is only "what was sent arrived unchanged". A script whose `source` and
`sha256` were both replaced passes (that is a job for signatures, not for this check), and
nothing about the content is inspected. The check runs before the script does, because writing
"this digest ran" into the archive after running something else would make the archive lie.

## Why a service, and not a transpile step

Stripping types is not enough. A transpiler that only erases annotations will happily run
`const n: number = "x"` in the page, and the error shows up, if at all, as odd behaviour in a
capture. This service runs the real TypeScript compiler with `strict` on, so a type error is a
hard 422 with the diagnostics attached, and the flow fails the level instead of capturing with a
broken script.

Putting the compiler in its own container also keeps the pieces loosely coupled. Windmill's
worker needs no `typescript` package, the compiler version and the host-type definitions are
pinned in one place, and the same image gives the same answer whether it is called from a flow,
from a test, or with `curl`.

## What is hand-written

The interface is a Smithy model (`model/main.smithy`). The server, meaning routing, validation of
the modelled constraints, JSON serialisation and error status codes, is **generated** from it
into `generated/ssdk`. Only two things are written by hand: the bodies of the two operations
(`src/service.ts`) and the wrapper around the compiler (`src/compile.ts`). Change the model,
regenerate, and the type-checker tells you what the hand-written part now has to provide.

## Where to go next

- **[Quickstart](/quickstart/)** — run the image and compile one script with `curl`.
- **[API](/api/)** — the two endpoints, every status code, and the shapes of request and
  response.
- **[Development](/development/)** — regenerate from the model, run the checks, build the image.
