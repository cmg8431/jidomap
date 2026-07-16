import type { FeatureCollection, MultiLineString, Point } from 'geojson';
import gwangjuLinesRaw from './subway/gwangju-lines.json';
import gwangjuStationsRaw from './subway/gwangju-stations.json';
import seoulExitsRaw from './subway/seoul-exits.json';
import seoulLinesRaw from './subway/seoul-lines.json';
import seoulPassagesRaw from './subway/seoul-passages.json';
import seoulStationsRaw from './subway/seoul-stations.json';

/** 노선 지오메트리 속성 — ref(노선번호)와 공식 색상 */
export interface SubwayLineProperties {
  ref: string;
  colour: string;
}

/** 역 포인트 속성 — 이름·노선 refs(· 구분)·환승 여부·대표 색상 */
export interface SubwayStationProperties {
  name: string;
  refs: string;
  transfer: number;
  colour: string;
}

export type SubwayLines = FeatureCollection<MultiLineString, SubwayLineProperties>;
export type SubwayStations = FeatureCollection<Point, SubwayStationProperties>;

/** 출구 포인트 속성 — 출구 번호 */
export interface SubwayExitProperties {
  ref: string;
}
export type SubwayExits = FeatureCollection<Point, SubwayExitProperties>;

export type SubwayPassages = FeatureCollection;

export interface SubwayBundle {
  lines: SubwayLines;
  stations: SubwayStations;
  /** 출구 (권역별로 없을 수 있음) */
  exits?: SubwayExits;
  /** 실측 지하통로 폴리곤 — generate:underground 로 생성되면 추가 */
  passages?: SubwayPassages;
}

/** 수도권(서울·경기·인천) 지하철 — OSM 추출 스냅샷 */
export const seoulSubway: SubwayBundle = {
  lines: seoulLinesRaw as unknown as SubwayLines,
  stations: seoulStationsRaw as unknown as SubwayStations,
  exits: seoulExitsRaw as unknown as SubwayExits,
  passages: seoulPassagesRaw as unknown as SubwayPassages,
};

/** 광주 도시철도 — OSM 추출 스냅샷 */
export const gwangjuSubway: SubwayBundle = {
  lines: gwangjuLinesRaw as unknown as SubwayLines,
  stations: gwangjuStationsRaw as unknown as SubwayStations,
};

/**
 * 권역별 지하철 번들. 파이프라인이 부산·대구·대전을 채우면 여기에 추가된다.
 * CDN(jsDelivr) 경로와 파일명이 1:1 대응한다: subway/<region>-lines.json
 */
export const subwayByRegion: Record<string, SubwayBundle> = {
  seoul: seoulSubway,
  gwangju: gwangjuSubway,
};
