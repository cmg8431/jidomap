/**
 * @jidomap/data 를 CDN(jsDelivr)에서 가져오는 클라이언트.
 * `@0` semver 범위를 쓰므로 데이터 패키지가 새로 publish 되면
 * 앱을 재배포하지 않아도 최신 스냅샷이 반영된다 (jsDelivr 캐시 주기 내).
 * 오프라인·자체 호스팅이 필요하면 base 를 바꾸거나 데이터를 직접 주입한다.
 */

export type SubwayRegion = 'seoul' | 'busan' | 'daegu' | 'gwangju' | 'daejeon';

export interface SubwayData {
  lines: GeoJSON.FeatureCollection;
  stations: GeoJSON.FeatureCollection;
  /** 출구 — 권역에 따라 없을 수 있다 */
  exits?: GeoJSON.FeatureCollection;
  /** 실측 지하통로 폴리곤 — 권역에 따라 없을 수 있다 */
  passages?: GeoJSON.FeatureCollection;
}

export const DEFAULT_DATA_BASE = 'https://cdn.jsdelivr.net/npm/@jidomap/data@0';

export interface FetchDataOptions {
  /** 데이터 호스트 베이스 URL — 자체 호스팅 시 교체 */
  base?: string;
  /** 커스텀 fetch (테스트·SSR 용) */
  fetcher?: typeof fetch;
}

/** 권역별 지하철 데이터 URL 쌍 */
export function subwayDataUrls(region: SubwayRegion, base = DEFAULT_DATA_BASE) {
  return {
    lines: `${base}/subway/${region}-lines.json`,
    stations: `${base}/subway/${region}-stations.json`,
    exits: `${base}/subway/${region}-exits.json`,
    passages: `${base}/subway/${region}-passages.json`,
  };
}

const cache = new Map<string, Promise<SubwayData>>();

/** 권역 지하철 데이터를 가져온다 — 같은 (base, region) 요청은 1회만 나간다 */
export function fetchSubwayData(
  region: SubwayRegion,
  options: FetchDataOptions = {},
): Promise<SubwayData> {
  const base = options.base ?? DEFAULT_DATA_BASE;
  const key = `${base}:${region}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const fetcher = options.fetcher ?? fetch;
  const urls = subwayDataUrls(region, base);
  const promise = Promise.all([
    fetcher(urls.lines).then((res) => {
      if (!res.ok) throw new Error(`지하철 노선 데이터 로드 실패: ${res.status}`);
      return res.json() as Promise<GeoJSON.FeatureCollection>;
    }),
    fetcher(urls.stations).then((res) => {
      if (!res.ok) throw new Error(`지하철 역 데이터 로드 실패: ${res.status}`);
      return res.json() as Promise<GeoJSON.FeatureCollection>;
    }),
    // 출구·지하통로는 부가 데이터 — 없거나 실패해도 무시
    fetcher(urls.exits)
      .then((res) => (res.ok ? (res.json() as Promise<GeoJSON.FeatureCollection>) : undefined))
      .catch(() => undefined),
    fetcher(urls.passages)
      .then((res) => (res.ok ? (res.json() as Promise<GeoJSON.FeatureCollection>) : undefined))
      .catch(() => undefined),
  ]).then(([lines, stations, exits, passages]) => ({ lines, stations, exits, passages }));

  // 실패한 요청은 캐시에서 지워 재시도 가능하게 한다
  promise.catch(() => cache.delete(key));
  cache.set(key, promise);
  return promise;
}
