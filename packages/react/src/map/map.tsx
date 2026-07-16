'use client';

import type { Theme } from '@jidomap/core';
import MapLibreGL from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  type CSSProperties,
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '../lib/cn';
import { MapContext } from './context';
import { useResolvedTheme } from './theme';

/** 키 없이 쓰는 무료 벡터 기본 스타일 (CARTO, OSM 기반) */
const defaultStyles = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};

/** 한글 라벨(CJK 글리프)을 로컬 폰트로 렌더 — 미지정 시 기본값 */
const DEFAULT_CJK_FONT = "'Pretendard Variable', Pretendard, -apple-system, sans-serif";

/** 타일 없는 투명 배경 스타일 — 데이터 시각화용 (blank 프롭) */
const blankMapStyle: MapLibreGL.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': 'rgba(0,0,0,0)' } },
  ],
};

type MapStyleOption = string | MapLibreGL.StyleSpecification;
type MapRef = MapLibreGL.Map;

/** 지도 뷰포트 상태 */
export type MapViewport = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
};

/**
 * 디자인 토큰 오버라이드 — CSS 파일을 건드리지 않고 지도 UI(팝업·컨트롤·마커) 톤을 바꾼다.
 * 각 키는 `--jido-*` CSS 변수로 매핑된다. 예: { accent: '#ff6f0f', radius: '14px' }
 */
export type MapTokens = Partial<{
  bg: string;
  fg: string;
  muted: string;
  border: string;
  accent: string;
  popoverBg: string;
  popoverFg: string;
  tooltipBg: string;
  tooltipFg: string;
  controlBg: string;
  controlHover: string;
  marker: string;
  radius: string;
  shadow: string;
}>;

export type MapProps = {
  children?: ReactNode;
  className?: string;
  /** 테마. 미지정 시 문서 클래스 → 시스템 선호로 자동 감지 */
  theme?: Theme;
  /** 디자인 토큰 오버라이드 — `--jido-*` CSS 변수로 주입된다 */
  tokens?: MapTokens;
  /** 라이트/다크 커스텀 스타일. 기본 CARTO 스타일을 덮어쓴다 */
  styles?: { light?: MapStyleOption; dark?: MapStyleOption };
  /** 타일 없는 투명 기본맵 — 직접 레이어를 올려 쓰는 데이터 시각화용 */
  blank?: boolean;
  /** 투영. { type: 'globe' } 로 3D 지구본 */
  projection?: MapLibreGL.ProjectionSpecification;
  /** 제어 뷰포트 (onViewportChange 와 함께 쓰면 controlled 모드) */
  viewport?: Partial<MapViewport>;
  /** 뷰포트 변경 콜백 (pan/zoom/rotate/pitch) */
  onViewportChange?: (viewport: MapViewport) => void;
  /** 로딩 인디케이터 강제 표시 */
  loading?: boolean;
} & Omit<MapLibreGL.MapOptions, 'container' | 'style'>;

function DefaultLoader() {
  return (
    <div className="jido-loader">
      <span className="jido-loader__dot" />
      <span className="jido-loader__dot" />
      <span className="jido-loader__dot" />
    </div>
  );
}

function getViewport(map: MapLibreGL.Map): MapViewport {
  const center = map.getCenter();
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

/**
 * 지도 루트. mapcn 호환 API — children 으로 Marker·Popup·컨트롤·한국 레이어를 합성한다.
 * 스타일 라이브러리에 의존하지 않으며, styles.css 로 기본 톤을 입힌다.
 */
export const Map = forwardRef<MapRef, MapProps>(function Map(
  {
    children,
    className,
    theme: themeProp,
    tokens,
    styles,
    blank = false,
    projection,
    viewport,
    onViewportChange,
    loading = false,
    ...props
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<MapLibreGL.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const currentStyleRef = useRef<MapStyleOption | null>(null);
  const styleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const internalUpdateRef = useRef(false);
  const resolvedTheme = useResolvedTheme(themeProp);

  const isControlled = viewport !== undefined && onViewportChange !== undefined;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  const mapStyles = useMemo(() => {
    if (styles) {
      return {
        dark: styles.dark ?? defaultStyles.dark,
        light: styles.light ?? defaultStyles.light,
      };
    }
    if (blank) return { dark: blankMapStyle, light: blankMapStyle };
    return defaultStyles;
  }, [styles, blank]);

  useImperativeHandle(ref, () => mapInstance as MapLibreGL.Map, [mapInstance]);

  const clearStyleTimeout = useCallback(() => {
    if (styleTimeoutRef.current) {
      clearTimeout(styleTimeoutRef.current);
      styleTimeoutRef.current = null;
    }
  }, []);

  // 지도 초기화 (1회)
  useEffect(() => {
    if (!containerRef.current) return;

    const initialStyle = resolvedTheme === 'dark' ? mapStyles.dark : mapStyles.light;
    currentStyleRef.current = initialStyle;

    const map = new MapLibreGL.Map({
      container: containerRef.current,
      style: initialStyle,
      renderWorldCopies: false,
      localIdeographFontFamily: DEFAULT_CJK_FONT,
      attributionControl: { compact: true },
      ...props,
      ...viewport,
    });

    const styleDataHandler = () => {
      clearStyleTimeout();
      // 스타일이 완전히 처리된 뒤 레이어 조작을 허용 (setStyle 경합 회피)
      styleTimeoutRef.current = setTimeout(() => {
        setIsStyleLoaded(true);
        if (projection) map.setProjection(projection);
      }, 100);
    };
    const loadHandler = () => setIsLoaded(true);
    // 새 스타일 로드 완료 시점 — diff 실패로 전체 재빌드된 경우에도 레이어 재장착을 트리거한다
    const styleLoadHandler = () => setStyleEpoch((count) => count + 1);

    // compact 출처 표시가 초기에 펼쳐진 채 시작하는 것을 접는다 (ⓘ 클릭으로 다시 펼 수 있음)
    const collapseAttribution = () => {
      const attrib = map.getContainer().querySelector('.maplibregl-ctrl-attrib');
      attrib?.classList.remove('maplibregl-compact-show');
      attrib?.removeAttribute('open');
    };
    map.once('load', collapseAttribution);
    const handleMove = () => {
      if (internalUpdateRef.current) return;
      onViewportChangeRef.current?.(getViewport(map));
    };

    map.on('load', loadHandler);
    map.on('style.load', styleLoadHandler);
    map.on('styledata', styleDataHandler);
    map.on('move', handleMove);
    setMapInstance(map);

    // 컨테이너 크기 변화(레이아웃 전환·사이드바 토글)에 지도를 자동 리사이즈
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      clearStyleTimeout();
      map.off('load', loadHandler);
      map.off('style.load', styleLoadHandler);
      map.off('styledata', styleDataHandler);
      map.off('move', handleMove);
      map.remove();
      setIsLoaded(false);
      setIsStyleLoaded(false);
      setMapInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // controlled 뷰포트 동기화
  useEffect(() => {
    if (!mapInstance || !isControlled || !viewport) return;
    if (mapInstance.isMoving()) return;

    const current = getViewport(mapInstance);
    const next = {
      center: viewport.center ?? current.center,
      zoom: viewport.zoom ?? current.zoom,
      bearing: viewport.bearing ?? current.bearing,
      pitch: viewport.pitch ?? current.pitch,
    };
    if (
      next.center[0] === current.center[0] &&
      next.center[1] === current.center[1] &&
      next.zoom === current.zoom &&
      next.bearing === current.bearing &&
      next.pitch === current.pitch
    ) {
      return;
    }
    internalUpdateRef.current = true;
    mapInstance.jumpTo(next);
    internalUpdateRef.current = false;
  }, [mapInstance, isControlled, viewport]);

  // 테마 전환 시 스타일 교체
  useEffect(() => {
    if (!mapInstance || !resolvedTheme) return;
    const newStyle = resolvedTheme === 'dark' ? mapStyles.dark : mapStyles.light;
    if (currentStyleRef.current === newStyle) return;

    clearStyleTimeout();
    currentStyleRef.current = newStyle;
    setIsStyleLoaded(false);
    mapInstance.setStyle(newStyle, { diff: true });
  }, [mapInstance, resolvedTheme, mapStyles, clearStyleTimeout]);

  // projection prop 변화 반영
  useEffect(() => {
    if (!mapInstance || !isStyleLoaded || !projection) return;
    mapInstance.setProjection(projection);
  }, [mapInstance, isStyleLoaded, projection]);

  const contextValue = useMemo(
    () => ({ map: mapInstance, isLoaded: isLoaded && isStyleLoaded, resolvedTheme, styleEpoch }),
    [mapInstance, isLoaded, isStyleLoaded, resolvedTheme, styleEpoch],
  );

  // tokens → --jido-* CSS 변수 (camelCase → kebab-case)
  const tokenStyle = useMemo(() => {
    if (!tokens) return undefined;
    return Object.fromEntries(
      Object.entries(tokens).map(([key, value]) => [
        `--jido-${key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)}`,
        value,
      ]),
    ) as CSSProperties;
  }, [tokens]);

  return (
    <MapContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        data-jido-theme={resolvedTheme}
        style={tokenStyle}
        className={cn('jido-map', className)}
      >
        {(!isLoaded || loading) && <DefaultLoader />}
        {mapInstance && children}
      </div>
    </MapContext.Provider>
  );
});
