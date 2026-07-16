import { seoulSubway } from '@jidomap/data';
import {
  BrandTone,
  KoreanLabels,
  Map,
  MapCircle,
  MapControls,
  MapGeoJSON,
  MapPopup,
  MapRoute,
  type MapViewport,
  Marker,
  MarkerContent,
  MarkerTooltip,
  nearbyStations,
  POI_CATEGORIES,
  PoiLayer,
  STYLE_PRESETS,
  SubwayLayer,
  TransportEmphasis,
  useMap,
} from '@jidomap/react';
import '@jidomap/react/styles.css';
import type { Map as MaplibreMap, MapMouseEvent } from 'maplibre-gl';
import {
  type CSSProperties,
  type ReactNode,
  type SVGProps,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LIVE_VEHICLE_LAYER, LiveTransit } from './live-transit';

/* ── 데모 데이터: 서울 랜드마크 ── */

const LANDMARKS = [
  { id: 'palace', name: '경복궁', lng: 126.977, lat: 37.5796 },
  { id: 'namsan', name: 'N서울타워', lng: 126.9882, lat: 37.5512 },
  { id: 'hangang', name: '여의도한강공원', lng: 126.9326, lat: 37.5285 },
  { id: 'lotte', name: '롯데월드타워', lng: 127.1025, lat: 37.5126 },
];
type Landmark = (typeof LANDMARKS)[number];
type Station = (typeof seoulSubway.stations.features)[number];

const STYLE_OPTIONS = [
  { key: 'positron', label: 'Positron' },
  { key: 'voyager', label: 'Voyager' },
  { key: 'liberty', label: 'Liberty' },
  { key: 'bright', label: 'Bright' },
] as const;
type StyleKey = (typeof STYLE_OPTIONS)[number]['key'];

/** 각 스타일의 다크 변형 — 다크 테마에서도 스타일 선택이 살아있다 */
const DARK_VARIANT: Record<StyleKey, keyof typeof STYLE_PRESETS> = {
  positron: 'dark',
  voyager: 'dark',
  liberty: 'ofm-dark',
  bright: 'fiord',
};

const ACCENTS = ['#2272eb', '#00a76f', '#ff6f0f', '#7c3aed', '#e8467c'];

const INITIAL_VIEW = { center: [126.9965, 37.5445] as [number, number], zoom: 11.8 };

/* ── 아이콘 ── */

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1em"
      height="1em"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}
const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="7" />
    <path d="m20.5 20.5-4.5-4.5" />
  </Icon>
);
const PhoneIcon = () => (
  <Icon>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </Icon>
);
const MonitorIcon = () => (
  <Icon>
    <rect x="2.5" y="4" width="19" height="13" rx="2" />
    <path d="M9 21h6M12 17v4" />
  </Icon>
);
const PlayIcon = () => (
  <Icon>
    <path d="M7 4.5v15l12-7.5Z" />
  </Icon>
);
const StopIcon = () => (
  <Icon>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </Icon>
);

/* ── 지도 클릭 → 주변 지하철 + 도보 반경 ── */

function ClickInspector() {
  const { map, isLoaded } = useMap();
  const [picked, setPicked] = useState<{ lng: number; lat: number } | null>(null);

  useEffect(() => {
    if (!isLoaded || !map) return;
    const handleClick = (event: MapMouseEvent) => {
      const el = event.originalEvent.target as HTMLElement;
      if (el.closest('.jido-marker')) return;
      // 실시간 차량 클릭은 차량 팝업이 받는다
      if (map.getLayer(LIVE_VEHICLE_LAYER)) {
        const { x, y } = event.point;
        const hits = map.queryRenderedFeatures(
          [
            [x - 6, y - 6],
            [x + 6, y + 6],
          ],
          { layers: [LIVE_VEHICLE_LAYER] },
        );
        if (hits.length > 0) return;
      }
      setPicked({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [isLoaded, map]);

  if (!picked) return null;
  const stations = nearbyStations(seoulSubway.stations, [picked.lng, picked.lat]);
  return (
    <>
      <MapCircle longitude={picked.lng} latitude={picked.lat} radius={800} opacity={0.07} />
      <MapPopup
        longitude={picked.lng}
        latitude={picked.lat}
        closeButton
        onClose={() => setPicked(null)}
      >
        <p className="popup-title">이 위치 주변</p>
        {stations.length === 0 && <div className="popup-row">도보 25분 내 지하철역이 없어요</div>}
        {stations.map((station) => (
          <div key={station.name} className="popup-row">
            <span>
              <b style={{ color: station.colour }}>{station.refs}</b> {station.name}
            </span>
            <span>도보 {station.walkMin}분</span>
          </div>
        ))}
        <p className="popup-hint">nearbyStations() + &lt;MapCircle /&gt;</p>
      </MapPopup>
    </>
  );
}

/* ── 컨트롤 조각 ── */

function Switch({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-on={on}
      onClick={() => onChange(!on)}
      className="sw"
    >
      <span className="sw__knob" />
    </button>
  );
}

function Row({
  label,
  code,
  on,
  onChange,
  children,
}: {
  label: string;
  code: string;
  on: boolean;
  onChange: (next: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="row-wrap" data-on={on}>
      <div className="row">
        <span className="row__text">
          <span className="row__label">{label}</span>
          <code className="row__code">{code}</code>
        </span>
        <Switch on={on} onChange={onChange} />
      </div>
      {on && children}
    </div>
  );
}

function SearchBox({
  query,
  setQuery,
  onPick,
}: {
  query: string;
  setQuery: (q: string) => void;
  onPick: (s: Station) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return seoulSubway.stations.features
      .filter((f) => f.properties.name.includes(trimmed))
      .slice(0, 6);
  }, [query]);

  // ⌘K / Ctrl+K → 검색 포커스
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="search">
      <span className="search__icon">
        <SearchIcon />
      </span>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="지하철역 검색"
        aria-label="지하철역 검색"
      />
      <kbd className="search__kbd">⌘K</kbd>
      {results.length > 0 && (
        <ul className="search__results">
          {results.map((station) => (
            <li key={`${station.properties.name}-${station.properties.refs}`}>
              <button type="button" onClick={() => onPick(station)}>
                <b style={{ color: station.properties.colour }}>{station.properties.refs}</b>
                {station.properties.name}
                {station.properties.transfer === 1 && <em>환승</em>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── 앱 ── */

export function App() {
  const mapRef = useRef<MaplibreMap>(null);
  const [mobile, setMobile] = useState(false);
  // 시스템 선호를 초기값으로 — 이후엔 토글로 제어
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  );
  const [styleKey, setStyleKey] = useState<StyleKey>('positron');
  const [accent, setAccent] = useState(ACCENTS[0] ?? '#2272eb');
  const [subway, setSubway] = useState(true);
  const [poi, setPoi] = useState(true);
  const [activeCategories, setActiveCategories] = useState<string[]>(['market', 'shop', 'health']);
  const [boundaries, setBoundaries] = useState(false);
  const [sido, setSido] = useState<GeoJSON.FeatureCollection | null>(null);
  const [markers, setMarkers] = useState(true);
  const [route, setRoute] = useState(false);
  const [transport, setTransport] = useState(true);
  const [live, setLive] = useState(true);
  const [liveSubway, setLiveSubway] = useState(true);
  const [liveBus, setLiveBus] = useState(true);
  const [liveSpeed, setLiveSpeed] = useState(6);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [selected, setSelected] = useState<Landmark | null>(null);
  const [focusStation, setFocusStation] = useState<Station | null>(null);
  const [query, setQuery] = useState('');
  const [touring, setTouring] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  // 시도 경계는 1.7MB — 켤 때만 지연 로드
  useEffect(() => {
    if (!boundaries || sido) return;
    import('@jidomap/data/boundaries/sido.json').then((mod) => {
      setSido(mod.default as unknown as GeoJSON.FeatureCollection);
    });
  }, [boundaries, sido]);

  // 랜드마크 투어 — flyTo 로 서울 한 바퀴
  useEffect(() => {
    if (!touring) return;
    let index = 0;
    const fly = () => {
      const landmark = LANDMARKS[index];
      if (!landmark) return;
      setSelected(landmark);
      mapRef.current?.flyTo({
        center: [landmark.lng, landmark.lat],
        zoom: 14.6,
        pitch: 40,
        duration: 2400,
        essential: true,
      });
    };
    fly();
    const timer = setInterval(() => {
      index += 1;
      if (index >= LANDMARKS.length) {
        setTouring(false);
        setSelected(null);
        mapRef.current?.flyTo({ ...INITIAL_VIEW, pitch: 0, duration: 2000 });
        return;
      }
      fly();
    }, 3400);
    return () => clearInterval(timer);
  }, [touring]);

  // 디버그 — 콘솔에서 __map 으로 원본 인스턴스 접근
  useEffect(() => {
    Object.assign(window, { __map: mapRef.current });
  });

  const goToStation = (station: Station) => {
    const [lng, lat] = station.geometry.coordinates;
    setFocusStation(station);
    setQuery('');
    mapRef.current?.flyTo({ center: [lng ?? 0, lat ?? 0], zoom: 15, duration: 900 });
  };
  const toggleCategory = (id: string) =>
    setActiveCategories((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));

  const zoom = viewport?.zoom ?? INITIAL_VIEW.zoom;
  const center = viewport?.center ?? INITIAL_VIEW.center;

  /* POI 카테고리 칩 */
  const categoryChips = (
    <div className="cat-chips">
      {Object.values(POI_CATEGORIES).map((category) => (
        <button
          key={category.id}
          type="button"
          data-active={activeCategories.includes(category.id)}
          style={{ '--chip': category.color } as CSSProperties}
          onClick={() => toggleCategory(category.id)}
          className="cat-chip"
        >
          {category.label}
        </button>
      ))}
    </div>
  );

  /* 지도 본체 */
  const mapStage = (
    <Map
      ref={mapRef}
      theme={theme}
      tokens={{ accent, marker: accent }}
      styles={{ light: STYLE_PRESETS[styleKey], dark: STYLE_PRESETS[DARK_VARIANT[styleKey]] }}
      center={INITIAL_VIEW.center}
      zoom={INITIAL_VIEW.zoom}
      maxBounds={[
        [123.5, 32.8],
        [132.5, 39.8],
      ]}
      onViewportChange={setViewport}
    >
      <KoreanLabels />
      <BrandTone />
      {transport && <TransportEmphasis />}
      {subway && <SubwayLayer data={seoulSubway} />}
      {live && <LiveTransit showSubway={liveSubway} showBus={liveBus} timeScale={liveSpeed} />}
      {poi && activeCategories.length > 0 && <PoiLayer categories={activeCategories} />}
      {boundaries && sido && (
        <MapGeoJSON
          data={sido}
          fillPaint={{ 'fill-color': accent, 'fill-opacity': 0.04 }}
          linePaint={{ 'line-color': accent, 'line-width': 1.2, 'line-opacity': 0.55 }}
        />
      )}
      {route && (
        <MapRoute
          coordinates={LANDMARKS.map((l) => [l.lng, l.lat])}
          color={accent}
          width={3.5}
          dashArray={[2, 1.6]}
        />
      )}

      {markers &&
        LANDMARKS.map((landmark) => (
          <Marker
            key={landmark.id}
            longitude={landmark.lng}
            latitude={landmark.lat}
            onClick={() => setSelected(landmark)}
          >
            <MarkerContent>
              <span className="lm-pin" data-selected={selected?.id === landmark.id}>
                <span className="lm-pin__core" />
              </span>
            </MarkerContent>
            <MarkerTooltip>{landmark.name}</MarkerTooltip>
          </Marker>
        ))}

      {selected && (
        <MapPopup
          longitude={selected.lng}
          latitude={selected.lat}
          closeButton
          offset={20}
          onClose={() => setSelected(null)}
        >
          <p className="popup-title">{selected.name}</p>
          {nearbyStations(seoulSubway.stations, [selected.lng, selected.lat], { limit: 2 }).map(
            (station) => (
              <div key={station.name} className="popup-row">
                <span>
                  <b style={{ color: station.colour }}>{station.refs}</b> {station.name}
                </span>
                <span>도보 {station.walkMin}분</span>
              </div>
            ),
          )}
          <p className="popup-hint">&lt;Marker /&gt; + &lt;MapPopup /&gt;</p>
        </MapPopup>
      )}

      {focusStation && (
        <MapPopup
          longitude={focusStation.geometry.coordinates[0] ?? 0}
          latitude={focusStation.geometry.coordinates[1] ?? 0}
          closeButton
          offset={10}
          onClose={() => setFocusStation(null)}
        >
          <p className="popup-title">
            <b style={{ color: focusStation.properties.colour }}>{focusStation.properties.refs}</b>{' '}
            {focusStation.properties.name}
          </p>
          <div className="popup-row">
            <span>환승</span>
            <span>{focusStation.properties.transfer === 1 ? '환승역' : '일반역'}</span>
          </div>
        </MapPopup>
      )}

      <MapControls showZoom showCompass showLocate showFullscreen={!mobile} />
      <ClickInspector />

      <span className="readout">
        {zoom.toFixed(2)}z · {center[0].toFixed(3)}, {center[1].toFixed(3)}
      </span>
    </Map>
  );

  /* 패널 본문 — 데스크톱/모바일 공용 */
  const controls = (
    <>
      <section className="sec">
        <h3 className="sec__title">지도 스타일</h3>
        <div className="tgroup">
          {STYLE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              data-active={styleKey === option.key}
              onClick={() => setStyleKey(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="sec">
        <h3 className="sec__title">테마 · 토큰</h3>
        <div className="theme-row">
          <div className="tgroup tgroup--inline">
            <button type="button" data-active={theme === 'light'} onClick={() => setTheme('light')}>
              라이트
            </button>
            <button type="button" data-active={theme === 'dark'} onClick={() => setTheme('dark')}>
              다크
            </button>
          </div>
          <div className="dots">
            {ACCENTS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`포인트 컬러 ${color}`}
                data-active={accent === color}
                style={{ background: color }}
                onClick={() => setAccent(color)}
                className="dot"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <h3 className="sec__title">한국 레이어</h3>
        <Row label="지하철 노선·역·출구" code="<SubwayLayer />" on={subway} onChange={setSubway} />
        <Row
          label="철도·고속도로 강조"
          code="<TransportEmphasis />"
          on={transport}
          onChange={setTransport}
        />
        <Row label="생활 POI" code="<PoiLayer />" on={poi} onChange={setPoi}>
          {categoryChips}
        </Row>
        <Row label="시도 경계" code="<MapGeoJSON />" on={boundaries} onChange={setBoundaries} />
      </section>

      <section className="sec">
        <h3 className="sec__title">실시간 (mock)</h3>
        <Row label="버스·지하철 위치" code="<LiveTransit />" on={live} onChange={setLive}>
          <div className="cat-chips">
            <button
              type="button"
              data-active={liveSubway}
              style={{ '--chip': '#00A23F' } as CSSProperties}
              onClick={() => setLiveSubway(!liveSubway)}
              className="cat-chip"
            >
              지하철
            </button>
            <button
              type="button"
              data-active={liveBus}
              style={{ '--chip': '#3D5BAB' } as CSSProperties}
              onClick={() => setLiveBus(!liveBus)}
              className="cat-chip"
            >
              버스
            </button>
            <span className="chip-gap" />
            {[1, 6, 15].map((speed) => (
              <button
                key={speed}
                type="button"
                data-active={liveSpeed === speed}
                style={{ '--chip': accent } as CSSProperties}
                onClick={() => setLiveSpeed(speed)}
                className="cat-chip"
              >
                {speed}×
              </button>
            ))}
          </div>
        </Row>
      </section>

      <section className="sec">
        <h3 className="sec__title">오버레이</h3>
        <Row label="랜드마크 마커" code="<Marker />" on={markers} onChange={setMarkers} />
        <Row label="랜드마크 경로" code="<MapRoute />" on={route} onChange={setRoute} />
      </section>
    </>
  );

  /* ── 모바일 프리뷰 ── */
  if (mobile) {
    return (
      <div className={`mobile-shell ${theme}`}>
        <button type="button" className="exit-mobile" onClick={() => setMobile(false)}>
          <MonitorIcon /> 데스크톱
        </button>
        <div className="phone">
          <div className="phone__screen is-mobile">
            {mapStage}
            <span className="phone__island" />
            <div className="m-top">
              <SearchBox query={query} setQuery={setQuery} onPick={goToStation} />
            </div>
            <div className="sheet">
              <span className="sheet__handle" />
              <div className="sheet__body">{controls}</div>
            </div>
            <span className="phone__home" />
          </div>
        </div>
      </div>
    );
  }

  /* ── 데스크톱 ── */
  return (
    <div className={`app ${theme}`}>
      {mapStage}
      <aside className="panel">
        <header className="panel__brand">
          <div className="panel__title">
            <h1>
              <span className="wordmark" role="img" aria-label="jidomap" />
              <span className="ver">v0.0.1</span>
            </h1>
          </div>
          <button
            type="button"
            className="icon-btn"
            data-active={touring}
            onClick={() => setTouring(!touring)}
            title="서울 랜드마크 투어"
          >
            {touring ? <StopIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMobile(true)}
            title="모바일 프리뷰"
          >
            <PhoneIcon />
          </button>
        </header>
        <div className="panel__search">
          <SearchBox query={query} setQuery={setQuery} onPick={goToStation} />
        </div>
        <div className="panel__body">{controls}</div>
        <footer className="panel__foot">
          <code>bun add @jidomap/react</code>
        </footer>
      </aside>
    </div>
  );
}
