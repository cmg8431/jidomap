import type { MaplibreMap, Theme } from '../types';

/** [레이어 id, paint 속성, 값] 튜플 */
type Override = [string, string, string];

export interface BrandTone {
  light?: Override[];
  dark?: Override[];
}

/**
 * CARTO 기본색을 서비스 톤으로 덮어쓰는 기본 팔레트.
 * 라이트: 쿨 그레이 + 물색. 다크: 남색기 없는 차콜.
 * POI·교통 정보는 그대로 두고 바탕(배경·물·건물)만 바꾼다.
 */
export const DEFAULT_BRAND_TONE: BrandTone = {
  light: [
    ['background', 'background-color', '#f7f8fa'],
    ['water', 'fill-color', '#c9ddf2'],
    ['water_shadow', 'fill-color', '#bdd3ec'],
    ['waterway', 'line-color', '#c9ddf2'],
    ['building', 'fill-color', '#e9ebf0'],
    ['watername_lake', 'text-color', '#6b8cb8'],
    ['waterway_label', 'text-color', '#6b8cb8'],
  ],
  dark: [
    ['background', 'background-color', '#17191d'],
    ['water', 'fill-color', '#20303a'],
    ['water_shadow', 'fill-color', '#1c2a32'],
    ['waterway', 'line-color', '#20303a'],
    ['building', 'fill-color', '#1d2024'],
    ['building-top', 'fill-color', '#1d2024'],
  ],
};

/** 스타일이 로드된 뒤, 존재하는 레이어에 한해 브랜드 톤을 입힌다 */
export function applyBrandTone(
  map: MaplibreMap,
  theme: Theme,
  tone: BrandTone = DEFAULT_BRAND_TONE,
): void {
  const overrides = theme === 'dark' ? tone.dark : tone.light;
  for (const [layerId, property, value] of overrides ?? []) {
    if (map.getLayer(layerId)) map.setPaintProperty(layerId, property, value);
  }
}
