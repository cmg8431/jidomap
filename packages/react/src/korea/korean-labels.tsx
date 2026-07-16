'use client';

import { localizeLabelsToKorean } from '@jidomap/core';
import { useEffect } from 'react';
import { useMap } from '../map/context';

/**
 * 지도 라벨을 한국어(name:ko → name) 우선으로 강제한다.
 * <Map> 안에 넣기만 하면 된다. 테마 전환 시 자동으로 다시 적용된다.
 */
export function KoreanLabels() {
  const { map, isLoaded, resolvedTheme, styleEpoch } = useMap();
  // biome-ignore lint/correctness/useExhaustiveDependencies: 테마 전환(스타일 교체) 시 라벨을 다시 한국어화해야 한다
  useEffect(() => {
    if (!isLoaded || !map) return;
    localizeLabelsToKorean(map);
  }, [isLoaded, map, resolvedTheme, styleEpoch]);
  return null;
}
