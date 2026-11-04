/** 剥がして消えない構文 */
(() => {
  enum E {
    A,
  }
  globalThis.__bh.report({ e: E.A });
})();
