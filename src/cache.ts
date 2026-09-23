/**
 * 入った順に古い物から捨てる Map。使った物は末尾へ (LRU)。
 *
 * 鍵は TS の sha256 の並び —— 内容が同じなら鍵も同じで、クロールは段ごとに同じ目録を送るので、
 * 2 段目からは型検査も emit も走らない。上限は memory の計算ではなく「無限に増えない」ための物。
 * 1 件は目録ぶんの JS (数 KB)。
 */
export class BoundedCache<V> {
  private readonly map = new Map<string, V>();

  constructor(private readonly max: number) {
    if (!Number.isInteger(max) || max < 1)
      throw new Error(`cache の上限は 1 以上の整数: ${String(max)}`);
  }

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (hit === undefined) return undefined;
    // 使った物を末尾へ。次に捨てられるのは、一番長く使われていない物
    this.map.delete(key);
    this.map.set(key, hit);
    return hit;
  }

  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) {
      // Map は挿入順を保つので、先頭が一番古い
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }
}
