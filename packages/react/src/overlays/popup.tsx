'use client';

import MapLibreGL, { type PopupOptions } from 'maplibre-gl';
import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';
import { XIcon } from '../lib/icons';
import { useMap } from '../map/context';

export type MapPopupProps = {
  longitude: number;
  latitude: number;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  closeButton?: boolean;
} & Omit<PopupOptions, 'className' | 'closeButton'>;

/** 마커와 무관하게 좌표에 직접 띄우는 팝업 */
export function MapPopup({
  longitude,
  latitude,
  onClose,
  children,
  className,
  closeButton = false,
  ...popupOptions
}: MapPopupProps) {
  const { map } = useMap();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const container = useMemo(() => document.createElement('div'), []);
  const { offset, maxWidth } = popupOptions;

  const popup = useMemo(
    () =>
      new MapLibreGL.Popup({ offset: 16, ...popupOptions, closeButton: false })
        .setMaxWidth('none')
        .setLngLat([longitude, latitude]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!map) return;
    const handleClose = () => onCloseRef.current?.();
    popup.on('close', handleClose);
    popup.setDOMContent(container);
    popup.addTo(map);
    return () => {
      popup.off('close', handleClose);
      if (popup.isOpen()) popup.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const current = popup.getLngLat();
    if (!current || current.lng !== longitude || current.lat !== latitude) {
      popup.setLngLat([longitude, latitude]);
    }
    popup.setOffset(offset ?? 16);
    if (maxWidth) popup.setMaxWidth(maxWidth);
  }, [popup, longitude, latitude, offset, maxWidth]);

  return createPortal(
    <div className={cn('jido-popup', className)}>
      {closeButton && (
        <button
          type="button"
          onClick={() => popup.remove()}
          aria-label="닫기"
          className="jido-popup__close"
        >
          <XIcon />
        </button>
      )}
      {children}
    </div>,
    container,
  );
}
