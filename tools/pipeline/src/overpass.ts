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

/** Overpass QL 쿼리를 실행한다. 미러를 돌며 최대 3회 재시도 */
export async function overpass(query: string): Promise<OsmResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MIRRORS.length; attempt += 1) {
    const url = MIRRORS[attempt % MIRRORS.length];
    if (!url) continue;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) throw new Error(`overpass ${res.status} @ ${url}`);
      return (await res.json()) as OsmResponse;
    } catch (error) {
      lastError = error;
      console.warn(`[overpass] 재시도 ${attempt + 1}/${MIRRORS.length}:`, error);
      await new Promise((resolve) => setTimeout(resolve, 5_000 * (attempt + 1)));
    }
  }
  throw lastError;
}

/** 좌표를 소수 5자리(≈1m)로 양자화해 파일 크기를 줄인다 */
export function quantize(coord: number): number {
  return Math.round(coord * 1e5) / 1e5;
}
