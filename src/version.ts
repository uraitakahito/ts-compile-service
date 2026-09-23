import { readFileSync } from "node:fs";
import ts from "typescript";
import { pinPath } from "./paths.js";

/** 何で変換するか。job の結果と WACZ の JS を、後から突き合わせるための値。 */
export const TS_VERSION: string = ts.version;

/**
 * 写した受け皿の型 (`types/host.d.ts`) がどの capture-scripts の tag の物か。
 * `capture-scripts.pin` の 1 行。CI の `host-types:check` が、その tag の raw と写しが
 * 1 バイトも違わないことを見る。`/healthz` の `hostTypes` に出る。
 */
export const HOST_TYPES: string = readFileSync(pinPath(), "utf8").trim();
