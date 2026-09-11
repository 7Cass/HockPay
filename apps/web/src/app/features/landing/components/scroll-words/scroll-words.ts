import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
} from '@angular/core';
import { clamp, prefersReducedMotion } from '../../motion/motion';

/**
 * A paragraph that lights up word by word as it scrolls through the viewport.
 *
 * Only `--p` (0..1) is written per frame; each word works out its own opacity
 * in CSS from its index. Words wrapped in *asterisks* take the accent color.
 */
@Component({
  selector: 'app-scroll-words',
  template: `
    <p class="text">
      <span class="sr-only">{{ plain() }}</span>
      @for (word of words(); track $index) {
        <span class="w" [class.hl]="word.accent" [style.--i]="$index" aria-hidden="true">{{
          word.text + ' '
        }}</span>
      }
    </p>
  `,
  styleUrl: './scroll-words.css',
  host: { '[style.--n]': 'words().length' },
})
export class ScrollWords {
  readonly text = input.required<string>();

  protected readonly words = computed(() =>
    this.text()
      .split(/\s+/)
      .map((raw) => ({ text: raw.replace(/\*/g, ''), accent: raw.startsWith('*') })),
  );

  protected readonly plain = computed(() => this.text().replace(/\*/g, ''));

  constructor() {
    const host = inject(ElementRef).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    let frame = 0;
    let observer: IntersectionObserver | undefined;

    const measure = () => {
      frame = 0;
      const box = host.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = clamp((vh * 0.85 - box.top) / (box.height + vh * 0.35), 0, 1);
      host.style.setProperty('--p', progress.toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    afterNextRender(() => {
      if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
        host.style.setProperty('--p', '1');
        return;
      }
      measure();
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) window.addEventListener('scroll', onScroll, { passive: true });
        else window.removeEventListener('scroll', onScroll);
        measure();
      });
      observer.observe(host);
    });

    destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', onScroll);
    });
  }
}
