import type { MaplibreMap } from '../types';

/** 라벨(심볼) 블록의 첫 레이어 id — 이 앞에 넣으면 텍스트 라벨 아래로 깔린다 */
export function firstSymbolLayerId(map: MaplibreMap): string | undefined {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type === 'symbol') return layer.id;
  }
  return undefined;
}

/** 도로·수면 등 지오메트리 레이어들 바로 위, 라벨(심볼) 블록 아래 삽입 지점 */
export function aboveGeometryLayerId(map: MaplibreMap): string | undefined {
  const layers = map.getStyle().layers ?? [];
  let lastGeometry = -1;
  layers.forEach((layer, index) => {
    if (layer.type !== 'symbol') lastGeometry = index;
  });
  return layers[lastGeometry + 1]?.id;
}
