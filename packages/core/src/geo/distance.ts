import type { LngLat } from '../types';

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** 두 좌표 사이 하버사인 거리(m) */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** 도보 분 — 기본 80m/분 가정 */
export function walkMinutes(a: LngLat, b: LngLat, metersPerMinute = 80): number {
  return Math.max(1, Math.round(haversineMeters(a, b) / metersPerMinute));
}
