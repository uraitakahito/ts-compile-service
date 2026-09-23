import { createServer, type Server } from "node:http";
import { convertRequest, writeResponse } from "@smithy/server-node";
import {
  getTsCompileServiceHandler,
  type TsCompileService,
} from "../generated/ssdk/server/index.js";

/**
 * 生成された handler を Node の `http` に繋ぐ。手で書く HTTP はこれで全部 ——
 * 経路の振り分け・検証・serde・エラーの status は `generated/ssdk` の中に在る。
 */
export const createHttpServer = (service: TsCompileService<Record<string, never>>): Server => {
  const handler = getTsCompileServiceHandler(service);
  return createServer((req, res) => {
    handler
      .handle(convertRequest(req), {})
      .then((response) => {
        writeResponse(response, res);
      })
      .catch((error: unknown) => {
        // 生成された handler は model のエラーも枠組みのエラーも自分で応答にする。ここに来るのは
        // convertRequest が投げた物くらい —— 500 の空応答にして、理由はログへ
        console.error(error);
        res.statusCode = 500;
        res.end();
      });
  });
};
