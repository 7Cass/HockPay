import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { clamp, prefersReducedMotion } from '../../motion/motion';

export interface Step {
  readonly n: string;
  readonly title: string;
  readonly body: string;
}

const WIDE = '(min-width: 1024px)';

/**
 * "Como funciona" as a pinned, sideways scroll: on wide screens the section
 * holds still while the vertical scroll slides the steps across, each one
 * drawing its sketch as it arrives. Narrow screens and reduced motion get the
 * same steps stacked.
 */
@Component({
  selector: 'app-pinned-steps',
  templateUrl: './pinned-steps.html',
  styleUrl: './pinned-steps.css',
  host: { '[class.is-pinned]': 'pinned()' },
})
export class PinnedSteps {
  readonly steps = input.required<readonly Step[]>();

  protected readonly pinned = signal(false);
  protected readonly active = signal(-1);

  private readonly pin = viewChild.required<ElementRef<HTMLElement>>('pin');
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  constructor() {
    const host = inject(ElementRef).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    let frame = 0;
    let wide: MediaQueryList | undefined;
    let observer: IntersectionObserver | undefined;

    const measure = () => {
      frame = 0;
      const n = this.steps().length;
      if (!this.pinned()) {
        this.track().nativeElement.style.transform = '';
        return;
      }
      const box = this.pin().nativeElement.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = clamp(-box.top / Math.max(box.height - vh, 1), 0, 1);
      const track = this.track().nativeElement;
      const distance = Math.max(track.scrollWidth - window.innerWidth, 0);

      track.style.transform = `translate3d(${(-progress * distance).toFixed(1)}px, 0, 0)`;
      host.style.setProperty('--p', progress.toFixed(3));
      this.active.set(Math.min(n - 1, Math.floor(progress * n + 0.35)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const decide = () => {
      this.pinned.set(!!wide?.matches && !prefersReducedMotion());
      if (!this.pinned()) this.active.set(this.steps().length - 1);
      onScroll();
    };

    afterNextRender(() => {
      if (typeof matchMedia !== 'function' || typeof IntersectionObserver === 'undefined') {
        this.active.set(this.steps().length - 1);
        return;
      }
      wide = matchMedia(WIDE);
      wide.addEventListener('change', decide);
      decide();

      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) window.addEventListener('scroll', onScroll, { passive: true });
        else window.removeEventListener('scroll', onScroll);
        onScroll();
      });
      observer.observe(host);
      window.addEventListener('resize', onScroll, { passive: true });
    });

    destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      wide?.removeEventListener('change', decide);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    });
  }
}
