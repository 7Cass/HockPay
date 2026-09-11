import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { clamp, damp, prefersReducedMotion } from '../../motion/motion';

const CRUISE = 70; // px/s with the page at rest

/**
 * A giant marquee that listens to the scroll: it speeds up and leans with the
 * scroll's velocity, and turns around when the scroll does.
 */
@Component({
  selector: 'app-velocity-marquee',
  template: `
    <div #track class="track">
      @for (pass of passes; track pass) {
        <div class="group">
          @for (item of items(); track $index; let odd = $odd) {
            <span class="item" [class.hollow]="odd">{{ item }}</span>
            <svg class="star" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 1v22M1 12h22M4.2 4.2l15.6 15.6M19.8 4.2 4.2 19.8" />
            </svg>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './velocity-marquee.css',
  host: { 'aria-hidden': 'true' },
})
export class VelocityMarquee {
  readonly items = input.required<readonly string[]>();

  protected readonly passes = [0, 1];

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  constructor() {
    const host = inject(ElementRef).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    let frame = 0;
    let last = 0;
    let lastScroll = 0;
    let x = 0;
    let skew = 0;
    let direction = -1;
    let observer: IntersectionObserver | undefined;

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;

      const scrolled = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      const velocity = scrolled / dt; // px/s
      if (scrolled !== 0) direction = scrolled > 0 ? -1 : 1;

      const el = this.track().nativeElement;
      const half = el.scrollWidth / 2;
      x += direction * (CRUISE + Math.min(Math.abs(velocity) * 0.6, 1600)) * dt;
      if (half > 0) {
        if (x <= -half) x += half;
        if (x > 0) x -= half;
      }
      skew += (clamp(-velocity * 0.004, -10, 10) - skew) * damp(8, dt);
      el.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;

      frame = requestAnimationFrame(tick);
    };

    afterNextRender(() => {
      if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;

      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !frame) {
          last = 0;
          lastScroll = window.scrollY;
          frame = requestAnimationFrame(tick);
        } else if (!entry.isIntersecting) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      });
      observer.observe(host);
    });

    destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    });
  }
}
