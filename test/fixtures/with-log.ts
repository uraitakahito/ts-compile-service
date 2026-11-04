/** 受け皿の log (capture-scripts v0.7.0 から) に 4 つの level で書き、report には data だけを渡す */
(async (): Promise<void> => {
  globalThis.__bh.log.debug("始める");
  globalThis.__bh.log.info("残り時間を見た", { remainingMs: globalThis.__bh.remainingMs });
  globalThis.__bh.log.warn("検索窓が無い", { waitMs: 10000 });
  globalThis.__bh.log.error("答えが読めない", { status: 500 });
  globalThis.__bh.report({ searched: false });
})();
