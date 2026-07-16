import type { MaplibreMap, Theme } from '@jidomap/core';
import { createContext, useContext } from 'react';

export type MapContextValue = {
  /** 원본 MapLibre 인스턴스 — 모든 MapLibre API 접근 가능 */
  map: MaplibreMap | null;
  /** 스타일까지 완전히 로드돼 레이어 조작이 안전한 상태 */
  isLoaded: boolean;
  /** 해석된 현재 톤 (light/dark) */
  resolvedTheme: Theme;
  /**
   * 스타일이 새로 로드될 때마다 증가하는 카운터.
   * setStyle 이 diff 실패로 전체 재빌드되면 isLoaded 는 안 뒤집히지만 이 값은 바뀐다 —
   * 레이어를 얹는 컴포넌트는 이 값을 effect 의존성에 넣어 재장착한다.
   */
  styleEpoch: number;
};

export const MapContext = createContext<MapContextValue | null>(null);

/** <Map> 안에서 지도 인스턴스·로드 상태·테마를 읽는다 */
export function useMap(): MapContextValue {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMap 은 <Map> 컴포넌트 안에서만 사용할 수 있어요');
  }
  return context;
}
