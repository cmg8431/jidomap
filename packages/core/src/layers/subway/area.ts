/**
 * 역 영역 합성 — OSM 에 역사(驛舍) 폴리곤이 거의 없어서 만들어 그린다.
 * 당근처럼 "역 중심 → 각 출구"로 뻗는 좁은 회랑(corridor) 스트립의 집합으로,
 * 지하 통로 느낌의 영역이 된다. 겹치는 부분이 살짝 진해지는 것도 같은 질감.
 */

type Coord = [number, number];

const M_PER_DEG_LAT = 111_320;

function metersBetween(a: Coord, b: Coord): number {
  const dLat = (b[1] - a[1]) * M_PER_DEG_LAT;
  const dLng = (b[0] - a[0]) * M_PER_DEG_LAT * Math.cos((a[1] * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/** 미터 오프셋을 경위도 델타로 (기준 위도에서) */
function offset(coord: Coord, dxMeters: number, dyMeters: number): Coord {
  return [
    coord[0] + dxMeters / (M_PER_DEG_LAT * Math.cos((coord[1] * Math.PI) / 180)),
    coord[1] + dyMeters / M_PER_DEG_LAT,
  ];
}

/** 두 점을 잇는 폭 width(m) 회랑 사각형 — 양 끝을 살짝 연장해 이음새를 메운다 */
function corridor(from: Coord, to: Coord, widthMeters: number): Coord[] {
  const dxM = metersBetween(from, [to[0], from[1]]) * Math.sign(to[0] - from[0]);
  const dyM = metersBetween(from, [from[0], to[1]]) * Math.sign(to[1] - from[1]);
  const len = Math.hypot(dxM, dyM) || 1;
  const ux = dxM / len;
  const uy = dyM / len;
  // 법선 벡터 × 반폭
  const nx = (-uy * widthMeters) / 2;
  const ny = (ux * widthMeters) / 2;
  const headExt = 14; // 역 중심 쪽 연장
  const tailExt = 8; // 출구 쪽 연장
  const start = offset(from, -ux * headExt, -uy * headExt);
  const end = offset(to, ux * tailExt, uy * tailExt);
  const ring: Coord[] = [
    offset(start, nx, ny),
    offset(end, nx, ny),
    offset(end, -nx, -ny),
    offset(start, -nx, -ny),
  ];
  ring.push(ring[0] as Coord);
  return ring;
}

export interface StationAreaOptions {
  /** 출구를 역에 붙이는 최대 거리 (기본 220m) */
  attachMeters?: number;
  /** 회랑 폭 (기본 42m) */
  corridorMeters?: number;
}

/**
 * 역 포인트 + 출구 포인트로 당근식 역 회랑 영역을 합성한다.
 * 출구는 "최근접 역"에만 붙는다 (이웃 역과 섞이지 않게).
 */
export function buildStationAreas(
  stations: GeoJSON.FeatureCollection,
  exits: GeoJSON.FeatureCollection,
  options: StationAreaOptions = {},
): GeoJSON.FeatureCollection {
  const { attachMeters = 220, corridorMeters = 42 } = options;

  const centers: { center: Coord; name: string; exits: Coord[] }[] = stations.features
    .filter((f) => f.geometry.type === 'Point')
    .map((f) => ({
      center: (f.geometry as GeoJSON.Point).coordinates as Coord,
      name: (f.properties as { name?: string } | null)?.name ?? '',
      exits: [],
    }));

  // 출구 → 최근접 역 배정
  for (const exit of exits.features) {
    if (exit.geometry.type !== 'Point') continue;
    const coord = (exit.geometry as GeoJSON.Point).coordinates as Coord;
    let best: { station: (typeof centers)[number]; dist: number } | null = null;
    for (const station of centers) {
      const dist = metersBetween(station.center, coord);
      if (dist <= attachMeters && (!best || dist < best.dist)) best = { station, dist };
    }
    best?.station.exits.push(coord);
  }

  const features: GeoJSON.Feature[] = [];
  for (const station of centers) {
    if (station.exits.length < 2) continue;
    for (const exit of station.exits) {
      features.push({
        type: 'Feature',
        properties: { name: station.name },
        geometry: {
          type: 'Polygon',
          coordinates: [corridor(station.center, exit, corridorMeters)],
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}
