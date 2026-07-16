'use client';

import {
  addSubwayLayers,
  fetchSubwayData,
  type SubwayData,
  type SubwayRegion,
} from '@jidomap/core';
import { useEffect, useState } from 'react';
import { useMap } from '../map/context';

export type SubwayLayerProps = {
  /**
   * 지하철 권역. 미지정 시 수도권('seoul').
   * 데이터는 @jidomap/data CDN 에서 오므로 앱 재배포 없이 계속 최신화된다.
   */
  region?: SubwayRegion;
  /** 데이터 직접 주입 — 오프라인·번들 사용 시 `import { seoulSubway } from '@jidomap/data'` */
  data?: SubwayData;
  /** 데이터 호스트 베이스 URL — 자체 호스팅 시 교체 */
  dataBase?: string;
  /** 노선이 보이기 시작하는 최소 줌 */
  minzoom?: number;
  /** 출구 번호 배지 표시 (기본 true, 데이터에 출구가 있을 때) */
  showExits?: boolean;
};

/**
 * 지하철 노선·역을 공식 색상 배지로 그린다.
 * <Map> 안에 넣기만 하면 되고, 테마 전환 시 자동으로 다시 얹는다.
 * 오버레이는 부가 정보 — 데이터 로드에 실패해도 지도는 동작한다.
 */
export function SubwayLayer({
  region = 'seoul',
  data,
  dataBase,
  minzoom,
  showExits = true,
}: SubwayLayerProps) {
  const { map, isLoaded, resolvedTheme, styleEpoch } = useMap();
  const [resolved, setResolved] = useState<SubwayData | null>(data ?? null);

  useEffect(() => {
    if (data) {
      setResolved(data);
      return;
    }
    let active = true;
    fetchSubwayData(region, { base: dataBase })
      .then((fetched) => {
        if (active) setResolved(fetched);
      })
      .catch(() => {
        // 부가 오버레이 — 실패 시 조용히 생략
      });
    return () => {
      active = false;
    };
  }, [region, data, dataBase]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: styleEpoch — 스타일 재빌드 시 레이어 재장착 트리거
  useEffect(() => {
    if (!isLoaded || !map || !resolved) return;
    const handle = addSubwayLayers(map, {
      lines: resolved.lines,
      stations: resolved.stations,
      exits: showExits ? resolved.exits : undefined,
      theme: resolvedTheme,
      minzoom,
    });
    return () => handle.remove();
  }, [isLoaded, map, resolvedTheme, resolved, minzoom, showExits, styleEpoch]);

  return null;
}
