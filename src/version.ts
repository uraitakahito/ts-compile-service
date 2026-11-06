import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { pinPath, repoRoot } from "./paths.js";

/** 何で変換するか。job の結果と WACZ の JS を、後から突き合わせるための値。 */
export const TS_VERSION: string = ts.version;

/**
 * 写した受け皿の型 (`types/host.d.ts`) がどの capture-scripts の tag の物か。
 * `capture-scripts.pin` の 1 行。CI の `host-types:check` が、その tag の raw と写しが
 * 1 バイトも違わないことを見る。`/healthz` の `hostTypes` に出る。
 */
export const HOST_TYPES: string = readFileSync(pinPath(), "utf8").trim();

/** JS に束ねる Zod の版。束の先頭のコメントに残る。capture-scripts の dev の依存と揃える (`host-types:check`)。 */
export const ZOD_VERSION: string = (
  JSON.parse(readFileSync(join(repoRoot(), "node_modules", "zod", "package.json"), "utf8")) as {
    version: string;
  }
).version;
