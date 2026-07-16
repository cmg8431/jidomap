import { aboveGeometryLayerId } from '../../internal/layers';
import { MAP_FONT } from '../../presets/styles';
import type { MaplibreMap, Theme } from '../../types';
import { buildStationAreas } from './area';
import { buildExitBadge, buildStationBadge } from './badge';

export interface SubwayLayerOptions {
  /** 노선 지오메트리 (properties.ref, properties.colour) */
  lines: GeoJSON.FeatureCollection;
  /** 역 포인트 (properties.name, refs, transfer, colour) */
  stations: GeoJSON.FeatureCollection;
  /** 출구 포인트 (properties.ref) — 있으면 확대 시 노란 출구번호 배지를 그린다 */
  exits?: GeoJSON.FeatureCollection;
  /**
   * 실제 지하통로 폴리곤 (공공데이터) — 있으면 합성 회랑 대신 이걸 그린다.
   * 없고 exits 만 있으면 역·출구로 회랑을 합성한다.
   */
  passages?: GeoJSON.FeatureCollection;
  theme?: Theme;
  /** 노선이 보이기 시작하는 최소 줌 (기본 9.5) */
  minzoom?: number;
}

/** 지도에 얹은 레이어 묶음을 되돌리는 핸들 */
export interface LayerHandle {
  remove(): void;
}

const SRC_LINES = 'jido-subway-lines';
const SRC_STATIONS = 'jido-subway-stations';
const SRC_EXITS = 'jido-subway-exits';
const SRC_AREAS = 'jido-subway-areas';
const BADGE_PREFIX = 'jido-stbadge:';
const EXIT_PREFIX = 'jido-exitbadge:';

const LAYER_IDS = [
  'jido-subway-area',
  'jido-subway-area-path',
  'jido-subway-line-casing',
  'jido-subway-line',
  'jido-subway-station',
  'jido-subway-station-badge',
  'jido-subway-exit',
];

/**
 * 지하철 노선을 공식 색상으로, 역은 노선 배지 + 이름으로 그린다.
 * 스타일이 로드된 뒤 호출한다. 반환된 핸들의 remove() 로 정리한다.
 * 테마 전환(setStyle) 후에는 소스가 사라지므로 다시 호출해야 한다.
 */
export function addSubwayLayers(map: MaplibreMap, options: SubwayLayerOptions): LayerHandle {
  const theme: Theme = options.theme ?? 'light';
  const minzoom = options.minzoom ?? 9.5;

  // 노선 ref → 공식 색상 (배지 아이콘 생성용)
  const colourByRef: Record<string, string> = {};
  for (const feature of options.lines.features) {
    const props = feature.properties as { ref?: string; colour?: string } | null;
    if (props?.ref && props.colour) colourByRef[props.ref] = props.colour;
  }

  // 역·출구 배지 아이콘은 요청되는 순간 캔버스로 그려 등록한다
  const onMissing = (event: { id: string }) => {
    if (map.hasImage(event.id)) return;
    let image: ImageData | null = null;
    if (event.id.startsWith(BADGE_PREFIX)) {
      image = buildStationBadge(event.id.slice(BADGE_PREFIX.length).split('·'), colourByRef);
    } else if (event.id.startsWith(EXIT_PREFIX)) {
      image = buildExitBadge(event.id.slice(EXIT_PREFIX.length));
    }
    if (image && !map.hasImage(event.id)) map.addImage(event.id, image, { pixelRatio: 2 });
  };
  map.on('styleimagemissing', onMissing);

  const remove = () => {
    map.off('styleimagemissing', onMissing);
    // 맵이 이미 파괴됐거나(map.remove) 스타일 교체 중이면 조용히 끝낸다
    try {
      for (const id of LAYER_IDS) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(SRC_LINES)) map.removeSource(SRC_LINES);
      if (map.getSource(SRC_STATIONS)) map.removeSource(SRC_STATIONS);
      if (map.getSource(SRC_EXITS)) map.removeSource(SRC_EXITS);
      if (map.getSource(SRC_AREAS)) map.removeSource(SRC_AREAS);
    } catch {
      // no-op
    }
  };

  if (map.getSource(SRC_LINES)) return { remove };

  // 노선은 도로 위·라벨 아래, 역 배지는 라벨 위에 온다
  const before = aboveGeometryLayerId(map);

  map.addSource(SRC_LINES, { type: 'geojson', data: options.lines });
  map.addSource(SRC_STATIONS, { type: 'geojson', data: options.stations });

  map.addLayer(
    {
      id: 'jido-subway-line-casing',
      type: 'line',
      source: SRC_LINES,
      minzoom,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': theme === 'dark' ? '#10151d' : '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.4, 14, 4.6, 16, 7],
        'line-opacity': 0.9,
      },
    },
    before,
  );
  map.addLayer(
    {
      id: 'jido-subway-line',
      type: 'line',
      source: SRC_LINES,
      minzoom,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['coalesce', ['get', 'colour'], '#565b64'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.3, 14, 2.6, 16, 4.2],
        'line-opacity': theme === 'dark' ? 0.85 : 0.75,
      },
    },
    before,
  );
  // 중간 줌: 노선 색 점으로만 역 위치 표시
  map.addLayer({
    id: 'jido-subway-station',
    type: 'circle',
    source: SRC_STATIONS,
    minzoom: 11,
    maxzoom: 13,
    paint: {
      'circle-color': '#ffffff',
      'circle-stroke-color': [
        'case',
        ['==', ['get', 'transfer'], 1],
        theme === 'dark' ? '#e8ecf2' : '#38414e',
        ['coalesce', ['get', 'colour'], theme === 'dark' ? '#e8ecf2' : '#38414e'],
      ],
      'circle-stroke-width': 1.8,
      'circle-radius': ['case', ['==', ['get', 'transfer'], 1], 3.6, 2.6],
    },
  });
  // 확대 줌: 노선번호 배지 + 역 이름 가로 배치
  map.addLayer({
    id: 'jido-subway-station-badge',
    type: 'symbol',
    source: SRC_STATIONS,
    minzoom: 13,
    layout: {
      'icon-image': ['concat', BADGE_PREFIX, ['get', 'refs']],
      'icon-anchor': 'right',
      'icon-offset': [-2, 0],
      'text-field': ['get', 'name'],
      'text-font': MAP_FONT,
      'text-size': 11.5,
      'text-anchor': 'left',
      'text-offset': [0.3, 0],
    },
    paint: {
      'text-color': theme === 'dark' ? '#e3e8ef' : '#28303c',
      'text-halo-color': theme === 'dark' ? '#14161a' : '#ffffff',
      'text-halo-width': 1.3,
    },
  });

  // 확대 줌: 노란 출구번호 배지 + 역 영역 폴리곤
  if (options.exits || options.passages) {
    // 역 영역 — 실측 지하통로가 있으면 그대로, 없으면 역·출구로 회랑 합성
    const areas =
      options.passages ??
      (options.exits
        ? buildStationAreas(options.stations, options.exits)
        : { type: 'FeatureCollection' as const, features: [] });
    if (areas.features.length > 0) {
      const areaColor = theme === 'dark' ? '#8a6a42' : '#e0a45c';
      map.addSource(SRC_AREAS, { type: 'geojson', data: areas });
      // 폴리곤 영역 (합성 회랑 또는 실측 폴리곤)
      map.addLayer(
        {
          id: 'jido-subway-area',
          type: 'fill',
          source: SRC_AREAS,
          minzoom: 14.5,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: {
            'fill-color': areaColor,
            // 겹치는 곳은 자연히 살짝 진해진다
            'fill-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              14.5,
              0,
              15.5,
              theme === 'dark' ? 0.14 : 0.11,
            ],
          },
        },
        before,
      );
      // 실측 지하통로 네트워크(선) — 실제 폭 느낌으로 줌에 따라 두꺼워지는 스트로크
      map.addLayer(
        {
          id: 'jido-subway-area-path',
          type: 'line',
          source: SRC_AREAS,
          minzoom: 14.5,
          filter: ['==', ['geometry-type'], 'LineString'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': areaColor,
            'line-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              14.5,
              0,
              15.5,
              theme === 'dark' ? 0.32 : 0.28,
            ],
            // 실폭 ~12m 근사 — 줌마다 2배
            'line-width': ['interpolate', ['exponential', 2], ['zoom'], 14, 2.5, 16, 10, 18, 40],
          },
        },
        before,
      );
    }

    if (options.exits) {
      map.addSource(SRC_EXITS, { type: 'geojson', data: options.exits });
      map.addLayer({
        id: 'jido-subway-exit',
        type: 'symbol',
        source: SRC_EXITS,
        minzoom: 15.5,
        layout: {
          'icon-image': ['concat', EXIT_PREFIX, ['get', 'ref']],
          'icon-allow-overlap': false,
        },
      });
    }
  }

  return { remove };
}
