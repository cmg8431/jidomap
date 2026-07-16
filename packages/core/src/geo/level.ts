/**
 * 카카오맵 'level'(1=최대확대 … 14=최대축소)과 MapLibre 'zoom' 사이 근사 변환.
 * 카카오에 익숙한 사용자를 위한 편의 API — 정확한 1:1 매핑은 아니다.
 */
export function levelToZoom(level: number): number {
  return clampZoom(20 - level);
}

export function zoomToLevel(zoom: number): number {
  return Math.max(1, Math.min(14, Math.round(20 - zoom)));
}

function clampZoom(zoom: number): number {
  return Math.max(0, Math.min(24, zoom));
}
