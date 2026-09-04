import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
} from '@angular/core';

/**
 * Reveals the host element once it enters the viewport.
 *
 * The element starts translated/faded (see `.reveal` in the consuming stylesheet)
 * and gets `.reveal-in` the first time it intersects. The bound value is a
 * stagger delay in milliseconds, applied as the transition delay.
 *
 *   <div appReveal>…</div>
 *   <div [appReveal]="120">…</div>
 */
@Directive({
  selector: '[appReveal]',
  host: {
    class: 'reveal',
    '[style.transition-delay]': 'delay()',
  },
})
export class Reveal {
  readonly appReveal = input<number | string>(0);

  protected readonly delay = computed(() => `${Number(this.appReveal()) || 0}ms`);

  constructor() {
    const host = inject(ElementRef).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    let observer: IntersectionObserver | undefined;

    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') {
        host.classList.add('reveal-in');
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('reveal-in');
            observer?.unobserve(entry.target);
          }
        },
        { threshold: 0.15, rootMargin: '0px 0px -6% 0px' },
      );

      observer.observe(host);
    });

    destroyRef.onDestroy(() => observer?.disconnect());
  }
}
