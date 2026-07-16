// 타입

// 데이터 클라이언트 (@jidomap/data CDN — 앱 재배포 없이 최신 데이터)
export {
  DEFAULT_DATA_BASE,
  type FetchDataOptions,
  fetchSubwayData,
  type SubwayData,
  type SubwayRegion,
  subwayDataUrls,
} from './data-client';
export { circlePolygon } from './geo/circle';
// 지오 유틸
export { haversineMeters, walkMinutes } from './geo/distance';
export { levelToZoom, zoomToLevel } from './geo/level';
export { type NearbyStation, nearbyStations } from './geo/nearby';
// 레이어 삽입 지점 헬퍼
export { aboveGeometryLayerId, firstSymbolLayerId } from './internal/layers';
export {
  addPoiLayers,
  DEFAULT_POI_CATEGORY_IDS,
  POI_CATEGORIES,
  type PoiCategory,
  type PoiLayerOptions,
} from './layers/poi';
export { buildStationAreas, type StationAreaOptions } from './layers/subway/area';
export { buildExitBadge, buildStationBadge } from './layers/subway/badge';
// 레이어 (지하철 · POI)
export {
  addSubwayLayers,
  type LayerHandle,
  type SubwayLayerOptions,
} from './layers/subway/subway';
// 스타일 프리셋 · 상수
export {
  KO_LOCALE,
  KOREA_BOUNDS,
  MAP_FONT,
  resolveStyle,
  SEOUL_CENTER,
  STYLE_PRESETS,
  type StylePreset,
} from './presets/styles';
export { applyBrandTone, type BrandTone, DEFAULT_BRAND_TONE } from './style/brand-tone';
// 스타일 변형 (한글 라벨 · 브랜드 톤)
export { localizeLabelsToKorean } from './style/korean-labels';
export { emphasizeTransport } from './style/transport';
export type {
  LngLat,
  LngLatBoundsLike,
  LngLatLike,
  MaplibreMap,
  MaplibreMapOptions,
  StyleSpecification,
  Theme,
} from './types';
