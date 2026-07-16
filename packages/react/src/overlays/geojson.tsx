'use client';

import type MapLibreGL from 'maplibre-gl';
import { useEffect, useId, useMemo, useRef } from 'react';
import { useMap } from '../map/context';

type FillPaint = NonNullable<MapLibreGL.FillLayerSpecification['paint']>;
type LinePaint = NonNullable<MapLibreGL.LineLayerSpecification['paint']>;
type CirclePaint = NonNullable<MapLibreGL.CircleLayerSpecification['paint']>;

export type MapGeoJSONEvent = {
  feature: MapLibreGL.MapGeoJSONFeature;
  longitude: number;
  latitude: number;
};

export type MapGeoJSONProps = {
  /** GeoJSON(FeatureCollection·Feature·Geometry) 또는 URL */
  data: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry | string;
  id?: string;
  /** 폴리곤 채우기 paint. false 면 채우기 레이어 생략 */
  fillPaint?: FillPaint | false;
  /** 외곽선 paint. false 면 외곽선 레이어 생략 */
  linePaint?: LinePaint | false;
  /** 포인트 데이터용 circle paint — 지정 시에만 circle 레이어 생성 */
  circlePaint?: CirclePaint;
  /** 클릭·호버 이벤트 활성화 (기본 false) */
  interactive?: boolean;
  onClick?: (event: MapGeoJSONEvent) => void;
  /** 호버 진입 시 feature, 이탈 시 null */
  onHover?: (event: MapGeoJSONEvent | null) => void;
  /** 이 레이어 id 앞(아래)에 삽입 — z 순서 제어 */
  beforeId?: string;
};

const DEFAULT_COLORS = {
  light: { fill: '#d4d4d4', line: '#ffffff' },
  dark: { fill: '#404040', line: '#171717' },
};

/**
 * 임의 GeoJSON 을 채우기/외곽선/서클 레이어로 그리는 범용 탈출구.
 * 행정구역 경계·단계구분도(choropleth)·커스텀 도형에 쓴다.
 * 더 정밀한 제어가 필요하면 useMap() 으로 원본 MapLibre 를 직접 다룬다.
 */
export function MapGeoJSON({
  data,
  id: propId,
  fillPaint,
  linePaint,
  circlePaint,
  interactive = false,
  onClick,
  onHover,
  beforeId,
}: MapGeoJSONProps) {
  const { map, isLoaded, resolvedTheme, styleEpoch } = useMap();
  const autoId = useId();
  const id = propId ?? autoId;
  const sourceId = `jido-geojson-src-${id}`;
  const fillLayerId = `jido-geojson-fill-${id}`;
  const lineLayerId = `jido-geojson-line-${id}`;
  const circleLayerId = `jido-geojson-circle-${id}`;

  const defaults = DEFAULT_COLORS[resolvedTheme];
  const showFill = fillPaint !== false;
  const showLine = linePaint !== false;

  const mergedFillPaint = useMemo(
    () => ({ 'fill-color': defaults.fill, 'fill-opacity': 0.5, ...(fillPaint || {}) }),
    [defaults.fill, fillPaint],
  );
  const mergedLinePaint = useMemo(
    () => ({ 'line-color': defaults.line, 'line-width': 1, ...(linePaint || {}) }),
    [defaults.line, linePaint],
  );

  const latestRef = useRef({ onClick, onHover });
  latestRef.current = { onClick, onHover };

  // 소스 + 레이어 추가
  useEffect(() => {
    if (!isLoaded || !map) return;

    map.addSource(sourceId, { type: 'geojson', data: data as never });
    if (showFill) {
      map.addLayer(
        { id: fillLayerId, type: 'fill', source: sourceId, paint: mergedFillPaint },
        beforeId,
      );
    }
    if (showLine) {
      map.addLayer(
        { id: lineLayerId, type: 'line', source: sourceId, paint: mergedLinePaint },
        beforeId,
      );
    }
    if (circlePaint) {
      map.addLayer(
        {
          id: circleLayerId,
          type: 'circle',
          source: sourceId,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: circlePaint,
        },
        beforeId,
      );
    }

    return () => {
      try {
        for (const layerId of [circleLayerId, lineLayerId, fillLayerId]) {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
        }
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // 스타일 리로드 중일 수 있음
      }
    };
    // 소스·레이어는 마운트/스타일 로드 시 1회 구성 — paint·data 는 아래 effect 가 동기화
  }, [isLoaded, map, styleEpoch]);

  // 데이터 변경 동기화
  useEffect(() => {
    if (!isLoaded || !map) return;
    const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource | undefined;
    source?.setData(data as never);
  }, [isLoaded, map, data, sourceId]);

  // paint 변경 동기화
  useEffect(() => {
    if (!isLoaded || !map) return;
    if (showFill && map.getLayer(fillLayerId)) {
      for (const [key, value] of Object.entries(mergedFillPaint)) {
        map.setPaintProperty(fillLayerId, key, value as never);
      }
    }
    if (showLine && map.getLayer(lineLayerId)) {
      for (const [key, value] of Object.entries(mergedLinePaint)) {
        map.setPaintProperty(lineLayerId, key, value as never);
      }
    }
  }, [
    isLoaded,
    map,
    showFill,
    showLine,
    fillLayerId,
    lineLayerId,
    mergedFillPaint,
    mergedLinePaint,
  ]);

  // 인터랙션 — 존재하는 레이어(fill 우선) 하나에 바인딩
  useEffect(() => {
    if (!isLoaded || !map || !interactive) return;
    const targetLayer = showFill ? fillLayerId : circlePaint ? circleLayerId : lineLayerId;
    if (!map.getLayer(targetLayer)) return;

    const toEvent = (e: MapLibreGL.MapLayerMouseEvent): MapGeoJSONEvent | null => {
      const feature = e.features?.[0];
      if (!feature) return null;
      return { feature, longitude: e.lngLat.lng, latitude: e.lngLat.lat };
    };
    const handleClick = (e: MapLibreGL.MapLayerMouseEvent) => {
      const event = toEvent(e);
      if (event) latestRef.current.onClick?.(event);
    };
    const handleMove = (e: MapLibreGL.MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = 'pointer';
      const event = toEvent(e);
      if (event) latestRef.current.onHover?.(event);
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = '';
      latestRef.current.onHover?.(null);
    };

    map.on('click', targetLayer, handleClick);
    map.on('mousemove', targetLayer, handleMove);
    map.on('mouseleave', targetLayer, handleLeave);
    return () => {
      map.off('click', targetLayer, handleClick);
      map.off('mousemove', targetLayer, handleMove);
      map.off('mouseleave', targetLayer, handleLeave);
      map.getCanvas().style.cursor = '';
    };
  }, [isLoaded, map, interactive, showFill, circlePaint, fillLayerId, lineLayerId, circleLayerId]);

  return null;
}
