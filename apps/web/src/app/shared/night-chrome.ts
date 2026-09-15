import { DOCUMENT, DestroyRef, afterNextRender, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';

/** O chão das telas escuras (landing e entrada); o resto do produto segue no papel claro. */
export const NIGHT = '#11110f';

/**
 * Paints what lies outside the page — overscroll, scrollbars, the mobile
 * address bar — in the night color while the calling screen is mounted, and
 * puts it all back on destroy. Call it from a component constructor.
 */
export function applyNightChrome(): void {
  const document = inject(DOCUMENT);
  const meta = inject(Meta);
  const root = document.documentElement;
  const previous = {
    background: document.body.style.backgroundColor,
    scheme: root.style.colorScheme,
    themeColor: meta.getTag('name="theme-color"')?.content,
  };

  afterNextRender(() => {
    document.body.style.backgroundColor = NIGHT;
    root.style.colorScheme = 'dark';
    meta.updateTag({ name: 'theme-color', content: NIGHT });
  });

  inject(DestroyRef).onDestroy(() => {
    document.body.style.backgroundColor = previous.background;
    root.style.colorScheme = previous.scheme;
    if (previous.themeColor) meta.updateTag({ name: 'theme-color', content: previous.themeColor });
  });
}
