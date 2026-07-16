'use client';

import type MapLibreGL from 'maplibre-gl';
import { useEffect, useId } from 'react';
import { useMap } from '../map/context';

export type MapRouteProps = {
  id?: string;
  /** [경도, 위도] 쌍 배열 */
  coordinates: [number, number][];
  color?: string;
  width?: number;
  opacity?: number;
  /** 점선 패턴 [선 길이, 간격] */
  dashArray?: [number, number];
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  interactive?: boolean;
};

/** 좌표 배열을 선(경로)으로 그린다 */
export function MapRoute({
  id: propId,
  coordinates,
  color = '#2272eb',
  width = 3,
  opacity = 0.85,
  dashArray,
  onClick,
  onMouseEnter,
  onMouseLeave,
  interactive = true,
}: MapRouteProps) {
  const { map, isLoaded, styleEpoch } = useMap();
  const autoId = useId();
  const id = propId ?? autoId;
  const sourceId = `jido-route-src-${id}`;
  const layerId = `jido-route-${id}`;

  useEffect(() => {
    if (!isLoaded || !map) return;
    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
    });
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': color,
        'line-width': width,
        'line-opacity': opacity,
        ...(dashArray && { 'line-dasharray': dashArray }),
      },
    });
    return () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // 스타일 리로드 중일 수 있음
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, map, styleEpoch]);

  useEffect(() => {
    if (!isLoaded || !map || coordinates.length < 2) return;
    const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource | undefined;
    source?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates },
    });
  }, [isLoaded, map, coordinates, sourceId]);

  useEffect(() => {
    if (!isLoaded || !map) return;
    if (!map.getLayer(layerId)) return;
    map.setPaintProperty(layerId, 'line-color', color);
    map.setPaintProperty(layerId, 'line-width', width);
    map.setPaintProperty(layerId, 'line-opacity', opacity);
    map.setPaintProperty(layerId, 'line-dasharray', dashArray ?? null);
  }, [isLoaded, map, layerId, color, width, opacity, dashArray]);

  useEffect(() => {
    if (!isLoaded || !map || !interactive) return;
    const handleClick = () => onClick?.();
    const handleEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
      onMouseEnter?.();
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = '';
      onMouseLeave?.();
    };
    map.on('click', layerId, handleClick);
    map.on('mouseenter', layerId, handleEnter);
    map.on('mouseleave', layerId, handleLeave);
    return () => {
      map.off('click', layerId, handleClick);
      map.off('mouseenter', layerId, handleEnter);
      map.off('mouseleave', layerId, handleLeave);
    };
  }, [isLoaded, map, layerId, onClick, onMouseEnter, onMouseLeave, interactive]);

  return null;
}
