import { createHash } from "node:crypto";

/**
 * 文字列の UTF-8 のバイト列の sha256 (hex)。
 *
 * 台帳 (`encode(digest(source,'sha256'),'hex')`) と BrowserHive (`INVALID_ARGUMENT` の照合) と
 * 同じ数え方。ここが違うと、送られた TS は全部 409 になり、返した JS は全部 BrowserHive に拒まれる。
 */
export const sha256 = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");
