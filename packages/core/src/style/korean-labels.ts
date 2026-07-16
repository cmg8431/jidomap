import type { MaplibreMap } from '../types';

/**
 * CARTO·OSM 벡터 스타일은 라벨을 name_en(영문) 우선으로 그린다.
 * 심볼 레이어의 text-field 를 로컬 이름(name) 우선으로 바꿔 한국어 라벨을 강제한다.
 * 스타일 로드 직후(또는 테마 전환 후) 호출한다.
 */
export function localizeLabelsToKorean(map: MaplibreMap): void {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const textField = map.getLayoutProperty(layer.id, 'text-field');
    if (!textField || !JSON.stringify(textField).includes('name')) continue;
    map.setLayoutProperty(layer.id, 'text-field', [
      'coalesce',
      ['get', 'name:ko'],
      ['get', 'name'],
      ['get', 'name_en'],
    ]);
  }
}
