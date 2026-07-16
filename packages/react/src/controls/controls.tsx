'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { LoaderIcon, LocateIcon, MaximizeIcon, MinusIcon, PlusIcon } from '../lib/icons';
import { useMap } from '../map/context';

export type MapControlsProps = {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showZoom?: boolean;
  showCompass?: boolean;
  showLocate?: boolean;
  showFullscreen?: boolean;
  className?: string;
  onLocate?: (coords: { longitude: number; latitude: number }) => void;
};

function ControlGroup({ children }: { children: ReactNode }) {
  return <div className="jido-control-group">{children}</div>;
}

function ControlButton({
  onClick,
  label,
  children,
  disabled = false,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="jido-control-btn"
    >
      {children}
    </button>
  );
}

function CompassButton({ onClick }: { onClick: () => void }) {
  const { map } = useMap();
  const compassRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!map || !compassRef.current) return;
    const compass = compassRef.current;
    const update = () => {
      compass.style.transform = `rotateX(${map.getPitch()}deg) rotateZ(${-map.getBearing()}deg)`;
    };
    map.on('rotate', update);
    map.on('pitch', update);
    update();
    return () => {
      map.off('rotate', update);
      map.off('pitch', update);
    };
  }, [map]);

  return (
    <ControlButton onClick={onClick} label="북쪽으로 정렬">
      <svg
        ref={compassRef}
        viewBox="0 0 24 24"
        className="jido-compass"
        style={{ transformStyle: 'preserve-3d' }}
        aria-hidden="true"
      >
        <path d="M12 2L16 12H12V2Z" fill="#f04452" />
        <path d="M12 2L8 12H12V2Z" fill="#f7a8ad" />
        <path d="M12 22L16 12H12V22Z" fill="currentColor" opacity="0.55" />
        <path d="M12 22L8 12H12V22Z" fill="currentColor" opacity="0.3" />
      </svg>
    </ControlButton>
  );
}

/** 줌·나침반·내위치·전체화면 컨트롤 묶음 */
export function MapControls({
  position = 'bottom-right',
  showZoom = true,
  showCompass = false,
  showLocate = false,
  showFullscreen = false,
  className,
  onLocate,
}: MapControlsProps) {
  const { map } = useMap();
  const [waitingForLocation, setWaitingForLocation] = useState(false);

  const handleZoomIn = useCallback(() => map?.zoomTo(map.getZoom() + 1, { duration: 300 }), [map]);
  const handleZoomOut = useCallback(() => map?.zoomTo(map.getZoom() - 1, { duration: 300 }), [map]);
  const handleResetBearing = useCallback(() => map?.resetNorthPitch({ duration: 300 }), [map]);

  const handleLocate = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    setWaitingForLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { longitude: pos.coords.longitude, latitude: pos.coords.latitude };
        map?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 14, duration: 1500 });
        onLocate?.(coords);
        setWaitingForLocation(false);
      },
      () => setWaitingForLocation(false),
    );
  }, [map, onLocate]);

  const handleFullscreen = useCallback(() => {
    const container = map?.getContainer();
    if (!container) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else container.requestFullscreen();
  }, [map]);

  return (
    <div data-position={position} className={cn('jido-controls', className)}>
      {showZoom && (
        <ControlGroup>
          <ControlButton onClick={handleZoomIn} label="확대">
            <PlusIcon />
          </ControlButton>
          <ControlButton onClick={handleZoomOut} label="축소">
            <MinusIcon />
          </ControlButton>
        </ControlGroup>
      )}
      {showCompass && (
        <ControlGroup>
          <CompassButton onClick={handleResetBearing} />
        </ControlGroup>
      )}
      {showLocate && (
        <ControlGroup>
          <ControlButton onClick={handleLocate} label="내 위치 찾기" disabled={waitingForLocation}>
            {waitingForLocation ? <LoaderIcon className="jido-spin" /> : <LocateIcon />}
          </ControlButton>
        </ControlGroup>
      )}
      {showFullscreen && (
        <ControlGroup>
          <ControlButton onClick={handleFullscreen} label="전체화면">
            <MaximizeIcon />
          </ControlButton>
        </ControlGroup>
      )}
    </div>
  );
}
