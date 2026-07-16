import osmtogeojson from 'osmtogeojson';
import { overpass, quantize } from './overpass';

/**
 * 대한민국 시도(admin_level=4) 경계를 추출한다.
 * osmtogeojson 이 relation → (Multi)Polygon 조립을 담당한다.
 */
export async function buildSidoBoundaries() {
  const query = `
    [out:json][timeout:600];
    area["ISO3166-1"="KR"]->.kr;
    relation(area.kr)["boundary"="administrative"]["admin_level"="4"];
    out body;
    >;
    out skel qt;
  `;
  console.log('[boundaries] 시도 경계 Overpass 쿼리…');
  const response = await overpass(query);
  const geojson = osmtogeojson(response as Parameters<typeof osmtogeojson>[0]);

  const features = geojson.features
    .filter((feature) => /Polygon/.test(feature.geometry?.type ?? ''))
    .map((feature) => ({
      type: 'Feature' as const,
      properties: {
        name:
          (feature.properties?.['name:ko'] as string | undefined) ??
          (feature.properties?.name as string | undefined) ??
          '',
        code: (feature.properties?.['ISO3166-2'] as string | undefined) ?? '',
      },
      geometry: quantizeGeometry(feature.geometry as GeoJSON.Geometry),
    }));

  console.log(`[boundaries] 시도 ${features.length}개`);
  return { type: 'FeatureCollection' as const, features };
}

/** 지오메트리 좌표 전체를 소수 5자리로 양자화 */
function quantizeGeometry<T extends GeoJSON.Geometry>(geometry: T): T {
  const walk = (coords: unknown): unknown => {
    if (typeof coords === 'number') return quantize(coords);
    if (Array.isArray(coords)) return coords.map(walk);
    return coords;
  };
  if ('coordinates' in geometry) {
    return { ...geometry, coordinates: walk(geometry.coordinates) } as T;
  }
  return geometry;
}
