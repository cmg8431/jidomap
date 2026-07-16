'use client';

import { circlePolygon } from '@jidomap/core';
import { useMemo } from 'react';
import { MapGeoJSON } from './geojson';

export type MapCircleProps = {
  longitude: number;
  latitude: number;
  /** 반경 (미터) */
  radius: number;
  color?: string;
  /** 채우기 불투명도 (기본 0.15) */
  opacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
};

/** 중심 + 반경(m) 원 — 카카오맵 Circle 대응. 도보권·반경 표시에 쓴다 */
export function MapCircle({
  longitude,
  latitude,
  radius,
  color = '#2272eb',
  opacity = 0.15,
  strokeColor,
  strokeWidth = 1.5,
}: MapCircleProps) {
  const polygon = useMemo(
    () => circlePolygon([longitude, latitude], radius),
    [longitude, latitude, radius],
  );
  return (
    <MapGeoJSON
      data={polygon}
      fillPaint={{ 'fill-color': color, 'fill-opacity': opacity }}
      linePaint={{ 'line-color': strokeColor ?? color, 'line-width': strokeWidth }}
    />
  );
}
