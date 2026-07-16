import type { MaplibreMap, Theme } from '../types';

/**
 * 고속도로·철도(KTX 등)를 기본 스타일보다 또렷하게 강조한다.
 * 레이어 id 휴리스틱으로 CARTO(voyager·positron·dark-matter)와
 * OpenFreeMap 계열을 함께 커버한다. 스타일 로드 후 호출.
 */
export function emphasizeTransport(map: MaplibreMap, theme: Theme): void {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'line' || layer.id.startsWith('jido-')) continue;
    const id = layer.id.toLowerCase();
    if (/label|name|shield/.test(id)) continue;

    // 고속도로·간선 — 당근식 웜 앰버 (positron 은 motorway 가 trunk 레이어에 합쳐져 있다)
    if (/motorway|expressway|trunk/.test(id)) {
      if (/casing/.test(id)) {
        map.setPaintProperty(layer.id, 'line-color', theme === 'dark' ? '#2c2517' : '#e5b054');
      } else {
        map.setPaintProperty(layer.id, 'line-color', theme === 'dark' ? '#57482c' : '#f7cd77');
      }
      continue;
    }
    // 철도(일반·고속) — 지하철 오버레이와 구분되는 뉴트럴 대비
    if (/(^|_)rail|railway/.test(id) && !/subway|transit|hatching/.test(id)) {
      map.setPaintProperty(layer.id, 'line-color', theme === 'dark' ? '#5a6575' : '#9aa5b2');
      map.setPaintProperty(layer.id, 'line-opacity', 0.9);
    }
  }
}
