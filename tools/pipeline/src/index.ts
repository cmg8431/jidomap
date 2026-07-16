import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildSidoBoundaries } from './boundaries';
import { buildSubwayExits, buildSubwayRegion, SUBWAY_REGIONS } from './subway';

const DATA_DIR = resolve(import.meta.dir, '../../../packages/data');

async function writeJson(relativePath: string, value: unknown) {
  const path = resolve(DATA_DIR, relativePath);
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify(value));
  console.log(`  → ${relativePath}`);
}

async function buildSubway() {
  const built: string[] = [];
  for (const [region, isoCodes] of Object.entries(SUBWAY_REGIONS)) {
    try {
      const { lines, stations } = await buildSubwayRegion(region, isoCodes);
      // 빈 결과는 기존 스냅샷을 덮어쓰지 않는다 — 데이터 유실 방지
      if (lines.features.length === 0 || stations.features.length === 0) {
        console.warn(`[subway:${region}] 결과가 비어 있어 건너뜀`);
        continue;
      }
      await writeJson(`subway/${region}-lines.json`, lines);
      await writeJson(`subway/${region}-stations.json`, stations);
      // 출구는 부가 데이터 — 실패해도 노선·역은 유지
      try {
        const exits = await buildSubwayExits(region, isoCodes);
        if (exits.features.length > 0) await writeJson(`subway/${region}-exits.json`, exits);
      } catch (error) {
        console.error(`[exits:${region}] 실패 — 기존 스냅샷 유지:`, error);
      }
      built.push(region);
    } catch (error) {
      console.error(`[subway:${region}] 실패 — 기존 스냅샷 유지:`, error);
    }
  }
  return built;
}

async function buildBoundaries() {
  try {
    const sido = await buildSidoBoundaries();
    if (sido.features.length < 15) {
      console.warn('[boundaries] 시도가 15개 미만 — 기존 스냅샷 유지');
      return false;
    }
    await writeJson('boundaries/sido.json', sido);
    return true;
  } catch (error) {
    console.error('[boundaries] 실패 — 기존 스냅샷 유지:', error);
    return false;
  }
}

const target = process.argv[2] ?? 'all';
const regions = target === 'all' || target === 'subway' ? await buildSubway() : [];
const boundaries = target === 'all' || target === 'boundaries' ? await buildBoundaries() : false;

// 부분 실행·부분 실패가 기존 메타를 지우지 않도록 병합한다
const metaPath = resolve(DATA_DIR, 'meta.json');
const existing = JSON.parse(await readFile(metaPath, 'utf8').catch(() => '{}')) as {
  regions?: string[];
  boundaries?: boolean;
};
await writeJson('meta.json', {
  updatedAt: new Date().toISOString().slice(0, 10),
  source: 'OpenStreetMap contributors (ODbL)',
  regions: [...new Set([...(existing.regions ?? []), ...regions])].sort(),
  boundaries: boundaries || existing.boundaries || false,
  pipeline: 'tools/pipeline',
});
console.log('완료');
