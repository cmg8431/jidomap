import { seoulSubway } from '@jidomap/data';
import { haversineMeters, MapPopup, useMap } from '@jidomap/react';
import type { GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';

/* ── 실시간 버스·지하철 목업 ─────────────────────────────────
 * 실데이터 API가 있다고 가정하고, 노선 지오메트리 위에서 차량을
 * 시뮬레이션해 GeoJSON 소스 setData 로 60fps 갱신한다.
 * 클릭 → 차량 팝업(속도·다음 정차·혼잡도), 따라가기 지원.
 * ──────────────────────────────────────────────────────── */

type LngLat = [number, number];

const SRC = 'live-vehicles';
const L_GLOW = 'live-veh-glow';
const L_DOT = 'live-veh-dot';
const L_RING = 'live-veh-ring';
const L_LABEL = 'live-veh-label';
const ALL_LAYERS = [L_GLOW, L_DOT, L_RING, L_LABEL];

/** ClickInspector 등 외부에서 차량 클릭을 구분할 때 쓰는 히트 레이어 */
export const LIVE_VEHICLE_LAYER = L_DOT;

/** CARTO 계열 스타일 공통 글리프 스택 (core MAP_FONT 와 동일) */
const FONT = [
  'Montserrat Medium',
  'Open Sans Bold',
  'Noto Sans Regular',
  'HanWangHeiLight Regular',
  'NanumBarunGothic Regular',
];

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/* ── 경로·정차 모델 ── */

interface Path {
  coords: LngLat[];
  /** 각 정점까지의 누적 거리(m) */
  cum: number[];
  total: number;
}

interface Stop {
  name: string;
  offset: number;
}

interface Vehicle {
  id: string;
  kind: 'subway' | 'bus';
  ref: string;
  colour: string;
  vehicleNo: string;
  path: Path;
  /** offset 오름차순 정렬 */
  stops: Stop[];
  loop: boolean;
  offset: number;
  dir: 1 | -1;
  /** 기준 속도 m/s */
  speed: number;
  /** 표시용 현재 속도 m/s */
  curSpeed: number;
  dwellUntil: number;
  seed: number;
  congBase: number;
}

function buildPath(coords: LngLat[]): Path {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const here = coords[i];
    cum.push((cum[i - 1] ?? 0) + (prev && here ? haversineMeters(prev, here) : 0));
  }
  return { coords, cum, total: cum[cum.length - 1] ?? 0 };
}

function pointAt(path: Path, offset: number): LngLat {
  const { coords, cum, total } = path;
  const first = coords[0] ?? [0, 0];
  const last = coords[coords.length - 1] ?? first;
  if (offset <= 0) return first;
  if (offset >= total) return last;
  let lo = 0;
  let hi = cum.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if ((cum[mid] ?? 0) <= offset) lo = mid;
    else hi = mid;
  }
  const a = coords[lo] ?? first;
  const b = coords[hi] ?? last;
  const segLen = (cum[hi] ?? 0) - (cum[lo] ?? 0);
  const t = segLen > 0 ? (offset - (cum[lo] ?? 0)) / segLen : 0;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** 결정적 의사난수 — 리렌더에도 차량 배치가 흔들리지 않게 */
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ── 목업 버스 노선 (실제 도로 대략을 따라 손으로 딴 경유지) ── */

const BUS_ROUTES: { ref: string; colour: string; stops: { name: string; at: LngLat }[] }[] = [
  {
    ref: '470',
    colour: '#3D5BAB',
    stops: [
      { name: '양재역', at: [127.0344, 37.4837] },
      { name: '강남역', at: [127.0276, 37.4979] },
      { name: '신논현역', at: [127.0252, 37.5045] },
      { name: '논현역', at: [127.0219, 37.5109] },
      { name: '신사역', at: [127.0203, 37.5163] },
      { name: '한남대교', at: [127.0102, 37.527] },
      { name: '순천향대병원', at: [127.0058, 37.5338] },
      { name: '이태원역', at: [126.9942, 37.5345] },
      { name: '녹사평역', at: [126.9868, 37.534] },
      { name: '삼각지역', at: [126.9737, 37.5346] },
      { name: '서울역', at: [126.9723, 37.5559] },
      { name: '시청앞', at: [126.9769, 37.5648] },
      { name: '광화문', at: [126.9769, 37.5716] },
    ],
  },
  {
    ref: '273',
    colour: '#3D5BAB',
    stops: [
      { name: '동대문역', at: [127.0093, 37.5714] },
      { name: '종로5가', at: [126.9987, 37.5708] },
      { name: '종로3가', at: [126.992, 37.5704] },
      { name: '종각', at: [126.9832, 37.57] },
      { name: '광화문', at: [126.9769, 37.5716] },
      { name: '서대문역', at: [126.9668, 37.5657] },
      { name: '충정로역', at: [126.9637, 37.5599] },
      { name: '아현역', at: [126.956, 37.5573] },
      { name: '이대역', at: [126.9463, 37.5567] },
      { name: '신촌역', at: [126.9366, 37.5551] },
      { name: '홍대입구역', at: [126.9237, 37.557] },
    ],
  },
  {
    ref: '5615',
    colour: '#5BB025',
    stops: [
      { name: '여의도환승센터', at: [126.9243, 37.5219] },
      { name: '여의도공원', at: [126.915, 37.5235] },
      { name: '영등포시장', at: [126.9048, 37.5227] },
      { name: '영등포역', at: [126.9074, 37.5157] },
      { name: '문래동사거리', at: [126.9005, 37.512] },
      { name: '신도림역', at: [126.8912, 37.5089] },
    ],
  },
  {
    ref: '9401',
    colour: '#E60012',
    stops: [
      { name: '강남역', at: [127.0276, 37.4979] },
      { name: '양재역', at: [127.0344, 37.4837] },
      { name: '시민의숲', at: [127.035, 37.47] },
      { name: '청계산입구', at: [127.055, 37.447] },
      { name: '금토JC', at: [127.08, 37.42] },
      { name: '판교역', at: [127.1115, 37.3948] },
    ],
  },
];

/* ── 차량 플릿 생성 ── */

function buildFleet(): Vehicle[] {
  const vehicles: Vehicle[] = [];
  let n = 0;

  // 지하철 — 노선 지오메트리 세그먼트마다 길이 비례로 열차 배치
  for (const feature of seoulSubway.lines.features) {
    const { ref, colour } = feature.properties;
    const lineStations = seoulSubway.stations.features.filter((s) =>
      s.properties.refs.split('·').includes(ref),
    );
    for (const segment of feature.geometry.coordinates) {
      const path = buildPath(segment as LngLat[]);
      if (path.total < 2500) continue;

      // 역 → 경로 최근접 정점 투영으로 정차 오프셋 계산
      const stops: Stop[] = [];
      for (const station of lineStations) {
        const pt = station.geometry.coordinates as LngLat;
        let bestIdx = -1;
        let bestDist = Number.POSITIVE_INFINITY;
        for (let i = 0; i < path.coords.length; i++) {
          const c = path.coords[i];
          if (!c) continue;
          const d = haversineMeters(c, pt);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0 && bestDist < 450) {
          stops.push({ name: station.properties.name, offset: path.cum[bestIdx] ?? 0 });
        }
      }
      stops.sort((a, b) => a.offset - b.offset);

      const head = path.coords[0];
      const tail = path.coords[path.coords.length - 1];
      const loop = !!head && !!tail && haversineMeters(head, tail) < 80;
      const count = Math.min(6, Math.max(1, Math.round(path.total / 9000)));
      for (let i = 0; i < count; i++) {
        n++;
        vehicles.push({
          id: `sub-${ref}-${n}`,
          kind: 'subway',
          ref,
          colour,
          vehicleNo: `${2000 + n * 2}편성`,
          path,
          stops,
          loop,
          offset: (path.total * (i + 0.3)) / count,
          dir: i % 2 === 0 ? 1 : -1,
          speed: 16 + seeded(n) * 6, // 58~79km/h
          curSpeed: 0,
          dwellUntil: 0,
          seed: seeded(n * 3 + 1),
          congBase: 0.25 + seeded(n * 7 + 2) * 0.55,
        });
      }
    }
  }

  // 버스 — 목업 노선마다 3대씩 양방향
  for (const route of BUS_ROUTES) {
    const path = buildPath(route.stops.map((s) => s.at));
    const stops: Stop[] = route.stops.map((s, i) => ({
      name: s.name,
      offset: path.cum[i] ?? 0,
    }));
    for (let i = 0; i < 3; i++) {
      n++;
      vehicles.push({
        id: `bus-${route.ref}-${i}`,
        kind: 'bus',
        ref: route.ref,
        colour: route.colour,
        vehicleNo: `서울74사 ${1200 + Math.floor(seeded(n) * 8000)}`,
        path,
        stops,
        loop: false,
        offset: (path.total * (i + 0.5)) / 3,
        dir: i % 2 === 0 ? 1 : -1,
        speed: 7 + seeded(n * 5) * 4, // 25~40km/h
        curSpeed: 0,
        dwellUntil: 0,
        seed: seeded(n * 3 + 1),
        congBase: 0.2 + seeded(n * 7 + 2) * 0.6,
      });
    }
  }
  return vehicles;
}

/* ── 시뮬레이션 한 틱 ── */

function advance(v: Vehicle, sdt: number, simNow: number) {
  if (simNow < v.dwellUntil) {
    v.curSpeed = 0;
    return;
  }
  const speed = v.speed * (0.88 + 0.24 * Math.sin(simNow * 0.05 + v.seed * 40));
  const prev = v.offset;
  v.offset += speed * sdt * v.dir;
  v.curSpeed = speed;

  // 순환선은 이어달리고, 아니면 종점에서 회차
  if (v.loop) {
    if (v.offset >= v.path.total) v.offset -= v.path.total;
    else if (v.offset < 0) v.offset += v.path.total;
  } else if (v.offset >= v.path.total) {
    v.offset = v.path.total;
    v.dir = -1;
    v.dwellUntil = simNow + 18;
    return;
  } else if (v.offset <= 0) {
    v.offset = 0;
    v.dir = 1;
    v.dwellUntil = simNow + 18;
    return;
  }

  // 이번 틱에 지나친 정차 지점이 있으면 거기 세운다
  const lo = Math.min(prev, v.offset);
  const hi = Math.max(prev, v.offset);
  if (hi - lo > v.path.total / 2) return; // 순환 랩 순간은 건너뜀
  const hit = v.stops.find((s) => s.offset > lo + 0.01 && s.offset <= hi);
  if (hit) {
    v.offset = hit.offset;
    v.dwellUntil = simNow + (v.kind === 'subway' ? 9 : 6) * (0.8 + v.seed * 0.5);
  }
}

function nextStopOf(v: Vehicle): string {
  const next =
    v.dir === 1
      ? v.stops.find((s) => s.offset > v.offset + 1)
      : [...v.stops].reverse().find((s) => s.offset < v.offset - 1);
  return next?.name ?? '종점';
}

function destOf(v: Vehicle): string {
  if (v.loop) return '순환';
  const terminal = v.dir === 1 ? v.stops[v.stops.length - 1] : v.stops[0];
  return terminal ? `${terminal.name}행` : '회송';
}

function congestionOf(v: Vehicle, simNow: number): number {
  const raw = v.congBase + 0.22 * Math.sin(simNow * 0.02 + v.seed * 60);
  return Math.min(1, Math.max(0.05, raw));
}

/* ── 컴포넌트 ── */

interface LiveInfo {
  id: string;
  lng: number;
  lat: number;
  kind: 'subway' | 'bus';
  ref: string;
  colour: string;
  vehicleNo: string;
  dest: string;
  nextStop: string;
  speedKmh: number;
  dwelling: boolean;
  congestion: number;
}

export type LiveTransitProps = {
  showSubway?: boolean;
  showBus?: boolean;
  /** 시뮬레이션 배속 — 1이면 실속도(지도에선 거의 안 움직임) */
  timeScale?: number;
};

export function LiveTransit({
  showSubway = true,
  showBus = true,
  timeScale = 6,
}: LiveTransitProps) {
  const { map, isLoaded, resolvedTheme, styleEpoch } = useMap();
  const vehicles = useMemo(buildFleet, []);
  const simRef = useRef(0);
  const selectedRef = useRef<string | null>(null);
  const followRef = useRef(false);
  const [selected, setSelected] = useState<LiveInfo | null>(null);
  const [follow, setFollow] = useState(false);

  const subCount = useMemo(() => vehicles.filter((v) => v.kind === 'subway').length, [vehicles]);
  const busCount = vehicles.length - subCount;

  // 소스·레이어 장착 — 스타일 재빌드(styleEpoch)마다 다시
  useEffect(() => {
    if (!isLoaded || !map) return;
    if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: EMPTY_FC });
    const halo = resolvedTheme === 'dark' ? '#101013' : '#ffffff';
    if (!map.getLayer(L_GLOW)) {
      map.addLayer({
        id: L_GLOW,
        type: 'circle',
        source: SRC,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 15],
          'circle-color': ['get', 'colour'],
          'circle-blur': 1,
          'circle-opacity': 0.35,
        },
      });
      map.addLayer({
        id: L_DOT,
        type: 'circle',
        source: SRC,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.2, 14, 7],
          'circle-color': ['get', 'colour'],
          'circle-stroke-color': halo,
          'circle-stroke-width': 1.6,
        },
      });
      map.addLayer({
        id: L_RING,
        type: 'circle',
        source: SRC,
        filter: ['==', ['get', 'id'], selectedRef.current ?? ''],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 13],
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': ['get', 'colour'],
          'circle-stroke-width': 2,
          'circle-stroke-opacity': 0.9,
        },
      });
      map.addLayer({
        id: L_LABEL,
        type: 'symbol',
        source: SRC,
        minzoom: 12,
        layout: {
          'text-field': ['get', 'ref'],
          'text-font': FONT,
          'text-size': 10,
          'text-anchor': 'top',
          'text-offset': [0, 0.9],
        },
        paint: {
          'text-color': ['get', 'colour'],
          'text-halo-color': halo,
          'text-halo-width': 1.2,
        },
      });
    }
    return () => {
      try {
        for (const id of ALL_LAYERS) if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch {
        // 스타일 교체·맵 파괴 중이면 이미 정리된 상태
      }
    };
  }, [isLoaded, map, resolvedTheme, styleEpoch]);

  // 클릭 → 선택, 호버 → 포인터, 드래그 → 따라가기 해제 (레이어 위임이라 1회 등록)
  useEffect(() => {
    if (!isLoaded || !map) return;
    const onClick = (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id;
      if (typeof id !== 'string') return;
      selectedRef.current = id;
      if (map.getLayer(L_RING)) map.setFilter(L_RING, ['==', ['get', 'id'], id]);
    };
    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = '';
    };
    const onDrag = () => {
      followRef.current = false;
      setFollow(false);
    };
    map.on('click', L_DOT, onClick);
    map.on('mouseenter', L_DOT, onEnter);
    map.on('mouseleave', L_DOT, onLeave);
    map.on('dragstart', onDrag);
    return () => {
      map.off('click', L_DOT, onClick);
      map.off('mouseenter', L_DOT, onEnter);
      map.off('mouseleave', L_DOT, onLeave);
      map.off('dragstart', onDrag);
    };
  }, [isLoaded, map]);

  // 시뮬레이션 루프 — rAF 마다 위치 갱신 → setData
  useEffect(() => {
    if (!isLoaded || !map) return;
    let raf = 0;
    let last = performance.now();
    let lastPopup = 0;
    let frame = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      simRef.current += dt * timeScale;
      const simNow = simRef.current;

      const features: GeoJSON.Feature[] = [];
      let selectedInfo: LiveInfo | null = null;
      for (const v of vehicles) {
        advance(v, dt * timeScale, simNow);
        const visible = v.kind === 'subway' ? showSubway : showBus;
        if (!visible) continue;
        const [lng, lat] = pointAt(v.path, v.offset);
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: { id: v.id, kind: v.kind, ref: v.ref, colour: v.colour },
        });
        if (v.id === selectedRef.current) {
          selectedInfo = {
            id: v.id,
            lng,
            lat,
            kind: v.kind,
            ref: v.ref,
            colour: v.colour,
            vehicleNo: v.vehicleNo,
            dest: destOf(v),
            nextStop: nextStopOf(v),
            speedKmh: Math.round(v.curSpeed * 3.6),
            dwelling: simNow < v.dwellUntil,
            congestion: congestionOf(v, simNow),
          };
        }
      }

      try {
        const source = map.getSource(SRC) as GeoJSONSource | undefined;
        source?.setData({ type: 'FeatureCollection', features });
        // 다른 레이어가 나중에 얹혀도 차량은 항상 맨 위에
        frame++;
        if (frame % 180 === 0) {
          for (const id of ALL_LAYERS) if (map.getLayer(id)) map.moveLayer(id);
        }
      } catch {
        return; // 맵 파괴 중
      }

      if (selectedRef.current && !selectedInfo) {
        // 필터로 숨겨진 차량 — 선택 해제
        selectedRef.current = null;
        setSelected(null);
      } else if (selectedInfo && now - lastPopup > 150) {
        lastPopup = now;
        setSelected(selectedInfo);
        if (followRef.current) {
          map.easeTo({ center: [selectedInfo.lng, selectedInfo.lat], duration: 200 });
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isLoaded, map, vehicles, timeScale, showSubway, showBus]);

  const closePopup = () => {
    selectedRef.current = null;
    followRef.current = false;
    setSelected(null);
    setFollow(false);
    if (map?.getLayer(L_RING)) map.setFilter(L_RING, ['==', ['get', 'id'], '']);
  };

  const congestion = selected ? congestionLabel(selected.congestion) : null;
  const visibleCount = (showSubway ? subCount : 0) + (showBus ? busCount : 0);

  return (
    <>
      <span className="live-badge">
        <i className="live-badge__dot" />
        LIVE · 차량 {visibleCount}대 · {timeScale}×
      </span>

      {selected && (
        <MapPopup
          longitude={selected.lng}
          latitude={selected.lat}
          closeButton
          offset={14}
          onClose={closePopup}
        >
          <p className="popup-title">
            <b style={{ color: selected.colour }}>
              {selected.kind === 'subway' ? lineName(selected.ref) : `${selected.ref}번 버스`}
            </b>{' '}
            {selected.dest}
          </p>
          <div className="popup-row">
            <span>차량</span>
            <span>{selected.vehicleNo}</span>
          </div>
          <div className="popup-row">
            <span>상태</span>
            <span>{selected.dwelling ? '정차 중' : `${selected.speedKmh} km/h`}</span>
          </div>
          <div className="popup-row">
            <span>다음 정차</span>
            <span>{selected.nextStop}</span>
          </div>
          {congestion && (
            <div className="popup-row">
              <span>혼잡도</span>
              <span className="congestion" style={{ color: congestion.color }}>
                <span className="congestion__track">
                  <span
                    className="congestion__fill"
                    style={{
                      width: `${Math.round(selected.congestion * 100)}%`,
                      background: congestion.color,
                    }}
                  />
                </span>
                {congestion.label}
              </span>
            </div>
          )}
          <button
            type="button"
            className="popup-follow"
            data-active={follow}
            onClick={() => {
              followRef.current = !followRef.current;
              setFollow(followRef.current);
            }}
          >
            {follow ? '따라가기 해제' : '이 차량 따라가기'}
          </button>
          <p className="popup-hint">mock 실시간 · GeoJSON setData @60fps</p>
        </MapPopup>
      )}
    </>
  );
}

function lineName(ref: string): string {
  return /^\d+$/.test(ref) ? `${ref}호선` : `${ref}선`;
}

function congestionLabel(value: number): { label: string; color: string } {
  if (value < 0.38) return { label: '여유', color: '#00a76f' };
  if (value < 0.7) return { label: '보통', color: '#f59e0b' };
  return { label: '혼잡', color: '#e8467c' };
}
