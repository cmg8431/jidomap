import type {
  LngLatBoundsLike,
  LngLatLike,
  Map as MaplibreMap,
  MapOptions as MaplibreMapOptions,
  StyleSpecification,
} from 'maplibre-gl';

export type { LngLatBoundsLike, LngLatLike, MaplibreMap, MaplibreMapOptions, StyleSpecification };

/** 지도 톤 — 라이트/다크. 'auto' 는 옵션 단계에서만 쓰이고 내부적으로 둘 중 하나로 해석된다. */
export type Theme = 'light' | 'dark';

/** 경위도 좌표 [lng, lat] */
export type LngLat = [number, number];
