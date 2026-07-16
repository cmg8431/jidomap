/**
 * 지하통로(지하도·지하상가) 공공데이터 → passages GeoJSON 변환기.
 *
 * 원천 (1회 수동 다운로드, 로그인 필요):
 * - 서울시 지하철역 연계 지하도 공간정보 (OA-21213)
 *   https://data.seoul.go.kr/dataList/OA-21213/S/1/datasetView.do
 * - NGII 연속수치지형도 지하보도·지하상가 레이어 (전국)
 *
 * 사용: bun run generate:underground -- <input.shp|.geojson> [--srs EPSG:5174] [--region seoul]
 * 출력: packages/data/subway/<region>-passages.json
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import proj4 from 'proj4';
import * as shapefile from 'shapefile';

// 국내 공공 SHP 에서 흔한 좌표계들
proj4.defs(
  'EPSG:5174',
  '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43',
);
proj4.defs(
  'EPSG:5181',
  '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs',
);
proj4.defs(
  'EPSG:5186',
  '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs',
);

const DATA_DIR = resolve(import.meta.dir, '../../../packages/data');

const quantize = (n: number) => Math.round(n * 1e5) / 1e5;

function makeTransform(srs: string) {
  const identity = srs === 'EPSG:4326' || srs === 'WGS84';
  const convert = identity ? null : proj4(srs, 'WGS84');
  return (coord: number[]): [number, number] => {
    const [x, y] = coord as [number, number];
    if (!convert) return [quantize(x), quantize(y)];
    const [lng, lat] = convert.forward([x, y]);
    return [quantize(lng ?? 0), quantize(lat ?? 0)];
  };
}

/** 지오메트리 좌표 전체를 재투영 */
function reproject(
  geometry: GeoJSON.Geometry,
  transform: (coord: number[]) => [number, number],
): GeoJSON.Geometry {
  const walk = (coords: unknown): unknown =>
    Array.isArray(coords) && typeof coords[0] === 'number'
      ? transform(coords as number[])
      : (coords as unknown[]).map(walk);
  if (geometry.type === 'GeometryCollection') return geometry;
  return { ...geometry, coordinates: walk(geometry.coordinates) } as GeoJSON.Geometry;
}

/** 이름으로 쓸만한 속성을 찾는다 (한글 컬럼명 대응) */
function pickName(props: Record<string, unknown> | null): string {
  if (!props) return '';
  for (const key of Object.keys(props)) {
    if (/name|nm|명칭|시설명|지하도/i.test(key) && typeof props[key] === 'string') {
      return props[key] as string;
    }
  }
  return '';
}

async function loadFeatures(input: string): Promise<GeoJSON.Feature[]> {
  if (/\.(geojson|json)$/i.test(input)) {
    const raw = JSON.parse(await readFile(input, 'utf8')) as GeoJSON.FeatureCollection;
    return raw.features ?? [];
  }
  if (/\.shp$/i.test(input)) {
    const features: GeoJSON.Feature[] = [];
    // 국내 공공 SHP 의 DBF 는 대부분 CP949 — euc-kr 디코더로 커버
    const source = await shapefile.open(input, undefined, { encoding: 'euc-kr' });
    for (;;) {
      const result = await source.read();
      if (result.done) break;
      features.push(result.value as GeoJSON.Feature);
    }
    return features;
  }
  throw new Error(`지원하지 않는 입력: ${input} (.shp 또는 .geojson)`);
}

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const input = args.find((arg) => !arg.startsWith('--'));
const srs = args.find((arg) => arg.startsWith('--srs='))?.slice(6) ?? 'EPSG:5174';
const region = args.find((arg) => arg.startsWith('--region='))?.slice(9) ?? 'seoul';

if (!input) {
  console.log(
    '사용: bun run generate:underground -- <input.shp|.geojson> [--srs=EPSG:5174] [--region=seoul]',
  );
  process.exit(1);
}

const transform = makeTransform(srs);
const features = (await loadFeatures(resolve(input)))
  .filter((feature) => /Polygon|LineString/.test(feature.geometry?.type ?? ''))
  .map((feature) => ({
    type: 'Feature' as const,
    properties: { name: pickName(feature.properties as Record<string, unknown> | null) },
    geometry: reproject(feature.geometry, transform),
  }));

if (features.length === 0) {
  console.error('폴리곤/라인 피처가 없습니다 — 입력·좌표계를 확인하세요');
  process.exit(1);
}

// 좌표 검증 — 한반도 밖이면 좌표계 지정이 틀린 것
const sample = JSON.stringify(features[0]?.geometry).match(/(\d+\.\d+),(\d+\.\d+)/);
if (sample) {
  const lng = Number(sample[1]);
  if (lng < 123 || lng > 133) {
    console.error(`좌표가 한반도 밖입니다 (lng=${lng}) — --srs 를 확인하세요 (5174/5181/5186)`);
    process.exit(1);
  }
}

const outPath = resolve(DATA_DIR, `subway/${region}-passages.json`);
await mkdir(resolve(outPath, '..'), { recursive: true });
await writeFile(outPath, JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`저장: subway/${region}-passages.json (features=${features.length}, srs=${srs})`);
