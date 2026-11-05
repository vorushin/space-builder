/** Uniform spatial hash for circle queries on the XZ plane. */
export interface Circle {
  x: number;
  z: number;
  r: number;
}

export class SpatialGrid<T extends Circle> {
  private cells = new Map<number, T[]>();
  private pool: T[][] = [];
  private stamp = new Map<T, number>();
  private queryId = 0;

  constructor(private cell: number) {}

  private key(ix: number, iz: number): number {
    return (ix + 4096) * 8192 + (iz + 4096);
  }

  clear(): void {
    for (const list of this.cells.values()) {
      list.length = 0;
      this.pool.push(list);
    }
    this.cells.clear();
    this.stamp.clear();
  }

  insert(item: T): void {
    const c = this.cell;
    const x0 = Math.floor((item.x - item.r) / c);
    const x1 = Math.floor((item.x + item.r) / c);
    const z0 = Math.floor((item.z - item.r) / c);
    const z1 = Math.floor((item.z + item.r) / c);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = this.key(ix, iz);
        let list = this.cells.get(k);
        if (!list) {
          list = this.pool.pop() ?? [];
          this.cells.set(k, list);
        }
        list.push(item);
      }
    }
  }

  /** Candidates whose cells overlap the circle (x, z, r). Each item appears once. Caller does the exact test. */
  query(x: number, z: number, r: number, out: T[]): T[] {
    out.length = 0;
    const id = ++this.queryId;
    const c = this.cell;
    const x0 = Math.floor((x - r) / c);
    const x1 = Math.floor((x + r) / c);
    const z0 = Math.floor((z - r) / c);
    const z1 = Math.floor((z + r) / c);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.cells.get(this.key(ix, iz));
        if (!list) continue;
        for (const it of list) {
          if (this.stamp.get(it) === id) continue;
          this.stamp.set(it, id);
          out.push(it);
        }
      }
    }
    return out;
  }
}
