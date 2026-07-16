/** Overpass API 클라이언트 — 미러 순회 + 재시도 */

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  members?: { type: string; ref: number; role: string }[];
  tags?: Record<string, string>;
}

export interface OsmResponse {
  elements: OsmElement[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 미러 3곳 × 3바퀴 재시도 */
const MAX_ATTEMPTS = MIRRORS.length * 3;
/** 연속 호출 간 최소 간격 — 미러 레이트리밋(406/429) 회피 */
const MIN_GAP_MS = 4_000;
let lastCallAt = 0;
/** 마지막으로 성공한 미러부터 시도 — 죽은 미러에 백오프를 낭비하지 않는다 */
let preferredMirror = 0;

/** Overpass QL 쿼리를 실행한다. 호출 간격을 띄우고, 미러를 돌며 백오프 재시도 */
export async function overpass(query: string): Promise<OsmResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const index = (preferredMirror + attempt) % MIRRORS.length;
    const url = MIRRORS[index];
    if (!url) continue;
    const gap = lastCallAt + MIN_GAP_MS - Date.now();
    if (gap > 0) await sleep(gap);
    lastCallAt = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'jidomap-pipeline/0.0.1 (+https://github.com/cmg8431/jidomap)',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) throw new Error(`overpass ${res.status} @ ${url}`);
      preferredMirror = index;
      return (await res.json()) as OsmResponse;
    } catch (error) {
      lastError = error;
      console.warn(`[overpass] 재시도 ${attempt + 1}/${MAX_ATTEMPTS}:`, error);
      // 레이트리밋(406/429)·게이트웨이 타임아웃(504) — 다음 미러로 넘어가기 전 잠깐 대기
      await sleep(Math.min(5_000 * (attempt + 1), 30_000));
    }
  }
  throw lastError;
}

/** 좌표를 소수 5자리(≈1m)로 양자화해 파일 크기를 줄인다 */
export function quantize(coord: number): number {
  return Math.round(coord * 1e5) / 1e5;
}
