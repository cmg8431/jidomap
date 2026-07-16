/**
 * 노선 지오메트리 정리 — OSM route relation 은 상·하행/측선/기지 인입선까지 모든 선로를 담고 있어
 * 그대로 그리면 복선이 두 줄, 경부선 회랑이 다발로, 차량기지 선이 허공에 뜬다.
 * 1) 분기점에서 직진을 우선하는 각도 기반 체인 조립
 * 2) 역을 충분히 지나지 않는 체인 제거 (기지 인입선 등)
 * 3) 이미 채택된 체인과 평행하게 겹치는 체인 제거 (상·하행 중복)
 */

type Coord = [number, number];

const M_PER_DEG_LAT = 111_320;

function metersBetween(a: Coord, b: Coord): number {
  const dLat = (b[1] - a[1]) * M_PER_DEG_LAT;
  const dLng = (b[0] - a[0]) * M_PER_DEG_LAT * Math.cos((a[1] * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function chainLength(chain: Coord[]): number {
  let total = 0;
  for (let i = 1; i < chain.length; i += 1) {
    const prev = chain[i - 1];
    const curr = chain[i];
    if (prev && curr) total += metersBetween(prev, curr);
  }
  return total;
}

const keyOf = (coord: Coord) => `${coord[0]},${coord[1]}`;

/** 두 방향 벡터의 직진성 (1=직진, -1=역방향) */
function straightness(from: Coord, via: Coord, to: Coord): number {
  const ax = via[0] - from[0];
  const ay = via[1] - from[1];
  const bx = to[0] - via[0];
  const by = to[1] - via[1];
  const la = Math.hypot(ax, ay) || 1;
  const lb = Math.hypot(bx, by) || 1;
  return (ax * bx + ay * by) / (la * lb);
}

/** 끝점 공유 세그먼트들을 직진 우선으로 이어붙여 체인으로 조립한다 */
function assembleChains(segments: Coord[][]): Coord[][] {
  const remaining = segments.filter((seg) => seg.length >= 2).map((seg) => [...seg]);
  const used = new Set<number>();
  const byEndpoint = new Map<string, number[]>();
  remaining.forEach((seg, index) => {
    const first = seg[0];
    const last = seg[seg.length - 1];
    if (!first || !last) return;
    for (const key of [keyOf(first), keyOf(last)]) {
      const list = byEndpoint.get(key) ?? [];
      list.push(index);
      byEndpoint.set(key, list);
    }
  });

  /** endpoint 에서 이어지는 세그먼트 중 가장 직진에 가까운 것을 고른다 */
  const takeNeighbor = (endpoint: Coord, prev: Coord | undefined): Coord[] | null => {
    const candidates = byEndpoint.get(keyOf(endpoint)) ?? [];
    let best: { index: number; oriented: Coord[]; score: number } | null = null;
    for (const index of candidates) {
      if (used.has(index)) continue;
      const seg = remaining[index];
      if (!seg) continue;
      const first = seg[0];
      const oriented = first && keyOf(first) === keyOf(endpoint) ? seg : [...seg].reverse();
      const nextPoint = oriented[1];
      if (!nextPoint) continue;
      const score = prev ? straightness(prev, endpoint, nextPoint) : 0;
      if (!best || score > best.score) best = { index, oriented, score };
    }
    if (!best) return null;
    used.add(best.index);
    return best.oriented;
  };

  const chains: Coord[][] = [];
  remaining.forEach((seg, index) => {
    if (used.has(index)) return;
    used.add(index);
    const chain = [...seg];
    for (;;) {
      const tail = chain[chain.length - 1];
      if (!tail) break;
      const next = takeNeighbor(tail, chain[chain.length - 2]);
      if (!next) break;
      chain.push(...next.slice(1));
    }
    for (;;) {
      const head = chain[0];
      if (!head) break;
      const prev = takeNeighbor(head, chain[1]);
      if (!prev) break;
      chain.unshift(...[...prev].reverse().slice(1));
    }
    chains.push(chain);
  });
  return chains;
}

/** ~cell(m) 격자 공간 해시 — 근접 질의용 */
class Grid {
  private cells = new Map<string, Coord[]>();
  constructor(private cellMeters: number) {}

  private cellKey(coord: Coord): string {
    const latCell = Math.floor((coord[1] * M_PER_DEG_LAT) / this.cellMeters);
    const lngCell = Math.floor(
      (coord[0] * M_PER_DEG_LAT * Math.cos((coord[1] * Math.PI) / 180)) / this.cellMeters,
    );
    return `${lngCell},${latCell}`;
  }

  add(coord: Coord): void {
    const key = this.cellKey(coord);
    const list = this.cells.get(key) ?? [];
    list.push(coord);
    this.cells.set(key, list);
  }

  addChain(chain: Coord[]): void {
    for (const coord of chain) this.add(coord);
  }

  hasNear(coord: Coord, maxMeters: number): boolean {
    const [cx, cy] = this.cellKey(coord).split(',').map(Number);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const list = this.cells.get(`${(cx ?? 0) + dx},${(cy ?? 0) + dy}`);
        if (!list) continue;
        for (const point of list) {
          if (metersBetween(coord, point) <= maxMeters) return true;
        }
      }
    }
    return false;
  }
}

export interface DedupOptions {
  /** 이 거리(m) 안이면 같은 회랑의 평행 선로로 본다 */
  parallelMeters?: number;
  /** 채택 체인과 이 비율 이상 겹치면 중복으로 버린다 */
  overlapRatio?: number;
  /** 이보다 짧은 독립 체인은 버린다 */
  minChainMeters?: number;
  /** 이 노선의 역 좌표들 — 있으면 역을 지나지 않는 체인(기지 인입선 등)을 버린다 */
  stations?: Coord[];
  /** 체인이 역을 "지난다"고 보는 거리 (기본 150m) */
  stationMeters?: number;
}

/** 체인이 지나는 역 수 */
function stationsServed(chain: Coord[], stations: Coord[], maxMeters: number): number {
  let count = 0;
  for (const station of stations) {
    for (let i = 0; i < chain.length; i += 2) {
      const point = chain[i];
      if (point && metersBetween(station, point) <= maxMeters) {
        count += 1;
        break;
      }
    }
  }
  return count;
}

/** MultiLineString 좌표를 정리해 중심선 + 분기선만 남긴다 */
export function dedupLineCoordinates(segments: Coord[][], options: DedupOptions = {}): Coord[][] {
  const {
    parallelMeters = 60,
    overlapRatio = 0.8,
    minChainMeters = 500,
    stations = [],
    stationMeters = 150,
  } = options;

  let chains = assembleChains(segments);

  // 역 정보가 있으면 여객 역을 2개 이상(전체 역이 1개뿐이면 1개) 지나는 체인만 남긴다
  if (stations.length > 0) {
    const required = Math.min(2, stations.length);
    const serving = chains.filter(
      (chain) => stationsServed(chain, stations, stationMeters) >= required,
    );
    // 전부 걸러지면(데이터 이상) 원본 유지
    if (serving.length > 0) chains = serving;
  }

  const ranked = chains
    .map((chain) => ({ chain, length: chainLength(chain) }))
    .sort((a, b) => b.length - a.length);

  const grid = new Grid(parallelMeters);
  const kept: Coord[][] = [];

  for (const { chain, length } of ranked) {
    if (kept.length === 0) {
      kept.push(chain);
      grid.addChain(chain);
      continue;
    }
    if (length < minChainMeters) continue;

    const step = Math.max(1, Math.floor(chain.length / 60));
    let near = 0;
    let total = 0;
    for (let i = 0; i < chain.length; i += step) {
      const coord = chain[i];
      if (!coord) continue;
      total += 1;
      if (grid.hasNear(coord, parallelMeters)) near += 1;
    }
    if (total > 0 && near / total >= overlapRatio) continue;

    kept.push(chain);
    grid.addChain(chain);
  }
  return kept;
}
