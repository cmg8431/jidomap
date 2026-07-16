# @jidomap/pipeline

OSM(Overpass API)에서 한국 지리 데이터를 추출해 `packages/data` 스냅샷을 재생성한다.
**데이터 최신화의 단일 경로** — 손으로 GeoJSON 을 고치지 않는다.

## 실행

```sh
bun run generate             # 지하철 전 권역 + 시도 경계
bun run generate:subway      # 지하철만 (seoul·busan·daegu·gwangju·daejeon)
bun run generate:boundaries  # 시도 경계만
```

일반 `turbo run build` 에는 포함되지 않는다 — 외부 API(Overpass)를 치는 작업이라
명시적으로만 실행한다.

## 자동 갱신

`.github/workflows/data-refresh.yml` 이 매월 1일 파이프라인을 돌려 변경분을 PR 로 올린다.
PR 머지 → `@jidomap/data` publish → jsDelivr CDN(`@0` semver 범위)을 쓰는 앱은
재배포 없이 최신 데이터를 받는다.

## 안전장치

- Overpass 미러 3곳 순회 + 재시도
- 빈 결과·부분 실패는 기존 스냅샷을 덮어쓰지 않음
- 좌표는 소수 5자리(≈1m)로 양자화해 파일 크기 절감

## 지하통로 소스 우선순위

`generate` 가 권역별 지하통로를 OSM(tunnel·underground footway)에서 자동 추출한다.
공공데이터 기반 파일(`source: "public"`, `generate:underground` 산출물)은 정밀판으로 취급해
OSM 추출이 덮어쓰지 않는다 — 서울처럼 실측 데이터가 있으면 그쪽이 이긴다.

## 로드맵

- **실제 지하통로 폴리곤 전국 확장** — OSM 자동 추출은 들어갔고, 공공데이터 정밀판으로 교체 가능:
  - [서울시 지하철역 연계 지하도 공간정보 (OA-21213)](https://data.seoul.go.kr/dataList/OA-21213/S/1/datasetView.do) — 지하도 네트워크
  - [NGII 연속수치지형도](https://www.data.go.kr/data/15059721/fileData.do) — 지하보도·지하상가 레이어 (전국)
  - [서울시 도시계획시설(교통시설_도로외)](https://data.seoul.go.kr/dataList/OA-21130/S/1/datasetView.do?tab=A) — 지하보도 필터
  - 처리: EPSG:5174 → WGS84, CP949 인코딩. 라이선스는 항목별 공공누리 유형 확인
- **POI 밀도** — 소상공인 상가정보 / Overture Places → 카테고리 매핑 후 권역별 GeoJSON
- ~~시군구(admin_level=6) 경계~~ → `boundaries/sigungu.json` 생성됨
- KTX·일반철도 역 — [국가철도공단 역사정보](https://www.data.go.kr/data/15093755/fileData.do) 활용 가능
- 역 좌표 검증 — [전국도시철도역사정보표준데이터](https://www.data.go.kr/data/15013205/standard.do)와 대조해 OSM 드리프트 감지
- Overpass → [osm.kr non-military 추출본](https://tiles.osm.kr/) pbf 배치 추출 전환 검토 (군사시설 이슈 승계 + 미러 의존 제거)
