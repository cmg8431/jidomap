// 지도 루트 · 컨텍스트 · 훅

// core 재노출 — 프리셋·상수·지오 유틸·데이터 헬퍼를 한 곳에서
export {
  circlePolygon,
  DEFAULT_POI_CATEGORY_IDS,
  fetchSubwayData,
  haversineMeters,
  KO_LOCALE,
  KOREA_BOUNDS,
  levelToZoom,
  type NearbyStation,
  nearbyStations,
  POI_CATEGORIES,
  type PoiCategory,
  SEOUL_CENTER,
  STYLE_PRESETS,
  type StylePreset,
  type SubwayData,
  type SubwayRegion,
  subwayDataUrls,
  type Theme,
  walkMinutes,
  zoomToLevel,
} from '@jidomap/core';
// 컨트롤
export { MapControls, type MapControlsProps } from './controls/controls';
export { BrandTone, type BrandToneProps } from './korea/brand-tone';
// 한국 레이어 (한글 라벨 · 브랜드 톤 · 지하철 · POI)
export { KoreanLabels } from './korea/korean-labels';
export { PoiLayer, type PoiLayerProps } from './korea/poi-layer';
export { SubwayLayer, type SubwayLayerProps } from './korea/subway-layer';
export { TransportEmphasis } from './korea/transport-emphasis';
export { MapContext, type MapContextValue, useMap } from './map/context';
export { Map, type MapProps, type MapTokens, type MapViewport } from './map/map';
export { getDocumentTheme, getSystemTheme, useResolvedTheme } from './map/theme';
// 마커 (합성 컴포넌트)
export {
  Marker,
  MarkerContent,
  type MarkerContentProps,
  MarkerLabel,
  type MarkerLabelProps,
  MarkerPopup,
  type MarkerPopupProps,
  type MarkerProps,
  MarkerTooltip,
  type MarkerTooltipProps,
} from './marker/marker';
export { MapCircle, type MapCircleProps } from './overlays/circle';
export { MapGeoJSON, type MapGeoJSONEvent, type MapGeoJSONProps } from './overlays/geojson';
// 오버레이 (팝업 · 경로 · GeoJSON · 원)
export { MapPopup, type MapPopupProps } from './overlays/popup';
export { MapRoute, type MapRouteProps } from './overlays/route';
