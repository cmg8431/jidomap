'use client';

import { addPoiLayers, type PoiCategory } from '@jidomap/core';
import { useEffect } from 'react';
import { useMap } from '../map/context';

export type PoiLayerProps = {
  /**
   * 노출할 카테고리 — id 문자열(edu·health·pharmacy·market·shop·food·cafe·culture·
   * finance·public·park·transit·lodging·fuel·entertainment) 또는 커스텀 카테고리.
   * 미지정 시 기본 세트(학교·병원·마트·편의점·문화).
   */
  categories?: (string | PoiCategory)[];
  /** POI 벡터 소스 id — 미지정 시 carto → openmaptiles 자동 감지 */
  sourceId?: string;
  /** 벡터 소스 안의 POI source-layer 이름 (기본 'poi') */
  sourceLayer?: string;
  /**
   * 커스텀 POI GeoJSON — 기본지도 타일 대신 이 데이터를 그린다.
   * 공공데이터(상가정보)·Overture Places 등 더 정확한 소스를 꽂는 경로.
   * Feature properties: { name: string, category: 카테고리 id }
   */
  data?: GeoJSON.FeatureCollection;
};

/**
 * 학교·병원·마트·음식점 같은 생활 POI 를 카테고리 배지 + 한글 라벨로 그린다.
 * OpenMapTiles 스키마 스타일(CARTO, OpenFreeMap)에서 동작한다.
 */
export function PoiLayer({ categories, sourceId, sourceLayer, data }: PoiLayerProps) {
  const { map, isLoaded, resolvedTheme, styleEpoch } = useMap();
  // biome-ignore lint/correctness/useExhaustiveDependencies: styleEpoch — 스타일 재빌드 시 레이어 재장착 트리거
  useEffect(() => {
    if (!isLoaded || !map) return;
    const handle = addPoiLayers(map, {
      theme: resolvedTheme,
      categories,
      sourceId,
      sourceLayer,
      data,
    });
    return () => handle.remove();
  }, [isLoaded, map, resolvedTheme, categories, sourceId, sourceLayer, data, styleEpoch]);
  return null;
}
