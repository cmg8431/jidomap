import type { LngLat } from '../types';
import { walkMinutes } from './distance';

export interface NearbyStation {
  name: string;
  refs: string;
  transfer: boolean;
  colour: string;
  lngLat: LngLat;
  walkMin: number;
}

interface StationProps {
  name?: string;
  refs?: string;
  transfer?: number;
  colour?: string;
}

/**
 * 좌표 기준 가까운 지하철역 top N (기본 도보 25분 이내).
 * stations 는 @jidomap/data 의 역 컬렉션 또는 같은 스키마의 GeoJSON.
 */
export function nearbyStations(
  stations: GeoJSON.FeatureCollection<GeoJSON.Point>,
  from: LngLat,
  options: { limit?: number; maxWalkMin?: number } = {},
): NearbyStation[] {
  const { limit = 3, maxWalkMin = 25 } = options;
  return stations.features
    .map((feature) => {
      const props = (feature.properties ?? {}) as StationProps;
      const lngLat = feature.geometry.coordinates as LngLat;
      return {
        name: props.name ?? '',
        refs: props.refs ?? '',
        transfer: props.transfer === 1,
        colour: props.colour ?? '#565b64',
        lngLat,
        walkMin: walkMinutes(from, lngLat),
      };
    })
    .filter((station) => station.walkMin <= maxWalkMin)
    .sort((a, b) => a.walkMin - b.walkMin)
    .slice(0, limit);
}
