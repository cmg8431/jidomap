import type { Theme } from '@jidomap/core';
import { useEffect, useState } from 'react';

/** 문서 클래스에서 테마 감지 (next-themes 등과 호환) */
export function getDocumentTheme(): Theme | null {
  if (typeof document === 'undefined') return null;
  if (document.documentElement.classList.contains('dark')) return 'dark';
  if (document.documentElement.classList.contains('light')) return 'light';
  return null;
}

/** 시스템 선호 테마 */
export function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * theme prop 이 있으면 그대로, 없으면 문서 클래스 → 시스템 선호 순으로 감지한다.
 * 문서 클래스 변화(다크모드 토글)·시스템 선호 변화를 실시간 반영한다.
 */
export function useResolvedTheme(themeProp?: Theme): Theme {
  const [detected, setDetected] = useState<Theme>(() => getDocumentTheme() ?? getSystemTheme());

  useEffect(() => {
    if (themeProp) return;

    const observer = new MutationObserver(() => {
      const docTheme = getDocumentTheme();
      if (docTheme) setDetected(docTheme);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (event: MediaQueryListEvent) => {
      if (!getDocumentTheme()) setDetected(event.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, [themeProp]);

  return themeProp ?? detected;
}
