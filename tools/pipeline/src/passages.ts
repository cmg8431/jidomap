import { type OsmElement, overpass, quantize } from './overpass';

/**
 * OSM 지하 보행로 추출 — 지하보도·지하상가 통로·지하 연결통로.
 * 공공데이터(generate:underground) 없는 권역의 passages 를 자동으로 채운다.
 *
 * 대상 태그:
 * - highway=footway|path|corridor|steps|pedestrian + tunnel=yes|building_passage
 * - highway=footway|corridor|pedestrian + layer<0 또는 location=underground
 * - highway=corridor + indoor=yes + level<0 (지하상가 내부 통로)
 */
export async function buildUndergroundPassages(region: string, isoCodes: string[]) {
  const query = `
    [out:json][timeout:600];
    area["ISO3166-2"~"^(${isoCodes.join('|')})$"]->.a;
    (
      way(area.a)["highway"~"^(footway|path|corridor|steps|pedestrian)$"]["tunnel"~"^(yes|building_passage)$"];
      way(area.a)["highway"~"^(footway|corridor|pedestrian)$"]["layer"~"^-"];
      way(area.a)["highway"~"^(footway|corridor|pedestrian)$"]["location"="underground"];
      way(area.a)["highway"="corridor"]["indoor"="yes"]["level"~"^-"];
    );
    out body;
    >;
    out skel qt;
  `;
  console.log(`[passages:${region}] Overpass 쿼리…`);
  const response = await overpass(query);

  const nodes = new Map<number, OsmElement>();
  const ways: OsmElement[] = [];
  for (const element of response.elements) {
    if (element.type === 'node') nodes.set(element.id, element);
    else if (element.type === 'way') ways.push(element);
  }

  const features = ways.flatMap((way) => {
    const coords = (way.nodes ?? []).flatMap((nodeId) => {
      const node = nodes.get(nodeId);
      return node?.lat != null && node.lon != null
        ? [[quantize(node.lon), quantize(node.lat)] as [number, number]]
        : [];
    });
    if (coords.length < 2) return [];
    return [
      {
        type: 'Feature' as const,
        properties: { name: way.tags?.['name:ko'] ?? way.tags?.name ?? '' },
        geometry: { type: 'LineString' as const, coordinates: coords },
      },
    ];
  });

  console.log(`[passages:${region}] ways=${features.length}`);
  return { type: 'FeatureCollection' as const, source: 'osm' as const, features };
}
