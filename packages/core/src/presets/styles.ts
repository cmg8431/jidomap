import type { LngLat, LngLatBoundsLike } from '../types';

/**
 * 무료·무키로 쓸 수 있는 벡터 스타일 프리셋 (OSM 기반, OpenMapTiles 스키마).
 * CARTO: voyager(정보량 많음)·positron(미니멀)·dark-matter(다크).
 * OpenFreeMap: liberty·bright — CARTO 보다 POI 가 촘촘하고 상업 사용 제약이 없다.
 */
export const STYLE_PRESETS = {
  light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  voyager: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  positron: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  'dark-matter': 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  bright: 'https://tiles.openfreemap.org/styles/bright',
} as const;

export type StylePreset = keyof typeof STYLE_PRESETS;

/** 서울 시청 근처 — 기본 중심 */
export const SEOUL_CENTER: LngLat = [126.978, 37.5665];

/** 한반도 밖으로 벗어나지 않게 막는 기본 카메라 경계 */
export const KOREA_BOUNDS: LngLatBoundsLike = [
  [123.5, 32.8],
  [132.5, 39.8],
];

/**
 * CARTO 스타일(Voyager·Positron·Dark Matter 공통)이 제공하는 글리프 스택.
 * 지도 위 심볼(역·POI) 텍스트 라벨용 — 한글은 localIdeographFontFamily 로 로컬 렌더된다.
 */
export const MAP_FONT = [
  'Montserrat Medium',
  'Open Sans Bold',
  'Noto Sans Regular',
  'HanWangHeiLight Regular',
  'NanumBarunGothic Regular',
];

/** MapLibre 기본 컨트롤(줌 등)의 한국어 라벨 */
export const KO_LOCALE: Record<string, string> = {
  'AttributionControl.ToggleAttribution': '출처 표시 전환',
  'AttributionControl.MapFeedback': '지도 피드백',
  'FullscreenControl.Enter': '전체화면',
  'FullscreenControl.Exit': '전체화면 종료',
  'GeolocateControl.FindMyLocation': '내 위치 찾기',
  'GeolocateControl.LocationNotAvailable': '위치를 사용할 수 없어요',
  'NavigationControl.ResetBearing': '북쪽으로 정렬',
  'NavigationControl.ZoomIn': '확대',
  'NavigationControl.ZoomOut': '축소',
  'ScaleControl.Feet': 'ft',
  'ScaleControl.Meters': 'm',
  'ScaleControl.Kilometers': 'km',
};

/** 프리셋 이름·URL·스타일 스펙을 최종 style 값으로 해석한다 */
export function resolveStyle(style: StylePreset | string | object): string | object {
  if (typeof style === 'string' && style in STYLE_PRESETS) {
    return STYLE_PRESETS[style as StylePreset];
  }
  return style;
}
