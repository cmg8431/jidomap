# jidomap

**키 없이 쓰는 한국형 지도.** MapLibre GL 위에 한글 라벨 · 지하철 노선/역 · 생활 POI · 브랜드 톤을 기본 내장한 React 지도 라이브러리.

```tsx
import { Map, KoreanLabels, SubwayLayer, PoiLayer, Marker, MarkerContent } from '@jidomap/react';
import '@jidomap/react/styles.css';

<Map center={[126.978, 37.5665]} zoom={12}>
  <KoreanLabels />
  <SubwayLayer />           {/* 수도권 지하철 — 노선 색·역 배지·환승 표시 */}
  <PoiLayer />              {/* 학교·병원·마트·문화시설 배지 */}
  <Marker longitude={126.978} latitude={37.5665}>
    <MarkerContent />
  </Marker>
</Map>
```

API 키·URL 등록·상업 제약 없음. 타일은 CARTO/OpenFreeMap(OSM) 무료 스타일.

## 패키지

| 패키지 | 역할 |
|---|---|
| `@jidomap/core` | 프레임워크 무관 코어 — 한글화·지하철/POI 레이어·지오 유틸·데이터 클라이언트. Vue/Svelte 어댑터의 공통 기반 |
| `@jidomap/react` | React 컴포넌트 — [mapcn](https://github.com/AnmolSaini16/mapcn) 호환 API(`Map`/`Marker`/`MarkerPopup`/`MapControls`/`useMap`), 스타일 라이브러리 무의존(CSS 변수 테마) |
| `@jidomap/data` | 한국 지리 데이터 스냅샷 — 지하철 노선/역(권역별), 시도 경계. OSM 추출 |
| `tools/pipeline` | 데이터 재생성 파이프라인 (Overpass API) |

## 데이터 최신화 구조

데이터는 코드와 분리돼 **계속 갱신**된다:

1. 원천은 OSM(살아있는 DB) — `tools/pipeline` 이 추출·정제
2. GitHub Actions cron 이 매월 재생성 → 변경분 PR
3. 머지 → `@jidomap/data` publish
4. 앱 반영 경로 두 가지:
   - `<SubwayLayer region="seoul" />` → jsDelivr CDN(`@jidomap/data@0`)에서 로드, **앱 재배포 없이 최신화**
   - `<SubwayLayer data={seoulSubway} />` → 번들 포함(오프라인), npm 업데이트로 갱신

## 개발

```sh
bun install
bun run dev          # playground (localhost:3200)
bun run check-types
bun run lint
cd tools/pipeline && bun run generate   # 데이터 수동 재생성
```

## 스타일링

Tailwind·shadcn 등 어떤 것도 강제하지 않는다. `styles.css` 한 장이 기본 톤을 입히고,
모든 색·형태는 `--jido-*` CSS 변수로 덮어쓸 수 있다. 컴포넌트 `className` 도 전부 열려 있다.

## 라이선스 주의

- 지도 데이터: © OpenStreetMap contributors (ODbL)
- CARTO basemaps 는 비상업 무료 — 상업 서비스는 OpenFreeMap 프리셋(`liberty`·`bright`, 제약 없음) 권장
