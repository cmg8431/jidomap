import { MAP_FONT } from '../presets/styles';
import type { MaplibreMap, Theme } from '../types';
import type { LayerHandle } from './subway/subway';

/**
 * 생활 POI 카테고리 — 색 배지 + 픽토그램 + 한글 라벨로 그린다.
 * classes 는 OpenMapTiles poi 레이어의 class/subclass 값과 매칭된다
 * (CARTO voyager·positron, OpenFreeMap liberty·bright 공통 스키마).
 */
export interface PoiCategory {
  id: string;
  /** 사람이 읽는 한글 라벨 (칩 UI 등) */
  label: string;
  /** OSM class/subclass 매칭 목록 */
  classes: string[];
  color: string;
  darkColor: string;
  /** 픽토그램 SVG path (24x24 viewBox, stroke 기반) */
  iconPath: string;
  minzoom?: number;
}

const ICON = {
  edu: '<path d="M21.6 9.7 12.5 4.8a1 1 0 0 0-1 0L2.4 9.7a.75.75 0 0 0 0 1.3l9.1 4.9a1 1 0 0 0 1 0l9.1-4.9a.75.75 0 0 0 0-1.3Z"/><path d="M6.5 13.4v3.4c0 1.4 2.5 2.4 5.5 2.4s5.5-1 5.5-2.4v-3.4"/>',
  cross: '<path d="M12 5.5v13M5.5 12h13"/>',
  pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  cart: '<circle cx="9.5" cy="20" r="1.4"/><circle cx="17.5" cy="20" r="1.4"/><path d="M3 4h2.2l2.4 10.8a1.8 1.8 0 0 0 1.8 1.4h7.4a1.8 1.8 0 0 0 1.8-1.4L20 8.5H6"/>',
  book: '<path d="M12 7.5v12"/><path d="M3.5 17V5.5a1 1 0 0 1 1-1h3.7a3.8 3.8 0 0 1 3.8 3.8 3.8 3.8 0 0 1 3.8-3.8h3.7a1 1 0 0 1 1 1V17a1 1 0 0 1-1 1h-4.4a3 3 0 0 0-3.1 2.4A3 3 0 0 0 8.9 18H4.5a1 1 0 0 1-1-1Z"/>',
  utensils:
    '<path d="M4 3v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V3"/><path d="M7 3v18"/><path d="M20 15V3a4 4 0 0 0-4 4v6a2 2 0 0 0 2 2h2Zm0 0v6"/>',
  coffee:
    '<path d="M16.5 8h1.5a3.5 3.5 0 1 1 0 7h-1.5"/><path d="M3.5 8h13v7a4 4 0 0 1-4 4h-5a4 4 0 0 1-4-4Z"/>',
  bank: '<path d="M4 21h16"/><path d="M6 21v-8M10 21v-8M14 21v-8M18 21v-8"/><path d="m12 3 8.5 6h-17Z"/>',
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z"/>',
  tree: '<path d="M12 3 7.5 9.5h2L5 15.5h5.5V21h3v-5.5H19l-4.5-6h2Z"/>',
  bus: '<rect x="4.5" y="3.5" width="15" height="13" rx="2"/><path d="M4.5 10.5h15"/><circle cx="8.5" cy="19.5" r="1.4"/><circle cx="15.5" cy="19.5" r="1.4"/>',
  bed: '<path d="M2.5 5v15"/><path d="M2.5 9.5H19a2.5 2.5 0 0 1 2.5 2.5v8"/><path d="M2.5 16.5h19"/><circle cx="6.5" cy="12.5" r="1.6"/>',
  fuel: '<path d="M4 21V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15"/><path d="M3 21h11"/><path d="M5 10h7"/><path d="M13 12h2a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0V9.8a2 2 0 0 0-.6-1.4L17.5 6"/>',
  ticket:
    '<path d="M3 8a2 2 0 0 0 0 8v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-8V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1Z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
};

/**
 * 전체 POI 카테고리 사전 — categories 옵션으로 골라 쓴다.
 * key 는 PoiLayer categories prop 에 문자열로 넘길 수 있는 id.
 */
export const POI_CATEGORIES: Record<string, PoiCategory> = {
  edu: {
    id: 'edu',
    label: '학교',
    classes: ['school', 'college', 'university', 'kindergarten'],
    color: '#6b7f9e',
    darkColor: '#95a5c2',
    iconPath: ICON.edu,
  },
  health: {
    id: 'health',
    label: '병원',
    classes: ['hospital', 'clinic', 'doctors', 'dentist'],
    color: '#d95757',
    darkColor: '#c97878',
    iconPath: ICON.cross,
  },
  pharmacy: {
    id: 'pharmacy',
    label: '약국',
    classes: ['pharmacy', 'chemist'],
    color: '#3ba272',
    darkColor: '#79b294',
    iconPath: ICON.pill,
    minzoom: 15,
  },
  market: {
    id: 'market',
    label: '마트',
    classes: ['grocery', 'supermarket', 'marketplace'],
    color: '#3f6fd8',
    darkColor: '#8fa3cd',
    iconPath: ICON.cart,
  },
  shop: {
    id: 'shop',
    label: '편의점',
    classes: ['shop', 'convenience'],
    color: '#3f6fd8',
    darkColor: '#8fa3cd',
    iconPath: ICON.cart,
    minzoom: 15,
  },
  food: {
    id: 'food',
    label: '음식점',
    classes: ['restaurant', 'fast_food', 'food_court'],
    color: '#e0762e',
    darkColor: '#c49a66',
    iconPath: ICON.utensils,
    minzoom: 15,
  },
  cafe: {
    id: 'cafe',
    label: '카페',
    classes: ['cafe', 'ice_cream', 'bakery'],
    color: '#a06a3c',
    darkColor: '#b3906c',
    iconPath: ICON.coffee,
    minzoom: 15,
  },
  culture: {
    id: 'culture',
    label: '문화',
    classes: ['museum', 'library', 'attraction', 'gallery', 'theatre', 'cinema', 'arts_centre'],
    color: '#a9812f',
    darkColor: '#b59d66',
    iconPath: ICON.book,
  },
  finance: {
    id: 'finance',
    label: '은행',
    classes: ['bank', 'atm'],
    color: '#4a7a5c',
    darkColor: '#8fae9d',
    iconPath: ICON.bank,
    minzoom: 15,
  },
  public: {
    id: 'public',
    label: '관공서',
    classes: ['police', 'townhall', 'post', 'post_office', 'fire_station', 'courthouse', 'embassy'],
    color: '#5f6b7a',
    darkColor: '#939eac',
    iconPath: ICON.shield,
  },
  park: {
    id: 'park',
    label: '공원',
    classes: ['park', 'garden', 'playground', 'dog_park', 'zoo', 'stadium', 'pitch', 'golf'],
    color: '#4f9153',
    darkColor: '#84ab89',
    iconPath: ICON.tree,
  },
  transit: {
    id: 'transit',
    label: '교통',
    classes: ['bus', 'bus_station', 'bus_stop', 'ferry_terminal'],
    color: '#3a7ca5',
    darkColor: '#84a6ba',
    iconPath: ICON.bus,
    minzoom: 15,
  },
  lodging: {
    id: 'lodging',
    label: '숙박',
    classes: ['lodging', 'hotel', 'hostel', 'guest_house', 'motel'],
    color: '#7c6bb0',
    darkColor: '#a695c8',
    iconPath: ICON.bed,
    minzoom: 15,
  },
  fuel: {
    id: 'fuel',
    label: '주유·주차',
    classes: ['fuel', 'charging_station', 'parking'],
    color: '#5f6b7a',
    darkColor: '#939eac',
    iconPath: ICON.fuel,
    minzoom: 15,
  },
  entertainment: {
    id: 'entertainment',
    label: '엔터',
    classes: ['entertainment', 'karaoke', 'casino', 'nightclub'],
    color: '#b0568f',
    darkColor: '#bd88ab',
    iconPath: ICON.ticket,
    minzoom: 15,
  },
};

/** 기본 노출 세트 — 생활 정보 밀도의 핵심(학교·병원·마트·편의점·문화) */
export const DEFAULT_POI_CATEGORY_IDS = ['edu', 'health', 'market', 'shop', 'culture'];

export interface PoiLayerOptions {
  theme?: Theme;
  /** 카테고리 id 목록 또는 커스텀 카테고리. 미지정 시 기본 세트 */
  categories?: (string | PoiCategory)[];
  /** POI 를 담은 벡터 소스 id — 미지정 시 carto → openmaptiles 순으로 자동 감지 */
  sourceId?: string;
  /** 벡터 소스 안의 POI source-layer 이름 (기본 'poi') */
  sourceLayer?: string;
  /**
   * 커스텀 POI GeoJSON — 기본지도 타일 대신 이 데이터를 그린다.
   * 공공데이터(상가정보)·Overture Places 등 더 정확한 소스를 꽂는 경로.
   * Feature properties: { name: string, category: 카테고리 id }
   */
  data?: GeoJSON.FeatureCollection;
}

const BADGE_PREFIX = 'jido-poibadge:';
const DATA_SOURCE = 'jido-poi-data';
const KNOWN_SOURCES = ['carto', 'openmaptiles'];

/** 색 원 + 흰 픽토그램 배지를 SVG → 캔버스 래스터라이즈로 만든다 (브라우저 전용) */
async function buildPoiBadge(category: PoiCategory, theme: Theme): Promise<ImageData | null> {
  if (typeof document === 'undefined') return null;
  const dpr = 2;
  const size = 16 * dpr;
  const margin = 2 * dpr;
  const canvas = document.createElement('canvas');
  canvas.width = size + margin * 2;
  canvas.height = size + margin * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.beginPath();
  ctx.arc(margin + size / 2, margin + size / 2, size / 2, 0, Math.PI * 2);
  // 라이트: 흰 배지 + 컬러 글리프 · 다크: 뮤트 톤 채움 + 흰 글리프
  ctx.fillStyle = theme === 'dark' ? category.darkColor : '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1.2 * dpr;
  ctx.strokeStyle = theme === 'dark' ? 'rgba(12,14,18,0.85)' : 'rgba(23,29,41,0.18)';
  ctx.stroke();

  const glyphColor = theme === 'dark' ? '#ffffff' : category.color;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${glyphColor}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${category.iconPath}</svg>`;
  const image = new window.Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  try {
    await image.decode();
  } catch {
    return null;
  }
  const iconSize = size * 0.6;
  const offset = margin + (size - iconSize) / 2;
  ctx.drawImage(image, offset, offset, iconSize, iconSize);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function resolveCategories(input?: (string | PoiCategory)[]): PoiCategory[] {
  const ids = input ?? DEFAULT_POI_CATEGORY_IDS;
  return ids.flatMap((entry) => {
    if (typeof entry !== 'string') return [entry];
    const found = POI_CATEGORIES[entry];
    return found ? [found] : [];
  });
}

function detectPoiSource(map: MaplibreMap, preferred?: string): string | undefined {
  if (preferred) return map.getSource(preferred) ? preferred : undefined;
  return KNOWN_SOURCES.find((id) => map.getSource(id));
}

/**
 * 학교·병원·마트·음식점 같은 생활 POI 를 카테고리 배지 + 한글 라벨로 그린다.
 * OpenMapTiles 스키마 스타일(CARTO voyager·positron, OpenFreeMap)에서 동작한다.
 */
export function addPoiLayers(map: MaplibreMap, options: PoiLayerOptions = {}): LayerHandle {
  const theme: Theme = options.theme ?? 'light';
  const categories = resolveCategories(options.categories);
  const sourceLayer = options.sourceLayer ?? 'poi';
  const layerIds = categories.map((category) => `jido-poi-${category.id}`);

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const onMissing = (event: { id: string }) => {
    if (!event.id.startsWith(BADGE_PREFIX) || map.hasImage(event.id)) return;
    // id 형식: jido-poibadge:<카테고리>:<테마>
    const [categoryId, badgeTheme] = event.id.slice(BADGE_PREFIX.length).split(':');
    const category = categoryById.get(categoryId ?? '');
    if (!category) return;
    void buildPoiBadge(category, badgeTheme === 'dark' ? 'dark' : 'light').then((image) => {
      if (image && !map.hasImage(event.id)) map.addImage(event.id, image, { pixelRatio: 2 });
    });
  };
  map.on('styleimagemissing', onMissing);

  const usesCustomData = Boolean(options.data);

  const remove = () => {
    map.off('styleimagemissing', onMissing);
    // 맵이 이미 파괴됐거나(map.remove) 스타일 교체 중이면 조용히 끝낸다
    try {
      for (const id of layerIds) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (usesCustomData && map.getSource(DATA_SOURCE)) map.removeSource(DATA_SOURCE);
    } catch {
      // no-op
    }
  };

  // 커스텀 데이터 모드: 기본지도 타일 대신 주입된 GeoJSON 을 그린다 (정확도 개선 경로)
  let sourceId: string | undefined;
  if (options.data) {
    if (!map.getSource(DATA_SOURCE)) {
      map.addSource(DATA_SOURCE, { type: 'geojson', data: options.data });
    }
    sourceId = DATA_SOURCE;
  } else {
    // POI 벡터 소스가 없는 스타일(blank 등)이면 조용히 넘어간다
    sourceId = detectPoiSource(map, options.sourceId);
  }
  if (!sourceId) return { remove };

  for (const category of categories) {
    const layerId = `jido-poi-${category.id}`;
    if (map.getLayer(layerId)) continue;
    map.addLayer({
      id: layerId,
      type: 'symbol',
      source: sourceId,
      ...(usesCustomData ? {} : { 'source-layer': sourceLayer }),
      minzoom: category.minzoom ?? 14,
      // 커스텀 데이터는 category 속성, 타일은 class/subclass 로 매칭 (provider 편차 흡수)
      filter: usesCustomData
        ? ['all', ['==', ['get', 'category'], category.id], ['has', 'name']]
        : [
            'all',
            [
              'any',
              ['in', ['get', 'class'], ['literal', category.classes]],
              ['in', ['coalesce', ['get', 'subclass'], ''], ['literal', category.classes]],
            ],
            ['has', 'name'],
          ],
      layout: {
        'icon-image': `${BADGE_PREFIX}${category.id}:${theme}`,
        'text-field': ['coalesce', ['get', 'name:ko'], ['get', 'name'], ['get', 'name_en']],
        'text-font': MAP_FONT,
        'text-size': 10.5,
        'text-max-width': 8,
        'text-anchor': 'top',
        'text-offset': [0, 1.1],
        'text-optional': true,
      },
      paint: {
        'text-color': theme === 'dark' ? category.darkColor : category.color,
        'text-halo-color': theme === 'dark' ? '#14161a' : '#ffffff',
        'text-halo-width': 1.1,
      },
    });
  }

  return { remove };
}
