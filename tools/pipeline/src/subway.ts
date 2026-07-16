import { dedupLineCoordinates } from './dedup';
import { type OsmElement, overpass, quantize } from './overpass';

/**
 * 권역 정의 — ISO3166-2 코드로 Overpass area 를 잡는다.
 * 광역 노선이 행정구역을 넘나들므로 권역은 인접 시도를 묶는다.
 */
export const SUBWAY_REGIONS: Record<string, string[]> = {
  seoul: ['KR-11', 'KR-41', 'KR-28'], // 서울·경기·인천 (수도권)
  busan: ['KR-26', 'KR-48'], // 부산·경남 (부산김해경전철 포함)
  daegu: ['KR-27', 'KR-47'], // 대구·경북 (대구권 광역전철 포함)
  gwangju: ['KR-29'],
  daejeon: ['KR-30', 'KR-43'], // 대전·충북 (충청권 광역철도 대비)
};

interface LineFeature {
  type: 'Feature';
  properties: { ref: string; colour: string };
  geometry: { type: 'MultiLineString'; coordinates: [number, number][][] };
}

interface StationFeature {
  type: 'Feature';
  properties: { name: string; refs: string; transfer: number; colour: string };
  geometry: { type: 'Point'; coordinates: [number, number] };
}

/** 같은 역(이름 동일 + 300m 이내)을 하나로 합치기 위한 거리 */
const MERGE_METERS = 300;

function distanceMeters(a: [number, number], b: [number, number]): number {
  const dLat = (b[1] - a[1]) * 111_320;
  const dLng = (b[0] - a[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/** OSM ref 표기 정규화 — 배지에 보이는 이름 */
export const REF_ALIASES: Record<string, string> = {
  Silim: '신림',
  U: '의정부',
  E: '용인',
  W: '서해',
  I1: '인천1',
  I2: '인천2',
  '김포 골드라인': '김포',
  GoldLine: '김포',
};

/** 노선 ref 정렬 — 숫자 노선 먼저, 나머지는 사전순 */
function sortRefs(refs: string[]): string[] {
  return [...refs].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isNaN(na) && Number.isNaN(nb)) return a.localeCompare(b, 'ko');
    if (Number.isNaN(na)) return 1;
    if (Number.isNaN(nb)) return -1;
    return na - nb;
  });
}

/**
 * 권역의 지하철·경전철 노선/역을 추출해 GeoJSON 으로 만든다.
 * - 노선: route=subway|light_rail relation 의 way 들을 ref 별 MultiLineString 으로 병합
 * - 역: relation 의 stop 멤버 노드를 이름으로 병합, refs(·구분)·환승·색상 부여
 */
export async function buildSubwayRegion(region: string, isoCodes: string[]) {
  const areaFilter = isoCodes.map((code) => `"${code}"`).join('|');
  const query = `
    [out:json][timeout:600];
    area["ISO3166-2"~"^(${isoCodes.join('|')})$"]->.a;
    relation(area.a)["route"~"^(subway|light_rail)$"]["ref"];
    out body;
    >;
    out body qt;
  `;
  console.log(`[subway:${region}] Overpass 쿼리 (${areaFilter})…`);
  const response = await overpass(query);

  const nodes = new Map<number, OsmElement>();
  const ways = new Map<number, OsmElement>();
  const relations: OsmElement[] = [];
  for (const element of response.elements) {
    if (element.type === 'node') nodes.set(element.id, element);
    else if (element.type === 'way') ways.set(element.id, element);
    else if (element.type === 'relation') relations.push(element);
  }
  console.log(
    `[subway:${region}] relations=${relations.length} ways=${ways.size} nodes=${nodes.size}`,
  );

  // ref 별로 노선 병합 (상·하행 등 여러 relation → 한 노선)
  const lineByRef = new Map<string, { colour: string; wayIds: Set<number> }>();
  // 역 후보: 이름 → 좌표·소속 ref 목록
  const stationCandidates: { name: string; ref: string; coord: [number, number] }[] = [];

  for (const relation of relations) {
    const rawRef = relation.tags?.ref;
    if (!rawRef) continue;
    const ref = REF_ALIASES[rawRef] ?? rawRef;
    const colour = relation.tags?.colour ?? relation.tags?.color ?? '#565b64';
    const line = lineByRef.get(ref) ?? { colour, wayIds: new Set<number>() };
    if (colour !== '#565b64') line.colour = colour;

    for (const member of relation.members ?? []) {
      if (member.type === 'way' && !member.role.startsWith('platform')) {
        line.wayIds.add(member.ref);
      }
      if (member.type === 'node' && /stop/.test(member.role)) {
        const node = nodes.get(member.ref);
        const name = node?.tags?.['name:ko'] ?? node?.tags?.name;
        if (node?.lat != null && node.lon != null && name) {
          stationCandidates.push({
            name,
            ref,
            coord: [quantize(node.lon), quantize(node.lat)],
          });
        }
      }
    }
    lineByRef.set(ref, line);
  }

  // ref 별 역 좌표 — 기지 인입선 제거용
  const stationCoordsByRef = new Map<string, [number, number][]>();
  for (const candidate of stationCandidates) {
    const list = stationCoordsByRef.get(candidate.ref) ?? [];
    list.push(candidate.coord);
    stationCoordsByRef.set(candidate.ref, list);
  }

  const lineFeatures: LineFeature[] = [...lineByRef.entries()].map(([ref, line]) => {
    const rawSegments = [...line.wayIds].flatMap((wayId) => {
      const way = ways.get(wayId);
      if (!way?.nodes) return [];
      const coords = way.nodes.flatMap((nodeId) => {
        const node = nodes.get(nodeId);
        return node?.lat != null && node.lon != null
          ? [[quantize(node.lon), quantize(node.lat)] as [number, number]]
          : [];
      });
      return coords.length >= 2 ? [coords] : [];
    });
    return {
      type: 'Feature',
      properties: { ref, colour: line.colour },
      geometry: {
        type: 'MultiLineString',
        // 상·하행/측선을 중심선 + 분기선으로 정리 — 복선 두 줄·기지 인입선 방지
        coordinates: dedupLineCoordinates(rawSegments, {
          stations: stationCoordsByRef.get(ref) ?? [],
        }),
      },
    };
  });

  // 이름 + 근접 기준으로 역 병합
  const merged: { name: string; refs: Set<string>; coords: [number, number][] }[] = [];
  for (const candidate of stationCandidates) {
    const existing = merged.find(
      (station) =>
        station.name === candidate.name &&
        station.coords.some((coord) => distanceMeters(coord, candidate.coord) <= MERGE_METERS),
    );
    if (existing) {
      existing.refs.add(candidate.ref);
      existing.coords.push(candidate.coord);
    } else {
      merged.push({
        name: candidate.name,
        refs: new Set([candidate.ref]),
        coords: [candidate.coord],
      });
    }
  }

  const stationFeatures: StationFeature[] = merged.map((station) => {
    const refs = sortRefs([...station.refs]);
    const lng = station.coords.reduce((sum, coord) => sum + coord[0], 0) / station.coords.length;
    const lat = station.coords.reduce((sum, coord) => sum + coord[1], 0) / station.coords.length;
    return {
      type: 'Feature',
      properties: {
        name: station.name.replace(/역$/, ''),
        refs: refs.join('·'),
        transfer: refs.length > 1 ? 1 : 0,
        colour: lineByRef.get(refs[0] ?? '')?.colour ?? '#565b64',
      },
      geometry: { type: 'Point', coordinates: [quantize(lng), quantize(lat)] },
    };
  });

  console.log(`[subway:${region}] lines=${lineFeatures.length} stations=${stationFeatures.length}`);
  return {
    lines: { type: 'FeatureCollection' as const, features: lineFeatures },
    stations: { type: 'FeatureCollection' as const, features: stationFeatures },
  };
}

/** 권역의 지하철 출구(subway_entrance) — 출구번호(ref) 있는 것만 */
export async function buildSubwayExits(region: string, isoCodes: string[]) {
  const query = `
    [out:json][timeout:300];
    area["ISO3166-2"~"^(${isoCodes.join('|')})$"]->.a;
    node(area.a)["railway"="subway_entrance"];
    out body qt;
  `;
  console.log(`[exits:${region}] Overpass 쿼리…`);
  const response = await overpass(query);
  const features = response.elements
    .filter(
      (element) =>
        element.type === 'node' && element.lat != null && element.lon != null && element.tags?.ref,
    )
    .map((element) => ({
      type: 'Feature' as const,
      properties: { ref: (element.tags?.ref ?? '').trim() },
      geometry: {
        type: 'Point' as const,
        coordinates: [quantize(element.lon ?? 0), quantize(element.lat ?? 0)],
      },
    }));
  console.log(`[exits:${region}] exits=${features.length}`);
  return { type: 'FeatureCollection' as const, features };
}
