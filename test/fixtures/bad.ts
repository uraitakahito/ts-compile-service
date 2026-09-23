/** 型が通らない標本 */
(async () => {
  const n: number = "x";
  globalThis.__bh.report("bad", { n, missing: globalThis.__bh.remaining });
})();
