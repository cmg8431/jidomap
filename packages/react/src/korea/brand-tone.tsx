'use client';

import { applyBrandTone, type BrandTone as BrandToneMap } from '@jidomap/core';
import { useEffect } from 'react';
import { useMap } from '../map/context';

export type BrandToneProps = {
  /** 라이트/다크 색 오버라이드. 미지정 시 기본 팔레트 */
  tone?: BrandToneMap;
};

/** 지도 바탕(배경·물·건물)을 서비스 톤으로 덮는다 */
export function BrandTone({ tone }: BrandToneProps) {
  const { map, isLoaded, resolvedTheme, styleEpoch } = useMap();
  // biome-ignore lint/correctness/useExhaustiveDependencies: styleEpoch — 스타일 재빌드 시 레이어 재장착 트리거
  useEffect(() => {
    if (!isLoaded || !map) return;
    applyBrandTone(map, resolvedTheme, tone);
  }, [isLoaded, map, resolvedTheme, tone, styleEpoch]);
  return null;
}
