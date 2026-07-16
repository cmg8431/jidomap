'use client';

import { emphasizeTransport } from '@jidomap/core';
import { useEffect } from 'react';
import { useMap } from '../map/context';

/**
 * 고속도로·철도(KTX 등)를 기본 스타일보다 또렷하게 강조한다.
 * <Map> 안에 넣기만 하면 되고, 테마·스타일 전환 시 자동으로 다시 적용된다.
 */
export function TransportEmphasis() {
  const { map, isLoaded, resolvedTheme, styleEpoch } = useMap();
  // biome-ignore lint/correctness/useExhaustiveDependencies: styleEpoch — 스타일 재빌드 시 재적용 트리거
  useEffect(() => {
    if (!isLoaded || !map) return;
    emphasizeTransport(map, resolvedTheme);
  }, [isLoaded, map, resolvedTheme, styleEpoch]);
  return null;
}
