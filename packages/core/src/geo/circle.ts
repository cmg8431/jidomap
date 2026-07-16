import type { LngLat } from '../types';

/**
 * 중심 + 반경(m)으로 근사 원 폴리곤을 만든다 (카카오 Circle 대응).
 * MapLibre 는 지리적 원을 직접 못 그리므로 다각형으로 근사한다.
 */
export function circlePolygon(
  center: LngLat,
  radiusMeters: number,
  points = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  // 위도 1도 ≈ 111,320m, 경도는 위도에 따라 축소
  const dLat = radiusMeters / 111_320;
  const dLng = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= points; i += 1) {
    const theta = (i / points) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(theta), lat + dLat * Math.sin(theta)]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}
