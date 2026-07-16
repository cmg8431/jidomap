'use client';

import MapLibreGL, { type MarkerOptions, type PopupOptions } from 'maplibre-gl';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';
import { XIcon } from '../lib/icons';
import { useMap } from '../map/context';

type MarkerContextValue = {
  marker: MapLibreGL.Marker;
  map: MapLibreGL.Map | null;
};

const MarkerContext = createContext<MarkerContextValue | null>(null);

function useMarkerContext() {
  const context = useContext(MarkerContext);
  if (!context) throw new Error('Marker 하위 컴포넌트는 <Marker> 안에서만 사용할 수 있어요');
  return context;
}

export type MarkerProps = {
  longitude: number;
  latitude: number;
  children: ReactNode;
  onClick?: (e: MouseEvent) => void;
  onMouseEnter?: (e: MouseEvent) => void;
  onMouseLeave?: (e: MouseEvent) => void;
  onDragStart?: (lngLat: { lng: number; lat: number }) => void;
  onDrag?: (lngLat: { lng: number; lat: number }) => void;
  onDragEnd?: (lngLat: { lng: number; lat: number }) => void;
} & Omit<MarkerOptions, 'element'>;

/** 좌표에 고정되는 마커. 안에 MarkerContent·MarkerPopup·MarkerTooltip·MarkerLabel 을 합성한다 */
export function Marker({
  longitude,
  latitude,
  children,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onDragStart,
  onDrag,
  onDragEnd,
  draggable = false,
  ...markerOptions
}: MarkerProps) {
  const { map } = useMap();

  const callbacksRef = useRef({
    onClick,
    onMouseEnter,
    onMouseLeave,
    onDragStart,
    onDrag,
    onDragEnd,
  });
  callbacksRef.current = { onClick, onMouseEnter, onMouseLeave, onDragStart, onDrag, onDragEnd };

  const marker = useMemo(() => {
    const instance = new MapLibreGL.Marker({
      ...markerOptions,
      element: document.createElement('div'),
      draggable,
    }).setLngLat([longitude, latitude]);

    const el = instance.getElement();
    el?.addEventListener('click', (e) => callbacksRef.current.onClick?.(e));
    el?.addEventListener('mouseenter', (e) => callbacksRef.current.onMouseEnter?.(e));
    el?.addEventListener('mouseleave', (e) => callbacksRef.current.onMouseLeave?.(e));

    const lngLatOf = () => {
      const p = instance.getLngLat();
      return { lng: p.lng, lat: p.lat };
    };
    instance.on('dragstart', () => callbacksRef.current.onDragStart?.(lngLatOf()));
    instance.on('drag', () => callbacksRef.current.onDrag?.(lngLatOf()));
    instance.on('dragend', () => callbacksRef.current.onDragEnd?.(lngLatOf()));

    return instance;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map) return;
    marker.addTo(map);
    return () => {
      marker.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const { offset, rotation, rotationAlignment, pitchAlignment } = markerOptions;

  useEffect(() => {
    const current = marker.getLngLat();
    if (current.lng !== longitude || current.lat !== latitude) {
      marker.setLngLat([longitude, latitude]);
    }
    if (marker.isDraggable() !== draggable) marker.setDraggable(draggable);

    const currentOffset = marker.getOffset();
    const newOffset = offset ?? [0, 0];
    const [nx, ny] = Array.isArray(newOffset) ? newOffset : [newOffset.x, newOffset.y];
    if (currentOffset.x !== nx || currentOffset.y !== ny) marker.setOffset(newOffset);

    if (marker.getRotation() !== (rotation ?? 0)) marker.setRotation(rotation ?? 0);
    if (marker.getRotationAlignment() !== (rotationAlignment ?? 'auto')) {
      marker.setRotationAlignment(rotationAlignment ?? 'auto');
    }
    if (marker.getPitchAlignment() !== (pitchAlignment ?? 'auto')) {
      marker.setPitchAlignment(pitchAlignment ?? 'auto');
    }
  }, [marker, longitude, latitude, draggable, offset, rotation, rotationAlignment, pitchAlignment]);

  return <MarkerContext.Provider value={{ marker, map }}>{children}</MarkerContext.Provider>;
}

export type MarkerContentProps = {
  children?: ReactNode;
  className?: string;
};

/** 마커의 시각적 내용. 미지정 시 기본 점 마커를 그린다 */
export function MarkerContent({ children, className }: MarkerContentProps) {
  const { marker } = useMarkerContext();
  return createPortal(
    <div className={cn('jido-marker', className)}>
      {children || <span className="jido-marker__dot" />}
    </div>,
    marker.getElement(),
  );
}

function PopupCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="닫기" className="jido-popup__close">
      <XIcon />
    </button>
  );
}

export type MarkerPopupProps = {
  children: ReactNode;
  className?: string;
  closeButton?: boolean;
} & Omit<PopupOptions, 'className' | 'closeButton'>;

/** 마커 클릭 시 여닫히는 팝업 */
export function MarkerPopup({
  children,
  className,
  closeButton = false,
  ...popupOptions
}: MarkerPopupProps) {
  const { marker, map } = useMarkerContext();
  const container = useMemo(() => document.createElement('div'), []);
  const { offset, maxWidth } = popupOptions;

  const popup = useMemo(
    () =>
      new MapLibreGL.Popup({ offset: 16, ...popupOptions, closeButton: false })
        .setMaxWidth('none')
        .setDOMContent(container),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!map) return;
    popup.setDOMContent(container);
    marker.setPopup(popup);
    return () => {
      marker.setPopup(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    popup.setOffset(offset ?? 16);
    if (maxWidth) popup.setMaxWidth(maxWidth);
  }, [popup, offset, maxWidth]);

  return createPortal(
    <div className={cn('jido-popup', className)}>
      {closeButton && <PopupCloseButton onClick={() => popup.remove()} />}
      {children}
    </div>,
    container,
  );
}

export type MarkerTooltipProps = {
  children: ReactNode;
  className?: string;
} & Omit<PopupOptions, 'className' | 'closeButton' | 'closeOnClick'>;

/** 마커에 마우스 올리면 뜨는 툴팁 */
export function MarkerTooltip({ children, className, ...popupOptions }: MarkerTooltipProps) {
  const { marker, map } = useMarkerContext();
  const container = useMemo(() => document.createElement('div'), []);
  const { offset, maxWidth } = popupOptions;

  const tooltip = useMemo(
    () =>
      new MapLibreGL.Popup({
        offset: 16,
        ...popupOptions,
        closeOnClick: true,
        closeButton: false,
      }).setMaxWidth('none'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!map) return;
    tooltip.setDOMContent(container);
    const el = marker.getElement();
    const enter = () => tooltip.setLngLat(marker.getLngLat()).addTo(map);
    const leave = () => tooltip.remove();
    el?.addEventListener('mouseenter', enter);
    el?.addEventListener('mouseleave', leave);
    return () => {
      el?.removeEventListener('mouseenter', enter);
      el?.removeEventListener('mouseleave', leave);
      tooltip.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    tooltip.setOffset(offset ?? 16);
    if (maxWidth) tooltip.setMaxWidth(maxWidth);
  }, [tooltip, offset, maxWidth]);

  return createPortal(<div className={cn('jido-tooltip', className)}>{children}</div>, container);
}

export type MarkerLabelProps = {
  children: ReactNode;
  className?: string;
  position?: 'top' | 'bottom';
};

/** 마커 옆에 항상 붙어 있는 라벨 */
export function MarkerLabel({ children, className, position = 'top' }: MarkerLabelProps) {
  return (
    <div data-position={position} className={cn('jido-marker-label', className)}>
      {children}
    </div>
  );
}
