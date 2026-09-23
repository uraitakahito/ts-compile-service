---
title: API
description: The two operations, every status code they can answer with, and the shapes of request and response, read off the Smithy model
---

The interface is defined once, in `model/main.smithy`, and everything on this page is a reading
of it. The generated OpenAPI document (`generated/openapi.json`) is the machine-readable form.
The endpoint table below is checked against it in CI, so a status code that appears in one and
not the other fails the pull request.

## Endpoints

| Endpoint        | Status codes          | What it does                                                               |
| --------------- | --------------------- | -------------------------------------------------------------------------- |
| `POST /compile` | 200 · 400 · 409 · 422 | Type-check a catalogue of scripts as one program and return the JavaScript |
| `GET /healthz`  | 200 · 400             | Is it up, and with which compiler and host types                           |

Every error carries its type in the `x-amzn-errortype` response header (`ValidationException`,
`SourceHashMismatch`, `CompileFailed`) as well as in a JSON body. `400` is listed for `/healthz`
because the model attaches `ValidationException` to the whole service; a `GET` with no input
never actually triggers it.

## `POST /compile`

### Request

```json
{
  "scripts": [
    {
      "id": "autoscroll",
      "version": 3,
      "phase": "behavior",
      "source": "…TypeScript…",
      "sha256": "…64 hex characters…",
      "options": {}
    }
  ]
}
```

| Field     | Constraint                         | Notes                                                           |
| --------- | ---------------------------------- | --------------------------------------------------------------- |
| `scripts` | 1 to 100 items                     | The whole catalogue for the level, in one request               |
| `id`      | `^[a-z][a-z0-9-]*$`, 1 to 64 chars | Becomes the file name inside the program (`/src/<id>.ts`)       |
| `version` | integer                            | Passed through untouched                                        |
| `phase`   | `preload` or `behavior`            | Passed through untouched                                        |
| `source`  | string                             | The TypeScript                                                  |
| `sha256`  | `^[0-9a-f]{64}$`                   | sha256 of the UTF-8 bytes of `source`, as the ledger stamped it |
| `options` | any JSON document, optional        | Passed through untouched                                        |

All scripts are compiled **as one program**. They share the global scope in the page (none of
them is a module), so two scripts declaring the same top-level name is a type error here, exactly
as it would be a clash at runtime there.

### 200

The same list, in the same order, with `source` replaced by the emitted JavaScript and `sha256`
by the hash of that JavaScript. `version`, `phase` and `options` come back untouched.

```json
{ "typescript": "6.0.3", "hostTypes": "v0.2.0", "cached": false, "scripts": ["…"] }
```

`typescript` is the compiler version that produced the output. `hostTypes` is the capture-scripts
tag whose host types it was compiled against, the same value `/healthz` reports, so a report can
record both without asking the service again. `cached` is `true` when the same sequence of source
hashes was compiled recently and the answer came from memory.

### 400 ValidationException

The request broke a modelled constraint: an id with a capital letter, a hash that is not 64 hex
characters, an empty list. The body lists every violation with a JSON pointer to the field.

```json
{
  "message": "…",
  "fieldList": [{ "path": "/scripts/0/id", "message": "…" }]
}
```

This answer comes from the generated server, before any hand-written code runs.

### 409 SourceHashMismatch

`sha256` does not match `source`. The service does not convert what it cannot vouch for. A script
altered between the ledger and here is refused rather than emitted under a fresh hash.

```json
{ "message": "autoscroll: sha256 が台帳の約束と違う", "id": "autoscroll" }
```

### 422 CompileFailed

At least one script did not type-check. **No JavaScript comes back for any script**, including
the ones that were fine. A partially converted catalogue would be indistinguishable from a
complete one to the consumer.

```json
{
  "message": "2 件の型エラー",
  "typescript": "6.0.3",
  "diagnostics": [{ "file": "bad.ts", "line": 3, "col": 7, "code": "TS2322", "message": "…" }]
}
```

`file`, `line` and `col` are absent for a diagnostic that has no position.

## `GET /healthz`

```json
{ "ok": true, "typescript": "6.0.3", "hostTypes": "v0.2.0" }
```

`hostTypes` is the capture-scripts tag whose `types/host.d.ts` the service compiles against (the
content of `capture-scripts.pin`). A script that type-checks in capture-scripts' own CI at that
tag type-checks here.

## How the compiler is configured

The options are the same as capture-scripts' `tsconfig.json`, on purpose. A script that is green
in that repository's CI must be green here, and the other way round.

| Option               | Value                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `target` / `module`  | ES2023 / ESNext                                                                                       |
| `lib`                | ES2023 and DOM                                                                                        |
| `strict`             | on                                                                                                    |
| `erasableSyntaxOnly` | on: no enums, namespaces or parameter properties, so the JavaScript is the TypeScript minus its types |
| `removeComments`     | off: comments survive into the archive                                                                |

The emitted JavaScript begins with `"use strict";`, which the compiler adds to every non-module
file.

## Source of truth

- `model/main.smithy` is the model. Its doc comments are what the generated OpenAPI carries.
- `generated/openapi.json` is generated from the model by `pnpm run smithy`, committed, and
  diffed in CI.
