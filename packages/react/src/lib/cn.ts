/** 의존성 없는 클래스명 결합기 — falsy 는 걸러낸다 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
