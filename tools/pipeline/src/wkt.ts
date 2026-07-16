/**
 * 최소 WKT 파서 — 서울시 Sheet 데이터의 도형 컬럼(WKT 문자열)용.
 * POLYGON / MULTIPOLYGON / LINESTRING / MULTILINESTRING / POINT 지원.
 */

type Position = number[];

function parseCoordSeq(body: string): Position[] {
  return body
    .split(',')
    .map((pair) => pair.trim().split(/\s+/).map(Number))
    .filter((coords) => coords.length >= 2 && coords.every((n) => Number.isFinite(n)));
}

/** 괄호 중첩 깊이에 따라 최상위 그룹으로 분리 */
function splitTopLevel(body: string): string[] {
  const groups: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '(') {
      if (depth === 0) start = i + 1;
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0 && start >= 0) groups.push(body.slice(start, i));
    }
  }
  return groups;
}

export function parseWkt(wkt: string): GeoJSON.Geometry | null {
  const match = wkt
    .trim()
    .match(/^(MULTIPOLYGON|POLYGON|MULTILINESTRING|LINESTRING|POINT)\s*(.*)$/i);
  if (!match) return null;
  const type = (match[1] ?? '').toUpperCase();
  const body = match[2] ?? '';

  if (type === 'POINT') {
    const coords = parseCoordSeq(body.replace(/[()]/g, ''))[0];
    return coords ? { type: 'Point', coordinates: coords } : null;
  }
  if (type === 'LINESTRING') {
    return { type: 'LineString', coordinates: parseCoordSeq(body.replace(/[()]/g, '')) };
  }
  if (type === 'MULTILINESTRING') {
    return {
      type: 'MultiLineString',
      coordinates: splitTopLevel(body.slice(body.indexOf('(') + 1, body.lastIndexOf(')'))).map(
        parseCoordSeq,
      ),
    };
  }
  if (type === 'POLYGON') {
    return { type: 'Polygon', coordinates: splitTopLevel(body).map(parseCoordSeq) };
  }
  if (type === 'MULTIPOLYGON') {
    const outer = body.slice(body.indexOf('(') + 1, body.lastIndexOf(')'));
    return {
      type: 'MultiPolygon',
      coordinates: splitTopLevel(outer).map((polygon) =>
        splitTopLevel(`(${polygon})`).map(parseCoordSeq),
      ),
    };
  }
  return null;
}
