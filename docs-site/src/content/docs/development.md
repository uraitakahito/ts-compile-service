---
title: Development
description: Regenerating the server from the model, running the checks, building the image, and keeping the docs honest
---

## Commands

```sh
pnpm install
pnpm run smithy      # model/ → generated/ (downloads the Smithy CLI once; no Java needed)
pnpm run check       # audit → smithy:check → host-types:check → typecheck → lint → format:check → test → build
pnpm run build && pnpm start
```

`pnpm run check` is exactly what CI runs, in the same order, one step per line so the failing
step is readable in the GitHub UI.

## The model comes first

`model/main.smithy` defines the service. From it, `pnpm run smithy` produces:

- `generated/ssdk/`, the TypeScript server SDK: routing, validation, serialisation, error
  mapping.
- `generated/openapi.json`, the same interface as OpenAPI 3.1, for readers and for the docs
  check.
- `generated/client/`, a TypeScript client generated from the same model (the `client`
  projection in `smithy-build.json`). It is not published and not in the image. Its one consumer
  is the contract test below.

All three are **committed**. Nobody needs a JVM to read the code, the runtime image never sees the code
generator, and CI runs `smithy:check`, which regenerates and then runs
`git diff --exit-code -- generated`, so a model edit without its regenerated output is red.

The Smithy CLI is downloaded by `scripts/smithy.sh` as the zip for your OS, with its own JRE,
into `.smithy-cli/`. This is not a Maven or Gradle project.

### Changing the model

1. Edit `model/main.smithy`. `pnpm run smithy:format` normalises it; the build refuses an
   unformatted model.
2. `pnpm run smithy`. The generated types change.
3. `pnpm run typecheck`. Whatever the hand-written `src/service.ts` now fails to provide is your
   to-do list.
4. Commit `generated/` together with the model.

A required member in the model is still `T | undefined` in the generated types. The generated
server has validated it before the operation runs, and `src/service.ts` asserts presence once at
the top.

## The host types

Scripts are compiled against `__bh`, the object BrowserHive injects into the page. Its type is a
**copy** of capture-scripts' `types/host.d.ts`, and `capture-scripts.pin` names the tag the copy
came from. CI's `host-types:check` fetches that tag's file from GitHub and fails if the copy
differs by a byte.

To move to a newer capture-scripts: change the pin, copy the file, run the check. Never edit the
copy. The source of truth is the other repository.

## Tests

`pnpm test` runs vitest. `test/compile.test.ts` exercises the compiler wrapper on fixtures (a
good script, one with a type error, one with an `enum`). `test/server.test.ts` starts the
generated server on port 0 and speaks HTTP to it, with the compiler replaced by a counting stub
so it can assert that constraint violations never reach it.

`test/client.test.ts` is the contract test: it drives the same server through the generated
client, configured with nothing but an `endpoint`. If the hand-written service drifts from the
model, the typed answers go red, as a missing member of the output or an error that is no longer
a `CompileFailed` instance.

## The image

```sh
container build -t ts-compile-service:dev -f Containerfile .
container run --rm -p 127.0.0.1:8080:8080 ts-compile-service:dev
```

Three stages: production dependencies (hoisted, since the runtime has no pnpm store), a builder
that runs `tsc`, and a `node:alpine` runtime with `node_modules`, `dist`, the host-type copy and
the pin. Neither the Smithy CLI nor a JVM is in any stage.

CI builds the image on every pull request, starts it, and sends it a script with a type error,
expecting a 422 that mentions `TS2322` and not `TS7017`, which is what a missing host-type copy
would produce.

Pushing a tag `vX.Y.Z` runs `.github/workflows/release.yaml`, which builds `linux/arm64` on an
ARM runner and pushes `ghcr.io/uraitakahito/ts-compile-service:vX.Y.Z`. The `version` in
`package.json` is not the version. The tag is.

## Documentation

```sh
pnpm run site:dev     # local preview
pnpm run site:check   # build + scripts/check-doc-refs.mjs
```

`site:check` runs on every pull request. The build alone is not a guard: on `.md` pages
Starlight's loader swallows rendering errors and exits 0. So `scripts/check-doc-refs.mjs` does
the checking:

- every English page has a Japanese twin under `ja/` with the same file name, and the other way
  round;
- every `[link](/page/)` in prose points at a page that exists in that locale;
- every repository path written in a code span exists;
- the endpoint table on the [API](/api/) page lists exactly the paths, methods and status codes
  that `generated/openapi.json` does.

Pages live in `docs-site/src/content/docs/` (English) and `docs-site/src/content/docs/ja/`
(Japanese). Update both together. A missing translation is a red check, not a silent fallback.
