---
title: Quickstart
description: Run the image, check that it is alive, and compile one script from the command line
---

## Run the image

The image is published to GitHub Container Registry for `linux/arm64` and needs no
configuration:

```sh
container run -d --name ts-compile -p 127.0.0.1:8080:8080 \
  ghcr.io/uraitakahito/ts-compile-service:v0.1.0

curl -s http://127.0.0.1:8080/healthz
# {"ok":true,"typescript":"6.0.3","hostTypes":"v0.2.0"}
```

`typescript` is the compiler version baked into the image. `hostTypes` is the tag of
capture-scripts whose `types/host.d.ts` the image carries. Every answer to `/compile` is made
with these two.

On Docker, replace `container` with `docker`; the arguments are the same.

## Compile one script

`POST /compile` takes the catalogue as capture-ledger stores it: id, version, phase, the
TypeScript source, and the sha256 of that source. The hash is not decoration. A script whose hash
does not match its source is refused (see [API](/api/)).

```sh
src='globalThis.__bh.report("hello", { remaining: __bh.remainingMs });'
sha=$(printf '%s' "$src" | shasum -a 256 | cut -d' ' -f1)

curl -s -H 'content-type: application/json' http://127.0.0.1:8080/compile -d "$(cat <<EOF
{"scripts":[{"id":"hello","version":1,"phase":"behavior",
  "source":$(printf '%s' "$src" | jq -Rs .),"sha256":"$sha","options":{}}]}
EOF
)"
```

The answer is the same list with `source` and `sha256` replaced by the JavaScript and _its_
hash, plus which compiler produced it:

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

Send the same list again and `cached` is `true`. The service remembers recent inputs by their
sequence of hashes, so the second and later levels of a crawl cost nothing.

## When it does not type-check

```sh
src='const n: number = "x"; globalThis.__bh.report("x", { n });'
```

Sent the same way, this gets a **422** with the diagnostics and no JavaScript at all, not even for
other scripts in the same request that were fine:

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

The flow in capture-scheduler turns this into a failed crawl level with the diagnostics as the
reason. That is the point of the service: a broken script never reaches the page.

## Configuration

Three environment variables, read once at startup:

| Variable               | Default   | Notes                                                                         |
| ---------------------- | --------- | ----------------------------------------------------------------------------- |
| `PORT`                 | `8080`    | Port to listen on                                                             |
| `HOST`                 | `0.0.0.0` | Binds all interfaces; the service is meant to be called from other containers |
| `TS_COMPILE_CACHE_MAX` | `256`     | How many recent catalogues to remember (LRU, keyed by the sequence of hashes) |

## In a compose stack

capture-scheduler runs the service as `ts-compile` next to Windmill. No port is published: the
only caller is the Windmill worker, which reaches it by name.

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

The flow finds it through the Windmill workspace variable `u/admin/ts_compile_url`, which the
scheduler's `dev:up` sets from `TS_COMPILE_URL` (default
`http://ts-compile.capture-scheduler:8080`). The scheduler's `doctor` has a probe,
`worker→ts-compile`, that goes red when the worker cannot reach the service.

## From a checkout

```sh
pnpm install
pnpm run build
pnpm start          # node dist/src/main.js
```

Run `pnpm start` from the repository root. The service reads the host-type copy
(`types/host.d.ts`) and the pin (`capture-scripts.pin`) relative to the current directory, in a
checkout as in the container.
