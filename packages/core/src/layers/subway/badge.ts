/**
 * 지하철 출구 번호 배지 — 노란 라운드 사각 + 진한 숫자.
 * styleimagemissing 훅에서 요청 시 즉석 생성된다. 브라우저 전용.
 */
export function buildExitBadge(ref: string): ImageData | null {
  if (typeof document === 'undefined') return null;
  const dpr = 2;
  const h = 14 * dpr;
  const margin = 2 * dpr;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const font = `800 ${9 * dpr}px 'Pretendard Variable', Pretendard, sans-serif`;
  ctx.font = font;
  const w = Math.max(h, Math.ceil(ctx.measureText(ref).width) + 7 * dpr);
  canvas.width = w + margin * 2;
  canvas.height = h + margin * 2;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.beginPath();
  ctx.roundRect(margin, margin, w, h, 3.5 * dpr);
  ctx.fillStyle = '#f6c94a';
  ctx.fill();
  ctx.lineWidth = 1.2 * dpr;
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.stroke();
  ctx.fillStyle = '#3d2f05';
  ctx.fillText(ref, margin + w / 2, margin + h / 2 + dpr * 0.5);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * 노선번호 배지 줄(②④ 형태)을 캔버스로 그려 지도 아이콘(ImageData)으로 만든다.
 * styleimagemissing 훅에서 요청 시 즉석 생성된다. 브라우저 전용.
 */
export function buildStationBadge(
  refs: string[],
  colourByRef: Record<string, string>,
): ImageData | null {
  if (typeof document === 'undefined') return null;
  const dpr = 2;
  const badgeH = 15 * dpr;
  const gap = 2 * dpr;
  const margin = 2 * dpr;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const font = `700 ${9.5 * dpr}px 'Pretendard Variable', Pretendard, sans-serif`;
  ctx.font = font;
  const widths = refs.map((ref) =>
    ref.length <= 1 ? badgeH : Math.ceil(ctx.measureText(ref).width) + 8 * dpr,
  );
  canvas.width = widths.reduce((sum, w) => sum + w, 0) + gap * (refs.length - 1) + margin * 2;
  canvas.height = badgeH + margin * 2;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let x = margin;
  refs.forEach((ref, i) => {
    const w = widths[i] ?? badgeH;
    ctx.beginPath();
    ctx.roundRect(x, margin, w, badgeH, badgeH / 2);
    ctx.fillStyle = colourByRef[ref] ?? '#565b64';
    ctx.fill();
    ctx.lineWidth = 1.4 * dpr;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(ref, x + w / 2, margin + badgeH / 2 + dpr * 0.5);
    x += w + gap;
  });
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
